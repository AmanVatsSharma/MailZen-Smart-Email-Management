#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 PostgreSQL restore script
# -----------------------------------------------------------------------------
# Restores a gzip-compressed SQL dump into the running postgres container.
#
# Usage:
#   ./deploy/ec2/scripts/restore-db.sh deploy/ec2/backups/your-backup.sql.gz
#   ./deploy/ec2/scripts/restore-db.sh --yes deploy/ec2/backups/your-backup.sql.gz
#   ./deploy/ec2/scripts/restore-db.sh --dry-run deploy/ec2/backups/your-backup.sql.gz
#
# WARNING:
# - This script drops and recreates the target database.
# - Existing data will be permanently removed.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

BACKUP_FILE=""
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
  --*)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --yes --dry-run <backup-file.sql.gz>"
    exit 1
    ;;
  *)
    if [[ -n "${BACKUP_FILE}" ]]; then
      log_error "Only one backup file may be provided."
      exit 1
    fi
    BACKUP_FILE="$1"
    shift
    ;;
  esac
done

if [[ -z "${BACKUP_FILE}" ]]; then
  log_error "Usage: ./deploy/ec2/scripts/restore-db.sh [--yes] [--dry-run] <backup-file.sql.gz>"
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

db_name="$(read_env_value "POSTGRES_DB")"
db_user="$(read_env_value "POSTGRES_USER")"

log_warn "About to DROP and RESTORE database '${db_name}'."

if [[ "${DRY_RUN}" == true ]]; then
  log_info "Dry-run enabled; restore command not executed."
  log_info "Would restore backup: ${BACKUP_FILE}"
  log_info "Would recreate database '${db_name}' as user '${db_user}'."
  exit 0
fi

if [[ "${ASSUME_YES}" == false ]]; then
  if [[ -t 0 ]]; then
    read -r -p "Type 'RESTORE' to continue: " confirmation
  else
    log_error "Non-interactive restore requires --yes."
    exit 1
  fi

  if [[ "${confirmation}" != "RESTORE" ]]; then
    log_error "Restore cancelled. Confirmation keyword not provided."
    exit 1
  fi
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not reachable. Start Docker and retry."
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
