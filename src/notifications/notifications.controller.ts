import { Body, Controller, Post } from '@nestjs/common';

import {
  EmitToAppDto,
  EmitToProjectDto,
  EmitToRoomDto,
} from './notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Emit to all sockets in a project
  @Post('emit/project')
  async emitToProject(@Body() body: EmitToProjectDto) {
    await this.notificationsService.sendToProject(
      body.projectId,
      body.event,
      body.payload,
    );
    return { success: true, scope: 'project', target: body.projectId };
  }

  // Emit to all sockets in a specific app within a project
  @Post('emit/app')
  async emitToApp(@Body() body: EmitToAppDto) {
    await this.notificationsService.sendToApp(
      body.projectId,
      body.appId,
      body.event,
      body.payload,
    );
    return {
      success: true,
      scope: 'app',
      target: `${body.projectId}:${body.appId}`,
    };
  }

  // Emit to a specific room within an app
  @Post('emit/room')
  async emitToRoom(@Body() body: EmitToRoomDto) {
    await this.notificationsService.sendToRoom(
      body.projectId,
      body.appId,
      body.roomId,
      body.event,
      body.payload,
    );
    return { success: true, scope: 'room', target: body.roomId };
  }

  @Post('test-emit')
  async triggerEmit(
    @Body()
    body: EmitToRoomDto,
  ) {
    await this.notificationsService.sendToRoom(
      body.projectId,
      body.appId,
      body.roomId,
      body.event,
      body.payload,
    );

    return { status: 'emitted', target: body };
  }
}
