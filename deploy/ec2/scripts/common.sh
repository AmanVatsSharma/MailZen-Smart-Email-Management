#!/usr/bin/env bash

# Shared helpers for EC2 Docker deployment scripts.
# All scripts source this file to keep behavior consistent and debuggable.

set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_TEMPLATE_FILE="${DEPLOY_DIR}/.env.ec2.example"
ENV_FILE="${DEPLOY_DIR}/.env.ec2"

log_info() {
  echo "[mailzen-deploy][INFO] $*"
}

log_warn() {
  echo "[mailzen-deploy][WARN] $*" >&2
}

log_error() {
  echo "[mailzen-deploy][ERROR] $*" >&2
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    log_error "Missing required command: ${cmd}"
    exit 1
  fi
}

ensure_required_files_exist() {
  if [[ ! -f "${COMPOSE_FILE}" ]]; then
    log_error "Compose file not found: ${COMPOSE_FILE}"
    exit 1
  fi
  if [[ ! -f "${ENV_FILE}" ]]; then
    log_error "Environment file not found: ${ENV_FILE}"
    log_error "Run setup first: ./deploy/ec2/scripts/setup.sh"
    exit 1
  fi
}

ensure_env_file_from_template() {
  if [[ -f "${ENV_FILE}" ]]; then
    log_info "Using existing env file: ${ENV_FILE}"
    return
  fi
  if [[ ! -f "${ENV_TEMPLATE_FILE}" ]]; then
    log_error "Env template missing: ${ENV_TEMPLATE_FILE}"
    exit 1
  fi
  cp "${ENV_TEMPLATE_FILE}" "${ENV_FILE}"
  log_info "Created env file from template: ${ENV_FILE}"
}

read_env_value() {
  local key="$1"
  local file="${2:-${ENV_FILE}}"
  if [[ ! -f "${file}" ]]; then
    echo ""
    return
  fi
  local value
  value="$(grep -E "^${key}=" "${file}" | tail -n 1 | cut -d '=' -f2- || true)"
  echo "${value}"
}

upsert_env_value() {
  local key="$1"
  local value="$2"
  local file="${3:-${ENV_FILE}}"
  local escaped_value
  escaped_value="$(printf '%s' "${value}" | sed -e 's/[\/&]/\\&/g')"

  if grep -q -E "^${key}=" "${file}"; then
    sed -i "s/^${key}=.*/${key}=${escaped_value}/" "${file}"
  else
    printf '\n%s=%s\n' "${key}" "${value}" >>"${file}"
  fi
}

generate_random_secret() {
  local bytes="${1:-48}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "${bytes}"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import secrets; print(secrets.token_hex(${bytes}))"
    return
  fi
  log_error "Unable to generate secrets: install openssl or python3"
  exit 1
}

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

print_service_urls() {
  local domain
  domain="$(read_env_value "MAILZEN_DOMAIN")"
  if [[ -z "${domain}" ]]; then
    log_warn "MAILZEN_DOMAIN is empty in ${ENV_FILE}"
    return
  fi
  log_info "Frontend URL: https://${domain}"
  log_info "GraphQL URL:  https://${domain}/graphql"
}

is_placeholder_value() {
  local value="$1"
  local normalized
  normalized="$(printf '%s' "${value}" | tr '[:upper:]' '[:lower:]')"
  [[ -z "${normalized}" ]] && return 0
  [[ "${normalized}" == *"replace_with"* ]] && return 0
  [[ "${normalized}" == *"please_replace"* ]] && return 0
  [[ "${normalized}" == *"change_me"* ]] && return 0
  [[ "${normalized}" == *"example.com"* ]] && return 0
  return 1
}

assert_env_key_present() {
  local key="$1"
  local value
  value="$(read_env_value "${key}")"
  if [[ -z "${value}" ]]; then
    log_error "Missing required env key '${key}' in ${ENV_FILE}"
    return 1
  fi
  return 0
}

assert_env_key_min_length() {
  local key="$1"
  local minimum_length="$2"
  local value
  value="$(read_env_value "${key}")"
  if [[ "${#value}" -lt "${minimum_length}" ]]; then
    log_error "Env key '${key}' must be at least ${minimum_length} characters."
    return 1
  fi
  return 0
}

assert_env_key_not_placeholder() {
  local key="$1"
  local value
  value="$(read_env_value "${key}")"
  if is_placeholder_value "${value}"; then
    log_error "Env key '${key}' still has a placeholder-style value."
    return 1
  fi
  return 0
}

assert_domain_value() {
  local value="$1"
  if [[ -z "${value}" ]]; then
    log_error "MAILZEN_DOMAIN is empty."
    return 1
  fi
  if [[ "${value}" =~ ^https?:// ]]; then
    log_error "MAILZEN_DOMAIN must not include protocol."
    return 1
  fi
  if [[ ! "${value}" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    log_error "MAILZEN_DOMAIN format is invalid: ${value}"
    return 1
  fi
  return 0
}

assert_https_url_value() {
  local key="$1"
  local value
  value="$(read_env_value "${key}")"
  if [[ ! "${value}" =~ ^https:// ]]; then
    log_error "Env key '${key}' must start with https:// (current: ${value})"
    return 1
  fi
  return 0
}

validate_core_env() {
  local failure_count=0
  local domain
  domain="$(read_env_value "MAILZEN_DOMAIN")"

  assert_env_key_present "MAILZEN_DOMAIN" || failure_count=$((failure_count + 1))
  assert_env_key_present "ACME_EMAIL" || failure_count=$((failure_count + 1))
  assert_env_key_present "FRONTEND_URL" || failure_count=$((failure_count + 1))
  assert_env_key_present "NEXT_PUBLIC_GRAPHQL_ENDPOINT" || failure_count=$((failure_count + 1))
  assert_env_key_present "JWT_SECRET" || failure_count=$((failure_count + 1))
  assert_env_key_present "OAUTH_STATE_SECRET" || failure_count=$((failure_count + 1))
  assert_env_key_present "SECRETS_KEY" || failure_count=$((failure_count + 1))
  assert_env_key_present "POSTGRES_PASSWORD" || failure_count=$((failure_count + 1))

  assert_domain_value "${domain}" || failure_count=$((failure_count + 1))
  assert_https_url_value "FRONTEND_URL" || failure_count=$((failure_count + 1))
  assert_https_url_value "NEXT_PUBLIC_GRAPHQL_ENDPOINT" || failure_count=$((failure_count + 1))

  assert_env_key_min_length "JWT_SECRET" 32 || failure_count=$((failure_count + 1))
  assert_env_key_min_length "OAUTH_STATE_SECRET" 32 || failure_count=$((failure_count + 1))
  assert_env_key_min_length "SECRETS_KEY" 32 || failure_count=$((failure_count + 1))
  assert_env_key_min_length "POSTGRES_PASSWORD" 16 || failure_count=$((failure_count + 1))

  assert_env_key_not_placeholder "MAILZEN_DOMAIN" || failure_count=$((failure_count + 1))
  assert_env_key_not_placeholder "ACME_EMAIL" || failure_count=$((failure_count + 1))
  assert_env_key_not_placeholder "FRONTEND_URL" || failure_count=$((failure_count + 1))
  assert_env_key_not_placeholder "NEXT_PUBLIC_GRAPHQL_ENDPOINT" || failure_count=$((failure_count + 1))
  assert_env_key_not_placeholder "JWT_SECRET" || failure_count=$((failure_count + 1))
  assert_env_key_not_placeholder "OAUTH_STATE_SECRET" || failure_count=$((failure_count + 1))
  assert_env_key_not_placeholder "SECRETS_KEY" || failure_count=$((failure_count + 1))
  assert_env_key_not_placeholder "POSTGRES_PASSWORD" || failure_count=$((failure_count + 1))

  if [[ "${failure_count}" -gt 0 ]]; then
    log_error "Env validation failed with ${failure_count} issue(s)."
    return 1
  fi

  log_info "Core env validation passed."
  return 0
}
