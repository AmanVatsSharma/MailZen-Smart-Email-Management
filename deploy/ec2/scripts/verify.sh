#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 verification / smoke-check script
# -----------------------------------------------------------------------------
# Purpose:
# - verify deployment URLs after docker stack is up
# - provide non-technical, easy-to-read pass/fail output
#
# Checks:
# 1) Frontend home page over HTTPS
# 2) GraphQL endpoint over HTTPS
# 3) Optional OAuth start endpoint over HTTPS
# 4) TLS certificate health check (via ssl-check.sh)
# 5) Optional docker compose status (when docker is available)
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MAX_RETRIES="5"
RETRY_SLEEP_SECONDS="3"
RUN_SSL_CHECK=true
RUN_OAUTH_CHECK=true
REQUIRE_OAUTH_CHECK=false

# Backward compatibility for positional usage:
#   verify.sh 10 5
if [[ $# -ge 1 ]] && [[ "${1}" =~ ^[0-9]+$ ]]; then
  MAX_RETRIES="${1}"
  shift
fi
if [[ $# -ge 1 ]] && [[ "${1}" =~ ^[0-9]+$ ]]; then
  RETRY_SLEEP_SECONDS="${1}"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
  --max-retries)
    MAX_RETRIES="${2:-}"
    if [[ -z "${MAX_RETRIES}" ]]; then
      log_error "--max-retries requires a value."
      exit 1
    fi
    shift 2
    ;;
  --retry-sleep)
    RETRY_SLEEP_SECONDS="${2:-}"
    if [[ -z "${RETRY_SLEEP_SECONDS}" ]]; then
      log_error "--retry-sleep requires a value."
      exit 1
    fi
    shift 2
    ;;
  --skip-ssl-check)
    RUN_SSL_CHECK=false
    shift
    ;;
  --skip-oauth-check)
    RUN_OAUTH_CHECK=false
    shift
    ;;
  --require-oauth-check)
    REQUIRE_OAUTH_CHECK=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --max-retries <n> --retry-sleep <n> --skip-ssl-check --skip-oauth-check --require-oauth-check"
    exit 1
    ;;
  esac
done

if [[ ! "${MAX_RETRIES}" =~ ^[0-9]+$ ]] || [[ "${MAX_RETRIES}" -lt 1 ]]; then
  log_error "MAX_RETRIES must be a positive integer (received: ${MAX_RETRIES})"
  exit 1
fi

if [[ ! "${RETRY_SLEEP_SECONDS}" =~ ^[0-9]+$ ]] || [[ "${RETRY_SLEEP_SECONDS}" -lt 1 ]]; then
  log_error "RETRY_SLEEP_SECONDS must be a positive integer (received: ${RETRY_SLEEP_SECONDS})"
  exit 1
fi

if [[ "${RUN_OAUTH_CHECK}" == false ]] && [[ "${REQUIRE_OAUTH_CHECK}" == true ]]; then
  log_error "--skip-oauth-check cannot be combined with --require-oauth-check."
  exit 1
fi

require_cmd curl
ensure_required_files_exist
validate_core_env
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

domain="$(read_env_value "MAILZEN_DOMAIN")"
frontend_url="https://${domain}/"
graphql_url="https://${domain}/graphql"
oauth_start_url="https://${domain}/auth/google/start"
google_client_id="$(read_env_value "GOOGLE_CLIENT_ID")"
google_client_secret="$(read_env_value "GOOGLE_CLIENT_SECRET")"

oauth_configured=true
if [[ -z "${google_client_id}" ]] || [[ -z "${google_client_secret}" ]]; then
  oauth_configured=false
fi
if [[ "${oauth_configured}" == true ]]; then
  if is_placeholder_value "${google_client_id}" || is_placeholder_value "${google_client_secret}"; then
    oauth_configured=false
  fi
fi

if [[ "${RUN_OAUTH_CHECK}" == true ]]; then
  if [[ "${oauth_configured}" == false ]] && [[ "${REQUIRE_OAUTH_CHECK}" == true ]]; then
    log_error "OAuth check required but GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not configured."
    exit 1
  fi
  if [[ "${oauth_configured}" == false ]]; then
    RUN_OAUTH_CHECK=false
    log_warn "Skipping OAuth start endpoint check because Google OAuth env keys are not configured."
    log_warn "Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or use --require-oauth-check to enforce."
  fi
fi

check_http_status() {
  local url="$1"
  local label="$2"
  local expected_min="$3"
  local expected_max="$4"

  local attempt=1
  local status_code=""

  while [[ "${attempt}" -le "${MAX_RETRIES}" ]]; do
    log_info "[${label}] attempt ${attempt}/${MAX_RETRIES} -> ${url}"
    status_code="$(curl -sS -o /dev/null -w "%{http_code}" "${url}" || true)"
    if [[ "${status_code}" =~ ^[0-9]+$ ]] &&
      [[ "${status_code}" -ge "${expected_min}" ]] &&
      [[ "${status_code}" -le "${expected_max}" ]]; then
      log_info "[${label}] PASS (status=${status_code})"
      return 0
    fi

    log_warn "[${label}] pending/fail (status=${status_code:-n/a})"
    if [[ "${attempt}" -lt "${MAX_RETRIES}" ]]; then
      sleep "${RETRY_SLEEP_SECONDS}"
    fi
    attempt=$((attempt + 1))
  done

  log_error "[${label}] FAIL after ${MAX_RETRIES} attempts. Last status=${status_code:-n/a}"
  return 1
}

check_graphql_post() {
  local attempt=1
  local status_code=""
  local body='{"query":"query VerifyGraphql { __typename }"}'

  while [[ "${attempt}" -le "${MAX_RETRIES}" ]]; do
    log_info "[graphql-post] attempt ${attempt}/${MAX_RETRIES} -> ${graphql_url}"
    status_code="$(curl -sS -o /dev/null -w "%{http_code}" \
      -H "content-type: application/json" \
      -X POST \
      --data "${body}" \
      "${graphql_url}" || true)"
    if [[ "${status_code}" == "200" ]]; then
      log_info "[graphql-post] PASS (status=200)"
      return 0
    fi
    log_warn "[graphql-post] pending/fail (status=${status_code:-n/a})"
    if [[ "${attempt}" -lt "${MAX_RETRIES}" ]]; then
      sleep "${RETRY_SLEEP_SECONDS}"
    fi
    attempt=$((attempt + 1))
  done

  log_error "[graphql-post] FAIL after ${MAX_RETRIES} attempts. Last status=${status_code:-n/a}"
  return 1
}

log_info "Starting MailZen deployment smoke checks..."
print_service_urls

frontend_ok=true
graphql_get_ok=true
graphql_post_ok=true
oauth_ok=true
ssl_ok=true

check_http_status "${frontend_url}" "frontend-home" 200 399 || frontend_ok=false
check_http_status "${graphql_url}" "graphql-get" 200 499 || graphql_get_ok=false
check_graphql_post || graphql_post_ok=false
if [[ "${RUN_OAUTH_CHECK}" == true ]]; then
  check_http_status "${oauth_start_url}" "oauth-google-start" 200 399 || oauth_ok=false
else
  log_warn "OAuth start endpoint check skipped."
fi
if [[ "${RUN_SSL_CHECK}" == true ]]; then
  "${SCRIPT_DIR}/ssl-check.sh" --domain "${domain}" || ssl_ok=false
else
  log_warn "SSL certificate check skipped (--skip-ssl-check)."
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  log_info "Docker detected. Printing compose status snapshot:"
  compose ps || true
else
  log_warn "Docker not available locally; skipping compose status snapshot."
fi

if [[ "${frontend_ok}" == true ]] &&
  [[ "${graphql_get_ok}" == true ]] &&
  [[ "${graphql_post_ok}" == true ]] &&
  [[ "${oauth_ok}" == true ]] &&
  [[ "${ssl_ok}" == true ]]; then
  log_info "Smoke checks passed."
  exit 0
fi

log_error "One or more smoke checks failed."
exit 1
