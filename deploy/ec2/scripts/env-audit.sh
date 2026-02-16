#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 environment audit script
# -----------------------------------------------------------------------------
# Prints a redacted readiness report for critical env keys.
# Does not output raw secret values.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

ensure_required_files_exist
active_env_file="$(get_env_file)"
active_compose_file="$(get_compose_file)"

critical_keys=(
  "MAILZEN_DOMAIN"
  "ACME_EMAIL"
  "FRONTEND_URL"
  "NEXT_PUBLIC_GRAPHQL_ENDPOINT"
  "JWT_SECRET"
  "OAUTH_STATE_SECRET"
  "SECRETS_KEY"
  "POSTGRES_DB"
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
)

secret_keys=(
  "JWT_SECRET"
  "OAUTH_STATE_SECRET"
  "SECRETS_KEY"
  "POSTGRES_PASSWORD"
  "AI_AGENT_PLATFORM_KEY"
  "SMTP_PASS"
  "GOOGLE_CLIENT_SECRET"
  "OUTLOOK_CLIENT_SECRET"
)

is_domain_format_valid() {
  local value="$1"
  [[ -n "${value}" ]] &&
    [[ ! "${value}" =~ ^https?:// ]] &&
    [[ "${value}" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]
}

is_email_format_valid() {
  local value="$1"
  [[ "${value}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]
}

is_https_url_format_valid() {
  local value="$1"
  [[ "${value}" =~ ^https:// ]]
}

extract_url_host_for_audit() {
  local value="$1"
  local no_protocol="${value#https://}"
  no_protocol="${no_protocol#http://}"
  echo "${no_protocol%%/*}"
}

is_secret_key() {
  local key="$1"
  local candidate
  for candidate in "${secret_keys[@]}"; do
    if [[ "${candidate}" == "${key}" ]]; then
      return 0
    fi
  done
  return 1
}

print_key_status() {
  local key="$1"
  local value
  value="$(read_env_value "${key}")"
  local domain
  domain="$(read_env_value "MAILZEN_DOMAIN")"
  local host=""

  if [[ -z "${value}" ]]; then
    printf " - %-32s : MISSING\n" "${key}"
    return
  fi

  if is_placeholder_value "${value}"; then
    printf " - %-32s : PLACEHOLDER\n" "${key}"
    return
  fi

  case "${key}" in
  MAILZEN_DOMAIN)
    if ! is_domain_format_valid "${value}"; then
      printf " - %-32s : INVALID_FORMAT (%s)\n" "${key}" "${value}"
      return
    fi
    ;;
  ACME_EMAIL)
    if ! is_email_format_valid "${value}"; then
      printf " - %-32s : INVALID_FORMAT (%s)\n" "${key}" "${value}"
      return
    fi
    ;;
  FRONTEND_URL|NEXT_PUBLIC_GRAPHQL_ENDPOINT)
    if ! is_https_url_format_valid "${value}"; then
      printf " - %-32s : INVALID_HTTPS_URL (%s)\n" "${key}" "${value}"
      return
    fi
    if is_domain_format_valid "${domain}"; then
      host="$(extract_url_host_for_audit "${value}")"
      if [[ "${host}" != "${domain}" ]]; then
        printf " - %-32s : DOMAIN_MISMATCH (host=%s expected=%s)\n" "${key}" "${host}" "${domain}"
        return
      fi
    fi
    ;;
  esac

  if is_secret_key "${key}"; then
    printf " - %-32s : OK (redacted, len=%s)\n" "${key}" "${#value}"
  else
    printf " - %-32s : OK (%s)\n" "${key}" "${value}"
  fi
}

echo "[mailzen-deploy][ENV-AUDIT] Auditing critical environment keys (${active_env_file})"
echo "[mailzen-deploy][ENV-AUDIT] Using compose file: ${active_compose_file}"
for key in "${critical_keys[@]}"; do
  print_key_status "${key}"
done

if validate_core_env >/dev/null 2>&1; then
  echo "[mailzen-deploy][ENV-AUDIT] Result: PASS"
else
  echo "[mailzen-deploy][ENV-AUDIT] Result: FAIL"
  exit 1
fi
