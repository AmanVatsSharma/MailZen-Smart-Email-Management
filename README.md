# MailZen

MailZen is an email management platform built with Next.js (frontend) and NestJS (backend).

## Project Structure

- `frontend/`: Next.js application
- `backend/`: NestJS application
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
   npm run install:all
   ```

3. Set up environment variables:
   - Backend: Copy `backend/env.example` to `backend/.env` and update the values
   - Frontend: Copy `frontend/env.local.example` to `frontend/.env.local` and update the values

   Note: Nx `serve` targets run `tools/ensure-env.js` first and will create default env files if they don't exist (it never overwrites).

4. Set up the database:
   ```bash
   cd backend
   npx prisma migrate dev
   ```

## Running the Application

### Development Mode

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

### Production Build

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

## Features

- Email management
- Email warmup
- Smart replies
- Email tracking
- Contact management
- Email templates

## API Documentation

The GraphQL API is available at `http://localhost:4000/graphql` when the backend is running.

## Authentication

The application uses JWT for authentication. To access protected routes, you need to:

1. Register or login to get a JWT token
2. Include the token in the Authorization header for API requests

## Environment Variables

### Frontend (.env.local)

```
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_ENABLE_EMAIL_WARMUP=true
NEXT_PUBLIC_ENABLE_SMART_REPLIES=true
NEXT_PUBLIC_ENABLE_EMAIL_TRACKING=true
NEXT_PUBLIC_DEFAULT_THEME=system
```

### Backend (.env)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mailzen?schema=public
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_secret_key
JWT_EXPIRATION=86400
ENABLE_EMAIL_WARMUP=true
ENABLE_SMART_REPLIES=true
ENABLE_EMAIL_TRACKING=true
``` 