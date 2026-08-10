import { UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { DefaultEventsMap, Namespace, Socket } from 'socket.io';
import { LoggerService } from '../../common/logger/logger.service';
import { NotificationsService } from './notifications.service';

import {
  buildSignedMessage,
  isTimestampFresh,
  verifyHmacSignature,
} from '@/common/crypto/signature.util';
import { ProjectService } from '../project/project.service';
import { WsAppAuthGuard } from './ws-auth.guard';

export interface AppData {
  projectId: string;
  name: string;
  isAdmin: boolean;
}

export interface CustomSocketData {
  app?: AppData;
}

export type TypedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  CustomSocketData
>;

interface AppHandshakeAuth {
  app_id: string;
  timestamp: string;
  signature: string;
}

interface RoomDto {
  projectId: string;
  appId: string;
  roomId: string;
}

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  magenta: (str: string) => `\x1b[35m${str}\x1b[0m`,
  cyan: (str: string) => `\x1b[36m${str}\x1b[0m`,
  green: (str: string) => `\x1b[32m${str}\x1b[0m`,
  yellow: (str: string) => `\x1b[33m${str}\x1b[0m`,
  red: (str: string) => `\x1b[31m${str}\x1b[0m`,
  blue: (str: string) => `\x1b[34m${str}\x1b[0m`,
};

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Namespace;

  constructor(
    private notificationsService: NotificationsService,
    private logger: LoggerService,
    private appsService: ProjectService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Namespace) {
    this.notificationsService.setServer(server);
    this.logger.debug(`${colors.green('✔')} NotificationsGateway initialized`);
  }

  async handleConnection(client: TypedSocket) {
    this.logger.debug(
      `[WS Connect] Socket ${colors.magenta(client.id)} initiating transport ${colors.cyan(client.conn.transport.name)}`,
      { clientId: client.id, transport: client.conn.transport.name },
    );

    const auth = (client.handshake.auth ?? {}) as Record<string, any>;
    const headers = (client.handshake.headers ?? {}) as Record<string, any>;
    const query = (client.handshake.query ?? {}) as Record<string, any>;

    const proId =
      auth.project_id ||
      auth.projectId ||
      headers['x-project-id'] ||
      query.project_id ||
      query.projectId;
    const app_id =
      auth.app_id ||
      auth.appId ||
      headers['x-app-id'] ||
      query.app_id ||
      query.appId;
    const timestamp =
      auth.timestamp || headers['x-timestamp'] || query.timestamp;
    const signature =
      auth.signature || headers['x-signature'] || query.signature;
    const userId = auth.user_id || headers['x-user-id'] || query.user_id;

    this.logger.debug(
      `[WS Auth Extraction] Credentials for ${colors.magenta(client.id)} (proId: ${colors.yellow(proId ?? 'N/A')})`,
      {
        clientId: client.id,
        proId,
        timestamp,
        signature: signature ? `${signature.slice(0, 8)}...` : undefined,
        sources: {
          authKeys: Object.keys(auth),
          headerKeys: Object.keys(headers),
          queryKeys: Object.keys(query),
        },
      },
    );

    // Step 1: Missing Credentials Check
    if (!proId || !timestamp || !signature) {
      this.logger.error(
        `${colors.red('✘')} [WS Auth Failed] Missing credentials for ${colors.magenta(client.id)}`,
        {
          clientId: client.id,
          hasProId: !!proId,
          hasTimestamp: !!timestamp,
          hasSignature: !!signature,
        },
      );
      client.disconnect(true);
      return;
    }

    // Step 2: Timestamp Freshness Check
    const isFresh = isTimestampFresh(timestamp);
    if (!isFresh) {
      this.logger.error(
        `${colors.red('✘')} [WS Auth Failed] Stale timestamp from ${colors.magenta(client.id)} (${colors.yellow(timestamp)})`,
        {
          clientId: client.id,
          proId,
          providedTimestamp: timestamp,
          currentTime: Date.now(),
        },
      );
      client.disconnect(true);
      return;
    }

    // Step 3: Admin Auth Checks
    const adminAppId = this.configService.get<string>('ADMIN_APP_ID');
    const adminSecretKey = this.configService.get<string>('ADMIN_SECRET_KEY');

    if (adminAppId && adminSecretKey && proId === '1') {
      this.logger.debug(
        `[WS Auth] Checking admin credentials for ${colors.magenta(client.id)}`,
        { clientId: client.id, adminAppId },
      );

      const message = buildSignedMessage(proId, timestamp);
      const isValidAdmin = verifyHmacSignature(
        message,
        signature,
        adminSecretKey,
      );

      if (!isValidAdmin) {
        this.logger.error(
          `${colors.red('✘')} [WS Auth Failed] Admin signature mismatch for ${colors.magenta(client.id)}`,
          { clientId: client.id, app_id, signedMessage: message },
        );
        client.disconnect(true);
        return;
      }

      client.data.app = {
        projectId: proId,
        name: 'Admin Monitor',
        isAdmin: true,
      };
      await client.join(`service:${proId}`);

      this.logger.debug(
        `${colors.green('✔')} [WS Auth Success] Admin ${colors.magenta(client.id)} -> ${colors.cyan(`service:${proId}`)}`,
        { clientId: client.id, room: `service:${proId}` },
      );

      this.emitConnectEvent(client);
      return;
    }

    // Step 4: Standard App Auth Check
    this.logger.debug(
      `[WS Auth] Verifying standard signature for ${colors.magenta(client.id)}`,
      { clientId: client.id, proId },
    );

    const startTime = Date.now();

    try {
      const app = await this.appsService.verifySignature(
        proId,
        timestamp,
        signature,
        app_id,
        userId,
      );

      if (!app) {
        this.logger.error(
          `${colors.red('✘')} [WS Auth Failed] Invalid signature or app missing for ${colors.magenta(client.id)}`,
          { clientId: client.id, app_id, proId, userId },
        );
        client.disconnect(true);
        return;
      }

      client.data.app = {
        projectId: app.project_id,
        name: app.name,
        isAdmin: false,
      };
      await client.join(`service:${app.project_id}`);

      if (proId && userId) {
        await client.join(`user:${proId}:${userId}`);
        this.logger.debug(
          `Socket ${colors.magenta(client.id)} auto-joined channel ${colors.cyan(`user:${proId}:${userId}`)}`,
          { proId, userId },
        );
      }

      this.emitConnectEvent(client);
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      this.logger.error(
        `${colors.red('✘')} [WS Auth Exception] Crash in verifySignature after ${colors.yellow(`${durationMs}ms`)} for ${colors.magenta(client.id)}`,
        {
          clientId: client.id,
          app_id,
          errorMessage: error?.message || String(error),
          errorStack: error?.stack,
        },
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: TypedSocket) {
    this.logger.debug(
      `${colors.yellow('⚡')} Client disconnected: ${colors.magenta(client.id)}`,
    );
    this.server.to('admin:monitor').emit('admin:client_event', {
      type: 'disconnect',
      clientId: client.id,
      appId: client.data.app?.projectId,
      timestamp: new Date().toISOString(),
    });
  }

  private emitConnectEvent(client: TypedSocket) {
    this.server.to('admin:monitor').emit('admin:client_event', {
      type: 'connect',
      clientId: client.id,
      appId: client.data.app?.projectId,
      timestamp: new Date().toISOString(),
    });
  }

  @UseGuards(WsAppAuthGuard)
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: RoomDto,
  ) {
    const projectRoom = `project:${data.projectId}`;
    const appRoom = `project:${data.projectId}:app:${data.appId}`;
    const specificRoom = `project:${data.projectId}:app:${data.appId}:room:${data.roomId}`;

    await client.join([projectRoom, appRoom, specificRoom]);

    this.logger.debug(
      `Socket ${colors.magenta(client.id)} joined rooms: [${colors.cyan(projectRoom)}, ${colors.cyan(appRoom)}, ${colors.cyan(specificRoom)}]`,
      {
        clientId: client.id,
        rooms: [projectRoom, appRoom, specificRoom],
        dto: data,
      },
    );

    this.server.to('admin:monitor').emit('admin:room_event', {
      type: 'join',
      clientId: client.id,
      appId: client.data.app?.projectId,
      rooms: [projectRoom, appRoom, specificRoom],
      timestamp: new Date().toISOString(),
    });

    return { event: 'room_joined', data: { status: 'success', ...data } };
  }

  @UseGuards(WsAppAuthGuard)
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: RoomDto,
  ) {
    const specificRoom = `project:${data.projectId}:app:${data.appId}:room:${data.roomId}`;
    await client.leave(specificRoom);

    this.logger.debug(
      `Socket ${colors.magenta(client.id)} left room ${colors.cyan(specificRoom)}`,
    );

    this.server.to('admin:monitor').emit('admin:room_event', {
      type: 'leave',
      clientId: client.id,
      appId: client.data.app?.projectId,
      rooms: [specificRoom],
      timestamp: new Date().toISOString(),
    });

    return {
      event: 'room_left',
      data: { status: 'success', roomId: data.roomId },
    };
  }

  @UseGuards(WsAppAuthGuard)
  @SubscribeMessage('join_user_channel')
  async handleJoinUserChannel(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: { userId: string },
  ) {
    await client.join(`user:${data.userId}`);
    this.logger.debug(
      `Socket ${colors.magenta(client.id)} joined user channel ${colors.cyan(`user:${data.userId}`)}`,
      { userId: data.userId },
    );
    return {
      event: 'user_channel_joined',
      data: { status: 'success', userId: data.userId },
    };
  }

  @UseGuards(WsAppAuthGuard)
  @SubscribeMessage('admin:subscribe')
  async handleAdminSubscribe(@ConnectedSocket() client: TypedSocket) {
    await client.join('admin:monitor');
    this.logger.debug(
      `Client ${colors.magenta(client.id)} subscribed to ${colors.cyan('admin:monitor')}`,
    );
    return { event: 'admin:subscribed', data: { status: 'ok' } };
  }

  @UseGuards(WsAppAuthGuard)
  @SubscribeMessage('admin:unsubscribe')
  async handleAdminUnsubscribe(@ConnectedSocket() client: TypedSocket) {
    await client.leave('admin:monitor');
    this.logger.debug(
      `Client ${colors.magenta(client.id)} unsubscribed from ${colors.cyan('admin:monitor')}`,
    );
    return { event: 'admin:unsubscribed', data: { status: 'ok' } };
  }
}
