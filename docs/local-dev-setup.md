# MailZen Local Development Setup Guide

This document covers setting up MailZen for local development with PostgreSQL.

## 📋 Requirements

- **PostgreSQL 15/16/17** installed locally
- **Node.js 18+** (not installed on this system)
- **npm** (comes with Node.js)

---

## 🗄️ Step 1: Database Setup

### Option A: Automatic Setup (PostgreSQL already running)

If PostgreSQL is installed and the service is running, run the setup script:

```bash
# Navigate to the MailZen repo root
cd ~/path/to/MailZen-Smart-Email-Management

# Create the database and role
powershell -ExecutionPolicy Bypass -File scripts/db/setup-local-db.ps1

# Or use the Node.js version (requires Node.js installed)
node scripts/db/setup-local-db.js
```

### Option B: Manual Setup

1. **Enable trust auth temporarily** (needed to create role without password):
   ```powershell
   # Find pg_hba.conf
   $PG_HBA = Get-ChildItem "C:\Program Files\PostgreSQL*" -Recurse | 
             Where-Object { $_.Name -eq "pg_hba.conf" } | Select-Object -First 1

   # Create backup
   Copy-Item $PG_HBA.FullName "$($PG_HBA.FullName).bak"

   # Replace auth methods with trust
   (Get-Content $PG_HBA.FullName) -replace 'scram-sha-256', 'trust' | Set-Content $PG_HBA.FullName

   # Restart PostgreSQL
   Restart-Service postgresql-x64-17
   ```

2. **Create role and database using psql**:
   ```bash
   # Open PowerShell and run:
   C:\"Program Files"\PostgreSQL\17\bin\psql.exe -U postgres -c "CREATE ROLE mailzen WITH LOGIN SUPERUSER PASSWORD 'mailzen';"
   C:\"Program Files"\PostgreSQL\17\bin\createdb.exe -U mailzen mailzen
   C:\"Program Files"\PostgreSQL\17\bin\psql.exe -U mailzen -d mailzen -c "GRANT ALL PRIVILEGES ON DATABASE mailzen TO mailzen;"
   ```

3. **Restore secure auth**:
   ```powershell
   Copy-Item "$($PG_HBA.FullName).bak" $PG_HBA.FullName
   Restart-Service postgresql-x64-17
   ```

### Option C: Use SQLite (Easiest - No PostgreSQL setup!)

If you don't want to deal with PostgreSQL, the project defaults to SQLite:

```bash
# Just create the env file as-is
cd ~/path/to/MailZen-Smart-Email-Management
node tools/ensure-env.js --project backend
```

The env file will be created with `DATABASE_URL=sqlite:./mailzen.dev.sqlite`

---

## 📝 Step 2: Configure Environment

The setup script should have already created `apps/backend/.env`. Verify it contains:

```env
# Use PostgreSQL connection from setup script
DATABASE_URL=postgresql://mailzen:mailzen@localhost:5432/mailzen

# Backend port
PORT=4000

# JWT secret (dev-only)
JWT_SECRET=dev-mailzen-jwt-secret-change-in-production-2c8a4f9d1b3e5a7c

# Redis for queues
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## ⚙️ Step 3: Install Dependencies

Since Node.js is not installed on this system, you'll need to:

1. **Install Node.js 18+** from [nodejs.org](https://nodejs.org/)
2. **Run npm install**:
   ```bash
   cd ~/path/to/MailZen-Smart-Email-Management
   npm install
   ```

---

## 🚀 Step 4: Start Services

### Start with frontend + backend (recommended):
```bash
npm run dev  # This starts both frontend (port 3000) and backend (port 4000)
```

### Start backend only:
```bash
cd apps/backend
npm run dev:backend
```

The first time you start the backend, TypeORM will:
1. Auto-create all tables (since `TYPEORM_SYNCHRONIZE=true`)
2. Migrate schema automatically
3. Connect to the `mailzen` database

---

## 🌱 Step 5: Seed Demo Data

Once the backend is running, create demo users:

```bash
cd apps/backend
npm run seed:demo:fresh
```

This creates:
- Demo user: `demo@mailzen.dev` / `Demo@1234`
- Demo workspace
- Sample emails and contacts
- Billing plans and feature flags

---

## 🔄 Next Steps

### Run migrations manually (optional):
```bash
cd apps/backend
npm run migration:run
npm run migration:generate -- --name=InitialSetup
```

### Add more demo data:
```bash
# Backfill workspace scopes (for inbox labeling)
cd apps/backend
npm run backfill:workspace-scopes:apply
```

### Test the API:
```bash
curl http://localhost:4000/graphql
```

---

## 🐛 Troubleshooting

### PostgreSQL connection errors:
```bash
# Check if PostgreSQL is running
sc query postgresql-x64-17

# If not running:
net start postgresql-x64-17

# Check for port 5432
netstat -an | findstr 5432
```

### Node.js modules not found:
```bash
# Reinstall everything
rm -rf node_modules apps/backend/node_modules
npm install
```

### TypeORM sync issues:
- Ensure `TYPEORM_SYNCHRONIZE=true` in `.env`
- Delete the database and recreate: `dropdb mailzen && createdb mailzen`

### Demo seed fails:
The seed script requires Node.js and npm installed. Make sure they're in your PATH.

---

## 🌐 URLs

After starting:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/graphql
- **GraphQL Playground**: http://localhost:4000/graphql (when server is running)

---

## 📝 Notes

1. **PostgreSQL setup** is a one-time task. After the first run, all you need is:
   ```bash
   npm run dev:backend
   npm run seed:demo:fresh
   ```

2. **SQLite alternative**: The simplest option if you want to avoid PostgreSQL entirely.

3. **Auto-sync**: With `TYPEORM_SYNCHRONIZE=true`, schema changes are automatic. In production, you'll need to create and run migrations.

4. **Demo user credentials**: `demo@mailzen.dev` / `Demo@1234`