import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notification/notification.module';
import { BillingResolver } from './billing.resolver';
import { BillingService } from './billing.service';
import { BillingPlan } from './entities/billing-plan.entity';
import { UserSubscription } from './entities/user-subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingPlan, UserSubscription]),
    NotificationModule,
  ],
  providers: [BillingService, BillingResolver],
  exports: [BillingService],
})
export class BillingModule {}
