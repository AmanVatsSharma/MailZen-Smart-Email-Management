#!/usr/bin/env bash
# File:        scripts/bootstrap-automation-beads.sh
# Module:      Automation Engine · Task tracker bootstrap
# Purpose:     One-time creation of the Automation Engine + B2B v1 task graph in beads
#              (4 epics + 58 tasks with dependencies wired). Mirrors the plan at
#              docs/plans/automation-engine-v1.md (§3 Beads Bootstrap).
#
# Usage:
#   bash scripts/bootstrap-automation-beads.sh   — run from repo root, ONCE, after `bd init mz`.
#
# Side-effects:
#   - Creates 62 issues in the local beads database (.beads/).
#   - Adds dependency edges between issues.
#   - No filesystem writes outside .beads/.
#
# Key invariants:
#   - Idempotency: this script is NOT idempotent. Running twice creates duplicates.
#     To re-run cleanly: `rm -rf .beads && bd init mz && bash scripts/bootstrap-automation-beads.sh`.
#   - Required tools: bd v1.0.3+ in PATH, jq in PATH, git repo, .beads/ initialized.
#   - Task slug convention: every issue title starts with `[T-XXX]` so agents can grep
#     into the canonical plan file (docs/plans/automation-engine-v1.md → §4 Task Graph).
#
# Author:      Aman (with Claude)
# Last-updated: 2026-05-02

set -euo pipefail

command -v bd >/dev/null || { echo "bd not in PATH — install beads >=1.0.3"; exit 1; }
command -v jq >/dev/null || { echo "jq not in PATH"; exit 1; }
[ -d .beads ] || { echo ".beads/ not found — run 'bd init mz' first"; exit 1; }

mkbd() {
  # mkbd <slug> <title> <type> <priority>  — returns issue id
  local slug="$1" title="$2" type="$3" prio="$4"
  bd create "[${slug}] ${title}" -t "${type}" -p "${prio}" --json | jq -r .id
}

dep() {
  # dep <blocker_id> <blocked_id>  — blocker must complete before blocked can start.
  # bd CLI: `bd dep add A B` means "A depends on B" (A is blocked by B).
  # So when blocker must finish first, blocked is the one that depends on blocker:
  bd dep add "$2" "$1" >/dev/null
}

echo "Creating epics..."
EPIC=$(mkbd "EPIC" "Automation Engine + Sellable B2B v1" epic 1)
M1=$(mkbd   "M1"   "Engine Alpha (T+0 → T+30)"            epic 1)
M2=$(mkbd   "M2"   "Beta + Integrations (T+30 → T+60)"    epic 2)
M3=$(mkbd   "M3"   "Production Hardening + Sellable (T+60 → T+90)" epic 2)
dep "$M1" "$EPIC" ; dep "$M2" "$EPIC" ; dep "$M3" "$EPIC"
dep "$M1" "$M2"   ; dep "$M2" "$M3"

echo "Creating M1 tasks..."
T_DBMIG=$(mkbd       "T-MIG"        "DB migration: 5 automation tables + 2 workspace columns" task 1)
T_ENT=$(mkbd         "T-ENT"        "TypeORM entities for 5 tables"                          task 1)
T_MOD=$(mkbd         "T-MOD"        "AutomationModule scaffold + DI"                         task 1)
T_BUS=$(mkbd         "T-BUS"        "AutomationEventBus (RxJS Subject)"                      task 1)
T_INT=$(mkbd         "T-INT"        "Trigger + Action handler interfaces"                    task 1)
T_SCHEMA=$(mkbd      "T-SCHEMA"     "JSON schemas + ajv runtime validation"                  task 1)
T_TR_RX=$(mkbd       "T-TR-RX"      "Trigger: email.received"                                task 1)
T_TR_MAN=$(mkbd      "T-TR-MAN"     "Trigger: manual"                                        task 2)
T_GMAIL_PUB=$(mkbd   "T-GMAIL-PUB"  "Wire gmail-sync to publish email.received"              task 1)
T_OUTLOOK_PUB=$(mkbd "T-OUTLOOK-PUB" "Wire outlook-sync to publish email.received"           task 1)
T_COND=$(mkbd        "T-COND"       "Condition evaluator (boolean tree)"                     task 1)
T_ACT_LBL=$(mkbd     "T-ACT-LBL"    "Action: email.label.add / email.label.remove"           task 1)
T_ACT_ARC=$(mkbd     "T-ACT-ARC"    "Action: email.archive"                                  task 1)
T_ACT_ASGN=$(mkbd    "T-ACT-ASGN"   "Action: email.assign"                                   task 1)
T_ACT_NOTIF=$(mkbd   "T-ACT-NOTIF"  "Action: notify.user"                                    task 1)
T_ACT_AICLS=$(mkbd   "T-ACT-AICLS"  "Action: ai.classify"                                    task 1)
T_DISP=$(mkbd        "T-DISP"       "AutomationDispatcherService"                            task 1)
T_WORKER=$(mkbd      "T-WORKER"     "AutomationWorkerProcessor (Bull)"                       task 1)
T_GUARD=$(mkbd       "T-GUARD"      "WorkspaceAdminGuard"                                    task 1)
T_RESQ=$(mkbd        "T-RESQ"       "Resolver: queries + cursor pagination"                  task 1)
T_RESM=$(mkbd        "T-RESM"       "Resolver: mutations"                                    task 1)
T_MIGFILT=$(mkbd     "T-MIGFILT"    "Migration job: EmailFilter → Automation (DISABLED)"     task 1)
T_DEP_FILT=$(mkbd    "T-DEP-FILT"   "Mark old EmailFilter resolver @deprecated"              task 3)
T_FE_NAV=$(mkbd      "T-FE-NAV"     "Frontend: dashboard nav entry + apollo queries"         task 2)
T_FE_LIST=$(mkbd     "T-FE-LIST"    "Frontend: automations list page"                        task 1)
T_FE_NEW=$(mkbd      "T-FE-NEW"     "Frontend: create automation (JSON form)"                task 1)
T_FE_DETAIL=$(mkbd   "T-FE-DETAIL"  "Frontend: detail page + run timeline"                   task 1)
T_DOCS=$(mkbd        "T-DOCS"       "automation/README.md"                                   task 3)
T_SMOKE=$(mkbd       "T-SMOKE"      "Manual smoke test: M1 alpha gate"                       task 1)

# Note: beads disallows task→epic block edges. Epics serve as organizational labels;
# task-to-epic membership is tracked via title slugs (e.g., [T-MIG] → M1) rather than
# dep edges. Use `bd list | grep '\[T-'` to filter M1 tasks.

echo "Wiring M1 dependencies..."
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
dep "$T_ACT_LBL"   "$T_WORKER"
dep "$T_ACT_ARC"   "$T_WORKER"
dep "$T_ACT_ASGN"  "$T_WORKER"
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

echo "Creating M2 tasks..."
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

# M2 task → M2 epic membership tracked by title slug, not dep edges.

# Cross-milestone gate: M1 must be done first
dep "$T_SMOKE" "$T_TR_REPLIED"
dep "$T_INT_WEBHOOK" "$T_ACT_WEBHOOK"
dep "$T_INT_SLACK" "$T_ACT_SLACK"
dep "$T_ACT_SLACK" "$T_PARTNERS"
dep "$T_ACT_AIRPLY" "$T_PARTNERS"
dep "$T_FE_ENABLE" "$T_PARTNERS"

echo "Creating M3 tasks..."
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

# M3 task → M3 epic membership tracked by title slug.
dep "$T_PARTNERS" "$T_KILL_SW"
dep "$T_KILL_SW"  "$T_BILLING"
dep "$T_CONC_CAP" "$T_BILLING"
dep "$T_AICRED"   "$T_BILLING"
dep "$T_BILLING"  "$T_SELL"
dep "$T_E2E"      "$T_SELL"

echo
echo "✓ Bootstrap complete."
echo "  Issues created:  $(bd list --json | jq 'length')"
echo "  Plan reference:  docs/plans/automation-engine-v1.md"
echo "  Next:            bd ready --json"
