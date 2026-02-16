#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 backup retention script
# -----------------------------------------------------------------------------
# Deletes older DB backup files while keeping the newest N backups.
#
# Usage:
#   ./deploy/ec2/scripts/backup-prune.sh
#   ./deploy/ec2/scripts/backup-prune.sh 20
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

KEEP_COUNT="${1:-10}"
BACKUP_DIR="${DEPLOY_DIR}/backups"

if [[ ! "${KEEP_COUNT}" =~ ^[0-9]+$ ]] || [[ "${KEEP_COUNT}" -lt 1 ]]; then
  log_error "Keep count must be a positive integer (received: ${KEEP_COUNT})"
  exit 1
fi

if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_warn "Backup directory does not exist yet: ${BACKUP_DIR}"
  log_warn "Nothing to prune."
  exit 0
fi

mapfile -t backup_files < <(ls -1t "${BACKUP_DIR}"/mailzen-*.sql.gz 2>/dev/null || true)

total_count="${#backup_files[@]}"
if [[ "${total_count}" -le "${KEEP_COUNT}" ]]; then
  log_info "No prune needed. total=${total_count}, keep=${KEEP_COUNT}"
  exit 0
fi

delete_count=$((total_count - KEEP_COUNT))
log_info "Pruning old backups. total=${total_count}, keep=${KEEP_COUNT}, delete=${delete_count}"

for ((i = KEEP_COUNT; i < total_count; i++)); do
  file="${backup_files[$i]}"
  if [[ -f "${file}" ]]; then
    log_info "Deleting old backup: ${file}"
    rm -f "${file}"
  fi
done

log_info "Backup prune completed."
