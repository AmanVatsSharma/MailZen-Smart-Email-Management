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
ASSUME_YES_FLAG_SET=false
DRY_RUN_FLAG_SET=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --yes)
    if [[ "${ASSUME_YES_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --yes flag detected; restore confirmation override remains enabled."
    fi
    ASSUME_YES=true
    ASSUME_YES_FLAG_SET=true
    shift
    ;;
  --dry-run)
    if [[ "${DRY_RUN_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --dry-run flag detected; restore execution remains disabled."
    fi
    DRY_RUN=true
    DRY_RUN_FLAG_SET=true
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

if [[ "${DRY_RUN}" == true ]] && [[ "${ASSUME_YES}" == true ]]; then
  log_warn "--yes has no effect in --dry-run mode."
fi

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
require_cmd gzip
ensure_required_files_exist
validate_core_env
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

if ! gzip -t "${BACKUP_FILE}" >/dev/null 2>&1; then
  log_error "Backup archive integrity check failed (gzip -t): ${BACKUP_FILE}"
  exit 1
fi

db_name="$(read_env_value "POSTGRES_DB")"
db_user="$(read_env_value "POSTGRES_USER")"

log_warn "About to DROP and RESTORE database '${db_name}'."
terminate_connections_cmd=(docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" exec -T postgres psql -U "${db_user}" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${db_name}' AND pid <> pg_backend_pid();")
drop_database_cmd=(docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" exec -T postgres psql -U "${db_user}" -d postgres -c "DROP DATABASE IF EXISTS \"${db_name}\";")
create_database_cmd=(docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" exec -T postgres psql -U "${db_user}" -d postgres -c "CREATE DATABASE \"${db_name}\";")
restore_stream_cmd=(docker compose --env-file "$(get_env_file)" -f "$(get_compose_file)" exec -T postgres psql -U "${db_user}" -d "${db_name}")
restore_pipeline_preview="gunzip -c $(printf '%q' "${BACKUP_FILE}") | $(format_command_for_logs "${restore_stream_cmd[@]}")"

if [[ "${DRY_RUN}" == true ]]; then
  log_info "Dry-run enabled; restore command not executed."
  log_info "Command preview: $(format_command_for_logs "${terminate_connections_cmd[@]}")"
  log_info "Command preview: $(format_command_for_logs "${drop_database_cmd[@]}")"
  log_info "Command preview: $(format_command_for_logs "${create_database_cmd[@]}")"
  log_info "Command preview: ${restore_pipeline_preview}"
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
  log_docker_daemon_unreachable
  exit 1
fi

log_info "Restoring database from backup file: ${BACKUP_FILE}"
log_info "Command preview: $(format_command_for_logs "${terminate_connections_cmd[@]}")"
log_info "Command preview: $(format_command_for_logs "${drop_database_cmd[@]}")"
log_info "Command preview: $(format_command_for_logs "${create_database_cmd[@]}")"
log_info "Command preview: ${restore_pipeline_preview}"

"${terminate_connections_cmd[@]}" >/dev/null
"${drop_database_cmd[@]}"
"${create_database_cmd[@]}"

if ! gunzip -c "${BACKUP_FILE}" | "${restore_stream_cmd[@]}"; then
  log_error "Restore failed."
  exit 1
fi

log_info "Restore completed successfully."
