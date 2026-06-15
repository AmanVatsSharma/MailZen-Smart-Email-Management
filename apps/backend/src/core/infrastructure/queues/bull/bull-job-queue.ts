// apps/backend/src/core/infrastructure/queues/bull/bull-job-queue.ts
// Adapter: implements IJobQueue with Bull.

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { IJobQueue } from '../../application/ports/queue/job-queue';

@Injectable()
export class BullJobQueue implements IJobQueue {
  private readonly logger = new Logger(BullJobQueue.name);

  constructor(@InjectQueue('default') private readonly queue: Queue) {}

  async enqueue<T>(name: string, payload: T, options?: { delay?: number; attempts?: number }): Promise<string> {
    const job = await this.queue.add(name, payload, {
      delay: options?.delay,
      attempts: options?.attempts ?? 3,
      removeOnComplete: true,
      removeOnFail: false,
    });
    return String(job.id);
  }

  process<T>(name: string, handler: (payload: T, job: Job) => Promise<void>): void {
    this.queue.process(name, async (job) => handler(job.data as T, job));
  }
}
