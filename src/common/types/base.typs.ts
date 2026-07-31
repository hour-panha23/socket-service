import { Int, Obj, Str } from '../decorator/field.decorator';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
export class BaseListReqDto<T> {
  @Int({ min: 1, optional: true }) limit: number = 10;
  @Str(true) search?: string;
  @Obj(true) filters?: Partial<T>;
}

export class CursorPaginationDto<T> extends BaseListReqDto<T> {
  @Str(true) cursor?: string;
  @Str(true) cursor_column?: string;
}

export class OffsetPaginationDto<T> extends BaseListReqDto<T> {
  @Int({ min: 1, optional: true }) page?: number = 1;
}

export class GetOptionDto {
  @Int({ min: 1, optional: true }) limit: number = 10;
  @Str(true) cursor?: string;
  @Str(true) cursor_column?: string;
  @Str(true) search?: string;
}

export class GetOptionQuery extends GetOptionDto {
  @Str(true) user_id!: string;
}
