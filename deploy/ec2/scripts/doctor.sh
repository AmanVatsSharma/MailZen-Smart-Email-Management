#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 diagnostics report generator
# -----------------------------------------------------------------------------
# Produces a support-friendly report with redacted and operational checks.
#
# Usage:
#   ./deploy/ec2/scripts/doctor.sh
#   ./deploy/ec2/scripts/doctor.sh --strict
#   ./deploy/ec2/scripts/doctor.sh --seed-env
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORT_DIR="${DEPLOY_DIR}/reports"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_SUFFIX="pid$$-rand${RANDOM}"
REPORT_FILE="${REPORT_DIR}/doctor-${TIMESTAMP}-${RUN_SUFFIX}.log"
STRICT_MODE=false
SEED_ENV=false
KEEP_SEEDED_ENV=false
SEEDED_ENV_FILE=""

cleanup() {
  if [[ -n "${SEEDED_ENV_FILE}" ]] && [[ "${KEEP_SEEDED_ENV}" == false ]] && [[ -f "${SEEDED_ENV_FILE}" ]]; then
    rm -f "${SEEDED_ENV_FILE}"
    echo "[mailzen-deploy][DOCTOR] Removed seeded env file: ${SEEDED_ENV_FILE}"
  fi
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
  --strict)
    STRICT_MODE=true
    shift
    ;;
  --seed-env)
    SEED_ENV=true
    shift
    ;;
  --keep-seeded-env)
    KEEP_SEEDED_ENV=true
    shift
    ;;
  *)
    echo "[mailzen-deploy][DOCTOR][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][DOCTOR][INFO] Supported flags: --strict --seed-env --keep-seeded-env"
    exit 1
    ;;
  esac
done

if [[ "${SEED_ENV}" == false ]] && [[ "${KEEP_SEEDED_ENV}" == true ]]; then
  echo "[mailzen-deploy][DOCTOR][ERROR] --keep-seeded-env requires --seed-env"
  exit 1
fi

seed_env_file() {
  SEEDED_ENV_FILE="$(create_seeded_env_file "doctor" "${DEPLOY_DIR}")"

  export MAILZEN_DEPLOY_ENV_FILE="${SEEDED_ENV_FILE}"
  echo "[mailzen-deploy][DOCTOR] Seeded env file: ${SEEDED_ENV_FILE}" | tee -a "${REPORT_FILE}" >/dev/null
}

mkdir -p "${REPORT_DIR}"

overall_failure_count=0

append_header() {
  local title="$1"
  {
    echo
    echo "================================================================================"
    echo "[mailzen-deploy][DOCTOR] ${title}"
    echo "================================================================================"
  } | tee -a "${REPORT_FILE}"
}

run_check() {
  local label="$1"
  local command="$2"
  local required="${3:-true}"
  append_header "${label}"
  if bash -lc "${command}" >>"${REPORT_FILE}" 2>&1; then
    echo "[mailzen-deploy][DOCTOR] ${label}: PASS" | tee -a "${REPORT_FILE}"
  else
    if [[ "${required}" == "true" ]]; then
      echo "[mailzen-deploy][DOCTOR] ${label}: FAIL" | tee -a "${REPORT_FILE}"
      overall_failure_count=$((overall_failure_count + 1))
    else
      echo "[mailzen-deploy][DOCTOR] ${label}: WARN (optional check failed)" | tee -a "${REPORT_FILE}"
      if [[ "${STRICT_MODE}" == "true" ]]; then
        overall_failure_count=$((overall_failure_count + 1))
      fi
    fi
  fi
}

{
  echo "[mailzen-deploy][DOCTOR] report generated at: ${TIMESTAMP}"
  echo "[mailzen-deploy][DOCTOR] report file: ${REPORT_FILE}"
} | tee -a "${REPORT_FILE}"

if [[ "${SEED_ENV}" == true ]]; then
  seed_env_file
fi

active_env_file="${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}"
active_compose_file="${MAILZEN_DEPLOY_COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"

run_check "script-self-check" "\"${SCRIPT_DIR}/self-check.sh\""
run_check "env-audit-redacted" "\"${SCRIPT_DIR}/env-audit.sh\""
run_check "dns-check" "\"${SCRIPT_DIR}/dns-check.sh\"" false
run_check "ssl-check" "\"${SCRIPT_DIR}/ssl-check.sh\"" false
run_check "host-readiness" "\"${SCRIPT_DIR}/host-readiness.sh\""
run_check "ports-check" "\"${SCRIPT_DIR}/ports-check.sh\""
run_check "preflight-config-only" "\"${SCRIPT_DIR}/preflight.sh\" --config-only"
run_check "pipeline-check" "\"${SCRIPT_DIR}/pipeline-check.sh\""
run_check "docker-client-version" "docker --version"
run_check "docker-compose-version" "docker compose version"
run_check "docker-daemon-info" "docker info" false
run_check "compose-config-render" "docker compose --env-file \"${active_env_file}\" -f \"${active_compose_file}\" config"

append_header "doctor-summary"
if [[ "${overall_failure_count}" -eq 0 ]]; then
  echo "[mailzen-deploy][DOCTOR] Overall result: PASS" | tee -a "${REPORT_FILE}"
  exit 0
fi

echo "[mailzen-deploy][DOCTOR] Overall result: FAIL (${overall_failure_count} check(s) failed)" | tee -a "${REPORT_FILE}"
echo "[mailzen-deploy][DOCTOR] Review report: ${REPORT_FILE}" | tee -a "${REPORT_FILE}"
exit 1
