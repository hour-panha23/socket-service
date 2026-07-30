import { Str } from '@/common/decorator/field.decorator';

export class CreateProjectDto {
  @Str() name!: string;
  @Str(true) description?: string;
  @Str() webhook_url?: string;
}

export class UpdateProjectDto {
  @Str() name?: string;
  @Str() description?: string;
  @Str(true) webhook_url?: string;
}
