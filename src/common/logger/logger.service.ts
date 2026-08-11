import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LoggerService {
  private logDir: string;
  private minLevel: number;
  private useJson: boolean;
  private maxSizeBytes?: number;
  private retentionDays?: number;
  private isDevelopment: boolean;

  private writeQueue: Array<{ filename: string; content: string }> = [];
  private processing = false;

  private static _instance: LoggerService;

  constructor() {
    if (!LoggerService._instance) {
      LoggerService._instance = this;
    }

    const env = process.env;
    this.isDevelopment = env.NODE_ENV !== 'production';

    this.logDir =
      env.LOG_DIR && env.LOG_DIR.trim().length > 0
        ? env.LOG_DIR
        : path.join(process.cwd(), 'logs');

    const level = (env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info')).toLowerCase();
    this.minLevel = this.levelToNum(level);
    this.useJson = (env.LOG_FORMAT || '').toLowerCase() === 'json';
    const maxMb = Number(env.LOG_MAX_SIZE_MB);
    this.maxSizeBytes =
      Number.isFinite(maxMb) && maxMb > 0
        ? Math.floor(maxMb * 1024 * 1024)
        : undefined;
    const retention = Number(env.LOG_RETENTION_DAYS);
    this.retentionDays =
      Number.isFinite(retention) && retention > 0
        ? Math.floor(retention)
        : undefined;
    this.ensureLogDirectoryExists();
    if (this.retentionDays) {
      this.cleanupOldFiles().catch(() => void 0);
    }
  }

  private ensureLogDirectoryExists() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Ensure socket log file is always present for easy discovery.
    const socketLogPath = path.join(this.logDir, 'socket.log');
    if (!fs.existsSync(socketLogPath)) {
      fs.closeSync(fs.openSync(socketLogPath, 'a'));
    }
  }

  private formatLog(level: string, message: string, meta?: unknown): string {
    const offset = 7;
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const local = new Date(utc + offset * 3600000);
    const timestamp = local.toISOString().replace('Z', '+07:00');
    if (this.useJson) {
      const payload: Record<string, unknown> = {
        timestamp,
        level: level.toUpperCase(),
        message,
      };
      if (meta instanceof Error) {
        payload.error = {
          name: meta.name,
          message: meta.message,
          stack: meta.stack,
        };
      } else if (meta !== undefined) {
        payload.meta = this.maskSensitive(meta);
      }
      return this.safeStringify(payload) + '\n';
    }

    // Extract caller from meta if it exists
    let callerInfo: string | null = null;
    let cleanedMeta = meta;

    if (meta && typeof meta === 'object' && 'caller' in meta) {
      const metaObj = meta as Record<string, unknown>;
      callerInfo = metaObj.caller as string;
      // Create a new object without the caller for display
      const rest = { ...metaObj };
      delete rest.caller;
      cleanedMeta = Object.keys(rest).length > 0 ? rest : undefined;
    }

    let logEntry = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (cleanedMeta) {
      if (cleanedMeta instanceof Error) {
        logEntry += `\nError: ${cleanedMeta.message}`;
        if (cleanedMeta.stack) {
          logEntry += `\nStack: ${cleanedMeta.stack}`;
        }
      } else if (typeof cleanedMeta === 'object') {
        const displayMeta = callerInfo
          ? {
            ...this.maskSensitive(cleanedMeta),
            caller: { file: callerInfo },
          }
          : this.maskSensitive(cleanedMeta);
        logEntry += `\nMeta: ${this.safeStringify(displayMeta, 2)}`;
      } else {
        logEntry += `\nMeta: ${this.safeStringify(cleanedMeta)}`;
      }
    } else if (callerInfo) {
      logEntry += `\nMeta: ${this.safeStringify({ caller: { file: callerInfo } }, 2)}`;
    }
    return logEntry + '\n';
  }

  private enqueueWrite(filename: string, content: string) {
    this.writeQueue.push({ filename, content });
    if (!this.processing) {
      void this.processQueue();
    }
  }

  private async processQueue() {
    this.processing = true;
    try {
      while (this.writeQueue.length > 0) {
        const { filename, content } = this.writeQueue.shift()!;
        const filePath = path.join(this.logDir, filename);
        try {
          if (this.maxSizeBytes) {
            await this.ensureRotation(filePath, Buffer.byteLength(content));
          }
          await fs.promises.appendFile(filePath, content, { encoding: 'utf8' });
        } catch (err) {
          console.error('[LoggerService] Failed to write log file', {
            filePath,
            err,
          });
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private getTargetFilenames(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    meta?: unknown,
  ): string[] {
    const levelFiles: Record<'error' | 'warn' | 'info' | 'debug', string[]> = {
      error: [`error.log`],
      warn: [`info.log`],
      info: [`info.log`],
      debug: [`info.log`],
    };

    const targets = [...levelFiles[level]];
    if (this.isSocketLog(message, meta)) {
      targets.push('socket.log');
    }

    return [...new Set(targets)];
  }

  private isSocketLog(message: string, meta?: unknown): boolean {
    const keyword =
      /socket|websocket|socket\.io|\bws\b|taskmgmt|notifications|chat|emitToRoom|namespace/i;

    if (keyword.test(message)) {
      return true;
    }

    if (meta === undefined || meta === null) {
      return false;
    }

    const visited = new WeakSet<object>();
    const walk = (value: unknown): boolean => {
      if (typeof value === 'string') {
        return keyword.test(value);
      }

      if (!value || typeof value !== 'object') {
        return false;
      }

      if (visited.has(value)) {
        return false;
      }
      visited.add(value);

      if (Array.isArray(value)) {
        return value.some(walk);
      }

      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (keyword.test(k) || walk(v)) {
          return true;
        }
      }

      return false;
    };

    return walk(meta);
  }

  private async ensureRotation(filePath: string, incomingBytes: number) {
    try {
      const stat = await fs.promises.stat(filePath).catch(() => undefined);
      if (!stat || this.maxSizeBytes === undefined) return;
      if (stat.size + incomingBytes <= this.maxSizeBytes) return;
      const { dir, name, ext } = path.parse(filePath);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const rotated = path.join(dir, `${name}.${ts}${ext || '.log'}`);
      await fs.promises.rename(filePath, rotated).catch(() => void 0);
    } catch {
      // ignore
    }
  }

  private async cleanupOldFiles() {
    if (!this.retentionDays) return;
    try {
      const files = await fs.promises.readdir(this.logDir);
      const now = Date.now();
      const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
      await Promise.all(
        files.map(async (f) => {
          const full = path.join(this.logDir, f);
          try {
            const st = await fs.promises.stat(full);
            if (st.isFile() && now - st.mtimeMs > maxAge) {
              await fs.promises.unlink(full).catch(() => void 0);
            }
          } catch {
            // ignore
          }
        }),
      );
    } catch {
      // ignore
    }
  }

  private levelToNum(level: string): number {
    switch (level) {
      case 'error':
        return 0;
      case 'warn':
        return 1;
      case 'info':
        return 2;
      case 'debug':
        return 3;
      default:
        return 2;
    }
  }

  private shouldLog(level: 'error' | 'warn' | 'info' | 'debug'): boolean {
    if (level === 'debug' && !this.isDevelopment) {
      return false;
    }
    return this.levelToNum(level) <= this.minLevel;
  }

  private toErrorMeta(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      const pg = error as Error & {
        code?: string;
        severity?: string;
        detail?: string;
        hint?: string;
        where?: string;
        schema?: string;
        table?: string;
        column?: string;
        constraint?: string;
        position?: string;
        internalPosition?: string;
        internalQuery?: string;
        file?: string;
        line?: string;
        routine?: string;
        query?: string;
        parameters?: unknown;
      };

      let errorField = pg.message;
      if (pg.query) {
        errorField = `${pg.query} - ${pg.message}`;
      }

      return {
        error: errorField,
        length: String(errorField).length,
        name: pg.name,
        severity: pg.severity,
        code: pg.code,
        detail: pg.detail,
        hint: pg.hint,
        where: pg.where,
        schema: pg.schema,
        table: pg.table,
        column: pg.column,
        constraint: pg.constraint,
        position: pg.position,
        internalPosition: pg.internalPosition,
        internalQuery: pg.internalQuery,
        file: pg.file,
        line: pg.line,
        routine: pg.routine,
        parameters: pg.parameters,
      };
    }

    if (error && typeof error === 'object') {
      const obj = error as Record<string, unknown>;
      let errorField =
        typeof obj.message === 'string'
          ? obj.message
          : typeof obj.error === 'string'
            ? obj.error
            : 'Unknown error';

      if (obj.query && typeof obj.query === 'string') {
        errorField = `${obj.query} - ${errorField}`;
      }

      return {
        error: errorField,
        length: String(errorField).length,
        name: typeof obj.name === 'string' ? obj.name : 'Error',
        code: typeof obj.code === 'string' ? obj.code : undefined,
        severity: typeof obj.severity === 'string' ? obj.severity : undefined,
        detail: typeof obj.detail === 'string' ? obj.detail : undefined,
        hint: typeof obj.hint === 'string' ? obj.hint : undefined,
        where: typeof obj.where === 'string' ? obj.where : undefined,
        schema: typeof obj.schema === 'string' ? obj.schema : undefined,
        table: typeof obj.table === 'string' ? obj.table : undefined,
        column: typeof obj.column === 'string' ? obj.column : undefined,
        constraint:
          typeof obj.constraint === 'string' ? obj.constraint : undefined,
        position: typeof obj.position === 'string' ? obj.position : undefined,
        file: typeof obj.file === 'string' ? obj.file : undefined,
        line: typeof obj.line === 'string' ? obj.line : undefined,
        routine: typeof obj.routine === 'string' ? obj.routine : undefined,
        parameters: obj.parameters,
      };
    }

    return {
      error: String(error),
    };
  }

  private safeStringify(obj: unknown, space?: number): string {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      obj,
      (key: string, value: unknown) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (value instanceof Error) {
          return this.toErrorMeta(value);
        }
        if (key === 'error' && value && typeof value === 'object') {
          return this.toErrorMeta(value);
        }
        return value;
      },
      space,
    );
  }

  private maskSensitive<T = unknown>(input: T): T {
    const keysToMask = new Set([
      'password',
      'pass',
      'pwd',
      'token',
      'access_token',
      'refresh_token',
      'accessToken',
      'refreshToken',
      'authorization',
      'apiKey',
      'secret',
      'clientSecret',
    ]);
    const maskValue = (v: unknown) =>
      typeof v === 'string' && v.length > 0 ? '***' + v.slice(-4) : '***';
    const seen = new WeakSet<object>();
    const recur = (val: unknown): unknown => {
      if (Array.isArray(val)) return val.map(recur);
      if (val && typeof val === 'object') {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          if (keysToMask.has(k)) out[k] = maskValue(v);
          else out[k] = recur(v);
        }
        return out;
      }
      return val;
    };
    return recur(input) as T;
  }

  private getCallerInfo(): string | null {
    const stack = new Error().stack;
    if (!stack) return null;

    const lines = stack.split('\n');
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/);
      if (match) {
        const filePath = match[1];
        const lineNum = match[2];
        if (!filePath.includes('logger.service')) {
          return `${filePath}:${lineNum}`;
        }
      }
    }
    return null;
  }

  private buildEnrichedMeta(meta?: unknown): Record<string, unknown> {
    let normalizedMeta: Record<string, unknown> = {};

    if (meta instanceof Error) {
      normalizedMeta = this.toErrorMeta(meta);
    } else if (meta && typeof meta === 'object') {
      normalizedMeta = meta as Record<string, unknown>;
    } else if (meta !== undefined) {
      normalizedMeta = { meta };
    }

    const caller = this.getCallerInfo();
    return {
      ...normalizedMeta,
      ...(caller && { caller }),
    };
  }

  error(message: string, meta?: any) {
    const isSocket = this.isSocketLog(message, meta);
    if (!this.shouldLog('error') && !isSocket) return;
    const enrichedMeta = this.buildEnrichedMeta(meta);
    const logEntry = this.formatLog('error', message, enrichedMeta);
    for (const f of this.getTargetFilenames('error', message, enrichedMeta)) {
      this.enqueueWrite(f, logEntry);
    }
    console.error(`[ERROR] ${message}`, enrichedMeta || '');
  }

  warn(message: string, meta?: any) {
    const isSocket = this.isSocketLog(message, meta);
    if (!this.shouldLog('warn') && !isSocket) return;
    const enrichedMeta = this.buildEnrichedMeta(meta);
    const logEntry = this.formatLog('warn', message, enrichedMeta);
    for (const f of this.getTargetFilenames('warn', message, enrichedMeta)) {
      this.enqueueWrite(f, logEntry);
    }
    console.warn(`[WARN] ${message}`, enrichedMeta || '');
  }

  info(message: string, meta?: any) {
    const isSocket = this.isSocketLog(message, meta);
    if (!this.shouldLog('info') && !isSocket) return;
    const enrichedMeta = this.buildEnrichedMeta(meta);
    const logEntry = this.formatLog('info', message, enrichedMeta);
    for (const f of this.getTargetFilenames('info', message, enrichedMeta)) {
      this.enqueueWrite(f, logEntry);
    }
    console.info(`[INFO] ${message}`, enrichedMeta || '');
  }

  debug(message: string, meta?: any) {
    if (!this.isDevelopment) return; // Dev-only guard
    if (!this.shouldLog('debug')) return;

    const enrichedMeta = this.buildEnrichedMeta(meta);
    const logEntry = this.formatLog('debug', message, enrichedMeta);
    for (const f of this.getTargetFilenames('debug', message, enrichedMeta)) {
      this.enqueueWrite(f, logEntry);
    }
    console.debug(`[DEBUG] ${message}`, enrichedMeta || '');
  }

  socket(message: string, meta?: any) {
    if (!this.isDevelopment) return; // Dev-only guard

    const enrichedMeta = this.buildEnrichedMeta(meta);
    const logEntry = this.formatLog('info', message, enrichedMeta);

    this.enqueueWrite('socket.log', logEntry);
    console.info(`[SOCKET] ${message}`, enrichedMeta || '');
  }

  logError(
    error: unknown,
    context?: string,
    additionalData?: Record<string, unknown>,
  ) {
    const normalized = this.toErrorMeta(error);
    const errorData = {
      ...normalized,
      context: context || 'Unknown',
      timestamp: new Date().toISOString(),
      ...(additionalData || {}),
    };
    const msg =
      typeof normalized.error === 'string' ? normalized.error : 'Unknown error';
    this.error(`Error in ${context || 'Unknown'}: ${msg}`, errorData);
  }

  logRequest(
    method: string,
    url: string,
    userAgent?: string,
    ip?: string,
    requestId?: string,
  ) {
    this.info(`Request: ${method} ${url}`, {
      method,
      url,
      userAgent,
      ip,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  logDatabaseError(error: unknown, operation: string, table?: string) {
    const normalized = this.toErrorMeta(error);
    const errorCode =
      typeof normalized.code === 'string' ? normalized.code : 'UNKNOWN_CODE';

    const isUniqueViolation = errorCode === '23505';
    const logPrefix = isUniqueViolation
      ? 'Database Unique Violation'
      : 'Database Error';

    const errorData = {
      operation,
      table,
      ...normalized,
      probableCause:
        errorCode === '42703'
          ? 'Undefined column in SQL query. Check selected/filtered column names against the database schema.'
          : undefined,
      timestamp: new Date().toISOString(),
    };

    const errorMessage =
      typeof normalized.error === 'string'
        ? normalized.error
        : 'Unknown database error';

    this.error(
      `${logPrefix} in ${operation} on ${table || 'unknown table'}: ${errorMessage}`,
      errorData,
    );
  }

  createLogger(context: string, baseMeta?: Record<string, unknown>) {
    return {
      error: (message: string, meta?: Record<string, unknown>) =>
        this.error(message, { context, ...(baseMeta || {}), ...(meta || {}) }),
      warn: (message: string, meta?: Record<string, unknown>) =>
        this.warn(message, { context, ...(baseMeta || {}), ...(meta || {}) }),
      info: (message: string, meta?: Record<string, unknown>) =>
        this.info(message, { context, ...(baseMeta || {}), ...(meta || {}) }),
      debug: (message: string, meta?: Record<string, unknown>) =>
        this.debug(message, { context, ...(baseMeta || {}), ...(meta || {}) }),
    } as const;
  }

  static init(): LoggerService {
    if (!LoggerService._instance) {
      LoggerService._instance = new LoggerService();
    }
    return LoggerService._instance;
  }

  static error(message: string, meta?: any) {
    return LoggerService._instance?.error(message, meta);
  }
  static warn(message: string, meta?: any) {
    return LoggerService._instance?.warn(message, meta);
  }
  static info(message: string, meta?: any) {
    return LoggerService._instance?.info(message, meta);
  }
  static debug(message: string, meta?: any) {
    return LoggerService._instance?.debug(message, meta);
  }
  static logError(
    error: unknown,
    context?: string,
    additionalData?: Record<string, unknown>,
  ) {
    return LoggerService._instance?.logError(error, context, additionalData);
  }
  static createLogger(context: string, baseMeta?: Record<string, unknown>) {
    return LoggerService._instance?.createLogger(context, baseMeta);
  }
}

export const logger = LoggerService;