// apps/backend/src/composition/modules/automation.module.ts
// Composition for the automation bounded context.
// Wires the AUTOMATION_REPOSITORY port to the TypeOrm adapter and registers
// the use-case handlers. Each use case lives under core/application/use-cases/automation/<action>/.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AutomationOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/automation.orm-entity';
import { AutomationRunOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/automation-run.orm-entity';
import { TypeOrmAutomationRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-automation.repository';
import { TypeOrmAutomationRunRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-automation-run.repository';
import { AUTOMATION_REPOSITORY } from '../../core/application/ports/repositories/automation.repository';
import { AUTOMATION_RUN_REPOSITORY } from '../../core/application/ports/repositories/automation-run.repository';
import { EVENT_BUS } from '../../core/application/ports/event-bus/event-bus';
import { JOB_QUEUE } from '../../core/application/ports/queue/job-queue';
import { BullJobQueue } from '../../core/infrastructure/queues/bull/bull-job-queue';
import { InProcessEventBus } from '../../interfaces/event-bus/in-process-event-bus';
import { CreateAutomationHandler } from '../../core/application/use-cases/automation/create-automation/create-automation.handler';
import { UpdateAutomationHandler } from '../../core/application/use-cases/automation/update-automation/update-automation.handler';
import { PublishAutomationHandler } from '../../core/application/use-cases/automation/publish-automation/publish-automation.handler';
import { ArchiveAutomationHandler } from '../../core/application/use-cases/automation/archive-automation/archive-automation.handler';
import { ListAutomationsHandler } from '../../core/application/use-cases/automation/list-automations/list-automations.handler';
import { GetAutomationHandler } from '../../core/application/use-cases/automation/get-automation/get-automation.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutomationOrmEntity, AutomationRunOrmEntity]),
    BullModule.registerQueue({ name: 'automation' }),
  ],
  providers: [
    { provide: AUTOMATION_REPOSITORY, useClass: TypeOrmAutomationRepository },
    { provide: AUTOMATION_RUN_REPOSITORY, useClass: TypeOrmAutomationRunRepository },
    { provide: EVENT_BUS, useClass: InProcessEventBus },
    { provide: JOB_QUEUE, useClass: BullJobQueue },
    CreateAutomationHandler,
    UpdateAutomationHandler,
    PublishAutomationHandler,
    ArchiveAutomationHandler,
    ListAutomationsHandler,
    GetAutomationHandler,
  ],
  exports: [
    AUTOMATION_REPOSITORY,
    AUTOMATION_RUN_REPOSITORY,
    EVENT_BUS,
    JOB_QUEUE,
    TypeOrmModule,
  ],
})
export class AutomationModule {}
