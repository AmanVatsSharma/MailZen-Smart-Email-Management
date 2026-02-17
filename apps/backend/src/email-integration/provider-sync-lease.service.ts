import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { EmailProvider } from './entities/email-provider.entity';

type AcquireProviderSyncLeaseInput = {
  providerId: string;
  providerType: 'GMAIL' | 'OUTLOOK';
  leaseTtlMs?: number;
};

@Injectable()
export class ProviderSyncLeaseService {
  private readonly logger = new Logger(ProviderSyncLeaseService.name);

  constructor(
    @InjectRepository(EmailProvider)
    private readonly providerRepo: Repository<EmailProvider>,
  ) {}

  private resolveLeaseTtlMs(candidateLeaseTtlMs?: number): number {
    const fallback = Number(process.env.PROVIDER_SYNC_LEASE_TTL_MS || 540_000);
    const source = candidateLeaseTtlMs ?? fallback;
    if (!Number.isFinite(source)) return 540_000;
    const normalized = Math.floor(source);
    if (normalized < 60_000) return 60_000;
    if (normalized > 60 * 60 * 1_000) return 60 * 60 * 1_000;
    return normalized;
  }

  async acquireProviderSyncLease(
    input: AcquireProviderSyncLeaseInput,
  ): Promise<boolean> {
    const leaseTtlMs = this.resolveLeaseTtlMs(input.leaseTtlMs);
    const now = new Date();
    const nextLeaseExpiry = new Date(now.getTime() + leaseTtlMs);

    try {
      const result = await this.providerRepo
        .createQueryBuilder()
        .update(EmailProvider)
        .set({
          status: 'syncing',
          syncLeaseExpiresAt: nextLeaseExpiry,
        })
        .where('id = :providerId', { providerId: input.providerId })
        .andWhere('"type" = :providerType', { providerType: input.providerType })
        .andWhere('"isActive" = :isActive', { isActive: true })
        .andWhere(
          '("syncLeaseExpiresAt" IS NULL OR "syncLeaseExpiresAt" < :now)',
          { now: now.toISOString() },
        )
        .execute();

      const acquired = Boolean(result.affected && result.affected > 0);
      if (!acquired) {
        this.logger.log(
          serializeStructuredLog({
            event: 'provider_sync_lease_skipped',
            providerId: input.providerId,
            providerType: input.providerType,
          }),
        );
      }
      return acquired;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        serializeStructuredLog({
          event: 'provider_sync_lease_failed',
          providerId: input.providerId,
          providerType: input.providerType,
          error: message,
        }),
      );
      return false;
    }
  }
}
