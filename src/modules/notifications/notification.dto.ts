import { Obj, Str } from '@/common/decorator/field.decorator';

export class EmitToProjectDto {
  @Str() project_id!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) sender_socket_id?: string;
}

export class EmitToAppDto {
  @Str() project_id!: string;
  @Str() app_id!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) sender_socket_id?: string;
}

export class EmitToRoomDto {
  @Str() project_id!: string;
  @Str() app_id!: string;
  @Str() room!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) sender_socket_id?: string;
}

export class EmitToUserDto {
  @Str() project_id!: string;
  @Str() app_id!: string;
  @Str() user_id!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) sender_socket_id?: string;
}
export class EmitBroadcastDto {
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) sender_socket_id?: string;
}

export class EmitMessageDto {
  @Str(true) user_id?: string;
  @Str(true) project_id!: string;
  @Str(true) app_id!: string;
  @Str(true) room!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) sender_socket_id?: string;
}

export class EmitBoardCastMessageDtp {
  @Str() project_id!: string;
  @Str(true) app_id!: string;
  @Str(true) room!: string;
  @Str() event!: string;
  @Obj() payload!: Record<string, unknown>;
  @Str(true) sender_socket_id?: string;
}
