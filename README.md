# MailZen

MailZen is an AI-powered business inbox that helps teams manage email faster,
with more control and less operational chaos.

## Product overview (non-technical)

MailZen brings business communication into one workflow:

- Connect inbox providers (Gmail/Outlook and additional provider flows)
- Manage conversations in a unified workspace inbox
- Use AI assistance for summaries, reply drafting, and follow-up workflows
- Monitor sync and mailbox health with operational visibility
- Support business governance with retention and admin export controls

### One-line positioning

**MailZen turns email chaos into business clarity.**

### Who this is for

- Founders and business owners
- Sales and customer-facing teams
- Operations and support teams
- Agencies handling multiple inbox workflows

### Marketing/public pages available in frontend app router

- `/` (home)
- `/features`
- `/pricing`
- `/integrations`
- `/security`
- `/about`
- `/contact`
- `/privacy`
- `/terms`

## Core platform capabilities

- Unified inbox and dashboard workflows
- Provider connection and sync operations
- Smart replies and AI-assisted inbox actions
- Notification and alerting pipelines
- Billing/workspace/user/account operations
- Admin-guarded export and compliance workflows
- Structured observability and audit logging across critical actions

## Project structure

- `apps/frontend/`: Next.js application
- `apps/backend/`: NestJS application
- `nx.json`: Nx workspace configuration (task orchestration)
- `tools/`: workspace tooling scripts (env bootstrap, etc.)

## Prerequisites

- Node.js (v16+)
- npm or yarn
- PostgreSQL database

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/AmanVatsSharma/MailZen-Ai-Smart-Email-Management
   cd mailzen
   ```

2. Install dependencies for both frontend and backend:
   ```bash
   npm install
   ```

3. Set up environment variables (automatic for dev):
   - `nx serve backend` and `nx serve frontend` run `tools/ensure-env.js` first.
   - It creates:
     - `apps/backend/.env`
     - `apps/frontend/.env.local`
   - It **never overwrites** existing files.
     - If you want fresh defaults/secrets: delete the file and run `nx serve ...` again.

4. Set up PostgreSQL:
   - Ensure a database exists (default name: `mailzen`):
     - `createdb mailzen`
   - Default dev DB URL uses a unix socket (good for Linux peer auth):
     - `DATABASE_URL=postgresql:///mailzen?host=/var/run/postgresql`
   - For Docker/password auth, override `DATABASE_URL` to a TCP URL.

## Running the application

### Development mode

To run both frontend and backend concurrently:

```bash
npm run dev
```

To run them separately:

```bash
# Frontend (http://localhost:3000)
npm run dev:frontend

# Backend (http://localhost:4000)
npm run dev:backend
```

You can also use Nx directly:

```bash
nx serve frontend
nx serve backend
nx run-many -t serve -p frontend backend --parallel=2
```

### “Product works” mode (no provider connections yet)

- The app runs end-to-end **without connecting Gmail/Microsoft/SMTP**.
- Inbox renders empty folders/labels/messages until a provider is connected.
- Provider OAuth is intended to be configured at deploy-time.

### Production build

```bash
# Build both
npm run build
```

### Dev startup flow (Nx)

```mermaid
flowchart TD
  userRunsDev[UserRunsNpmDev] --> nxRunMany[NxRunManyServeFrontendBackend]
  nxRunMany --> frontendPrepare[frontend:prepare-env]
  nxRunMany --> backendPrepare[backend:prepare-env]
  frontendPrepare --> frontendServe[frontend:serve]
  backendPrepare --> backendServe[backend:serve]
  frontendPrepare --> envScript[toolsEnsureEnvScript]
  backendPrepare --> envScript
```

## API documentation

The GraphQL API is available at `http://localhost:4000/graphql` when the backend is running.

## Authentication

The application uses JWT for authentication. To access protected routes, you need to:

1. Register or login to get a JWT token
2. Include the token in the Authorization header for API requests

Note: the browser app is designed around **HttpOnly cookies** for the session; the GraphQL API also supports Authorization headers for non-browser clients.

## Environment variables

### Frontend (`.env.local`)

```
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_ENABLE_EMAIL_WARMUP=true
NEXT_PUBLIC_ENABLE_SMART_REPLIES=true
NEXT_PUBLIC_ENABLE_EMAIL_TRACKING=true
NEXT_PUBLIC_DEFAULT_THEME=system
```

### Backend (`.env`)

```
# Database
# - Fedora/Ubuntu local Postgres often uses peer auth via unix socket:
#     postgresql:///mailzen?host=/var/run/postgresql
# - Docker/local password auth often uses TCP:
#     postgresql://postgres:postgres@localhost:5432/mailzen
DATABASE_URL=postgresql:///mailzen?host=/var/run/postgresql
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=<generated>
JWT_EXPIRATION=86400
ENABLE_EMAIL_WARMUP=true
ENABLE_SMART_REPLIES=true
ENABLE_EMAIL_TRACKING=true
```

### Provider OAuth (deploy-time)

- **Google login OAuth** (`/auth/google/*`)
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`

Without these, the server still boots; the Google OAuth endpoints will report “not configured”.

## EC2 deployment (Domain + HTTPS + Docker)

For production-style EC2 deployment, use the deployment module:

- `deploy/ec2/docker-compose.yml`
- `deploy/ec2/Caddyfile` (automatic HTTPS termination)
- `deploy/ec2/scripts/*` (operator-friendly setup/deploy/ops scripts)

### Quick start

```bash
# Fastest path for non-technical launch
# (setup + docs-check + host-readiness + dns + ssl + ports + preflight + deploy + verify + status)
./deploy/ec2/scripts/launch.sh

# Non-interactive launch when env is already configured
./deploy/ec2/scripts/launch.sh --skip-setup

# Optional: enforce strict docs coverage during launch
./deploy/ec2/scripts/launch.sh --docs-strict-coverage

# Optional: skip docs consistency check during launch
./deploy/ec2/scripts/launch.sh --skip-docs-check

# Optional: skip selected prechecks
./deploy/ec2/scripts/launch.sh --skip-host-readiness --skip-dns-check --skip-ssl-check --skip-ports-check

# Optional: config-only + dry-run launch (daemon-offline validation)
./deploy/ec2/scripts/launch.sh \
  --skip-setup \
  --skip-dns-check \
  --skip-ssl-check \
  --preflight-config-only \
  --deploy-dry-run \
  --skip-verify

# Optional: config-only + dry-run launch without final status step
./deploy/ec2/scripts/launch.sh \
  --skip-setup \
  --preflight-config-only \
  --deploy-dry-run \
  --skip-verify \
  --skip-status

# Optional: config-only + build-check + deploy dry-run launch rehearsal
./deploy/ec2/scripts/launch.sh \
  --skip-setup \
  --preflight-config-only \
  --with-build-check \
  --build-check-dry-run \
  --deploy-dry-run \
  --skip-verify \
  --skip-status

# Optional: launch with explicit setup inputs
./deploy/ec2/scripts/launch.sh \
  --domain mail.example.com \
  --acme-email ops@example.com \
  --setup-skip-daemon

# Optional: launch while requiring OAuth smoke check in verify step
./deploy/ec2/scripts/launch.sh --verify-require-oauth-check

# Optional: launch with build-check chaining before deploy
./deploy/ec2/scripts/launch.sh --with-build-check --build-check-dry-run

# Optional: launch with targeted build-check services and pull
./deploy/ec2/scripts/launch.sh \
  --with-build-check \
  --build-check-service backend \
  --build-check-service frontend \
  --build-check-pull

# Optional: launch with build-check image pull-check rehearsal for image-only services
./deploy/ec2/scripts/launch.sh \
  --with-build-check \
  --build-check-with-image-pull-check \
  --build-check-image-service caddy \
  --build-check-image-service postgres \
  --build-check-dry-run

# Optional: launch with runtime-smoke chaining after deploy/verify
./deploy/ec2/scripts/launch.sh \
  --with-runtime-smoke \
  --runtime-smoke-max-retries 15 \
  --runtime-smoke-retry-sleep 4

# Optional: launch with runtime-smoke dry-run rehearsal
./deploy/ec2/scripts/launch.sh --with-runtime-smoke --runtime-smoke-dry-run

# Optional: launch while skipping OAuth/SSL verify checks
./deploy/ec2/scripts/launch.sh --verify-skip-oauth-check --verify-skip-ssl-check

# Optional: launch with custom runtime ports-check targets
./deploy/ec2/scripts/launch.sh --ports-check-ports 80,443,8100

# Optional: launch status runtime checks while skipping DNS/SSL in final status step
./deploy/ec2/scripts/launch.sh --status-runtime-checks --status-skip-dns-check --status-skip-ssl-check

# Optional: launch status runtime checks while skipping host/ports in final status step
./deploy/ec2/scripts/launch.sh --status-runtime-checks --status-skip-host-readiness --status-skip-ports-check

# Optional: interactive menu for non-technical operators
./deploy/ec2/scripts/menu.sh

# Menu includes guided prompts for setup/deploy/verify/logs/update/restart/stop operations,
# docs consistency checks, runtime smoke checks, and pipeline validation with optional build/verify/runtime-smoke/status chaining
# (useful for non-technical EC2 operators)

# Maintainer note: shared helper library (sourced by scripts; not run directly)
./deploy/ec2/scripts/common.sh

# Optional on fresh Ubuntu EC2: install Docker + Compose
sudo ./deploy/ec2/scripts/bootstrap-ubuntu.sh

# 1) Prepare production env safely
./deploy/ec2/scripts/setup.sh

# 2) Validate env + compose config
./deploy/ec2/scripts/preflight.sh

# Optional: config-only validation (skip daemon connectivity check)
./deploy/ec2/scripts/preflight.sh --config-only

# Optional: extended runtime checks (host/dns/ssl/ports)
./deploy/ec2/scripts/preflight.sh --with-runtime-checks

# Optional: runtime checks with custom ports-check targets
./deploy/ec2/scripts/preflight.sh --with-runtime-checks --ports-check-ports 80,443,8100

# Optional: validate image builds before deployment
./deploy/ec2/scripts/build-check.sh

# Optional: validate image builds with pull/no-cache
./deploy/ec2/scripts/build-check.sh --pull --no-cache

# Optional: validate selected image builds in dry-run mode
./deploy/ec2/scripts/build-check.sh --service backend --service frontend --dry-run

# Optional: validate build + image pull checks for image-only services
./deploy/ec2/scripts/build-check.sh --with-image-pull-check --dry-run

# Optional: validate build + selected image pull-check services
./deploy/ec2/scripts/build-check.sh --with-image-pull-check --image-service caddy --image-service postgres --dry-run

# Optional: confirm domain DNS resolution before cutover
./deploy/ec2/scripts/dns-check.sh

# Optional: validate HTTPS certificate status/expiry
./deploy/ec2/scripts/ssl-check.sh

# Optional: validate host baseline resources
./deploy/ec2/scripts/host-readiness.sh

# Optional: ensure host ports 80/443 are free before first deploy
./deploy/ec2/scripts/ports-check.sh

# Optional: validate custom host port set (comma-separated)
./deploy/ec2/scripts/ports-check.sh --ports 80,443,8100

# Optional: redacted audit of critical deploy env keys
./deploy/ec2/scripts/env-audit.sh

# Optional: generate diagnostics report for troubleshooting
./deploy/ec2/scripts/doctor.sh

# Optional: CI-friendly diagnostics with seeded temporary env
./deploy/ec2/scripts/doctor.sh --seed-env

# Optional: diagnostics with custom ports-check targets
./deploy/ec2/scripts/doctor.sh --ports-check-ports 80,443,8100

# Optional: diagnostics with strict docs coverage checks
./deploy/ec2/scripts/doctor.sh --docs-strict-coverage

# Optional: diagnostics with strict docs coverage including common.sh helper coverage
./deploy/ec2/scripts/doctor.sh --docs-strict-coverage --docs-include-common

# Optional: diagnostics while skipping docs consistency checks
./deploy/ec2/scripts/doctor.sh --skip-docs-check

# Optional: strict diagnostics mode
./deploy/ec2/scripts/doctor.sh --strict

# Optional: generate support bundle archive for troubleshooting
./deploy/ec2/scripts/support-bundle.sh
# (captures docs-check output/skip marker + diagnostics logs + bundle manifest)

# Optional: support bundle with seeded temporary env
./deploy/ec2/scripts/support-bundle.sh --seed-env

# Optional: support bundle with custom ports-check targets
./deploy/ec2/scripts/support-bundle.sh --ports-check-ports 80,443,8100

# Optional: support bundle with strict docs coverage checks
./deploy/ec2/scripts/support-bundle.sh --docs-strict-coverage

# Optional: support bundle with strict docs coverage including common.sh helper coverage
./deploy/ec2/scripts/support-bundle.sh --docs-strict-coverage --docs-include-common

# Optional: support bundle while skipping docs consistency checks
./deploy/ec2/scripts/support-bundle.sh --skip-docs-check

# Optional: keep support bundle temp work directory for troubleshooting
./deploy/ec2/scripts/support-bundle.sh --seed-env --keep-work-dir

# Optional: prune old diagnostics report artifacts
./deploy/ec2/scripts/reports-prune.sh
./deploy/ec2/scripts/reports-prune.sh --keep-count 50 --dry-run

# Optional: rotate app secrets (JWT/OAuth/platform key)
./deploy/ec2/scripts/rotate-app-secrets.sh --yes
./deploy/ec2/scripts/rotate-app-secrets.sh --keys JWT_SECRET --dry-run

# Optional: run config-only deployment pipeline checks
./deploy/ec2/scripts/pipeline-check.sh

# Optional: run pipeline checks with seeded temporary env
./deploy/ec2/scripts/pipeline-check.sh --seed-env

# Optional: run pipeline checks with custom ports-check targets
./deploy/ec2/scripts/pipeline-check.sh --ports-check-ports 80,443,8100

# Optional: run pipeline checks plus build-check rehearsal
./deploy/ec2/scripts/pipeline-check.sh --with-build-check --build-check-dry-run

# Optional: run pipeline checks plus targeted build checks
./deploy/ec2/scripts/pipeline-check.sh \
  --with-build-check \
  --build-check-service backend \
  --build-check-service frontend \
  --build-check-pull

# Optional: run pipeline checks plus build-check image pull-check rehearsal
./deploy/ec2/scripts/pipeline-check.sh \
  --with-build-check \
  --build-check-with-image-pull-check \
  --build-check-image-service caddy \
  --build-check-image-service postgres \
  --build-check-dry-run

# Optional: run pipeline checks plus runtime smoke checks (dry-run)
./deploy/ec2/scripts/pipeline-check.sh --with-runtime-smoke --runtime-smoke-dry-run

# Optional: run pipeline checks plus runtime smoke checks with tuned retries
./deploy/ec2/scripts/pipeline-check.sh \
  --with-runtime-smoke \
  --runtime-smoke-max-retries 15 \
  --runtime-smoke-retry-sleep 4

# Optional: run pipeline checks plus verify checks
./deploy/ec2/scripts/pipeline-check.sh --with-verify --verify-skip-oauth-check --verify-skip-ssl-check

# Optional: run pipeline checks plus status checks
./deploy/ec2/scripts/pipeline-check.sh --with-status --status-runtime-checks --status-skip-dns-check --status-skip-ssl-check

# Optional: run pipeline checks with strict docs coverage enforcement
./deploy/ec2/scripts/pipeline-check.sh --docs-strict-coverage

# Optional: run pipeline checks with strict docs coverage including common.sh helper coverage
./deploy/ec2/scripts/pipeline-check.sh --docs-strict-coverage --docs-include-common

# Optional: run pipeline checks while skipping docs consistency step
./deploy/ec2/scripts/pipeline-check.sh --skip-docs-check

# Optional: run high-level validation profile (full readiness chain)
./deploy/ec2/scripts/validate.sh

# Optional: run high-level validation profile in dry-run rehearsal mode
./deploy/ec2/scripts/validate.sh --dry-run

# Optional: run high-level validation profile in dry-run with seeded env and custom ports
./deploy/ec2/scripts/validate.sh --dry-run --seed-env --ports-check-ports 80,443,8100

# Optional: run high-level validation profile with strict docs coverage
./deploy/ec2/scripts/validate.sh --docs-strict-coverage

# Optional: run high-level validation profile with strict docs coverage including common.sh helper coverage
./deploy/ec2/scripts/validate.sh --docs-strict-coverage --docs-include-common

# Optional: run high-level validation profile while skipping docs consistency stage
./deploy/ec2/scripts/validate.sh --skip-docs-check

# Optional: run high-level validation profile with stage-specific dry-run controls
./deploy/ec2/scripts/validate.sh --build-check-dry-run --runtime-smoke-dry-run

# Optional: run high-level validation profile with targeted build-check services
./deploy/ec2/scripts/validate.sh --build-check-service backend --build-check-service frontend --build-check-pull

# Optional: run high-level validation profile with build-check image pull-check rehearsal
./deploy/ec2/scripts/validate.sh --build-check-with-image-pull-check --build-check-image-service caddy --build-check-image-service postgres --dry-run

# Optional: print deployment command quick-reference
./deploy/ec2/scripts/help.sh

# Optional: validate docs-to-script consistency
./deploy/ec2/scripts/docs-check.sh

# Optional: fail when any deployment script is not referenced in docs
./deploy/ec2/scripts/docs-check.sh --strict-coverage

# Optional: fail when any deployment script (including common.sh) is not referenced in docs
./deploy/ec2/scripts/docs-check.sh --strict-coverage --include-common

# 3) Build and run the stack
./deploy/ec2/scripts/deploy.sh

# Optional: deploy dry-run / config-only checks
./deploy/ec2/scripts/deploy.sh --dry-run
./deploy/ec2/scripts/deploy.sh --config-only

# 4) Verify URLs and core endpoints
./deploy/ec2/scripts/verify.sh
# (checks frontend home + login, GraphQL GET/POST, optional OAuth, and SSL)

# Optional: verify with custom retries/sleep
./deploy/ec2/scripts/verify.sh --max-retries 10 --retry-sleep 5

# Optional: skip OAuth smoke check if OAuth keys are intentionally unset
./deploy/ec2/scripts/verify.sh --skip-oauth-check

# Optional: require OAuth smoke check (fail when OAuth keys are missing)
./deploy/ec2/scripts/verify.sh --require-oauth-check

# Optional: runtime smoke checks from inside containers
./deploy/ec2/scripts/runtime-smoke.sh
# (checks frontend home + login, backend GraphQL GET/POST, AI health, backend dependency reachability)

# Optional: runtime smoke checks with custom retries
./deploy/ec2/scripts/runtime-smoke.sh --max-retries 15 --retry-sleep 4

# Optional: runtime smoke dry-run rehearsal
./deploy/ec2/scripts/runtime-smoke.sh --dry-run

# 5) Check status
./deploy/ec2/scripts/status.sh

# Optional: status with runtime checks
./deploy/ec2/scripts/status.sh --with-runtime-checks

# Optional: status runtime checks with custom ports-check targets
./deploy/ec2/scripts/status.sh --with-runtime-checks --ports-check-ports 80,443,8100

# Optional: status with runtime-smoke checks (dry-run rehearsal)
./deploy/ec2/scripts/status.sh --with-runtime-smoke --runtime-smoke-dry-run

# Optional: status with runtime-smoke tuned retries
./deploy/ec2/scripts/status.sh --with-runtime-smoke --runtime-smoke-max-retries 15 --runtime-smoke-retry-sleep 4

# 6) Future updates (includes verify checks)
./deploy/ec2/scripts/update.sh

# Optional: enforce strict docs coverage during update
./deploy/ec2/scripts/update.sh --docs-strict-coverage

# Optional: skip docs consistency check during update
./deploy/ec2/scripts/update.sh --skip-docs-check

# Optional: update dry-run simulation
./deploy/ec2/scripts/update.sh --preflight-config-only --deploy-dry-run --skip-verify

# Optional: update dry-run simulation without final status step
./deploy/ec2/scripts/update.sh --preflight-config-only --deploy-dry-run --skip-verify --skip-status

# Optional: config-only + build-check + deploy dry-run update rehearsal
./deploy/ec2/scripts/update.sh \
  --preflight-config-only \
  --with-build-check \
  --build-check-dry-run \
  --deploy-dry-run \
  --skip-verify \
  --skip-status

# Optional: update with verify skip flags and runtime status checks
./deploy/ec2/scripts/update.sh --verify-skip-ssl-check --verify-skip-oauth-check --status-runtime-checks

# Optional: update while requiring OAuth smoke check
./deploy/ec2/scripts/update.sh --verify-require-oauth-check

# Optional: update with build-check chaining before deploy
./deploy/ec2/scripts/update.sh --with-build-check --build-check-dry-run

# Optional: update with targeted build-check services and pull
./deploy/ec2/scripts/update.sh \
  --with-build-check \
  --build-check-service backend \
  --build-check-service frontend \
  --build-check-pull

# Optional: update with build-check image pull-check rehearsal for image-only services
./deploy/ec2/scripts/update.sh \
  --with-build-check \
  --build-check-with-image-pull-check \
  --build-check-image-service caddy \
  --build-check-image-service postgres \
  --build-check-dry-run

# Optional: update with runtime-smoke chaining after deploy/verify
./deploy/ec2/scripts/update.sh \
  --with-runtime-smoke \
  --runtime-smoke-max-retries 15 \
  --runtime-smoke-retry-sleep 4

# Optional: update with runtime-smoke dry-run rehearsal
./deploy/ec2/scripts/update.sh --with-runtime-smoke --runtime-smoke-dry-run

# Optional: update runtime status checks with custom ports-check targets
./deploy/ec2/scripts/update.sh --status-runtime-checks --ports-check-ports 80,443,8100

# Optional: update runtime status checks while skipping DNS/SSL runtime probes
./deploy/ec2/scripts/update.sh --status-runtime-checks --status-skip-dns-check --status-skip-ssl-check

# Optional: update runtime status checks while skipping host/ports runtime probes
./deploy/ec2/scripts/update.sh --status-runtime-checks --status-skip-host-readiness --status-skip-ports-check

# 7) Optional DB backup
./deploy/ec2/scripts/backup-db.sh
./deploy/ec2/scripts/backup-db.sh --label before-release --dry-run

# 8) Validate deployment scripts integrity
./deploy/ec2/scripts/self-check.sh

# 9) Optional backup retention cleanup (keep latest 10)
./deploy/ec2/scripts/backup-prune.sh
./deploy/ec2/scripts/backup-prune.sh --keep-count 20 --dry-run
./deploy/ec2/scripts/backup-prune.sh --label before-release --keep-count 5 --dry-run

# 10) Optional emergency rollback using newest backup
./deploy/ec2/scripts/rollback-latest.sh
./deploy/ec2/scripts/rollback-latest.sh --dry-run
./deploy/ec2/scripts/rollback-latest.sh --label before-release --dry-run

# 11) Optional list available backups
./deploy/ec2/scripts/backup-list.sh
./deploy/ec2/scripts/backup-list.sh --count 5
./deploy/ec2/scripts/backup-list.sh --label before-release --count 5
```

This stack includes by default:

- frontend
- backend
- ai-agent-platform
- postgres
- redis
- caddy (reverse proxy + TLS)

For full steps, flowchart, and troubleshooting, see:

- `deploy/ec2/README.md`
- `deploy/ec2/FLOW.md`
- `deploy/ec2/VALIDATION.md`