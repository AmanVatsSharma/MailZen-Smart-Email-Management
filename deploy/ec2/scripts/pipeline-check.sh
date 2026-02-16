#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 deployment pipeline check
# -----------------------------------------------------------------------------
# CI-friendly validation pipeline for deployment assets.
# Does not require docker daemon (config-only checks).
#
# Usage:
#   ./deploy/ec2/scripts/pipeline-check.sh
#   ./deploy/ec2/scripts/pipeline-check.sh --seed-env
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_ENV=false
KEEP_SEEDED_ENV=false
SEEDED_ENV_FILE=""

cleanup() {
  if [[ -n "${SEEDED_ENV_FILE}" ]] && [[ "${KEEP_SEEDED_ENV}" == false ]] && [[ -f "${SEEDED_ENV_FILE}" ]]; then
    rm -f "${SEEDED_ENV_FILE}"
    echo "[mailzen-deploy][PIPELINE-CHECK] Removed seeded env file."
  fi
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
  --seed-env)
    SEED_ENV=true
    shift
    ;;
  --keep-seeded-env)
    KEEP_SEEDED_ENV=true
    shift
    ;;
  *)
    echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][PIPELINE-CHECK][INFO] Supported flags: --seed-env --keep-seeded-env"
    exit 1
    ;;
  esac
done

if [[ "${SEED_ENV}" == false ]] && [[ "${KEEP_SEEDED_ENV}" == true ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --keep-seeded-env requires --seed-env"
  exit 1
fi

seed_env_file() {
  SEEDED_ENV_FILE="$(create_seeded_env_file "pipeline-check" "${DEPLOY_DIR}")"

  export MAILZEN_DEPLOY_ENV_FILE="${SEEDED_ENV_FILE}"
  echo "[mailzen-deploy][PIPELINE-CHECK] Seeded env file: ${SEEDED_ENV_FILE}"
}

echo "[mailzen-deploy][PIPELINE-CHECK] starting..."

if [[ "${SEED_ENV}" == true ]]; then
  seed_env_file
fi

echo "[mailzen-deploy][PIPELINE-CHECK] Active env file: ${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}"
echo "[mailzen-deploy][PIPELINE-CHECK] Active compose file: ${MAILZEN_DEPLOY_COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"

"${SCRIPT_DIR}/self-check.sh"
"${SCRIPT_DIR}/env-audit.sh"
"${SCRIPT_DIR}/preflight.sh" --config-only
"${SCRIPT_DIR}/host-readiness.sh" --min-disk-gb 1 --min-memory-mb 256 --min-cpu-cores 1
"${SCRIPT_DIR}/ports-check.sh"

echo "[mailzen-deploy][PIPELINE-CHECK] rendering compose config..."
compose config >/dev/null

echo "[mailzen-deploy][PIPELINE-CHECK] PASS"
