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

log_info "Running MailZen EC2 preflight checks..."
require_cmd docker
ensure_required_files_exist
validate_core_env

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not reachable. Start Docker and retry."
  exit 1
fi

if ! compose config >/dev/null; then
  log_error "docker compose config failed. Fix env/compose and retry."
  exit 1
fi

log_info "Preflight checks passed."
print_service_urls
