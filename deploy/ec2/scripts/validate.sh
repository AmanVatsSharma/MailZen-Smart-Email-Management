#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 validation profile runner
# -----------------------------------------------------------------------------
# High-level wrapper around pipeline-check.sh for non-technical validation runs.
#
# Profiles:
# - default: full readiness chain (build + verify + runtime-smoke + status)
# - dry-run: safe rehearsal chain (build dry-run + runtime-smoke dry-run +
#   status runtime checks with dns/ssl/ports skipped by default)
#
# Usage:
#   ./deploy/ec2/scripts/validate.sh
#   ./deploy/ec2/scripts/validate.sh --dry-run
#   ./deploy/ec2/scripts/validate.sh --dry-run --seed-env
#   ./deploy/ec2/scripts/validate.sh --dry-run --with-verify-in-dry-run
#   ./deploy/ec2/scripts/validate.sh --build-check-service backend --build-check-service frontend --build-check-pull
#   ./deploy/ec2/scripts/validate.sh --build-check-with-image-pull-check --build-check-image-service caddy --build-check-image-service postgres --dry-run
#   ./deploy/ec2/scripts/validate.sh --skip-runtime-smoke --skip-status
#   ./deploy/ec2/scripts/validate.sh --ports-check-ports 80,443,8100
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SEED_ENV=false
DRY_RUN=false
WITH_VERIFY_IN_DRY_RUN=false
RUN_BUILD_CHECK=true
RUN_VERIFY=true
RUN_RUNTIME_SMOKE=true
RUN_STATUS=true
PORTS_CHECK_PORTS=""
BUILD_CHECK_PULL=false
BUILD_CHECK_NO_CACHE=false
BUILD_CHECK_SKIP_CONFIG_CHECK=false
BUILD_CHECK_WITH_IMAGE_PULL_CHECK=false
BUILD_CHECK_SERVICE_ARGS=()
BUILD_CHECK_IMAGE_SERVICE_ARGS=()
DOCS_STRICT_COVERAGE=false
DOCS_INCLUDE_COMMON=false
VERIFY_MAX_RETRIES=""
VERIFY_RETRY_SLEEP=""
VERIFY_SKIP_SSL_CHECK=false
VERIFY_SKIP_OAUTH_CHECK=false
VERIFY_REQUIRE_OAUTH_CHECK=false
RUNTIME_SMOKE_MAX_RETRIES=""
RUNTIME_SMOKE_RETRY_SLEEP=""
RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK=false
RUNTIME_SMOKE_SKIP_COMPOSE_PS=false
STATUS_STRICT=false
STATUS_RUNTIME_CHECKS=true
STATUS_SKIP_HOST_READINESS=false
STATUS_SKIP_DNS_CHECK=false
STATUS_SKIP_SSL_CHECK=false
STATUS_SKIP_PORTS_CHECK=false
PORTS_CHECK_FLAG_SET=false
PORTS_CHECK_FLAG_VALUE=""
VERIFY_MAX_RETRIES_FLAG_SET=false
VERIFY_MAX_RETRIES_FLAG_VALUE=""
VERIFY_RETRY_SLEEP_FLAG_SET=false
VERIFY_RETRY_SLEEP_FLAG_VALUE=""
RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET=false
RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE=""
RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET=false
RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE=""
STATUS_SKIP_DNS_EXPLICIT=false
STATUS_SKIP_SSL_EXPLICIT=false
STATUS_SKIP_PORTS_EXPLICIT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --seed-env)
    SEED_ENV=true
    shift
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  --with-verify-in-dry-run)
    WITH_VERIFY_IN_DRY_RUN=true
    shift
    ;;
  --skip-build-check)
    RUN_BUILD_CHECK=false
    shift
    ;;
  --build-check-pull)
    BUILD_CHECK_PULL=true
    shift
    ;;
  --build-check-no-cache)
    BUILD_CHECK_NO_CACHE=true
    shift
    ;;
  --build-check-skip-config-check)
    BUILD_CHECK_SKIP_CONFIG_CHECK=true
    shift
    ;;
  --build-check-with-image-pull-check)
    BUILD_CHECK_WITH_IMAGE_PULL_CHECK=true
    shift
    ;;
  --build-check-service)
    build_check_service_arg="${2:-}"
    if [[ -z "${build_check_service_arg}" ]]; then
      log_error "--build-check-service requires a value."
      exit 1
    fi
    BUILD_CHECK_SERVICE_ARGS+=(--build-check-service "${build_check_service_arg}")
    shift 2
    ;;
  --build-check-image-service)
    build_check_image_service_arg="${2:-}"
    if [[ -z "${build_check_image_service_arg}" ]]; then
      log_error "--build-check-image-service requires a value."
      exit 1
    fi
    BUILD_CHECK_IMAGE_SERVICE_ARGS+=(--build-check-image-service "${build_check_image_service_arg}")
    shift 2
    ;;
  --docs-strict-coverage)
    DOCS_STRICT_COVERAGE=true
    shift
    ;;
  --docs-include-common)
    DOCS_INCLUDE_COMMON=true
    shift
    ;;
  --skip-verify)
    RUN_VERIFY=false
    shift
    ;;
  --skip-runtime-smoke)
    RUN_RUNTIME_SMOKE=false
    shift
    ;;
  --skip-status)
    RUN_STATUS=false
    shift
    ;;
  --ports-check-ports)
    ports_check_ports_arg="${2:-}"
    if [[ -z "${ports_check_ports_arg}" ]]; then
      log_error "--ports-check-ports requires a value."
      exit 1
    fi
    if [[ "${PORTS_CHECK_FLAG_SET}" == true ]] && [[ "${ports_check_ports_arg}" != "${PORTS_CHECK_FLAG_VALUE}" ]]; then
      log_warn "Earlier --ports-check-ports '${PORTS_CHECK_FLAG_VALUE}' overridden by --ports-check-ports '${ports_check_ports_arg}'."
    fi
    PORTS_CHECK_PORTS="${ports_check_ports_arg}"
    PORTS_CHECK_FLAG_SET=true
    PORTS_CHECK_FLAG_VALUE="${ports_check_ports_arg}"
    shift 2
    ;;
  --verify-max-retries)
    verify_max_retries_arg="${2:-}"
    if [[ -z "${verify_max_retries_arg}" ]]; then
      log_error "--verify-max-retries requires a value."
      exit 1
    fi
    if [[ "${VERIFY_MAX_RETRIES_FLAG_SET}" == true ]] && [[ "${verify_max_retries_arg}" != "${VERIFY_MAX_RETRIES_FLAG_VALUE}" ]]; then
      log_warn "Earlier --verify-max-retries '${VERIFY_MAX_RETRIES_FLAG_VALUE}' overridden by --verify-max-retries '${verify_max_retries_arg}'."
    fi
    VERIFY_MAX_RETRIES="${verify_max_retries_arg}"
    VERIFY_MAX_RETRIES_FLAG_SET=true
    VERIFY_MAX_RETRIES_FLAG_VALUE="${verify_max_retries_arg}"
    shift 2
    ;;
  --verify-retry-sleep)
    verify_retry_sleep_arg="${2:-}"
    if [[ -z "${verify_retry_sleep_arg}" ]]; then
      log_error "--verify-retry-sleep requires a value."
      exit 1
    fi
    if [[ "${VERIFY_RETRY_SLEEP_FLAG_SET}" == true ]] && [[ "${verify_retry_sleep_arg}" != "${VERIFY_RETRY_SLEEP_FLAG_VALUE}" ]]; then
      log_warn "Earlier --verify-retry-sleep '${VERIFY_RETRY_SLEEP_FLAG_VALUE}' overridden by --verify-retry-sleep '${verify_retry_sleep_arg}'."
    fi
    VERIFY_RETRY_SLEEP="${verify_retry_sleep_arg}"
    VERIFY_RETRY_SLEEP_FLAG_SET=true
    VERIFY_RETRY_SLEEP_FLAG_VALUE="${verify_retry_sleep_arg}"
    shift 2
    ;;
  --verify-skip-ssl-check)
    VERIFY_SKIP_SSL_CHECK=true
    shift
    ;;
  --verify-skip-oauth-check)
    VERIFY_SKIP_OAUTH_CHECK=true
    shift
    ;;
  --verify-require-oauth-check)
    VERIFY_REQUIRE_OAUTH_CHECK=true
    shift
    ;;
  --runtime-smoke-max-retries)
    runtime_smoke_max_retries_arg="${2:-}"
    if [[ -z "${runtime_smoke_max_retries_arg}" ]]; then
      log_error "--runtime-smoke-max-retries requires a value."
      exit 1
    fi
    if [[ "${RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET}" == true ]] && [[ "${runtime_smoke_max_retries_arg}" != "${RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE}" ]]; then
      log_warn "Earlier --runtime-smoke-max-retries '${RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE}' overridden by --runtime-smoke-max-retries '${runtime_smoke_max_retries_arg}'."
    fi
    RUNTIME_SMOKE_MAX_RETRIES="${runtime_smoke_max_retries_arg}"
    RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET=true
    RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE="${runtime_smoke_max_retries_arg}"
    shift 2
    ;;
  --runtime-smoke-retry-sleep)
    runtime_smoke_retry_sleep_arg="${2:-}"
    if [[ -z "${runtime_smoke_retry_sleep_arg}" ]]; then
      log_error "--runtime-smoke-retry-sleep requires a value."
      exit 1
    fi
    if [[ "${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET}" == true ]] && [[ "${runtime_smoke_retry_sleep_arg}" != "${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE}" ]]; then
      log_warn "Earlier --runtime-smoke-retry-sleep '${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE}' overridden by --runtime-smoke-retry-sleep '${runtime_smoke_retry_sleep_arg}'."
    fi
    RUNTIME_SMOKE_RETRY_SLEEP="${runtime_smoke_retry_sleep_arg}"
    RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET=true
    RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE="${runtime_smoke_retry_sleep_arg}"
    shift 2
    ;;
  --runtime-smoke-skip-backend-dependency-check)
    RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK=true
    shift
    ;;
  --runtime-smoke-skip-compose-ps)
    RUNTIME_SMOKE_SKIP_COMPOSE_PS=true
    shift
    ;;
  --status-strict)
    STATUS_STRICT=true
    shift
    ;;
  --status-no-runtime-checks)
    STATUS_RUNTIME_CHECKS=false
    shift
    ;;
  --status-skip-host-readiness)
    STATUS_SKIP_HOST_READINESS=true
    shift
    ;;
  --status-skip-dns-check)
    STATUS_SKIP_DNS_CHECK=true
    STATUS_SKIP_DNS_EXPLICIT=true
    shift
    ;;
  --status-skip-ssl-check)
    STATUS_SKIP_SSL_CHECK=true
    STATUS_SKIP_SSL_EXPLICIT=true
    shift
    ;;
  --status-skip-ports-check)
    STATUS_SKIP_PORTS_CHECK=true
    STATUS_SKIP_PORTS_EXPLICIT=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --seed-env --dry-run --with-verify-in-dry-run --skip-build-check --skip-verify --skip-runtime-smoke --skip-status --ports-check-ports <p1,p2,...> --build-check-pull --build-check-no-cache --build-check-skip-config-check --build-check-with-image-pull-check --build-check-service <name> --build-check-image-service <name> --docs-strict-coverage --docs-include-common --verify-max-retries <n> --verify-retry-sleep <n> --verify-skip-ssl-check --verify-skip-oauth-check --verify-require-oauth-check --runtime-smoke-max-retries <n> --runtime-smoke-retry-sleep <n> --runtime-smoke-skip-backend-dependency-check --runtime-smoke-skip-compose-ps --status-strict --status-no-runtime-checks --status-skip-host-readiness --status-skip-dns-check --status-skip-ssl-check --status-skip-ports-check"
    exit 1
    ;;
  esac
done

if [[ "${DOCS_INCLUDE_COMMON}" == true ]] && [[ "${DOCS_STRICT_COVERAGE}" == false ]]; then
  log_warn "--docs-include-common is most useful with --docs-strict-coverage."
fi

if [[ -n "${VERIFY_MAX_RETRIES}" ]] && { [[ ! "${VERIFY_MAX_RETRIES}" =~ ^[0-9]+$ ]] || [[ "${VERIFY_MAX_RETRIES}" -lt 1 ]]; }; then
  log_error "--verify-max-retries must be a positive integer."
  exit 1
fi
if [[ -n "${VERIFY_RETRY_SLEEP}" ]] && { [[ ! "${VERIFY_RETRY_SLEEP}" =~ ^[0-9]+$ ]] || [[ "${VERIFY_RETRY_SLEEP}" -lt 1 ]]; }; then
  log_error "--verify-retry-sleep must be a positive integer."
  exit 1
fi
if [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]] && [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; then
  log_error "--verify-skip-oauth-check cannot be combined with --verify-require-oauth-check."
  exit 1
fi
if [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]] && { [[ ! "${RUNTIME_SMOKE_MAX_RETRIES}" =~ ^[0-9]+$ ]] || [[ "${RUNTIME_SMOKE_MAX_RETRIES}" -lt 1 ]]; }; then
  log_error "--runtime-smoke-max-retries must be a positive integer."
  exit 1
fi
if [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]] && { [[ ! "${RUNTIME_SMOKE_RETRY_SLEEP}" =~ ^[0-9]+$ ]] || [[ "${RUNTIME_SMOKE_RETRY_SLEEP}" -lt 1 ]]; }; then
  log_error "--runtime-smoke-retry-sleep must be a positive integer."
  exit 1
fi

if [[ "${DRY_RUN}" == true ]]; then
  if [[ "${RUN_VERIFY}" == true ]] && [[ "${WITH_VERIFY_IN_DRY_RUN}" == false ]]; then
    RUN_VERIFY=false
    log_warn "Dry-run mode defaults to skipping verify checks. Use --with-verify-in-dry-run to force verify."
  fi
  if [[ "${STATUS_RUNTIME_CHECKS}" == true ]]; then
    if [[ "${STATUS_SKIP_DNS_EXPLICIT}" == false ]]; then
      STATUS_SKIP_DNS_CHECK=true
      log_info "Dry-run mode: enabling --status-skip-dns-check."
    fi
    if [[ "${STATUS_SKIP_SSL_EXPLICIT}" == false ]]; then
      STATUS_SKIP_SSL_CHECK=true
      log_info "Dry-run mode: enabling --status-skip-ssl-check."
    fi
    if [[ "${STATUS_SKIP_PORTS_EXPLICIT}" == false ]]; then
      STATUS_SKIP_PORTS_CHECK=true
      log_info "Dry-run mode: enabling --status-skip-ports-check."
    fi
  fi
fi

if [[ "${RUN_VERIFY}" == false ]] &&
  { [[ -n "${VERIFY_MAX_RETRIES}" ]] || [[ -n "${VERIFY_RETRY_SLEEP}" ]] || [[ "${VERIFY_SKIP_SSL_CHECK}" == true ]] || [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]] || [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; }; then
  log_warn "Verify-specific flags were provided while verify stage is disabled; verify flags will be ignored."
fi

if [[ "${RUN_BUILD_CHECK}" == false ]] &&
  { [[ "${BUILD_CHECK_PULL}" == true ]] || [[ "${BUILD_CHECK_NO_CACHE}" == true ]] || [[ "${BUILD_CHECK_SKIP_CONFIG_CHECK}" == true ]] || [[ "${BUILD_CHECK_WITH_IMAGE_PULL_CHECK}" == true ]] || [[ "${#BUILD_CHECK_SERVICE_ARGS[@]}" -gt 0 ]] || [[ "${#BUILD_CHECK_IMAGE_SERVICE_ARGS[@]}" -gt 0 ]]; }; then
  log_warn "Build-check-specific flags were provided while build-check stage is disabled; build-check flags will be ignored."
fi

if [[ "${RUN_RUNTIME_SMOKE}" == false ]] &&
  { [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]] || [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]] || [[ "${RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK}" == true ]] || [[ "${RUNTIME_SMOKE_SKIP_COMPOSE_PS}" == true ]]; }; then
  log_warn "Runtime-smoke-specific flags were provided while runtime-smoke stage is disabled; runtime-smoke flags will be ignored."
fi

if [[ "${RUN_STATUS}" == false ]] &&
  { [[ "${STATUS_STRICT}" == true ]] || [[ "${STATUS_RUNTIME_CHECKS}" == true ]] || [[ "${STATUS_SKIP_HOST_READINESS}" == true ]] || [[ "${STATUS_SKIP_DNS_CHECK}" == true ]] || [[ "${STATUS_SKIP_SSL_CHECK}" == true ]] || [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; }; then
  log_warn "Status-specific flags were provided while status stage is disabled; status flags will be ignored."
fi

log_info "Starting validation profile..."
log_info "Mode: $([[ "${DRY_RUN}" == true ]] && echo "dry-run rehearsal" || echo "full readiness")"
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

pipeline_args=()
if [[ "${SEED_ENV}" == true ]]; then
  pipeline_args+=(--seed-env)
fi
if [[ "${DOCS_STRICT_COVERAGE}" == true ]]; then
  pipeline_args+=(--docs-strict-coverage)
fi
if [[ "${DOCS_INCLUDE_COMMON}" == true ]]; then
  pipeline_args+=(--docs-include-common)
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  pipeline_args+=(--ports-check-ports "${PORTS_CHECK_PORTS}")
fi

if [[ "${RUN_BUILD_CHECK}" == true ]]; then
  pipeline_args+=(--with-build-check)
  if [[ "${BUILD_CHECK_PULL}" == true ]]; then
    pipeline_args+=(--build-check-pull)
  fi
  if [[ "${BUILD_CHECK_NO_CACHE}" == true ]]; then
    pipeline_args+=(--build-check-no-cache)
  fi
  if [[ "${BUILD_CHECK_SKIP_CONFIG_CHECK}" == true ]]; then
    pipeline_args+=(--build-check-skip-config-check)
  fi
  if [[ "${BUILD_CHECK_WITH_IMAGE_PULL_CHECK}" == true ]]; then
    pipeline_args+=(--build-check-with-image-pull-check)
  fi
  if [[ "${#BUILD_CHECK_SERVICE_ARGS[@]}" -gt 0 ]]; then
    pipeline_args+=("${BUILD_CHECK_SERVICE_ARGS[@]}")
  fi
  if [[ "${#BUILD_CHECK_IMAGE_SERVICE_ARGS[@]}" -gt 0 ]]; then
    pipeline_args+=("${BUILD_CHECK_IMAGE_SERVICE_ARGS[@]}")
  fi
  if [[ "${DRY_RUN}" == true ]]; then
    pipeline_args+=(--build-check-dry-run)
  fi
fi

if [[ "${RUN_VERIFY}" == true ]]; then
  pipeline_args+=(--with-verify)
  if [[ -n "${VERIFY_MAX_RETRIES}" ]]; then
    pipeline_args+=(--verify-max-retries "${VERIFY_MAX_RETRIES}")
  fi
  if [[ -n "${VERIFY_RETRY_SLEEP}" ]]; then
    pipeline_args+=(--verify-retry-sleep "${VERIFY_RETRY_SLEEP}")
  fi
  if [[ "${VERIFY_SKIP_SSL_CHECK}" == true ]]; then
    pipeline_args+=(--verify-skip-ssl-check)
  fi
  if [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]]; then
    pipeline_args+=(--verify-skip-oauth-check)
  fi
  if [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; then
    pipeline_args+=(--verify-require-oauth-check)
  fi
fi

if [[ "${RUN_RUNTIME_SMOKE}" == true ]]; then
  pipeline_args+=(--with-runtime-smoke)
  if [[ "${DRY_RUN}" == true ]]; then
    pipeline_args+=(--runtime-smoke-dry-run)
  fi
  if [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]]; then
    pipeline_args+=(--runtime-smoke-max-retries "${RUNTIME_SMOKE_MAX_RETRIES}")
  fi
  if [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]]; then
    pipeline_args+=(--runtime-smoke-retry-sleep "${RUNTIME_SMOKE_RETRY_SLEEP}")
  fi
  if [[ "${RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK}" == true ]]; then
    pipeline_args+=(--runtime-smoke-skip-backend-dependency-check)
  fi
  if [[ "${RUNTIME_SMOKE_SKIP_COMPOSE_PS}" == true ]]; then
    pipeline_args+=(--runtime-smoke-skip-compose-ps)
  fi
fi

if [[ "${RUN_STATUS}" == true ]]; then
  pipeline_args+=(--with-status)
  if [[ "${STATUS_RUNTIME_CHECKS}" == true ]]; then
    pipeline_args+=(--status-runtime-checks)
    if [[ "${STATUS_SKIP_HOST_READINESS}" == true ]]; then
      pipeline_args+=(--status-skip-host-readiness)
    fi
    if [[ "${STATUS_SKIP_DNS_CHECK}" == true ]]; then
      pipeline_args+=(--status-skip-dns-check)
    fi
    if [[ "${STATUS_SKIP_SSL_CHECK}" == true ]]; then
      pipeline_args+=(--status-skip-ssl-check)
    fi
    if [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; then
      pipeline_args+=(--status-skip-ports-check)
    fi
  fi
  if [[ "${STATUS_STRICT}" == true ]]; then
    pipeline_args+=(--status-strict)
  fi
fi

"${SCRIPT_DIR}/pipeline-check.sh" "${pipeline_args[@]}"
log_info "Validation profile completed successfully."
