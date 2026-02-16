#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 rollback helper (latest DB backup)
# -----------------------------------------------------------------------------
# Convenience wrapper that restores the newest backup file automatically.
#
# Usage:
#   ./deploy/ec2/scripts/rollback-latest.sh
#   ./deploy/ec2/scripts/rollback-latest.sh --yes
#   ./deploy/ec2/scripts/rollback-latest.sh --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

BACKUP_DIR="${DEPLOY_DIR}/backups"
RESTORE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/restore-db.sh"
ASSUME_YES=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --yes)
    ASSUME_YES=true
    shift
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --yes --dry-run"
    exit 1
    ;;
  esac
done

if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_error "Backup directory not found: ${BACKUP_DIR}"
  exit 1
fi

latest_backup="$(ls -1t "${BACKUP_DIR}"/mailzen-*.sql.gz 2>/dev/null | awk 'NR==1 {print; exit}' || true)"
if [[ -z "${latest_backup}" ]]; then
  log_error "No backup files found in ${BACKUP_DIR}"
  exit 1
fi

log_warn "Preparing rollback using latest backup:"
log_warn "  ${latest_backup}"
log_warn "This operation is destructive and will replace current DB state."

restore_args=()
if [[ "${ASSUME_YES}" == true ]]; then
  restore_args+=(--yes)
fi
if [[ "${DRY_RUN}" == true ]]; then
  restore_args+=(--dry-run)
fi

"${RESTORE_SCRIPT}" "${restore_args[@]}" "${latest_backup}"
