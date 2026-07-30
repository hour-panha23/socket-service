import { Email, Str } from '@/common/decorator/field.decorator';

export class LoginDto {
  @Email() email!: string;
  @Str() password!: string;
}

export class RefreshTokenDto {
  @Str() userId!: string;
  @Str() refreshToken!: string;
}
