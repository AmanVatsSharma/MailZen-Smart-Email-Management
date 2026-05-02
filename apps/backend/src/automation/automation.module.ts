/**
 * File:        apps/backend/src/automation/automation.module.ts
 * Module:      Automation Engine · NestJS Module
 * Purpose:     Registers all automation-domain providers, TypeORM repositories, Bull queue,
 *              and wires up DI for the automation feature. Imports cross-module dependencies
 *              for action handlers (NotificationModule, EmailModule, AiAgentGatewayModule).
 *
 * Exports:
 *   - AutomationModule  — NestJS module
 *
 * Depends on:
 *   - TypeOrmModule              — 5 automation entities + cross-module entities for actions
 *   - BullModule                 — 'automations' queue for the worker processor
 *   - NotificationModule         — NotificationEventBusService for notify.user action
 *   - EmailModule                — EmailAssignmentService for email.assign action
 *   - AiAgentGatewayModule       — InboxAiService for ai.classify action
 *
 * Side-effects:
 *   - Registers Bull queue "automations" (requires running Redis)
 *
 * Key invariants:
 *   - WorkspaceIntegration registered here for its repository
 *   - WorkspaceMember imported via forFeature for WorkspaceAdminGuard
 *   - AutomationModule imported in AppModule
 *
 * Read order:
 *   1. TypeOrmModule.forFeature — all entities
 *   2. Module imports            — external modules consumed
 *   3. providers / exports
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Automation } from './entities/automation.entity';
import { AutomationVersion } from './entities/automation-version.entity';
import { AutomationRun } from './entities/automation-run.entity';
import { AutomationStepRun } from './entities/automation-step-run.entity';
import { WorkspaceIntegration } from './entities/workspace-integration.entity';
import { AutomationEventBus } from './automation-event.bus';
import { AutomationDispatcherService } from './automation-dispatcher.service';
import { AutomationWorkerProcessor, AUTOMATION_ACTION_HANDLERS } from './automation-worker.processor';
import { AutomationService } from './automation.service';
import { AutomationResolver, AutomationRunResolver } from './automation.resolver';
import { WorkspaceAdminGuard } from './guards/workspace-admin.guard';
import { EmailReceivedTriggerHandler } from './triggers/email-received.trigger';
import { ManualTriggerHandler } from './triggers/manual.trigger';
import { EmailLabelAddActionHandler, EmailLabelRemoveActionHandler } from './actions/email-label.action';
import { EmailArchiveActionHandler } from './actions/email-archive.action';
import { EmailAssignActionHandler } from './actions/email-assign.action';
import { NotifyUserActionHandler } from './actions/notify-user.action';
import { AiClassifyActionHandler } from './actions/ai-classify.action';
// Cross-module entities for action handlers and dispatcher
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { EmailLabel } from '../email/entities/email-label.entity';
import { EmailLabelAssignment } from '../email/entities/email-label-assignment.entity';
import { Email } from '../email/entities/email.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../email/email.module';
import { AiAgentGatewayModule } from '../ai-agent-gateway/ai-agent-gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Automation,
      AutomationVersion,
      AutomationRun,
      AutomationStepRun,
      WorkspaceIntegration,
      Workspace,
      WorkspaceMember,
      EmailLabel,
      EmailLabelAssignment,
      Email,
      ExternalEmailMessage,
      AuditLog,
    ]),
    BullModule.registerQueue({
      name: 'automations',
    }),
    NotificationModule,
    EmailModule,
    AiAgentGatewayModule,
  ],
  providers: [
    AutomationEventBus,
    AutomationDispatcherService,
    AutomationWorkerProcessor,
    AutomationService,
    AutomationResolver,
    AutomationRunResolver,
    WorkspaceAdminGuard,
    EmailReceivedTriggerHandler,
    ManualTriggerHandler,
    EmailLabelAddActionHandler,
    EmailLabelRemoveActionHandler,
    EmailArchiveActionHandler,
    EmailAssignActionHandler,
    NotifyUserActionHandler,
    AiClassifyActionHandler,
    {
      provide: AUTOMATION_ACTION_HANDLERS,
      useFactory: (
        labelAdd: EmailLabelAddActionHandler,
        labelRemove: EmailLabelRemoveActionHandler,
        archive: EmailArchiveActionHandler,
        assign: EmailAssignActionHandler,
        notify: NotifyUserActionHandler,
        aiClassify: AiClassifyActionHandler,
      ) => [labelAdd, labelRemove, archive, assign, notify, aiClassify],
      inject: [
        EmailLabelAddActionHandler,
        EmailLabelRemoveActionHandler,
        EmailArchiveActionHandler,
        EmailAssignActionHandler,
        NotifyUserActionHandler,
        AiClassifyActionHandler,
      ],
    },
  ],
  exports: [
    AutomationEventBus,
    WorkspaceAdminGuard,
  ],
})
export class AutomationModule {}
