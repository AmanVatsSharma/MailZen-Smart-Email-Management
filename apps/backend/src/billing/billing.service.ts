import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../notification/notification.service';
import { BillingPlan } from './entities/billing-plan.entity';
import { BillingUpgradeIntentResponse } from './dto/billing-upgrade-intent.response';
import { UserSubscription } from './entities/user-subscription.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingPlan)
    private readonly billingPlanRepo: Repository<BillingPlan>,
    @InjectRepository(UserSubscription)
    private readonly userSubscriptionRepo: Repository<UserSubscription>,
    private readonly notificationService: NotificationService,
  ) {}

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
        aiCreditsPerMonth: 50,
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
        aiCreditsPerMonth: 500,
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
        aiCreditsPerMonth: 5000,
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
      cancelAtPeriodEnd: false,
    });
    return this.userSubscriptionRepo.save(created);
  }

  async selectPlan(
    userId: string,
    planCode: string,
  ): Promise<UserSubscription> {
    await this.ensureDefaultPlans();
    const normalizedPlanCode = String(planCode || '')
      .trim()
      .toUpperCase();
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

    this.logger.log(
      `billing-service: userId=${userId} switching plan ${current.planCode} -> ${normalizedPlanCode}`,
    );
    current.planCode = normalizedPlanCode;
    current.startedAt = new Date();
    current.cancelAtPeriodEnd = false;
    current.status = 'active';
    current.endsAt = null;
    return this.userSubscriptionRepo.save(current);
  }

  async getEntitlements(userId: string): Promise<{
    planCode: string;
    providerLimit: number;
    mailboxLimit: number;
    workspaceLimit: number;
    aiCreditsPerMonth: number;
  }> {
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
      aiCreditsPerMonth: plan.aiCreditsPerMonth,
    };
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

    await this.notificationService.createNotification({
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
