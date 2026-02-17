#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 deployment pipeline check
# -----------------------------------------------------------------------------
# CI-friendly validation pipeline for deployment assets.
# Default mode is daemon-agnostic (config-only checks).
# Optional verify/runtime-smoke/status chains require runtime reachability.
#
# Usage:
#   ./deploy/ec2/scripts/pipeline-check.sh
#   ./deploy/ec2/scripts/pipeline-check.sh --seed-env
#   ./deploy/ec2/scripts/pipeline-check.sh --ports-check-ports 80,443,8100
#   ./deploy/ec2/scripts/pipeline-check.sh --seed-env --with-runtime-smoke --runtime-smoke-dry-run
#   ./deploy/ec2/scripts/pipeline-check.sh --with-runtime-smoke --runtime-smoke-max-retries 15 --runtime-smoke-retry-sleep 4
#   ./deploy/ec2/scripts/pipeline-check.sh --with-runtime-smoke --runtime-smoke-skip-backend-dependency-check --runtime-smoke-skip-compose-ps
#   ./deploy/ec2/scripts/pipeline-check.sh --with-build-check --build-check-dry-run
#   ./deploy/ec2/scripts/pipeline-check.sh --with-build-check --build-check-service backend --build-check-service frontend --build-check-pull
#   ./deploy/ec2/scripts/pipeline-check.sh --with-build-check --build-check-with-image-pull-check --build-check-image-service caddy --build-check-image-service postgres --build-check-dry-run
#   ./deploy/ec2/scripts/pipeline-check.sh --docs-strict-coverage
#   ./deploy/ec2/scripts/pipeline-check.sh --skip-docs-check
#   ./deploy/ec2/scripts/pipeline-check.sh --with-verify --verify-skip-oauth-check --verify-skip-ssl-check
#   ./deploy/ec2/scripts/pipeline-check.sh --with-verify --verify-max-retries 10 --verify-retry-sleep 5
#   ./deploy/ec2/scripts/pipeline-check.sh --with-status --status-runtime-checks --status-skip-dns-check --status-skip-ssl-check
#   ./deploy/ec2/scripts/pipeline-check.sh --with-status --status-runtime-checks --status-skip-host-readiness --status-skip-ports-check
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_ENV=false
KEEP_SEEDED_ENV=false
SEEDED_ENV_FILE=""
PORTS_CHECK_PORTS=""
PORTS_CHECK_FLAG_SET=false
PORTS_CHECK_FLAG_VALUE=""
RUN_RUNTIME_SMOKE=false
RUNTIME_SMOKE_MAX_RETRIES=""
RUNTIME_SMOKE_RETRY_SLEEP=""
RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK=false
RUNTIME_SMOKE_SKIP_COMPOSE_PS=false
RUNTIME_SMOKE_DRY_RUN=false
RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET=false
RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET=false
RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE=""
RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE=""
RUN_BUILD_CHECK=false
BUILD_CHECK_DRY_RUN=false
BUILD_CHECK_PULL=false
BUILD_CHECK_NO_CACHE=false
BUILD_CHECK_SKIP_CONFIG_CHECK=false
BUILD_CHECK_WITH_IMAGE_PULL_CHECK=false
BUILD_CHECK_SERVICE_FLAGS_SET=false
BUILD_CHECK_IMAGE_SERVICE_FLAGS_SET=false
BUILD_CHECK_SERVICE_ARGS=()
BUILD_CHECK_IMAGE_SERVICE_ARGS=()
RUN_VERIFY=false
VERIFY_MAX_RETRIES=""
VERIFY_RETRY_SLEEP=""
VERIFY_SKIP_SSL_CHECK=false
VERIFY_SKIP_OAUTH_CHECK=false
VERIFY_REQUIRE_OAUTH_CHECK=false
VERIFY_MAX_RETRIES_FLAG_SET=false
VERIFY_MAX_RETRIES_FLAG_VALUE=""
VERIFY_RETRY_SLEEP_FLAG_SET=false
VERIFY_RETRY_SLEEP_FLAG_VALUE=""
RUN_STATUS=false
STATUS_RUNTIME_CHECKS=false
STATUS_STRICT=false
STATUS_SKIP_HOST_READINESS=false
STATUS_SKIP_DNS_CHECK=false
STATUS_SKIP_SSL_CHECK=false
STATUS_SKIP_PORTS_CHECK=false
DOCS_STRICT_COVERAGE=false
DOCS_INCLUDE_COMMON=false
RUN_DOCS_CHECK=true

cleanup() {
  if [[ -n "${SEEDED_ENV_FILE}" ]] && [[ "${KEEP_SEEDED_ENV}" == false ]] && [[ -f "${SEEDED_ENV_FILE}" ]]; then
    rm -f "${SEEDED_ENV_FILE}"
    echo "[mailzen-deploy][PIPELINE-CHECK] Removed seeded env file."
  fi
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
  --seed-env)
    SEED_ENV=true
    shift
    ;;
  --keep-seeded-env)
    KEEP_SEEDED_ENV=true
    shift
    ;;
  --ports-check-ports)
    ports_check_ports_arg="${2:-}"
    if [[ -z "${ports_check_ports_arg}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --ports-check-ports requires a value."
      exit 1
    fi
    if [[ "${PORTS_CHECK_FLAG_SET}" == true ]] && [[ "${ports_check_ports_arg}" != "${PORTS_CHECK_FLAG_VALUE}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Earlier --ports-check-ports '${PORTS_CHECK_FLAG_VALUE}' overridden by --ports-check-ports '${ports_check_ports_arg}'."
    fi
    PORTS_CHECK_PORTS="${ports_check_ports_arg}"
    PORTS_CHECK_FLAG_SET=true
    PORTS_CHECK_FLAG_VALUE="${ports_check_ports_arg}"
    shift 2
    ;;
  --with-runtime-smoke)
    RUN_RUNTIME_SMOKE=true
    shift
    ;;
  --runtime-smoke-max-retries)
    runtime_smoke_max_retries_arg="${2:-}"
    if [[ -z "${runtime_smoke_max_retries_arg}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --runtime-smoke-max-retries requires a value."
      exit 1
    fi
    if [[ "${RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET}" == true ]] && [[ "${runtime_smoke_max_retries_arg}" != "${RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Earlier --runtime-smoke-max-retries '${RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE}' overridden by --runtime-smoke-max-retries '${runtime_smoke_max_retries_arg}'."
    fi
    RUNTIME_SMOKE_MAX_RETRIES="${runtime_smoke_max_retries_arg}"
    RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET=true
    RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE="${runtime_smoke_max_retries_arg}"
    shift 2
    ;;
  --runtime-smoke-retry-sleep)
    runtime_smoke_retry_sleep_arg="${2:-}"
    if [[ -z "${runtime_smoke_retry_sleep_arg}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --runtime-smoke-retry-sleep requires a value."
      exit 1
    fi
    if [[ "${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET}" == true ]] && [[ "${runtime_smoke_retry_sleep_arg}" != "${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Earlier --runtime-smoke-retry-sleep '${RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE}' overridden by --runtime-smoke-retry-sleep '${runtime_smoke_retry_sleep_arg}'."
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
  --with-build-check)
    RUN_BUILD_CHECK=true
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
  --build-check-service)
    build_check_service_arg="${2:-}"
    if [[ -z "${build_check_service_arg}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --build-check-service requires a value."
      exit 1
    fi
    BUILD_CHECK_SERVICE_ARGS+=("--service" "${build_check_service_arg}")
    BUILD_CHECK_SERVICE_FLAGS_SET=true
    shift 2
    ;;
  --build-check-image-service)
    build_check_image_service_arg="${2:-}"
    if [[ -z "${build_check_image_service_arg}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --build-check-image-service requires a value."
      exit 1
    fi
    BUILD_CHECK_IMAGE_SERVICE_ARGS+=("--image-service" "${build_check_image_service_arg}")
    BUILD_CHECK_IMAGE_SERVICE_FLAGS_SET=true
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
  --skip-docs-check)
    RUN_DOCS_CHECK=false
    shift
    ;;
  --with-verify)
    RUN_VERIFY=true
    shift
    ;;
  --verify-max-retries)
    verify_max_retries_arg="${2:-}"
    if [[ -z "${verify_max_retries_arg}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --verify-max-retries requires a value."
      exit 1
    fi
    if [[ "${VERIFY_MAX_RETRIES_FLAG_SET}" == true ]] && [[ "${verify_max_retries_arg}" != "${VERIFY_MAX_RETRIES_FLAG_VALUE}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Earlier --verify-max-retries '${VERIFY_MAX_RETRIES_FLAG_VALUE}' overridden by --verify-max-retries '${verify_max_retries_arg}'."
    fi
    VERIFY_MAX_RETRIES="${verify_max_retries_arg}"
    VERIFY_MAX_RETRIES_FLAG_SET=true
    VERIFY_MAX_RETRIES_FLAG_VALUE="${verify_max_retries_arg}"
    shift 2
    ;;
  --verify-retry-sleep)
    verify_retry_sleep_arg="${2:-}"
    if [[ -z "${verify_retry_sleep_arg}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --verify-retry-sleep requires a value."
      exit 1
    fi
    if [[ "${VERIFY_RETRY_SLEEP_FLAG_SET}" == true ]] && [[ "${verify_retry_sleep_arg}" != "${VERIFY_RETRY_SLEEP_FLAG_VALUE}" ]]; then
      echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Earlier --verify-retry-sleep '${VERIFY_RETRY_SLEEP_FLAG_VALUE}' overridden by --verify-retry-sleep '${verify_retry_sleep_arg}'."
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
  --with-status)
    RUN_STATUS=true
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
  *)
    echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][PIPELINE-CHECK][INFO] Supported flags: --seed-env --keep-seeded-env --ports-check-ports <p1,p2,...> --with-build-check --build-check-dry-run --build-check-pull --build-check-no-cache --build-check-skip-config-check --build-check-with-image-pull-check --build-check-service <name> --build-check-image-service <name> --docs-strict-coverage --docs-include-common --skip-docs-check --with-runtime-smoke --runtime-smoke-max-retries <n> --runtime-smoke-retry-sleep <n> --runtime-smoke-skip-backend-dependency-check --runtime-smoke-skip-compose-ps --runtime-smoke-dry-run --with-verify --verify-max-retries <n> --verify-retry-sleep <n> --verify-skip-ssl-check --verify-skip-oauth-check --verify-require-oauth-check --with-status --status-runtime-checks --status-strict --status-skip-host-readiness --status-skip-dns-check --status-skip-ssl-check --status-skip-ports-check"
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
  echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Docs-check-specific flags were provided while --skip-docs-check is enabled; they will be ignored."
fi

if [[ "${DOCS_INCLUDE_COMMON}" == true ]] && [[ "${DOCS_STRICT_COVERAGE}" == false ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK][WARN] --docs-include-common is most useful with --docs-strict-coverage."
fi

if [[ "${SEED_ENV}" == false ]] && [[ "${KEEP_SEEDED_ENV}" == true ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --keep-seeded-env requires --seed-env"
  exit 1
fi

if [[ "${RUN_RUNTIME_SMOKE}" == false ]] &&
  { [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]] ||
    [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]] ||
    [[ "${RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK}" == true ]] ||
    [[ "${RUNTIME_SMOKE_SKIP_COMPOSE_PS}" == true ]] ||
    [[ "${RUNTIME_SMOKE_DRY_RUN}" == true ]]; }; then
  echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Runtime-smoke-specific flags were provided without --with-runtime-smoke; they will be ignored."
fi

if [[ "${RUN_BUILD_CHECK}" == false ]] &&
  { [[ "${BUILD_CHECK_DRY_RUN}" == true ]] ||
    [[ "${BUILD_CHECK_PULL}" == true ]] ||
    [[ "${BUILD_CHECK_NO_CACHE}" == true ]] ||
    [[ "${BUILD_CHECK_SKIP_CONFIG_CHECK}" == true ]] ||
    [[ "${BUILD_CHECK_WITH_IMAGE_PULL_CHECK}" == true ]] ||
    [[ "${BUILD_CHECK_SERVICE_FLAGS_SET}" == true ]] ||
    [[ "${BUILD_CHECK_IMAGE_SERVICE_FLAGS_SET}" == true ]]; }; then
  echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Build-check-specific flags were provided without --with-build-check; they will be ignored."
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
  echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --verify-skip-oauth-check cannot be combined with --verify-require-oauth-check."
  exit 1
fi

if [[ "${RUN_VERIFY}" == false ]] &&
  { [[ -n "${VERIFY_MAX_RETRIES}" ]] ||
    [[ -n "${VERIFY_RETRY_SLEEP}" ]] ||
    [[ "${VERIFY_SKIP_SSL_CHECK}" == true ]] ||
    [[ "${VERIFY_SKIP_OAUTH_CHECK}" == true ]] ||
    [[ "${VERIFY_REQUIRE_OAUTH_CHECK}" == true ]]; }; then
  echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Verify-specific flags were provided without --with-verify; they will be ignored."
fi

if [[ "${RUN_STATUS}" == false ]] &&
  { [[ "${STATUS_RUNTIME_CHECKS}" == true ]] ||
    [[ "${STATUS_STRICT}" == true ]] ||
    [[ "${STATUS_SKIP_HOST_READINESS}" == true ]] ||
    [[ "${STATUS_SKIP_DNS_CHECK}" == true ]] ||
    [[ "${STATUS_SKIP_SSL_CHECK}" == true ]] ||
    [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; }; then
  echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Status-specific flags were provided without --with-status; they will be ignored."
fi

if [[ "${RUN_STATUS}" == true ]] && [[ "${STATUS_RUNTIME_CHECKS}" == false ]] &&
  { [[ "${STATUS_SKIP_HOST_READINESS}" == true ]] ||
    [[ "${STATUS_SKIP_DNS_CHECK}" == true ]] ||
    [[ "${STATUS_SKIP_SSL_CHECK}" == true ]] ||
    [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; }; then
  echo "[mailzen-deploy][PIPELINE-CHECK][WARN] Status runtime skip flags were provided without --status-runtime-checks; skip flags will be ignored."
fi

seed_env_file() {
  SEEDED_ENV_FILE="$(create_seeded_env_file "pipeline-check" "${DEPLOY_DIR}")"

  export MAILZEN_DEPLOY_ENV_FILE="${SEEDED_ENV_FILE}"
  echo "[mailzen-deploy][PIPELINE-CHECK] Seeded env file: ${SEEDED_ENV_FILE}"
}

echo "[mailzen-deploy][PIPELINE-CHECK] starting..."

if [[ "${SEED_ENV}" == true ]]; then
  seed_env_file
fi

echo "[mailzen-deploy][PIPELINE-CHECK] Active env file: $(get_env_file)"
echo "[mailzen-deploy][PIPELINE-CHECK] Active compose file: $(get_compose_file)"
if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK] Custom ports-check targets: ${PORTS_CHECK_PORTS}"
fi
if [[ "${RUN_BUILD_CHECK}" == true ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK] Build checks enabled."
fi
if [[ "${RUN_VERIFY}" == true ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK] Verify checks enabled."
fi
if [[ "${RUN_RUNTIME_SMOKE}" == true ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK] Runtime smoke checks enabled."
fi
if [[ "${RUN_STATUS}" == true ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK] Status checks enabled."
fi
if [[ "${RUN_DOCS_CHECK}" == false ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK] Docs-check step skipped (--skip-docs-check)."
fi

"${SCRIPT_DIR}/self-check.sh"
if [[ "${RUN_DOCS_CHECK}" == true ]]; then
  docs_check_args=()
  if [[ "${DOCS_STRICT_COVERAGE}" == true ]]; then
    docs_check_args+=(--strict-coverage)
  fi
  if [[ "${DOCS_INCLUDE_COMMON}" == true ]]; then
    docs_check_args+=(--include-common)
  fi
  "${SCRIPT_DIR}/docs-check.sh" "${docs_check_args[@]}"
fi
"${SCRIPT_DIR}/env-audit.sh"
"${SCRIPT_DIR}/preflight.sh" --config-only
"${SCRIPT_DIR}/host-readiness.sh" --min-disk-gb 1 --min-memory-mb 256 --min-cpu-cores 1
ports_check_args=()
if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  ports_check_args+=(--ports "${PORTS_CHECK_PORTS}")
fi
"${SCRIPT_DIR}/ports-check.sh" "${ports_check_args[@]}"

echo "[mailzen-deploy][PIPELINE-CHECK] rendering compose config..."
compose config >/dev/null

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
  if [[ "${BUILD_CHECK_SERVICE_FLAGS_SET}" == true ]]; then
    build_check_args+=("${BUILD_CHECK_SERVICE_ARGS[@]}")
  fi
  if [[ "${BUILD_CHECK_IMAGE_SERVICE_FLAGS_SET}" == true ]]; then
    build_check_args+=("${BUILD_CHECK_IMAGE_SERVICE_ARGS[@]}")
  fi
  echo "[mailzen-deploy][PIPELINE-CHECK] running build checks..."
  "${SCRIPT_DIR}/build-check.sh" "${build_check_args[@]}"
fi

if [[ "${RUN_VERIFY}" == true ]]; then
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
  echo "[mailzen-deploy][PIPELINE-CHECK] running verify checks..."
  "${SCRIPT_DIR}/verify.sh" "${verify_args[@]}"
fi

if [[ "${RUN_RUNTIME_SMOKE}" == true ]]; then
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
  echo "[mailzen-deploy][PIPELINE-CHECK] running runtime smoke checks..."
  "${SCRIPT_DIR}/runtime-smoke.sh" "${runtime_smoke_args[@]}"
fi

if [[ "${RUN_STATUS}" == true ]]; then
  status_args=()
  if [[ "${STATUS_RUNTIME_CHECKS}" == true ]]; then
    status_args+=(--with-runtime-checks)
    if [[ "${STATUS_SKIP_HOST_READINESS}" == true ]]; then
      status_args+=(--skip-host-readiness)
    fi
    if [[ "${STATUS_SKIP_DNS_CHECK}" == true ]]; then
      status_args+=(--skip-dns-check)
    fi
    if [[ "${STATUS_SKIP_SSL_CHECK}" == true ]]; then
      status_args+=(--skip-ssl-check)
    fi
    if [[ "${STATUS_SKIP_PORTS_CHECK}" == true ]]; then
      status_args+=(--skip-ports-check)
    fi
    if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
      status_args+=(--ports-check-ports "${PORTS_CHECK_PORTS}")
    fi
  fi
  if [[ "${STATUS_STRICT}" == true ]]; then
    status_args+=(--strict)
  fi
  echo "[mailzen-deploy][PIPELINE-CHECK] running status checks..."
  "${SCRIPT_DIR}/status.sh" "${status_args[@]}"
fi

echo "[mailzen-deploy][PIPELINE-CHECK] PASS"
