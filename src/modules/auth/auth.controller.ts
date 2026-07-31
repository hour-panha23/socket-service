// auth.controller.ts
import { JwtRefreshAuthGuard } from '@/common/guard/jwt-auth.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { logger } from '@/common/logger/logger.service';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { LoginDto, RefreshTokenDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
@UseInterceptors(TransformInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  async refreshTokens(@Req() req: RefreshTokenDto) {
    return this.authService.refreshTokens(req.userId, req.refreshToken);
  }

  @Get('check-cookies')
  checkCookies(@Req() req: Request) {
    const cookies = req.cookies;
    const hasCookies = cookies && Object.keys(cookies).length > 0;
    const rawCookieHeader = req.headers.cookie;

    logger.info('Parsed Cookies:', cookies);
    logger.info('Raw Cookie Header:', rawCookieHeader);

    return {
      hasCookies,
      cookiesReceived: cookies,
      rawCookieHeader: rawCookieHeader || 'No cookie header present',
    };
  }
}
