# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

MailZen is an AI-powered email management platform. It is a **npm workspaces + Nx monorepo** with three applications:

- `apps/backend/` — NestJS GraphQL API (port 4000)
- `apps/frontend/` — Next.js 15 app router (port 3000)
- `apps/marketing/` — Marketing/public pages

Shared library: `libs/shared-types/` — TypeScript types shared between frontend and backend.

## Common commands

All commands run from the repo root unless noted.

### Development

```bash
npm run dev                   # frontend + backend (parallel)
npm run dev:lite              # frontend + backend only (no ai-agent)
npm run dev:frontend          # frontend only
npm run dev:backend           # backend only
```

`nx serve backend` and `nx serve frontend` both auto-run `tools/ensure-env.js` first (creates `.env` / `.env.local` without overwriting existing files).

### Build & lint

```bash
npm run build                 # frontend + backend
npm run lint                  # frontend + backend
nx build frontend
nx build backend
nx lint marketing
```

### Testing

```bash
# Backend (from repo root or apps/backend/)
nx test backend               # all backend tests
nx test backend --testFile=src/email/email.service.spec.ts  # single file

# Frontend
nx test frontend              # all frontend unit tests
nx test frontend --testFile=src/components/...  # single file
cd apps/frontend && npx playwright test         # e2e
```

### Database migrations (run from `apps/backend/`)

```bash
npm run migration:generate -- --name=<MigrationName>
npm run migration:run
npm run migration:revert
npm run migration:show
```

In local development `synchronize: true` is active by default (auto-sync schema). Migrations are used for staging/production.

### Backend contract/quality checks (from `apps/backend/`)

```bash
npm run check:migration:contracts
npm run check:schema:contracts
npm run check:no-console-usage       # enforces structured logger usage
npm run check:structured-logger-usage
npm run check:doc:flowcharts
```

### Database seeding (from `apps/backend/`)

```bash
npm run seed:demo          # seed demo data (idempotent)
npm run seed:demo:fresh    # drop and re-seed demo data
```

### Workspace backfill (from `apps/backend/`)

```bash
npm run backfill:workspace-scopes           # dry-run preview
npm run backfill:workspace-scopes:apply     # apply scope backfill
```

## Architecture

### Backend (NestJS, `apps/backend/src/`)

Code-first GraphQL schema (`schema.gql` is auto-generated). Key modules:

| Module | Purpose |
|--------|---------|
| `auth/` | JWT + OAuth (Google/Microsoft), HttpOnly cookie sessions, refresh tokens |
| `user/` | User accounts |
| `workspace/` | Multi-tenant workspace/team model with RBAC |
| `billing/` | SaaS plan catalog, subscriptions, AI credit tracking, webhook ingestion |
| `email/` | Core email CRUD, templates, scheduling, warmup, filters |
| `mailbox/` | Mailbox (provider inbox) management |
| `inbox/` + `unified-inbox/` | Unified inbox aggregation across providers |
| `gmail-sync/` | Gmail OAuth sync, Pub/Sub push webhooks, incremental history sync |
| `outlook-sync/` | Microsoft/Outlook OAuth sync |
| `smart-replies/` | AI-assisted reply generation |
| `inbox-triage/` | AI-powered inbox triage |
| `sender-intelligence/` | Sender behavior analytics |
| `contacts/` | Contact management |
| `notification/` | Notification pipeline |
| `email-analytics/` | Open/click tracking |
| `organization/` | Labels |
| `ai-agent-gateway/` | Gateway to external AI agent platform |
| `feature/` | Feature flags |
| `health/` | Health check endpoint |
| `common/` | Guards (`JwtAuthGuard`, `AdminGuard`), structured logging util, decorators, rate limiting |
| `automation/` | Workspace-scoped "when X → do Y" engine: event bus (RxJS), dispatcher, Bull queue worker, condition evaluator |
| `email-integration/` | Email provider management (Gmail/Outlook/SMTP), credential encryption at rest, OAuth token refresh, sync lease coordination |
| `scheduled-email/` | Deferred/scheduled email send management |
| `template/` | Email template CRUD |
| `phone/` | Phone OTP verification for authenticated users and phone-first signup |

**Auth model**: HttpOnly `token` cookie for session; refresh token passed as body parameter (stored in localStorage on frontend until backend supports cookie refresh).

**Database**: PostgreSQL via TypeORM. `synchronize: true` in local dev only; production uses explicit migrations. Connection pool configured via `TYPEORM_POOL_MAX` / `TYPEORM_IDLE_TIMEOUT_MS`.

**Schema synchronization**: `TYPEORM_SYNCHRONIZE=false` or setting `CI=true` disables auto-sync.

**Queue infrastructure**: The automation engine uses **Bull + Redis**. Required in any environment running automations: `REDIS_HOST` (default `localhost`), `REDIS_PORT` (default `6379`). Loop-detection threshold: `AUTOMATION_LOOP_THRESHOLD` (default `10` runs/60 s).

**Automation engine**: `AutomationEventBus` (RxJS Subject) is the in-process pub/sub backbone. Email sync modules publish events; `AutomationDispatcher` evaluates conditions and enqueues Bull jobs; `AutomationWorker` executes steps. `AutomationVersion` is **immutable** — `updateAutomation` always creates a new version row, never mutates a published one.

### Frontend (Next.js 15, `apps/frontend/`)

Uses the App Router. Key directories:

- `app/` — Route segments: `(dashboard)/` for authenticated views, `auth/` for login/register
- `components/` — Organized by domain: `email/`, `layout/`, `ai/`, `auth/`, `premium/`, `ui/`
- `lib/apollo/` — Apollo Client setup (HttpOnly cookie auth, auto token refresh via error link)
- `lib/auth/` — Auth utilities
- `providers/` — React context providers (ApolloProvider, ThemeProvider)
- `middleware.ts` — Route protection: redirects unauthenticated users to `/auth/login`; public paths: `/auth/*`

**GraphQL client**: Apollo Client with `credentials: 'include'` (cookies). The error link intercepts 401s to attempt token refresh before retrying.

**UI stack**: Tailwind CSS v4, shadcn/ui (Radix UI primitives), Framer Motion, Lucide icons. Primary brand color: purple `hsl(265 89% 60%)`.

**Forms**: React Hook Form + Zod validation.

**Observability**: Sentry integrated in both frontend and backend (source maps uploaded only when `SENTRY_AUTH_TOKEN` is set).

### Shared types (`libs/shared-types/`)

Shared TypeScript types consumed by both `apps/backend` and `apps/frontend` via the `@mailzen/shared-types` workspace alias.

## Environment setup

Environment files are auto-created by `tools/ensure-env.js` on first `nx serve`. To reset to defaults, delete the file and re-run.

**Backend** (`apps/backend/.env`) — key vars:
```
DATABASE_URL=postgresql:///mailzen?host=/var/run/postgresql
PORT=4000
JWT_SECRET=<generated>
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI      # login OAuth
GOOGLE_PROVIDER_REDIRECT_URI=http://localhost:4000/email-integration/google/callback
OUTLOOK_PROVIDER_REDIRECT_URI=http://localhost:4000/email-integration/microsoft/callback
PROVIDER_SECRETS_KEYRING / PROVIDER_SECRETS_ACTIVE_KEY_ID           # credential encryption at rest
REDIS_HOST=localhost / REDIS_PORT=6379                              # automation Bull queue
MAILZEN_SMS_PROVIDER=CONSOLE                                        # CONSOLE|WEBHOOK|TWILIO|DISABLED
```

**Note**: Login OAuth (`GOOGLE_REDIRECT_URI`) and provider-linking OAuth (`GOOGLE_PROVIDER_REDIRECT_URI`) use **separate redirect URIs** pointing to different backend controllers (`/auth/google/callback` vs `/email-integration/google/callback`).

**Frontend** (`apps/frontend/.env.local`) — key vars:
```
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
```

PostgreSQL database must exist: `createdb mailzen`. The default `DATABASE_URL` uses peer auth via Unix socket (Fedora/Ubuntu). For Docker use a TCP URL.

## GraphQL schema

Auto-generated at `apps/backend/src/schema.gql`. Do not edit it manually — it is regenerated on each `nx serve backend` / `nest build`. Add/modify resolvers and entity decorators instead.

## Shell commands in scripts/agents

Always use non-interactive flags to avoid hanging on confirmation prompts (some systems alias `cp`/`mv`/`rm` to interactive mode):

```bash
cp -f source dest    # NOT: cp source dest
mv -f source dest    # NOT: mv source dest
rm -f file           # NOT: rm file
rm -rf dir           # NOT: rm -r dir
```


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

