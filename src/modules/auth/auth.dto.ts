import { Str } from '@/common/decorator/field.decorator';

export class LoginDto {
  @Str() username!: string;
  @Str() password!: string;
}

export class RefreshTokenDto {
  @Str() userId!: string;
  @Str() refreshToken!: string;
}
