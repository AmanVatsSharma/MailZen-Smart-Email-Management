#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 support bundle generator
# -----------------------------------------------------------------------------
# Produces a compressed troubleshooting bundle without exposing raw secrets.
#
# Included artifacts:
# - self-check output
# - redacted env-audit output
# - preflight config-only output
# - dns-check output (best-effort)
# - ssl-check output (best-effort)
# - host-readiness output
# - ports-check output
# - doctor output (best-effort)
# - pipeline-check output
# - docker compose status/log snapshots when daemon is reachable
#
# Usage:
#   ./deploy/ec2/scripts/support-bundle.sh
#   ./deploy/ec2/scripts/support-bundle.sh --seed-env
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORT_DIR="${DEPLOY_DIR}/reports"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="${REPORT_DIR}/support-bundle-${TIMESTAMP}"
BUNDLE_FILE="${REPORT_DIR}/support-bundle-${TIMESTAMP}.tar.gz"
SEED_ENV=false
KEEP_SEEDED_ENV=false
SEEDED_ENV_FILE=""

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
    echo "[mailzen-deploy][SUPPORT-BUNDLE][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][SUPPORT-BUNDLE][INFO] Supported flags: --seed-env --keep-seeded-env"
    exit 1
    ;;
  esac
done

if [[ "${SEED_ENV}" == false ]] && [[ "${KEEP_SEEDED_ENV}" == true ]]; then
  echo "[mailzen-deploy][SUPPORT-BUNDLE][ERROR] --keep-seeded-env requires --seed-env"
  exit 1
fi

mkdir -p "${WORK_DIR}"

log_bundle() {
  echo "[mailzen-deploy][SUPPORT-BUNDLE] $*"
}

cleanup() {
  if [[ -n "${SEEDED_ENV_FILE}" ]] && [[ "${KEEP_SEEDED_ENV}" == false ]] && [[ -f "${SEEDED_ENV_FILE}" ]]; then
    rm -f "${SEEDED_ENV_FILE}"
    log_bundle "Removed seeded env file: ${SEEDED_ENV_FILE}"
  fi
}
trap cleanup EXIT

seed_env_file() {
  SEEDED_ENV_FILE="$(create_seeded_env_file "support-bundle" "${DEPLOY_DIR}")"

  export MAILZEN_DEPLOY_ENV_FILE="${SEEDED_ENV_FILE}"
  log_bundle "Seeded env file: ${SEEDED_ENV_FILE}"
}

run_capture() {
  local label="$1"
  local command="$2"
  local output_file="${WORK_DIR}/${label}.log"
  log_bundle "Running ${label}..."
  if bash -lc "${command}" >"${output_file}" 2>&1; then
    log_bundle "${label}: captured"
  else
    log_bundle "${label}: captured with non-zero exit"
  fi
}

if [[ "${SEED_ENV}" == true ]]; then
  seed_env_file
fi

run_capture "self-check" "\"${SCRIPT_DIR}/self-check.sh\""
run_capture "env-audit" "\"${SCRIPT_DIR}/env-audit.sh\""
run_capture "preflight-config-only" "\"${SCRIPT_DIR}/preflight.sh\" --config-only"
run_capture "dns-check" "\"${SCRIPT_DIR}/dns-check.sh\""
run_capture "ssl-check" "\"${SCRIPT_DIR}/ssl-check.sh\""
run_capture "host-readiness" "\"${SCRIPT_DIR}/host-readiness.sh\""
run_capture "ports-check" "\"${SCRIPT_DIR}/ports-check.sh\""

doctor_args=()
pipeline_args=()
if [[ "${SEED_ENV}" == true ]]; then
  doctor_args+=(--seed-env)
  if [[ "${KEEP_SEEDED_ENV}" == true ]]; then
    doctor_args+=(--keep-seeded-env)
  fi
  pipeline_args+=(--seed-env)
  if [[ "${KEEP_SEEDED_ENV}" == true ]]; then
    pipeline_args+=(--keep-seeded-env)
  fi
fi
run_capture "doctor" "\"${SCRIPT_DIR}/doctor.sh\" ${doctor_args[*]}"
run_capture "pipeline-check" "\"${SCRIPT_DIR}/pipeline-check.sh\" ${pipeline_args[*]}"
run_capture "status" "\"${SCRIPT_DIR}/status.sh\""

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  run_capture "docker-info" "docker info"
  run_capture "compose-ps" "docker compose --env-file \"${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}\" -f \"${DEPLOY_DIR}/docker-compose.yml\" ps"
  run_capture "compose-config" "docker compose --env-file \"${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}\" -f \"${DEPLOY_DIR}/docker-compose.yml\" config"
  run_capture "logs-caddy" "docker compose --env-file \"${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}\" -f \"${DEPLOY_DIR}/docker-compose.yml\" logs --tail 200 caddy"
  run_capture "logs-frontend" "docker compose --env-file \"${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}\" -f \"${DEPLOY_DIR}/docker-compose.yml\" logs --tail 200 frontend"
  run_capture "logs-backend" "docker compose --env-file \"${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}\" -f \"${DEPLOY_DIR}/docker-compose.yml\" logs --tail 200 backend"
  run_capture "logs-ai-agent-platform" "docker compose --env-file \"${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}\" -f \"${DEPLOY_DIR}/docker-compose.yml\" logs --tail 200 ai-agent-platform"
  run_capture "logs-postgres" "docker compose --env-file \"${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}\" -f \"${DEPLOY_DIR}/docker-compose.yml\" logs --tail 200 postgres"
  run_capture "logs-redis" "docker compose --env-file \"${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}\" -f \"${DEPLOY_DIR}/docker-compose.yml\" logs --tail 200 redis"
else
  log_bundle "Docker daemon unavailable; skipping compose-specific captures."
fi

tar -czf "${BUNDLE_FILE}" -C "${REPORT_DIR}" "$(basename "${WORK_DIR}")"
log_bundle "Support bundle generated:"
log_bundle "  ${BUNDLE_FILE}"
