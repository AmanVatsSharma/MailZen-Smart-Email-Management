#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 deployment setup script
# -----------------------------------------------------------------------------
# Responsibilities:
# 1) Validate Docker runtime prerequisites
# 2) Create deploy/ec2/.env.ec2 from template if missing
# 3) Prompt for key deployment values (domain + ACME email)
# 4) Derive dependent URLs and secure defaults
# 5) Generate strong secrets when placeholders are detected
#
# Optional flags:
#   --domain <hostname>
#   --acme-email <email>
#   --non-interactive
#   --skip-daemon
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

DOMAIN_ARG=""
ACME_EMAIL_ARG=""
NON_INTERACTIVE=false
SKIP_DAEMON=false
DOMAIN_FLAG_SET=false
DOMAIN_FLAG_VALUE=""
ACME_EMAIL_FLAG_SET=false
ACME_EMAIL_FLAG_VALUE=""

prompt_value() {
  local key="$1"
  local prompt_text="$2"
  local default_value="$3"
  local current_input=""

  if [[ -t 0 ]]; then
    read -r -p "${prompt_text} [${default_value}]: " current_input
  fi
  current_input="${current_input:-${default_value}}"
  echo "${current_input}"
}

assert_non_empty() {
  local key="$1"
  local value="$2"
  if [[ -z "${value}" ]]; then
    log_error "Required value '${key}' cannot be empty."
    exit 1
  fi
}

assert_domain_format() {
  local domain="$1"
  if [[ "${domain}" =~ ^https?:// ]]; then
    log_error "Domain must not include protocol (http/https). Use only hostname."
    exit 1
  fi
  if [[ ! "${domain}" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    log_error "Domain format seems invalid: '${domain}'"
    exit 1
  fi
}

assert_email_format() {
  local email="$1"
  if [[ ! "${email}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
    log_error "ACME email format seems invalid: '${email}'"
    exit 1
  fi
}

ensure_secret_if_placeholder() {
  local key="$1"
  local minimum_length="$2"
  local current_value
  current_value="$(read_env_value "${key}")"

  if [[ "${#current_value}" -ge "${minimum_length}" ]] &&
    [[ "${current_value}" != *"replace_with"* ]] &&
    [[ "${current_value}" != *"please_replace"* ]]; then
    log_info "Keeping existing ${key} value."
    return
  fi

  local generated
  generated="$(generate_random_secret 48)"
  upsert_env_value "${key}" "${generated}"
  log_info "Generated secure value for ${key}."
}

ensure_password_if_placeholder() {
  local key="$1"
  local minimum_length="$2"
  local current_value
  current_value="$(read_env_value "${key}")"

  if [[ "${#current_value}" -ge "${minimum_length}" ]] &&
    [[ "${current_value}" != *"replace_with"* ]] &&
    [[ "${current_value}" != *"change_me"* ]]; then
    log_info "Keeping existing ${key} value."
    return
  fi

  local generated
  generated="$(generate_random_secret 24)"
  upsert_env_value "${key}" "${generated}"
  log_info "Generated strong password for ${key}."
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --non-interactive)
    NON_INTERACTIVE=true
    shift
    ;;
  --skip-daemon)
    SKIP_DAEMON=true
    shift
    ;;
  --domain)
    domain_arg="${2:-}"
    if [[ -z "${domain_arg}" ]]; then
      log_error "--domain requires a value."
      exit 1
    fi
    if [[ "${DOMAIN_FLAG_SET}" == true ]] && [[ "${domain_arg}" != "${DOMAIN_FLAG_VALUE}" ]]; then
      log_warn "Earlier --domain '${DOMAIN_FLAG_VALUE}' overridden by --domain '${domain_arg}'."
    fi
    DOMAIN_ARG="${domain_arg}"
    DOMAIN_FLAG_SET=true
    DOMAIN_FLAG_VALUE="${domain_arg}"
    shift 2
    ;;
  --acme-email)
    acme_email_arg="${2:-}"
    if [[ -z "${acme_email_arg}" ]]; then
      log_error "--acme-email requires a value."
      exit 1
    fi
    if [[ "${ACME_EMAIL_FLAG_SET}" == true ]] && [[ "${acme_email_arg}" != "${ACME_EMAIL_FLAG_VALUE}" ]]; then
      log_warn "Earlier --acme-email '${ACME_EMAIL_FLAG_VALUE}' overridden by --acme-email '${acme_email_arg}'."
    fi
    ACME_EMAIL_ARG="${acme_email_arg}"
    ACME_EMAIL_FLAG_SET=true
    ACME_EMAIL_FLAG_VALUE="${acme_email_arg}"
    shift 2
    ;;
  --domain=*)
    domain_arg="${1#*=}"
    if [[ -z "${domain_arg}" ]]; then
      log_error "--domain requires a non-empty value."
      exit 1
    fi
    if [[ "${DOMAIN_FLAG_SET}" == true ]] && [[ "${domain_arg}" != "${DOMAIN_FLAG_VALUE}" ]]; then
      log_warn "Earlier --domain '${DOMAIN_FLAG_VALUE}' overridden by --domain '${domain_arg}'."
    fi
    DOMAIN_ARG="${domain_arg}"
    DOMAIN_FLAG_SET=true
    DOMAIN_FLAG_VALUE="${domain_arg}"
    shift
    ;;
  --acme-email=*)
    acme_email_arg="${1#*=}"
    if [[ -z "${acme_email_arg}" ]]; then
      log_error "--acme-email requires a non-empty value."
      exit 1
    fi
    if [[ "${ACME_EMAIL_FLAG_SET}" == true ]] && [[ "${acme_email_arg}" != "${ACME_EMAIL_FLAG_VALUE}" ]]; then
      log_warn "Earlier --acme-email '${ACME_EMAIL_FLAG_VALUE}' overridden by --acme-email '${acme_email_arg}'."
    fi
    ACME_EMAIL_ARG="${acme_email_arg}"
    ACME_EMAIL_FLAG_SET=true
    ACME_EMAIL_FLAG_VALUE="${acme_email_arg}"
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --domain <hostname> --acme-email <email> --non-interactive --skip-daemon"
    exit 1
    ;;
  esac
done

log_info "Starting MailZen EC2 setup..."
require_cmd docker

if ! docker compose version >/dev/null 2>&1; then
  log_error "Docker Compose plugin is missing. Install Docker Compose v2 first."
  exit 1
fi

if [[ "${SKIP_DAEMON}" == false ]]; then
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not reachable. Start Docker and retry."
    log_error "Tip: use --skip-daemon to continue setup when only env preparation is needed."
    exit 1
  fi
else
  log_warn "Skipping docker daemon connectivity check (--skip-daemon)."
fi

ensure_env_file_from_template
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

existing_domain="$(read_env_value "MAILZEN_DOMAIN")"
existing_email="$(read_env_value "ACME_EMAIL")"

if [[ "${NON_INTERACTIVE}" == true ]] || [[ ! -t 0 ]]; then
  domain="${DOMAIN_ARG:-${existing_domain:-mail.example.com}}"
  acme_email="${ACME_EMAIL_ARG:-${existing_email:-admin@example.com}}"
  log_info "Using non-interactive setup values."
else
  domain_default="${DOMAIN_ARG:-${existing_domain:-mail.example.com}}"
  acme_default="${ACME_EMAIL_ARG:-${existing_email:-admin@example.com}}"
  domain="$(prompt_value "MAILZEN_DOMAIN" "Enter your public domain (example: mail.example.com)" "${domain_default}")"
  acme_email="$(prompt_value "ACME_EMAIL" "Enter your SSL certificate email" "${acme_default}")"
fi

assert_non_empty "MAILZEN_DOMAIN" "${domain}"
assert_non_empty "ACME_EMAIL" "${acme_email}"
assert_domain_format "${domain}"
assert_email_format "${acme_email}"

frontend_url="https://${domain}"
graphql_url="${frontend_url}/graphql"
google_auth_redirect="${frontend_url}/auth/google/callback"
google_provider_redirect="${frontend_url}/email-integration/google/callback"
outlook_auth_redirect="${frontend_url}/auth/microsoft/callback"
outlook_provider_redirect="${frontend_url}/email-integration/microsoft/callback"

upsert_env_value "MAILZEN_DOMAIN" "${domain}"
upsert_env_value "ACME_EMAIL" "${acme_email}"
upsert_env_value "FRONTEND_URL" "${frontend_url}"
upsert_env_value "NEXT_PUBLIC_GRAPHQL_ENDPOINT" "${graphql_url}"
upsert_env_value "GOOGLE_REDIRECT_URI" "${google_auth_redirect}"
upsert_env_value "GOOGLE_PROVIDER_REDIRECT_URI" "${google_provider_redirect}"
upsert_env_value "OUTLOOK_REDIRECT_URI" "${outlook_auth_redirect}"
upsert_env_value "OUTLOOK_PROVIDER_REDIRECT_URI" "${outlook_provider_redirect}"
upsert_env_value "MAILZEN_SESSION_COOKIE_SECURE" "true"
upsert_env_value "MAILZEN_SESSION_COOKIE_SAMESITE" "lax"
upsert_env_value "NODE_ENV" "production"
upsert_env_value "AI_AGENT_PLATFORM_URL" "http://ai-agent-platform:8100"
upsert_env_value "AI_AGENT_PLATFORM_REQUIRED" "false"
upsert_env_value "AI_AGENT_PLATFORM_CHECK_ON_STARTUP" "true"
upsert_env_value "TYPEORM_SYNCHRONIZE" "false"
upsert_env_value "TYPEORM_RUN_MIGRATIONS" "true"
existing_postgres_db="$(read_env_value "POSTGRES_DB")"
existing_postgres_user="$(read_env_value "POSTGRES_USER")"
upsert_env_value "POSTGRES_DB" "${existing_postgres_db:-mailzen}"
upsert_env_value "POSTGRES_USER" "${existing_postgres_user:-mailzen}"

ensure_secret_if_placeholder "JWT_SECRET" 32
ensure_secret_if_placeholder "OAUTH_STATE_SECRET" 32
ensure_secret_if_placeholder "SECRETS_KEY" 32
ensure_secret_if_placeholder "AI_AGENT_PLATFORM_KEY" 32
ensure_password_if_placeholder "POSTGRES_PASSWORD" 16

postgres_user="$(read_env_value "POSTGRES_USER")"
postgres_password="$(read_env_value "POSTGRES_PASSWORD")"
postgres_db="$(read_env_value "POSTGRES_DB")"
upsert_env_value "DATABASE_URL" "postgresql://${postgres_user}:${postgres_password}@postgres:5432/${postgres_db}"
upsert_env_value "REDIS_HOST" "redis"
upsert_env_value "REDIS_PORT" "6379"

# Keep provider keyring aligned with SECRETS_KEY when template placeholders are used.
provider_keyring="$(read_env_value "PROVIDER_SECRETS_KEYRING")"
if [[ -z "${provider_keyring}" ]] || [[ "${provider_keyring}" == *"replace_with"* ]]; then
  provider_secret="$(read_env_value "SECRETS_KEY")"
  upsert_env_value "PROVIDER_SECRETS_KEYRING" "default:${provider_secret}"
  upsert_env_value "PROVIDER_SECRETS_ACTIVE_KEY_ID" "default"
  log_info "Derived PROVIDER_SECRETS_KEYRING from SECRETS_KEY."
fi

log_info "Setup complete."
log_info "Env file ready: $(get_env_file)"
validate_core_env
print_service_urls
log_info "Next step: ./deploy/ec2/scripts/deploy.sh"
