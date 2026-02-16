#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 PostgreSQL restore script
# -----------------------------------------------------------------------------
# Restores a gzip-compressed SQL dump into the running postgres container.
#
# Usage:
#   ./deploy/ec2/scripts/restore-db.sh deploy/ec2/backups/your-backup.sql.gz
#
# WARNING:
# - This script drops and recreates the target database.
# - Existing data will be permanently removed.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  log_error "Usage: ./deploy/ec2/scripts/restore-db.sh <backup-file.sql.gz>"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  log_error "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

if [[ "${BACKUP_FILE}" != *.gz ]]; then
  log_error "Expected a .gz backup file. Received: ${BACKUP_FILE}"
  exit 1
fi

require_cmd docker
ensure_required_files_exist
validate_core_env

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not reachable. Start Docker and retry."
  exit 1
fi

db_name="$(read_env_value "POSTGRES_DB")"
db_user="$(read_env_value "POSTGRES_USER")"

log_warn "About to DROP and RESTORE database '${db_name}'."
if [[ -t 0 ]]; then
  read -r -p "Type 'RESTORE' to continue: " confirmation
else
  confirmation=""
fi

if [[ "${confirmation}" != "RESTORE" ]]; then
  log_error "Restore cancelled. Confirmation keyword not provided."
  exit 1
fi

log_info "Restoring database from backup file: ${BACKUP_FILE}"

compose exec -T postgres psql -U "${db_user}" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${db_name}' AND pid <> pg_backend_pid();" >/dev/null
compose exec -T postgres psql -U "${db_user}" -d postgres -c "DROP DATABASE IF EXISTS \"${db_name}\";"
compose exec -T postgres psql -U "${db_user}" -d postgres -c "CREATE DATABASE \"${db_name}\";"

if ! gunzip -c "${BACKUP_FILE}" | compose exec -T postgres psql -U "${db_user}" -d "${db_name}"; then
  log_error "Restore failed."
  exit 1
fi

log_info "Restore completed successfully."
