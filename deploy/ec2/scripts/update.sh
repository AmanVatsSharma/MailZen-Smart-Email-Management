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
#   --preflight-config-only
#   --deploy-dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_VERIFY=true
VERIFY_MAX_RETRIES=""
VERIFY_RETRY_SLEEP=""
PREFLIGHT_CONFIG_ONLY=false
DEPLOY_DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --skip-verify)
    RUN_VERIFY=false
    shift
    ;;
  --verify-max-retries)
    VERIFY_MAX_RETRIES="${2:-}"
    shift 2
    ;;
  --verify-retry-sleep)
    VERIFY_RETRY_SLEEP="${2:-}"
    shift 2
    ;;
  --preflight-config-only)
    PREFLIGHT_CONFIG_ONLY=true
    shift
    ;;
  --deploy-dry-run)
    DEPLOY_DRY_RUN=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --skip-verify --verify-max-retries <n> --verify-retry-sleep <n> --preflight-config-only --deploy-dry-run"
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

log_info "Starting MailZen update workflow..."

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
    "${SCRIPT_DIR}/verify.sh" "${verify_args[@]}"
  fi
fi

log_info "Update workflow completed."
