#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 host port readiness check
# -----------------------------------------------------------------------------
# Ensures required public ports are available before starting the stack.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd ss

check_port() {
  local port="$1"
  if ss -ltn "( sport = :${port} )" | awk -v p=":${port}" 'index($0,p){found=1} END{exit found?0:1}'; then
    log_warn "Port ${port} appears to already be in use."
    return 1
  fi
  log_info "Port ${port} is available."
  return 0
}

failure_count=0
check_port 80 || failure_count=$((failure_count + 1))
check_port 443 || failure_count=$((failure_count + 1))

if [[ "${failure_count}" -gt 0 ]]; then
  log_error "Port readiness failed with ${failure_count} conflict(s)."
  exit 1
fi

log_info "Port readiness check passed."
