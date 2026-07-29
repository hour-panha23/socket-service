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
import { AppsService } from '../app/apps.service';
import { NotificationsService } from './notifications.service';

import {
  buildSignedMessage,
  isTimestampFresh,
  verifyHmacSignature,
} from '@/common/crypto/signature.util';
import { WsAppAuthGuard } from './ws-auth.guard';

export interface AppData {
  appId: string;
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

@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
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
    private appsService: AppsService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Namespace) {
    this.notificationsService.setServer(server);
    this.logger.debug('NotificationsGateway initialized');
  }

  async handleConnection(client: TypedSocket) {
    this.logger.debug(`[WS Connect] New incoming connection attempt`, {
      clientId: client.id,
      transport: client.conn.transport.name,
    });

    const auth = (client.handshake.auth ?? {}) as Record<string, any>;
    const headers = (client.handshake.headers ?? {}) as Record<string, any>;
    const query = (client.handshake.query ?? {}) as Record<string, any>;

    // Fallback support for both app_id (snake_case) and appId (camelCase)
    const proId =
      auth.project_id || headers['x-project-id'] || query.project_id;
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

    this.logger.debug(`[WS Auth Extraction] Extracted credentials`, {
      clientId: client.id,
      app_id,
      timestamp,
      signature: signature ? `${signature.slice(0, 8)}...` : undefined, // truncated for security
      sources: {
        authKeys: Object.keys(auth),
        headerKeys: Object.keys(headers),
        queryKeys: Object.keys(query),
      },
    });

    // Step 1: Missing Credentials Check
    if (!app_id || !timestamp || !signature) {
      this.logger.error(`[WS Auth Failed] Missing credentials`, {
        clientId: client.id,
        hasAppId: !!app_id,
        hasTimestamp: !!timestamp,
        hasSignature: !!signature,
      });
      client.disconnect(true);
      return;
    }

    // Step 2: Timestamp Freshness Check
    const isFresh = isTimestampFresh(timestamp);
    if (!isFresh) {
      this.logger.error(`[WS Auth Failed] Stale timestamp`, {
        clientId: client.id,
        app_id,
        providedTimestamp: timestamp,
        currentTime: Date.now(),
      });
      client.disconnect(true);
      return;
    }

    // Step 3: Admin Auth Checks
    const adminAppId = this.configService.get<string>('ADMIN_APP_ID');
    const adminSecretKey = this.configService.get<string>('ADMIN_SECRET_KEY');

    if (adminAppId && adminSecretKey && app_id === adminAppId) {
      this.logger.debug(`[WS Auth] Attempting admin authentication`, {
        clientId: client.id,
        adminAppId,
      });

      const message = buildSignedMessage(app_id, timestamp);
      const isValidAdmin = verifyHmacSignature(
        message,
        signature,
        adminSecretKey,
      );

      if (!isValidAdmin) {
        this.logger.error(`[WS Auth Failed] Admin HMAC signature mismatch`, {
          clientId: client.id,
          app_id,
          signedMessage: message,
        });
        client.disconnect(true);
        return;
      }

      client.data.app = { appId: app_id, name: 'Admin Monitor', isAdmin: true };
      await client.join(`service:${app_id}`);

      this.logger.debug(`[WS Auth Success] Admin app connected & joined room`, {
        clientId: client.id,
        room: `service:${app_id}`,
      });

      this.emitConnectEvent(client);
      return;
    }

    // Step 4: Standard App Auth Check
    this.logger.debug(`[WS Auth] Verifying standard app signature`, {
      clientId: client.id,
      app_id,
    });

    const startTime = Date.now();

    try {
      const app = await this.appsService.verifySignature(
        app_id,
        timestamp,
        signature,
        proId,
        userId,
      );

      if (!app) {
        this.logger.error(
          `[WS Auth Failed] App signature invalid or app not found in DB`,
          { clientId: client.id, app_id, proId, userId },
        );
        client.disconnect(true);
        return;
      }

      client.data.app = { appId: app.app_id, name: app.name, isAdmin: false };
      await client.join(`service:${app.app_id}`);

      // only join the private user room if this connection actually verified as user-scoped
      if (proId && userId) {
        await client.join(`user:${proId}:${userId}`);
        this.logger.debug(
          `Socket ${client.id} auto-joined verified user channel`,
          {
            proId,
            userId,
          },
        );
      }

      this.emitConnectEvent(client);
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      this.logger.error(
        `[WS Auth Exception] Crash inside verifySignature after ${durationMs}ms`,
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
    this.logger.debug(`Client disconnected: ${client.id}`);
    this.server.to('admin:monitor').emit('admin:client_event', {
      type: 'disconnect',
      clientId: client.id,
      appId: client.data.app?.appId,
      timestamp: new Date().toISOString(),
    });
  }

  private emitConnectEvent(client: TypedSocket) {
    this.server.to('admin:monitor').emit('admin:client_event', {
      type: 'connect',
      clientId: client.id,
      appId: client.data.app?.appId,
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

    this.logger.debug(`Socket ${client.id} joined hierarchical rooms`, {
      clientId: client.id,
      rooms: [projectRoom, appRoom, specificRoom],
      dto: data,
    });

    this.server.to('admin:monitor').emit('admin:room_event', {
      type: 'join',
      clientId: client.id,
      appId: client.data.app?.appId,
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

    this.logger.debug(`Socket ${client.id} left room ${specificRoom}`);

    this.server.to('admin:monitor').emit('admin:room_event', {
      type: 'leave',
      clientId: client.id,
      appId: client.data.app?.appId,
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
    this.logger.debug(`Socket ${client.id} joined user channel`, {
      userId: data.userId,
    });
    return {
      event: 'user_channel_joined',
      data: { status: 'success', userId: data.userId },
    };
  }

  // TODO: once app roles exist, gate this to isAdmin apps only —
  // right now any authenticated app can see every emitted payload.
  @UseGuards(WsAppAuthGuard)
  @SubscribeMessage('admin:subscribe')
  async handleAdminSubscribe(@ConnectedSocket() client: TypedSocket) {
    await client.join('admin:monitor');
    this.logger.debug(`Client ${client.id} subscribed to admin monitor`);
    return { event: 'admin:subscribed', data: { status: 'ok' } };
  }

  @UseGuards(WsAppAuthGuard)
  @SubscribeMessage('admin:unsubscribe')
  async handleAdminUnsubscribe(@ConnectedSocket() client: TypedSocket) {
    await client.leave('admin:monitor');
    return { event: 'admin:unsubscribed', data: { status: 'ok' } };
  }
}
