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
#   --setup-skip-daemon
#   --domain <hostname>
#   --acme-email <email>
# -----------------------------------------------------------------------------

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SETUP=true
RUN_DNS_CHECK=true
RUN_PORTS_CHECK=true
SETUP_SKIP_DAEMON=false
DOMAIN_ARG=""
ACME_EMAIL_ARG=""

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

while [[ $# -gt 0 ]]; do
  case "$1" in
  --skip-setup)
    RUN_SETUP=false
    shift
    ;;
  --skip-dns-check)
    RUN_DNS_CHECK=false
    shift
    ;;
  --skip-ports-check)
    RUN_PORTS_CHECK=false
    shift
    ;;
  --setup-skip-daemon)
    SETUP_SKIP_DAEMON=true
    shift
    ;;
  --domain)
    DOMAIN_ARG="${2:-}"
    if [[ -z "${DOMAIN_ARG}" ]]; then
      echo "[mailzen-deploy][ERROR] --domain requires a value."
      exit 1
    fi
    shift 2
    ;;
  --acme-email)
    ACME_EMAIL_ARG="${2:-}"
    if [[ -z "${ACME_EMAIL_ARG}" ]]; then
      echo "[mailzen-deploy][ERROR] --acme-email requires a value."
      exit 1
    fi
    shift 2
    ;;
  --domain=*)
    DOMAIN_ARG="${1#*=}"
    shift
    ;;
  --acme-email=*)
    ACME_EMAIL_ARG="${1#*=}"
    shift
    ;;
  *)
    echo "[mailzen-deploy][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][INFO] Supported flags: --skip-setup --skip-dns-check --skip-ports-check --setup-skip-daemon --domain <hostname> --acme-email <email>"
    exit 1
    ;;
  esac
done

if [[ "${RUN_SETUP}" == true ]] && [[ ! -t 0 ]]; then
  echo "[mailzen-deploy][LAUNCH] non-interactive terminal detected; setup will run in non-interactive mode."
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
  setup_args=(--non-interactive)
  if [[ -n "${DOMAIN_ARG}" ]]; then
    setup_args+=(--domain "${DOMAIN_ARG}")
  fi
  if [[ -n "${ACME_EMAIL_ARG}" ]]; then
    setup_args+=(--acme-email "${ACME_EMAIL_ARG}")
  fi
  if [[ "${SETUP_SKIP_DAEMON}" == true ]]; then
    setup_args+=(--skip-daemon)
  fi
  run_step "${step}" "${total_steps}" "setup environment" "${SCRIPT_DIR}/setup.sh" "${setup_args[@]}"
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
