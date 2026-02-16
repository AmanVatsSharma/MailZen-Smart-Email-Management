#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 preflight validation script
# -----------------------------------------------------------------------------
# Use this before deploy to validate:
# - required files
# - required env values and constraints
# - docker daemon availability
# - docker compose configuration rendering
# - optional runtime readiness checks (host/dns/ssl/ports)
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CONFIG_ONLY=false
WITH_RUNTIME_CHECKS=false
RUN_HOST_READINESS=true
RUN_DNS_CHECK=true
RUN_SSL_CHECK=true
RUN_PORTS_CHECK=true

for arg in "$@"; do
  case "${arg}" in
  --config-only|--skip-daemon)
    CONFIG_ONLY=true
    ;;
  --with-runtime-checks)
    WITH_RUNTIME_CHECKS=true
    ;;
  --skip-host-readiness)
    RUN_HOST_READINESS=false
    ;;
  --skip-dns-check)
    RUN_DNS_CHECK=false
    ;;
  --skip-ssl-check)
    RUN_SSL_CHECK=false
    ;;
  --skip-ports-check)
    RUN_PORTS_CHECK=false
    ;;
  *)
    log_error "Unknown argument: ${arg}"
    log_error "Supported flags: --config-only --with-runtime-checks --skip-host-readiness --skip-dns-check --skip-ssl-check --skip-ports-check"
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

if [[ "${WITH_RUNTIME_CHECKS}" == true ]]; then
  log_info "Running extended runtime checks (--with-runtime-checks)..."
  if [[ "${RUN_HOST_READINESS}" == true ]]; then
    "${SCRIPT_DIR}/host-readiness.sh"
  else
    log_warn "Skipping host-readiness check (--skip-host-readiness)."
  fi

  if [[ "${RUN_DNS_CHECK}" == true ]]; then
    "${SCRIPT_DIR}/dns-check.sh"
  else
    log_warn "Skipping DNS check (--skip-dns-check)."
  fi

  if [[ "${RUN_SSL_CHECK}" == true ]]; then
    "${SCRIPT_DIR}/ssl-check.sh"
  else
    log_warn "Skipping SSL check (--skip-ssl-check)."
  fi

  if [[ "${RUN_PORTS_CHECK}" == true ]]; then
    "${SCRIPT_DIR}/ports-check.sh"
  else
    log_warn "Skipping ports check (--skip-ports-check)."
  fi
fi

log_info "Preflight checks passed."
print_service_urls
