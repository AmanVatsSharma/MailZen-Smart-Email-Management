// apps/backend/src/core/infrastructure/observability/prom-metrics.ts
// Adapter: implements IMetrics with a lightweight counter map (swap for prom-client in prod).

import { Injectable } from '@nestjs/common';
import { IMetrics } from '../application/ports/observability/metrics';

@Injectable()
export class PromMetrics implements IMetrics {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  increment(name: string, value = 1, tags?: Record<string, string>) {
    const key = this.key(name, tags);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }
  gauge(name: string, value: number, tags?: Record<string, string>) {
    this.gauges.set(this.key(name, tags), value);
  }
  histogram(name: string, value: number, tags?: Record<string, string>) {
    const key = this.key(name, tags);
    const arr = this.histograms.get(key) ?? [];
    arr.push(value);
    this.histograms.set(key, arr);
  }

  private key(name: string, tags?: Record<string, string>) {
    if (!tags) return name;
    return `${name}{${Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(',')}}`;
  }
}
