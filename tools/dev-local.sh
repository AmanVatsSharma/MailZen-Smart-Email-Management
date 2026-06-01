#!/usr/bin/env bash
# File:        tools/dev-local.sh
# Module:      Dev tooling
# Purpose:     Start MailZen in local dev mode with zero manual setup.
#              Ensures Valkey/Redis is running (starts it if not), then boots
#              frontend + backend. SQLite is the default DB — no Postgres needed.
#
# Usage:
#   npm run dev:local
#   bash tools/dev-local.sh
#
# Side-effects:
#   - May start a background redis-server process (daemonized, port 6379)
#   - Creates apps/backend/.env and apps/frontend/.env.local if missing
#   - Creates apps/backend/mailzen.dev.sqlite on first boot
#
# Key invariants:
#   - Requires redis-server (Valkey) on $PATH — ships with Fedora/RHEL as valkey or redis
#   - All external services (Gmail OAuth, Stripe, SMTP) are optional — left blank in defaults
#   - AI agent platform is excluded (dev:lite)
#
# Author:      AmanVatsSharma
# Last-updated: 2026-05-08

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── 1. Ensure env files exist ────────────────────────────────────────────────
echo "[dev:local] Ensuring env files..."
node "$REPO_ROOT/tools/ensure-env.js" --project all

# ── 2. Start Valkey/Redis if not already running ─────────────────────────────
if redis-cli ping &>/dev/null; then
  echo "[dev:local] Redis/Valkey already running on :6379"
else
  echo "[dev:local] Starting Valkey/Redis in background..."
  redis-server --daemonize yes --loglevel warning

  # Wait up to 5 s for Redis to accept connections
  for i in $(seq 1 10); do
    if redis-cli ping &>/dev/null; then
      echo "[dev:local] Redis/Valkey ready"
      break
    fi
    sleep 0.5
  done

  if ! redis-cli ping &>/dev/null; then
    echo "[dev:local] ERROR: Redis/Valkey did not start. Is redis-server installed?"
    echo "           On Fedora: sudo dnf install valkey"
    echo "           On Ubuntu: sudo apt install redis-server"
    exit 1
  fi
fi

# ── 3. Boot frontend + backend ───────────────────────────────────────────────
echo "[dev:local] Starting frontend (port 3000) + backend (port 4000)..."
echo "[dev:local] Database: SQLite (apps/backend/mailzen.dev.sqlite)"
echo "[dev:local] OAuth/SMTP/Stripe: disabled (leave blank in .env to skip)"
echo ""

cd "$REPO_ROOT"
exec npm run dev:lite
