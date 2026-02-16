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
