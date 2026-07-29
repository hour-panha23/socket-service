import { Obj, Str } from '@/common/decorator/field.decorator';

export class EmitToProjectDto {
  @Str() projectId!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) senderSocketId?: string;
}

export class EmitToAppDto {
  @Str() projectId!: string;
  @Str() appId!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) senderSocketId?: string;
}

export class EmitToRoomDto {
  @Str() projectId!: string;
  @Str() appId!: string;
  @Str() roomId!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) senderSocketId?: string;
}

export class EmitToUserDto {
  @Str() projectId!: string;
  @Str() userId!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) senderSocketId?: string;
}
export class EmitBroadcastDto {
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) senderSocketId?: string;
}
