import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
// CRITICAL FIX: Import exceptionResponse instead of customResponse
import { LoggerService } from '@/common/logger/logger.service';
import { exceptionResponse } from '@/libs/response';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Determine status code for logging purposes
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.logError(exception, 'HttpExceptionFilter', {
      status_code: statusCode,
      method: request?.method,
      url: request?.originalUrl ?? request?.url,
      ip: request?.ip,
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
