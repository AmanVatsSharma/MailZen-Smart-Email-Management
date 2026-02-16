import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { MailboxSyncService } from '../mailbox/mailbox-sync.service';
import { EmailProviderService } from '../email-integration/email-provider.service';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

/**
 * InboxService - Manages unified inbox view across mailboxes and providers
 * Handles inbox switching and active inbox state
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);
  private static readonly MIN_HEALTH_WINDOW_HOURS = 1;
  private static readonly MAX_HEALTH_WINDOW_HOURS = 24 * 30;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
    @InjectRepository(EmailProvider)
    private readonly providerRepository: Repository<EmailProvider>,
    private readonly mailboxSyncService: MailboxSyncService,
    private readonly emailProviderService: EmailProviderService,
  ) {
    // intentionally quiet in constructor to reduce startup log noise
  }

  private resolveMailboxSyncStatus(mailbox: Mailbox): string {
    const normalizedSyncStatus = String(mailbox.inboundSyncStatus || '')
      .trim()
      .toLowerCase();
    if (normalizedSyncStatus) {
      return normalizedSyncStatus;
    }
    const mailboxStatus = String(mailbox.status || '')
      .trim()
      .toUpperCase();
    if (mailboxStatus && mailboxStatus !== 'ACTIVE') {
      return 'disabled';
    }
    const now = Date.now();
    const leaseExpiresAtMs = mailbox.inboundSyncLeaseExpiresAt
      ? new Date(mailbox.inboundSyncLeaseExpiresAt).getTime()
      : 0;
    if (leaseExpiresAtMs > now) {
      return 'syncing';
    }
    if (String(mailbox.inboundSyncLastError || '').trim()) {
      return 'error';
    }
    if (mailbox.inboundSyncLastPolledAt) {
      return 'connected';
    }
    return 'pending';
  }

  private resolveProviderSyncStatus(provider: EmailProvider): string {
    const normalizedStatus = String(provider.status || '')
      .trim()
      .toLowerCase();
    if (normalizedStatus) return normalizedStatus;
    if (String(provider.lastSyncError || '').trim()) {
      return 'error';
    }
    if (provider.lastSyncedAt) return 'connected';
    return 'connected';
  }

  private normalizeHealthWindowHours(windowHours?: number | null): number {
    if (typeof windowHours !== 'number' || !Number.isFinite(windowHours)) {
      return 24;
    }
    const rounded = Math.trunc(windowHours);
    if (rounded < InboxService.MIN_HEALTH_WINDOW_HOURS) {
      return InboxService.MIN_HEALTH_WINDOW_HOURS;
    }
    if (rounded > InboxService.MAX_HEALTH_WINDOW_HOURS) {
      return InboxService.MAX_HEALTH_WINDOW_HOURS;
    }
    return rounded;
  }

  /**
   * List all inboxes (mailboxes + providers) for a user
   * @param userId - User ID
   * @returns Combined list of inbox sources
   */
  async listUserInboxes(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const activeWorkspaceId = user.activeWorkspaceId || undefined;
    const mailboxWhere = activeWorkspaceId
      ? { userId, workspaceId: activeWorkspaceId }
      : { userId };
    const providerWhere = activeWorkspaceId
      ? { userId, workspaceId: activeWorkspaceId }
      : { userId };

    const [mailboxes, providers] = await Promise.all([
      this.mailboxRepository.find({
        where: mailboxWhere,
        order: { createdAt: 'DESC' },
      }),
      this.providerRepository.find({
        where: providerWhere,
        order: { createdAt: 'DESC' },
      }),
    ]);

    const activeType = user.activeInboxType;
    const activeId = user.activeInboxId;

    const mailboxInboxes = mailboxes.map((m) => ({
      id: m.id,
      type: 'MAILBOX',
      address: m.email,
      isActive: activeType === 'MAILBOX' && activeId === m.id,
      status: m.status,
      syncStatus: this.resolveMailboxSyncStatus(m),
      lastSyncedAt: m.inboundSyncLastPolledAt || null,
      lastSyncError: m.inboundSyncLastError || null,
      lastSyncErrorAt: m.inboundSyncLastErrorAt || null,
      sourceKind: 'MAILBOX',
    }));

    const providerInboxes = providers.map((p) => ({
      id: p.id,
      type: 'PROVIDER',
      address: p.email,
      isActive: activeType === 'PROVIDER' && activeId === p.id,
      status: p.status || 'connected',
      syncStatus: this.resolveProviderSyncStatus(p),
      lastSyncedAt: p.lastSyncedAt || null,
      lastSyncError: p.lastSyncError || null,
      lastSyncErrorAt: p.lastSyncErrorAt || null,
      sourceKind:
        String(p.type || '')
          .trim()
          .toUpperCase() || 'PROVIDER',
    }));

    return [...mailboxInboxes, ...providerInboxes];
  }

  /**
   * Set active inbox for user (switches between mailboxes and providers)
   * @param userId - User ID
   * @param type - Inbox type (MAILBOX or PROVIDER)
   * @param id - Inbox ID
   * @returns Updated inbox list
   */
  async setActiveInbox(
    userId: string,
    type: 'MAILBOX' | 'PROVIDER',
    id: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const activeWorkspaceId = user.activeWorkspaceId || undefined;
    const resourceWhere = activeWorkspaceId
      ? { id, userId, workspaceId: activeWorkspaceId }
      : { id, userId };
    const updateScope = activeWorkspaceId
      ? { userId, workspaceId: activeWorkspaceId }
      : { userId };

    // Ownership validation + consistent "active" flags
    if (type === 'MAILBOX') {
      const mailbox = await this.mailboxRepository.findOne({
        where: resourceWhere,
      });
      if (!mailbox) throw new NotFoundException('Mailbox not found');

      // Deactivate all external providers for UI consistency
      await this.providerRepository.update(updateScope, { isActive: false });
      await this.userRepository.update(userId, {
        activeInboxType: 'MAILBOX',
        activeInboxId: id,
      });

      this.logger.log(
        serializeStructuredLog({
          event: 'inbox_active_source_set',
          userId,
          sourceType: 'MAILBOX',
          sourceId: mailbox.id,
          accountFingerprint: fingerprintIdentifier(mailbox.email),
        }),
      );
      return this.listUserInboxes(userId);
    }

    const provider = await this.providerRepository.findOne({
      where: resourceWhere,
    });
    if (!provider) throw new NotFoundException('Provider not found');

    // Toggle provider active flag (single active provider)
    await this.providerRepository.update(updateScope, { isActive: false });
    await this.providerRepository.update(id, { isActive: true });
    await this.userRepository.update(userId, {
      activeInboxType: 'PROVIDER',
      activeInboxId: id,
    });

    this.logger.log(
      serializeStructuredLog({
        event: 'inbox_active_source_set',
        userId,
        sourceType: 'PROVIDER',
        sourceId: provider.id,
        providerType:
          String(provider.type || '')
            .trim()
            .toUpperCase() || null,
        accountFingerprint: fingerprintIdentifier(provider.email),
      }),
    );
    return this.listUserInboxes(userId);
  }

  async syncUserInboxes(input: {
    userId: string;
    workspaceId?: string | null;
  }) {
    const normalizedWorkspaceId =
      String(input.workspaceId || '').trim() || null;
    let mailboxSyncError: string | null = null;
    let providerSyncError: string | null = null;

    let mailboxResult = {
      polledMailboxes: 0,
      skippedMailboxes: 0,
      failedMailboxes: 0,
    };
    try {
      const summary = await this.mailboxSyncService.pollUserMailboxes({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
      });
      mailboxResult = {
        polledMailboxes: summary.polledMailboxes,
        skippedMailboxes: summary.skippedMailboxes,
        failedMailboxes: summary.failedMailboxes,
      };
    } catch (error: unknown) {
      mailboxSyncError =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Mailbox sync failed';
      this.logger.warn(
        serializeStructuredLog({
          event: 'inbox_sync_mailbox_failed',
          userId: input.userId,
          workspaceId: normalizedWorkspaceId,
          error: mailboxSyncError,
        }),
      );
    }

    let providerResult = {
      requestedProviders: 0,
      syncedProviders: 0,
      failedProviders: 0,
      skippedProviders: 0,
    };
    try {
      const summary = await this.emailProviderService.syncUserProviders({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
      });
      providerResult = {
        requestedProviders: summary.requestedProviders,
        syncedProviders: summary.syncedProviders,
        failedProviders: summary.failedProviders,
        skippedProviders: summary.skippedProviders,
      };
    } catch (error: unknown) {
      providerSyncError =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Provider sync failed';
      this.logger.warn(
        serializeStructuredLog({
          event: 'inbox_sync_provider_failed',
          userId: input.userId,
          workspaceId: normalizedWorkspaceId,
          error: providerSyncError,
        }),
      );
    }

    return {
      mailboxPolledMailboxes: mailboxResult.polledMailboxes,
      mailboxSkippedMailboxes: mailboxResult.skippedMailboxes,
      mailboxFailedMailboxes: mailboxResult.failedMailboxes,
      providerRequestedProviders: providerResult.requestedProviders,
      providerSyncedProviders: providerResult.syncedProviders,
      providerFailedProviders: providerResult.failedProviders,
      providerSkippedProviders: providerResult.skippedProviders,
      success: !mailboxSyncError && !providerSyncError,
      mailboxSyncError,
      providerSyncError,
      executedAtIso: new Date().toISOString(),
    };
  }

  async getInboxSourceHealthStats(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
  }) {
    const user = await this.userRepository.findOne({
      where: { id: input.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const requestedWorkspaceId = String(input.workspaceId || '').trim();
    const scopedWorkspaceId =
      requestedWorkspaceId || user.activeWorkspaceId || null;
    const normalizedWindowHours = this.normalizeHealthWindowHours(
      input.windowHours,
    );
    const cutoff = new Date(
      Date.now() - normalizedWindowHours * 60 * 60 * 1000,
    );
    const mailboxWhere = scopedWorkspaceId
      ? { userId: input.userId, workspaceId: scopedWorkspaceId }
      : { userId: input.userId };
    const providerWhere = scopedWorkspaceId
      ? { userId: input.userId, workspaceId: scopedWorkspaceId }
      : { userId: input.userId };

    const [mailboxes, providers] = await Promise.all([
      this.mailboxRepository.find({
        where: mailboxWhere,
      }),
      this.providerRepository.find({
        where: providerWhere,
      }),
    ]);

    let activeInboxes = 0;
    let connectedInboxes = 0;
    let syncingInboxes = 0;
    let errorInboxes = 0;
    let pendingInboxes = 0;
    let disabledInboxes = 0;
    let recentlySyncedInboxes = 0;
    let recentlyErroredInboxes = 0;

    for (const mailbox of mailboxes) {
      const status = this.resolveMailboxSyncStatus(mailbox);
      const normalizedStatus = String(status || '')
        .trim()
        .toLowerCase();
      if (
        user.activeInboxType === 'MAILBOX' &&
        user.activeInboxId === mailbox.id
      ) {
        activeInboxes += 1;
      }
      if (normalizedStatus === 'syncing') syncingInboxes += 1;
      else if (normalizedStatus === 'error') errorInboxes += 1;
      else if (normalizedStatus === 'pending') pendingInboxes += 1;
      else if (normalizedStatus === 'disabled') disabledInboxes += 1;
      else connectedInboxes += 1;

      if (
        mailbox.inboundSyncLastPolledAt &&
        mailbox.inboundSyncLastPolledAt >= cutoff
      ) {
        recentlySyncedInboxes += 1;
      }
      if (
        mailbox.inboundSyncLastErrorAt &&
        mailbox.inboundSyncLastErrorAt >= cutoff
      ) {
        recentlyErroredInboxes += 1;
      }
    }

    for (const provider of providers) {
      const status = this.resolveProviderSyncStatus(provider);
      const normalizedStatus = String(status || '')
        .trim()
        .toLowerCase();
      if (
        user.activeInboxType === 'PROVIDER' &&
        user.activeInboxId === provider.id
      ) {
        activeInboxes += 1;
      }
      if (normalizedStatus === 'syncing') syncingInboxes += 1;
      else if (normalizedStatus === 'error') errorInboxes += 1;
      else if (normalizedStatus === 'pending') pendingInboxes += 1;
      else if (normalizedStatus === 'disabled') disabledInboxes += 1;
      else connectedInboxes += 1;

      if (provider.lastSyncedAt && provider.lastSyncedAt >= cutoff) {
        recentlySyncedInboxes += 1;
      }
      if (provider.lastSyncErrorAt && provider.lastSyncErrorAt >= cutoff) {
        recentlyErroredInboxes += 1;
      }
    }

    return {
      totalInboxes: mailboxes.length + providers.length,
      mailboxInboxes: mailboxes.length,
      providerInboxes: providers.length,
      activeInboxes,
      connectedInboxes,
      syncingInboxes,
      errorInboxes,
      pendingInboxes,
      disabledInboxes,
      recentlySyncedInboxes,
      recentlyErroredInboxes,
      windowHours: normalizedWindowHours,
      workspaceId: scopedWorkspaceId,
      executedAtIso: new Date().toISOString(),
    };
  }
}
