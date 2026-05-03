# Automation Engine

Workspace-scoped "when X happens, do Y" engine for MailZen. Triggers fire from email
sync events, assignments, labels, cron schedules, or manual invocations. Conditions
filter which automations apply. Steps execute sequentially via a Bull queue worker.

---

## Architecture

```
gmail-sync / outlook-sync       AutomationEventBus        AutomationDispatcher
         │                        (RxJS Subject)                    │
         │  email.received ──────▶ publish()  ◀─────────────────────│
         │                                                           │
         │                                             ┌────────────▼────────────┐
         │                                             │  1. Kill switch check   │
         │                                             │  2. Find ENABLED autos  │
         │                                             │  3. Evaluate conditions │
         │                                             │  4. Create Run (QUEUED) │
         │                                             │  5. Enqueue Bull job    │
         │                                             └────────────┬────────────┘
         │                                                          │
         │                                          "automations" Bull queue (Redis)
         │                                                          │
         │                                             ┌────────────▼────────────┐
         │                                             │  AutomationWorker       │
         │                                             │  - Load version + steps │
         │                                             │  - Cancel check / step  │
         │                                             │  - Execute via handler  │
         │                                             │  - Persist StepRun row  │
         │                                             │  - Retry (max 3, exp)   │
         │                                             │  - Mark run terminal    │
         │                                             └─────────────────────────┘
```

**Key files:**

| File | Role |
|------|------|
| `automation-event.bus.ts` | In-process pub/sub (RxJS Subject) |
| `automation-dispatcher.service.ts` | Event → Run → Bull job |
| `automation-worker.processor.ts` | Bull processor; executes steps |
| `automation.service.ts` | CRUD + lifecycle mutations |
| `automation.resolver.ts` | GraphQL queries + mutations |
| `condition-evaluator.ts` | Pure boolean tree evaluator |

---

## Adding a New Trigger

1. **Implement `TriggerHandler`** in `triggers/<name>.trigger.ts`:
   ```typescript
   @Injectable()
   export class MyTriggerHandler implements TriggerHandler {
     readonly triggerType = 'my.trigger' as const;
     canHandle(trigger: AutomationTrigger): boolean { return trigger.type === 'my.trigger'; }
     normalize(ctx: TriggerContext): AutomationEvent | null { /* ... */ }
   }
   ```

2. **Add the trigger type** to `AutomationTriggerType` in `libs/shared-types/src/automation.types.ts`.

3. **Register the handler** in `automation.module.ts` providers.

4. **Wire the event source** — wherever the trigger fires (e.g., a service), inject
   `AutomationEventBus` and call `automationEventBus.publish({ type: 'my.trigger', ... })`.

5. **Add AJV schema** for the new trigger type in `libs/shared-types/src/automation.schemas.ts`.

---

## Adding a New Action

1. **Implement `ActionHandler`** in `actions/<name>.action.ts`:
   ```typescript
   @Injectable()
   export class MyActionHandler implements ActionHandler {
     readonly actionType = 'my.action' as const;
     async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
       // ... perform action
       return { data: { result: 'ok' } };
     }
   }
   ```

2. **Add the action type** to `AutomationActionType` + step config in `automation.types.ts`.

3. **Register the handler** in `automation.module.ts` providers **and** in the
   `AUTOMATION_ACTION_HANDLERS` factory's `useFactory` + `inject` arrays.

4. **Add AJV schema** for the step type to `STEPS_SCHEMA` in `automation.schemas.ts`.

---

## Invariants (do not break)

- **AutomationVersion is immutable.** `updateAutomation` creates a new version row — never
  updates an existing one after `publishedAt` is set.
- **Migrated EmailFilter automations enter as `DISABLED`.**
- **workspaceId enforced on every DB query** — cross-tenant leakage is a P0 incident.
- **AI action steps emit `creditsConsumed`** in their `ActionResult.output`.
- **schema.gql is auto-generated** — never edit it directly.

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_HOST` | `localhost` | Bull queue Redis host |
| `REDIS_PORT` | `6379` | Bull queue Redis port |
| `AUTOMATION_LOOP_THRESHOLD` | `10` | Loop detection: max runs per 60 s |

---

## GraphQL examples

```graphql
# Create a "boss@ → label urgent + notify" automation
mutation {
  createAutomation(
    workspaceId: "ws-123"
    name: "Boss emails → urgent"
    trigger: { type: "email.received" }
    conditions: { all: [{ field: "from", op: "contains", value: "boss@" }] }
    steps: [
      { type: "email.label.add", labelName: "urgent", createIfMissing: true }
      { type: "notify.user", title: "Boss emailed you", message: "Check inbox" }
    ]
  ) { id status }
}

# List runs for one automation
query {
  automationRuns(automationId: "auto-456", limit: 20) {
    nodes { id status correlationId createdAt }
    nextCursor
  }
}
```
