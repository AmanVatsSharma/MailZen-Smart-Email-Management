#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 diagnostics report retention script
# -----------------------------------------------------------------------------
# Deletes older doctor/support bundle artifacts while keeping latest N items.
# Also prunes extracted support-bundle directories from older runs.
#
# Usage:
#   ./deploy/ec2/scripts/reports-prune.sh
#   ./deploy/ec2/scripts/reports-prune.sh 20
#   ./deploy/ec2/scripts/reports-prune.sh --keep-count 20 --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

KEEP_COUNT="20"
REPORT_DIR="${DEPLOY_DIR}/reports"
DRY_RUN=false

if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  KEEP_COUNT="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
  --keep-count)
    KEEP_COUNT="${2:-}"
    if [[ -z "${KEEP_COUNT}" ]]; then
      log_error "--keep-count requires a value."
      exit 1
    fi
    shift 2
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: [keep-count] --keep-count <n> --dry-run"
    exit 1
    ;;
  esac
done

if [[ ! "${KEEP_COUNT}" =~ ^[0-9]+$ ]] || [[ "${KEEP_COUNT}" -lt 1 ]]; then
  log_error "Keep count must be a positive integer (received: ${KEEP_COUNT})"
  exit 1
fi

if [[ ! -d "${REPORT_DIR}" ]]; then
  log_warn "Reports directory does not exist: ${REPORT_DIR}"
  log_warn "Nothing to prune."
  exit 0
fi

report_candidates=()
shopt -s nullglob
for candidate in "${REPORT_DIR}"/doctor-*.log "${REPORT_DIR}"/support-bundle-*.tar.gz "${REPORT_DIR}"/support-bundle-*; do
  if [[ -f "${candidate}" ]] || [[ -d "${candidate}" ]]; then
    report_candidates+=("${candidate}")
  fi
done
shopt -u nullglob

if [[ "${#report_candidates[@]}" -eq 0 ]]; then
  log_info "No report artifacts found to prune."
  exit 0
fi

declare -A seen_reports=()
unique_reports=()
for candidate in "${report_candidates[@]}"; do
  if [[ -z "${seen_reports[$candidate]+x}" ]]; then
    unique_reports+=("${candidate}")
    seen_reports["${candidate}"]=1
  fi
done

mapfile -t report_files < <(ls -1dt "${unique_reports[@]}" 2>/dev/null || true)

total_count="${#report_files[@]}"
if [[ "${total_count}" -le "${KEEP_COUNT}" ]]; then
  log_info "No report prune needed. total=${total_count}, keep=${KEEP_COUNT}"
  exit 0
fi

delete_count=$((total_count - KEEP_COUNT))
log_info "Pruning old reports. total=${total_count}, keep=${KEEP_COUNT}, delete=${delete_count}"

for ((i = KEEP_COUNT; i < total_count; i++)); do
  file="${report_files[$i]}"
  if [[ -f "${file}" ]]; then
    if [[ "${DRY_RUN}" == true ]]; then
      log_info "Dry-run: would delete old report artifact: ${file}"
    else
      log_info "Deleting old report artifact: ${file}"
      rm -f "${file}"
    fi
  elif [[ -d "${file}" ]]; then
    if [[ "${DRY_RUN}" == true ]]; then
      log_info "Dry-run: would delete old report directory: ${file}"
    else
      log_info "Deleting old report directory: ${file}"
      rm -rf "${file}"
    fi
  fi
done

if [[ "${DRY_RUN}" == true ]]; then
  log_info "Report prune dry-run completed."
else
  log_info "Report prune completed."
fi
