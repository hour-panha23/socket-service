import { Str } from '@/common/decorator/field.decorator';
import { DevicePlatform } from '../notifications/notifications.types';

export class RegisterDeviceTokenDto {
  @Str() token!: string;
  @Str(['ios', 'android']) platform!: DevicePlatform;
}
