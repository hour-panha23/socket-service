// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './common/logger/logger.module';
import { HardwareGateway } from './hardware.gateway';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectModule } from './modules/project/project.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    LoggerModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    ProjectModule,
  ],
  providers: [HardwareGateway],
})
export class AppModule {}
