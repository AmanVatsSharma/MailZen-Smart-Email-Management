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
#   ./deploy/ec2/scripts/rollback-latest.sh --label before-release --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

BACKUP_DIR="${DEPLOY_DIR}/backups"
RESTORE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/restore-db.sh"
ASSUME_YES=false
DRY_RUN=false
LABEL_FILTER=""

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
    log_error "Supported flags: --yes --dry-run --label <name>"
    exit 1
    ;;
  esac
done

if [[ -n "${LABEL_FILTER}" ]]; then
  assert_safe_label "Label filter" "${LABEL_FILTER}" || exit 1
fi

if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_error "Backup directory not found: ${BACKUP_DIR}"
  exit 1
fi

shopt -s nullglob
if [[ -n "${LABEL_FILTER}" ]]; then
  backup_candidates=("${BACKUP_DIR}/mailzen-${LABEL_FILTER}-"*.sql.gz)
else
  backup_candidates=("${BACKUP_DIR}/mailzen-"*.sql.gz)
fi
shopt -u nullglob

if [[ "${#backup_candidates[@]}" -eq 0 ]]; then
  if [[ -n "${LABEL_FILTER}" ]]; then
    log_error "No backup files found for label '${LABEL_FILTER}' in ${BACKUP_DIR}"
  else
    log_error "No backup files found in ${BACKUP_DIR}"
  fi
  exit 1
fi

latest_backup="$(ls -1t "${backup_candidates[@]}" 2>/dev/null | awk 'NR==1 {print; exit}' || true)"
if [[ -z "${latest_backup}" ]]; then
  if [[ -n "${LABEL_FILTER}" ]]; then
    log_error "No backup files found for label '${LABEL_FILTER}' in ${BACKUP_DIR}"
  else
    log_error "No backup files found in ${BACKUP_DIR}"
  fi
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
