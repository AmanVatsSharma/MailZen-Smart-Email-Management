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
#   ./deploy/ec2/scripts/pipeline-check.sh --ports-check-ports 80,443,8100
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_ENV=false
KEEP_SEEDED_ENV=false
SEEDED_ENV_FILE=""
PORTS_CHECK_PORTS=""

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
  --ports-check-ports)
    PORTS_CHECK_PORTS="${2:-}"
    if [[ -z "${PORTS_CHECK_PORTS}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --ports-check-ports requires a value."
      exit 1
    fi
    shift 2
    ;;
  *)
    echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][PIPELINE-CHECK][INFO] Supported flags: --seed-env --keep-seeded-env --ports-check-ports <p1,p2,...>"
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

echo "[mailzen-deploy][PIPELINE-CHECK] Active env file: $(get_env_file)"
echo "[mailzen-deploy][PIPELINE-CHECK] Active compose file: $(get_compose_file)"
if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK] Custom ports-check targets: ${PORTS_CHECK_PORTS}"
fi

"${SCRIPT_DIR}/self-check.sh"
"${SCRIPT_DIR}/env-audit.sh"
"${SCRIPT_DIR}/preflight.sh" --config-only
"${SCRIPT_DIR}/host-readiness.sh" --min-disk-gb 1 --min-memory-mb 256 --min-cpu-cores 1
ports_check_args=()
if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  ports_check_args+=(--ports "${PORTS_CHECK_PORTS}")
fi
"${SCRIPT_DIR}/ports-check.sh" "${ports_check_args[@]}"

echo "[mailzen-deploy][PIPELINE-CHECK] rendering compose config..."
compose config >/dev/null

echo "[mailzen-deploy][PIPELINE-CHECK] PASS"
