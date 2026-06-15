/**
 * File:        apps/backend/src/core/domain/bounded-contexts/messaging/warmup.aggregate.ts
 * Module:      Core · Domain · Messaging
 * Purpose:     EmailWarmup aggregate. Tracks a provider's warm-up campaign:
 *              current daily limit, status (active/paused), and ramp parameters.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { AggregateRoot } from '../../shared/aggregate-root';
import { Result, makeResult } from '../../shared/result';

export type WarmupStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface WarmupConfig {
  dailyIncrement: number;
  maxDailyEmails: number;
  minimumInterval: number;
  targetOpenRate: number;
}

export interface EmailWarmupProps {
  id: string;
  providerId: string;
  status: WarmupStatus;
  currentDailyLimit: number;
  config: WarmupConfig;
  lastRunAt: Date | null;
  startedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULTS: WarmupConfig = {
  dailyIncrement: 5,
  maxDailyEmails: 100,
  minimumInterval: 15,
  targetOpenRate: 80,
};

export class EmailWarmup extends AggregateRoot<EmailWarmupProps> {
  private constructor(props: EmailWarmupProps) {
    super(props);
  }

  static start(input: {
    id: string;
    providerId: string;
    config?: Partial<WarmupConfig>;
  }): Result<EmailWarmup, Error> {
    if (input.config && input.config.dailyIncrement <= 0) {
      return makeResult(Result.err(new Error('dailyIncrement must be > 0')));
    }
    if (input.config && input.config.maxDailyEmails <= 0) {
      return makeResult(Result.err(new Error('maxDailyEmails must be > 0')));
    }
    const config: WarmupConfig = { ...DEFAULTS, ...input.config };
    return makeResult(Result.ok(new EmailWarmup({
      id: input.id,
      providerId: input.providerId,
      status: 'ACTIVE',
      currentDailyLimit: config.dailyIncrement,
      config,
      lastRunAt: null,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })));
  }

static reconstitute(props: EmailWarmupProps): EmailWarmup { return EmailWarmup.rehydrate(props); }
  static rehydrate(emailwarmupprops: EmailWarmupProps): EmailWarmup {
    return new EmailWarmup(props);
  }

  pause(): void {
    this.props.status = 'PAUSED';
    this.props.updatedAt = new Date();
  }

  resume(): void {
    if (this.props.status !== 'PAUSED') {
      this.props.status = 'ACTIVE';
    }
    this.props.updatedAt = new Date();
  }

  recordActivity(emailsSent: number, openRate: number): void {
    if (openRate >= this.props.config.targetOpenRate) {
      this.props.currentDailyLimit = Math.min(
        this.props.currentDailyLimit + this.props.config.dailyIncrement,
        this.props.config.maxDailyEmails,
      );
    }
    this.props.lastRunAt = new Date();
    this.props.updatedAt = new Date();
    if (emailsSent > 0) {
      // intentionally no-op; activity persistence is handled by infrastructure
    }
  }

  end(): void {
    this.props.status = 'COMPLETED';
    this.props.updatedAt = new Date();
  }

  get status(): WarmupStatus { return this.props.status; }
  get providerId(): string { return this.props.providerId; }
  get currentDailyLimit(): number { return this.props.currentDailyLimit; }
}
