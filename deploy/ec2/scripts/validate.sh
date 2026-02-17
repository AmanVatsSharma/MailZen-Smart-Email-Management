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
#   ./deploy/ec2/scripts/validate.sh --skip-docs-check
#   ./deploy/ec2/scripts/validate.sh --build-check-dry-run --runtime-smoke-dry-run
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
RUN_DOCS_CHECK=true
PORTS_CHECK_PORTS=""
BUILD_CHECK_PULL=false
BUILD_CHECK_DRY_RUN=false
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
RUNTIME_SMOKE_DRY_RUN=false
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
declare -A FLAG_SEEN=()

mark_duplicate_flag() {
  local flag_name="$1"
  local warning_message="$2"
  if [[ -n "${FLAG_SEEN[${flag_name}]:-}" ]]; then
    log_warn "${warning_message}"
  fi
  FLAG_SEEN["${flag_name}"]=1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --seed-env)
    mark_duplicate_flag "--seed-env" "Duplicate --seed-env flag detected; seeded validation mode remains enabled."
    SEED_ENV=true
    shift
    ;;
  --dry-run)
    mark_duplicate_flag "--dry-run" "Duplicate --dry-run flag detected; dry-run profile mode remains enabled."
    DRY_RUN=true
    shift
    ;;
  --with-verify-in-dry-run)
    mark_duplicate_flag "--with-verify-in-dry-run" "Duplicate --with-verify-in-dry-run flag detected; verify stage remains enabled in dry-run mode."
    WITH_VERIFY_IN_DRY_RUN=true
    shift
    ;;
  --skip-build-check)
    mark_duplicate_flag "--skip-build-check" "Duplicate --skip-build-check flag detected; build-check stage remains disabled."
    RUN_BUILD_CHECK=false
    shift
    ;;
  --skip-docs-check)
    mark_duplicate_flag "--skip-docs-check" "Duplicate --skip-docs-check flag detected; docs stage remains disabled."
    RUN_DOCS_CHECK=false
    shift
    ;;
  --build-check-pull)
    mark_duplicate_flag "--build-check-pull" "Duplicate --build-check-pull flag detected; build-check pull mode remains enabled."
    BUILD_CHECK_PULL=true
    shift
    ;;
  --build-check-dry-run)
    mark_duplicate_flag "--build-check-dry-run" "Duplicate --build-check-dry-run flag detected; build-check dry-run mode remains enabled."
    BUILD_CHECK_DRY_RUN=true
    shift
    ;;
  --build-check-no-cache)
    mark_duplicate_flag "--build-check-no-cache" "Duplicate --build-check-no-cache flag detected; build-check no-cache mode remains enabled."
    BUILD_CHECK_NO_CACHE=true
    shift
    ;;
  --build-check-skip-config-check)
    mark_duplicate_flag "--build-check-skip-config-check" "Duplicate --build-check-skip-config-check flag detected; build-check config precheck remains skipped."
    BUILD_CHECK_SKIP_CONFIG_CHECK=true
    shift
    ;;
  --build-check-with-image-pull-check)
    mark_duplicate_flag "--build-check-with-image-pull-check" "Duplicate --build-check-with-image-pull-check flag detected; image pull checks remain enabled."
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
    mark_duplicate_flag "--docs-strict-coverage" "Duplicate --docs-strict-coverage flag detected; strict docs coverage remains enabled."
    DOCS_STRICT_COVERAGE=true
    shift
    ;;
  --docs-include-common)
    mark_duplicate_flag "--docs-include-common" "Duplicate --docs-include-common flag detected; common helper docs coverage remains enabled."
    DOCS_INCLUDE_COMMON=true
    shift
    ;;
  --skip-verify)
    mark_duplicate_flag "--skip-verify" "Duplicate --skip-verify flag detected; verify stage remains disabled."
    RUN_VERIFY=false
    shift
    ;;
  --skip-runtime-smoke)
    mark_duplicate_flag "--skip-runtime-smoke" "Duplicate --skip-runtime-smoke flag detected; runtime-smoke stage remains disabled."
    RUN_RUNTIME_SMOKE=false
    shift
    ;;
  --skip-status)
    mark_duplicate_flag "--skip-status" "Duplicate --skip-status flag detected; status stage remains disabled."
    RUN_STATUS=false
    shift
    ;;
  --ports-check-ports)
    ports_check_ports_arg="${2:-}"
    if [[ -z "${ports_check_ports_arg}" ]]; then
      log_error "--ports-check-ports requires a value."
      exit 1
    fi
    if [[ "${PORTS_CHECK_FLAG_SET}" == true ]]; then
      if [[ "${ports_check_ports_arg}" != "${PORTS_CHECK_FLAG_VALUE}" ]]; then
        log_warn "Earlier --ports-check-ports '${PORTS_CHECK_FLAG_VALUE}' overridden by --ports-check-ports '${ports_check_ports_arg}'."
      else
        log_warn "Duplicate --ports-check-ports flag detected; keeping --ports-check-ports '${ports_check_ports_arg}'."
      fi
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
    if [[ "${VERIFY_MAX_RETRIES_FLAG_SET}" == true ]]; then
      if [[ "${verify_max_retries_arg}" != "${VERIFY_MAX_RETRIES_FLAG_VALUE}" ]]; then
        log_warn "Earlier --verify-max-retries '${VERIFY_MAX_RETRIES_FLAG_VALUE}' overridden by --verify-max-retries '${verify_max_retries_arg}'."
      else
        log_warn "Duplicate --verify-max-retries flag detected; keeping --verify-max-retries '${verify_max_retries_arg}'."
      fi
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
    if [[ "${VERIFY_RETRY_SLEEP_FLAG_SET}" == true ]]; then
      if [[ "${verify_retry_sleep_arg}" != "${VERIFY_RETRY_SLEEP_FLAG_VALUE}" ]]; then
        log_warn "Earlier --verify-retry-sleep '${VERIFY_RETRY_SLEEP_FLAG_VALUE}' overridden by --verify-retry-sleep '${verify_retry_sleep_arg}'."
      else
        log_warn "Duplicate --verify-retry-sleep flag detected; keeping --verify-retry-sleep '${verify_retry_sleep_arg}'."
      fi
    fi
    VERIFY_RETRY_SLEEP="${verify_retry_sleep_arg}"
    VERIFY_RETRY_SLEEP_FLAG_SET=true
    VERIFY_RETRY_SLEEP_FLAG_VALUE="${verify_retry_sleep_arg}"
    shift 2
    ;;
  --verify-skip-ssl-check)
    mark_duplicate_flag "--verify-skip-ssl-check" "Duplicate --verify-skip-ssl-check flag detected; verify SSL check remains skipped."
    VERIFY_SKIP_SSL_CHECK=true
    shift
    ;;
  --verify-skip-oauth-check)
    mark_duplicate_flag "--verify-skip-oauth-check" "Duplicate --verify-skip-oauth-check flag detected; verify OAuth check remains skipped."
    VERIFY_SKIP_OAUTH_CHECK=true
    shift
    ;;
  --verify-require-oauth-check)
    mark_duplicate_flag "--verify-require-oauth-check" "Duplicate --verify-require-oauth-check flag detected; verify OAuth requirement remains enabled."
    VERIFY_REQUIRE_OAUTH_CHECK=true
    shift
    ;;
  --runtime-smoke-max-retries)
    runtime_smoke_max_retries_arg="${2:-}"
    if [[ -z "${runtime_smoke_max_retries_arg}" ]]; then
      log_error "--runtime-smoke-max-retries requires a value."
      exit 1
    fi
    if [[ "${RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET}" == true ]]; then
      if [[ "${runtime_smoke_max_retries_arg}" != "${RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE}" ]]; then
        log_warn "Earlier --runtime-smoke-max-retries '${RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE}' overridden by --runtime-smoke-max-retries '${runtime_smoke_max_retries_arg}'."
      else
        log_warn "Duplicate --runtime-smoke-max-retries flag detected; keeping --runtime-smoke-max-retries '${runtime_smoke_max_retries_arg}'."
      fi
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
    if [[ "${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET}" == true ]]; then
      if [[ "${runtime_smoke_retry_sleep_arg}" != "${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE}" ]]; then
        log_warn "Earlier --runtime-smoke-retry-sleep '${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE}' overridden by --runtime-smoke-retry-sleep '${runtime_smoke_retry_sleep_arg}'."
      else
        log_warn "Duplicate --runtime-smoke-retry-sleep flag detected; keeping --runtime-smoke-retry-sleep '${runtime_smoke_retry_sleep_arg}'."
      fi
    fi
    RUNTIME_SMOKE_RETRY_SLEEP="${runtime_smoke_retry_sleep_arg}"
    RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET=true
    RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE="${runtime_smoke_retry_sleep_arg}"
    shift 2
    ;;
  --runtime-smoke-dry-run)
    mark_duplicate_flag "--runtime-smoke-dry-run" "Duplicate --runtime-smoke-dry-run flag detected; runtime-smoke dry-run mode remains enabled."
    RUNTIME_SMOKE_DRY_RUN=true
    shift
    ;;
  --runtime-smoke-skip-backend-dependency-check)
    mark_duplicate_flag "--runtime-smoke-skip-backend-dependency-check" "Duplicate --runtime-smoke-skip-backend-dependency-check flag detected; backend dependency check remains skipped."
    RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK=true
    shift
    ;;
  --runtime-smoke-skip-compose-ps)
    mark_duplicate_flag "--runtime-smoke-skip-compose-ps" "Duplicate --runtime-smoke-skip-compose-ps flag detected; compose status snapshot remains skipped."
    RUNTIME_SMOKE_SKIP_COMPOSE_PS=true
    shift
    ;;
  --status-strict)
    mark_duplicate_flag "--status-strict" "Duplicate --status-strict flag detected; strict status mode remains enabled."
    STATUS_STRICT=true
    shift
    ;;
  --status-no-runtime-checks)
    mark_duplicate_flag "--status-no-runtime-checks" "Duplicate --status-no-runtime-checks flag detected; status runtime checks remain disabled."
    STATUS_RUNTIME_CHECKS=false
    shift
    ;;
  --status-skip-host-readiness)
    mark_duplicate_flag "--status-skip-host-readiness" "Duplicate --status-skip-host-readiness flag detected; status host-readiness remains skipped."
    STATUS_SKIP_HOST_READINESS=true
    shift
    ;;
  --status-skip-dns-check)
    mark_duplicate_flag "--status-skip-dns-check" "Duplicate --status-skip-dns-check flag detected; status DNS checks remain skipped."
    STATUS_SKIP_DNS_CHECK=true
    STATUS_SKIP_DNS_EXPLICIT=true
    shift
    ;;
  --status-skip-ssl-check)
    mark_duplicate_flag "--status-skip-ssl-check" "Duplicate --status-skip-ssl-check flag detected; status SSL checks remain skipped."
    STATUS_SKIP_SSL_CHECK=true
    STATUS_SKIP_SSL_EXPLICIT=true
    shift
    ;;
  --status-skip-ports-check)
    mark_duplicate_flag "--status-skip-ports-check" "Duplicate --status-skip-ports-check flag detected; status ports checks remain skipped."
    STATUS_SKIP_PORTS_CHECK=true
    STATUS_SKIP_PORTS_EXPLICIT=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --seed-env --dry-run --with-verify-in-dry-run --skip-build-check --skip-docs-check --skip-verify --skip-runtime-smoke --skip-status --ports-check-ports <p1,p2,...> --build-check-pull --build-check-dry-run --build-check-no-cache --build-check-skip-config-check --build-check-with-image-pull-check --build-check-service <name> --build-check-image-service <name> --docs-strict-coverage --docs-include-common --verify-max-retries <n> --verify-retry-sleep <n> --verify-skip-ssl-check --verify-skip-oauth-check --verify-require-oauth-check --runtime-smoke-max-retries <n> --runtime-smoke-retry-sleep <n> --runtime-smoke-dry-run --runtime-smoke-skip-backend-dependency-check --runtime-smoke-skip-compose-ps --status-strict --status-no-runtime-checks --status-skip-host-readiness --status-skip-dns-check --status-skip-ssl-check --status-skip-ports-check"
    exit 1
    ;;
  esac
done

if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  assert_ports_csv_value "--ports-check-ports" "${PORTS_CHECK_PORTS}" || exit 1
  PORTS_CHECK_PORTS="$(normalize_ports_csv "${PORTS_CHECK_PORTS}")"
fi

if [[ "${RUN_DOCS_CHECK}" == false ]] &&
  { [[ "${DOCS_STRICT_COVERAGE}" == true ]] || [[ "${DOCS_INCLUDE_COMMON}" == true ]]; }; then
  log_warn "Docs-check-specific flags were provided while docs stage is disabled; docs-check flags will be ignored."
fi

if [[ "${DOCS_INCLUDE_COMMON}" == true ]] && [[ "${DOCS_STRICT_COVERAGE}" == false ]]; then
  log_warn "--docs-include-common is most useful with --docs-strict-coverage."
fi

if [[ -n "${VERIFY_MAX_RETRIES}" ]]; then
  assert_positive_integer "--verify-max-retries" "${VERIFY_MAX_RETRIES}" || exit 1
fi
if [[ -n "${VERIFY_RETRY_SLEEP}" ]]; then
  assert_positive_integer "--verify-retry-sleep" "${VERIFY_RETRY_SLEEP}" || exit 1
fi
if [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]] && [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; then
  log_error "--verify-skip-oauth-check cannot be combined with --verify-require-oauth-check."
  exit 1
fi
if [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]]; then
  assert_positive_integer "--runtime-smoke-max-retries" "${RUNTIME_SMOKE_MAX_RETRIES}" || exit 1
fi
if [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]]; then
  assert_positive_integer "--runtime-smoke-retry-sleep" "${RUNTIME_SMOKE_RETRY_SLEEP}" || exit 1
fi

if [[ "${DRY_RUN}" == true ]]; then
  BUILD_CHECK_DRY_RUN=true
  RUNTIME_SMOKE_DRY_RUN=true
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
  { [[ "${BUILD_CHECK_PULL}" == true ]] || [[ "${BUILD_CHECK_DRY_RUN}" == true ]] || [[ "${BUILD_CHECK_NO_CACHE}" == true ]] || [[ "${BUILD_CHECK_SKIP_CONFIG_CHECK}" == true ]] || [[ "${BUILD_CHECK_WITH_IMAGE_PULL_CHECK}" == true ]] || [[ "${#BUILD_CHECK_SERVICE_ARGS[@]}" -gt 0 ]] || [[ "${#BUILD_CHECK_IMAGE_SERVICE_ARGS[@]}" -gt 0 ]]; }; then
  log_warn "Build-check-specific flags were provided while build-check stage is disabled; build-check flags will be ignored."
fi

if [[ "${RUN_RUNTIME_SMOKE}" == false ]] &&
  { [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]] || [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]] || [[ "${RUNTIME_SMOKE_DRY_RUN}" == true ]] || [[ "${RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK}" == true ]] || [[ "${RUNTIME_SMOKE_SKIP_COMPOSE_PS}" == true ]]; }; then
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
if [[ "${RUN_DOCS_CHECK}" == false ]]; then
  pipeline_args+=(--skip-docs-check)
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
  if [[ "${BUILD_CHECK_DRY_RUN}" == true ]]; then
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
  if [[ "${RUNTIME_SMOKE_DRY_RUN}" == true ]]; then
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

log_info "Command preview: $(format_command_for_logs "${SCRIPT_DIR}/pipeline-check.sh" "${pipeline_args[@]}")"
"${SCRIPT_DIR}/pipeline-check.sh" "${pipeline_args[@]}"
log_info "Validation profile completed successfully."
