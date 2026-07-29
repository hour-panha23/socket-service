// transform.interceptor.ts
import { formatDatesInObject } from '@/common/utils/durationAndDate.utils'; // adjust import path
import { STATUS_MAP, SuccessResponse } from '@/libs/response';

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode || 200;
        const statusLabel = STATUS_MAP[statusCode] || 'OK';

        // Extract raw data if service wrapped it
        const rawData = data?.message ? (data.result ?? data.data) : data;

        // Apply standardized date formatting from Source 2
        const formattedData = formatDatesInObject(rawData ?? null, {
          timezoneOffset: 7,
          fieldsWithTime: ['from_date', 'to_date'],
          useDefaultRules: true,
        }) as T | null;

        return {
          status_code: statusCode,
          status: statusLabel,
          data: formattedData,
        };
      }),
    );
  }
}
