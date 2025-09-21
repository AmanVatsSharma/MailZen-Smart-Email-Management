# MailZen

MailZen is an email management platform built with Next.js (frontend) and NestJS (backend).

## Project Structure

- `frontend/`: Next.js application
- `backend/`: NestJS application

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
   - Backend: Copy `backend/.env.example` to `backend/.env` and update the values
   - Frontend: Copy `frontend/.env.example` to `frontend/.env.local` and update the values

   Note: The start script will create default environment files if they don't exist.

4. Set up the database:
   ```bash
   cd backend
   npx prisma migrate dev
   ```

## Running the Application

### Development Mode

To run both frontend and backend concurrently:

```bash
npm start
```

To run them separately:

```bash
# Frontend (http://localhost:3000)
npm run start:frontend

# Backend (http://localhost:4000)
npm run start:backend
```

### Production Build

```bash
# Build frontend
npm run build:frontend

# Build backend
npm run build:backend
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
NEXT_PUBLIC_GRAPHQL_ENDPOINT=/api/graphql
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_ENABLE_EMAIL_WARMUP=true
NEXT_PUBLIC_ENABLE_SMART_REPLIES=true
NEXT_PUBLIC_ENABLE_EMAIL_TRACKING=true
NEXT_PUBLIC_DEFAULT_THEME=system
BACKEND_GRAPHQL_ORIGIN=http://localhost:4000/graphql
```

### Backend (.env)

```
DATABASE_URL=postgresql://mailzen:mailzen@localhost:5432/mailzen?schema=public
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_secret_key
JWT_EXPIRATION=86400
ENABLE_EMAIL_WARMUP=true
ENABLE_SMART_REPLIES=true
ENABLE_EMAIL_TRACKING=true
```

## Docker quickstart

Requirements: Docker and Docker Compose v2

1. Copy env examples and adjust if needed:
   - backend/.env.example -> backend/.env
   - frontend/.env.example -> frontend/.env

2. Start all services:

```
docker compose up --build
```

Services:
- Postgres: localhost:5432 (user: mailzen, pass: mailzen, db: mailzen)
- Backend (Nest GraphQL): http://localhost:4000/graphql
- Frontend (Next.js): http://localhost:3000

The frontend proxies GraphQL to the backend via `/api/graphql` to avoid CORS issues.