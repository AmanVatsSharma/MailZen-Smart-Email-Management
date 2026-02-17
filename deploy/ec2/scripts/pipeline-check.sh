#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 deployment pipeline check
# -----------------------------------------------------------------------------
# CI-friendly validation pipeline for deployment assets.
# Does not require docker daemon (config-only checks).
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
  *)
    echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][PIPELINE-CHECK][INFO] Supported flags: --seed-env --keep-seeded-env --ports-check-ports <p1,p2,...> --with-build-check --build-check-dry-run --build-check-pull --build-check-no-cache --build-check-skip-config-check --build-check-with-image-pull-check --build-check-service <name> --build-check-image-service <name> --with-runtime-smoke --runtime-smoke-max-retries <n> --runtime-smoke-retry-sleep <n> --runtime-smoke-skip-backend-dependency-check --runtime-smoke-skip-compose-ps --runtime-smoke-dry-run"
    exit 1
    ;;
  esac
done

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
if [[ "${RUN_RUNTIME_SMOKE}" == true ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK] Runtime smoke checks enabled."
fi

"${SCRIPT_DIR}/self-check.sh"
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

echo "[mailzen-deploy][PIPELINE-CHECK] PASS"
