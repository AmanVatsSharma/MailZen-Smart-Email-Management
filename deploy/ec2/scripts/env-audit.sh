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

  if [[ -z "${value}" ]]; then
    printf " - %-32s : MISSING\n" "${key}"
    return
  fi

  if is_placeholder_value "${value}"; then
    printf " - %-32s : PLACEHOLDER\n" "${key}"
    return
  fi

  if is_secret_key "${key}"; then
    printf " - %-32s : OK (redacted, len=%s)\n" "${key}" "${#value}"
  else
    printf " - %-32s : OK (%s)\n" "${key}" "${value}"
  fi
}

echo "[mailzen-deploy][ENV-AUDIT] Auditing critical environment keys (${ENV_FILE})"
for key in "${critical_keys[@]}"; do
  print_key_status "${key}"
done

if validate_core_env >/dev/null 2>&1; then
  echo "[mailzen-deploy][ENV-AUDIT] Result: PASS"
else
  echo "[mailzen-deploy][ENV-AUDIT] Result: FAIL"
  exit 1
fi
