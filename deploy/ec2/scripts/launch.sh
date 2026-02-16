#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 one-command launch script (non-technical friendly)
# -----------------------------------------------------------------------------
# Runs the full happy-path pipeline:
#   setup -> dns-check -> ports-check -> preflight -> deploy -> verify -> status
#
# Optional flags:
#   --skip-setup
#   --skip-dns-check
#   --skip-ports-check
# -----------------------------------------------------------------------------

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SETUP=true
RUN_DNS_CHECK=true
RUN_PORTS_CHECK=true

run_step() {
  local step_number="$1"
  local total_steps="$2"
  local title="$3"
  shift 3
  echo
  echo "================================================================================"
  echo "[mailzen-deploy][LAUNCH] Step ${step_number}/${total_steps}: ${title}"
  echo "================================================================================"
  "$@"
}

for arg in "$@"; do
  case "${arg}" in
  --skip-setup)
    RUN_SETUP=false
    ;;
  --skip-dns-check)
    RUN_DNS_CHECK=false
    ;;
  --skip-ports-check)
    RUN_PORTS_CHECK=false
    ;;
  *)
    echo "[mailzen-deploy][ERROR] Unknown argument: ${arg}"
    echo "[mailzen-deploy][INFO] Supported flags: --skip-setup --skip-dns-check --skip-ports-check"
    exit 1
    ;;
  esac
done

if [[ "${RUN_SETUP}" == true ]] && [[ ! -t 0 ]]; then
  echo "[mailzen-deploy][ERROR] launch.sh requires an interactive terminal when setup step is enabled."
  echo "[mailzen-deploy][INFO] Use --skip-setup for non-interactive execution if env is already configured."
  echo "[mailzen-deploy][INFO] Example:"
  echo "  ./deploy/ec2/scripts/launch.sh --skip-setup"
  exit 1
fi

if [[ "${RUN_SETUP}" == false ]]; then
  echo "[mailzen-deploy][LAUNCH] setup step skipped by --skip-setup"
fi
if [[ "${RUN_DNS_CHECK}" == false ]]; then
  echo "[mailzen-deploy][LAUNCH] dns-check step skipped by --skip-dns-check"
fi
if [[ "${RUN_PORTS_CHECK}" == false ]]; then
  echo "[mailzen-deploy][LAUNCH] ports-check step skipped by --skip-ports-check"
fi

total_steps=4 # preflight + deploy + verify + status
if [[ "${RUN_SETUP}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_DNS_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_PORTS_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi

step=1
if [[ "${RUN_SETUP}" == true ]]; then
  run_step "${step}" "${total_steps}" "setup environment" "${SCRIPT_DIR}/setup.sh"
  step=$((step + 1))
fi

if [[ "${RUN_DNS_CHECK}" == true ]]; then
  run_step "${step}" "${total_steps}" "dns readiness check" "${SCRIPT_DIR}/dns-check.sh"
  step=$((step + 1))
fi

if [[ "${RUN_PORTS_CHECK}" == true ]]; then
  run_step "${step}" "${total_steps}" "host ports check" "${SCRIPT_DIR}/ports-check.sh"
  step=$((step + 1))
fi

run_step "${step}" "${total_steps}" "preflight validation" "${SCRIPT_DIR}/preflight.sh"
step=$((step + 1))
run_step "${step}" "${total_steps}" "deploy stack" "${SCRIPT_DIR}/deploy.sh"
step=$((step + 1))
run_step "${step}" "${total_steps}" "verify deployment" "${SCRIPT_DIR}/verify.sh"
step=$((step + 1))
run_step "${step}" "${total_steps}" "show status" "${SCRIPT_DIR}/status.sh"

echo
echo "[mailzen-deploy][LAUNCH] MailZen launch pipeline completed successfully."
