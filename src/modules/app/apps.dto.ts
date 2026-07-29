import { Str } from '@/common/decorator/field.decorator';

export class CreateAppDto {
  @Str() name!: string;
  @Str(true) description?: string;
  @Str() webhook_url?: string;
}

export class UpdateAppDto {
  @Str() name?: string;
  @Str() description?: string;
  @Str(true) webhook_url?: string;
}
