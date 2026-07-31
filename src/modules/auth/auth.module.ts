import { JwtRefreshStrategy } from '@/common/guard/jwt-refresh.strategy';
import { JwtStrategy } from '@/common/guard/jwt.strategy';
import { DatabaseModule } from '@/database/database.module';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repo';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_ACCESS_SECRET',
          'access_fallback_secret',
        ),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_ACCESS_EXPIRATION',
            '15m',
          ) as StringValue,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtStrategy, JwtRefreshStrategy],
  exports: [
    AuthService,
    AuthRepository,
    PassportModule,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
})
export class AuthModule {}
