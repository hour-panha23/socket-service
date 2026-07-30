export class BaseListReqPayload<T> {
  limit?: number = 10;
  search?: string;
  filters?: Partial<T>;
}

export class CursorPaginationPayload<T> extends BaseListReqPayload<T> {
  cursor?: string;
  cursorColumn?: string;
}

export class OffsetPaginationPayload<T> extends BaseListReqPayload<T> {
  page?: number = 1;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_page: number;
  next_cursor?: string;
  has_next_page: boolean;
  stats?: Record<string, unknown>;
}
