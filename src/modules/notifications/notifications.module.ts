import { LoggerModule } from '@/common/logger/logger.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HmacAuthGuard } from '@/common/guard/hmac-auth.guard';
import { BullModule } from '@nestjs/bullmq';
import { ProjectModule } from '../project/project.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { SocketMonitorController } from './socket-monitor.controller';
import { WsAppAuthGuard } from './ws-auth.guard';

@Module({
  imports: [
    LoggerModule,
    ProjectModule,
    ConfigModule,
    BullModule.registerQueue({
      name: 'webhook-retry',
    }),
  ],
  controllers: [NotificationsController, SocketMonitorController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    WsAppAuthGuard,
    HmacAuthGuard,
  ],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
