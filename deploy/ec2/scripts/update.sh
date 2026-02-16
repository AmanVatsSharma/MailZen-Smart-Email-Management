#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 update script
# -----------------------------------------------------------------------------
# Convenient wrapper for production updates:
# - validates env + compose config
# - pulls latest base layers
# - rebuilds app images
# - force-recreates containers
#
# Optional flags:
#   --skip-verify
#   --verify-max-retries <n>
#   --verify-retry-sleep <n>
#   --verify-skip-ssl-check
#   --verify-skip-oauth-check
#   --preflight-config-only
#   --deploy-dry-run
#   --skip-status
#   --status-runtime-checks
#   --status-strict
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_VERIFY=true
RUN_STATUS=true
VERIFY_MAX_RETRIES=""
VERIFY_RETRY_SLEEP=""
PREFLIGHT_CONFIG_ONLY=false
DEPLOY_DRY_RUN=false
VERIFY_SKIP_SSL_CHECK=false
VERIFY_SKIP_OAUTH_CHECK=false
STATUS_RUNTIME_CHECKS=false
STATUS_STRICT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --skip-verify)
    RUN_VERIFY=false
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
  --verify-skip-ssl-check)
    VERIFY_SKIP_SSL_CHECK=true
    shift
    ;;
  --verify-skip-oauth-check)
    VERIFY_SKIP_OAUTH_CHECK=true
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
  --skip-status)
    RUN_STATUS=false
    shift
    ;;
  --status-runtime-checks)
    STATUS_RUNTIME_CHECKS=true
    shift
    ;;
  --status-strict)
    STATUS_STRICT=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --skip-verify --verify-max-retries <n> --verify-retry-sleep <n> --verify-skip-ssl-check --verify-skip-oauth-check --preflight-config-only --deploy-dry-run --skip-status --status-runtime-checks --status-strict"
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

if [[ "${RUN_VERIFY}" == false ]] &&
  { [[ "${VERIFY_SKIP_SSL_CHECK}" == true ]] || [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]] || [[ -n "${VERIFY_MAX_RETRIES}" ]] || [[ -n "${VERIFY_RETRY_SLEEP}" ]]; }; then
  log_warn "Verify-related flags were provided while --skip-verify is enabled; verify flags will be ignored."
fi

log_info "Starting MailZen update workflow..."
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

preflight_args=()
if [[ "${PREFLIGHT_CONFIG_ONLY}" == true ]]; then
  preflight_args+=(--config-only)
fi
"${SCRIPT_DIR}/preflight.sh" "${preflight_args[@]}"

deploy_args=(--pull --force-recreate)
if [[ "${DEPLOY_DRY_RUN}" == true ]]; then
  deploy_args+=(--dry-run)
fi
"${SCRIPT_DIR}/deploy.sh" "${deploy_args[@]}"

if [[ "${RUN_VERIFY}" == true ]]; then
  if [[ "${DEPLOY_DRY_RUN}" == true ]]; then
    log_warn "Skipping verify step because deploy ran in --dry-run mode."
  else
    verify_args=()
    if [[ -n "${VERIFY_MAX_RETRIES}" ]]; then
      verify_args+=(--max-retries "${VERIFY_MAX_RETRIES}")
    fi
    if [[ -n "${VERIFY_RETRY_SLEEP}" ]]; then
      verify_args+=(--retry-sleep "${VERIFY_RETRY_SLEEP}")
    fi
    if [[ "${VERIFY_SKIP_SSL_CHECK}" == true ]]; then
      verify_args+=(--skip-ssl-check)
    fi
    if [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]]; then
      verify_args+=(--skip-oauth-check)
    fi
    "${SCRIPT_DIR}/verify.sh" "${verify_args[@]}"
  fi
fi

if [[ "${RUN_STATUS}" == true ]]; then
  status_args=()
  if [[ "${STATUS_RUNTIME_CHECKS}" == true ]]; then
    status_args+=(--with-runtime-checks)
  fi
  if [[ "${STATUS_STRICT}" == true ]]; then
    status_args+=(--strict)
  fi
  "${SCRIPT_DIR}/status.sh" "${status_args[@]}"
else
  log_warn "Status step skipped (--skip-status)."
fi

log_info "Update workflow completed."
