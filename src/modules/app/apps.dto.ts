import { Str } from '@/common/decorator/field.decorator';

export class CreateAppDto {
  @Str() name!: string;
  @Str(true) description?: string;
}

export class UpdateAppDto {
  @Str() name?: string;
  @Str() description?: string;
}
