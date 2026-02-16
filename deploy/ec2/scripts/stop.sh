#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 stop script
# -----------------------------------------------------------------------------
# Usage:
#   ./deploy/ec2/scripts/stop.sh               # stop and remove containers
#   ./deploy/ec2/scripts/stop.sh --purge-data  # also remove DB/Redis volumes
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

PURGE_DATA=false

for arg in "$@"; do
  case "${arg}" in
  --purge-data)
    PURGE_DATA=true
    ;;
  *)
    log_error "Unknown argument: ${arg}"
    log_error "Supported flag: --purge-data"
    exit 1
    ;;
  esac
done

log_info "Stopping MailZen deployment..."
require_cmd docker
ensure_required_files_exist

if [[ "${PURGE_DATA}" == true ]]; then
  log_warn "Purging volumes (database/cache data will be deleted)."
  compose down --volumes --remove-orphans
else
  compose down --remove-orphans
fi

log_info "Stack stopped."
