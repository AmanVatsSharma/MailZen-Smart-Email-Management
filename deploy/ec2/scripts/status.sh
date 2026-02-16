#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 status script
# -----------------------------------------------------------------------------
# Shows compose service status and recent container resource usage.
#
# Optional flags:
#   --strict                return non-zero when daemon is unavailable
#   --with-runtime-checks   run host/dns/ssl/ports checks
#   --skip-host-readiness
#   --skip-dns-check
#   --skip-ssl-check
#   --skip-ports-check
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRICT=false
WITH_RUNTIME_CHECKS=false
RUN_HOST_READINESS=true
RUN_DNS_CHECK=true
RUN_SSL_CHECK=true
RUN_PORTS_CHECK=true

while [[ $# -gt 0 ]]; do
  case "$1" in
  --strict)
    STRICT=true
    shift
    ;;
  --with-runtime-checks)
    WITH_RUNTIME_CHECKS=true
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
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --strict --with-runtime-checks --skip-host-readiness --skip-dns-check --skip-ssl-check --skip-ports-check"
    exit 1
    ;;
  esac
done

log_info "Checking MailZen deployment status..."
require_cmd docker
ensure_required_files_exist

daemon_available=true
if ! docker info >/dev/null 2>&1; then
  daemon_available=false
  log_warn "Docker daemon is unavailable. Showing config-only status."
  if ! compose config >/dev/null; then
    log_error "Compose config validation failed while daemon unavailable."
    exit 1
  fi
  if [[ "${STRICT}" == true ]]; then
    log_error "Strict mode enabled; failing because docker daemon is unavailable."
    exit 1
  fi
fi

if [[ "${daemon_available}" == true ]]; then
  compose ps
  log_info "Container resource snapshot (cpu/mem):"
  docker stats --no-stream \
    mailzen-caddy \
    mailzen-frontend \
    mailzen-backend \
    mailzen-ai-agent-platform \
    mailzen-postgres \
    mailzen-redis || true
fi

if [[ "${WITH_RUNTIME_CHECKS}" == true ]]; then
  log_info "Running runtime checks from status script..."
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

print_service_urls
