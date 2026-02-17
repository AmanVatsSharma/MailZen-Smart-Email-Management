#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 host port readiness check
# -----------------------------------------------------------------------------
# Ensures required public ports are available before starting the stack.
#
# Usage:
#   ./deploy/ec2/scripts/ports-check.sh
#   ./deploy/ec2/scripts/ports-check.sh --ports 80,443
#   ./deploy/ec2/scripts/ports-check.sh --ports 80,443,8100
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

PORTS_RAW="80,443"
PORTS=()
PORTS_FLAG_SET=false
PORTS_FLAG_VALUE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
  --ports)
    ports_arg="${2:-}"
    if [[ -z "${ports_arg}" ]]; then
      log_error "--ports requires a comma-separated value (example: --ports 80,443)."
      exit 1
    fi
    if [[ "${PORTS_FLAG_SET}" == true ]] && [[ "${ports_arg}" != "${PORTS_FLAG_VALUE}" ]]; then
      log_warn "Earlier --ports '${PORTS_FLAG_VALUE}' overridden by --ports '${ports_arg}'."
    fi
    PORTS_RAW="${ports_arg}"
    PORTS_FLAG_SET=true
    PORTS_FLAG_VALUE="${ports_arg}"
    shift 2
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --ports <p1,p2,...>"
    exit 1
    ;;
  esac
done

assert_ports_csv_value "--ports" "${PORTS_RAW}" || exit 1
PORTS_RAW="$(normalize_ports_csv "${PORTS_RAW}")"

IFS=',' read -r -a parsed_ports <<<"${PORTS_RAW}"
declare -A seen_ports=()
for raw_port in "${parsed_ports[@]}"; do
  port="$(printf '%s' "${raw_port}" | tr -d '[:space:]')"
  if [[ -z "${port}" ]]; then
    continue
  fi
  if [[ -z "${seen_ports[${port}]:-}" ]]; then
    PORTS+=("${port}")
    seen_ports["${port}"]=1
  fi
done

if [[ "${#PORTS[@]}" -eq 0 ]]; then
  log_error "No valid ports resolved from --ports value: '${PORTS_RAW}'"
  exit 1
fi

require_cmd ss
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"
log_info "Checking host port readiness for: ${PORTS[*]}"

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
for port in "${PORTS[@]}"; do
  check_port "${port}" || failure_count=$((failure_count + 1))
done

if [[ "${failure_count}" -gt 0 ]]; then
  log_error "Port readiness failed with ${failure_count} conflict(s)."
  exit 1
fi

log_info "Port readiness check passed."
