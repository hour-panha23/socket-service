import { Body, Controller, Get, Post } from '@nestjs/common';

import {
  EmitToAppDto,
  EmitToProjectDto,
  EmitToRoomDto,
} from './notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('emit/project')
  async emitToProject(@Body() body: EmitToProjectDto) {
    const result = await this.notificationsService.sendToProject(
      body.projectId,
      body.event,
      body.payload,
      body.senderSocketId,
    );
    return { success: true, ...result };
  }

  @Post('emit/app')
  async emitToApp(@Body() body: EmitToAppDto) {
    const result = await this.notificationsService.sendToApp(
      body.projectId,
      body.appId,
      body.event,
      body.payload,
      body.senderSocketId,
    );
    return { success: true, ...result };
  }

  @Post('emit/room')
  async emitToRoom(@Body() body: EmitToRoomDto) {
    const result = await this.notificationsService.sendToRoom(
      body.projectId,
      body.appId,
      body.roomId,
      body.event,
      body.payload,
      body.senderSocketId,
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
