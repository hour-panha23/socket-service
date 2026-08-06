// src/app.module.ts
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './common/logger/logger.module';
import { HardwareGateway } from './hardware.gateway';
import { AuthModule } from './modules/auth/auth.module';
import { DeviceModule } from './modules/device/device.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectModule } from './modules/project/project.module';
import { PushModule } from './modules/push/push.module';
import { UsersModule } from './modules/users/users.module';
import { RedisModule } from './services/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    LoggerModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    ProjectModule,
    PushModule,
    DeviceModule,
    RedisModule,
    HttpModule,
  ],
  providers: [HardwareGateway],
})
export class AppModule {}
