// apps/backend/src/core/application/ports/queue/job-queue.ts
// Port: job queue. Adapter binds to Bull; tests bind to in-memory.

import { Job } from 'bull';

export const JOB_QUEUE = Symbol('IJobQueue');

export interface IJobQueue {
  enqueue<T>(name: string, payload: T, options?: { delay?: number; attempts?: number }): Promise<string>;
  process<T>(name: string, handler: (payload: T, job: Job) => Promise<void>): void;
}
