#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 deployment script
# -----------------------------------------------------------------------------
# Default behavior:
# - validates compose/env files
# - builds latest images
# - starts stack in detached mode
# - prints status and service URLs
#
# Flags:
#   --no-build        Skip image build
#   --pull            Always pull newer base images
#   --force-recreate  Recreate containers even if config unchanged
#   --dry-run         Print deployment command only
#   --config-only     Validate compose config only (no deploy)
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

NO_BUILD=false
PULL=false
FORCE_RECREATE=false
DRY_RUN=false
CONFIG_ONLY=false

for arg in "$@"; do
  case "${arg}" in
  --no-build)
    NO_BUILD=true
    ;;
  --pull)
    PULL=true
    ;;
  --force-recreate)
    FORCE_RECREATE=true
    ;;
  --dry-run)
    DRY_RUN=true
    ;;
  --config-only)
    CONFIG_ONLY=true
    ;;
  *)
    log_error "Unknown argument: ${arg}"
    log_error "Supported flags: --no-build --pull --force-recreate --dry-run --config-only"
    exit 1
    ;;
  esac
done

log_info "Starting MailZen EC2 deployment..."
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"
require_cmd docker
ensure_required_files_exist
validate_core_env

if [[ "${CONFIG_ONLY}" == false ]] && [[ "${DRY_RUN}" == false ]]; then
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not reachable. Start Docker and retry."
    log_error "Tip: run ./deploy/ec2/scripts/deploy.sh --config-only to validate configuration without daemon."
    exit 1
  fi
else
  if [[ "${CONFIG_ONLY}" == true ]] && [[ "${DRY_RUN}" == true ]]; then
    log_warn "Skipping docker daemon connectivity check (--config-only and --dry-run)."
  elif [[ "${CONFIG_ONLY}" == true ]]; then
    log_warn "Skipping docker daemon connectivity check (--config-only)."
  else
    log_warn "Skipping docker daemon connectivity check (--dry-run)."
  fi
fi

if ! compose config >/dev/null; then
  log_error "Compose config validation failed. Fix env/config and retry."
  exit 1
fi

if [[ "${CONFIG_ONLY}" == true ]]; then
  log_info "Compose config validation passed (--config-only)."
  exit 0
fi

up_args=(-d)
if [[ "${NO_BUILD}" == false ]]; then
  up_args+=(--build)
fi
if [[ "${PULL}" == true ]]; then
  up_args+=(--pull always)
fi
if [[ "${FORCE_RECREATE}" == true ]]; then
  up_args+=(--force-recreate)
fi

log_info "Running: docker compose up ${up_args[*]}"
if [[ "${DRY_RUN}" == true ]]; then
  log_info "Dry-run enabled; command not executed."
  exit 0
fi

compose up "${up_args[@]}"

log_info "Deployment command completed. Current stack status:"
compose ps

print_service_urls
log_info "Helpful commands:"
log_info "  ./deploy/ec2/scripts/status.sh"
log_info "  ./deploy/ec2/scripts/logs.sh backend"
