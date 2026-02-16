#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 backup list script
# -----------------------------------------------------------------------------
# Lists available database backups with size and timestamp.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

BACKUP_DIR="${DEPLOY_DIR}/backups"

if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_warn "Backup directory does not exist yet: ${BACKUP_DIR}"
  exit 0
fi

echo "[mailzen-deploy][BACKUP-LIST] Available backups:"
ls -lh "${BACKUP_DIR}"/mailzen-*.sql.gz 2>/dev/null || {
  log_warn "No backup files found in ${BACKUP_DIR}"
  exit 0
}
