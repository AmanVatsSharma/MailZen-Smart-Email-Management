#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 DNS readiness check
# -----------------------------------------------------------------------------
# Purpose:
# - validate that deployment domain resolves before/after cutover
# - optionally verify that domain points to expected public IP
#
# Usage examples:
#   ./deploy/ec2/scripts/dns-check.sh
#   ./deploy/ec2/scripts/dns-check.sh --domain mail.example.com
#   ./deploy/ec2/scripts/dns-check.sh --expected-ip 203.0.113.10
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

DOMAIN=""
EXPECTED_IP=""

is_valid_ipv4() {
  local ip="$1"
  IFS='.' read -r -a octets <<<"${ip}"
  if [[ "${#octets[@]}" -ne 4 ]]; then
    return 1
  fi
  for octet in "${octets[@]}"; do
    if [[ ! "${octet}" =~ ^[0-9]+$ ]]; then
      return 1
    fi
    if ((octet < 0 || octet > 255)); then
      return 1
    fi
  done
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --domain)
    DOMAIN="${2:-}"
    if [[ -z "${DOMAIN}" ]]; then
      log_error "--domain requires a value."
      exit 1
    fi
    shift 2
    ;;
  --expected-ip)
    EXPECTED_IP="${2:-}"
    if [[ -z "${EXPECTED_IP}" ]]; then
      log_error "--expected-ip requires a value."
      exit 1
    fi
    shift 2
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported args: --domain <hostname> --expected-ip <ipv4>"
    exit 1
    ;;
  esac
done

if [[ -z "${DOMAIN}" ]]; then
  ensure_required_files_exist
  validate_core_env
  DOMAIN="$(read_env_value "MAILZEN_DOMAIN")"
fi

if [[ ! "${DOMAIN}" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  log_error "Invalid domain format: ${DOMAIN}"
  exit 1
fi

if [[ -n "${EXPECTED_IP}" ]]; then
  if ! is_valid_ipv4 "${EXPECTED_IP}"; then
    log_error "Invalid IPv4 format for --expected-ip: ${EXPECTED_IP}"
    exit 1
  fi
fi

require_cmd getent
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

log_info "Resolving DNS for domain: ${DOMAIN}"

resolved_records="$(getent ahostsv4 "${DOMAIN}" || true)"
if [[ -z "${resolved_records}" ]]; then
  log_error "Domain did not resolve via IPv4 DNS: ${DOMAIN}"
  exit 1
fi

resolved_ips="$(printf '%s\n' "${resolved_records}" | awk '{print $1}' | sort -u)"
log_info "Resolved IPv4 addresses:"
printf '%s\n' "${resolved_ips}" | while IFS= read -r ip; do
  [[ -n "${ip}" ]] && log_info "  - ${ip}"
done

if [[ -n "${EXPECTED_IP}" ]]; then
  if printf '%s\n' "${resolved_ips}" | grep -qx "${EXPECTED_IP}"; then
    log_info "Expected IP match confirmed: ${EXPECTED_IP}"
  else
    log_error "Expected IP not found in DNS answers: ${EXPECTED_IP}"
    exit 1
  fi
fi

log_info "DNS check passed."
