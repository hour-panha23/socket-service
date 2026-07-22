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
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { LoggerService } from '../../logger/logger.service';
import { AppsService } from '../app/apps.service';
import { NotificationsService } from './notifications.service';

import {
  buildSignedMessage,
  isTimestampFresh,
  verifyHmacSignature,
} from '@/common/crypto/signature.util';
import { WsAppAuthGuard } from './ws-jwt.guard';

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
  server!: Server;

  constructor(
    private notificationsService: NotificationsService,
    private logger: LoggerService,
    private appsService: AppsService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.notificationsService.setServer(server);
    this.logger.debug('NotificationsGateway initialized');
  }

  async handleConnection(client: TypedSocket) {
    const { app_id, timestamp, signature } = (client.handshake.auth ??
      {}) as Partial<AppHandshakeAuth>;

    if (!app_id || !timestamp || !signature) {
      this.logger.error(`Connection rejected: missing credentials`, {
        clientId: client.id,
      });
      client.disconnect(true);
      return;
    }

    if (!isTimestampFresh(timestamp)) {
      this.logger.error(`Connection rejected: stale timestamp`, {
        clientId: client.id,
        app_id,
      });
      client.disconnect(true);
      return;
    }

    const adminAppId = this.configService.get<string>('ADMIN_APP_ID');
    const adminSecretKey = this.configService.get<string>('ADMIN_SECRET_KEY');

    if (adminAppId && adminSecretKey && app_id === adminAppId) {
      const message = buildSignedMessage(app_id, timestamp);
      const isValidAdmin = verifyHmacSignature(
        message,
        signature,
        adminSecretKey,
      );

      if (!isValidAdmin) {
        this.logger.error(`Admin auth rejected: bad signature`, {
          clientId: client.id,
        });
        client.disconnect(true);
        return;
      }

      client.data.app = { appId: app_id, name: 'Admin Monitor', isAdmin: true };
      await client.join(`service:${app_id}`);
      this.emitConnectEvent(client);
      this.logger.debug(`Admin app connected: ${app_id}`, {
        clientId: client.id,
      });
      return;
    }

    const app = await this.appsService.verifySignature(
      app_id,
      timestamp,
      signature,
    );
    if (!app) {
      this.logger.error(`App auth rejected for client ${client.id}`, {
        app_id,
      });
      client.disconnect(true);
      return;
    }

    client.data.app = { appId: app.app_id, name: app.name, isAdmin: false };
    await client.join(`service:${app.app_id}`);
    this.emitConnectEvent(client);
    this.logger.debug(`App connected: ${app.app_id}`, { clientId: client.id });
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
