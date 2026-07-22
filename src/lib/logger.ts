/**
 * Production-aware logger utility
 *
 * In development: logs to console
 * In production: suppresses verbose logs, only errors go to console
 */

const isProd = process.env.NODE_ENV === "production";

export const logger = {
  /**
   * Debug/info logs - only in development
   */
  log: (...args: unknown[]) => {
    if (!isProd) console.log(...args);
  },

  /**
   * Warnings - only in development
   */
  warn: (...args: unknown[]) => {
    if (!isProd) console.warn(...args);
  },

  /**
   * Info logs - only in development
   */
  info: (...args: unknown[]) => {
    if (!isProd) console.info(...args);
  },

  /**
   * Errors - always logged (critical for debugging production issues)
   * Consider sending to error tracking service in production
   */
  error: (...args: unknown[]) => {
    console.error(...args);
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.) in production
  },

  /**
   * Debug logs - only in development with verbose flag
   */
  debug: (...args: unknown[]) => {
    if (!isProd && process.env.DEBUG) console.debug(...args);
  },
};
