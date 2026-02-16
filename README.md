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