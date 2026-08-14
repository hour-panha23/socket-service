import { Int, Str } from '@/common/decorator/field.decorator';

export class CreateDeviceDto {
  @Str() device_name!: string;
  @Int() device_id!: number;
  @Str() device_serial!: string;
  @Str() project_id!: string;
  @Str() app_id!: string;
  @Str() room!: string;
  @Str() event!: string;
  @Str() webhook!: string;
}

export class UpdateDeviceDto {
  @Int() id!: number;
  @Str(true) device_name?: string;
  @Int(true) device_id?: number;
  @Str(true) device_serial?: string;
  @Str(true) project_id?: string;
  @Str(true) app_id?: string;
  @Str(true) room?: string;
  @Str(true) event?: string;
  @Str(true) webhook?: string;
}
