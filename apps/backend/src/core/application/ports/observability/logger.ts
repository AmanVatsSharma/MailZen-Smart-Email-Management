// apps/backend/src/core/application/ports/observability/logger.ts
// Port: structured logger. Adapter binds to Pino/Nest Logger.

export const LOGGER = Symbol('ILogger');

export interface ILogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}
