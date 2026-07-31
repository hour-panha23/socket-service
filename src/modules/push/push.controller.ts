import { CurrentUser } from '@/common/decorator/user.decorator';
import { JwtAuthGuard } from '@/common/guard/jwt-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { RegisterDeviceTokenDto } from './push.dto';
import { PushRepository } from './push.repo';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(
    private readonly notificationsRepo: PushRepository,
    private readonly pushService: PushService,
  ) {}

  @Post('device-tokens')
  registerDeviceToken(
    @CurrentUser('userId') userId: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsRepo.upsertDeviceToken(
      userId,
      dto.token,
      dto.platform,
    );
  }

  @Delete('device-tokens/:token')
  removeDeviceToken(@Param('token') token: string) {
    return this.notificationsRepo.removeDeviceToken(token);
  }

  @Post('debug/push-test')
  async testPush(@CurrentUser('userId') userId: string) {
    return this.pushService.send(userId, {
      title: 'Test',
      body: 'Hello from NestJS',
    });
  }
}
