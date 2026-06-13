// apps/backend/src/composition/modules/observability.module.ts
import { Module } from '@nestjs/common';
import { PromMetrics } from '../../core/infrastructure/observability/prom-metrics';
import { PinoLogger } from '../../core/infrastructure/observability/pino-logger';
import { METRICS } from '../../core/application/ports/observability/metrics';
import { LOGGER } from '../../core/application/ports/observability/logger';

@Module({
  providers: [
    { provide: METRICS, useClass: PromMetrics },
    { provide: LOGGER, useClass: PinoLogger },
  ],
  exports: [METRICS, LOGGER],
})
export class ObservabilityModule {}
