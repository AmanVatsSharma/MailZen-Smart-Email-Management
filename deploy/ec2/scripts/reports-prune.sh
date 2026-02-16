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
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

KEEP_COUNT="${1:-20}"
REPORT_DIR="${DEPLOY_DIR}/reports"

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

mapfile -t report_files < <(printf '%s\n' "${report_candidates[@]}" | awk '!seen[$0]++' | xargs ls -1dt 2>/dev/null || true)

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
    log_info "Deleting old report artifact: ${file}"
    rm -f "${file}"
  elif [[ -d "${file}" ]]; then
    log_info "Deleting old report directory: ${file}"
    rm -rf "${file}"
  fi
done

log_info "Report prune completed."
