#!/usr/bin/env bash

# Shared helpers for EC2 Docker deployment scripts.
# All scripts source this file to keep behavior consistent and debuggable.

set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# Advanced override hooks:
# - MAILZEN_DEPLOY_ENV_FILE: custom env file path (useful for CI seeded checks)
# - MAILZEN_DEPLOY_COMPOSE_FILE: custom compose file path
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_TEMPLATE_FILE="${DEPLOY_DIR}/.env.ec2.example"
ENV_FILE="${DEPLOY_DIR}/.env.ec2"
KNOWN_SERVICES=(
  caddy
  frontend
  backend
  ai-agent-platform
  postgres
  redis
)

get_compose_file() {
  echo "${MAILZEN_DEPLOY_COMPOSE_FILE:-${COMPOSE_FILE}}"
}

get_env_file() {
  echo "${MAILZEN_DEPLOY_ENV_FILE:-${ENV_FILE}}"
}

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
  local active_compose_file
  active_compose_file="$(get_compose_file)"
  local active_env_file
  active_env_file="$(get_env_file)"

  if [[ ! -f "${active_compose_file}" ]]; then
    log_error "Compose file not found: ${active_compose_file}"
    exit 1
  fi
  if [[ ! -f "${active_env_file}" ]]; then
    log_error "Environment file not found: ${active_env_file}"
    log_error "Run setup first: ./deploy/ec2/scripts/setup.sh"
    exit 1
  fi
}

ensure_env_file_from_template() {
  local active_env_file
  active_env_file="$(get_env_file)"

  if [[ -f "${active_env_file}" ]]; then
    log_info "Using existing env file: ${active_env_file}"
    return
  fi
  if [[ ! -f "${ENV_TEMPLATE_FILE}" ]]; then
    log_error "Env template missing: ${ENV_TEMPLATE_FILE}"
    exit 1
  fi
  cp "${ENV_TEMPLATE_FILE}" "${active_env_file}"
  log_info "Created env file from template: ${active_env_file}"
}

read_env_value() {
  local key="$1"
  local file="${2:-$(get_env_file)}"
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
  local file="${3:-$(get_env_file)}"
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

create_seeded_env_file() {
  local run_label="${1:-seeded}"
  local target_dir="${2:-${DEPLOY_DIR}}"

  if [[ ! -f "${ENV_TEMPLATE_FILE}" ]]; then
    log_error "Env template missing: ${ENV_TEMPLATE_FILE}"
    return 1
  fi

  local seeded_file
  seeded_file="$(mktemp "${target_dir}/.env.${run_label}.XXXXXX")"
  cp "${ENV_TEMPLATE_FILE}" "${seeded_file}"

  sed -i 's/^MAILZEN_DOMAIN=.*/MAILZEN_DOMAIN=mailzen.pipeline.local/' "${seeded_file}"
  sed -i 's/^ACME_EMAIL=.*/ACME_EMAIL=ops@mailzen-pipeline.dev/' "${seeded_file}"
  sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://mailzen.pipeline.local|' "${seeded_file}"
  sed -i 's|^NEXT_PUBLIC_GRAPHQL_ENDPOINT=.*|NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://mailzen.pipeline.local/graphql|' "${seeded_file}"
  sed -i 's/^JWT_SECRET=.*/JWT_SECRET=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd/' "${seeded_file}"
  sed -i 's/^OAUTH_STATE_SECRET=.*/OAUTH_STATE_SECRET=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789abcd/' "${seeded_file}"
  sed -i 's/^SECRETS_KEY=.*/SECRETS_KEY=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789abcd/' "${seeded_file}"
  sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=mailzenpipelinepostgrespassword123/' "${seeded_file}"
  sed -i 's/^AI_AGENT_PLATFORM_KEY=.*/AI_AGENT_PLATFORM_KEY=mailzenpipelineagentplatformkey1234567890abcd/' "${seeded_file}"
  sed -i 's|^GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=https://mailzen.pipeline.local/auth/google/callback|' "${seeded_file}"
  sed -i 's|^GOOGLE_PROVIDER_REDIRECT_URI=.*|GOOGLE_PROVIDER_REDIRECT_URI=https://mailzen.pipeline.local/email-integration/google/callback|' "${seeded_file}"
  sed -i 's|^OUTLOOK_REDIRECT_URI=.*|OUTLOOK_REDIRECT_URI=https://mailzen.pipeline.local/auth/microsoft/callback|' "${seeded_file}"
  sed -i 's|^OUTLOOK_PROVIDER_REDIRECT_URI=.*|OUTLOOK_PROVIDER_REDIRECT_URI=https://mailzen.pipeline.local/email-integration/microsoft/callback|' "${seeded_file}"
  sed -i 's|^PROVIDER_SECRETS_KEYRING=.*|PROVIDER_SECRETS_KEYRING=default:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789abcd|' "${seeded_file}"

  echo "${seeded_file}"
  return 0
}

compose() {
  local active_env_file
  active_env_file="$(get_env_file)"
  local active_compose_file
  active_compose_file="$(get_compose_file)"
  docker compose --env-file "${active_env_file}" -f "${active_compose_file}" "$@"
}

print_service_urls() {
  local domain
  local active_env_file
  active_env_file="$(get_env_file)"
  domain="$(read_env_value "MAILZEN_DOMAIN")"
  if [[ -z "${domain}" ]]; then
    log_warn "MAILZEN_DOMAIN is empty in ${active_env_file}"
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
  local active_env_file
  active_env_file="$(get_env_file)"
  value="$(read_env_value "${key}")"
  if [[ -z "${value}" ]]; then
    log_error "Missing required env key '${key}' in ${active_env_file}"
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

extract_url_host() {
  local url="$1"
  local no_protocol="${url#https://}"
  no_protocol="${no_protocol#http://}"
  echo "${no_protocol%%/*}"
}

assert_email_value() {
  local key="$1"
  local value
  value="$(read_env_value "${key}")"
  if [[ ! "${value}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
    log_error "Env key '${key}' must be a valid email address (current: ${value})"
    return 1
  fi
  return 0
}

assert_url_host_matches_domain() {
  local key="$1"
  local expected_domain="$2"
  local value
  value="$(read_env_value "${key}")"
  local host
  host="$(extract_url_host "${value}")"
  if [[ "${host}" != "${expected_domain}" ]]; then
    log_error "Env key '${key}' host must match MAILZEN_DOMAIN (${expected_domain}), current host=${host}"
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
  assert_email_value "ACME_EMAIL" || failure_count=$((failure_count + 1))
  assert_https_url_value "FRONTEND_URL" || failure_count=$((failure_count + 1))
  assert_https_url_value "NEXT_PUBLIC_GRAPHQL_ENDPOINT" || failure_count=$((failure_count + 1))
  assert_url_host_matches_domain "FRONTEND_URL" "${domain}" || failure_count=$((failure_count + 1))
  assert_url_host_matches_domain "NEXT_PUBLIC_GRAPHQL_ENDPOINT" "${domain}" || failure_count=$((failure_count + 1))

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

is_known_service_name() {
  local candidate="$1"
  local service
  for service in "${KNOWN_SERVICES[@]}"; do
    if [[ "${service}" == "${candidate}" ]]; then
      return 0
    fi
  done
  return 1
}

assert_known_service_name() {
  local candidate="$1"
  if is_known_service_name "${candidate}"; then
    return 0
  fi
  log_error "Unknown service '${candidate}'."
  log_error "Allowed services: ${KNOWN_SERVICES[*]}"
  return 1
}

is_safe_label() {
  local candidate="$1"
  [[ "${candidate}" =~ ^[A-Za-z0-9._-]+$ ]]
}

assert_safe_label() {
  local label_name="$1"
  local label_value="$2"
  if is_safe_label "${label_value}"; then
    return 0
  fi
  log_error "${label_name} must match [A-Za-z0-9._-] (received: ${label_value})"
  return 1
}

is_positive_integer() {
  local candidate="${1:-}"
  [[ "${candidate}" =~ ^[0-9]+$ ]] && [[ "${candidate}" -ge 1 ]]
}

assert_positive_integer() {
  local flag_name="$1"
  local candidate="$2"
  if is_positive_integer "${candidate}"; then
    return 0
  fi
  log_error "${flag_name} must be a positive integer."
  return 1
}

is_non_negative_integer() {
  local candidate="${1:-}"
  [[ "${candidate}" =~ ^[0-9]+$ ]]
}

assert_non_negative_integer() {
  local flag_name="$1"
  local candidate="$2"
  if is_non_negative_integer "${candidate}"; then
    return 0
  fi
  log_error "${flag_name} must be a non-negative integer."
  return 1
}

assert_ports_csv_value() {
  local flag_name="$1"
  local ports_raw="$2"

  if [[ -z "${ports_raw}" ]]; then
    log_error "${flag_name} requires a comma-separated value."
    return 1
  fi

  local valid_count=0
  IFS=',' read -r -a parsed_ports <<<"${ports_raw}"
  for raw_port in "${parsed_ports[@]}"; do
    local port
    port="$(printf '%s' "${raw_port}" | tr -d '[:space:]')"
    if [[ -z "${port}" ]]; then
      continue
    fi
    if [[ ! "${port}" =~ ^[0-9]+$ ]] || [[ "${port}" -lt 1 ]] || [[ "${port}" -gt 65535 ]]; then
      log_error "Invalid port in ${flag_name}: ${port} (must be integer 1..65535)."
      return 1
    fi
    valid_count=$((valid_count + 1))
  done

  if [[ "${valid_count}" -eq 0 ]]; then
    log_error "No valid ports resolved from ${flag_name} value '${ports_raw}'."
    return 1
  fi

  return 0
}

normalize_ports_csv() {
  local ports_raw="$1"
  local normalized_ports=()
  IFS=',' read -r -a parsed_ports <<<"${ports_raw}"
  for raw_port in "${parsed_ports[@]}"; do
    local port
    port="$(printf '%s' "${raw_port}" | tr -d '[:space:]')"
    if [[ -n "${port}" ]]; then
      normalized_ports+=("${port}")
    fi
  done

  local joined=""
  local normalized_port
  for normalized_port in "${normalized_ports[@]}"; do
    if [[ -z "${joined}" ]]; then
      joined="${normalized_port}"
    else
      joined="${joined},${normalized_port}"
    fi
  done
  echo "${joined}"
}

format_command_for_logs() {
  local formatted=""
  local arg
  for arg in "$@"; do
    formatted+=$(printf '%q ' "${arg}")
  done
  echo "${formatted% }"
}
