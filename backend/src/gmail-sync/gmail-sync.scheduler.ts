import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GmailSyncService } from './gmail-sync.service';

/**
 * Periodic Gmail sync.
 *
 * MVP: sync all active Gmail providers every 10 minutes.
 * This is intentionally conservative to avoid rate-limit surprises.
 */
@Injectable()
export class GmailSyncScheduler {
  private readonly logger = new Logger(GmailSyncScheduler.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailSync: GmailSyncService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncActiveGmailProviders() {
    const providers = await this.prisma.emailProvider.findMany({
      where: { type: 'GMAIL', isActive: true },
      select: { id: true, userId: true },
    });
    if (!providers.length) return;

    this.logger.log(`Cron: syncing ${providers.length} active Gmail providers`);

    for (const p of providers) {
      try {
        await this.gmailSync.syncGmailProvider(p.id, p.userId, 25);
      } catch (e: any) {
        this.logger.warn(`Cron sync failed for provider=${p.id}: ${e?.message || e}`);
        await this.prisma.emailProvider.update({ where: { id: p.id }, data: { status: 'error' } });
      }
    }
  }
}

