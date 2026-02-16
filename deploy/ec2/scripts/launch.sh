#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 one-command launch script (non-technical friendly)
# -----------------------------------------------------------------------------
# Runs the full happy-path pipeline:
#   setup -> host-readiness -> dns-check -> ssl-check -> ports-check -> preflight -> deploy -> verify -> status
#
# Optional flags:
#   --skip-setup
#   --skip-host-readiness
#   --skip-dns-check
#   --skip-ssl-check
#   --skip-ports-check
#   --skip-verify
#   --setup-skip-daemon
#   --preflight-config-only
#   --deploy-dry-run
#   --verify-max-retries <n>
#   --verify-retry-sleep <n>
#   --status-runtime-checks
#   --status-strict
#   --status-skip-host-readiness
#   --status-skip-dns-check
#   --status-skip-ssl-check
#   --status-skip-ports-check
#   --ports-check-ports <p1,p2,...>
#   --domain <hostname>
#   --acme-email <email>
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SETUP=true
RUN_HOST_READINESS=true
RUN_DNS_CHECK=true
RUN_SSL_CHECK=true
RUN_PORTS_CHECK=true
RUN_VERIFY=true
SETUP_SKIP_DAEMON=false
PREFLIGHT_CONFIG_ONLY=false
DEPLOY_DRY_RUN=false
STATUS_RUNTIME_CHECKS=false
STATUS_STRICT=false
STATUS_SKIP_HOST_READINESS=false
STATUS_SKIP_DNS_CHECK=false
STATUS_SKIP_SSL_CHECK=false
STATUS_SKIP_PORTS_CHECK=false
VERIFY_MAX_RETRIES=""
VERIFY_RETRY_SLEEP=""
DOMAIN_ARG=""
ACME_EMAIL_ARG=""
PORTS_CHECK_PORTS=""

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
  --skip-host-readiness)
    RUN_HOST_READINESS=false
    shift
    ;;
  --skip-dns-check)
    RUN_DNS_CHECK=false
    shift
    ;;
  --skip-ssl-check)
    RUN_SSL_CHECK=false
    shift
    ;;
  --skip-ports-check)
    RUN_PORTS_CHECK=false
    shift
    ;;
  --skip-verify)
    RUN_VERIFY=false
    shift
    ;;
  --setup-skip-daemon)
    SETUP_SKIP_DAEMON=true
    shift
    ;;
  --preflight-config-only)
    PREFLIGHT_CONFIG_ONLY=true
    shift
    ;;
  --deploy-dry-run)
    DEPLOY_DRY_RUN=true
    shift
    ;;
  --verify-max-retries)
    VERIFY_MAX_RETRIES="${2:-}"
    if [[ -z "${VERIFY_MAX_RETRIES}" ]]; then
      log_error "--verify-max-retries requires a value."
      exit 1
    fi
    shift 2
    ;;
  --verify-retry-sleep)
    VERIFY_RETRY_SLEEP="${2:-}"
    if [[ -z "${VERIFY_RETRY_SLEEP}" ]]; then
      log_error "--verify-retry-sleep requires a value."
      exit 1
    fi
    shift 2
    ;;
  --status-runtime-checks)
    STATUS_RUNTIME_CHECKS=true
    shift
    ;;
  --status-strict)
    STATUS_STRICT=true
    shift
    ;;
  --status-skip-host-readiness)
    STATUS_SKIP_HOST_READINESS=true
    shift
    ;;
  --status-skip-dns-check)
    STATUS_SKIP_DNS_CHECK=true
    shift
    ;;
  --status-skip-ssl-check)
    STATUS_SKIP_SSL_CHECK=true
    shift
    ;;
  --status-skip-ports-check)
    STATUS_SKIP_PORTS_CHECK=true
    shift
    ;;
  --ports-check-ports)
    PORTS_CHECK_PORTS="${2:-}"
    if [[ -z "${PORTS_CHECK_PORTS}" ]]; then
      log_error "--ports-check-ports requires a value."
      exit 1
    fi
    shift 2
    ;;
  --domain)
    DOMAIN_ARG="${2:-}"
    if [[ -z "${DOMAIN_ARG}" ]]; then
      log_error "--domain requires a value."
      exit 1
    fi
    shift 2
    ;;
  --acme-email)
    ACME_EMAIL_ARG="${2:-}"
    if [[ -z "${ACME_EMAIL_ARG}" ]]; then
      log_error "--acme-email requires a value."
      exit 1
    fi
    shift 2
    ;;
  --domain=*)
    DOMAIN_ARG="${1#*=}"
    if [[ -z "${DOMAIN_ARG}" ]]; then
      log_error "--domain requires a non-empty value."
      exit 1
    fi
    shift
    ;;
  --acme-email=*)
    ACME_EMAIL_ARG="${1#*=}"
    if [[ -z "${ACME_EMAIL_ARG}" ]]; then
      log_error "--acme-email requires a non-empty value."
      exit 1
    fi
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --skip-setup --skip-host-readiness --skip-dns-check --skip-ssl-check --skip-ports-check --skip-verify --setup-skip-daemon --preflight-config-only --deploy-dry-run --verify-max-retries <n> --verify-retry-sleep <n> --status-runtime-checks --status-strict --status-skip-host-readiness --status-skip-dns-check --status-skip-ssl-check --status-skip-ports-check --ports-check-ports <p1,p2,...> --domain <hostname> --acme-email <email>"
    exit 1
    ;;
  esac
done

if [[ -n "${VERIFY_MAX_RETRIES}" ]] && { [[ ! "${VERIFY_MAX_RETRIES}" =~ ^[0-9]+$ ]] || [[ "${VERIFY_MAX_RETRIES}" -lt 1 ]]; }; then
  log_error "--verify-max-retries must be a positive integer."
  exit 1
fi

if [[ -n "${VERIFY_RETRY_SLEEP}" ]] && { [[ ! "${VERIFY_RETRY_SLEEP}" =~ ^[0-9]+$ ]] || [[ "${VERIFY_RETRY_SLEEP}" -lt 1 ]]; }; then
  log_error "--verify-retry-sleep must be a positive integer."
  exit 1
fi

if [[ "${RUN_SETUP}" == true ]] && [[ ! -t 0 ]]; then
  log_info "[LAUNCH] non-interactive terminal detected; setup will run in non-interactive mode."
fi

if [[ "${RUN_SETUP}" == false ]]; then
  log_info "[LAUNCH] setup step skipped by --skip-setup"
fi
if [[ "${RUN_HOST_READINESS}" == false ]]; then
  log_info "[LAUNCH] host-readiness step skipped by --skip-host-readiness"
fi
if [[ "${RUN_DNS_CHECK}" == false ]]; then
  log_info "[LAUNCH] dns-check step skipped by --skip-dns-check"
fi
if [[ "${RUN_SSL_CHECK}" == false ]]; then
  log_info "[LAUNCH] ssl-check step skipped by --skip-ssl-check"
fi
if [[ "${RUN_PORTS_CHECK}" == false ]]; then
  log_info "[LAUNCH] ports-check step skipped by --skip-ports-check"
fi
if [[ "${RUN_VERIFY}" == false ]]; then
  log_info "[LAUNCH] verify step skipped by --skip-verify"
fi
if [[ "${STATUS_RUNTIME_CHECKS}" == false ]] &&
  { [[ "${STATUS_SKIP_HOST_READINESS}" == true ]] || [[ "${STATUS_SKIP_DNS_CHECK}" == true ]] || [[ "${STATUS_SKIP_SSL_CHECK}" == true ]] || [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; }; then
  log_warn "[LAUNCH] status runtime skip flags were provided without --status-runtime-checks; skip flags will be ignored."
fi
status_ports_check_enabled=false
if [[ "${STATUS_RUNTIME_CHECKS}" == true ]] && [[ "${RUN_PORTS_CHECK}" == true ]] && [[ "${STATUS_SKIP_PORTS_CHECK}" == false ]]; then
  status_ports_check_enabled=true
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${RUN_PORTS_CHECK}" == false ]] && [[ "${STATUS_RUNTIME_CHECKS}" == false ]]; then
  log_warn "[LAUNCH] --ports-check-ports has no effect when both direct ports check and status runtime checks are disabled."
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${RUN_PORTS_CHECK}" == false ]] && [[ "${status_ports_check_enabled}" == false ]]; then
  log_warn "[LAUNCH] --ports-check-ports has no effect because ports checks are skipped in both direct and status runtime paths."
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${RUN_PORTS_CHECK}" == true ]] && [[ "${status_ports_check_enabled}" == false ]]; then
  log_warn "[LAUNCH] --ports-check-ports has no effect in the status runtime path when --status-skip-ports-check is enabled."
fi

log_info "[LAUNCH] active env file: $(get_env_file)"
log_info "[LAUNCH] active compose file: $(get_compose_file)"

total_steps=3 # preflight + deploy + status
if [[ "${RUN_SETUP}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_HOST_READINESS}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_DNS_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_SSL_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_PORTS_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_VERIFY}" == true ]] && [[ "${DEPLOY_DRY_RUN}" == false ]]; then
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

if [[ "${RUN_HOST_READINESS}" == true ]]; then
  run_step "${step}" "${total_steps}" "host readiness check" "${SCRIPT_DIR}/host-readiness.sh"
  step=$((step + 1))
fi

if [[ "${RUN_DNS_CHECK}" == true ]]; then
  run_step "${step}" "${total_steps}" "dns readiness check" "${SCRIPT_DIR}/dns-check.sh"
  step=$((step + 1))
fi

if [[ "${RUN_SSL_CHECK}" == true ]]; then
  run_step "${step}" "${total_steps}" "ssl certificate check" "${SCRIPT_DIR}/ssl-check.sh"
  step=$((step + 1))
fi

if [[ "${RUN_PORTS_CHECK}" == true ]]; then
  ports_check_args=()
  if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
    ports_check_args+=(--ports "${PORTS_CHECK_PORTS}")
  fi
  run_step "${step}" "${total_steps}" "host ports check" "${SCRIPT_DIR}/ports-check.sh" "${ports_check_args[@]}"
  step=$((step + 1))
fi

preflight_args=()
if [[ "${PREFLIGHT_CONFIG_ONLY}" == true ]]; then
  preflight_args+=(--config-only)
fi
run_step "${step}" "${total_steps}" "preflight validation" "${SCRIPT_DIR}/preflight.sh" "${preflight_args[@]}"
step=$((step + 1))

deploy_args=()
if [[ "${DEPLOY_DRY_RUN}" == true ]]; then
  deploy_args+=(--dry-run)
fi
run_step "${step}" "${total_steps}" "deploy stack" "${SCRIPT_DIR}/deploy.sh" "${deploy_args[@]}"
step=$((step + 1))

if [[ "${RUN_VERIFY}" == true ]]; then
  if [[ "${DEPLOY_DRY_RUN}" == true ]]; then
    log_warn "[LAUNCH] verify step skipped because deploy ran with --deploy-dry-run."
  else
    verify_args=()
    if [[ -n "${VERIFY_MAX_RETRIES}" ]]; then
      verify_args+=(--max-retries "${VERIFY_MAX_RETRIES}")
    fi
    if [[ -n "${VERIFY_RETRY_SLEEP}" ]]; then
      verify_args+=(--retry-sleep "${VERIFY_RETRY_SLEEP}")
    fi
    run_step "${step}" "${total_steps}" "verify deployment" "${SCRIPT_DIR}/verify.sh" "${verify_args[@]}"
    step=$((step + 1))
  fi
fi

status_args=()
if [[ "${STATUS_RUNTIME_CHECKS}" == true ]]; then
  status_args+=(--with-runtime-checks)
  if [[ "${RUN_HOST_READINESS}" == false ]] || [[ "${STATUS_SKIP_HOST_READINESS}" == true ]]; then
    status_args+=(--skip-host-readiness)
  fi
  if [[ "${RUN_DNS_CHECK}" == false ]] || [[ "${STATUS_SKIP_DNS_CHECK}" == true ]]; then
    status_args+=(--skip-dns-check)
  fi
  if [[ "${RUN_SSL_CHECK}" == false ]] || [[ "${STATUS_SKIP_SSL_CHECK}" == true ]]; then
    status_args+=(--skip-ssl-check)
  fi
  if [[ "${RUN_PORTS_CHECK}" == false ]] || [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; then
    status_args+=(--skip-ports-check)
  fi
  if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
    status_args+=(--ports-check-ports "${PORTS_CHECK_PORTS}")
  fi
fi
if [[ "${STATUS_STRICT}" == true ]]; then
  status_args+=(--strict)
fi
run_step "${step}" "${total_steps}" "show status" "${SCRIPT_DIR}/status.sh" "${status_args[@]}"

echo
echo "[mailzen-deploy][LAUNCH] MailZen launch pipeline completed successfully."
