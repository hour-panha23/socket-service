import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
import { LoggerService } from '../logger/logger.service';
import { NotificationsService } from './notifications.service';
import { WsJwtGuard } from './ws-jwt.guard';

export interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

export interface CustomSocketData {
  user?: JwtPayload;
}

export type TypedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  CustomSocketData
>;

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
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private logger: LoggerService,
  ) {}

  afterInit(server: Server) {
    this.notificationsService.setServer(server);
    this.logger.debug('NotificationsGateway initialized');
  }

  async handleConnection(client: TypedSocket) {
    try {
      // 🔑 Extract token from auth payload or Bearer headers
      const rawToken =
        client.handshake.auth?.token || client.handshake.headers?.authorization;

      if (!rawToken) {
        throw new Error('No authorization token provided');
      }

      const token = rawToken.replace(/^Bearer\s+/i, '');

      // Verify JWT token dynamically
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.user = payload;

      const userId = payload.sub;
      await client.join(`user:${userId}`);

      this.logger.debug(`Client connected and authenticated: ${client.id}`, {
        userId,
      });
    } catch (error) {
      this.logger.error(`Connection rejected for client ${client.id}`, {
        reason: (error as Error).message,
      });
      // Disconnect unauthenticated client
      client.disconnect(true);
    }
  }

  handleDisconnect(client: TypedSocket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
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

    return { event: 'room_joined', data: { status: 'success', ...data } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: RoomDto,
  ) {
    const specificRoom = `project:${data.projectId}:app:${data.appId}:room:${data.roomId}`;
    await client.leave(specificRoom);

    this.logger.debug(`Socket ${client.id} left room ${specificRoom}`);

    return {
      event: 'room_left',
      data: { status: 'success', roomId: data.roomId },
    };
  }
}
