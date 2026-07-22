// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HardwareGateway } from './hardware.gateway';
import { LoggerModule } from './logger/logger.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    NotificationsModule,
  ],
  providers: [HardwareGateway],
})
export class AppModule {}
