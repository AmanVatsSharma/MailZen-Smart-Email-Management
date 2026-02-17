#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 status script
# -----------------------------------------------------------------------------
# Shows compose service status and recent container resource usage.
#
# Optional flags:
#   --strict                return non-zero when daemon is unavailable
#   --with-runtime-checks   run host/dns/ssl/ports checks
#   --with-runtime-smoke    run runtime-smoke checks after status/runtime checks
#   --skip-host-readiness
#   --skip-dns-check
#   --skip-ssl-check
#   --skip-ports-check
#   --ports-check-ports <p1,p2,...>
#   --runtime-smoke-max-retries <n>
#   --runtime-smoke-retry-sleep <n>
#   --runtime-smoke-skip-backend-dependency-check
#   --runtime-smoke-skip-compose-ps
#   --runtime-smoke-dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRICT=false
WITH_RUNTIME_CHECKS=false
WITH_RUNTIME_SMOKE=false
RUN_HOST_READINESS=true
RUN_DNS_CHECK=true
RUN_SSL_CHECK=true
RUN_PORTS_CHECK=true
PORTS_CHECK_PORTS=""
RUNTIME_SMOKE_MAX_RETRIES=""
RUNTIME_SMOKE_RETRY_SLEEP=""
RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK=false
RUNTIME_SMOKE_SKIP_COMPOSE_PS=false
RUNTIME_SMOKE_DRY_RUN=false
PORTS_CHECK_FLAG_SET=false
PORTS_CHECK_FLAG_VALUE=""
RUNTIME_SMOKE_MAX_RETRIES_FLAG_SET=false
RUNTIME_SMOKE_MAX_RETRIES_FLAG_VALUE=""
RUNTIME_SMOKE_RETRY_SLEEP_FLAG_SET=false
RUNTIME_SMOKE_RETRY_SLEEP_FLAG_VALUE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
  --strict)
    STRICT=true
    shift
    ;;
  --with-runtime-checks)
    WITH_RUNTIME_CHECKS=true
    shift
    ;;
  --with-runtime-smoke)
    WITH_RUNTIME_SMOKE=true
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
  --runtime-smoke-dry-run)
    RUNTIME_SMOKE_DRY_RUN=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --strict --with-runtime-checks --with-runtime-smoke --skip-host-readiness --skip-dns-check --skip-ssl-check --skip-ports-check --ports-check-ports <p1,p2,...> --runtime-smoke-max-retries <n> --runtime-smoke-retry-sleep <n> --runtime-smoke-skip-backend-dependency-check --runtime-smoke-skip-compose-ps --runtime-smoke-dry-run"
    exit 1
    ;;
  esac
done

if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  assert_ports_csv_value "--ports-check-ports" "${PORTS_CHECK_PORTS}" || exit 1
fi

if [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]]; then
  assert_positive_integer "--runtime-smoke-max-retries" "${RUNTIME_SMOKE_MAX_RETRIES}" || exit 1
fi
if [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]]; then
  assert_positive_integer "--runtime-smoke-retry-sleep" "${RUNTIME_SMOKE_RETRY_SLEEP}" || exit 1
fi

if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${WITH_RUNTIME_CHECKS}" == false ]]; then
  log_warn "--ports-check-ports provided without --with-runtime-checks; value will only apply when runtime checks are enabled."
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${WITH_RUNTIME_CHECKS}" == true ]] && [[ "${RUN_PORTS_CHECK}" == false ]]; then
  log_warn "--ports-check-ports has no effect when --skip-ports-check is enabled."
fi
if [[ "${WITH_RUNTIME_SMOKE}" == false ]] &&
  { [[ -n "${RUNTIME_SMOKE_MAX_RETRIES}" ]] || [[ -n "${RUNTIME_SMOKE_RETRY_SLEEP}" ]] || [[ "${RUNTIME_SMOKE_SKIP_BACKEND_DEPENDENCY_CHECK}" == true ]] || [[ "${RUNTIME_SMOKE_SKIP_COMPOSE_PS}" == true ]] || [[ "${RUNTIME_SMOKE_DRY_RUN}" == true ]]; }; then
  log_warn "Runtime-smoke flags were provided without --with-runtime-smoke; runtime-smoke flags will be ignored."
fi

log_info "Checking MailZen deployment status..."
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"
require_cmd docker
ensure_required_files_exist

daemon_available=true
if ! docker info >/dev/null 2>&1; then
  daemon_available=false
  log_warn "Docker daemon is unavailable. Showing config-only status."
  if ! compose config >/dev/null; then
    log_error "Compose config validation failed while daemon unavailable."
    exit 1
  fi
  if [[ "${STRICT}" == true ]]; then
    log_error "Strict mode enabled; failing because docker daemon is unavailable."
    exit 1
  fi
fi

if [[ "${daemon_available}" == true ]]; then
  compose ps
  log_info "Container resource snapshot (cpu/mem):"
  docker stats --no-stream \
    mailzen-caddy \
    mailzen-frontend \
    mailzen-backend \
    mailzen-ai-agent-platform \
    mailzen-postgres \
    mailzen-redis || true
fi

if [[ "${WITH_RUNTIME_CHECKS}" == true ]]; then
  log_info "Running runtime checks from status script..."
  if [[ "${RUN_HOST_READINESS}" == true ]]; then
    "${SCRIPT_DIR}/host-readiness.sh"
  else
    log_warn "Skipping host-readiness check (--skip-host-readiness)."
  fi
  if [[ "${RUN_DNS_CHECK}" == true ]]; then
    "${SCRIPT_DIR}/dns-check.sh"
  else
    log_warn "Skipping DNS check (--skip-dns-check)."
  fi
  if [[ "${RUN_SSL_CHECK}" == true ]]; then
    "${SCRIPT_DIR}/ssl-check.sh"
  else
    log_warn "Skipping SSL check (--skip-ssl-check)."
  fi
  if [[ "${RUN_PORTS_CHECK}" == true ]]; then
    ports_check_args=()
    if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
      ports_check_args+=(--ports "${PORTS_CHECK_PORTS}")
    fi
    "${SCRIPT_DIR}/ports-check.sh" "${ports_check_args[@]}"
  else
    log_warn "Skipping ports check (--skip-ports-check)."
  fi
fi

if [[ "${WITH_RUNTIME_SMOKE}" == true ]]; then
  log_info "Running runtime smoke checks from status script..."
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
  "${SCRIPT_DIR}/runtime-smoke.sh" "${runtime_smoke_args[@]}"
fi

print_service_urls
