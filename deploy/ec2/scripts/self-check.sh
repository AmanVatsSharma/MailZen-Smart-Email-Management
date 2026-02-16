#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 script self-check
# -----------------------------------------------------------------------------
# Validates deployment script syntax and executable permissions.
# Useful before committing deployment script changes.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

scripts=(
  "common.sh"
  "bootstrap-ubuntu.sh"
  "launch.sh"
  "menu.sh"
  "setup.sh"
  "preflight.sh"
  "deploy.sh"
  "update.sh"
  "verify.sh"
  "dns-check.sh"
  "ports-check.sh"
  "env-audit.sh"
  "doctor.sh"
  "self-check.sh"
  "status.sh"
  "logs.sh"
  "restart.sh"
  "stop.sh"
  "backup-db.sh"
  "backup-list.sh"
  "backup-prune.sh"
  "restore-db.sh"
  "rollback-latest.sh"
)

echo "[mailzen-deploy][SELF-CHECK] starting..."

for script in "${scripts[@]}"; do
  script_path="${SCRIPT_DIR}/${script}"
  if [[ ! -f "${script_path}" ]]; then
    echo "[mailzen-deploy][SELF-CHECK][ERROR] missing script: ${script_path}" >&2
    exit 1
  fi

  if [[ ! -x "${script_path}" ]]; then
    # common.sh is sourced and does not need execute bit.
    if [[ "${script}" != "common.sh" ]]; then
      echo "[mailzen-deploy][SELF-CHECK][ERROR] script not executable: ${script_path}" >&2
      exit 1
    fi
  fi

  if ! bash -n "${script_path}"; then
    echo "[mailzen-deploy][SELF-CHECK][ERROR] syntax check failed: ${script_path}" >&2
    exit 1
  fi
  echo "[mailzen-deploy][SELF-CHECK][OK] ${script}"
done

echo "[mailzen-deploy][SELF-CHECK] all checks passed."
