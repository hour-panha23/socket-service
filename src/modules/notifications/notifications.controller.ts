import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { HmacAuthGuard } from '@/common/guard/hmac-auth.guard';
import {
  EmitBroadcastDto,
  EmitMessageDto,
  EmitToAppDto,
  EmitToProjectDto,
  EmitToRoomDto,
  EmitToUserDto,
} from './notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(HmacAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('emit/project')
  async emitToProject(@Body() body: EmitToProjectDto) {
    const result = await this.notificationsService.sendToProject(
      body.project_id,
      body.event,
      body.payload,
      body.sender_socket_id,
    );
    return { success: true, ...result };
  }

  @Post('emit')
  async emit(@Body() body: EmitMessageDto) {
    const result = await this.notificationsService.sendMessage(body);
    return { success: true, ...result };
  }

  @Post('emit/app')
  async emitToApp(@Body() body: EmitToAppDto) {
    const result = await this.notificationsService.sendToApp(
      body.project_id,
      body.app_id,
      body.event,
      body.payload,
      body.sender_socket_id,
    );
    return { success: true, ...result };
  }

  @Post('emit/room')
  async emitToRoom(@Body() body: EmitToRoomDto) {
    const result = await this.notificationsService.sendToRoom(
      body.project_id,
      body.app_id,
      body.room,
      body.event,
      body.payload,
      body.sender_socket_id,
    );
    return { success: true, ...result };
  }

  @Post('emit/user')
  async emitToUser(@Body() body: EmitToUserDto) {
    const result = await this.notificationsService.sendToUser(
      body.project_id,
      body.app_id,
      body.user_id,
      body.event,
      body.payload,
      body.sender_socket_id,
    );
    return { success: true, ...result };
  }

  @Post('emit/broadcast')
  async emitBroadcast(@Body() body: EmitBroadcastDto) {
    const result = await this.notificationsService.sendToAll(
      body.event,
      body.payload,
      body.sender_socket_id,
    );
    return { success: true, ...result };
  }

  // room stats: which rooms are active and how many sockets are in each
  @Get('stats/rooms')
  getRoomStats() {
    return this.notificationsService.getRoomStats();
  }

  // total connected client count on the /notifications namespace
  @Get('stats/clients')
  getClientStats() {
    return {
      connectedClients: this.notificationsService.getConnectedClientCount(),
    };
  }
}
