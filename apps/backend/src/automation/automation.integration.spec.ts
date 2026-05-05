/**
 * File:        apps/backend/src/automation/automation.integration.spec.ts
 * Module:      Automation Engine · Integration Tests
 * Purpose:     End-to-end integration tests for the automation pipeline.
 *              Tests the full flow: event publish → dispatcher → Bull job → worker processor.
 *              Uses NestJS TestingModule with mocked repositories and Bull queue
 *              (ioredis-mock is not installed; Bull queue is mocked in-process).
 *
 * Exports:
 *   - (test suite only)
 *
 * Depends on:
 *   - AutomationEventBus              — event pub/sub
 *   - AutomationDispatcherService     — event → run row + Bull job
 *   - AutomationWorkerProcessor       — Bull job → step execution
 *   - AutomationRateLimiterService    — per-action limits
 *
 * Side-effects:
 *   - none (all external services mocked)
 *
 * Key invariants:
 *   - All TypeORM repositories are replaced with jest mocks
 *   - Bull queue is replaced with a mock that captures add() calls
 *   - Worker processRun() is called directly (bypasses Bull worker polling)
 *   - BillingService.consumeAiCredits is mocked as fire-and-forget
 *
 * Read order:
 *   1. buildModule()                  — shared TestingModule factory
 *   2. AutomationDispatcherService tests
 *   3. AutomationWorkerProcessor tests
 *   4. Full pipeline integration test
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { AutomationEventBus } from './automation-event.bus';
import { AutomationDispatcherService } from './automation-dispatcher.service';
import {
  AutomationWorkerProcessor,
  AUTOMATION_ACTION_HANDLERS,
} from './automation-worker.processor';
import { AutomationRateLimiterService } from './automation-rate-limiter.service';
import { AutomationRun, AutomationRunStatus } from './entities/automation-run.entity';
import { AutomationVersion } from './entities/automation-version.entity';
import { Automation, AutomationStatus } from './entities/automation.entity';
import { AutomationStepRun, AutomationStepRunStatus } from './entities/automation-step-run.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { BillingService } from '../billing/billing.service';
import { ActionHandler, ActionResult } from './actions/action.interface';
import { AutomationEvent, AutomationStep } from '@mailzen/shared-types';
import { resolveCorrelationId } from '../common/logging/structured-log.util';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-test-001';
const USER_ID = 'user-test-001';
const AUTOMATION_ID = 'auto-test-001';
const VERSION_ID = 'ver-test-001';
const RUN_ID = 'run-test-001';
const CORRELATION_ID = resolveCorrelationId(undefined);

const mockAutomation: Automation = {
  id: AUTOMATION_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Test Automation',
  status: AutomationStatus.ENABLED,
  currentVersionId: VERSION_ID,
  createdByUserId: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Automation;

const mockVersion = {
  id: VERSION_ID,
  automationId: AUTOMATION_ID,
  version: 1,
  trigger: { type: 'email.received' },
  conditions: null,
  steps: [
    { type: 'email.label.add', labelId: 'label-urgent' } as AutomationStep,
    { type: 'notify.user', targetUserId: USER_ID, title: 'Urgent!', message: 'New email' } as AutomationStep,
  ],
  publishedAt: new Date(),
  publishedByUserId: USER_ID,
} as unknown as AutomationVersion;

const mockRun: AutomationRun = {
  id: RUN_ID,
  automationId: AUTOMATION_ID,
  automationVersionId: VERSION_ID,
  workspaceId: WORKSPACE_ID,
  status: AutomationRunStatus.QUEUED,
  triggerEvent: { type: 'email.received', workspaceId: WORKSPACE_ID, userId: USER_ID } as unknown as Record<string, unknown>,
  correlationId: CORRELATION_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
} as AutomationRun;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A stub action handler that always succeeds */
function makeStubHandler(actionType: string, extraOutput: Partial<ActionResult> = {}): ActionHandler {
  return {
    actionType: actionType as never,
    execute: jest.fn().mockResolvedValue({ data: { done: true }, ...extraOutput }),
  };
}

// ─── Dispatcher tests ────────────────────────────────────────────────────────

describe('AutomationDispatcherService', () => {
  let dispatcher: AutomationDispatcherService;
  let bus: AutomationEventBus;
  let queueAddMock: jest.Mock;
  let runRepoSaveMock: jest.Mock;
  let runRepoCountMock: jest.Mock;

  beforeEach(async () => {
    queueAddMock = jest.fn().mockResolvedValue({ id: 'job-1' });
    runRepoSaveMock = jest.fn().mockImplementation((entity: unknown) =>
      Promise.resolve({ ...mockRun, ...(entity as object) }),
    );
    runRepoCountMock = jest.fn().mockResolvedValue(0);

    const redisPipelineMock = {
      zadd: jest.fn().mockReturnThis(),
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1], [null, 0], [null, 1], [null, 1]]),
    };

    const queueMock = {
      add: queueAddMock,
      client: Promise.resolve({ pipeline: () => redisPipelineMock }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationEventBus,
        AutomationDispatcherService,
        { provide: getQueueToken('automations'), useValue: queueMock },
        {
          provide: getRepositoryToken(Automation),
          useValue: {
            find: jest.fn().mockResolvedValue([mockAutomation]),
          },
        },
        {
          provide: getRepositoryToken(AutomationVersion),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockVersion),
          },
        },
        {
          provide: getRepositoryToken(AutomationRun),
          useValue: {
            count: runRepoCountMock,
            create: jest.fn().mockImplementation((v: unknown) => v),
            save: runRepoSaveMock,
          },
        },
        {
          provide: getRepositoryToken(Workspace),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: WORKSPACE_ID,
              automationsEnabled: true,
              automationConcurrencyCap: 20,
            }),
          },
        },
      ],
    }).compile();

    dispatcher = module.get(AutomationDispatcherService);
    bus = module.get(AutomationEventBus);
    dispatcher.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a QUEUED run and enqueues a Bull job when event matches', async () => {
    const event: AutomationEvent = {
      type: 'email.received',
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      correlationId: CORRELATION_ID,
    } as AutomationEvent;

    bus.publish(event);
    // Give the async handler time to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(runRepoSaveMock).toHaveBeenCalledTimes(1);
    const savedRun = runRepoSaveMock.mock.calls[0][0] as Partial<AutomationRun>;
    expect(savedRun.status).toBe(AutomationRunStatus.QUEUED);
    expect(savedRun.workspaceId).toBe(WORKSPACE_ID);

    expect(queueAddMock).toHaveBeenCalledTimes(1);
    expect(queueAddMock.mock.calls[0][0]).toBe('execute-run');
  });

  it('does not enqueue when automations_enabled is false (kill switch)', async () => {
    // Force re-create module with kill switch active
    const module2: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationEventBus,
        AutomationDispatcherService,
        { provide: getQueueToken('automations'), useValue: { add: queueAddMock, client: Promise.resolve({ pipeline: () => ({}) }) } },
        { provide: getRepositoryToken(Automation), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(AutomationVersion), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(AutomationRun),
          useValue: { count: jest.fn().mockResolvedValue(0), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Workspace),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: WORKSPACE_ID,
              automationsEnabled: false,
              automationConcurrencyCap: 20,
            }),
          },
        },
      ],
    }).compile();
    const dispatcher2 = module2.get(AutomationDispatcherService);
    const bus2 = module2.get(AutomationEventBus);
    dispatcher2.onModuleInit();

    bus2.publish({ type: 'email.received', workspaceId: WORKSPACE_ID, userId: USER_ID } as AutomationEvent);
    await new Promise((r) => setTimeout(r, 50));

    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('creates a SKIPPED_CONDITIONS run and does not enqueue when conditions fail', async () => {
    // Version with conditions that will always evaluate to false
    const versionWithConditions: AutomationVersion = {
      ...mockVersion,
      conditions: { all: [{ field: 'event.type', op: 'equals', value: 'nonexistent.type' }] },
    } as AutomationVersion;

    const module3: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationEventBus,
        AutomationDispatcherService,
        { provide: getQueueToken('automations'), useValue: { add: queueAddMock, client: Promise.resolve({ pipeline: () => ({ zadd: jest.fn().mockReturnThis(), zremrangebyscore: jest.fn().mockReturnThis(), zcard: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([[null,1],[null,0],[null,1],[null,1]]) }) }) } },
        { provide: getRepositoryToken(Automation), useValue: { find: jest.fn().mockResolvedValue([mockAutomation]) } },
        { provide: getRepositoryToken(AutomationVersion), useValue: { findOne: jest.fn().mockResolvedValue(versionWithConditions) } },
        {
          provide: getRepositoryToken(AutomationRun),
          useValue: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockImplementation((v: unknown) => v), save: runRepoSaveMock },
        },
        { provide: getRepositoryToken(Workspace), useValue: { findOne: jest.fn().mockResolvedValue({ id: WORKSPACE_ID, automationsEnabled: true, automationConcurrencyCap: 20 }) } },
      ],
    }).compile();
    const dispatcher3 = module3.get(AutomationDispatcherService);
    const bus3 = module3.get(AutomationEventBus);
    dispatcher3.onModuleInit();

    bus3.publish({ type: 'email.received', workspaceId: WORKSPACE_ID, userId: USER_ID } as AutomationEvent);
    await new Promise((r) => setTimeout(r, 50));

    const savedRun = runRepoSaveMock.mock.calls[0][0] as Partial<AutomationRun>;
    expect(savedRun.status).toBe(AutomationRunStatus.SKIPPED_CONDITIONS);
    expect(queueAddMock).not.toHaveBeenCalled();
  });
});

// ─── Worker Processor tests ──────────────────────────────────────────────────

describe('AutomationWorkerProcessor', () => {
  let processor: AutomationWorkerProcessor;
  let runRepoUpdateMock: jest.Mock;
  let stepRunSaveMock: jest.Mock;
  let stepRunUpdateMock: jest.Mock;
  let labelHandler: ActionHandler;
  let notifyHandler: ActionHandler;

  const makeRunFindOne = (overrides: Partial<AutomationRun> = {}) =>
    jest.fn().mockResolvedValue({ ...mockRun, ...overrides });

  const makeVersionFindOne = (overrides: Partial<AutomationVersion> = {}) =>
    jest.fn().mockResolvedValue({ ...mockVersion, ...overrides });

  const makeStepRunSave = () =>
    jest.fn().mockImplementation((entity: unknown) =>
      Promise.resolve({ id: `step-run-${Date.now()}`, ...(entity as object) }),
    );

  async function buildWorkerModule(
    runFindOne: jest.Mock,
    versionFindOne: jest.Mock,
    handlers: ActionHandler[],
  ) {
    stepRunSaveMock = makeStepRunSave();
    stepRunUpdateMock = jest.fn().mockResolvedValue({});
    runRepoUpdateMock = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationWorkerProcessor,
        AutomationRateLimiterService,
        { provide: getQueueToken('automations'), useValue: {} },
        { provide: getRepositoryToken(AutomationRun), useValue: { findOne: runFindOne, update: runRepoUpdateMock } },
        { provide: getRepositoryToken(AutomationVersion), useValue: { findOne: versionFindOne } },
        { provide: getRepositoryToken(AutomationStepRun), useValue: { create: jest.fn().mockImplementation((v: unknown) => v), save: stepRunSaveMock, update: stepRunUpdateMock, delete: jest.fn() } },
        { provide: AUTOMATION_ACTION_HANDLERS, useValue: handlers },
        { provide: BillingService, useValue: { consumeAiCredits: jest.fn().mockResolvedValue({ allowed: true, usedCredits: 1, monthlyLimit: 100 }) } },
      ],
    }).compile();

    processor = module.get(AutomationWorkerProcessor);
  }

  beforeEach(() => {
    labelHandler = makeStubHandler('email.label.add');
    notifyHandler = makeStubHandler('notify.user');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('happy path: 2-step run succeeds — both steps SUCCEEDED, run marked SUCCEEDED', async () => {
    await buildWorkerModule(
      makeRunFindOne(),
      makeVersionFindOne(),
      [labelHandler, notifyHandler],
    );

    await processor.processRun({ data: { runId: RUN_ID } } as never);

    // Run status updated to RUNNING then SUCCEEDED
    expect(runRepoUpdateMock).toHaveBeenCalledWith(RUN_ID, expect.objectContaining({ status: AutomationRunStatus.RUNNING }));
    expect(runRepoUpdateMock).toHaveBeenCalledWith(RUN_ID, expect.objectContaining({ status: AutomationRunStatus.SUCCEEDED }));

    // Both action handlers called once
    expect(labelHandler.execute).toHaveBeenCalledTimes(1);
    expect(notifyHandler.execute).toHaveBeenCalledTimes(1);

    // Step rows saved with SUCCEEDED status
    const savedStatuses = (stepRunSaveMock.mock.calls as Array<[Record<string, unknown>]>)
      .filter((call) => call[0].status === AutomationStepRunStatus.SUCCEEDED)
      .length;
    expect(savedStatuses).toBe(2);
  });

  it('step retry: step 0 fails once then succeeds — run succeeds with attempt=2 on step 0', async () => {
    let callCount = 0;
    const flakyHandler: ActionHandler = {
      actionType: 'email.label.add' as never,
      execute: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Transient error');
        return Promise.resolve({ data: { done: true } });
      }),
    };

    await buildWorkerModule(
      makeRunFindOne(),
      makeVersionFindOne(),
      [flakyHandler, notifyHandler],
    );

    await processor.processRun({ data: { runId: RUN_ID } } as never);

    expect(flakyHandler.execute).toHaveBeenCalledTimes(2);
    expect(runRepoUpdateMock).toHaveBeenCalledWith(RUN_ID, expect.objectContaining({ status: AutomationRunStatus.SUCCEEDED }));
  });

  it('step exhausted: step 0 fails 3 times — run FAILED, step 1 SKIPPED', async () => {
    const alwaysFailHandler: ActionHandler = {
      actionType: 'email.label.add' as never,
      execute: jest.fn().mockRejectedValue(new Error('Permanent failure')),
    };

    // versionFindOne called twice (once for processRun, once for remaining-steps loop)
    await buildWorkerModule(
      makeRunFindOne(),
      makeVersionFindOne(),
      [alwaysFailHandler, notifyHandler],
    );

    await processor.processRun({ data: { runId: RUN_ID } } as never);

    expect(alwaysFailHandler.execute).toHaveBeenCalledTimes(3);
    expect(notifyHandler.execute).not.toHaveBeenCalled();
    expect(runRepoUpdateMock).toHaveBeenCalledWith(RUN_ID, expect.objectContaining({ status: AutomationRunStatus.FAILED }));

    // Step 1 should be saved with SKIPPED status
    const skippedRows = (stepRunSaveMock.mock.calls as Array<[Record<string, unknown>]>)
      .filter((call) => call[0].status === AutomationStepRunStatus.SKIPPED)
      .length;
    expect(skippedRows).toBeGreaterThanOrEqual(1);
  });

  it('cancellation: run CANCELED before step 1 — step 1 not executed', async () => {
    // First call (initial load) returns QUEUED, second call (pre-step check for step 1) returns CANCELED
    let findCallCount = 0;
    const cancellingFindOne = jest.fn().mockImplementation(() => {
      findCallCount++;
      if (findCallCount === 1) return Promise.resolve({ ...mockRun });
      // Step 0 check: still running; after step 0 completes, step 1 check returns CANCELED
      return Promise.resolve({ ...mockRun, status: AutomationRunStatus.CANCELED });
    });

    await buildWorkerModule(
      cancellingFindOne,
      makeVersionFindOne(),
      [labelHandler, notifyHandler],
    );

    await processor.processRun({ data: { runId: RUN_ID } } as never);

    // Step 0 runs (before cancellation check for step 0 returns RUNNING)
    // Then step 1 check sees CANCELED → aborts
    expect(notifyHandler.execute).not.toHaveBeenCalled();
  });

  it('run not found: logs warning and returns without error', async () => {
    await buildWorkerModule(
      jest.fn().mockResolvedValue(null),
      makeVersionFindOne(),
      [labelHandler, notifyHandler],
    );

    await expect(processor.processRun({ data: { runId: 'nonexistent' } } as never)).resolves.not.toThrow();
    expect(runRepoUpdateMock).not.toHaveBeenCalled();
  });

  it('no steps: run immediately marked SUCCEEDED without calling any handler', async () => {
    await buildWorkerModule(
      makeRunFindOne(),
      makeVersionFindOne({ steps: [] }),
      [labelHandler, notifyHandler],
    );

    await processor.processRun({ data: { runId: RUN_ID } } as never);

    expect(labelHandler.execute).not.toHaveBeenCalled();
    expect(runRepoUpdateMock).toHaveBeenCalledWith(RUN_ID, expect.objectContaining({ status: AutomationRunStatus.SUCCEEDED }));
  });
});

// ─── Full pipeline integration test ─────────────────────────────────────────

describe('Automation pipeline: dispatch → worker (integration)', () => {
  it('publishes event → dispatcher creates run → worker processes and succeeds', async () => {
    const jobsQueue: Array<{ runId: string }> = [];
    const runStore: Map<string, Partial<AutomationRun>> = new Map();

    const runRepoMock = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation((entity: unknown) => {
        const run = entity as Partial<AutomationRun>;
        const id = RUN_ID;
        runStore.set(id, { ...mockRun, ...run, id });
        return Promise.resolve({ id, ...run } as AutomationRun);
      }),
      findOne: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(runStore.get(where.id) ?? null),
      ),
      update: jest.fn().mockImplementation((id: string, patch: Partial<AutomationRun>) => {
        const existing = runStore.get(id as string) ?? {};
        runStore.set(id as string, { ...existing, ...(patch as object) });
        return Promise.resolve({});
      }),
    };

    const stepRunRows: Array<Record<string, unknown>> = [];
    const stepRunRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation((entity: unknown) => {
        const row = entity as Record<string, unknown>;
        const rowWithId = { id: `sr-${stepRunRows.length}`, ...row };
        stepRunRows.push(rowWithId);
        return Promise.resolve(rowWithId);
      }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    };

    const redisPipelineMock = {
      zadd: jest.fn().mockReturnThis(),
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1], [null, 0], [null, 1], [null, 1]]),
    };

    const queueMock = {
      add: jest.fn().mockImplementation((_type: string, data: { runId: string }) => {
        jobsQueue.push(data);
        return Promise.resolve({ id: 'job-1' });
      }),
      client: Promise.resolve({ pipeline: () => redisPipelineMock }),
    };

    const labelHandler = makeStubHandler('email.label.add');
    const notifyHandler = makeStubHandler('notify.user');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationEventBus,
        AutomationDispatcherService,
        AutomationWorkerProcessor,
        AutomationRateLimiterService,
        { provide: getQueueToken('automations'), useValue: queueMock },
        { provide: getRepositoryToken(Automation), useValue: { find: jest.fn().mockResolvedValue([mockAutomation]) } },
        { provide: getRepositoryToken(AutomationVersion), useValue: { findOne: jest.fn().mockResolvedValue(mockVersion) } },
        { provide: getRepositoryToken(AutomationRun), useValue: runRepoMock },
        { provide: getRepositoryToken(AutomationStepRun), useValue: stepRunRepoMock },
        { provide: getRepositoryToken(Workspace), useValue: { findOne: jest.fn().mockResolvedValue({ id: WORKSPACE_ID, automationsEnabled: true, automationConcurrencyCap: 20 }) } },
        { provide: AUTOMATION_ACTION_HANDLERS, useValue: [labelHandler, notifyHandler] },
        { provide: BillingService, useValue: { consumeAiCredits: jest.fn().mockResolvedValue({ allowed: true }) } },
      ],
    }).compile();

    const bus = module.get(AutomationEventBus);
    const dispatcher = module.get(AutomationDispatcherService);
    const worker = module.get(AutomationWorkerProcessor);

    dispatcher.onModuleInit();

    // Publish the trigger event
    bus.publish({
      type: 'email.received',
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      correlationId: CORRELATION_ID,
    } as AutomationEvent);

    // Wait for dispatcher to process
    await new Promise((r) => setTimeout(r, 50));

    // Verify dispatcher created a run and enqueued a job
    expect(jobsQueue).toHaveLength(1);
    expect(jobsQueue[0].runId).toBe(RUN_ID);

    // Process the job directly (simulates Bull worker)
    await worker.processRun({ data: jobsQueue[0] } as never);

    // Verify the run ended up SUCCEEDED
    const finalRun = runStore.get(RUN_ID);
    expect(finalRun?.status).toBe(AutomationRunStatus.SUCCEEDED);

    // Verify both step rows were saved as SUCCEEDED
    const succeededSteps = stepRunRows.filter(
      (r) => r.status === AutomationStepRunStatus.SUCCEEDED,
    );
    expect(succeededSteps).toHaveLength(2);

    // Verify both handlers were called with correct context
    expect(labelHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.label.add' }),
      expect.objectContaining({ workspaceId: WORKSPACE_ID, userId: USER_ID }),
    );
    expect(notifyHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notify.user' }),
      expect.objectContaining({ workspaceId: WORKSPACE_ID }),
    );
  });
});
