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
#   ./deploy/ec2/scripts/doctor.sh --ports-check-ports 80,443,8100
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
PORTS_CHECK_PORTS=""

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
  --ports-check-ports)
    PORTS_CHECK_PORTS="${2:-}"
    if [[ -z "${PORTS_CHECK_PORTS}" ]]; then
      echo "[mailzen-deploy][DOCTOR][ERROR] --ports-check-ports requires a value."
      exit 1
    fi
    shift 2
    ;;
  *)
    echo "[mailzen-deploy][DOCTOR][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][DOCTOR][INFO] Supported flags: --strict --seed-env --keep-seeded-env --ports-check-ports <p1,p2,...>"
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
  echo "[mailzen-deploy][DOCTOR] strict_mode: ${STRICT_MODE}"
  echo "[mailzen-deploy][DOCTOR] seed_env: ${SEED_ENV}"
  echo "[mailzen-deploy][DOCTOR] ports_check_ports: ${PORTS_CHECK_PORTS:-default}"
} | tee -a "${REPORT_FILE}"

if [[ "${SEED_ENV}" == true ]]; then
  seed_env_file
fi

active_env_file="$(get_env_file)"
active_compose_file="$(get_compose_file)"
{
  echo "[mailzen-deploy][DOCTOR] active_env_file: ${active_env_file}"
  echo "[mailzen-deploy][DOCTOR] active_compose_file: ${active_compose_file}"
} | tee -a "${REPORT_FILE}"
if command -v git >/dev/null 2>&1; then
  if git -C "${DEPLOY_DIR}/.." rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    {
      echo "[mailzen-deploy][DOCTOR] git_branch: $(git -C "${DEPLOY_DIR}/.." rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
      echo "[mailzen-deploy][DOCTOR] git_head: $(git -C "${DEPLOY_DIR}/.." rev-parse HEAD 2>/dev/null || echo unknown)"
      echo "[mailzen-deploy][DOCTOR] git_status_short: $(git -C "${DEPLOY_DIR}/.." status --short | wc -l | tr -d ' ')"
    } | tee -a "${REPORT_FILE}"
  fi
fi

run_check "script-self-check" "\"${SCRIPT_DIR}/self-check.sh\""
run_check "env-audit-redacted" "\"${SCRIPT_DIR}/env-audit.sh\""
run_check "dns-check" "\"${SCRIPT_DIR}/dns-check.sh\"" false
run_check "ssl-check" "\"${SCRIPT_DIR}/ssl-check.sh\"" false
run_check "host-readiness" "\"${SCRIPT_DIR}/host-readiness.sh\""
ports_check_command="\"${SCRIPT_DIR}/ports-check.sh\""
if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  ports_check_command="${ports_check_command} --ports \"${PORTS_CHECK_PORTS}\""
fi
run_check "ports-check" "${ports_check_command}"
run_check "preflight-config-only" "\"${SCRIPT_DIR}/preflight.sh\" --config-only"
pipeline_check_command="\"${SCRIPT_DIR}/pipeline-check.sh\""
if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  pipeline_check_command="${pipeline_check_command} --ports-check-ports \"${PORTS_CHECK_PORTS}\""
fi
run_check "pipeline-check" "${pipeline_check_command}"
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
