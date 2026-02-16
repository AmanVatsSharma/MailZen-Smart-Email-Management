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

while [[ $# -gt 0 ]]; do
  case "$1" in
  --min-disk-gb)
    MIN_DISK_GB="${2:-}"
    if [[ -z "${MIN_DISK_GB}" ]]; then
      log_error "--min-disk-gb requires a value."
      exit 1
    fi
    shift 2
    ;;
  --min-memory-mb)
    MIN_MEMORY_MB="${2:-}"
    if [[ -z "${MIN_MEMORY_MB}" ]]; then
      log_error "--min-memory-mb requires a value."
      exit 1
    fi
    shift 2
    ;;
  --min-cpu-cores)
    MIN_CPU_CORES="${2:-}"
    if [[ -z "${MIN_CPU_CORES}" ]]; then
      log_error "--min-cpu-cores requires a value."
      exit 1
    fi
    shift 2
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --min-disk-gb <n> --min-memory-mb <n> --min-cpu-cores <n>"
    exit 1
    ;;
  esac
done

for numeric_value in "${MIN_DISK_GB}" "${MIN_MEMORY_MB}" "${MIN_CPU_CORES}"; do
  if [[ ! "${numeric_value}" =~ ^[0-9]+$ ]] || [[ "${numeric_value}" -lt 1 ]]; then
    log_error "Threshold values must be positive integers."
    exit 1
  fi
done

require_cmd df
require_cmd free
require_cmd nproc

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
