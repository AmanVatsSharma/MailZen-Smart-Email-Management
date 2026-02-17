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
# 2) Frontend login page over HTTPS
# 3) GraphQL endpoint over HTTPS
# 4) Optional OAuth start endpoint over HTTPS
# 5) TLS certificate health check (via ssl-check.sh)
# 6) Optional docker compose status (when docker is available)
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MAX_RETRIES="5"
RETRY_SLEEP_SECONDS="3"
RUN_SSL_CHECK=true
RUN_OAUTH_CHECK=true
REQUIRE_OAUTH_CHECK=false
SKIP_SSL_CHECK_FLAG_SET=false
SKIP_OAUTH_CHECK_FLAG_SET=false
REQUIRE_OAUTH_CHECK_FLAG_SET=false
POSITIONAL_MAX_RETRIES_SET=false
POSITIONAL_RETRY_SLEEP_SET=false
POSITIONAL_MAX_RETRIES_VALUE=""
POSITIONAL_RETRY_SLEEP_VALUE=""
MAX_RETRIES_FLAG_SET=false
RETRY_SLEEP_FLAG_SET=false
MAX_RETRIES_FLAG_VALUE=""
RETRY_SLEEP_FLAG_VALUE=""

# Backward compatibility for positional usage:
#   verify.sh 10 5
if [[ $# -ge 1 ]] && [[ "${1}" =~ ^[0-9]+$ ]]; then
  MAX_RETRIES="${1}"
  POSITIONAL_MAX_RETRIES_SET=true
  POSITIONAL_MAX_RETRIES_VALUE="${1}"
  shift
fi
if [[ $# -ge 1 ]] && [[ "${1}" =~ ^[0-9]+$ ]]; then
  RETRY_SLEEP_SECONDS="${1}"
  POSITIONAL_RETRY_SLEEP_SET=true
  POSITIONAL_RETRY_SLEEP_VALUE="${1}"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
  --max-retries)
    max_retries_arg="${2:-}"
    if [[ -z "${max_retries_arg}" ]]; then
      log_error "--max-retries requires a value."
      exit 1
    fi
    if [[ "${MAX_RETRIES_FLAG_SET}" == true ]]; then
      if [[ "${max_retries_arg}" != "${MAX_RETRIES_FLAG_VALUE}" ]]; then
        log_warn "Earlier --max-retries '${MAX_RETRIES_FLAG_VALUE}' overridden by --max-retries '${max_retries_arg}'."
      else
        log_warn "Duplicate --max-retries flag detected; keeping --max-retries '${max_retries_arg}'."
      fi
    fi
    if [[ "${POSITIONAL_MAX_RETRIES_SET}" == true ]]; then
      if [[ "${max_retries_arg}" != "${POSITIONAL_MAX_RETRIES_VALUE}" ]]; then
        log_warn "Positional max retries '${POSITIONAL_MAX_RETRIES_VALUE}' overridden by --max-retries '${max_retries_arg}'."
      else
        log_warn "Positional max retries '${POSITIONAL_MAX_RETRIES_VALUE}' matches --max-retries '${max_retries_arg}'; positional value remains unchanged."
      fi
    fi
    MAX_RETRIES="${max_retries_arg}"
    MAX_RETRIES_FLAG_SET=true
    MAX_RETRIES_FLAG_VALUE="${max_retries_arg}"
    shift 2
    ;;
  --retry-sleep)
    retry_sleep_arg="${2:-}"
    if [[ -z "${retry_sleep_arg}" ]]; then
      log_error "--retry-sleep requires a value."
      exit 1
    fi
    if [[ "${RETRY_SLEEP_FLAG_SET}" == true ]]; then
      if [[ "${retry_sleep_arg}" != "${RETRY_SLEEP_FLAG_VALUE}" ]]; then
        log_warn "Earlier --retry-sleep '${RETRY_SLEEP_FLAG_VALUE}' overridden by --retry-sleep '${retry_sleep_arg}'."
      else
        log_warn "Duplicate --retry-sleep flag detected; keeping --retry-sleep '${retry_sleep_arg}'."
      fi
    fi
    if [[ "${POSITIONAL_RETRY_SLEEP_SET}" == true ]]; then
      if [[ "${retry_sleep_arg}" != "${POSITIONAL_RETRY_SLEEP_VALUE}" ]]; then
        log_warn "Positional retry sleep '${POSITIONAL_RETRY_SLEEP_VALUE}' overridden by --retry-sleep '${retry_sleep_arg}'."
      else
        log_warn "Positional retry sleep '${POSITIONAL_RETRY_SLEEP_VALUE}' matches --retry-sleep '${retry_sleep_arg}'; positional value remains unchanged."
      fi
    fi
    RETRY_SLEEP_SECONDS="${retry_sleep_arg}"
    RETRY_SLEEP_FLAG_SET=true
    RETRY_SLEEP_FLAG_VALUE="${retry_sleep_arg}"
    shift 2
    ;;
  --skip-ssl-check)
    if [[ "${SKIP_SSL_CHECK_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --skip-ssl-check flag detected; SSL check remains skipped."
    fi
    RUN_SSL_CHECK=false
    SKIP_SSL_CHECK_FLAG_SET=true
    shift
    ;;
  --skip-oauth-check)
    if [[ "${SKIP_OAUTH_CHECK_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --skip-oauth-check flag detected; OAuth check remains skipped."
    fi
    RUN_OAUTH_CHECK=false
    SKIP_OAUTH_CHECK_FLAG_SET=true
    shift
    ;;
  --require-oauth-check)
    if [[ "${REQUIRE_OAUTH_CHECK_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --require-oauth-check flag detected; OAuth check remains required."
    fi
    REQUIRE_OAUTH_CHECK=true
    REQUIRE_OAUTH_CHECK_FLAG_SET=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --max-retries <n> --retry-sleep <n> --skip-ssl-check --skip-oauth-check --require-oauth-check"
    exit 1
    ;;
  esac
done

assert_positive_integer "--max-retries" "${MAX_RETRIES}" || exit 1
assert_positive_integer "--retry-sleep" "${RETRY_SLEEP_SECONDS}" || exit 1

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
login_url="https://${domain}/login"
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
  local command_preview
  command_preview="$(format_command_for_logs curl -sS -o /dev/null -w "%{http_code}" "${url}")"
  log_info "[${label}] command preview: ${command_preview}"

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
  local command_preview
  command_preview="$(format_command_for_logs curl -sS -o /dev/null -w "%{http_code}" -H "content-type: application/json" -X POST --data "${body}" "${graphql_url}")"
  log_info "[graphql-post] command preview: ${command_preview}"

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
login_ok=true
graphql_get_ok=true
graphql_post_ok=true
oauth_ok=true
ssl_ok=true

check_http_status "${frontend_url}" "frontend-home" 200 399 || frontend_ok=false
check_http_status "${login_url}" "frontend-login" 200 399 || login_ok=false
check_http_status "${graphql_url}" "graphql-get" 200 499 || graphql_get_ok=false
check_graphql_post || graphql_post_ok=false
if [[ "${RUN_OAUTH_CHECK}" == true ]]; then
  check_http_status "${oauth_start_url}" "oauth-google-start" 200 399 || oauth_ok=false
else
  log_warn "OAuth start endpoint check skipped."
fi
if [[ "${RUN_SSL_CHECK}" == true ]]; then
  log_info "Command preview: $(format_command_for_logs "${SCRIPT_DIR}/ssl-check.sh" --domain "${domain}")"
  "${SCRIPT_DIR}/ssl-check.sh" --domain "${domain}" || ssl_ok=false
else
  log_warn "SSL certificate check skipped (--skip-ssl-check)."
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  log_info "Docker detected. Printing compose status snapshot:"
  log_info "Command preview: $(format_command_for_logs docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" ps)"
  compose ps || true
else
  log_warn "Docker not available locally; skipping compose status snapshot."
fi

if [[ "${frontend_ok}" == true ]] &&
  [[ "${login_ok}" == true ]] &&
  [[ "${graphql_get_ok}" == true ]] &&
  [[ "${graphql_post_ok}" == true ]] &&
  [[ "${oauth_ok}" == true ]] &&
  [[ "${ssl_ok}" == true ]]; then
  log_info "Smoke checks passed."
  exit 0
fi

log_error "One or more smoke checks failed."
exit 1
