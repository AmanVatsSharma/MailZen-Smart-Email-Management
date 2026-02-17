#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 one-command launch script (non-technical friendly)
# -----------------------------------------------------------------------------
# Runs the full happy-path pipeline:
#   setup -> docs-check -> host-readiness -> dns-check -> ssl-check -> ports-check -> preflight -> (optional build-check) -> deploy -> verify -> (optional runtime-smoke) -> status
#
# Optional flags:
#   --skip-setup
#   --skip-docs-check
#   --skip-host-readiness
#   --skip-dns-check
#   --skip-ssl-check
#   --skip-ports-check
#   --skip-verify
#   --skip-status
#   --with-build-check
#   --with-runtime-smoke
#   --setup-skip-daemon
#   --preflight-config-only
#   --deploy-dry-run
#   --verify-max-retries <n>
#   --verify-retry-sleep <n>
#   --verify-skip-ssl-check
#   --verify-skip-oauth-check
#   --verify-require-oauth-check
#   --runtime-smoke-max-retries <n>
#   --runtime-smoke-retry-sleep <n>
#   --runtime-smoke-skip-backend-dependency-check
#   --runtime-smoke-skip-compose-ps
#   --runtime-smoke-dry-run
#   --build-check-dry-run
#   --build-check-pull
#   --build-check-no-cache
#   --build-check-skip-config-check
#   --build-check-with-image-pull-check
#   --build-check-image-service <name> (repeatable)
#   --build-check-service <name> (repeatable)
#   --docs-strict-coverage
#   --docs-include-common
#   --status-runtime-checks
#   --status-strict
#   --status-skip-host-readiness
#   --status-skip-dns-check
#   --status-skip-ssl-check
#   --status-skip-ports-check
#   --ports-check-ports <p1,p2,...>
#   --domain <hostname>
#   --acme-email <email>
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SETUP=true
RUN_DOCS_CHECK=true
RUN_HOST_READINESS=true
RUN_DNS_CHECK=true
RUN_SSL_CHECK=true
RUN_PORTS_CHECK=true
RUN_VERIFY=true
RUN_STATUS=true
RUN_BUILD_CHECK=false
RUN_RUNTIME_SMOKE=false
SETUP_SKIP_DAEMON=false
PREFLIGHT_CONFIG_ONLY=false
DEPLOY_DRY_RUN=false
STATUS_RUNTIME_CHECKS=false
STATUS_STRICT=false
STATUS_SKIP_HOST_READINESS=false
STATUS_SKIP_DNS_CHECK=false
STATUS_SKIP_SSL_CHECK=false
STATUS_SKIP_PORTS_CHECK=false
VERIFY_MAX_RETRIES=""
VERIFY_RETRY_SLEEP=""
VERIFY_SKIP_SSL_CHECK=false
VERIFY_SKIP_OAUTH_CHECK=false
VERIFY_REQUIRE_OAUTH_CHECK=false
RUNTIME_SMOKE_MAX_RETRIES=""
RUNTIME_SMOKE_RETRY_SLEEP=""
RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK=false
RUNTIME_SMOKE_SKIP_COMPOSE_PS=false
RUNTIME_SMOKE_DRY_RUN=false
BUILD_CHECK_DRY_RUN=false
BUILD_CHECK_PULL=false
BUILD_CHECK_NO_CACHE=false
BUILD_CHECK_SKIP_CONFIG_CHECK=false
BUILD_CHECK_WITH_IMAGE_PULL_CHECK=false
DOCS_STRICT_COVERAGE=false
DOCS_INCLUDE_COMMON=false
DOMAIN_ARG=""
ACME_EMAIL_ARG=""
PORTS_CHECK_PORTS=""
VERIFY_MAX_RETRIES_FLAG_SET=false
VERIFY_MAX_RETRIES_FLAG_VALUE=""
VERIFY_RETRY_SLEEP_FLAG_SET=false
VERIFY_RETRY_SLEEP_FLAG_VALUE=""
DOMAIN_FLAG_SET=false
DOMAIN_FLAG_VALUE=""
ACME_EMAIL_FLAG_SET=false
ACME_EMAIL_FLAG_VALUE=""
PORTS_CHECK_FLAG_SET=false
PORTS_CHECK_FLAG_VALUE=""
RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET=false
RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE=""
RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET=false
RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE=""
BUILD_CHECK_SERVICE_ARGS=()
BUILD_CHECK_IMAGE_SERVICE_ARGS=()

run_step() {
  local step_number="$1"
  local total_steps="$2"
  local title="$3"
  shift 3
  echo
  echo "================================================================================"
  echo "[mailzen-deploy][LAUNCH] Step ${step_number}/${total_steps}: ${title}"
  echo "================================================================================"
  "$@"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --skip-setup)
    RUN_SETUP=false
    shift
    ;;
  --skip-docs-check)
    RUN_DOCS_CHECK=false
    shift
    ;;
  --skip-host-readiness)
    RUN_HOST_READINESS=false
    shift
    ;;
  --skip-dns-check)
    RUN_DNS_CHECK=false
    shift
    ;;
  --skip-ssl-check)
    RUN_SSL_CHECK=false
    shift
    ;;
  --skip-ports-check)
    RUN_PORTS_CHECK=false
    shift
    ;;
  --skip-verify)
    RUN_VERIFY=false
    shift
    ;;
  --skip-status)
    RUN_STATUS=false
    shift
    ;;
  --with-build-check)
    RUN_BUILD_CHECK=true
    shift
    ;;
  --with-runtime-smoke)
    RUN_RUNTIME_SMOKE=true
    shift
    ;;
  --setup-skip-daemon)
    SETUP_SKIP_DAEMON=true
    shift
    ;;
  --preflight-config-only)
    PREFLIGHT_CONFIG_ONLY=true
    shift
    ;;
  --deploy-dry-run)
    DEPLOY_DRY_RUN=true
    shift
    ;;
  --verify-max-retries)
    verify_max_retries_arg="${2:-}"
    if [[ -z "${verify_max_retries_arg}" ]]; then
      log_error "--verify-max-retries requires a value."
      exit 1
    fi
    if [[ "${VERIFY_MAX_RETRIES_FLAG_SET}" == true ]] && [[ "${verify_max_retries_arg}" != "${VERIFY_MAX_RETRIES_FLAG_VALUE}" ]]; then
      log_warn "[LAUNCH] earlier --verify-max-retries '${VERIFY_MAX_RETRIES_FLAG_VALUE}' overridden by --verify-max-retries '${verify_max_retries_arg}'."
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
      log_warn "[LAUNCH] earlier --verify-retry-sleep '${VERIFY_RETRY_SLEEP_FLAG_VALUE}' overridden by --verify-retry-sleep '${verify_retry_sleep_arg}'."
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
      log_warn "[LAUNCH] earlier --runtime-smoke-max-retries '${RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE}' overridden by --runtime-smoke-max-retries '${runtime_smoke_max_retries_arg}'."
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
      log_warn "[LAUNCH] earlier --runtime-smoke-retry-sleep '${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE}' overridden by --runtime-smoke-retry-sleep '${runtime_smoke_retry_sleep_arg}'."
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
  --runtime-smoke-dry-run)
    RUNTIME_SMOKE_DRY_RUN=true
    shift
    ;;
  --build-check-dry-run)
    BUILD_CHECK_DRY_RUN=true
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
  --build-check-image-service)
    build_check_image_service_arg="${2:-}"
    if [[ -z "${build_check_image_service_arg}" ]]; then
      log_error "--build-check-image-service requires a value."
      exit 1
    fi
    BUILD_CHECK_IMAGE_SERVICE_ARGS+=(--image-service "${build_check_image_service_arg}")
    shift 2
    ;;
  --build-check-service)
    build_check_service_arg="${2:-}"
    if [[ -z "${build_check_service_arg}" ]]; then
      log_error "--build-check-service requires a value."
      exit 1
    fi
    BUILD_CHECK_SERVICE_ARGS+=(--service "${build_check_service_arg}")
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
  --status-runtime-checks)
    STATUS_RUNTIME_CHECKS=true
    shift
    ;;
  --status-strict)
    STATUS_STRICT=true
    shift
    ;;
  --status-skip-host-readiness)
    STATUS_SKIP_HOST_READINESS=true
    shift
    ;;
  --status-skip-dns-check)
    STATUS_SKIP_DNS_CHECK=true
    shift
    ;;
  --status-skip-ssl-check)
    STATUS_SKIP_SSL_CHECK=true
    shift
    ;;
  --status-skip-ports-check)
    STATUS_SKIP_PORTS_CHECK=true
    shift
    ;;
  --ports-check-ports)
    ports_check_ports_arg="${2:-}"
    if [[ -z "${ports_check_ports_arg}" ]]; then
      log_error "--ports-check-ports requires a value."
      exit 1
    fi
    if [[ "${PORTS_CHECK_FLAG_SET}" == true ]] && [[ "${ports_check_ports_arg}" != "${PORTS_CHECK_FLAG_VALUE}" ]]; then
      log_warn "[LAUNCH] earlier --ports-check-ports '${PORTS_CHECK_FLAG_VALUE}' overridden by --ports-check-ports '${ports_check_ports_arg}'."
    fi
    PORTS_CHECK_PORTS="${ports_check_ports_arg}"
    PORTS_CHECK_FLAG_SET=true
    PORTS_CHECK_FLAG_VALUE="${ports_check_ports_arg}"
    shift 2
    ;;
  --domain)
    domain_arg="${2:-}"
    if [[ -z "${domain_arg}" ]]; then
      log_error "--domain requires a value."
      exit 1
    fi
    if [[ "${DOMAIN_FLAG_SET}" == true ]] && [[ "${domain_arg}" != "${DOMAIN_FLAG_VALUE}" ]]; then
      log_warn "[LAUNCH] earlier --domain '${DOMAIN_FLAG_VALUE}' overridden by --domain '${domain_arg}'."
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
      log_warn "[LAUNCH] earlier --acme-email '${ACME_EMAIL_FLAG_VALUE}' overridden by --acme-email '${acme_email_arg}'."
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
      log_warn "[LAUNCH] earlier --domain '${DOMAIN_FLAG_VALUE}' overridden by --domain '${domain_arg}'."
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
      log_warn "[LAUNCH] earlier --acme-email '${ACME_EMAIL_FLAG_VALUE}' overridden by --acme-email '${acme_email_arg}'."
    fi
    ACME_EMAIL_ARG="${acme_email_arg}"
    ACME_EMAIL_FLAG_SET=true
    ACME_EMAIL_FLAG_VALUE="${acme_email_arg}"
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --skip-setup --skip-docs-check --skip-host-readiness --skip-dns-check --skip-ssl-check --skip-ports-check --skip-verify --skip-status --with-build-check --with-runtime-smoke --setup-skip-daemon --preflight-config-only --deploy-dry-run --verify-max-retries <n> --verify-retry-sleep <n> --verify-skip-ssl-check --verify-skip-oauth-check --verify-require-oauth-check --runtime-smoke-max-retries <n> --runtime-smoke-retry-sleep <n> --runtime-smoke-skip-backend-dependency-check --runtime-smoke-skip-compose-ps --runtime-smoke-dry-run --build-check-dry-run --build-check-pull --build-check-no-cache --build-check-skip-config-check --build-check-with-image-pull-check --build-check-image-service <name> --build-check-service <name> --docs-strict-coverage --docs-include-common --status-runtime-checks --status-strict --status-skip-host-readiness --status-skip-dns-check --status-skip-ssl-check --status-skip-ports-check --ports-check-ports <p1,p2,...> --domain <hostname> --acme-email <email>"
    exit 1
    ;;
  esac
done

if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  assert_ports_csv_value "--ports-check-ports" "${PORTS_CHECK_PORTS}" || exit 1
fi

if [[ "${DOCS_INCLUDE_COMMON}" == true ]] && [[ "${DOCS_STRICT_COVERAGE}" == false ]]; then
  log_warn "[LAUNCH] --docs-include-common is most useful with --docs-strict-coverage."
fi

if [[ -n "${VERIFY_MAX_RETRIES}" ]]; then
  assert_positive_integer "--verify-max-retries" "${VERIFY_MAX_RETRIES}" || exit 1
fi
if [[ -n "${VERIFY_RETRY_SLEEP}" ]]; then
  assert_positive_integer "--verify-retry-sleep" "${VERIFY_RETRY_SLEEP}" || exit 1
fi
if [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]]; then
  assert_positive_integer "--runtime-smoke-max-retries" "${RUNTIME_SMOKE_MAX_RETRIES}" || exit 1
fi
if [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]]; then
  assert_positive_integer "--runtime-smoke-retry-sleep" "${RUNTIME_SMOKE_RETRY_SLEEP}" || exit 1
fi
if [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]] && [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; then
  log_error "--verify-skip-oauth-check cannot be combined with --verify-require-oauth-check."
  exit 1
fi

if [[ "${RUN_VERIFY}" == false ]] &&
  { [[ -n "${VERIFY_MAX_RETRIES}" ]] || [[ -n "${VERIFY_RETRY_SLEEP}" ]] || [[ "${VERIFY_SKIP_SSL_CHECK}" == true ]] || [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]] || [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; }; then
  log_warn "[LAUNCH] verify-related flags were provided while --skip-verify is enabled; verify flags will be ignored."
fi
if [[ "${RUN_VERIFY}" == true ]] && [[ "${DEPLOY_DRY_RUN}" == true ]] &&
  { [[ -n "${VERIFY_MAX_RETRIES}" ]] || [[ -n "${VERIFY_RETRY_SLEEP}" ]] || [[ "${VERIFY_SKIP_SSL_CHECK}" == true ]] || [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]] || [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; }; then
  log_warn "[LAUNCH] verify-related flags were provided while --deploy-dry-run is enabled; verify step will be skipped."
fi
if [[ "${RUN_RUNTIME_SMOKE}" == false ]] &&
  { [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]] || [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]] || [[ "${RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK}" == true ]] || [[ "${RUNTIME_SMOKE_SKIP_COMPOSE_PS}" == true ]] || [[ "${RUNTIME_SMOKE_DRY_RUN}" == true ]]; }; then
  log_warn "[LAUNCH] runtime-smoke-related flags were provided without --with-runtime-smoke; runtime-smoke flags will be ignored."
fi
if [[ "${RUN_RUNTIME_SMOKE}" == true ]] && [[ "${DEPLOY_DRY_RUN}" == true ]] &&
  { [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]] || [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]] || [[ "${RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK}" == true ]] || [[ "${RUNTIME_SMOKE_SKIP_COMPOSE_PS}" == true ]] || [[ "${RUNTIME_SMOKE_DRY_RUN}" == true ]]; }; then
  log_warn "[LAUNCH] runtime-smoke-related flags were provided while --deploy-dry-run is enabled; runtime-smoke step will be skipped."
fi
if [[ "${RUN_BUILD_CHECK}" == false ]] &&
  { [[ "${BUILD_CHECK_DRY_RUN}" == true ]] || [[ "${BUILD_CHECK_PULL}" == true ]] || [[ "${BUILD_CHECK_NO_CACHE}" == true ]] || [[ "${BUILD_CHECK_SKIP_CONFIG_CHECK}" == true ]] || [[ "${BUILD_CHECK_WITH_IMAGE_PULL_CHECK}" == true ]] || [[ "${#BUILD_CHECK_SERVICE_ARGS[@]}" -gt 0 ]] || [[ "${#BUILD_CHECK_IMAGE_SERVICE_ARGS[@]}" -gt 0 ]]; }; then
  log_warn "[LAUNCH] build-check-related flags were provided without --with-build-check; build-check flags will be ignored."
fi
if [[ "${RUN_RUNTIME_SMOKE}" == true ]] && [[ "${DEPLOY_DRY_RUN}" == true ]]; then
  log_warn "[LAUNCH] runtime-smoke step will be skipped because deploy runs with --deploy-dry-run."
fi

if [[ "${RUN_SETUP}" == true ]] && [[ ! -t 0 ]]; then
  log_info "[LAUNCH] non-interactive terminal detected; setup will run in non-interactive mode."
fi

if [[ "${RUN_SETUP}" == false ]]; then
  log_info "[LAUNCH] setup step skipped by --skip-setup"
fi
if [[ "${RUN_SETUP}" == false ]] && [[ "${SETUP_SKIP_DAEMON}" == true ]]; then
  log_warn "[LAUNCH] --setup-skip-daemon is ignored when --skip-setup is enabled."
fi
if [[ "${RUN_SETUP}" == false ]] && [[ -n "${DOMAIN_ARG}" ]]; then
  log_warn "[LAUNCH] --domain is ignored when --skip-setup is enabled."
fi
if [[ "${RUN_SETUP}" == false ]] && [[ -n "${ACME_EMAIL_ARG}" ]]; then
  log_warn "[LAUNCH] --acme-email is ignored when --skip-setup is enabled."
fi
if [[ "${RUN_HOST_READINESS}" == false ]]; then
  log_info "[LAUNCH] host-readiness step skipped by --skip-host-readiness"
fi
if [[ "${RUN_DNS_CHECK}" == false ]]; then
  log_info "[LAUNCH] dns-check step skipped by --skip-dns-check"
fi
if [[ "${RUN_SSL_CHECK}" == false ]]; then
  log_info "[LAUNCH] ssl-check step skipped by --skip-ssl-check"
fi
if [[ "${RUN_PORTS_CHECK}" == false ]]; then
  log_info "[LAUNCH] ports-check step skipped by --skip-ports-check"
fi
if [[ "${RUN_VERIFY}" == false ]]; then
  log_info "[LAUNCH] verify step skipped by --skip-verify"
fi
if [[ "${RUN_BUILD_CHECK}" == false ]]; then
  log_info "[LAUNCH] build-check step skipped (enable with --with-build-check)"
fi
if [[ "${RUN_DOCS_CHECK}" == false ]]; then
  log_info "[LAUNCH] docs-check step skipped by --skip-docs-check"
fi
if [[ "${RUN_RUNTIME_SMOKE}" == false ]]; then
  log_info "[LAUNCH] runtime-smoke step skipped (enable with --with-runtime-smoke)"
fi
if [[ "${RUN_DOCS_CHECK}" == false ]] &&
  { [[ "${DOCS_STRICT_COVERAGE}" == true ]] || [[ "${DOCS_INCLUDE_COMMON}" == true ]]; }; then
  log_warn "[LAUNCH] docs-check-related flags were provided while --skip-docs-check is enabled; docs-check flags will be ignored."
fi
if [[ "${RUN_STATUS}" == false ]]; then
  log_info "[LAUNCH] status step skipped by --skip-status"
fi
if [[ "${RUN_STATUS}" == false ]] &&
  { [[ "${STATUS_RUNTIME_CHECKS}" == true ]] || [[ "${STATUS_STRICT}" == true ]] || [[ "${STATUS_SKIP_HOST_READINESS}" == true ]] || [[ "${STATUS_SKIP_DNS_CHECK}" == true ]] || [[ "${STATUS_SKIP_SSL_CHECK}" == true ]] || [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; }; then
  log_warn "[LAUNCH] status-related flags were provided while --skip-status is enabled; status flags will be ignored."
fi
if [[ "${RUN_STATUS}" == true ]] && [[ "${STATUS_RUNTIME_CHECKS}" == false ]] &&
  { [[ "${STATUS_SKIP_HOST_READINESS}" == true ]] || [[ "${STATUS_SKIP_DNS_CHECK}" == true ]] || [[ "${STATUS_SKIP_SSL_CHECK}" == true ]] || [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; }; then
  log_warn "[LAUNCH] status runtime skip flags were provided without --status-runtime-checks; skip flags will be ignored."
fi
status_ports_check_enabled=false
if [[ "${RUN_STATUS}" == true ]] && [[ "${STATUS_RUNTIME_CHECKS}" == true ]] && [[ "${RUN_PORTS_CHECK}" == true ]] && [[ "${STATUS_SKIP_PORTS_CHECK}" == false ]]; then
  status_ports_check_enabled=true
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${RUN_PORTS_CHECK}" == false ]] && [[ "${RUN_STATUS}" == false ]]; then
  log_warn "[LAUNCH] --ports-check-ports has no effect when both direct ports check and status step are skipped."
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${RUN_PORTS_CHECK}" == false ]] && [[ "${RUN_STATUS}" == true ]] && [[ "${STATUS_RUNTIME_CHECKS}" == false ]]; then
  log_warn "[LAUNCH] --ports-check-ports has no effect when both direct ports check and status runtime checks are disabled."
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${RUN_STATUS}" == true ]] && [[ "${RUN_PORTS_CHECK}" == false ]] && [[ "${status_ports_check_enabled}" == false ]]; then
  log_warn "[LAUNCH] --ports-check-ports has no effect because ports checks are skipped in both direct and status runtime paths."
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${RUN_STATUS}" == true ]] && [[ "${RUN_PORTS_CHECK}" == true ]] && [[ "${status_ports_check_enabled}" == false ]]; then
  log_warn "[LAUNCH] --ports-check-ports has no effect in the status runtime path when --status-skip-ports-check is enabled."
fi

log_info "[LAUNCH] active env file: $(get_env_file)"
log_info "[LAUNCH] active compose file: $(get_compose_file)"

total_steps=2 # preflight + deploy
if [[ "${RUN_SETUP}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_DOCS_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_HOST_READINESS}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_DNS_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_SSL_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_PORTS_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_BUILD_CHECK}" == true ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_VERIFY}" == true ]] && [[ "${DEPLOY_DRY_RUN}" == false ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_RUNTIME_SMOKE}" == true ]] && [[ "${DEPLOY_DRY_RUN}" == false ]]; then
  total_steps=$((total_steps + 1))
fi
if [[ "${RUN_STATUS}" == true ]]; then
  total_steps=$((total_steps + 1))
fi

step=1
if [[ "${RUN_SETUP}" == true ]]; then
  setup_args=(--non-interactive)
  if [[ -n "${DOMAIN_ARG}" ]]; then
    setup_args+=(--domain "${DOMAIN_ARG}")
  fi
  if [[ -n "${ACME_EMAIL_ARG}" ]]; then
    setup_args+=(--acme-email "${ACME_EMAIL_ARG}")
  fi
  if [[ "${SETUP_SKIP_DAEMON}" == true ]]; then
    setup_args+=(--skip-daemon)
  fi
  run_step "${step}" "${total_steps}" "setup environment" "${SCRIPT_DIR}/setup.sh" "${setup_args[@]}"
  step=$((step + 1))
fi

if [[ "${RUN_DOCS_CHECK}" == true ]]; then
  docs_check_args=()
  if [[ "${DOCS_STRICT_COVERAGE}" == true ]]; then
    docs_check_args+=(--strict-coverage)
  fi
  if [[ "${DOCS_INCLUDE_COMMON}" == true ]]; then
    docs_check_args+=(--include-common)
  fi
  run_step "${step}" "${total_steps}" "docs consistency check" "${SCRIPT_DIR}/docs-check.sh" "${docs_check_args[@]}"
  step=$((step + 1))
fi

if [[ "${RUN_HOST_READINESS}" == true ]]; then
  run_step "${step}" "${total_steps}" "host readiness check" "${SCRIPT_DIR}/host-readiness.sh"
  step=$((step + 1))
fi

if [[ "${RUN_DNS_CHECK}" == true ]]; then
  run_step "${step}" "${total_steps}" "dns readiness check" "${SCRIPT_DIR}/dns-check.sh"
  step=$((step + 1))
fi

if [[ "${RUN_SSL_CHECK}" == true ]]; then
  run_step "${step}" "${total_steps}" "ssl certificate check" "${SCRIPT_DIR}/ssl-check.sh"
  step=$((step + 1))
fi

if [[ "${RUN_PORTS_CHECK}" == true ]]; then
  ports_check_args=()
  if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
    ports_check_args+=(--ports "${PORTS_CHECK_PORTS}")
  fi
  run_step "${step}" "${total_steps}" "host ports check" "${SCRIPT_DIR}/ports-check.sh" "${ports_check_args[@]}"
  step=$((step + 1))
fi

preflight_args=()
if [[ "${PREFLIGHT_CONFIG_ONLY}" == true ]]; then
  preflight_args+=(--config-only)
fi
run_step "${step}" "${total_steps}" "preflight validation" "${SCRIPT_DIR}/preflight.sh" "${preflight_args[@]}"
step=$((step + 1))

if [[ "${RUN_BUILD_CHECK}" == true ]]; then
  build_check_args=()
  if [[ "${BUILD_CHECK_DRY_RUN}" == true ]]; then
    build_check_args+=(--dry-run)
  fi
  if [[ "${BUILD_CHECK_PULL}" == true ]]; then
    build_check_args+=(--pull)
  fi
  if [[ "${BUILD_CHECK_NO_CACHE}" == true ]]; then
    build_check_args+=(--no-cache)
  fi
  if [[ "${BUILD_CHECK_SKIP_CONFIG_CHECK}" == true ]]; then
    build_check_args+=(--skip-config-check)
  fi
  if [[ "${BUILD_CHECK_WITH_IMAGE_PULL_CHECK}" == true ]]; then
    build_check_args+=(--with-image-pull-check)
  fi
  if [[ "${#BUILD_CHECK_SERVICE_ARGS[@]}" -gt 0 ]]; then
    build_check_args+=("${BUILD_CHECK_SERVICE_ARGS[@]}")
  fi
  if [[ "${#BUILD_CHECK_IMAGE_SERVICE_ARGS[@]}" -gt 0 ]]; then
    build_check_args+=("${BUILD_CHECK_IMAGE_SERVICE_ARGS[@]}")
  fi
  run_step "${step}" "${total_steps}" "build image validation" "${SCRIPT_DIR}/build-check.sh" "${build_check_args[@]}"
  step=$((step + 1))
fi

deploy_args=()
if [[ "${DEPLOY_DRY_RUN}" == true ]]; then
  deploy_args+=(--dry-run)
fi
run_step "${step}" "${total_steps}" "deploy stack" "${SCRIPT_DIR}/deploy.sh" "${deploy_args[@]}"
step=$((step + 1))

if [[ "${RUN_VERIFY}" == true ]]; then
  if [[ "${DEPLOY_DRY_RUN}" == true ]]; then
    log_warn "[LAUNCH] verify step skipped because deploy ran with --deploy-dry-run."
  else
    verify_args=()
    if [[ -n "${VERIFY_MAX_RETRIES}" ]]; then
      verify_args+=(--max-retries "${VERIFY_MAX_RETRIES}")
    fi
    if [[ -n "${VERIFY_RETRY_SLEEP}" ]]; then
      verify_args+=(--retry-sleep "${VERIFY_RETRY_SLEEP}")
    fi
    if [[ "${VERIFY_SKIP_SSL_CHECK}" == true ]]; then
      verify_args+=(--skip-ssl-check)
    fi
    if [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]]; then
      verify_args+=(--skip-oauth-check)
    fi
    if [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; then
      verify_args+=(--require-oauth-check)
    fi
    run_step "${step}" "${total_steps}" "verify deployment" "${SCRIPT_DIR}/verify.sh" "${verify_args[@]}"
    step=$((step + 1))
  fi
fi

if [[ "${RUN_RUNTIME_SMOKE}" == true ]]; then
  if [[ "${DEPLOY_DRY_RUN}" == true ]]; then
    log_warn "[LAUNCH] runtime-smoke step skipped because deploy ran with --deploy-dry-run."
  else
    runtime_smoke_args=()
    if [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]]; then
      runtime_smoke_args+=(--max-retries "${RUNTIME_SMOKE_MAX_RETRIES}")
    fi
    if [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]]; then
      runtime_smoke_args+=(--retry-sleep "${RUNTIME_SMOKE_RETRY_SLEEP}")
    fi
    if [[ "${RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK}" == true ]]; then
      runtime_smoke_args+=(--skip-backend-dependency-check)
    fi
    if [[ "${RUNTIME_SMOKE_SKIP_COMPOSE_PS}" == true ]]; then
      runtime_smoke_args+=(--skip-compose-ps)
    fi
    if [[ "${RUNTIME_SMOKE_DRY_RUN}" == true ]]; then
      runtime_smoke_args+=(--dry-run)
    fi
    run_step "${step}" "${total_steps}" "runtime smoke checks" "${SCRIPT_DIR}/runtime-smoke.sh" "${runtime_smoke_args[@]}"
    step=$((step + 1))
  fi
fi

status_args=()
if [[ "${RUN_STATUS}" == true ]]; then
  if [[ "${STATUS_RUNTIME_CHECKS}" == true ]]; then
    status_args+=(--with-runtime-checks)
    if [[ "${RUN_HOST_READINESS}" == false ]] || [[ "${STATUS_SKIP_HOST_READINESS}" == true ]]; then
      status_args+=(--skip-host-readiness)
    fi
    if [[ "${RUN_DNS_CHECK}" == false ]] || [[ "${STATUS_SKIP_DNS_CHECK}" == true ]]; then
      status_args+=(--skip-dns-check)
    fi
    if [[ "${RUN_SSL_CHECK}" == false ]] || [[ "${STATUS_SKIP_SSL_CHECK}" == true ]]; then
      status_args+=(--skip-ssl-check)
    fi
    if [[ "${RUN_PORTS_CHECK}" == false ]] || [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; then
      status_args+=(--skip-ports-check)
    fi
    if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
      status_args+=(--ports-check-ports "${PORTS_CHECK_PORTS}")
    fi
  fi
  if [[ "${STATUS_STRICT}" == true ]]; then
    status_args+=(--strict)
  fi
  run_step "${step}" "${total_steps}" "show status" "${SCRIPT_DIR}/status.sh" "${status_args[@]}"
fi

echo
echo "[mailzen-deploy][LAUNCH] MailZen launch pipeline completed successfully."
