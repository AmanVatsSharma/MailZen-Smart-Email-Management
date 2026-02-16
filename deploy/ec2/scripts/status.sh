#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 status script
# -----------------------------------------------------------------------------
# Shows compose service status and recent container resource usage.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

log_info "Checking MailZen deployment status..."
require_cmd docker
ensure_required_files_exist

compose ps

log_info "Container resource snapshot (cpu/mem):"
docker stats --no-stream \
  mailzen-caddy \
  mailzen-frontend \
  mailzen-backend \
  mailzen-ai-agent-platform \
  mailzen-postgres \
  mailzen-redis || true

print_service_urls
