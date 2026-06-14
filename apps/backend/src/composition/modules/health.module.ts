// apps/backend/src/composition/modules/health.module.ts
// Composition for the health check endpoint.

import { Module } from '@nestjs/common';
import { HealthCheckController } from '../../interfaces/http/health-check.controller';

@Module({
  controllers: [HealthCheckController],
})
export class HealthModule {}
