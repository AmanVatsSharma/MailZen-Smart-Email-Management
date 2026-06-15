#!/usr/bin/env bash
# scripts/db/setup-local-db.sh
# Local PostgreSQL setup for MailZen — creates database, role, and verifies connection.
#
# Usage:  bash scripts/db/setup-local-db.sh
#
# Requires:
#   - PostgreSQL installed locally with the `postgres` role accessible
#   - pg_ctl / createdb / psql on PATH (or under PostgreSQL install dir)

set -euo pipefail

# ---- Configuration ----
PG_USER="${MAILZEN_DB_USER:-mailzen}"
PG_PASSWORD="${MAILZEN_DB_PASSWORD:-mailzen}"
PG_DB="${MAILZEN_DB_NAME:-mailzen}"
PG_HOST="${MAILZEN_DB_HOST:-localhost}"
PG_PORT="${MAILZEN_DB_PORT:-5432}"

POSTGRES_BIN=""
for candidate in \
  "/c/Program Files/PostgreSQL/17/bin" \
  "/c/Program Files/PostgreSQL/16/bin" \
  "/c/Program Files/PostgreSQL/15/bin" \
  "/usr/local/pgsql/bin" \
  "/usr/lib/postgresql/17/bin"; do
  if [ -d "$candidate" ]; then
    POSTGRES_BIN="$candidate"
    break
  fi
done

PSQL="$POSTGRES_BIN/psql.exe"
CREATEDB="$POSTGRES_BIN/createdb.exe"

if [ -z "$POSTGRES_BIN" ] || [ ! -f "$PSQL" ]; then
  echo "✗ PostgreSQL psql not found. Set MAILZEN_DB_HOST/USER/etc. or install PostgreSQL."
  exit 1
fi

echo "→ Using PostgreSQL bin: $POSTGRES_BIN"
echo "→ Target: $PG_USER@$PG_HOST:$PG_PORT/$PG_DB"

# ---- 1. Check connection to postgres database as superuser (peer auth / no password) ----
echo ""
echo "▶ Step 1/4: Verify connection to 'postgres' database as superuser"
if ! "$PSQL" -U postgres -h "$PG_HOST" -d postgres -tAc "SELECT 1;" >/dev/null 2>&1; then
  echo "  ⚠ Need to enable trust auth temporarily. Backing up pg_hba.conf..."
  PG_HBA=$(find "/c/Program Files/PostgreSQL" -name "pg_hba.conf" 2>/dev/null | head -1)
  if [ -z "$PG_HBA" ]; then
    echo "  ✗ Could not find pg_hba.conf"
    exit 1
  fi
  cp -f "$PG_HBA" "$PG_HBA.bak"
  sed -i 's/scram-sha-256/trust/g' "$PG_HBA" 2>/dev/null || true
  sed -i 's/md5/trust/g' "$PG_HBA" 2>/dev/null || true
  pg_ctl reload -D "$(dirname "$PG_HBA")/data" 2>/dev/null || true
fi

# ---- 2. Create the mailzen role if missing ----
echo ""
echo "▶ Step 2/4: Create role '$PG_USER' (if missing)"
ROLE_EXISTS=$("$PSQL" -U postgres -h "$PG_HOST" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER';" 2>/dev/null || echo "")
if [ "$ROLE_EXISTS" != "1" ]; then
  "$PSQL" -U postgres -h "$PG_HOST" -d postgres -c "CREATE ROLE $PG_USER WITH LOGIN SUPERUSER PASSWORD '$PG_PASSWORD';" 2>&1 | head -3
  echo "  ✓ Role created"
else
  echo "  ✓ Role already exists"
  # Update password to known value
  "$PSQL" -U postgres -h "$PG_HOST" -d postgres -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASSWORD';" 2>&1 | head -1
fi

# ---- 3. Create the database if missing ----
echo ""
echo "▶ Step 3/4: Create database '$PG_DB' (if missing)"
DB_EXISTS=$("$PSQL" -U postgres -h "$PG_HOST" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB';" 2>/dev/null || echo "")
if [ "$DB_EXISTS" != "1" ]; then
  "$PSQL" -U postgres -h "$PG_HOST" -d postgres -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" 2>&1 | head -3
  echo "  ✓ Database created"
else
  echo "  ✓ Database already exists"
fi

# ---- 4. Restore scram-sha-256 auth ----
PG_HBA=$(find "/c/Program Files/PostgreSQL" -name "pg_hba.conf" 2>/dev/null | head -1)
if [ -n "$PG_HBA" ] && [ -f "$PG_HBA.bak" ]; then
  cp -f "$PG_HBA.bak" "$PG_HBA"
  echo "  ✓ Restored pg_hba.conf from backup"
fi

# ---- 5. Verify connection as mailzen user with password ----
echo ""
echo "▶ Step 4/4: Verify connection as '$PG_USER' with password"
if PGPASSWORD="$PG_PASSWORD" "$PSQL" -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" -d "$PG_DB" -c "SELECT current_database(), current_user, version();" 2>&1 | head -5; then
  echo ""
  echo "✅ PostgreSQL is ready."
  echo ""
  echo "Connection string (use in apps/backend/.env):"
  echo "  DATABASE_URL=postgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
else
  echo "✗ Connection failed. Check pg_hba.conf auth method."
  exit 1
fi
