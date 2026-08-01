import { LoggerService } from '@/common/logger/logger.service';
import { exceptionResponse } from '@/libs/response';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  private sanitizeHeaders(
    headers: Record<string, any> = {},
  ): Record<string, any> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getErrorOrigin(exception: unknown): { file: string; line?: string } {
    if (!(exception instanceof Error) || !exception.stack) {
      return { file: 'unknown' };
    }

    // Split stack trace lines
    const stackLines = exception.stack.split('\n');

    // Find the first line in the stack trace that originates from your app codebase
    // Filters out node_modules and internal NestJS lines
    const originLine = stackLines.find(
      (line) =>
        line.includes('/src/') &&
        !line.includes('all-exceptions.filter') &&
        !line.includes('node_modules'),
    );

    if (!originLine) {
      return { file: stackLines[1]?.trim() || 'unknown' };
    }

    // Extract filepath (e.g. /path/to/file.ts:line:col)
    const match = originLine.match(/\((.*?)\)/) || originLine.match(/at (.*)/);
    const filePath = match ? match[1].trim() : originLine.trim();

    return { file: filePath };
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Determine status code for logging purposes
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // console.error('RAW EXCEPTION >>>', exception);

    this.logger.logError(exception, 'HttpExceptionFilter', {
      status_code: statusCode,
      method: request?.method,
      url: request?.originalUrl ?? request?.url,
      ip: request?.ip,
      origin: this.getErrorOrigin(exception),
      headers: this.sanitizeHeaders(request?.headers ?? {}),
      params: request?.params ?? {},
      query: request?.query ?? {},
      body: request?.body ?? {},
    });

    if (response && !response.headersSent) {
      // CRITICAL FIX: Delegate to exceptionResponse so it handles the 23505 -> 409 mapping
      exceptionResponse(response, exception);
    }
  }
}
