#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 backup list script
# -----------------------------------------------------------------------------
# Lists available database backups with size and timestamp.
#
# Usage:
#   ./deploy/ec2/scripts/backup-list.sh
#   ./deploy/ec2/scripts/backup-list.sh --latest
#   ./deploy/ec2/scripts/backup-list.sh --count 5
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

BACKUP_DIR="${DEPLOY_DIR}/backups"
LATEST_ONLY=false
MAX_COUNT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
  --latest)
    LATEST_ONLY=true
    shift
    ;;
  --count)
    MAX_COUNT="${2:-}"
    if [[ -z "${MAX_COUNT}" ]]; then
      log_error "--count requires a value."
      exit 1
    fi
    shift 2
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --latest --count <n>"
    exit 1
    ;;
  esac
done

if [[ -n "${MAX_COUNT}" ]] && { [[ ! "${MAX_COUNT}" =~ ^[0-9]+$ ]] || [[ "${MAX_COUNT}" -lt 1 ]]; }; then
  log_error "--count must be a positive integer (received: ${MAX_COUNT})"
  exit 1
fi

if [[ "${LATEST_ONLY}" == true ]] && [[ -n "${MAX_COUNT}" ]]; then
  log_warn "--latest overrides --count=${MAX_COUNT}; showing only the newest backup."
  MAX_COUNT="1"
fi
if [[ "${LATEST_ONLY}" == true ]] && [[ -z "${MAX_COUNT}" ]]; then
  MAX_COUNT="1"
fi

if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_warn "Backup directory does not exist yet: ${BACKUP_DIR}"
  exit 0
fi

shopt -s nullglob
backup_files=("${BACKUP_DIR}"/mailzen-*.sql.gz)
shopt -u nullglob

if [[ "${#backup_files[@]}" -eq 0 ]]; then
  log_warn "No backup files found in ${BACKUP_DIR}"
  exit 0
fi

mapfile -t sorted_backups < <(ls -1t "${backup_files[@]}" 2>/dev/null || true)

if [[ "${#sorted_backups[@]}" -eq 0 ]]; then
  log_warn "No backup files found in ${BACKUP_DIR}"
  exit 0
fi

if [[ -n "${MAX_COUNT}" ]]; then
  sorted_backups=("${sorted_backups[@]:0:${MAX_COUNT}}")
fi

echo "[mailzen-deploy][BACKUP-LIST] Available backups:"
ls -lh "${sorted_backups[@]}"
