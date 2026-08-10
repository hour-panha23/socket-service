import { logger } from '@/common/logger/logger.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms'; // Or use explicit type assertion
import ms from 'ms';
import { UsersService } from '../users/users.service';
import { LoginDto } from './auth.dto';
import { AuthRepository } from './auth.repo';
import { LoginResponse } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authRepository: AuthRepository,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findByUsername(loginDto.username);

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };

    const accessExpiration = this.configService.get<string>(
      'JWT_ACCESS_EXPIRATION',
      '15m',
    ) as StringValue;

    const refreshExpiration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    ) as StringValue;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiration,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiration,
      }),
    ]);

    const refreshMs = ms(refreshExpiration);
    const expiresAt = new Date(Date.now() + refreshMs);

    await this.authRepository.replaceRefreshToken(
      user.id,
      refreshToken,
      expiresAt,
    );

    delete user.password;

    return {
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshTokens(userId: string, incomingRefreshToken: string) {
    const tokenRecord =
      await this.authRepository.findRefreshTokenByToken(incomingRefreshToken);

    if (!tokenRecord) {
      await this.authRepository.deleteAllRefreshTokensForUser(userId);
      throw new UnauthorizedException(
        'Invalid refresh token. Potential reuse detected — session terminated.',
      );
    }

    if (tokenRecord.userId !== userId || new Date() > tokenRecord.expires_at) {
      await this.authRepository.deleteAllRefreshTokensForUser(userId);
      throw new UnauthorizedException('Expired or invalid refresh token.');
    }

    const payload = { sub: userId };

    const accessExpiration = this.configService.get<string>(
      'JWT_ACCESS_EXPIRATION',
      '15m',
    ) as StringValue;

    const refreshExpiration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    ) as StringValue;

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiration,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiration,
      }),
    ]);

    const refreshMs = ms(refreshExpiration);
    const expiresAt = new Date(Date.now() + refreshMs);

    const rotatedSuccessfully = await this.authRepository.rotateRefreshToken(
      userId,
      incomingRefreshToken,
      newRefreshToken,
      expiresAt,
    );

    if (!rotatedSuccessfully) {
      await this.authRepository.deleteAllRefreshTokensForUser(userId);
      throw new UnauthorizedException('Concurrent refresh conflict detected.');
    }

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }
}
