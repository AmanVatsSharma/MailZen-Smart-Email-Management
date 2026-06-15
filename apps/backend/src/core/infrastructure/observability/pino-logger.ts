// apps/backend/src/core/infrastructure/observability/pino-logger.ts
// Adapter: implements ILogger with Nest's built-in Logger (replace with Pino if you migrate).

import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { ILogger } from '../application/ports/observability/logger';

@Injectable()
export class PinoLogger implements ILogger {
  private readonly logger = new NestLogger(PinoLogger.name);
  info(msg: string, meta?: Record<string, unknown>) { this.logger.log(JSON.stringify({ msg, ...meta })); }
  warn(msg: string, meta?: Record<string, unknown>) { this.logger.warn(JSON.stringify({ msg, ...meta })); }
  error(msg: string, meta?: Record<string, unknown>) { this.logger.error(JSON.stringify({ msg, ...meta })); }
  debug(msg: string, meta?: Record<string, unknown>) { this.logger.debug(JSON.stringify({ msg, ...meta })); }
}
