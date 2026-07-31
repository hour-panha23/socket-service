import { Str } from '@/common/decorator/field.decorator';

export class CreateProjectDto {
  @Str() name!: string;
  @Str(true) description?: string;
  @Str({ message: 'Webhook URL is required' })
  webhook_url?: string;
}

export class UpdateProjectDto {
  @Str(true) name?: string;
  @Str(true) description?: string;
  @Str(true) webhook_url?: string;
}
