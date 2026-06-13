// apps/backend/src/core/application/ports/observability/metrics.ts
// Port: metrics. Adapter binds to prom-client / OTel / etc.

export const METRICS = Symbol('IMetrics');

export interface IMetrics {
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
}
