#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 deployment pipeline check
# -----------------------------------------------------------------------------
# CI-friendly validation pipeline for deployment assets.
# Does not require docker daemon (config-only checks).
#
# Usage:
#   ./deploy/ec2/scripts/pipeline-check.sh
# -----------------------------------------------------------------------------

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[mailzen-deploy][PIPELINE-CHECK] starting..."

"${SCRIPT_DIR}/self-check.sh"
"${SCRIPT_DIR}/env-audit.sh"
"${SCRIPT_DIR}/preflight.sh" --config-only
"${SCRIPT_DIR}/ports-check.sh"

echo "[mailzen-deploy][PIPELINE-CHECK] rendering compose config..."
docker compose --env-file "${DEPLOY_DIR}/.env.ec2" -f "${DEPLOY_DIR}/docker-compose.yml" config >/dev/null

echo "[mailzen-deploy][PIPELINE-CHECK] PASS"
