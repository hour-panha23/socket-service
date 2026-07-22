import { Str } from '@/decorator/field.decorator';

export class EmitToProjectDto {
  @Str() projectId!: string;
  @Str() event!: string;
  @Str() payload!: Record<string, unknown>;
  @Str(true) senderSocketId?: string;
}

export class EmitToAppDto {
  @Str() projectId!: string;
  @Str() appId!: string;
  @Str() event!: string;
  @Str() payload!: Record<string, unknown>;
  @Str(true) senderSocketId?: string;
}

export class EmitToRoomDto {
  @Str() projectId!: string;
  @Str() appId!: string;
  @Str() roomId!: string;
  @Str() event!: string;
  @Str() payload!: Record<string, unknown>;
  @Str(true) senderSocketId?: string;
}
