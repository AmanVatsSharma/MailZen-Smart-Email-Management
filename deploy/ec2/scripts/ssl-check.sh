#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 SSL/TLS certificate check
# -----------------------------------------------------------------------------
# Validates HTTPS certificate visibility and prints expiry information.
#
# Usage:
#   ./deploy/ec2/scripts/ssl-check.sh
#   ./deploy/ec2/scripts/ssl-check.sh --domain mail.example.com
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

DOMAIN=""
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
  *)
    log_error "Unknown argument: $1"
    log_error "Supported arg: --domain <hostname>"
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

require_cmd openssl
require_cmd curl
require_cmd python3
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

log_info "Checking TLS certificate for domain: ${DOMAIN}"

cert_text="$(echo | openssl s_client -servername "${DOMAIN}" -connect "${DOMAIN}:443" 2>/dev/null | openssl x509 -noout -subject -issuer -dates || true)"
if [[ -z "${cert_text}" ]]; then
  log_error "Unable to read certificate from ${DOMAIN}:443"
  exit 1
fi

subject_line="$(printf '%s\n' "${cert_text}" | awk -F= '/^subject=/{print substr($0,9)}')"
issuer_line="$(printf '%s\n' "${cert_text}" | awk -F= '/^issuer=/{print substr($0,8)}')"
not_before="$(printf '%s\n' "${cert_text}" | awk -F= '/^notBefore=/{print $2}')"
not_after="$(printf '%s\n' "${cert_text}" | awk -F= '/^notAfter=/{print $2}')"

if [[ -z "${not_after}" ]]; then
  log_error "Certificate expiry (notAfter) not found."
  exit 1
fi

days_left="$(python3 - <<PY
from datetime import datetime, timezone
import email.utils
import sys

expiry_raw = """${not_after}"""
parsed = email.utils.parsedate_to_datetime(expiry_raw)
if parsed.tzinfo is None:
    parsed = parsed.replace(tzinfo=timezone.utc)
now = datetime.now(timezone.utc)
delta = parsed - now
print(delta.days)
PY
)"

if [[ ! "${days_left}" =~ ^-?[0-9]+$ ]]; then
  log_error "Unable to calculate certificate remaining days."
  exit 1
fi

status_code="$(curl -sS -o /dev/null -w "%{http_code}" "https://${DOMAIN}" || true)"

log_info "Certificate subject: ${subject_line:-unknown}"
log_info "Certificate issuer:  ${issuer_line:-unknown}"
log_info "Valid from:           ${not_before:-unknown}"
log_info "Valid until:          ${not_after}"
log_info "Days until expiry:    ${days_left}"
log_info "HTTPS status code:    ${status_code:-n/a}"

if [[ "${days_left}" -lt 0 ]]; then
  log_error "Certificate appears expired."
  exit 1
fi

if [[ ! "${status_code}" =~ ^[0-9]+$ ]] || [[ "${status_code}" -ge 500 ]]; then
  log_error "HTTPS endpoint check failed with status ${status_code:-n/a}"
  exit 1
fi

if [[ "${days_left}" -lt 14 ]]; then
  log_warn "Certificate expiry is near (<14 days). Renew soon."
fi

log_info "SSL/TLS check passed."
