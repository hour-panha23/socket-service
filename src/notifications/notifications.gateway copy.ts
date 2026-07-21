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
      process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*', // Allows connections from file:// or local testing tools
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  afterInit(server: Server) {
    this.notificationsService.setServer(server);
  }

  async handleConnection(client: TypedSocket) {
    // 🧪 AUTH TEMPORARILY DISABLED FOR TESTING
    console.log('Client connected (Unauthenticated Test):', client.id);

    // Mock dummy user payload for test room joins
    client.data.user = { sub: 'test_user_123' };
    await client.join('user:test_user_123');

    // const auth = client.handshake.auth as { token?: unknown };
    // const rawAuthorization = client.handshake.headers?.authorization;

    // const authToken = typeof auth?.token === 'string' ? auth.token : undefined;
    // const headerToken =
    //   typeof rawAuthorization === 'string'
    //     ? rawAuthorization.split(' ')[1]
    //     : undefined;

    // const token = authToken || headerToken;

    // if (!token) {
    //   client.disconnect();
    //   return;
    // }

    // try {
    //   const payload = this.jwtService.verify<JwtPayload>(token);
    //   client.data.user = payload;
    //   await client.join(`user:${payload.sub}`);
    // } catch {
    //   client.disconnect();
    // }
  }

  handleDisconnect(client: TypedSocket) {
    console.log('Client disconnected:', client.id);
  }

  // Subscribing clients dynamically to hierarchical rooms
  // @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: RoomDto,
  ) {
    const projectRoom = `project:${data.projectId}`;
    const appRoom = `project:${data.projectId}:app:${data.appId}`;
    const specificRoom = `project:${data.projectId}:app:${data.appId}:room:${data.roomId}`;

    // Join all relevant scope levels
    await client.join([projectRoom, appRoom, specificRoom]);

    return { event: 'room_joined', data: { status: 'success', ...data } };
  }

  // @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: TypedSocket,
    @MessageBody() data: RoomDto,
  ) {
    const specificRoom = `project:${data.projectId}:app:${data.appId}:room:${data.roomId}`;
    await client.leave(specificRoom);

    return {
      event: 'room_left',
      data: { status: 'success', roomId: data.roomId },
    };
  }
}
