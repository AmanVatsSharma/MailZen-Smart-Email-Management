#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 stop script
# -----------------------------------------------------------------------------
# Usage:
#   ./deploy/ec2/scripts/stop.sh               # stop and remove containers
#   ./deploy/ec2/scripts/stop.sh --purge-data  # also remove DB/Redis volumes
#   ./deploy/ec2/scripts/stop.sh --purge-data --yes
#   ./deploy/ec2/scripts/stop.sh --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

PURGE_DATA=false
ASSUME_YES=false
DRY_RUN=false

for arg in "$@"; do
  case "${arg}" in
  --purge-data)
    PURGE_DATA=true
    ;;
  --yes)
    ASSUME_YES=true
    ;;
  --dry-run)
    DRY_RUN=true
    ;;
  *)
    log_error "Unknown argument: ${arg}"
    log_error "Supported flags: --purge-data --yes --dry-run"
    exit 1
    ;;
  esac
done

log_info "Stopping MailZen deployment..."
require_cmd docker
ensure_required_files_exist
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

if [[ "${ASSUME_YES}" == true ]] && [[ "${PURGE_DATA}" == false ]]; then
  log_warn "--yes has no effect unless --purge-data is enabled."
fi

if [[ "${PURGE_DATA}" == true ]]; then
  if [[ "${ASSUME_YES}" == false ]]; then
    if [[ -t 0 ]]; then
      log_warn "Purging volumes will permanently delete database/cache data."
      read -r -p "Type 'PURGE' to continue: " confirmation
      if [[ "${confirmation}" != "PURGE" ]]; then
        log_error "Stop operation cancelled."
        exit 1
      fi
    else
      log_error "--purge-data requires --yes in non-interactive mode."
      exit 1
    fi
  fi

  log_warn "Purging volumes (database/cache data will be deleted)."
fi

if [[ "${DRY_RUN}" == false ]]; then
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not reachable. Start Docker and retry."
    exit 1
  fi
fi

if [[ "${PURGE_DATA}" == true ]]; then
  if [[ "${DRY_RUN}" == true ]]; then
    log_info "Dry-run: docker compose down --volumes --remove-orphans"
  else
    compose down --volumes --remove-orphans
  fi
else
  if [[ "${DRY_RUN}" == true ]]; then
    log_info "Dry-run: docker compose down --remove-orphans"
  else
    compose down --remove-orphans
  fi
fi

log_info "Stack stopped."
