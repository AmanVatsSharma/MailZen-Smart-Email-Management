/**
 * File:        apps/backend/src/automation/automation.module.ts
 * Module:      Automation Engine · NestJS Module
 * Purpose:     Registers all automation-domain providers, TypeORM repositories, Bull queue,
 *              and wires up DI for the automation feature. This module scaffold satisfies
 *              T-MOD; providers and exports will grow as subsequent tasks are implemented.
 *
 * Exports:
 *   - AutomationModule  — NestJS module
 *
 * Depends on:
 *   - TypeOrmModule       — registers 5 automation entities for repository injection
 *   - BullModule          — registers 'automations' queue for the worker processor
 *   - WorkspaceModule     — exposes WorkspaceMember repository (for WorkspaceAdminGuard)
 *
 * Side-effects:
 *   - Registers Bull queue "automations" (requires running Redis)
 *   - TypeORM auto-discovers entities for migration generation
 *
 * Key invariants:
 *   - WorkspaceIntegration registered here so its repository is injectable
 *   - AutomationModule imported in AppModule for NestJS to bootstrap it
 *
 * Read order:
 *   1. TypeOrmModule.forFeature — all entities owned by this module
 *   2. Module imports            — external modules consumed
 *   3. providers / exports       — services and resolvers (grows with subsequent tasks)
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Automation,
      AutomationVersion,
      AutomationRun,
      AutomationStepRun,
      WorkspaceIntegration,
    ]),
    BullModule.registerQueue({
      name: 'automations',
    }),
  ],
  providers: [AutomationEventBus],
  exports: [AutomationEventBus],
})
export class AutomationModule {}
