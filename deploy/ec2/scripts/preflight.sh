#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 preflight validation script
# -----------------------------------------------------------------------------
# Use this before deploy to validate:
# - required files
# - required env values and constraints
# - docker daemon availability
# - docker compose configuration rendering
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

CONFIG_ONLY=false

for arg in "$@"; do
  case "${arg}" in
  --config-only|--skip-daemon)
    CONFIG_ONLY=true
    ;;
  *)
    log_error "Unknown argument: ${arg}"
    log_error "Supported flags: --config-only (or --skip-daemon)"
    exit 1
    ;;
  esac
done

log_info "Running MailZen EC2 preflight checks..."
require_cmd docker
ensure_required_files_exist
validate_core_env

if [[ "${CONFIG_ONLY}" == false ]]; then
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not reachable. Start Docker and retry."
    log_error "Tip: run preflight in config-only mode: ./deploy/ec2/scripts/preflight.sh --config-only"
    exit 1
  fi
else
  log_warn "Running in config-only mode (daemon check skipped)."
fi

if ! compose config >/dev/null; then
  log_error "docker compose config failed. Fix env/compose and retry."
  exit 1
fi

log_info "Preflight checks passed."
print_service_urls
