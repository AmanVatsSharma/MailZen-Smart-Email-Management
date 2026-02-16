#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 restart script
# -----------------------------------------------------------------------------
# Usage:
#   ./deploy/ec2/scripts/restart.sh            # restart full stack
#   ./deploy/ec2/scripts/restart.sh backend    # restart one service
#   ./deploy/ec2/scripts/restart.sh --service backend --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

SERVICE_NAME="${1:-}"
DRY_RUN=false
WAIT_SECONDS=0

if [[ -n "${SERVICE_NAME}" ]] && [[ "${SERVICE_NAME}" =~ ^-- ]]; then
  SERVICE_NAME=""
fi

if [[ -n "${SERVICE_NAME}" ]]; then
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
  --service)
    SERVICE_NAME="${2:-}"
    if [[ -z "${SERVICE_NAME}" ]]; then
      log_error "--service requires a value."
      exit 1
    fi
    shift 2
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  --wait-seconds)
    WAIT_SECONDS="${2:-}"
    if [[ -z "${WAIT_SECONDS}" ]]; then
      log_error "--wait-seconds requires a value."
      exit 1
    fi
    shift 2
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: [service] --service <name> --dry-run --wait-seconds <n>"
    exit 1
    ;;
  esac
done

if [[ ! "${WAIT_SECONDS}" =~ ^[0-9]+$ ]]; then
  log_error "--wait-seconds must be a non-negative integer."
  exit 1
fi

if [[ -n "${SERVICE_NAME}" ]]; then
  assert_known_service_name "${SERVICE_NAME}"
fi

log_info "Restarting MailZen services..."
require_cmd docker
ensure_required_files_exist

if [[ "${DRY_RUN}" == false ]]; then
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not reachable. Start Docker and retry."
    exit 1
  fi
fi

if [[ -n "${SERVICE_NAME}" ]]; then
  if [[ "${DRY_RUN}" == true ]]; then
    log_info "Dry-run: docker compose restart ${SERVICE_NAME}"
  else
    compose restart "${SERVICE_NAME}"
    log_info "Restarted service: ${SERVICE_NAME}"
  fi
else
  if [[ "${DRY_RUN}" == true ]]; then
    log_info "Dry-run: docker compose restart (all services)"
  else
    compose restart
    log_info "Restarted all services."
  fi
fi

if [[ "${DRY_RUN}" == true ]]; then
  exit 0
fi

if [[ "${WAIT_SECONDS}" -gt 0 ]]; then
  log_info "Waiting ${WAIT_SECONDS}s before status snapshot..."
  sleep "${WAIT_SECONDS}"
fi

compose ps
