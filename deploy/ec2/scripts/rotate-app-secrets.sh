#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 app secret rotation helper
# -----------------------------------------------------------------------------
# Rotates selected app-layer secrets in deploy/ec2/.env.ec2:
# - JWT_SECRET
# - OAUTH_STATE_SECRET
# - AI_AGENT_PLATFORM_KEY
#
# Notes:
# - Existing user sessions/tokens will become invalid after rotation.
# - Re-deploy is required for new values to take effect.
#
# Usage:
#   ./deploy/ec2/scripts/rotate-app-secrets.sh
#   ./deploy/ec2/scripts/rotate-app-secrets.sh --yes
#   ./deploy/ec2/scripts/rotate-app-secrets.sh --keys JWT_SECRET,OAUTH_STATE_SECRET --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

AUTO_CONFIRM=false
DRY_RUN=false
KEYS_RAW=""
KEYS_FLAG_SET=false
KEYS_FLAG_VALUE=""
SUPPORTED_KEYS=(
  JWT_SECRET
  OAUTH_STATE_SECRET
  AI_AGENT_PLATFORM_KEY
)
TARGET_KEYS=("${SUPPORTED_KEYS[@]}")

while [[ $# -gt 0 ]]; do
  case "$1" in
  --yes)
    AUTO_CONFIRM=true
    shift
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  --keys)
    keys_arg="${2:-}"
    if [[ -z "${keys_arg}" ]]; then
      log_error "--keys requires a comma-separated value."
      exit 1
    fi
    if [[ "${KEYS_FLAG_SET}" == true ]] && [[ "${keys_arg}" != "${KEYS_FLAG_VALUE}" ]]; then
      log_warn "Earlier --keys '${KEYS_FLAG_VALUE}' overridden by --keys '${keys_arg}'."
    fi
    KEYS_RAW="${keys_arg}"
    KEYS_FLAG_SET=true
    KEYS_FLAG_VALUE="${keys_arg}"
    shift 2
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --yes --dry-run --keys <k1,k2>"
    exit 1
    ;;
  esac
done

if [[ "${DRY_RUN}" == true ]] && [[ "${AUTO_CONFIRM}" == true ]]; then
  log_warn "--yes has no effect in --dry-run mode."
fi

if [[ -n "${KEYS_RAW}" ]]; then
  TARGET_KEYS=()
  IFS=',' read -r -a parsed_keys <<<"${KEYS_RAW}"
  for raw_key in "${parsed_keys[@]}"; do
    key="$(printf '%s' "${raw_key}" | tr -d '[:space:]')"
    if [[ -z "${key}" ]]; then
      continue
    fi
    if [[ " ${SUPPORTED_KEYS[*]} " != *" ${key} "* ]]; then
      log_error "Unsupported key in --keys: ${key}"
      log_error "Allowed keys: ${SUPPORTED_KEYS[*]}"
      exit 1
    fi
    TARGET_KEYS+=("${key}")
  done
  if [[ "${#TARGET_KEYS[@]}" -eq 0 ]]; then
    log_error "No valid keys provided in --keys."
    exit 1
  fi
fi

deduped_keys=()
declare -A seen_keys=()
for key in "${TARGET_KEYS[@]}"; do
  if [[ -n "${seen_keys[${key}]:-}" ]]; then
    continue
  fi
  seen_keys["${key}"]=1
  deduped_keys+=("${key}")
done
TARGET_KEYS=("${deduped_keys[@]}")

ensure_required_files_exist
validate_core_env
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

if [[ "${DRY_RUN}" == false ]] && [[ "${AUTO_CONFIRM}" == false ]]; then
  if [[ ! -t 0 ]]; then
    log_error "Interactive terminal required unless --yes flag is used."
    exit 1
  fi
  log_warn "This will rotate JWT/OAuth/app platform secrets."
  log_warn "All active sessions/tokens may become invalid after re-deploy."
  read -r -p "Type 'ROTATE' to continue: " confirmation
  if [[ "${confirmation}" != "ROTATE" ]]; then
    log_error "Secret rotation cancelled."
    exit 1
  fi
fi

log_info "Secret rotation target keys: ${TARGET_KEYS[*]}"

if [[ "${DRY_RUN}" == true ]]; then
  for key in "${TARGET_KEYS[@]}"; do
    generated_preview="$(generate_random_secret 8)"
    log_info "Dry-run: would rotate ${key} (preview-prefix=${generated_preview:0:12}..., len=96)"
  done
  log_warn "Dry-run only. No secrets were changed."
  exit 0
fi

for key in "${TARGET_KEYS[@]}"; do
  new_value="$(generate_random_secret 48)"
  upsert_env_value "${key}" "${new_value}"
done

log_info "App secrets rotated successfully."
log_info "Rotated keys: ${TARGET_KEYS[*]}"
log_warn "Next step: run ./deploy/ec2/scripts/update.sh"
