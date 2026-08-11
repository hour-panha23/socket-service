import { HmacAuthGuard } from '@/common/guard/hmac-auth.guard';
import { logger } from '@/common/logger/logger.service';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EmitMessageDto } from './notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(HmacAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Post('emit')
  async emit(@Body() body: EmitMessageDto) {
    logger.debug('[Emit Message] with body: ', JSON.stringify(body));
    try {
      const result = await this.notificationsService.sendMessage(body);
      return { success: true, ...result };
    } catch (error) {
      logger.error(`[Emit Error]: ${error}`);
      throw error;
    }
  }

  @Get('stats/rooms')
  getRoomStats() {
    return this.notificationsService.getRoomStats();
  }

  @Get('stats/clients')
  getClientStats() {
    return {
      connectedClients: this.notificationsService.getConnectedClientCount(),
    };
  }
}
