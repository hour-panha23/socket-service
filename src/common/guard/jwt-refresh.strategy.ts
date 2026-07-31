// jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (req?.headers?.cookie) {
            const cookies = req.headers.cookie.split(';');
            const cookie = cookies.find((cookie) =>
              cookie.startsWith('refresh_token='),
            );
            if (cookie) {
              return cookie.split('=')[1];
            }
          }
          return req?.cookies?.refresh_token || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_REFRESH_SECRET',
        'refresh_fallback_secret',
      ),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }
    return { userId: payload.sub, email: payload.email };
  }
}
