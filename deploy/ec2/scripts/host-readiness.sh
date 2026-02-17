#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 host readiness check
# -----------------------------------------------------------------------------
# Validates baseline host resources before deployment.
#
# Checks:
# - available root filesystem space
# - available memory
# - CPU core count
#
# Usage:
#   ./deploy/ec2/scripts/host-readiness.sh
#   ./deploy/ec2/scripts/host-readiness.sh --min-disk-gb 20 --min-memory-mb 4096 --min-cpu-cores 4
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

MIN_DISK_GB=10
MIN_MEMORY_MB=2048
MIN_CPU_CORES=2
MIN_DISK_FLAG_SET=false
MIN_DISK_FLAG_VALUE=""
MIN_MEMORY_FLAG_SET=false
MIN_MEMORY_FLAG_VALUE=""
MIN_CPU_FLAG_SET=false
MIN_CPU_FLAG_VALUE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
  --min-disk-gb)
    min_disk_arg="${2:-}"
    if [[ -z "${min_disk_arg}" ]]; then
      log_error "--min-disk-gb requires a value."
      exit 1
    fi
    if [[ "${MIN_DISK_FLAG_SET}" == true ]] && [[ "${min_disk_arg}" != "${MIN_DISK_FLAG_VALUE}" ]]; then
      log_warn "Earlier --min-disk-gb '${MIN_DISK_FLAG_VALUE}' overridden by --min-disk-gb '${min_disk_arg}'."
    fi
    MIN_DISK_GB="${min_disk_arg}"
    MIN_DISK_FLAG_SET=true
    MIN_DISK_FLAG_VALUE="${min_disk_arg}"
    shift 2
    ;;
  --min-memory-mb)
    min_memory_arg="${2:-}"
    if [[ -z "${min_memory_arg}" ]]; then
      log_error "--min-memory-mb requires a value."
      exit 1
    fi
    if [[ "${MIN_MEMORY_FLAG_SET}" == true ]] && [[ "${min_memory_arg}" != "${MIN_MEMORY_FLAG_VALUE}" ]]; then
      log_warn "Earlier --min-memory-mb '${MIN_MEMORY_FLAG_VALUE}' overridden by --min-memory-mb '${min_memory_arg}'."
    fi
    MIN_MEMORY_MB="${min_memory_arg}"
    MIN_MEMORY_FLAG_SET=true
    MIN_MEMORY_FLAG_VALUE="${min_memory_arg}"
    shift 2
    ;;
  --min-cpu-cores)
    min_cpu_arg="${2:-}"
    if [[ -z "${min_cpu_arg}" ]]; then
      log_error "--min-cpu-cores requires a value."
      exit 1
    fi
    if [[ "${MIN_CPU_FLAG_SET}" == true ]] && [[ "${min_cpu_arg}" != "${MIN_CPU_FLAG_VALUE}" ]]; then
      log_warn "Earlier --min-cpu-cores '${MIN_CPU_FLAG_VALUE}' overridden by --min-cpu-cores '${min_cpu_arg}'."
    fi
    MIN_CPU_CORES="${min_cpu_arg}"
    MIN_CPU_FLAG_SET=true
    MIN_CPU_FLAG_VALUE="${min_cpu_arg}"
    shift 2
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --min-disk-gb <n> --min-memory-mb <n> --min-cpu-cores <n>"
    exit 1
    ;;
  esac
done

assert_positive_integer "--min-disk-gb" "${MIN_DISK_GB}" || exit 1
assert_positive_integer "--min-memory-mb" "${MIN_MEMORY_MB}" || exit 1
assert_positive_integer "--min-cpu-cores" "${MIN_CPU_CORES}" || exit 1

require_cmd df
require_cmd free
require_cmd nproc
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

available_disk_gb="$(df -BG / | awk 'NR==2 {gsub(/G/,"",$4); print $4}')"
available_memory_mb="$(free -m | awk '/^Mem:/ {print $7}')"
cpu_cores="$(nproc)"

if [[ -z "${available_disk_gb}" || -z "${available_memory_mb}" || -z "${cpu_cores}" ]]; then
  log_error "Unable to collect host readiness metrics."
  exit 1
fi

log_info "Host readiness metrics:"
log_info "  available_disk_gb=${available_disk_gb} (required>=${MIN_DISK_GB})"
log_info "  available_memory_mb=${available_memory_mb} (required>=${MIN_MEMORY_MB})"
log_info "  cpu_cores=${cpu_cores} (required>=${MIN_CPU_CORES})"

failure_count=0

if [[ "${available_disk_gb}" -lt "${MIN_DISK_GB}" ]]; then
  log_error "Insufficient disk space. Required>=${MIN_DISK_GB}GB, available=${available_disk_gb}GB."
  failure_count=$((failure_count + 1))
fi

if [[ "${available_memory_mb}" -lt "${MIN_MEMORY_MB}" ]]; then
  log_error "Insufficient memory. Required>=${MIN_MEMORY_MB}MB, available=${available_memory_mb}MB."
  failure_count=$((failure_count + 1))
fi

if [[ "${cpu_cores}" -lt "${MIN_CPU_CORES}" ]]; then
  log_error "Insufficient CPU cores. Required>=${MIN_CPU_CORES}, available=${cpu_cores}."
  failure_count=$((failure_count + 1))
fi

if [[ "${failure_count}" -gt 0 ]]; then
  log_error "Host readiness check failed with ${failure_count} issue(s)."
  exit 1
fi

log_info "Host readiness check passed."
