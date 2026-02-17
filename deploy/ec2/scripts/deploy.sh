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
NO_BUILD_FLAG_SET=false
PULL_FLAG_SET=false
FORCE_RECREATE_FLAG_SET=false
DRY_RUN_FLAG_SET=false
CONFIG_ONLY_FLAG_SET=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --no-build)
    if [[ "${NO_BUILD_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --no-build flag detected; keeping --no-build enabled."
    fi
    NO_BUILD=true
    NO_BUILD_FLAG_SET=true
    shift
    ;;
  --pull)
    if [[ "${PULL_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --pull flag detected; keeping --pull enabled."
    fi
    PULL=true
    PULL_FLAG_SET=true
    shift
    ;;
  --force-recreate)
    if [[ "${FORCE_RECREATE_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --force-recreate flag detected; keeping --force-recreate enabled."
    fi
    FORCE_RECREATE=true
    FORCE_RECREATE_FLAG_SET=true
    shift
    ;;
  --dry-run)
    if [[ "${DRY_RUN_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --dry-run flag detected; keeping --dry-run enabled."
    fi
    DRY_RUN=true
    DRY_RUN_FLAG_SET=true
    shift
    ;;
  --config-only)
    if [[ "${CONFIG_ONLY_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --config-only flag detected; keeping --config-only enabled."
    fi
    CONFIG_ONLY=true
    CONFIG_ONLY_FLAG_SET=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --no-build --pull --force-recreate --dry-run --config-only"
    exit 1
    ;;
  esac
done

log_info "Starting MailZen EC2 deployment..."
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

if [[ "${CONFIG_ONLY}" == true ]] &&
  { [[ "${NO_BUILD}" == true ]] || [[ "${PULL}" == true ]] || [[ "${FORCE_RECREATE}" == true ]]; }; then
  log_warn "Deploy runtime flags (--no-build/--pull/--force-recreate) are ignored when --config-only is enabled."
fi
if [[ "${CONFIG_ONLY}" == true ]] && [[ "${DRY_RUN}" == true ]]; then
  log_warn "--dry-run has no additional effect when --config-only is enabled."
fi

require_cmd docker
ensure_required_files_exist
validate_core_env

if [[ "${CONFIG_ONLY}" == false ]] && [[ "${DRY_RUN}" == false ]]; then
  if ! docker info >/dev/null 2>&1; then
    log_docker_daemon_unreachable
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
log_info "Command preview: $(format_command_for_logs docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" up "${up_args[@]}")"
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
