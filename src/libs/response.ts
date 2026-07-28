import { LoggerService } from '@/common/logger/logger.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { formatDatesInObject } from '../common/utils/durationAndDate.utils';

const STATUS_MAP = {
  [HttpStatus.OK]: 'OK',
  [HttpStatus.CREATED]: 'Created',
  [HttpStatus.ACCEPTED]: 'Accepted',
  [HttpStatus.NO_CONTENT]: 'No Content',
  [HttpStatus.MOVED_PERMANENTLY]: 'Moved Permanently',
  [HttpStatus.FOUND]: 'Found',
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.NOT_IMPLEMENTED]: 'Not Implemented',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [HttpStatus.GATEWAY_TIMEOUT]: 'Gateway Timeout',
} as const;

const STATUS_LABELS: Record<number, string> = { ...STATUS_MAP };

export interface SuccessResponse<T = unknown> {
  status_code: number;
  status: string;
  data: T | null;
}

export interface ErrorResponse {
  status_code: number;
  status: string;
  message: string;
}

export interface MessageResponse<T = unknown> {
  status_code: number;
  status: string;
  message: string;
  data?: T;
}

export type CustomResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export interface ResponseOptions {
  headers?: Record<string, string>;
  contentType?: string;
  cacheControl?: string;
  cors?: boolean;
  useTopLevelMessage?: boolean;
  skipDateFormatting?: boolean;
  skipFriendlyMapping?: boolean;
}

const GENERIC_ERROR_MESSAGE =
  'An error occurred while processing your request. Please try again later.';

function getUserFriendlyMessage(errorMessage: string): string {
  const originalMessage = errorMessage || '';

  const sqlKeywords = [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'FOREIGN KEY',
    'UNIQUE CONSTRAINT',
    'DUPLICATE KEY',
    'SYNTAX ERROR',
    'RELATION "',
    'COLUMN "',
    'TABLE "',
  ];

  const containsSql = sqlKeywords.some((kw) =>
    originalMessage.toUpperCase().includes(kw),
  );

  if (containsSql) {
    console.error('[DB PROTECTOR] Blocked SQL Leak:', originalMessage);
    return 'A database error occurred. Please contact an administrator.';
  }

  if (!originalMessage || originalMessage.toLowerCase() === 'error') {
    return 'An unexpected error occurred. Please try again later.';
  }

  const safePrefixes = [
    'Cannot',
    'You can only',
    'Class',
    'Student',
    'Reason',
    'Permission',
    'Employee',
    'Report',
    'Document',
    'Module',
    'Part',
  ];

  const isSafe = safePrefixes.some((prefix) =>
    originalMessage.startsWith(prefix),
  );

  if (isSafe) {
    return originalMessage;
  }

  const lowerMsg = originalMessage.toLowerCase();

  if (lowerMsg.includes('unauthorized') || lowerMsg.includes('login failed')) {
    return 'Invalid credentials or session expired.';
  }

  if (lowerMsg.includes('not found')) {
    return 'The requested resource could not be found.';
  }

  if (lowerMsg.includes('already exists')) {
    return 'This record already exists in our system.';
  }

  if (lowerMsg.includes('too many requests')) {
    return 'Too Many Requests';
  }

  const trimmedMessage = originalMessage.trim();

  if (trimmedMessage.includes('{') || trimmedMessage.includes('`')) {
    return 'Request failed due to invalid data format.';
  }

  return trimmedMessage;
}

function extractErrorMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    if (
      obj.name === 'QueryFailedError' ||
      (typeof obj.code === 'string' && obj.code.startsWith('23'))
    ) {
      return 'A database error occurred. Please contact an administrator.';
    }

    if (typeof obj.message === 'string') return obj.message;
    if (Array.isArray(obj.message)) {
      return obj.message.map((s) => String(s)).join('; ');
    }
  }
  return '';
}

function inferStatusCode(data: unknown, fallback: number): number {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const obj = data as Record<string, unknown>;

  if (
    typeof obj.status_code === 'number' &&
    isValidStatusCode(obj.status_code)
  ) {
    return obj.status_code;
  }

  if (typeof obj.statusCode === 'number' && isValidStatusCode(obj.statusCode)) {
    return obj.statusCode;
  }

  if (typeof obj.status === 'number' && isValidStatusCode(obj.status)) {
    return obj.status;
  }

  return fallback;
}

function getStatusLabel(code: number): string {
  return STATUS_LABELS[code] ?? (code >= 400 ? 'Error' : 'OK');
}

function isValidStatusCode(code: number): boolean {
  return code >= 100 && code < 600 && Number.isInteger(code);
}

function customResponse<T = unknown>(
  res: Response,
  status_code: number,
  data: T,
  options?: ResponseOptions,
): CustomResponse<T> {
  let finalStatusCode = inferStatusCode(data, status_code);

  if (!isValidStatusCode(finalStatusCode)) {
    console.warn(
      `Invalid status code: ${finalStatusCode}. Using 500 as fallback.`,
    );
    finalStatusCode = 500;
  }

  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) =>
      res.setHeader(key, value),
    );
  }
  if (options?.contentType) res.setHeader('Content-Type', options.contentType);
  if (options?.cacheControl)
    res.setHeader('Cache-Control', options.cacheControl);

  if (options?.cors) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization',
    );
  }

  // HANDLE ERROR RESPONSES (400-599)
  if (finalStatusCode >= 400) {
    let message =
      extractErrorMessage(data) ||
      'An error occurred while processing your request. Please try again later.';

    if (!options?.skipFriendlyMapping) {
      const friendly = getUserFriendlyMessage(message);
      if (finalStatusCode === 500 || friendly !== GENERIC_ERROR_MESSAGE) {
        message = friendly;
      }
    } else if (data && typeof data === 'object' && 'message' in (data as any)) {
      message = (data as any).message;
    }

    const errorResponse: ErrorResponse = {
      status_code: finalStatusCode,
      status: getStatusLabel(finalStatusCode),
      message,
    };

    res.status(finalStatusCode).json(errorResponse);
    return errorResponse;
  }

  // HANDLE SUCCESS RESPONSES (100-399)
  else {
    const formattedData: T | null = options?.skipDateFormatting
      ? (data ?? null)
      : (formatDatesInObject(data ?? null, {
          timezoneOffset: 7,
          fieldsWithTime: ['from_date', 'to_date'],
          useDefaultRules: true,
        }) as T | null);

    const successResponse: SuccessResponse<T> = {
      status_code: finalStatusCode,
      status: getStatusLabel(finalStatusCode),
      data: formattedData,
    };

    res.status(finalStatusCode).json(successResponse);
    return successResponse;
  }
}

function successResponse<T = unknown>(
  res: Response,
  data: T,
  status_code: number = 200,
  options?: ResponseOptions,
): SuccessResponse<T> {
  return customResponse(res, status_code, data, options) as SuccessResponse<T>;
}

function errorResponse(
  res: Response,
  message: string,
  status_code: number = 500,
  options?: ResponseOptions,
): ErrorResponse {
  return customResponse(res, status_code, message, options) as ErrorResponse;
}

function internalServerError(
  res: Response,
  error: string | Error,
  options?: ResponseOptions,
): ErrorResponse {
  const message = typeof error === 'string' ? error : error.message;
  const userFriendlyMessage = getUserFriendlyMessage(message);
  return customResponse(
    res,
    500,
    userFriendlyMessage,
    options,
  ) as ErrorResponse;
}

function exceptionResponse(
  res: Response,
  error: unknown,
  fallbackStatus: number = HttpStatus.INTERNAL_SERVER_ERROR,
  fallbackMessage: string = 'An unexpected error occurred. Please try again later.',
): ErrorResponse {
  if (error instanceof HttpException) {
    const statusCode = error.getStatus();
    const response = error.getResponse();

    const message =
      typeof response === 'string'
        ? response
        : Array.isArray((response as { message?: unknown }).message)
          ? ((response as { message?: unknown[] }).message || [])
              .map((m) => String(m))
              .join('; ')
          : typeof (response as { message?: unknown }).message === 'string'
            ? (response as { message?: string }).message
            : error.message;

    if (Number(statusCode) >= 500) {
      LoggerService.logError(error, 'exceptionResponse(HttpException)', {
        status_code: statusCode,
        message,
      });
    }

    return customResponse(
      res,
      statusCode,
      {
        status_code: statusCode,
        message: message || '',
      },
      { skipFriendlyMapping: true },
    ) as ErrorResponse;
  }

  // PostgreSQL Unique Constraint Core Logic Fix
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as any).code === '23505'
  ) {
    const pgError = error as any;
    let entityName = 'record';
    let fieldName = '';

    if (pgError.table) {
      entityName = String(pgError.table).replace(/_/g, ' ').trim();
      if (entityName.endsWith('s') && entityName.length > 1) {
        entityName = entityName.slice(0, -1);
      }
    }

    if (pgError.detail) {
      const detailMatch = String(pgError.detail).match(/Key \(([^)]+)\)=/);
      if (detailMatch && detailMatch[1]) {
        fieldName = detailMatch[1].replace(/_/g, ' ').trim();
      }
    } else if (pgError.constraint) {
      const constraintMatch = String(pgError.constraint).match(
        /^[a-zA-Z0-9_]+_([a-zA-Z0-9_]+)_(?:unique|key)$/i,
      );
      if (constraintMatch && constraintMatch[1]) {
        fieldName = constraintMatch[1].replace(/_/g, ' ').trim();
      }
    }

    LoggerService.logError(error, 'exceptionResponse(UniqueViolation)', {
      status_code: HttpStatus.CONFLICT,
      constraint: pgError.constraint,
      table: pgError.table,
      extracted_field: fieldName,
    });

    const formattedMessage = fieldName
      ? `This ${entityName} ${fieldName} already exists in the system.`
      : `This ${entityName} already exists in the system.`;

    return customResponse(
      res,
      HttpStatus.CONFLICT,
      {
        status_code: HttpStatus.CONFLICT,
        message: formattedMessage,
      },
      { skipFriendlyMapping: true },
    ) as ErrorResponse;
  }

  LoggerService.logError(error, 'exceptionResponse(Unknown)', {
    status_code: fallbackStatus,
    fallbackMessage,
  });

  return customResponse(res, fallbackStatus, {
    status_code: fallbackStatus,
    message: fallbackMessage,
  }) as ErrorResponse;
}

export {
  customResponse,
  errorResponse,
  exceptionResponse,
  getUserFriendlyMessage,
  internalServerError,
  STATUS_MAP,
  successResponse,
};
