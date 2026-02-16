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

# Backward-compatible positional arguments:
#   logs.sh [service] [tail]
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  SERVICE_NAME="$1"
  shift
fi
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  TAIL_LINES="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
  --service)
    SERVICE_NAME="${2:-}"
    shift 2
    ;;
  --tail)
    TAIL_LINES="${2:-}"
    shift 2
    ;;
  --since)
    SINCE_WINDOW="${2:-}"
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

if [[ ! "${TAIL_LINES}" =~ ^[0-9]+$ ]]; then
  log_error "Tail lines must be a positive integer (received: ${TAIL_LINES})"
  exit 1
fi
if [[ -z "${SERVICE_NAME}" ]] && [[ -n "${SINCE_WINDOW}" ]]; then
  log_info "Applying --since ${SINCE_WINDOW} for all services."
fi

if [[ -n "${SERVICE_NAME}" ]]; then
  assert_known_service_name "${SERVICE_NAME}"
fi

log_info "Opening logs (tail=${TAIL_LINES}, follow=${FOLLOW}, since=${SINCE_WINDOW:-none})..."
require_cmd docker
ensure_required_files_exist

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
