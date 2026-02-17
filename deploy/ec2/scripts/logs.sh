#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 logs script
# -----------------------------------------------------------------------------
# Usage:
#   ./deploy/ec2/scripts/logs.sh                 # all services, tail=200
#   ./deploy/ec2/scripts/logs.sh backend         # one service
#   ./deploy/ec2/scripts/logs.sh backend 500     # one service, custom tail
#   ./deploy/ec2/scripts/logs.sh --service backend --tail 500 --no-follow
#   ./deploy/ec2/scripts/logs.sh --since 30m
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

SERVICE_NAME=""
TAIL_LINES="200"
FOLLOW=true
SINCE_WINDOW=""
POSITIONAL_SERVICE=""
POSITIONAL_TAIL=""
POSITIONAL_SERVICE_SET=false
POSITIONAL_TAIL_SET=false
SERVICE_FLAG_SET=false
SERVICE_FLAG_VALUE=""
TAIL_FLAG_SET=false
TAIL_FLAG_VALUE=""
SINCE_FLAG_SET=false
SINCE_FLAG_VALUE=""

# Backward-compatible positional arguments:
#   logs.sh [service] [tail]
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  SERVICE_NAME="$1"
  POSITIONAL_SERVICE="${SERVICE_NAME}"
  POSITIONAL_SERVICE_SET=true
  shift
fi
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  TAIL_LINES="$1"
  POSITIONAL_TAIL="${TAIL_LINES}"
  POSITIONAL_TAIL_SET=true
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
  --service)
    service_arg="${2:-}"
    if [[ -z "${service_arg}" ]]; then
      log_error "--service requires a value."
      exit 1
    fi
    if [[ "${SERVICE_FLAG_SET}" == true ]] && [[ "${service_arg}" != "${SERVICE_FLAG_VALUE}" ]]; then
      log_warn "Earlier --service '${SERVICE_FLAG_VALUE}' overridden by --service '${service_arg}'."
    fi
    if [[ "${POSITIONAL_SERVICE_SET}" == true ]] && [[ "${service_arg}" != "${POSITIONAL_SERVICE}" ]]; then
      log_warn "Positional service '${POSITIONAL_SERVICE}' overridden by --service '${service_arg}'."
    fi
    SERVICE_NAME="${service_arg}"
    SERVICE_FLAG_SET=true
    SERVICE_FLAG_VALUE="${service_arg}"
    shift 2
    ;;
  --tail)
    tail_arg="${2:-}"
    if [[ -z "${tail_arg}" ]]; then
      log_error "--tail requires a value."
      exit 1
    fi
    if [[ "${TAIL_FLAG_SET}" == true ]] && [[ "${tail_arg}" != "${TAIL_FLAG_VALUE}" ]]; then
      log_warn "Earlier --tail '${TAIL_FLAG_VALUE}' overridden by --tail '${tail_arg}'."
    fi
    if [[ "${POSITIONAL_TAIL_SET}" == true ]] && [[ "${tail_arg}" != "${POSITIONAL_TAIL}" ]]; then
      log_warn "Positional tail '${POSITIONAL_TAIL}' overridden by --tail '${tail_arg}'."
    fi
    TAIL_LINES="${tail_arg}"
    TAIL_FLAG_SET=true
    TAIL_FLAG_VALUE="${tail_arg}"
    shift 2
    ;;
  --since)
    since_arg="${2:-}"
    if [[ -z "${since_arg}" ]]; then
      log_error "--since requires a value."
      exit 1
    fi
    if [[ "${SINCE_FLAG_SET}" == true ]] && [[ "${since_arg}" != "${SINCE_FLAG_VALUE}" ]]; then
      log_warn "Earlier --since '${SINCE_FLAG_VALUE}' overridden by --since '${since_arg}'."
    fi
    SINCE_WINDOW="${since_arg}"
    SINCE_FLAG_SET=true
    SINCE_FLAG_VALUE="${since_arg}"
    shift 2
    ;;
  --no-follow)
    FOLLOW=false
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --service <name> --tail <n> --since <duration> --no-follow"
    exit 1
    ;;
  esac
done

assert_positive_integer "--tail" "${TAIL_LINES}" || exit 1
if [[ -z "${SERVICE_NAME}" ]] && [[ -n "${SINCE_WINDOW}" ]]; then
  log_info "Applying --since ${SINCE_WINDOW} for all services."
fi

if [[ -n "${SERVICE_NAME}" ]]; then
  assert_known_service_name "${SERVICE_NAME}"
fi

log_info "Opening logs (tail=${TAIL_LINES}, follow=${FOLLOW}, since=${SINCE_WINDOW:-none})..."
require_cmd docker
ensure_required_files_exist
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not reachable. Start Docker and retry."
  exit 1
fi

log_args=(--tail "${TAIL_LINES}")
if [[ -n "${SINCE_WINDOW}" ]]; then
  log_args+=(--since "${SINCE_WINDOW}")
fi
if [[ "${FOLLOW}" == true ]]; then
  log_args+=(-f)
fi

if [[ -n "${SERVICE_NAME}" ]]; then
  compose logs "${log_args[@]}" "${SERVICE_NAME}"
  exit 0
fi

compose logs "${log_args[@]}"
