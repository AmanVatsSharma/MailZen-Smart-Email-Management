#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 restart script
# -----------------------------------------------------------------------------
# Usage:
#   ./deploy/ec2/scripts/restart.sh            # restart full stack
#   ./deploy/ec2/scripts/restart.sh backend    # restart one service
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

SERVICE_NAME="${1:-}"

if [[ -n "${SERVICE_NAME}" ]]; then
  assert_known_service_name "${SERVICE_NAME}"
fi

log_info "Restarting MailZen services..."
require_cmd docker
ensure_required_files_exist

if [[ -n "${SERVICE_NAME}" ]]; then
  compose restart "${SERVICE_NAME}"
  log_info "Restarted service: ${SERVICE_NAME}"
else
  compose restart
  log_info "Restarted all services."
fi

compose ps
