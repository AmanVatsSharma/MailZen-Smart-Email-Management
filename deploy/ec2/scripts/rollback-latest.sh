#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 rollback helper (latest DB backup)
# -----------------------------------------------------------------------------
# Convenience wrapper that restores the newest backup file automatically.
#
# Usage:
#   ./deploy/ec2/scripts/rollback-latest.sh
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

BACKUP_DIR="${DEPLOY_DIR}/backups"
RESTORE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/restore-db.sh"

if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_error "Backup directory not found: ${BACKUP_DIR}"
  exit 1
fi

latest_backup="$(ls -1t "${BACKUP_DIR}"/mailzen-*.sql.gz 2>/dev/null | head -n 1 || true)"
if [[ -z "${latest_backup}" ]]; then
  log_error "No backup files found in ${BACKUP_DIR}"
  exit 1
fi

log_warn "Preparing rollback using latest backup:"
log_warn "  ${latest_backup}"
log_warn "This operation is destructive and will replace current DB state."

"${RESTORE_SCRIPT}" "${latest_backup}"
