// apps/backend/src/composition/modules/automation.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AutomationOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/automation.orm-entity';
import { AutomationRunOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/automation-run.orm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutomationOrmEntity, AutomationRunOrmEntity]),
    BullModule.registerQueue({ name: 'automation' }),
  ],
  exports: [TypeOrmModule, BullModule],
})
export class AutomationModule {}
