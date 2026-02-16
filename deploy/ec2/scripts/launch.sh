#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 one-command launch script (non-technical friendly)
# -----------------------------------------------------------------------------
# Runs the full happy-path pipeline:
#   setup -> preflight -> deploy -> verify -> status
# -----------------------------------------------------------------------------

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_step() {
  local title="$1"
  shift
  echo
  echo "================================================================================"
  echo "[mailzen-deploy][LAUNCH] ${title}"
  echo "================================================================================"
  "$@"
}

if [[ ! -t 0 ]]; then
  echo "[mailzen-deploy][ERROR] launch.sh requires an interactive terminal for setup prompts."
  echo "[mailzen-deploy][INFO] Use direct scripts for automation:"
  echo "  ./deploy/ec2/scripts/preflight.sh"
  echo "  ./deploy/ec2/scripts/deploy.sh"
  echo "  ./deploy/ec2/scripts/verify.sh"
  exit 1
fi

run_step "Step 1/5: setup environment" "${SCRIPT_DIR}/setup.sh"
run_step "Step 2/5: preflight validation" "${SCRIPT_DIR}/preflight.sh"
run_step "Step 3/5: deploy stack" "${SCRIPT_DIR}/deploy.sh"
run_step "Step 4/5: verify deployment" "${SCRIPT_DIR}/verify.sh"
run_step "Step 5/5: show status" "${SCRIPT_DIR}/status.sh"

echo
echo "[mailzen-deploy][LAUNCH] MailZen launch pipeline completed successfully."
