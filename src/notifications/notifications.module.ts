import { LoggerModule } from '@/logger/logger.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    LoggerModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService, WsJwtGuard],
  exports: [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
