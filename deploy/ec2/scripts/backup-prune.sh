#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 backup retention script
# -----------------------------------------------------------------------------
# Deletes older DB backup files while keeping the newest N backups.
#
# Usage:
#   ./deploy/ec2/scripts/backup-prune.sh
#   ./deploy/ec2/scripts/backup-prune.sh 20
#   ./deploy/ec2/scripts/backup-prune.sh --keep-count 20 --dry-run
#   ./deploy/ec2/scripts/backup-prune.sh --label before-release --keep-count 5 --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

KEEP_COUNT="10"
BACKUP_DIR="${DEPLOY_DIR}/backups"
DRY_RUN=false
LABEL_FILTER=""

if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
  KEEP_COUNT="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
  --keep-count)
    KEEP_COUNT="${2:-}"
    if [[ -z "${KEEP_COUNT}" ]]; then
      log_error "--keep-count requires a value."
      exit 1
    fi
    shift 2
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  --label)
    LABEL_FILTER="${2:-}"
    if [[ -z "${LABEL_FILTER}" ]]; then
      log_error "--label requires a value."
      exit 1
    fi
    shift 2
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: [keep-count] --keep-count <n> --dry-run --label <name>"
    exit 1
    ;;
  esac
done

if [[ ! "${KEEP_COUNT}" =~ ^[0-9]+$ ]] || [[ "${KEEP_COUNT}" -lt 1 ]]; then
  log_error "Keep count must be a positive integer (received: ${KEEP_COUNT})"
  exit 1
fi

if [[ -n "${LABEL_FILTER}" ]]; then
  assert_safe_label "Label filter" "${LABEL_FILTER}" || exit 1
fi

log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_warn "Backup directory does not exist yet: ${BACKUP_DIR}."
  log_warn "Nothing to prune."
  exit 0
fi

shopt -s nullglob
if [[ -n "${LABEL_FILTER}" ]]; then
  backup_glob=("${BACKUP_DIR}/mailzen-${LABEL_FILTER}-"*.sql.gz)
else
  backup_glob=("${BACKUP_DIR}/mailzen-"*.sql.gz)
fi
shopt -u nullglob

if [[ "${#backup_glob[@]}" -eq 0 ]]; then
  if [[ -n "${LABEL_FILTER}" ]]; then
    log_info "No backups found for label '${LABEL_FILTER}'; nothing to prune."
  else
    log_info "No backups found; nothing to prune."
  fi
  exit 0
fi

mapfile -t backup_files < <(ls -1t "${backup_glob[@]}" 2>/dev/null || true)

total_count="${#backup_files[@]}"
if [[ "${total_count}" -le "${KEEP_COUNT}" ]]; then
  if [[ -n "${LABEL_FILTER}" ]]; then
    log_info "No prune needed for label '${LABEL_FILTER}'. total=${total_count}, keep=${KEEP_COUNT}"
  else
    log_info "No prune needed. total=${total_count}, keep=${KEEP_COUNT}"
  fi
  exit 0
fi

delete_count=$((total_count - KEEP_COUNT))
if [[ -n "${LABEL_FILTER}" ]]; then
  log_info "Pruning old backups for label '${LABEL_FILTER}'. total=${total_count}, keep=${KEEP_COUNT}, delete=${delete_count}"
else
  log_info "Pruning old backups. total=${total_count}, keep=${KEEP_COUNT}, delete=${delete_count}"
fi

for ((i = KEEP_COUNT; i < total_count; i++)); do
  file="${backup_files[$i]}"
  if [[ -f "${file}" ]]; then
    if [[ "${DRY_RUN}" == true ]]; then
      log_info "Dry-run: would delete old backup: ${file}"
    else
      log_info "Deleting old backup: ${file}"
      rm -f "${file}"
    fi
  fi
done

if [[ "${DRY_RUN}" == true ]]; then
  log_info "Backup prune dry-run completed."
else
  log_info "Backup prune completed."
fi
