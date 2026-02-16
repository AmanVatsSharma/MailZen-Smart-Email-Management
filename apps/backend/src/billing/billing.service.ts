import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { AiCreditBalanceResponse } from './dto/ai-credit-balance.response';
import { BillingDataExportResponse } from './dto/billing-data-export.response';
import { BillingRetentionPurgeResponse } from './dto/billing-retention-purge.response';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { BillingPlan } from './entities/billing-plan.entity';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { BillingUpgradeIntentResponse } from './dto/billing-upgrade-intent.response';
import { UserAiCreditUsage } from './entities/user-ai-credit-usage.entity';
import { UserSubscription } from './entities/user-subscription.entity';

export type BillingEntitlements = {
  planCode: string;
  providerLimit: number;
  mailboxLimit: number;
  workspaceLimit: number;
  workspaceMemberLimit: number;
  aiCreditsPerMonth: number;
  mailboxStorageLimitMb: number;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingPlan)
    private readonly billingPlanRepo: Repository<BillingPlan>,
    @InjectRepository(UserSubscription)
    private readonly userSubscriptionRepo: Repository<UserSubscription>,
    @InjectRepository(UserAiCreditUsage)
    private readonly userAiCreditUsageRepo: Repository<UserAiCreditUsage>,
    @InjectRepository(BillingInvoice)
    private readonly billingInvoiceRepo: Repository<BillingInvoice>,
    @InjectRepository(BillingWebhookEvent)
    private readonly billingWebhookEventRepo: Repository<BillingWebhookEvent>,
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepo: Repository<EmailProvider>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepo: Repository<WorkspaceMember>,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  private resolveCurrentPeriodStartIso(referenceDate = new Date()): string {
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth();
    return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  }

  private resolveCurrentPeriodBounds(referenceDate = new Date()): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth();
    const periodStart = new Date(Date.UTC(year, month, 1));
    const periodEnd = new Date(Date.UTC(year, month + 1, 1));
    return { periodStart, periodEnd };
  }

  private normalizePlanCode(planCode: string): string {
    return String(planCode || '')
      .trim()
      .toUpperCase();
  }

  private trimErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim().slice(0, 500);
    }
    const message = typeof error === 'string' ? error.trim() : '';
    return (message || fallback).slice(0, 500);
  }

  private safeJsonParse(
    payloadJson?: string,
  ): Record<string, unknown> | undefined {
    if (!payloadJson || !String(payloadJson).trim()) return undefined;
    try {
      const parsed: unknown = JSON.parse(payloadJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new BadRequestException(
        'Billing webhook payload must be an object',
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Billing webhook payload must be valid JSON',
      );
    }
  }

  private toSafeString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized || undefined;
  }

  private toSafeNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.floor(parsed);
  }

  private resolveBoundedInteger(input: {
    value: unknown;
    fallback: number;
    min: number;
    max: number;
  }): number {
    const parsed = this.toSafeNumber(input.value, input.fallback);
    return Math.min(Math.max(parsed, input.min), input.max);
  }

  private resolveBigIntString(
    value: string | number | null | undefined,
  ): bigint {
    try {
      return BigInt(String(value || '0'));
    } catch {
      return 0n;
    }
  }

  private getDefaultPlans(): Array<Partial<BillingPlan>> {
    return [
      {
        code: 'FREE',
        name: 'Free',
        priceMonthlyCents: 0,
        currency: 'USD',
        providerLimit: 1,
        mailboxLimit: 1,
        workspaceLimit: 1,
        workspaceMemberLimit: 3,
        aiCreditsPerMonth: 50,
        mailboxStorageLimitMb: 2048,
        isActive: true,
      },
      {
        code: 'PRO',
        name: 'Pro',
        priceMonthlyCents: 1900,
        currency: 'USD',
        providerLimit: 5,
        mailboxLimit: 5,
        workspaceLimit: 5,
        workspaceMemberLimit: 25,
        aiCreditsPerMonth: 500,
        mailboxStorageLimitMb: 10240,
        isActive: true,
      },
      {
        code: 'BUSINESS',
        name: 'Business',
        priceMonthlyCents: 5900,
        currency: 'USD',
        providerLimit: 25,
        mailboxLimit: 25,
        workspaceLimit: 25,
        workspaceMemberLimit: 200,
        aiCreditsPerMonth: 5000,
        mailboxStorageLimitMb: 51200,
        isActive: true,
      },
    ];
  }

  async ensureDefaultPlans(): Promise<void> {
    const existingPlansCount = await this.billingPlanRepo.count();
    if (existingPlansCount > 0) return;

    this.logger.log('billing-service: seeding default plan catalog');
    const plans = this.getDefaultPlans();
    await this.billingPlanRepo.save(this.billingPlanRepo.create(plans));
  }

  async listPlans(): Promise<BillingPlan[]> {
    await this.ensureDefaultPlans();
    return this.billingPlanRepo.find({
      where: { isActive: true },
      order: { priceMonthlyCents: 'ASC' },
    });
  }

  async getMySubscription(userId: string): Promise<UserSubscription> {
    await this.ensureDefaultPlans();
    const existing = await this.userSubscriptionRepo.findOne({
      where: { userId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    if (existing) return existing;

    this.logger.log(
      `billing-service: creating default FREE subscription userId=${userId}`,
    );
    const created = this.userSubscriptionRepo.create({
      userId,
      planCode: 'FREE',
      status: 'active',
      startedAt: new Date(),
      isTrial: false,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
    });
    return this.userSubscriptionRepo.save(created);
  }

  async selectPlan(
    userId: string,
    planCode: string,
  ): Promise<UserSubscription> {
    await this.ensureDefaultPlans();
    const normalizedPlanCode = this.normalizePlanCode(planCode);
    if (!normalizedPlanCode) {
      throw new BadRequestException('Plan code is required');
    }

    const targetPlan = await this.billingPlanRepo.findOne({
      where: { code: normalizedPlanCode, isActive: true },
    });
    if (!targetPlan) {
      throw new NotFoundException(
        `Billing plan '${normalizedPlanCode}' does not exist`,
      );
    }

    const current = await this.getMySubscription(userId);
    if (current.planCode === normalizedPlanCode) return current;

    const previousPlanCode = current.planCode;
    this.logger.log(
      `billing-service: userId=${userId} switching plan ${current.planCode} -> ${normalizedPlanCode}`,
    );
    current.planCode = normalizedPlanCode;
    current.startedAt = new Date();
    current.cancelAtPeriodEnd = false;
    current.status = 'active';
    current.endsAt = null;
    current.isTrial = false;
    current.trialEndsAt = null;
    const updatedSubscription = await this.userSubscriptionRepo.save(current);

    if (targetPlan.priceMonthlyCents > 0) {
      await this.createInvoice({
        userId,
        subscriptionId: updatedSubscription.id,
        planCode: targetPlan.code,
        provider: 'INTERNAL',
        status: 'open',
        amountCents: targetPlan.priceMonthlyCents,
        currency: targetPlan.currency || 'USD',
        metadata: {
          source: 'select_plan',
          previousPlanCode,
        },
      });
    }

    return updatedSubscription;
  }

  async getEntitlements(userId: string): Promise<BillingEntitlements> {
    await this.ensureDefaultPlans();
    const subscription = await this.getMySubscription(userId);
    const plan = await this.billingPlanRepo.findOne({
      where: { code: subscription.planCode, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException(
        `Entitlement plan '${subscription.planCode}' not found`,
      );
    }

    return {
      planCode: plan.code,
      providerLimit: plan.providerLimit,
      mailboxLimit: plan.mailboxLimit,
      workspaceLimit: plan.workspaceLimit,
      workspaceMemberLimit: plan.workspaceMemberLimit,
      aiCreditsPerMonth: plan.aiCreditsPerMonth,
      mailboxStorageLimitMb: plan.mailboxStorageLimitMb,
    };
  }

  private async getOrCreateUsageForCurrentPeriod(
    userId: string,
    periodStart: string,
  ): Promise<UserAiCreditUsage> {
    await this.userAiCreditUsageRepo.upsert(
      [
        {
          userId,
          periodStart,
          usedCredits: 0,
        },
      ],
      ['userId', 'periodStart'],
    );

    const usage = await this.userAiCreditUsageRepo.findOne({
      where: { userId, periodStart },
    });
    if (usage) return usage;

    const created = this.userAiCreditUsageRepo.create({
      userId,
      periodStart,
      usedCredits: 0,
    });
    return this.userAiCreditUsageRepo.save(created);
  }

  async getAiCreditBalance(userId: string): Promise<AiCreditBalanceResponse> {
    const entitlements = await this.getEntitlements(userId);
    const periodStart = this.resolveCurrentPeriodStartIso();
    const usage = await this.getOrCreateUsageForCurrentPeriod(
      userId,
      periodStart,
    );
    const usedCredits = Number(usage.usedCredits || 0);
    const monthlyLimit = Number(entitlements.aiCreditsPerMonth || 0);
    return {
      planCode: entitlements.planCode,
      monthlyLimit,
      usedCredits,
      remainingCredits: Math.max(monthlyLimit - usedCredits, 0),
      periodStart,
      lastConsumedAtIso: usage.lastConsumedAt
        ? usage.lastConsumedAt.toISOString()
        : null,
    };
  }

  private async resolveWorkspaceSeatUsage(input: {
    userId: string;
    workspaceId?: string | null;
  }): Promise<{ workspaceId: string | null; activeMembers: number }> {
    const requestedWorkspaceId = String(input.workspaceId || '').trim();
    if (requestedWorkspaceId) {
      const workspace = await this.workspaceRepo.findOne({
        where: { id: requestedWorkspaceId, ownerUserId: input.userId },
      });
      if (!workspace) {
        throw new NotFoundException(
          `Workspace '${requestedWorkspaceId}' not found for entitlement usage`,
        );
      }
      const activeMembers = await this.workspaceMemberRepo.count({
        where: { workspaceId: workspace.id, status: 'active' },
      });
      return {
        workspaceId: workspace.id,
        activeMembers,
      };
    }

    const ownedWorkspaces = await this.workspaceRepo.find({
      where: { ownerUserId: input.userId },
      select: ['id'],
      order: { createdAt: 'ASC' },
    });
    if (!ownedWorkspaces.length) {
      return {
        workspaceId: null,
        activeMembers: 0,
      };
    }

    const memberCounts = await Promise.all(
      ownedWorkspaces.map(async (workspace) => ({
        workspaceId: workspace.id,
        activeMembers: await this.workspaceMemberRepo.count({
          where: { workspaceId: workspace.id, status: 'active' },
        }),
      })),
    );
    const peakUsage = memberCounts.reduce<{
      workspaceId: string | null;
      activeMembers: number;
    }>(
      (maxUsage, current) =>
        current.activeMembers > maxUsage.activeMembers ? current : maxUsage,
      {
        workspaceId: ownedWorkspaces[0]?.id || null,
        activeMembers: 0,
      },
    );
    return peakUsage;
  }

  async getEntitlementUsageSummary(input: {
    userId: string;
    workspaceId?: string | null;
  }): Promise<{
    planCode: string;
    providerLimit: number;
    providerUsed: number;
    providerRemaining: number;
    mailboxLimit: number;
    mailboxUsed: number;
    mailboxRemaining: number;
    workspaceLimit: number;
    workspaceUsed: number;
    workspaceRemaining: number;
    workspaceMemberLimit: number;
    workspaceMemberUsed: number;
    workspaceMemberRemaining: number;
    workspaceMemberWorkspaceId: string | null;
    mailboxStorageLimitMb: number;
    mailboxesOverEntitledStorageLimit: number;
    aiCreditsPerMonth: number;
    aiCreditsUsed: number;
    aiCreditsRemaining: number;
    periodStart: string;
    evaluatedAtIso: string;
  }> {
    const userId = String(input.userId || '').trim();
    if (!userId) {
      throw new BadRequestException('Authenticated user id is required');
    }
    const entitlements = await this.getEntitlements(userId);
    const [
      providerUsed,
      workspaceUsed,
      aiCreditBalance,
      mailboxRows,
      seatUsage,
    ] = await Promise.all([
      this.emailProviderRepo.count({
        where: { userId },
      }),
      this.workspaceRepo.count({
        where: { ownerUserId: userId },
      }),
      this.getAiCreditBalance(userId),
      this.mailboxRepo.find({
        where: { userId },
        select: ['id', 'usedBytes'],
      }),
      this.resolveWorkspaceSeatUsage({
        userId,
        workspaceId: input.workspaceId,
      }),
    ]);
    const mailboxUsed = mailboxRows.length;
    const mailboxStorageLimitBytes =
      BigInt(Math.max(Math.trunc(entitlements.mailboxStorageLimitMb), 0)) *
      1024n *
      1024n;
    const mailboxesOverEntitledStorageLimit = mailboxRows.filter((mailbox) => {
      if (mailboxStorageLimitBytes <= 0n) return false;
      return (
        this.resolveBigIntString(mailbox.usedBytes) > mailboxStorageLimitBytes
      );
    }).length;

    return {
      planCode: entitlements.planCode,
      providerLimit: entitlements.providerLimit,
      providerUsed,
      providerRemaining: Math.max(entitlements.providerLimit - providerUsed, 0),
      mailboxLimit: entitlements.mailboxLimit,
      mailboxUsed,
      mailboxRemaining: Math.max(entitlements.mailboxLimit - mailboxUsed, 0),
      workspaceLimit: entitlements.workspaceLimit,
      workspaceUsed,
      workspaceRemaining: Math.max(
        entitlements.workspaceLimit - workspaceUsed,
        0,
      ),
      workspaceMemberLimit: entitlements.workspaceMemberLimit,
      workspaceMemberUsed: seatUsage.activeMembers,
      workspaceMemberRemaining: Math.max(
        entitlements.workspaceMemberLimit - seatUsage.activeMembers,
        0,
      ),
      workspaceMemberWorkspaceId: seatUsage.workspaceId,
      mailboxStorageLimitMb: entitlements.mailboxStorageLimitMb,
      mailboxesOverEntitledStorageLimit,
      aiCreditsPerMonth: entitlements.aiCreditsPerMonth,
      aiCreditsUsed: aiCreditBalance.usedCredits,
      aiCreditsRemaining: aiCreditBalance.remainingCredits,
      periodStart: aiCreditBalance.periodStart,
      evaluatedAtIso: new Date().toISOString(),
    };
  }

  async consumeAiCredits(input: {
    userId: string;
    credits: number;
    requestId?: string;
  }): Promise<
    AiCreditBalanceResponse & {
      allowed: boolean;
      requestedCredits: number;
    }
  > {
    const normalizedCredits = Number.isFinite(input.credits)
      ? Math.max(Math.floor(input.credits), 1)
      : 1;
    const entitlements = await this.getEntitlements(input.userId);
    const periodStart = this.resolveCurrentPeriodStartIso();
    await this.getOrCreateUsageForCurrentPeriod(input.userId, periodStart);

    const usageLimit = Number(entitlements.aiCreditsPerMonth || 0);
    const usageUpdate = await this.userAiCreditUsageRepo
      .createQueryBuilder()
      .update(UserAiCreditUsage)
      .set({
        usedCredits: () => `"usedCredits" + ${normalizedCredits}`,
        lastConsumedAt: new Date(),
        lastRequestId: String(input.requestId || '').trim() || null,
      })
      .where('"userId" = :userId', { userId: input.userId })
      .andWhere('"periodStart" = :periodStart', { periodStart })
      .andWhere('"usedCredits" + :requested <= :usageLimit', {
        requested: normalizedCredits,
        usageLimit,
      })
      .execute();

    const balance = await this.getAiCreditBalance(input.userId);
    const allowed = Boolean(usageUpdate.affected && usageUpdate.affected > 0);

    if (!allowed) {
      this.logger.warn(
        `billing-service: ai credits exhausted userId=${input.userId} used=${balance.usedCredits} limit=${balance.monthlyLimit}`,
      );
    }

    return {
      ...balance,
      allowed,
      requestedCredits: normalizedCredits,
    };
  }

  private async createInvoice(input: {
    userId: string;
    subscriptionId?: string | null;
    planCode: string;
    provider: string;
    providerInvoiceId?: string | null;
    status: string;
    amountCents: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<BillingInvoice> {
    const now = new Date();
    const { periodStart, periodEnd } = this.resolveCurrentPeriodBounds(now);
    const invoiceNumber = `MZ-${now.getUTCFullYear()}${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(Date.now()).slice(-6)}`;
    const created = this.billingInvoiceRepo.create({
      userId: input.userId,
      subscriptionId: input.subscriptionId || null,
      planCode: this.normalizePlanCode(input.planCode) || 'FREE',
      invoiceNumber,
      provider: this.toSafeString(input.provider)?.toUpperCase() || 'INTERNAL',
      providerInvoiceId: this.toSafeString(input.providerInvoiceId || null),
      status: this.toSafeString(input.status)?.toLowerCase() || 'open',
      amountCents: Math.max(0, this.toSafeNumber(input.amountCents, 0)),
      currency: this.toSafeString(input.currency)?.toUpperCase() || 'USD',
      periodStart,
      periodEnd,
      dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      metadata: input.metadata || null,
    });
    return this.billingInvoiceRepo.save(created);
  }

  async listMyInvoices(userId: string, limit = 20): Promise<BillingInvoice[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 20;
    return this.billingInvoiceRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: boundedLimit,
    });
  }

  private resolveRetentionPolicy() {
    return {
      webhookRetentionDays: this.resolveBoundedInteger({
        value: process.env.BILLING_WEBHOOK_RETENTION_DAYS,
        fallback: 120,
        min: 7,
        max: 3650,
      }),
      aiUsageRetentionMonths: this.resolveBoundedInteger({
        value: process.env.BILLING_AI_USAGE_RETENTION_MONTHS,
        fallback: 36,
        min: 1,
        max: 120,
      }),
    };
  }

  async exportMyBillingData(
    userId: string,
  ): Promise<BillingDataExportResponse> {
    await this.ensureDefaultPlans();
    const generatedAt = new Date();
    const subscription = await this.getMySubscription(userId);
    const entitlements = await this.getEntitlements(userId);
    const aiCreditBalance = await this.getAiCreditBalance(userId);
    const invoices = await this.listMyInvoices(userId, 100);
    const aiUsageHistory = await this.userAiCreditUsageRepo.find({
      where: { userId },
      order: { periodStart: 'DESC' },
      take: 48,
    });
    const retentionPolicy = this.resolveRetentionPolicy();

    const payload = {
      userId,
      generatedAtIso: generatedAt.toISOString(),
      subscription: {
        id: subscription.id,
        planCode: subscription.planCode,
        status: subscription.status,
        startedAtIso: subscription.startedAt.toISOString(),
        endsAtIso: subscription.endsAt
          ? subscription.endsAt.toISOString()
          : null,
        isTrial: subscription.isTrial,
        trialEndsAtIso: subscription.trialEndsAt
          ? subscription.trialEndsAt.toISOString()
          : null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      entitlements,
      aiCreditBalance,
      aiUsageHistory: aiUsageHistory.map((usage) => ({
        periodStart: usage.periodStart,
        usedCredits: usage.usedCredits,
        lastConsumedAtIso: usage.lastConsumedAt
          ? usage.lastConsumedAt.toISOString()
          : null,
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        provider: invoice.provider,
        providerInvoiceId: invoice.providerInvoiceId || null,
        status: invoice.status,
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        periodStartIso: invoice.periodStart.toISOString(),
        periodEndIso: invoice.periodEnd.toISOString(),
        dueAtIso: invoice.dueAt ? invoice.dueAt.toISOString() : null,
        paidAtIso: invoice.paidAt ? invoice.paidAt.toISOString() : null,
        createdAtIso: invoice.createdAt.toISOString(),
      })),
      retentionPolicy,
    };

    return {
      generatedAtIso: generatedAt.toISOString(),
      dataJson: JSON.stringify(payload),
    };
  }

  async purgeExpiredBillingData(
    input: {
      webhookRetentionDays?: number;
      aiUsageRetentionMonths?: number;
    } = {},
  ): Promise<BillingRetentionPurgeResponse> {
    const policy = this.resolveRetentionPolicy();
    const webhookRetentionDays = this.resolveBoundedInteger({
      value: input.webhookRetentionDays,
      fallback: policy.webhookRetentionDays,
      min: 7,
      max: 3650,
    });
    const aiUsageRetentionMonths = this.resolveBoundedInteger({
      value: input.aiUsageRetentionMonths,
      fallback: policy.aiUsageRetentionMonths,
      min: 1,
      max: 120,
    });

    const now = new Date();
    const webhookCutoffDate = new Date(
      now.getTime() - webhookRetentionDays * 24 * 60 * 60 * 1000,
    );
    const aiUsageCutoffDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - aiUsageRetentionMonths,
        1,
      ),
    );
    const aiUsageCutoffIso = aiUsageCutoffDate.toISOString().slice(0, 10);

    const webhookDelete = await this.billingWebhookEventRepo
      .createQueryBuilder()
      .delete()
      .from(BillingWebhookEvent)
      .where('"createdAt" < :cutoff', {
        cutoff: webhookCutoffDate.toISOString(),
      })
      .andWhere('"status" IN (:...statuses)', {
        statuses: ['processed', 'failed'],
      })
      .execute();

    const aiUsageDelete = await this.userAiCreditUsageRepo
      .createQueryBuilder()
      .delete()
      .from(UserAiCreditUsage)
      .where('"periodStart" < :cutoff', { cutoff: aiUsageCutoffIso })
      .execute();

    const webhookEventsDeleted = Number(webhookDelete.affected || 0);
    const aiUsageRowsDeleted = Number(aiUsageDelete.affected || 0);
    const executedAtIso = now.toISOString();

    this.logger.log(
      `billing-service: retention purge webhookDeleted=${webhookEventsDeleted} aiUsageDeleted=${aiUsageRowsDeleted} webhookDays=${webhookRetentionDays} aiUsageMonths=${aiUsageRetentionMonths}`,
    );

    return {
      webhookEventsDeleted,
      aiUsageRowsDeleted,
      webhookRetentionDays,
      aiUsageRetentionMonths,
      executedAtIso,
    };
  }

  async startPlanTrial(
    userId: string,
    planCode: string,
    trialDays?: number,
  ): Promise<UserSubscription> {
    await this.ensureDefaultPlans();
    const normalizedPlanCode = this.normalizePlanCode(planCode);
    if (!normalizedPlanCode) {
      throw new BadRequestException('Plan code is required to start trial');
    }

    const targetPlan = await this.billingPlanRepo.findOne({
      where: { code: normalizedPlanCode, isActive: true },
    });
    if (!targetPlan) {
      throw new NotFoundException(
        `Billing plan '${normalizedPlanCode}' does not exist`,
      );
    }
    if (targetPlan.code === 'FREE') {
      throw new BadRequestException('FREE plan does not support trial mode');
    }

    const boundedTrialDays = Number.isFinite(trialDays)
      ? Math.min(Math.max(Math.floor(trialDays ?? 14), 1), 30)
      : 14;
    const now = new Date();
    const trialEndsAt = new Date(
      now.getTime() + boundedTrialDays * 24 * 60 * 60 * 1000,
    );

    const subscription = await this.getMySubscription(userId);
    if (
      subscription.isTrial &&
      subscription.trialEndsAt &&
      subscription.trialEndsAt.getTime() > now.getTime()
    ) {
      throw new BadRequestException(
        'An active trial already exists for this subscription',
      );
    }

    subscription.planCode = targetPlan.code;
    subscription.status = 'active';
    subscription.startedAt = now;
    subscription.endsAt = null;
    subscription.cancelAtPeriodEnd = false;
    subscription.isTrial = true;
    subscription.trialEndsAt = trialEndsAt;

    const savedSubscription =
      await this.userSubscriptionRepo.save(subscription);
    const trialMessage = [
      `Started ${targetPlan.code} trial`,
      `until ${trialEndsAt.toISOString()}.`,
    ].join(' ');

    await this.notificationEventBus.publishSafely({
      userId,
      type: 'BILLING_TRIAL_STARTED',
      title: 'Plan trial started',
      message: trialMessage,
      metadata: {
        planCode: targetPlan.code,
        trialDays: boundedTrialDays,
        trialEndsAt: trialEndsAt.toISOString(),
      },
    });

    this.logger.log(
      `billing-service: started trial userId=${userId} plan=${targetPlan.code} days=${boundedTrialDays}`,
    );
    return savedSubscription;
  }

  private normalizeWebhookEventType(eventType: string): string {
    return String(eventType || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
  }

  private async processBillingWebhookEvent(input: {
    provider: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const normalizedEventType = this.normalizeWebhookEventType(input.eventType);
    const supportedEventTypes = new Set([
      'INVOICE_PAID',
      'INVOICE_PAYMENT_FAILED',
      'SUBSCRIPTION_CANCELLED',
    ]);
    if (!supportedEventTypes.has(normalizedEventType)) {
      this.logger.log(
        `billing-service: webhook ignored provider=${input.provider} eventType=${normalizedEventType}`,
      );
      return;
    }

    const payload = input.payload;
    const userId = this.toSafeString(payload.userId);

    if (!userId) {
      throw new BadRequestException(
        'Billing webhook payload must include string userId',
      );
    }

    const planCode = this.normalizePlanCode(
      this.toSafeString(payload.planCode) || '',
    );
    const normalizedPlanCode = planCode || 'FREE';
    const amountCents = Math.max(0, this.toSafeNumber(payload.amountCents, 0));
    const currency =
      this.toSafeString(payload.currency)?.toUpperCase().slice(0, 10) || 'USD';
    const providerInvoiceId =
      this.toSafeString(payload.providerInvoiceId) ||
      this.toSafeString(payload.invoiceId);
    const subscription = await this.getMySubscription(userId);

    if (normalizedEventType === 'INVOICE_PAID') {
      await this.createInvoice({
        userId,
        subscriptionId: subscription.id,
        planCode: normalizedPlanCode,
        provider: input.provider,
        providerInvoiceId: providerInvoiceId || null,
        status: 'paid',
        amountCents,
        currency,
        metadata: payload,
      });
      subscription.status = 'active';
      subscription.cancelAtPeriodEnd = false;
      subscription.endsAt = null;
      subscription.isTrial = false;
      subscription.trialEndsAt = null;
      subscription.planCode = normalizedPlanCode;
      await this.userSubscriptionRepo.save(subscription);
      return;
    }

    if (normalizedEventType === 'INVOICE_PAYMENT_FAILED') {
      await this.createInvoice({
        userId,
        subscriptionId: subscription.id,
        planCode: normalizedPlanCode,
        provider: input.provider,
        providerInvoiceId: providerInvoiceId || null,
        status: 'failed',
        amountCents,
        currency,
        metadata: payload,
      });
      subscription.cancelAtPeriodEnd = true;
      subscription.metadata = {
        ...(subscription.metadata || {}),
        lastPaymentFailureAtIso: new Date().toISOString(),
      };
      await this.userSubscriptionRepo.save(subscription);
      return;
    }

    if (normalizedEventType === 'SUBSCRIPTION_CANCELLED') {
      subscription.status = 'canceled';
      subscription.endsAt = new Date();
      subscription.cancelAtPeriodEnd = false;
      await this.userSubscriptionRepo.save(subscription);
    }
  }

  async ingestBillingWebhook(input: {
    provider: string;
    eventType: string;
    externalEventId: string;
    payloadJson?: string;
  }): Promise<BillingWebhookEvent> {
    const provider = this.toSafeString(input.provider)?.toUpperCase();
    const eventType = this.toSafeString(input.eventType);
    const externalEventId = this.toSafeString(input.externalEventId);

    if (!provider) {
      throw new BadRequestException('Webhook provider is required');
    }
    if (!eventType) {
      throw new BadRequestException('Webhook event type is required');
    }
    if (!externalEventId) {
      throw new BadRequestException('Webhook externalEventId is required');
    }

    const existingEvent = await this.billingWebhookEventRepo.findOne({
      where: { provider, externalEventId },
    });
    if (existingEvent) return existingEvent;

    const payload = this.safeJsonParse(input.payloadJson);
    let event = this.billingWebhookEventRepo.create({
      provider,
      eventType,
      externalEventId,
      status: 'received',
      payload: payload || null,
      processedAt: null,
      errorMessage: null,
    });
    event = await this.billingWebhookEventRepo.save(event);

    try {
      await this.processBillingWebhookEvent({
        provider,
        eventType,
        payload: payload || {},
      });
      event.status = 'processed';
      event.processedAt = new Date();
      event.errorMessage = null;
    } catch (error) {
      event.status = 'failed';
      event.processedAt = new Date();
      event.errorMessage = this.trimErrorMessage(
        error,
        'Billing webhook processing failed',
      );
      this.logger.warn(
        `billing-service: webhook processing failed provider=${provider} eventType=${eventType} externalEventId=${externalEventId} error=${event.errorMessage}`,
      );
    }

    return this.billingWebhookEventRepo.save(event);
  }

  async requestUpgradeIntent(
    userId: string,
    targetPlanCode: string,
    note?: string,
  ): Promise<BillingUpgradeIntentResponse> {
    await this.ensureDefaultPlans();
    const normalizedTargetPlanCode = String(targetPlanCode || '')
      .trim()
      .toUpperCase();
    if (!normalizedTargetPlanCode) {
      throw new BadRequestException('Target plan code is required');
    }

    const targetPlan = await this.billingPlanRepo.findOne({
      where: { code: normalizedTargetPlanCode, isActive: true },
    });
    if (!targetPlan) {
      throw new NotFoundException(
        `Billing plan '${normalizedTargetPlanCode}' does not exist`,
      );
    }

    const subscription = await this.getMySubscription(userId);
    if (subscription.planCode === normalizedTargetPlanCode) {
      return {
        success: true,
        targetPlanCode: normalizedTargetPlanCode,
        message: `You are already on the ${normalizedTargetPlanCode} plan.`,
      };
    }

    const normalizedNote = String(note || '').trim();
    const noteSuffix = normalizedNote ? ` Note: ${normalizedNote}` : '';

    await this.notificationEventBus.publishSafely({
      userId,
      type: 'BILLING_UPGRADE_INTENT',
      title: 'Plan upgrade requested',
      message: `Requested upgrade from ${subscription.planCode} to ${normalizedTargetPlanCode}.${noteSuffix}`,
      metadata: {
        currentPlanCode: subscription.planCode,
        targetPlanCode: normalizedTargetPlanCode,
        note: normalizedNote || undefined,
      },
    });

    this.logger.log(
      `billing-service: recorded upgrade intent userId=${userId} from=${subscription.planCode} to=${normalizedTargetPlanCode}`,
    );

    return {
      success: true,
      targetPlanCode: normalizedTargetPlanCode,
      message:
        'Upgrade intent recorded. A billing workflow can process this request.',
    };
  }
}
