#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 PostgreSQL backup script
# -----------------------------------------------------------------------------
# Creates a compressed SQL dump from the running postgres container.
#
# Usage:
#   ./deploy/ec2/scripts/backup-db.sh
#   ./deploy/ec2/scripts/backup-db.sh custom-label
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

LABEL="${1:-manual}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${DEPLOY_DIR}/backups"
BACKUP_FILE="${BACKUP_DIR}/mailzen-${LABEL}-${TIMESTAMP}.sql.gz"

require_cmd docker
ensure_required_files_exist
validate_core_env

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not reachable. Start Docker and retry."
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

db_name="$(read_env_value "POSTGRES_DB")"
db_user="$(read_env_value "POSTGRES_USER")"

log_info "Creating PostgreSQL backup..."
log_info "Backup file: ${BACKUP_FILE}"

if ! compose exec -T postgres pg_dump -U "${db_user}" "${db_name}" | gzip >"${BACKUP_FILE}"; then
  log_error "Backup failed. Removing partial backup file."
  rm -f "${BACKUP_FILE}"
  exit 1
fi

log_info "Backup completed successfully."
log_info "Saved: ${BACKUP_FILE}"
