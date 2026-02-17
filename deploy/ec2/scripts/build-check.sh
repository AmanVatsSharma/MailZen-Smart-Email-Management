#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 image build validation script
# -----------------------------------------------------------------------------
# Validates compose config and image buildability for buildable app services.
#
# Usage:
#   ./deploy/ec2/scripts/build-check.sh
#   ./deploy/ec2/scripts/build-check.sh --service backend --service frontend
#   ./deploy/ec2/scripts/build-check.sh --pull --no-cache
#   ./deploy/ec2/scripts/build-check.sh --with-image-pull-check --image-service caddy --image-service postgres
#   ./deploy/ec2/scripts/build-check.sh --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

BUILDABLE_SERVICES=("backend" "frontend" "ai-agent-platform")
IMAGE_PULL_SERVICES=("caddy" "postgres" "redis")
SELECTED_SERVICES=()
USE_DEFAULT_SERVICES=true
RUN_IMAGE_PULL_CHECK=false
SELECTED_IMAGE_SERVICES=()
IMAGE_SERVICE_FLAGS_SET=false
PULL_IMAGES=false
NO_CACHE=false
DRY_RUN=false
SKIP_CONFIG_CHECK=false
ALL_SERVICES_FLAG_SET=false
SERVICE_FLAG_SET=false

is_buildable_service() {
  local candidate="$1"
  local service=""
  for service in "${BUILDABLE_SERVICES[@]}"; do
    if [[ "${service}" == "${candidate}" ]]; then
      return 0
    fi
  done
  return 1
}

is_image_pull_service() {
  local candidate="$1"
  local service=""
  for service in "${IMAGE_PULL_SERVICES[@]}"; do
    if [[ "${service}" == "${candidate}" ]]; then
      return 0
    fi
  done
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --service)
    service_arg="${2:-}"
    if [[ -z "${service_arg}" ]]; then
      log_error "--service requires a value."
      exit 1
    fi
    if ! is_buildable_service "${service_arg}"; then
      log_error "Unsupported build service '${service_arg}'."
      log_error "Supported build services: ${BUILDABLE_SERVICES[*]}"
      exit 1
    fi
    if [[ "${ALL_SERVICES_FLAG_SET}" == true ]]; then
      log_warn "--all-services selection overridden by --service '${service_arg}'."
      ALL_SERVICES_FLAG_SET=false
    fi
    USE_DEFAULT_SERVICES=false
    SERVICE_FLAG_SET=true
    if [[ " ${SELECTED_SERVICES[*]} " == *" ${service_arg} "* ]]; then
      log_warn "Duplicate --service '${service_arg}' ignored."
    else
      SELECTED_SERVICES+=("${service_arg}")
    fi
    shift 2
    ;;
  --all-services)
    if [[ "${SERVICE_FLAG_SET}" == true ]]; then
      log_warn "Explicit --service selections overridden by --all-services."
    fi
    USE_DEFAULT_SERVICES=true
    SELECTED_SERVICES=()
    ALL_SERVICES_FLAG_SET=true
    SERVICE_FLAG_SET=false
    shift
    ;;
  --with-image-pull-check)
    RUN_IMAGE_PULL_CHECK=true
    shift
    ;;
  --image-service)
    image_service_arg="${2:-}"
    if [[ -z "${image_service_arg}" ]]; then
      log_error "--image-service requires a value."
      exit 1
    fi
    if ! is_image_pull_service "${image_service_arg}"; then
      log_error "Unsupported image pull service '${image_service_arg}'."
      log_error "Supported image pull services: ${IMAGE_PULL_SERVICES[*]}"
      exit 1
    fi
    IMAGE_SERVICE_FLAGS_SET=true
    if [[ " ${SELECTED_IMAGE_SERVICES[*]} " == *" ${image_service_arg} "* ]]; then
      log_warn "Duplicate --image-service '${image_service_arg}' ignored."
    else
      SELECTED_IMAGE_SERVICES+=("${image_service_arg}")
    fi
    shift 2
    ;;
  --pull)
    PULL_IMAGES=true
    shift
    ;;
  --no-cache)
    NO_CACHE=true
    shift
    ;;
  --skip-config-check)
    SKIP_CONFIG_CHECK=true
    shift
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --service <name> --all-services --with-image-pull-check --image-service <name> --pull --no-cache --skip-config-check --dry-run"
    exit 1
    ;;
  esac
done

if [[ "${RUN_IMAGE_PULL_CHECK}" == false ]] && [[ "${IMAGE_SERVICE_FLAGS_SET}" == true ]]; then
  log_warn "Image pull services were provided without --with-image-pull-check; image-service flags will be ignored."
fi

target_services=()
if [[ "${USE_DEFAULT_SERVICES}" == true ]]; then
  target_services=("${BUILDABLE_SERVICES[@]}")
else
  if [[ "${#SELECTED_SERVICES[@]}" -eq 0 ]]; then
    log_error "No build services selected."
    exit 1
  fi
  target_services=("${SELECTED_SERVICES[@]}")
fi

target_image_services=()
if [[ "${RUN_IMAGE_PULL_CHECK}" == true ]]; then
  if [[ "${#SELECTED_IMAGE_SERVICES[@]}" -eq 0 ]]; then
    target_image_services=("${IMAGE_PULL_SERVICES[@]}")
  else
    target_image_services=("${SELECTED_IMAGE_SERVICES[@]}")
  fi
fi

require_cmd docker
ensure_required_files_exist
validate_core_env
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"
log_info "Target build services: ${target_services[*]}"
if [[ "${RUN_IMAGE_PULL_CHECK}" == true ]]; then
  log_info "Target image pull-check services: ${target_image_services[*]}"
fi

if [[ "${SKIP_CONFIG_CHECK}" == false ]]; then
  log_info "Validating compose configuration before build..."
  compose config >/dev/null
else
  log_warn "Skipping compose config validation (--skip-config-check)."
fi

build_args=()
if [[ "${PULL_IMAGES}" == true ]]; then
  build_args+=(--pull)
fi
if [[ "${NO_CACHE}" == true ]]; then
  build_args+=(--no-cache)
fi

if [[ "${DRY_RUN}" == true ]]; then
  build_command=(docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" build)
  if [[ "${#build_args[@]}" -gt 0 ]]; then
    build_command+=("${build_args[@]}")
  fi
  build_command+=("${target_services[@]}")

  log_info "Dry-run enabled; build command not executed."
  printf '[mailzen-deploy][INFO] Would run: '
  printf '%q ' "${build_command[@]}"
  printf '\n'
  if [[ "${RUN_IMAGE_PULL_CHECK}" == true ]]; then
    image_pull_command=(docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" pull)
    image_pull_command+=("${target_image_services[@]}")
    printf '[mailzen-deploy][INFO] Would run: '
    printf '%q ' "${image_pull_command[@]}"
    printf '\n'
  fi
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not reachable. Start Docker and retry."
  exit 1
fi

log_info "Running image build validation..."
if [[ "${RUN_IMAGE_PULL_CHECK}" == true ]]; then
  log_info "Running image pull validation for image-only services..."
  compose pull "${target_image_services[@]}"
fi
compose build "${build_args[@]}" "${target_services[@]}"
log_info "Image build validation passed."
