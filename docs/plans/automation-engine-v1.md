# Automation Engine + Sellable B2B v1 — Master Plan

**Repo:** `/home/amansharma/Desktop/workspace/MailZen-Smart-Email-Management`
**Drafted:** 2026-05-01
**Owner:** Aman
**Status:** Ready for execution

---

## 0. AGENT HANDOFF GUIDE — READ FIRST

> **You are picking up multi-session work. This section is your onboarding. After reading it, run `bd ready --json` and start.**

### 0.1 Where work is tracked

- **Issue tracker:** `bd` (beads) v1.0.3 — already installed at `/home/amansharma/.local/bin/bd`.
- **Issue ID format:** `MailZen-Smart-Email-Management-<3-char-hash>` (bd derives the prefix from the repo dir name and ignores explicit prefix args). Long but cosmetic — agents use the IDs returned by `bd ready`.
- **Initialization:** `bd init` was run on 2026-05-02; bootstrap script populated 4 epics + 58 tasks. Already complete — do not re-run.

### 0.2 How to start (cold start, never seen this work before)

```bash
cd /home/amansharma/Desktop/workspace/MailZen-Smart-Email-Management

# 1. Find unblocked work
bd ready --json

# 2. Pick the highest-priority unblocked task
bd show <id> --long          # title + description + files + reuses + acceptance

# 3. Find the same task in this plan file
#    Tasks in this plan use stable slugs (T-MIG, T-ENT, ...). The beads title
#    starts with the slug, e.g. "[T-MIG] DB migration: 5 automation tables ...".
grep -n "^### T-MIG " /home/amansharma/.claude/plans/go-deeper-on-the-keen-flame.md

# 4. Claim it
bd update <id> --claim --json

# 5. Read the plan section for full spec (files, reuses, acceptance, deps)
#    Then execute. Add notes to beads as you go (they survive compaction):
bd update <id> --add-note "Implemented entity decorators; tests pending" --json

# 6. Close on completion
bd close <id> --reason "All entities created with @ObjectType + jsonb columns; tests pass" --json
```

### 0.3 How to resume (compaction recovery, mid-stream)

```bash
bd list --status in_progress --json   # what you were doing
bd show <id> --long                    # rehydrate context
# Then continue from notes
```

### 0.4 Where to find what

| You need… | Look in… |
|---|---|
| The strategic "why" | §1 Context |
| Hard rules you must not break | §2 Architecture Invariants |
| The full task list with IDs and dependencies | §4 Task Graph |
| Data model fields + types | §A Reference: Data Model |
| GraphQL types + inputs + queries + mutations | §B Reference: GraphQL Contract |
| How runs actually execute end-to-end | §C Reference: Execution Architecture |
| Existing primitives to reuse (with `file:line`) | §D Reference: Reuse Map |
| Full file create / modify list | §E Reference: Files |
| Verification gate checklists | §5 Verification Gates |

### 0.5 Coding conventions you MUST follow

These are confirmed by reading the codebase, not guesses. Match them exactly.

| Concern | Convention | Confirmed at |
|---|---|---|
| Entity decorator | `@Entity('snake_case_table')` + `@ObjectType()` + per-field `@Field(...)` | `workspace.entity.ts:12-13`, `user-notification.entity.ts:13-14`, `scheduled-email.entity.ts:12-13` |
| Primary key | `@PrimaryGeneratedColumn('uuid')` | All entities |
| Timestamps | `@CreateDateColumn()` + `@UpdateDateColumn()` (no shared base class) | All entities |
| JSON columns | `@Column({ type: 'jsonb', nullable: true })` + `@Field(() => GraphQLJSON, { nullable: true })` from `graphql-type-json` | `user-notification.entity.ts:45` |
| Logger | `new Logger(ServiceName.name)` + `serializeStructuredLog({ event, ... })` for all logs | `notification-event-bus.service.ts:16,30`, `inbox-triage.service.ts:29,108` |
| No `console.*` | Project enforces via `npm run check:no-console-usage`. Use Logger. | `apps/backend/package.json:25` |
| Resolver auth | `@UseGuards(JwtAuthGuard)` at class level (preferred) | `scheduled-email.resolver.ts:17` |
| Resolver context | `@Context() context: { req: { user: { id: string } } }` → `userId = context.req.user.id` | `scheduled-email.resolver.ts:8-14` |
| Mutation input | `@Args('input') input: SomeInput` | `email.email-filter.resolver.ts:23-24` |
| Cron | `@nestjs/schedule` `@Cron('cron string')` on service methods | `inbox-triage.service.ts:201` |
| Bull queue | `@Processor('queueName')` + `@Process('jobType')` + `@InjectQueue('queueName')` | `email.email-scheduler.service.ts:12,17,106` |
| Audit log | Insert row in `AuditLog` (`auth/entities/audit-log.entity.ts`) on every state-changing write | `email.email-filter.service.ts:38-60`, `scheduled-email.service.ts:20-42` |
| Correlation IDs | `resolveCorrelationId(undefined)` → propagate through structured logs | `inbox-triage.service.ts:205`, `common/logging/structured-log.util.ts:116` |
| Secret encryption | `encryptProviderSecret(plaintext, keyring)` / `decryptProviderSecret(ct, keyring)` | `common/provider-secrets.util.ts:132,168` |
| Migration files | `apps/backend/src/database/migrations/<unix-ts>-name.ts` — generate via `npm run migration:generate -- --name=Name` (run from `apps/backend/`) | `apps/backend/package.json:14` |
| Test files | `*.spec.ts` co-located next to source. Mock pattern: `{ provide: ServiceName, useValue: { method: jest.fn() } }` | `email-filter.service.spec.ts:54` |

### 0.6 Hard rules (do not violate)

1. **Never write `console.log/.error/.warn`.** Use the Logger + `serializeStructuredLog`. CI fails otherwise.
2. **Never edit `apps/backend/src/schema.gql` by hand.** It is auto-generated. Touch the entity / resolver decorators instead.
3. **Never enable a migrated `EmailFilter` automation by default.** They go in as `DISABLED` (see §2 invariant 2 + §4 T-MIGFILT).
4. **Never run `nx test backend` and declare "tests pass" if you only ran one file.** The CI runs the whole suite and will catch regressions.
5. **Always update beads notes** with what you did and why before closing. Notes survive compaction; chat history doesn't.

---

## 1. Context

MailZen has a B2B-shaped foundation (workspace tenancy, billing, assignments, shared mailboxes — Phase B already shipped) but no spine to coordinate them. We're building a workspace-scoped **automation engine** — "when X happens, do Y" — that turns the existing email + AI + notification primitives into agentic workflows.

This is the wedge for B2B v1: 3-5 design partners paying $25/seat by **2026-08-01** (T+90).

**User-confirmed scope (2026-05-01):**

| Decision | Choice |
|---|---|
| Timeline | 90-day lean MVP for design partners |
| Existing `EmailFilter` | Replace + migrate (one source of truth) |
| Integrations requested | Slack, generic webhook (v1); HubSpot, Linear/Jira (v1.1) |
| Scope model | Workspace-scoped with optional `ownerUserId` for personal automations |

**Why scope was cut from 4 integrations to 2:** A 90-day MVP cannot ship engine + 4 OAuth integrations + dashboard + AI metering + Stripe billing. Generic webhook covers HubSpot/Linear/Jira via Zapier/n8n at ~10% of the engineering cost. HubSpot + Linear move to v1.1 (T+90 → T+120).

---

## 2. Architecture Invariants (do not break these)

These are **must-not-break** rules. Violating any of them silently corrupts production data or destroys the security posture. They are non-negotiable in the absence of a written ADR overriding them.

1. **AutomationVersion is immutable.** Any change to `trigger`, `conditions`, or `steps` creates a new row with `version = max + 1`. Running automations hold a pointer to the version that started them and continue executing it. Never mutate `automation_versions` after `publishedAt`.
2. **Migrated `EmailFilter` rows enter as `DISABLED`.** Existing user filters never auto-fired (verified — `applyFilters` is dead code). Importing them as `ENABLED` retroactively triggers every old rule on every incoming email, including any `FORWARD_TO external@…` row, which becomes a silent data-exfiltration vector. The migrated dashboard shows a "review your migrated automations" banner until each is explicitly enabled or archived.
3. **Workspace tenancy is enforced at the dispatcher.** Every event carries `workspaceId`; every query filters by it. Cross-workspace data leakage is a P0 incident.
4. **AI actions are billed per `ai.*` step, not per run.** Step output records `{ creditsConsumed: N }`. Caps live on plan tier in `billing/`.
5. **Outbound webhooks are HMAC-signed.** `X-MailZen-Signature: sha256=<hex>` header, secret per `workspace_integrations` row, generated on install via `crypto.randomBytes(32)` and encrypted with `encryptProviderSecret`.
6. **Auto-send (`email.draft.send`) is OFF by default.** Workspace admin must acknowledge a "this AI sends real email" modal to enable it. Defaults are conservative; failures should err safe.
7. **Per-workspace concurrency cap (default 20) and loop detection (10 runs / 60s) are dispatcher-level.** Action handlers can rely on these and need not re-check.
8. **`apps/backend/src/schema.gql` is auto-generated.** Edit decorators, never the file.
9. **Run history is retained 90 days, then archived.** Mirrors `ai-agent-action-audit-retention.scheduler.ts`.
10. **Every state-changing mutation writes an `AuditLog` row.** No exceptions for "small" actions like enable/disable.

---

## 3. Beads Bootstrap (one-time, run by human or first agent)

The bootstrap creates the entire task graph in beads with proper dependencies. Run it **once**. After that, agents pull work via `bd ready` and the dependency graph resolves itself.

### 3.1 Pre-requisites (human steps)

```bash
cd /home/amansharma/Desktop/workspace/MailZen-Smart-Email-Management
bd init mz                              # creates .beads/ in repo root
git add .beads && git commit -m "chore: initialize beads task tracker"
```

### 3.2 Bootstrap script

Save the script below as `/home/amansharma/Desktop/workspace/MailZen-Smart-Email-Management/scripts/bootstrap-automation-beads.sh`, make it executable, and run it once. It is idempotent only if you delete `.beads/` first — running twice creates duplicate issues.

```bash
#!/usr/bin/env bash
# File:        scripts/bootstrap-automation-beads.sh
# Purpose:     One-time creation of the Automation Engine task graph in beads.
# Usage:       bash scripts/bootstrap-automation-beads.sh
# Requires:    bd v1.0.3+, jq, run from repo root after `bd init mz`.

set -euo pipefail
command -v bd >/dev/null || { echo "bd not in PATH"; exit 1; }
command -v jq >/dev/null || { echo "jq not in PATH"; exit 1; }

mkbd() {
  # mkbd <slug> <title> <type> <priority>
  local slug="$1" title="$2" type="$3" prio="$4"
  bd create "[${slug}] ${title}" -t "${type}" -p "${prio}" --json | jq -r .id
}

dep() {
  # dep <blocker_id> <blocked_id>   (blocker must complete before blocked can start)
  bd dep add "$1" blocks "$2"
}

# ─── Epics ────────────────────────────────────────────────────────────────
EPIC=$(mkbd "EPIC" "Automation Engine + Sellable B2B v1" epic 1)
M1=$(mkbd   "M1"   "Engine Alpha (T+0 → T+30)"            epic 1)
M2=$(mkbd   "M2"   "Beta + Integrations (T+30 → T+60)"    epic 2)
M3=$(mkbd   "M3"   "Production Hardening + Sellable (T+60 → T+90)" epic 2)
dep "$M1" "$EPIC" ; dep "$M2" "$EPIC" ; dep "$M3" "$EPIC"
dep "$M1" "$M2"   ; dep "$M2" "$M3"

# ─── M1 tasks ─────────────────────────────────────────────────────────────
T_DBMIG=$(mkbd      "T-MIG"        "DB migration: 5 automation tables + 2 workspace columns" task 1)
T_ENT=$(mkbd        "T-ENT"        "TypeORM entities for 5 tables"                          task 1)
T_MOD=$(mkbd        "T-MOD"        "AutomationModule scaffold + DI"                         task 1)
T_BUS=$(mkbd        "T-BUS"        "AutomationEventBus (RxJS Subject)"                      task 1)
T_INT=$(mkbd        "T-INT"        "Trigger + Action handler interfaces"                    task 1)
T_SCHEMA=$(mkbd     "T-SCHEMA"     "JSON schemas + ajv runtime validation"                  task 1)
T_TR_RX=$(mkbd      "T-TR-RX"      "Trigger: email.received"                                task 1)
T_TR_MAN=$(mkbd     "T-TR-MAN"     "Trigger: manual"                                        task 2)
T_GMAIL_PUB=$(mkbd  "T-GMAIL-PUB"  "Wire gmail-sync to publish email.received"              task 1)
T_OUTLOOK_PUB=$(mkbd "T-OUTLOOK-PUB" "Wire outlook-sync to publish email.received"          task 1)
T_COND=$(mkbd       "T-COND"       "Condition evaluator (boolean tree)"                     task 1)
T_ACT_LBL=$(mkbd    "T-ACT-LBL"    "Action: email.label.add / email.label.remove"           task 1)
T_ACT_ARC=$(mkbd    "T-ACT-ARC"    "Action: email.archive"                                  task 1)
T_ACT_ASGN=$(mkbd   "T-ACT-ASGN"   "Action: email.assign"                                   task 1)
T_ACT_NOTIF=$(mkbd  "T-ACT-NOTIF"  "Action: notify.user"                                    task 1)
T_ACT_AICLS=$(mkbd  "T-ACT-AICLS"  "Action: ai.classify"                                    task 1)
T_DISP=$(mkbd       "T-DISP"       "AutomationDispatcherService"                            task 1)
T_WORKER=$(mkbd     "T-WORKER"     "AutomationWorkerProcessor (Bull)"                       task 1)
T_GUARD=$(mkbd      "T-GUARD"      "WorkspaceAdminGuard"                                    task 1)
T_RESQ=$(mkbd       "T-RESQ"       "Resolver: queries + cursor pagination"                  task 1)
T_RESM=$(mkbd       "T-RESM"       "Resolver: mutations"                                    task 1)
T_MIGFILT=$(mkbd    "T-MIGFILT"    "Migration job: EmailFilter → Automation (DISABLED)"     task 1)
T_DEP_FILT=$(mkbd   "T-DEP-FILT"   "Mark old EmailFilter resolver @deprecated"              task 3)
T_FE_NAV=$(mkbd     "T-FE-NAV"     "Frontend: dashboard nav entry + apollo queries"         task 2)
T_FE_LIST=$(mkbd    "T-FE-LIST"    "Frontend: automations list page"                        task 1)
T_FE_NEW=$(mkbd     "T-FE-NEW"     "Frontend: create automation (JSON form)"                task 1)
T_FE_DETAIL=$(mkbd  "T-FE-DETAIL"  "Frontend: detail page + run timeline"                   task 1)
T_DOCS=$(mkbd       "T-DOCS"       "automation/README.md"                                   task 3)
T_SMOKE=$(mkbd      "T-SMOKE"      "Manual smoke test: M1 alpha gate"                       task 1)

# All M1 tasks roll up to M1 epic
for t in "$T_DBMIG" "$T_ENT" "$T_MOD" "$T_BUS" "$T_INT" "$T_SCHEMA" "$T_TR_RX" "$T_TR_MAN" \
         "$T_GMAIL_PUB" "$T_OUTLOOK_PUB" "$T_COND" "$T_ACT_LBL" "$T_ACT_ARC" "$T_ACT_ASGN" \
         "$T_ACT_NOTIF" "$T_ACT_AICLS" "$T_DISP" "$T_WORKER" "$T_GUARD" "$T_RESQ" "$T_RESM" \
         "$T_MIGFILT" "$T_DEP_FILT" "$T_FE_NAV" "$T_FE_LIST" "$T_FE_NEW" "$T_FE_DETAIL" \
         "$T_DOCS" "$T_SMOKE"; do
  dep "$t" "$M1"
done

# Dependencies inside M1
dep "$T_DBMIG" "$T_ENT"
dep "$T_ENT"   "$T_MOD"
dep "$T_MOD"   "$T_BUS"
dep "$T_MOD"   "$T_INT"
dep "$T_INT"   "$T_SCHEMA"
dep "$T_BUS"   "$T_TR_RX"
dep "$T_BUS"   "$T_TR_MAN"
dep "$T_TR_RX" "$T_GMAIL_PUB"
dep "$T_TR_RX" "$T_OUTLOOK_PUB"
dep "$T_INT"   "$T_COND"
dep "$T_INT"   "$T_ACT_LBL"
dep "$T_INT"   "$T_ACT_ARC"
dep "$T_INT"   "$T_ACT_ASGN"
dep "$T_INT"   "$T_ACT_NOTIF"
dep "$T_INT"   "$T_ACT_AICLS"
dep "$T_BUS"   "$T_DISP"
dep "$T_COND"  "$T_DISP"
dep "$T_DISP"  "$T_WORKER"
dep "$T_ACT_LBL" "$T_WORKER"
dep "$T_ACT_ARC" "$T_WORKER"
dep "$T_ACT_ASGN" "$T_WORKER"
dep "$T_ACT_NOTIF" "$T_WORKER"
dep "$T_ACT_AICLS" "$T_WORKER"
dep "$T_ENT"   "$T_GUARD"
dep "$T_MOD"   "$T_RESQ"
dep "$T_GUARD" "$T_RESM"
dep "$T_SCHEMA" "$T_RESM"
dep "$T_RESM"  "$T_MIGFILT"
dep "$T_MIGFILT" "$T_DEP_FILT"
dep "$T_RESQ"  "$T_FE_NAV"
dep "$T_FE_NAV" "$T_FE_LIST"
dep "$T_FE_NAV" "$T_FE_NEW"
dep "$T_FE_LIST" "$T_FE_DETAIL"
dep "$T_FE_DETAIL" "$T_SMOKE"
dep "$T_WORKER" "$T_SMOKE"
dep "$T_GMAIL_PUB" "$T_SMOKE"
dep "$T_DOCS" "$T_SMOKE"

# ─── M2 tasks ─────────────────────────────────────────────────────────────
T_TR_REPLIED=$(mkbd      "T-TR-REPLIED"      "Trigger: email.thread.replied + wire email.service"   task 2)
T_TR_ASSIGNED=$(mkbd     "T-TR-ASSIGNED"     "Trigger: email.thread.assigned + wire assignment svc" task 2)
T_TR_LABEL_ADDED=$(mkbd  "T-TR-LABEL-ADDED"  "Trigger: email.label.added"                           task 2)
T_TR_CRON=$(mkbd         "T-TR-CRON"         "Trigger: schedule.cron + AutomationCronScheduler"     task 2)
T_ACT_DRAFT_C=$(mkbd     "T-ACT-DRAFT-C"     "Action: email.draft.create"                           task 2)
T_ACT_DRAFT_S=$(mkbd     "T-ACT-DRAFT-S"     "Action: email.draft.send (auto-send safety)"          task 2)
T_ACT_AISUM=$(mkbd       "T-ACT-AISUM"       "Action: ai.summarize"                                 task 2)
T_ACT_AIRPLY=$(mkbd      "T-ACT-AIRPLY"      "Action: ai.draft.reply"                               task 2)
T_ACT_DELAY=$(mkbd       "T-ACT-DELAY"       "Action: delay (Bull delayed jobs)"                    task 2)
T_ACT_WEBHOOK=$(mkbd     "T-ACT-WEBHOOK"     "Action: webhook.post + HMAC signing"                  task 2)
T_INT_WEBHOOK=$(mkbd     "T-INT-WEBHOOK"     "workspace_integrations: generic webhook install flow" task 2)
T_ACT_SLACK=$(mkbd       "T-ACT-SLACK"       "Action: notify.slack"                                 task 2)
T_INT_SLACK=$(mkbd       "T-INT-SLACK"       "Slack OAuth install + channel picker"                 task 2)
T_FE_TIMELINE=$(mkbd     "T-FE-TIMELINE"     "Frontend: AutomationRun audit timeline polish"        task 2)
T_FE_INTEGS=$(mkbd       "T-FE-INTEGS"       "Frontend: integrations settings (Slack + webhook)"    task 2)
T_FE_ENABLE=$(mkbd       "T-FE-ENABLE"       "Frontend: enable/disable + manual run button"         task 2)
T_PARTNERS=$(mkbd        "T-PARTNERS"        "3 design partners onboarded with 5 automations each"  task 1)

for t in "$T_TR_REPLIED" "$T_TR_ASSIGNED" "$T_TR_LABEL_ADDED" "$T_TR_CRON" \
         "$T_ACT_DRAFT_C" "$T_ACT_DRAFT_S" "$T_ACT_AISUM" "$T_ACT_AIRPLY" "$T_ACT_DELAY" \
         "$T_ACT_WEBHOOK" "$T_INT_WEBHOOK" "$T_ACT_SLACK" "$T_INT_SLACK" \
         "$T_FE_TIMELINE" "$T_FE_INTEGS" "$T_FE_ENABLE" "$T_PARTNERS"; do
  dep "$t" "$M2"
done
# Cross-milestone gate: M1 must be done first
dep "$T_SMOKE" "$T_TR_REPLIED"
dep "$T_INT_WEBHOOK" "$T_ACT_WEBHOOK"
dep "$T_INT_SLACK" "$T_ACT_SLACK"
dep "$T_ACT_SLACK" "$T_PARTNERS"
dep "$T_ACT_AIRPLY" "$T_PARTNERS"
dep "$T_FE_ENABLE" "$T_PARTNERS"

# ─── M3 tasks ─────────────────────────────────────────────────────────────
T_KILL_SW=$(mkbd     "T-KILL-SW"     "Kill switch: workspaces.automations_enabled" task 1)
T_CONC_CAP=$(mkbd    "T-CONC-CAP"    "Concurrency cap enforcement"                  task 1)
T_RATE=$(mkbd        "T-RATE"        "Per-action rate limits via common/rate-limit" task 1)
T_LOOP=$(mkbd        "T-LOOP"        "Loop detection: Redis sorted set"             task 1)
T_AICRED=$(mkbd      "T-AICRED"      "AI credit metering wiring"                    task 1)
T_AUDIT=$(mkbd       "T-AUDIT"       "AuditLog: every automation create/edit/enable/disable" task 1)
T_SENTRY=$(mkbd      "T-SENTRY"      "Sentry alert on automation_run_failed rate"   task 2)
T_RETN=$(mkbd        "T-RETN"        "Run retention scheduler (90-day archival)"    task 2)
T_BILLING=$(mkbd     "T-BILLING"     "Stripe per-seat billing wiring"               task 1)
T_LANDING=$(mkbd     "T-LANDING"     "Public landing: Automations section"          task 3)
T_E2E=$(mkbd         "T-E2E"         "Integration test: end-to-end automation run"  task 1)
T_SELL=$(mkbd        "T-SELL"        "Sellability gate: 3 paying partners (T+90)"   task 1)

for t in "$T_KILL_SW" "$T_CONC_CAP" "$T_RATE" "$T_LOOP" "$T_AICRED" "$T_AUDIT" \
         "$T_SENTRY" "$T_RETN" "$T_BILLING" "$T_LANDING" "$T_E2E" "$T_SELL"; do
  dep "$t" "$M3"
done
dep "$T_PARTNERS" "$T_KILL_SW"        # M2 → M3
dep "$T_KILL_SW" "$T_BILLING"
dep "$T_CONC_CAP" "$T_BILLING"
dep "$T_AICRED"  "$T_BILLING"
dep "$T_BILLING" "$T_SELL"
dep "$T_E2E"     "$T_SELL"

echo "Bootstrap complete. Run 'bd ready --json' to find your first task."
```

After running, verify:

```bash
bd list --json | jq 'length'           # should be ~58 issues + 4 epics = 62
bd ready --json | jq '.[] | .id + " " + .title'   # currently-unblocked work
```

---

## 4. Task Graph (the meat)

Each task below has the slug used in beads. The implementing agent finds the slug in beads via `bd show`, then reads the matching `### T-…` section here for the full spec.

**Effort key:** S = under 2h • M = 2-6h • L = 6-16h.

### M1 — Engine Alpha (T+0 → T+30)

#### T-MIG — DB migration: 5 automation tables + 2 workspace columns
- **Effort:** M
- **Goal:** Create the schema in one migration, including the two new columns on `workspaces`.
- **Files (create):** `apps/backend/src/database/migrations/<unix-ts>-AutomationEngine.ts` (auto-generated via `npm run migration:generate`).
- **Files (modify):** none — the migration is generated from entity diffs after T-ENT, but this task is the *DDL gate*; we run it after T-ENT entities exist. Treat T-ENT as the authoring step and this task as the migration generation + review step.
- **Reuses:** generation pattern from `apps/backend/src/database/migrations/`.
- **Acceptance:**
  - 5 new tables exist: `automations`, `automation_versions`, `automation_runs`, `automation_step_runs`, `workspace_integrations`.
  - 2 new columns on `workspaces`: `automations_enabled boolean DEFAULT true`, `automation_concurrency_cap int DEFAULT 20`.
  - All indexes from §A present (`(automationId, createdAt DESC)`, `(workspaceId, status, createdAt DESC)`, `UNIQUE(automationId, version)`, `UNIQUE(runId, stepIndex, attempt)`, `UNIQUE(workspaceId, provider)`).
  - `npm run migration:run` succeeds against a fresh DB; `npm run migration:revert` undoes it cleanly.
  - `npm run check:migration:contracts` and `npm run check:schema:contracts` pass.

#### T-ENT — TypeORM entities for 5 tables
- **Effort:** M
- **Goal:** Write the 5 entity files using existing decorator conventions.
- **Files (create):**
  - `apps/backend/src/automation/entities/automation.entity.ts`
  - `apps/backend/src/automation/entities/automation-version.entity.ts`
  - `apps/backend/src/automation/entities/automation-run.entity.ts`
  - `apps/backend/src/automation/entities/automation-step-run.entity.ts`
  - `apps/backend/src/automation/entities/workspace-integration.entity.ts`
- **Reuses:** decorator pattern from `apps/backend/src/notification/entities/user-notification.entity.ts:13-56` (especially `@Field(() => GraphQLJSON)` + `@Column({ type: 'jsonb' })`).
- **Acceptance:**
  - All fields match §A spec exactly.
  - Enums registered with `registerEnumType(EnumName, { name: 'EnumName' })` so they appear in the generated GraphQL schema.
  - `nx build backend` succeeds.

#### T-MOD — AutomationModule scaffold + DI
- **Effort:** S
- **Goal:** Create the NestJS module file and register it in `app.module.ts`. Wire up `TypeOrmModule.forFeature([...])`, `BullModule.registerQueue({ name: 'automations' })`, and the providers/exports list.
- **Files (create):** `apps/backend/src/automation/automation.module.ts`
- **Files (modify):** `apps/backend/src/app.module.ts` (import `AutomationModule`)
- **Reuses:** module shape from `apps/backend/src/email/email.module.ts:106-164` (Bull setup), `apps/backend/src/notification/notification.module.ts`.
- **Acceptance:** backend boots (`nx serve backend`); module appears in DI graph; placeholder `Hello` query returns at the GraphQL playground; no decorator errors.

#### T-BUS — AutomationEventBus (RxJS Subject)
- **Effort:** S
- **Goal:** A new in-process pub/sub for `AutomationEvent`s. Source modules call `bus.publish(event)`; subscribers (the dispatcher) subscribe at module init.
- **Files (create):** `apps/backend/src/automation/automation-event.bus.ts`
- **Reuses:** `rxjs` (already a dep — used throughout NestJS). Logger + `serializeStructuredLog`.
- **Acceptance:**
  - `AutomationEvent` discriminated union exported from `libs/shared-types/src/automation.types.ts` (or local for now; T-INT centralizes types).
  - `publish(event)` is sync, never throws (logs and swallows).
  - `subscribe((e) => ...)` returns an `rxjs.Subscription`.
  - Spec covers: publish-without-subscribers does not error; multiple subscribers each receive each event.

#### T-INT — Trigger + Action handler interfaces
- **Effort:** S
- **Goal:** TypeScript interfaces and discriminated unions for `AutomationTrigger`, `AutomationCondition`, `AutomationStep`, `TriggerHandler`, `ActionHandler`. Source of truth lives in `libs/shared-types/` so frontend can import the same types.
- **Files (create):**
  - `libs/shared-types/src/automation.types.ts` (Trigger / Condition / Step / Run unions)
  - `apps/backend/src/automation/triggers/trigger.interface.ts`
  - `apps/backend/src/automation/actions/action.interface.ts`
- **Acceptance:** All trigger types from §B (Reference) and action types from §C are enumerated as TS string literals + payload shapes. Both backend and frontend can `import { AutomationTrigger } from '@mailzen/shared-types'`.

#### T-SCHEMA — JSON schemas + ajv runtime validation
- **Effort:** M
- **Goal:** Backend runtime validation of the JSON-typed `trigger`, `conditions`, `steps` fields on Create/Update mutations. Ajv schemas double as documentation.
- **Files (create):** `libs/shared-types/src/automation.schemas.ts`
- **Deps:** Add `ajv` to `apps/backend/package.json` (small, ~80kb, no runtime concerns).
- **Acceptance:**
  - Each trigger / action / condition variant has a schema.
  - Resolver validates input via `ajv.validate(schema, input)` before calling the service; returns BadRequest GraphQL error with the ajv error path on failure.
  - Spec covers: invalid trigger type, missing required action input, malformed condition tree.

#### T-TR-RX — Trigger: email.received
- **Effort:** S
- **Goal:** Implement the `email.received` trigger handler — given a raw event from `gmail-sync`/`outlook-sync`, it emits a normalized `TriggerEvent` matching `automation_versions.trigger`.
- **Files (create):** `apps/backend/src/automation/triggers/email-received.trigger.ts`
- **Reuses:** event shape includes `messageId`, `threadId`, `from`, `subject`, `labels[]`, `workspaceId`, `userId`.
- **Acceptance:** unit test asserts handler maps a synthetic provider payload into the documented event shape.

#### T-TR-MAN — Trigger: manual
- **Effort:** S
- **Goal:** Trigger that fires only via `runAutomationManually` mutation. No upstream wiring.
- **Files (create):** `apps/backend/src/automation/triggers/manual.trigger.ts`
- **Acceptance:** `runAutomationManually(id, contextOverride)` produces an event the dispatcher accepts.

#### T-GMAIL-PUB — Wire gmail-sync to publish email.received
- **Effort:** M
- **Goal:** After Gmail sync persists an inbound message, publish `email.received` into the bus.
- **Files (modify):** `apps/backend/src/gmail-sync/gmail-sync.service.ts` — at the persistence callsite (around the `emailReceivedAt` reference at line ~792), after the row save, call `automationEventBus.publish(...)`.
- **Reuses:** existing `inbox-triage.service.ts:185` shows a comparable downstream call to `notificationEventBus.publishSafely`.
- **Acceptance:** integration test: simulate a Pub/Sub push, assert one `email.received` event is published with the correct workspaceId/userId/messageId.

#### T-OUTLOOK-PUB — Wire outlook-sync to publish email.received
- **Effort:** M
- **Goal:** Same as T-GMAIL-PUB but for Outlook sync.
- **Files (modify):** `apps/backend/src/outlook-sync/outlook-sync.service.ts`
- **Acceptance:** integration test parallels T-GMAIL-PUB.

#### T-COND — Condition evaluator (boolean tree)
- **Effort:** S
- **Goal:** Recursive evaluator: `evaluate(node, ctx)` returns boolean. `node = { all: [...] } | { any: [...] } | { field, op, value }`. Ops in v1: `equals`, `contains`, `starts_with`, `ends_with`, `gt`, `lt`.
- **Files (create):**
  - `apps/backend/src/automation/condition-evaluator.ts`
  - `apps/backend/src/automation/condition-evaluator.spec.ts`
- **Acceptance:** spec covers — flat AND/OR, nested `{ any: [{ all: [...] }, ...] }`, unknown field returns false (not throws), op typo throws.

#### T-ACT-LBL — Action: email.label.add / email.label.remove
- **Effort:** S
- **Goal:** Two action handlers that add/remove a label on a thread. Resolves label by `labelId` or `labelName` (creates if missing — gated by `createIfMissing: true` on the action input).
- **Files (create):** `apps/backend/src/automation/actions/email-label.action.ts`
- **Reuses:** `EmailLabelAssignment` repository (in `email/entities/email-label-assignment.entity.ts`), label CRUD in `organization/label.module.ts`.
- **Acceptance:** spec covers label-by-id, label-by-name, missing-label-noop, missing-label-create.

#### T-ACT-ARC — Action: email.archive
- **Effort:** S
- **Files (create):** `apps/backend/src/automation/actions/email-archive.action.ts`
- **Reuses:** `EmailService.markArchived` (verify the exact method name in `email/email.service.ts`; if it's `archive` or `markAsArchived`, adapt).

#### T-ACT-ASGN — Action: email.assign
- **Effort:** S
- **Files (create):** `apps/backend/src/automation/actions/email-assign.action.ts`
- **Reuses:** `EmailAssignmentService.assignThread` (in `email/email-assignment.service.ts`). Supports `userId` direct or `roundRobin: true` (rotate among workspace members with role MEMBER+).
- **Acceptance:** spec covers direct assign + round-robin (mock workspace with 3 members → first call assigns to A, second to B, third to C, fourth wraps to A).

#### T-ACT-NOTIF — Action: notify.user
- **Effort:** S
- **Files (create):** `apps/backend/src/automation/actions/notify-user.action.ts`
- **Reuses:** `NotificationEventBusService.publishSafely` (`notification/notification-event-bus.service.ts:24`). Action input shape: `{ targetUserId, type, title, message, metadata? }`.

#### T-ACT-AICLS — Action: ai.classify
- **Effort:** S
- **Files (create):** `apps/backend/src/automation/actions/ai-classify.action.ts`
- **Reuses:** `InboxAiService.classifyThread` (`ai-agent-gateway/inbox-ai.service.ts`). Output: `{ classification: string, confidence: number, creditsConsumed: 1 }`.
- **Acceptance:** step output is structured; failure on AI provider returns `SKIPPED` not `FAILED` (downstream can branch on `output == null`).

#### T-DISP — AutomationDispatcherService
- **Effort:** L
- **Goal:** Subscribes to `AutomationEventBus` at module init; for each event, queries enabled automations matching `(workspaceId, trigger.type)`, evaluates conditions in-process, creates `automation_runs` row in `QUEUED` state, enqueues a Bull job.
- **Files (create):**
  - `apps/backend/src/automation/automation-dispatcher.service.ts`
  - `apps/backend/src/automation/automation-dispatcher.service.spec.ts`
- **Reuses:** Bull queue from T-MOD.
- **Acceptance:**
  - spec: given an event + 3 enabled automations (1 matches, 1 fails conditions, 1 different workspace), assert exactly 1 `automation_runs` row + 1 enqueued job.
  - spec: kill switch `automations_enabled = false` → no enqueue.
  - spec: matched but disabled → no enqueue.

#### T-WORKER — AutomationWorkerProcessor (Bull)
- **Effort:** L
- **Goal:** `@Processor('automations')` class. Picks up jobs, loads `AutomationVersion`, runs `steps` sequentially, persists `automation_step_runs`, marks the run terminal. Per-step retry (max 3, exponential backoff). On final failure of any step, marks run `FAILED`.
- **Files (create):**
  - `apps/backend/src/automation/automation-worker.processor.ts`
  - `apps/backend/src/automation/automation-worker.processor.spec.ts`
- **Reuses:** Bull `@Processor` + `@Process` pattern from `email/email.email-scheduler.service.ts:12,106`.
- **Acceptance:**
  - spec: 3-step happy path → 3 step rows SUCCEEDED, run SUCCEEDED.
  - spec: step 2 throws once then succeeds → step row attempt=2 SUCCEEDED, run SUCCEEDED.
  - spec: step 2 throws 3 times → step row attempt=3 FAILED, run FAILED, subsequent steps SKIPPED.
  - spec: cancellation — run set to CANCELED before step 2 → step 2 not run.

#### T-GUARD — WorkspaceAdminGuard
- **Effort:** S
- **Goal:** A NestJS guard that allows only workspace ADMIN role through. Reads `workspaceId` from the resolver args and looks up the calling user's `WorkspaceMember.role`.
- **Files (create):** `apps/backend/src/automation/guards/workspace-admin.guard.ts`
- **Reuses:** auth pattern from `common/guards/admin.guard.ts`. Workspace lookup via `WorkspaceMember` repository.
- **Acceptance:** spec — admin → OK, member → ForbiddenException, non-member → ForbiddenException.

#### T-RESQ — Resolver: queries + cursor pagination
- **Effort:** M
- **Files (create):**
  - `apps/backend/src/automation/automation.resolver.ts` (queries portion)
  - `apps/backend/src/automation/dto/automation.connection.ts` (cursor pagination shape)
  - `apps/backend/src/automation/dto/automation-run.connection.ts`
- **Files (modify):** `apps/backend/src/automation/automation.module.ts` (register resolver)
- **Reuses:** resolver pattern from `scheduled-email.resolver.ts:16-41`.
- **Acceptance:** all queries from §B work in the GraphQL playground; cursor pagination round-trips correctly.

#### T-RESM — Resolver: mutations
- **Effort:** L
- **Goal:** All 8 mutations from §B. `createAutomation` saves `Automation` + `AutomationVersion(version=1)`. `updateAutomation` creates new version if trigger/conditions/steps changed. Admin-only mutations use `WorkspaceAdminGuard`.
- **Files (modify):** `apps/backend/src/automation/automation.resolver.ts`, `apps/backend/src/automation/automation.service.ts`
- **Acceptance:** integration tests for each mutation; ajv validation rejects malformed input.

#### T-MIGFILT — Migration job: EmailFilter → Automation (DISABLED)
- **Effort:** M
- **Goal:** One-time job that converts existing `EmailFilter` rows into `Automation` + `AutomationVersion(1)` pairs, status `DISABLED`. Maps `FilterCondition` → conditions; `FilterAction` → step list.
- **Files (create):**
  - `apps/backend/src/automation/automation-migration-from-filter.service.ts`
  - `apps/backend/src/automation/automation-migration-from-filter.service.spec.ts`
- **Trigger mechanism:** standalone script `apps/backend/scripts/migrate-email-filters.ts` (mirrors `scripts/backfill-workspace-scopes.ts:1`) — a human runs it once; agent does not auto-fire.
- **Acceptance:**
  - spec: 5 sample EmailFilter rows → 5 Automations with status `DISABLED`, 5 `AutomationVersion(1)` rows with semantically equivalent triggers/actions.
  - banner copy authored: "We migrated N filters from the old system. They are disabled — review and enable each."

#### T-DEP-FILT — Mark old EmailFilter resolver @deprecated
- **Effort:** S
- **Files (modify):** `apps/backend/src/email/email.email-filter.resolver.ts` — add `description: '@deprecated Use Automation. Will be removed in v2.'` to each query/mutation.
- **Acceptance:** GraphQL playground shows the deprecation in introspection.

#### T-FE-NAV — Frontend: dashboard nav entry + apollo queries
- **Effort:** S
- **Files (modify):** `apps/frontend/components/layout/dashboard-nav.config.ts` (add "Automations" entry, lucide icon `Zap`).
- **Files (create):** `apps/frontend/lib/apollo/queries/automations.ts` — gql tags for all queries + mutations from §B; matches the existing apollo file pattern (`apps/frontend/lib/apollo/queries/notifications.ts`).

#### T-FE-LIST — Frontend: automations list page
- **Effort:** M
- **Files (create):** `apps/frontend/app/(dashboard)/automations/page.tsx`
- **Acceptance:** lists workspace automations with status pill, last-run-at, last-run-status, enable/disable toggle, "create" CTA. Matches existing dashboard page aesthetics (Tailwind v4 + shadcn).

#### T-FE-NEW — Frontend: create automation (JSON form)
- **Effort:** L
- **Goal:** A form-based editor (no drag-drop) that lets a user pick a trigger, write conditions (boolean tree UI), pick a sequence of actions. Submits via `createAutomation` mutation.
- **Files (create):** `apps/frontend/app/(dashboard)/automations/new/page.tsx` + supporting components in `apps/frontend/components/automation/`.
- **Acceptance:** can create the canonical demo automation: "When email.received from contains boss@ → add label urgent + notify user"; created automation appears in T-FE-LIST.

#### T-FE-DETAIL — Frontend: detail page + run timeline
- **Effort:** M
- **Files (create):** `apps/frontend/app/(dashboard)/automations/[id]/page.tsx`, `apps/frontend/app/(dashboard)/automations/[id]/runs/[runId]/page.tsx`.
- **Acceptance:** detail page shows version history, recent runs (paginated), enable/disable, edit, archive. Run page shows the timeline of `AutomationStepRun`s with input/output JSON expandable.

#### T-DOCS — automation/README.md
- **Effort:** S
- **File (create):** `apps/backend/src/automation/README.md` — module overview + how to add a new trigger/action. Mirrors `apps/backend/src/email/README.md` structure.

#### T-SMOKE — Manual smoke test: M1 alpha gate
- **Effort:** S
- **Goal:** Walk through the canonical flow end-to-end. This is the gate that closes M1.
- **Steps:**
  1. `npm run dev` → log in as workspace admin.
  2. Create automation: "When `email.received` where `from CONTAINS "boss@"` then `email.label.add 'urgent'` + `notify.user`".
  3. Send a real email from a `boss@…` Gmail to the connected mailbox.
  4. Within 30 s confirm: label appears in inbox, in-app notification fires.
  5. Open `/automations/<id>` → 1 run, 2 step rows SUCCEEDED, correlation ID present in logs.
  6. Disable; send another test; confirm zero runs.
- **Acceptance:** all 6 steps pass. If any step fails, file a bug via `bd create "Found bug: ..." -t bug -p 1 --deps discovered-from:<this-id>`.

---

### M2 — Beta + Integrations (T+30 → T+60)

Stub-spec — **flesh out at the end of M1** (close T-SMOKE first). Each task already exists in beads with its title and rough scope. Detailed specs follow once M1 reveals what was harder than expected.

| Slug | Title | Notes |
|---|---|---|
| T-TR-REPLIED | email.thread.replied trigger | Wire from `email.service.ts` after outbound send |
| T-TR-ASSIGNED | email.thread.assigned trigger | Wire from `email-assignment.service.ts` (already fires `EMAIL_ASSIGNED`) |
| T-TR-LABEL-ADDED | email.label.added trigger | Hook on `EmailLabelAssignment` insert |
| T-TR-CRON | schedule.cron trigger | `@Cron('* * * * *')` ticks → enumerates due automations |
| T-ACT-DRAFT-C | email.draft.create | `EmailService.createDraft` |
| T-ACT-DRAFT-S | email.draft.send | Auto-send safety modal; admin-only enable |
| T-ACT-AISUM | ai.summarize | Extend `InboxAiService` if `summarizeThread` doesn't exist |
| T-ACT-AIRPLY | ai.draft.reply | Wraps `SmartReplyService`. Returns drafted reply in step output |
| T-ACT-DELAY | delay | Bull's `queue.add(..., { delay: ms })`; suspends run, resumes later |
| T-ACT-WEBHOOK | webhook.post | HMAC-SHA256 sig in `X-MailZen-Signature` header |
| T-INT-WEBHOOK | webhook integration install | UI generates secret, shown once, encrypted via `encryptProviderSecret` |
| T-ACT-SLACK | notify.slack | Post message to channel/DM via Slack Web API `chat.postMessage` |
| T-INT-SLACK | Slack OAuth install | Standard OAuth v2 flow; channel picker; persist bot token in `workspace_integrations.encryptedSecret` |
| T-FE-TIMELINE | Run timeline polish | Color-coded step rows, JSON expanders, retry button |
| T-FE-INTEGS | Integrations settings page | At `/settings/integrations`, list connected providers + install buttons |
| T-FE-ENABLE | Enable/disable + manual run UI | One-click run on any automation for testing |
| T-PARTNERS | 3 design partners onboarded | White-glove: build their first 3 automations with them. Capture feedback in beads as discovered-from issues |

### M3 — Production Hardening + Sellable (T+60 → T+90)

| Slug | Title | Notes |
|---|---|---|
| T-KILL-SW | Kill switch | `workspaces.automations_enabled` + 30s in-process cache in dispatcher |
| T-CONC-CAP | Concurrency cap | Bull job `workspaceId` + `getJobCounts` filtering. Default 20, override on `workspaces.automation_concurrency_cap` |
| T-RATE | Per-action rate limits | Hardcoded in v1 (`max 50 send/hour/workspace`, etc.). Reuse `common/rate-limit/` |
| T-LOOP | Loop detection | Redis sorted set `automation:loop:<ws>:<auto>`, trim to last 60 s, refuse if size > 10 |
| T-AICRED | AI credit metering | Each `ai.*` step → `billing/` debit. Plan-tier daily caps |
| T-AUDIT | Audit log every change | Extend `AuditLog`; covers create/edit/enable/disable/archive |
| T-SENTRY | Sentry alert | Threshold rule on `automation_run_failed` event rate per workspace |
| T-RETN | Retention scheduler | Mirror `ai-agent-action-audit-retention.scheduler.ts:1`. 90-day → cold (or just delete in v1) |
| T-BILLING | Stripe per-seat | $25/seat/mo SKU; gating via `feature/` module |
| T-LANDING | Public landing | "MailZen Automations" section + 3 demo videos + design-partner quotes |
| T-E2E | End-to-end integration test | New `apps/backend/test/automation-e2e.spec.ts` — real Postgres + `ioredis-mock`, publishes synthetic event, asserts run completes |
| T-SELL | Sellability gate | 3 paying contracts signed; metrics from §5 hit |

---

## 5. Verification Gates

### M1 alpha gate (T+30) — closes T-SMOKE

- T-SMOKE checklist all green.
- `nx test backend` passes (full suite).
- `npm run lint` passes.
- `npm run check:no-console-usage` and `npm run check:structured-logger-usage` pass.
- Backend boots with no schema-sync warnings.

### M2 beta gate (T+60) — closes T-PARTNERS

- 3 design partners actively using the product (≥ 5 enabled automations each, ≥ 50 successful runs in the last 7 days).
- All 4 v1 integrations functional (Slack + webhook). HubSpot/Linear/Jira on backlog as v1.1.
- AutomationRun timeline UI usable without engineer hand-holding.
- Zero data-loss incidents.

### M3 sellability gate (T+90) — closes T-SELL

- 3 paying Stripe invoices in `billing/`.
- Each partner's automation success rate > 95% over the last 7 days (queryable: `SELECT count(*) FILTER (WHERE status='SUCCEEDED')::float / count(*) FROM automation_runs WHERE workspace_id = $1 AND created_at > now() - interval '7 days'`).
- p95 dispatcher → first-step latency < 5 s.
- Zero unresolved Sentry alerts on `automation_run_failed` aged > 24 h.
- SOC2-prep checklist complete (audit log coverage verified, access reviews documented).

---

## 6. Open Scope Decisions (defaults applied; override anytime)

| # | Question | Default | Reverse path |
|---|---|---|---|
| 1 | HubSpot in v1? | No (v1.1) | Move T-INT-HUBSPOT/T-ACT-HUBSPOT into M2; bump M2 timeline +14d |
| 2 | Visual workflow builder? | No (JSON form in v1) | New tasks T-FE-VBUILDER (~3 weeks); v1.1 |
| 3 | Auto-send (`email.draft.send`) hard SKU gate? | Pro plan only | Toggle in `feature/` module — change default after first paid contract |
| 4 | Run retention | 90 days | Promote to 180/365 if compliance pitch demands |
| 5 | GraphQL subscriptions for live run status? | No (poll) | New task in v1.1 — add Apollo subscriptions transport |

---

## 7. Out of v1 (parked for v1.1+)

- HubSpot two-way integration
- Linear / Jira integrations
- Visual drag-drop workflow builder
- Conditional `branch` action (`thenSteps` / `elseSteps`)
- Step-output references in conditions (`{{ steps.0.output.score > 0.8 }}`)
- Workflow templates marketplace
- Public-API webhook-inbound triggers
- GraphQL subscriptions
- WhatsApp / SMS / LinkedIn unified inbox channels
- Customer-facing chat-from-website widget

---

## §A Reference: Data Model

Five entities. UUID PKs. TypeORM `@Entity('snake_case')` + `@ObjectType()` + per-field `@Field(...)` (matches `user-notification.entity.ts:14`). JSONB columns paired with `@Field(() => GraphQLJSON)`.

### A.1 `automations`

```
id                uuid PK
workspaceId       uuid     NOT NULL  (indexed)
ownerUserId       uuid     NULL      (NULL = workspace-wide; set = personal-scope)
name              text     NOT NULL
description       text     NULL
status            enum('DRAFT','ENABLED','DISABLED','ARCHIVED')  default DRAFT
currentVersionId  uuid     NULL      (the version that runs on new events)
createdByUserId   uuid     NOT NULL
createdAt         timestamptz
updatedAt         timestamptz
```

### A.2 `automation_versions` — IMMUTABLE

```
id                uuid PK
automationId      uuid     NOT NULL  (indexed)
version           int      NOT NULL  (monotonic per automation)
trigger           jsonb    NOT NULL
conditions        jsonb    NULL      (boolean tree: { all:[...] } | { any:[...] } | leaf)
steps             jsonb    NOT NULL  (ordered array of step objects)
publishedAt       timestamptz
publishedByUserId uuid     NOT NULL
UNIQUE(automationId, version)
```

### A.3 `automation_runs`

```
id                  uuid PK
automationId        uuid       NOT NULL  (indexed)
automationVersionId uuid       NOT NULL
workspaceId         uuid       NOT NULL  (denormalized)
status              enum('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELED','SKIPPED_CONDITIONS')
triggerEvent        jsonb      NOT NULL
context             jsonb      NULL
startedAt           timestamptz NULL
finishedAt          timestamptz NULL
errorCode           text       NULL
errorMessage        text       NULL
correlationId       text       NOT NULL
createdAt           timestamptz
INDEX (automationId, createdAt DESC)
INDEX (workspaceId, status, createdAt DESC)
```

### A.4 `automation_step_runs`

```
id                uuid PK
runId             uuid     NOT NULL  (indexed)
stepIndex         int      NOT NULL  (0-based)
stepType          text     NOT NULL
status            enum('PENDING','RUNNING','SUCCEEDED','FAILED','SKIPPED','RETRYING')
input             jsonb    NULL
output            jsonb    NULL
attempt           int      NOT NULL  default 1
errorCode         text     NULL
errorMessage      text     NULL
startedAt         timestamptz NULL
finishedAt        timestamptz NULL
UNIQUE(runId, stepIndex, attempt)
```

### A.5 `workspace_integrations`

```
id                uuid PK
workspaceId       uuid     NOT NULL
provider          enum('SLACK','HUBSPOT','LINEAR','JIRA','WEBHOOK_GENERIC')
status            enum('ACTIVE','REVOKED','ERROR')
displayName       text
encryptedSecret   text     NOT NULL  (envelope-encrypted via encryptProviderSecret)
config            jsonb    NULL
installedByUserId uuid     NOT NULL
createdAt / updatedAt
UNIQUE(workspaceId, provider)
```

### A.6 New columns on `workspaces`

```
automations_enabled        boolean NOT NULL DEFAULT true
automation_concurrency_cap int     NOT NULL DEFAULT 20
```

---

## §B Reference: GraphQL Contract

### Types

```graphql
type Automation {
  id: ID!
  workspaceId: ID!
  ownerUserId: ID
  name: String!
  description: String
  status: AutomationStatus!
  currentVersion: AutomationVersion
  versions(limit: Int = 10): [AutomationVersion!]!
  recentRuns(limit: Int = 20, status: AutomationRunStatus): [AutomationRun!]!
  createdByUser: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type AutomationVersion {
  id: ID!
  automationId: ID!
  version: Int!
  trigger: JSON!
  conditions: JSON
  steps: JSON!
  publishedAt: DateTime!
  publishedByUser: User!
}

type AutomationRun {
  id: ID!
  automationId: ID!
  automationVersionId: ID!
  status: AutomationRunStatus!
  triggerEvent: JSON!
  context: JSON
  steps: [AutomationStepRun!]!
  startedAt: DateTime
  finishedAt: DateTime
  errorCode: String
  errorMessage: String
  correlationId: String!
  createdAt: DateTime!
}

type AutomationStepRun {
  id: ID!
  stepIndex: Int!
  stepType: String!
  status: AutomationStepRunStatus!
  input: JSON
  output: JSON
  attempt: Int!
  errorCode: String
  errorMessage: String
  startedAt: DateTime
  finishedAt: DateTime
}

enum AutomationStatus        { DRAFT ENABLED DISABLED ARCHIVED }
enum AutomationRunStatus     { QUEUED RUNNING SUCCEEDED FAILED CANCELED SKIPPED_CONDITIONS }
enum AutomationStepRunStatus { PENDING RUNNING SUCCEEDED FAILED SKIPPED RETRYING }
```

### Inputs

```graphql
input CreateAutomationInput {
  workspaceId: ID!
  ownerUserId: ID
  name: String!
  description: String
  trigger: JSON!
  conditions: JSON
  steps: JSON!
}

input UpdateAutomationInput {
  id: ID!
  name: String
  description: String
  trigger: JSON
  conditions: JSON
  steps: JSON
}
```

### Queries

```graphql
extend type Query {
  automations(
    workspaceId: ID!
    status: AutomationStatus
    ownerUserId: ID
    limit: Int = 50
    cursor: String
  ): AutomationConnection!

  automation(id: ID!): Automation

  automationRuns(
    automationId: ID
    workspaceId: ID
    status: AutomationRunStatus
    since: DateTime
    limit: Int = 50
    cursor: String
  ): AutomationRunConnection!

  automationRun(id: ID!): AutomationRun
}

type AutomationConnection {
  nodes: [Automation!]!
  nextCursor: String
}

type AutomationRunConnection {
  nodes: [AutomationRun!]!
  nextCursor: String
}
```

### Mutations

```graphql
extend type Mutation {
  createAutomation(input: CreateAutomationInput!): Automation!
  updateAutomation(input: UpdateAutomationInput!): Automation!
  enableAutomation(id: ID!): Automation!
  disableAutomation(id: ID!): Automation!
  archiveAutomation(id: ID!): Automation!
  runAutomationManually(id: ID!, contextOverride: JSON): AutomationRun!
  retryAutomationRun(runId: ID!): AutomationRun!
  cancelAutomationRun(runId: ID!): AutomationRun!
}
```

---

## §C Reference: Execution Architecture

```
┌─────────────────┐    ┌──────────────────────────┐    ┌──────────────────────┐
│ gmail-sync /    │───▶│ AutomationEventBus       │───▶│ AutomationDispatcher │
│ outlook-sync /  │    │ (in-process, RxJS)       │    │ .onEvent()           │
│ email service / │    │                          │    │                      │
│ assignment svc  │    └──────────────────────────┘    │ - find matching      │
└─────────────────┘                                    │   enabled automations│
                                                       │ - evaluate conditions│
                                                       │ - enqueue runs       │
                                                       └──────────┬───────────┘
                                                                  │
                                          BullMQ "automations" queue (Redis)
                                                                  │
                                                       ┌──────────▼───────────┐
                                                       │ AutomationWorker     │
                                                       │ .processRun()        │
                                                       │                      │
                                                       │ - load AutomationVer │
                                                       │ - for step in steps: │
                                                       │     dispatch handler │
                                                       │     persist StepRun  │
                                                       │ - mark Run terminal  │
                                                       └──────────────────────┘
```

**Pieces:**

1. **`AutomationEventBus`** — RxJS Subject (T-BUS). Publishers: `gmail-sync` (T-GMAIL-PUB), `outlook-sync` (T-OUTLOOK-PUB), `email.service` (T-TR-REPLIED), `email-assignment.service` (T-TR-ASSIGNED), `automation-cron.scheduler` (T-TR-CRON).
2. **`AutomationDispatcherService`** (T-DISP) — subscribes once at module init, queries enabled matching automations, evaluates conditions in-process, creates `automation_runs` row in QUEUED state, enqueues a Bull job. Side-effect minimal.
3. **`AutomationWorkerProcessor`** (T-WORKER) — Bull `@Processor('automations')`. Loads version, runs steps sequentially with per-step retry (max 3, exp backoff), persists `automation_step_runs` as it goes, marks the run terminal. Reuses the BullMQ infra already in `email.module.ts:106-114` — register a new queue `'automations'` in the new `AutomationModule`.
4. **`AutomationCronScheduler`** (T-TR-CRON) — `@Cron('* * * * *')` every minute, enumerates `schedule.cron` automations whose next-fire is due, publishes a synthetic event into the bus.
5. **Cancellation** — `cancelAutomationRun` sets the Run status to `CANCELED`; `processRun` reads status before each step and aborts gracefully.

**Blast-radius safety (M3):**

- **Concurrency cap (T-CONC-CAP):** enforced at dispatcher via `Bull.Queue#getJobCounts({ states: ['active'] })` filtered by `workspaceId`. Cap on `workspaces.automation_concurrency_cap` (default 20).
- **Per-action rate limits (T-RATE):** in handlers via existing `common/rate-limit/` (Redis-backed). Hardcoded thresholds in v1.
- **Kill switch (T-KILL-SW):** `workspaces.automations_enabled`. Dispatcher reads from a 30-second in-process cache.
- **Loop detection (T-LOOP):** Redis sorted set `automation:loop:<workspaceId>:<automationId>` with run timestamps; trim to last 60 s; refuse if size > 10. Threshold env-tunable via `AUTOMATION_LOOP_THRESHOLD`.
- **Webhook HMAC key (T-INT-WEBHOOK):** per `workspace_integrations` row of provider `WEBHOOK_GENERIC`, a `crypto.randomBytes(32)` secret generated on install, stored in `encryptedSecret` via `encryptProviderSecret`. POSTs include `X-MailZen-Signature: sha256=<hex>` header.
- **AI credit metering (T-AICRED):** charged per `ai.*` step. Step output records `{ creditsConsumed: N }`.

---

## §D Reference: Reuse Map (file:line)

| Capability | Existing primitive | Where it lives | Used by task |
|---|---|---|---|
| User notifications | `NotificationEventBusService.publishSafely` | `notification/notification-event-bus.service.ts:24` | T-ACT-NOTIF |
| AI classification | `InboxAiService.classifyThread` | `ai-agent-gateway/inbox-ai.service.ts` | T-ACT-AICLS |
| AI summarize | `InboxAiService` (extend if missing) | `ai-agent-gateway/` | T-ACT-AISUM |
| AI draft reply | `SmartReplyService` | `smart-replies/smart-reply.service.ts` | T-ACT-AIRPLY |
| Email mutations | `EmailService` | `email/email.service.ts` | T-ACT-LBL/ARC/DRAFT-C/DRAFT-S |
| Thread assignment | `EmailAssignmentService.assignThread` | `email/email-assignment.service.ts` | T-ACT-ASGN |
| Job queue | BullMQ + Redis | `email/email.module.ts:106-114`, `email/email.email-scheduler.service.ts:12,17,106` | T-MOD, T-WORKER, T-ACT-DELAY |
| Cron | `@nestjs/schedule` `@Cron` | `inbox-triage.service.ts:201` | T-TR-CRON |
| Structured logging | `serializeStructuredLog` | `common/logging/structured-log.util.ts:110` | All tasks |
| Correlation IDs | `resolveCorrelationId` | `common/logging/structured-log.util.ts:116` | T-DISP, T-WORKER |
| Audit log | `AuditLog` entity | `auth/entities/audit-log.entity.ts` | T-AUDIT, T-RESM |
| Workspace tenancy | `Workspace` + `WorkspaceMember.role` | `workspace/entities/*.ts` | T-GUARD, T-DISP |
| Secret encryption | `encryptProviderSecret` / `decryptProviderSecret` (AES-256-GCM, key-rotation) | `common/provider-secrets.util.ts:132,168` | T-INT-WEBHOOK, T-INT-SLACK |
| GraphQL JSON scalar | `graphql-type-json` (already in deps) | `user-notification.entity.ts:45` | T-ENT |
| Filter rule semantics | `FilterCondition` / `FilterAction` enums | `email/dto/email-filter.input.ts` | T-MIGFILT |
| Notification Cron retention pattern | `ai-agent-action-audit-retention.scheduler.ts` | `ai-agent-gateway/` | T-RETN |
| Test mock pattern | `{ provide: ServiceName, useValue: { method: jest.fn() } }` | `email-filter.service.spec.ts:54` | All `*.spec.ts` |

---

## §E Reference: Files

### Create

```
apps/backend/src/automation/
├── automation.module.ts
├── automation.resolver.ts
├── automation.service.ts
├── automation-event.bus.ts
├── automation-dispatcher.service.ts
├── automation-worker.processor.ts
├── automation-cron.scheduler.ts
├── automation-migration-from-filter.service.ts
├── condition-evaluator.ts
├── README.md
├── guards/
│   └── workspace-admin.guard.ts
├── entities/
│   ├── automation.entity.ts
│   ├── automation-version.entity.ts
│   ├── automation-run.entity.ts
│   ├── automation-step-run.entity.ts
│   └── workspace-integration.entity.ts
├── triggers/
│   ├── trigger.interface.ts
│   ├── email-received.trigger.ts
│   ├── email-thread-replied.trigger.ts
│   ├── email-thread-assigned.trigger.ts
│   ├── email-label-added.trigger.ts
│   ├── schedule-cron.trigger.ts
│   └── manual.trigger.ts
├── actions/
│   ├── action.interface.ts
│   ├── email-label.action.ts
│   ├── email-archive.action.ts
│   ├── email-assign.action.ts
│   ├── email-draft-create.action.ts
│   ├── email-draft-send.action.ts
│   ├── ai-classify.action.ts
│   ├── ai-summarize.action.ts
│   ├── ai-draft-reply.action.ts
│   ├── notify-user.action.ts
│   ├── notify-slack.action.ts
│   ├── webhook-post.action.ts
│   └── delay.action.ts
├── integrations/
│   └── slack-integration.service.ts
└── dto/
    ├── automation.input.ts
    ├── automation-run.connection.ts
    └── automation.connection.ts

apps/backend/src/database/migrations/
└── <unix-ts>-AutomationEngine.ts        # 5 new tables + 2 new columns on `workspaces`

apps/backend/scripts/
└── migrate-email-filters.ts              # one-time migration runner

libs/shared-types/src/
├── automation.types.ts                   # discriminated unions for trigger/condition/action
└── automation.schemas.ts                 # ajv JSON schemas

apps/frontend/app/(dashboard)/automations/
├── page.tsx                              # list view
├── new/page.tsx                          # create
├── [id]/page.tsx                         # detail + recent runs
└── [id]/runs/[runId]/page.tsx            # run audit timeline

apps/frontend/lib/apollo/queries/automations.ts
apps/frontend/components/automation/      # form, run-timeline, status-pill, etc.

scripts/
└── bootstrap-automation-beads.sh         # §3 task graph bootstrap
```

### Modify

| File | Change | Task |
|---|---|---|
| `apps/backend/src/app.module.ts` | Import `AutomationModule` | T-MOD |
| `apps/backend/src/gmail-sync/gmail-sync.service.ts` | Publish `email.received` after persist | T-GMAIL-PUB |
| `apps/backend/src/outlook-sync/outlook-sync.service.ts` | Publish `email.received` after persist | T-OUTLOOK-PUB |
| `apps/backend/src/email/email.service.ts` | Publish `email.thread.replied` on outbound send | T-TR-REPLIED |
| `apps/backend/src/email/email-assignment.service.ts` | Publish `email.thread.assigned` (alongside existing notification) | T-TR-ASSIGNED |
| `apps/backend/src/email/email.email-filter.resolver.ts` | Add `description: '@deprecated …'` to queries/mutations | T-DEP-FILT |
| `apps/backend/package.json` | Add `ajv` dep | T-SCHEMA |
| `apps/frontend/components/layout/dashboard-nav.config.ts` | Add "Automations" nav entry | T-FE-NAV |
| `apps/backend/src/workspace/entities/workspace.entity.ts` | Add `automationsEnabled`, `automationConcurrencyCap` columns | T-MIG (ent change) + T-KILL-SW + T-CONC-CAP |

---

## §F Glossary

- **Trigger** — the event type that starts an automation (`email.received`, `schedule.cron`, ...).
- **Condition** — a boolean expression evaluated against the trigger event before any step runs.
- **Step** — one action in an automation's ordered step list.
- **Run** — one execution. Holds a pointer to the AutomationVersion that started it.
- **StepRun** — one attempt of one step in one run. Multiple StepRuns per (run, stepIndex) when retried.
- **Workspace integration** — encrypted credential record for an external service (Slack, webhook, etc.).
- **Automation Version** — immutable snapshot of trigger + conditions + steps. Edits create new versions.
- **Correlation ID** — UUID propagated through structured logs for one run, used to grep all logs from one execution.

---

*End of plan. If you find a gap or contradiction, file a bug:*

```bash
bd create "Found gap: <one-line>" -t bug -p 1 --deps discovered-from:<your-current-task-id> --json
```
