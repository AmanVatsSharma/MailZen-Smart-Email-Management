// apps/backend/src/composition/modules/billing.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/plan.orm-entity';
import { SubscriptionOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/subscription.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlanOrmEntity, SubscriptionOrmEntity])],
  exports: [TypeOrmModule],
})
export class BillingModule {}
