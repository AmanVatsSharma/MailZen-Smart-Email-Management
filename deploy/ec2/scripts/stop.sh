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
PURGE_DATA_FLAG_SET=false
ASSUME_YES_FLAG_SET=false
DRY_RUN_FLAG_SET=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --purge-data)
    if [[ "${PURGE_DATA_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --purge-data flag detected; keeping --purge-data enabled."
    fi
    PURGE_DATA=true
    PURGE_DATA_FLAG_SET=true
    shift
    ;;
  --yes)
    if [[ "${ASSUME_YES_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --yes flag detected; keeping --yes enabled."
    fi
    ASSUME_YES=true
    ASSUME_YES_FLAG_SET=true
    shift
    ;;
  --dry-run)
    if [[ "${DRY_RUN_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --dry-run flag detected; keeping --dry-run enabled."
    fi
    DRY_RUN=true
    DRY_RUN_FLAG_SET=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
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
  if [[ "${DRY_RUN}" == true ]]; then
    log_warn "--purge-data requested with --dry-run; confirmation is skipped because no data will be deleted."
  elif [[ "${ASSUME_YES}" == false ]]; then
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

  if [[ "${DRY_RUN}" == false ]]; then
    log_warn "Purging volumes (database/cache data will be deleted)."
  fi
fi

if [[ "${PURGE_DATA}" == true ]] && [[ "${DRY_RUN}" == true ]]; then
  log_info "Dry-run enabled; no volumes or data will be deleted."
fi

if [[ "${DRY_RUN}" == false ]]; then
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not reachable. Start Docker and retry."
    exit 1
  fi
fi

down_args=(--remove-orphans)
if [[ "${PURGE_DATA}" == true ]]; then
  down_args+=(--volumes)
fi

log_info "Command preview: $(format_command_for_logs docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" down "${down_args[@]}")"
if [[ "${DRY_RUN}" == true ]]; then
  log_info "Dry-run enabled; command not executed."
  exit 0
fi

compose down "${down_args[@]}"

log_info "Stack stopped."
