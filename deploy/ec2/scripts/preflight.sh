#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 preflight validation script
# -----------------------------------------------------------------------------
# Use this before deploy to validate:
# - required files
# - required env values and constraints
# - docker daemon availability
# - docker compose configuration rendering
# - optional runtime readiness checks (host/dns/ssl/ports)
#
# Optional flags:
#   --config-only / --skip-daemon
#   --with-runtime-checks
#   --skip-host-readiness
#   --skip-dns-check
#   --skip-ssl-check
#   --skip-ports-check
#   --ports-check-ports <p1,p2,...>
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CONFIG_ONLY=false
WITH_RUNTIME_CHECKS=false
RUN_HOST_READINESS=true
RUN_DNS_CHECK=true
RUN_SSL_CHECK=true
RUN_PORTS_CHECK=true
CONFIG_ONLY_FLAG_SET=false
WITH_RUNTIME_CHECKS_FLAG_SET=false
SKIP_HOST_READINESS_FLAG_SET=false
SKIP_DNS_CHECK_FLAG_SET=false
SKIP_SSL_CHECK_FLAG_SET=false
SKIP_PORTS_CHECK_FLAG_SET=false
PORTS_CHECK_PORTS=""
PORTS_CHECK_FLAG_SET=false
PORTS_CHECK_FLAG_VALUE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
  --config-only|--skip-daemon)
    if [[ "${CONFIG_ONLY_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --config-only/--skip-daemon flag detected; daemon check remains skipped."
    fi
    CONFIG_ONLY=true
    CONFIG_ONLY_FLAG_SET=true
    shift
    ;;
  --with-runtime-checks)
    if [[ "${WITH_RUNTIME_CHECKS_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --with-runtime-checks flag detected; runtime checks remain enabled."
    fi
    WITH_RUNTIME_CHECKS=true
    WITH_RUNTIME_CHECKS_FLAG_SET=true
    shift
    ;;
  --skip-host-readiness)
    if [[ "${SKIP_HOST_READINESS_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --skip-host-readiness flag detected; host-readiness remains skipped."
    fi
    RUN_HOST_READINESS=false
    SKIP_HOST_READINESS_FLAG_SET=true
    shift
    ;;
  --skip-dns-check)
    if [[ "${SKIP_DNS_CHECK_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --skip-dns-check flag detected; DNS check remains skipped."
    fi
    RUN_DNS_CHECK=false
    SKIP_DNS_CHECK_FLAG_SET=true
    shift
    ;;
  --skip-ssl-check)
    if [[ "${SKIP_SSL_CHECK_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --skip-ssl-check flag detected; SSL check remains skipped."
    fi
    RUN_SSL_CHECK=false
    SKIP_SSL_CHECK_FLAG_SET=true
    shift
    ;;
  --skip-ports-check)
    if [[ "${SKIP_PORTS_CHECK_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --skip-ports-check flag detected; ports check remains skipped."
    fi
    RUN_PORTS_CHECK=false
    SKIP_PORTS_CHECK_FLAG_SET=true
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
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --config-only --with-runtime-checks --skip-host-readiness --skip-dns-check --skip-ssl-check --skip-ports-check --ports-check-ports <p1,p2,...>"
    exit 1
    ;;
  esac
done

if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
  assert_ports_csv_value "--ports-check-ports" "${PORTS_CHECK_PORTS}" || exit 1
  PORTS_CHECK_PORTS="$(normalize_ports_csv "${PORTS_CHECK_PORTS}")"
fi

if [[ "${WITH_RUNTIME_CHECKS}" == false ]] &&
  { [[ "${RUN_HOST_READINESS}" == false ]] || [[ "${RUN_DNS_CHECK}" == false ]] || [[ "${RUN_SSL_CHECK}" == false ]] || [[ "${RUN_PORTS_CHECK}" == false ]]; }; then
  log_warn "Runtime-check skip flags were provided without --with-runtime-checks; they will be ignored."
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${WITH_RUNTIME_CHECKS}" == false ]]; then
  log_warn "--ports-check-ports provided without --with-runtime-checks; value will only apply when runtime checks are enabled."
fi
if [[ -n "${PORTS_CHECK_PORTS}" ]] && [[ "${WITH_RUNTIME_CHECKS}" == true ]] && [[ "${RUN_PORTS_CHECK}" == false ]]; then
  log_warn "--ports-check-ports has no effect when --skip-ports-check is enabled."
fi

log_info "Running MailZen EC2 preflight checks..."
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"
require_cmd docker
ensure_required_files_exist
validate_core_env

if [[ "${CONFIG_ONLY}" == false ]]; then
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not reachable. Start Docker and retry."
    log_error "Tip: run preflight in config-only mode: ./deploy/ec2/scripts/preflight.sh --config-only"
    exit 1
  fi
else
  log_warn "Running in config-only mode (daemon check skipped)."
fi

log_info "Command preview: $(format_command_for_logs docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" config)"
if ! compose config >/dev/null; then
  log_error "docker compose config failed. Fix env/compose and retry."
  exit 1
fi

if [[ "${WITH_RUNTIME_CHECKS}" == true ]]; then
  log_info "Running extended runtime checks (--with-runtime-checks)..."
  if [[ "${RUN_HOST_READINESS}" == true ]]; then
    log_info "Command preview: $(format_command_for_logs "${SCRIPT_DIR}/host-readiness.sh")"
    "${SCRIPT_DIR}/host-readiness.sh"
  else
    log_warn "Skipping host-readiness check (--skip-host-readiness)."
  fi

  if [[ "${RUN_DNS_CHECK}" == true ]]; then
    log_info "Command preview: $(format_command_for_logs "${SCRIPT_DIR}/dns-check.sh")"
    "${SCRIPT_DIR}/dns-check.sh"
  else
    log_warn "Skipping DNS check (--skip-dns-check)."
  fi

  if [[ "${RUN_SSL_CHECK}" == true ]]; then
    log_info "Command preview: $(format_command_for_logs "${SCRIPT_DIR}/ssl-check.sh")"
    "${SCRIPT_DIR}/ssl-check.sh"
  else
    log_warn "Skipping SSL check (--skip-ssl-check)."
  fi

  if [[ "${RUN_PORTS_CHECK}" == true ]]; then
    ports_check_args=()
    if [[ -n "${PORTS_CHECK_PORTS}" ]]; then
      ports_check_args+=(--ports "${PORTS_CHECK_PORTS}")
    fi
    log_info "Command preview: $(format_command_for_logs "${SCRIPT_DIR}/ports-check.sh" "${ports_check_args[@]}")"
    "${SCRIPT_DIR}/ports-check.sh" "${ports_check_args[@]}"
  else
    log_warn "Skipping ports check (--skip-ports-check)."
  fi
fi

log_info "Preflight checks passed."
print_service_urls
