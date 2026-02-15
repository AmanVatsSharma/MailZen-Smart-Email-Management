import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { MailServerService } from './mail-server.service';
import { Mailbox } from './entities/mailbox.entity';
import { User } from '../user/entities/user.entity';
import { MailboxInboundEvent } from './entities/mailbox-inbound-event.entity';
import {
  MailboxInboundEventObservabilityResponse,
  MailboxInboundEventStatsResponse,
} from './dto/mailbox-inbound-event-observability.response';

@Injectable()
export class MailboxService {
  private static readonly MAILZEN_DOMAIN = 'mailzen.com';
  private static readonly LOCAL_PART_PATTERN =
    /^[a-z0-9]+(?:[a-z0-9.]{1,28}[a-z0-9])?$/;
  private static readonly INBOUND_EVENT_STATUSES = new Set([
    'ACCEPTED',
    'DEDUPLICATED',
    'REJECTED',
  ]);
  private static readonly DEFAULT_INBOUND_EVENT_LIMIT = 20;
  private static readonly MAX_INBOUND_EVENT_LIMIT = 100;
  private static readonly DEFAULT_STATS_WINDOW_HOURS = 24;
  private static readonly MAX_STATS_WINDOW_HOURS = 168;

  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MailboxInboundEvent)
    private readonly mailboxInboundEventRepo: Repository<MailboxInboundEvent>,
    private readonly mailServer: MailServerService,
    private readonly billingService: BillingService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  private normalizeHandle(raw: string): string {
    return raw.trim().toLowerCase();
  }

  private validateDesiredLocalPart(raw: string): string {
    const normalized = this.normalizeHandle(raw);
    if (!MailboxService.LOCAL_PART_PATTERN.test(normalized)) {
      throw new BadRequestException(
        'Invalid mailbox handle. Use 3-30 lowercase letters/numbers/dots. Dot cannot start or end the handle.',
      );
    }
    return normalized;
  }

  async suggestLocalPart(base: string): Promise<string> {
    const cleanedBase = base
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '')
      .slice(0, 30);
    const cleaned = cleanedBase.length >= 3 ? cleanedBase : 'mailzen.user';
    let candidate = cleaned;
    let suffix = 0;

    while (true) {
      const exists = await this.mailboxRepo.findOne({
        where: {
          localPart: candidate,
          domain: MailboxService.MAILZEN_DOMAIN,
        },
      });
      if (!exists) return candidate;
      suffix += 1;
      const maxBaseLength = Math.max(3, 30 - `${suffix}`.length);
      const baseWithLimit = cleaned.slice(0, maxBaseLength).replace(/\.$/, '');
      candidate = `${baseWithLimit}${suffix}`;
    }
  }

  async createMailbox(
    userId: string,
    desiredLocalPart?: string,
  ): Promise<{ email: string; id: string }> {
    await this.enforceMailboxLimit(userId);
    const workspaceId = await this.resolveDefaultWorkspaceId(userId);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let localPart: string;
    if (desiredLocalPart) {
      localPart = this.validateDesiredLocalPart(desiredLocalPart);
      const existing = await this.mailboxRepo.findOne({
        where: {
          localPart,
          domain: MailboxService.MAILZEN_DOMAIN,
        },
      });
      if (existing) {
        throw new ConflictException(
          'This @mailzen.com address is already taken',
        );
      }
    } else {
      const base = await this.deriveBaseFromUser(userId);
      localPart = await this.suggestLocalPart(base);
    }

    const email = `${localPart}@${MailboxService.MAILZEN_DOMAIN}`;
    const created = await this.mailboxRepo.save(
      this.mailboxRepo.create({
        userId,
        workspaceId,
        localPart,
        domain: MailboxService.MAILZEN_DOMAIN,
        email,
      }),
    );
    // Provision on self-hosted server
    await this.mailServer.provisionMailbox(userId, localPart);
    return { email: created.email, id: created.id };
  }

  async getUserMailboxes(userId: string, workspaceId?: string | null) {
    const normalizedWorkspaceId = String(workspaceId || '').trim();
    return this.mailboxRepo.find({
      where: normalizedWorkspaceId
        ? { userId, workspaceId: normalizedWorkspaceId }
        : { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getInboundEvents(
    userId: string,
    options?: {
      mailboxId?: string | null;
      status?: string | null;
      limit?: number | null;
    },
  ): Promise<MailboxInboundEventObservabilityResponse[]> {
    const normalizedMailboxId = String(options?.mailboxId || '').trim() || null;
    const normalizedStatus = this.normalizeInboundEventStatus(options?.status);
    const limit = this.normalizeInboundEventLimit(options?.limit);

    if (normalizedMailboxId) {
      await this.assertMailboxOwnership(userId, normalizedMailboxId);
    }

    const whereClause: { userId: string; mailboxId?: string; status?: string } =
      { userId };
    if (normalizedMailboxId) {
      whereClause.mailboxId = normalizedMailboxId;
    }
    if (normalizedStatus) {
      whereClause.status = normalizedStatus;
    }

    const events = await this.mailboxInboundEventRepo.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const mailboxIdSet = new Set(events.map((event) => event.mailboxId));
    const mailboxIds = Array.from(mailboxIdSet);
    const mailboxEmailById =
      mailboxIds.length > 0
        ? await this.resolveMailboxEmailById(userId, mailboxIds)
        : new Map<string, string>();

    return events.map((event) => ({
      id: event.id,
      mailboxId: event.mailboxId,
      mailboxEmail: mailboxEmailById.get(event.mailboxId) ?? null,
      messageId: event.messageId ?? null,
      emailId: event.emailId ?? null,
      inboundThreadKey: event.inboundThreadKey ?? null,
      status: event.status,
      sourceIp: event.sourceIp ?? null,
      signatureValidated: event.signatureValidated,
      errorReason: event.errorReason ?? null,
      createdAt: event.createdAt,
    }));
  }

  async getInboundEventStats(
    userId: string,
    options?: {
      mailboxId?: string | null;
      windowHours?: number | null;
    },
  ): Promise<MailboxInboundEventStatsResponse> {
    const normalizedMailboxId = String(options?.mailboxId || '').trim() || null;
    const windowHours = this.normalizeStatsWindowHours(options?.windowHours);
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    let mailboxEmail: string | null = null;

    if (normalizedMailboxId) {
      const mailbox = await this.assertMailboxOwnership(
        userId,
        normalizedMailboxId,
      );
      mailboxEmail = mailbox.email;
    }

    const query = this.mailboxInboundEventRepo
      .createQueryBuilder('event')
      .select('event.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('event.userId = :userId', { userId })
      .andWhere('event.createdAt >= :windowStart', {
        windowStart: windowStartDate.toISOString(),
      });

    if (normalizedMailboxId) {
      query.andWhere('event.mailboxId = :mailboxId', {
        mailboxId: normalizedMailboxId,
      });
    }

    const groupedCounts = await query.groupBy('event.status').getRawMany<{
      status: string;
      count: string;
    }>();

    const whereClause: { userId: string; mailboxId?: string } = { userId };
    if (normalizedMailboxId) {
      whereClause.mailboxId = normalizedMailboxId;
    }
    const latestEvent = await this.mailboxInboundEventRepo.findOne({
      where: whereClause,
      order: { createdAt: 'DESC' },
    });

    const aggregate = groupedCounts.reduce(
      (acc, entry) => {
        const countValue = Number(entry.count || '0');
        acc.totalCount += countValue;
        if (entry.status === 'ACCEPTED') {
          acc.acceptedCount += countValue;
        } else if (entry.status === 'DEDUPLICATED') {
          acc.deduplicatedCount += countValue;
        } else if (entry.status === 'REJECTED') {
          acc.rejectedCount += countValue;
        }
        return acc;
      },
      {
        totalCount: 0,
        acceptedCount: 0,
        deduplicatedCount: 0,
        rejectedCount: 0,
      },
    );

    return {
      mailboxId: normalizedMailboxId,
      mailboxEmail,
      windowHours,
      totalCount: aggregate.totalCount,
      acceptedCount: aggregate.acceptedCount,
      deduplicatedCount: aggregate.deduplicatedCount,
      rejectedCount: aggregate.rejectedCount,
      lastProcessedAt: latestEvent?.createdAt ?? null,
    };
  }

  private async deriveBaseFromUser(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const name = user.name || user.email.split('@')[0];
    return name;
  }

  private async enforceMailboxLimit(userId: string): Promise<void> {
    const entitlements = await this.billingService.getEntitlements(userId);
    const currentMailboxCount = await this.mailboxRepo.count({
      where: { userId },
    });
    if (currentMailboxCount < entitlements.mailboxLimit) return;

    throw new BadRequestException(
      `Plan limit reached. Your ${entitlements.planCode} plan supports up to ${entitlements.mailboxLimit} mailboxes.`,
    );
  }

  private async resolveDefaultWorkspaceId(userId: string): Promise<string> {
    const workspaces = await this.workspaceService.listMyWorkspaces(userId);
    const preferredWorkspace =
      workspaces.find((workspace) => workspace.isPersonal) || workspaces[0];
    if (!preferredWorkspace) {
      throw new BadRequestException('No workspace available for this user');
    }
    return preferredWorkspace.id;
  }

  private normalizeInboundEventStatus(status?: string | null): string | null {
    const normalizedStatus = String(status || '')
      .trim()
      .toUpperCase();
    if (!normalizedStatus) return null;
    if (MailboxService.INBOUND_EVENT_STATUSES.has(normalizedStatus)) {
      return normalizedStatus;
    }
    throw new BadRequestException(
      'Invalid status filter. Allowed values: ACCEPTED, DEDUPLICATED, REJECTED.',
    );
  }

  private normalizeInboundEventLimit(limit?: number | null): number {
    const rawLimit =
      typeof limit === 'number' && Number.isFinite(limit)
        ? Math.floor(limit)
        : MailboxService.DEFAULT_INBOUND_EVENT_LIMIT;
    if (rawLimit < 1) return 1;
    if (rawLimit > MailboxService.MAX_INBOUND_EVENT_LIMIT) {
      return MailboxService.MAX_INBOUND_EVENT_LIMIT;
    }
    return rawLimit;
  }

  private normalizeStatsWindowHours(windowHours?: number | null): number {
    const rawWindow =
      typeof windowHours === 'number' && Number.isFinite(windowHours)
        ? Math.floor(windowHours)
        : MailboxService.DEFAULT_STATS_WINDOW_HOURS;
    if (rawWindow < 1) return 1;
    if (rawWindow > MailboxService.MAX_STATS_WINDOW_HOURS) {
      return MailboxService.MAX_STATS_WINDOW_HOURS;
    }
    return rawWindow;
  }

  private async assertMailboxOwnership(
    userId: string,
    mailboxId: string,
  ): Promise<Mailbox> {
    const mailbox = await this.mailboxRepo.findOne({
      where: { id: mailboxId, userId },
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }
    return mailbox;
  }

  private async resolveMailboxEmailById(
    userId: string,
    mailboxIds: string[],
  ): Promise<Map<string, string>> {
    if (!mailboxIds.length) return new Map<string, string>();
    const mailboxes = await this.mailboxRepo.find({
      where: { userId, id: In(mailboxIds) },
      select: ['id', 'email'],
    });
    return new Map(mailboxes.map((mailbox) => [mailbox.id, mailbox.email]));
  }
}
