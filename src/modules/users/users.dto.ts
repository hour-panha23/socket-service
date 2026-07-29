import { Email, Str } from '@/common/decorator/field.decorator';

export class CreateUserDto {
  @Email() email!: string;
  @Str() password!: string;
  @Str() first_name!: string;
  @Str() last_name!: string;
  @Str(true, ['admin', 'user']) role?: 'admin' | 'user' = 'user';
}

export class UpdateUserDto {
  @Email(true) email?: string;
  @Str(true, ['admin', 'user']) role?: 'admin' | 'user';
  @Str(true) password?: string;
  @Str(true) first_name?: string;
  @Str(true) last_name?: string;
}
