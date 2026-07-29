// auth.controller.ts
import {
  JwtAuthGuard,
  JwtRefreshAuthGuard,
} from '@/common/guard/jwt-auth.guard';
import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    // Returns { access_token, refresh_token }
    return this.authService.getTokens(req.user.id, req.user.email);
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  async refreshTokens(@Request() req: any) {
    return this.authService.refreshTokens(req.user.userId, req.user.email);
  }
}
