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
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

AUTO_CONFIRM=false
for arg in "$@"; do
  case "${arg}" in
  --yes)
    AUTO_CONFIRM=true
    ;;
  *)
    log_error "Unknown argument: ${arg}"
    log_error "Supported flag: --yes"
    exit 1
    ;;
  esac
done

ensure_required_files_exist
validate_core_env

if [[ "${AUTO_CONFIRM}" == false ]]; then
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

new_jwt_secret="$(generate_random_secret 48)"
new_oauth_state_secret="$(generate_random_secret 48)"
new_agent_platform_key="$(generate_random_secret 48)"

upsert_env_value "JWT_SECRET" "${new_jwt_secret}"
upsert_env_value "OAUTH_STATE_SECRET" "${new_oauth_state_secret}"
upsert_env_value "AI_AGENT_PLATFORM_KEY" "${new_agent_platform_key}"

log_info "App secrets rotated successfully."
log_info "Rotated keys: JWT_SECRET, OAUTH_STATE_SECRET, AI_AGENT_PLATFORM_KEY"
log_warn "Next step: run ./deploy/ec2/scripts/update.sh"
