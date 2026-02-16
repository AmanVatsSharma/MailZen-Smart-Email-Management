#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 operator menu (non-technical helper)
# -----------------------------------------------------------------------------
# Interactive wrapper around deployment scripts.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_step() {
  local script_name="$1"
  shift || true
  echo
  echo "--------------------------------------------------------------------------------"
  echo "[mailzen-deploy][MENU] Running ${script_name} $*"
  echo "--------------------------------------------------------------------------------"
  "${SCRIPT_DIR}/${script_name}" "$@"
  echo
}

show_menu() {
  cat <<'MENU'
=========================== MailZen EC2 Operator Menu ==========================
1) One-command launch (setup + preflight + deploy + verify + status)
2) Bootstrap Docker on Ubuntu (run with sudo)
3) Setup environment (.env.ec2)
4) Preflight checks
5) Deploy stack
6) Verify deployment (smoke checks)
7) Show status
8) Show logs (all services)
9) Update stack (pull + recreate)
10) Backup database
11) DNS readiness check
12) Run script self-check
13) Exit
===============================================================================
MENU
}

if [[ ! -t 0 ]]; then
  echo "[mailzen-deploy][ERROR] menu.sh requires an interactive terminal."
  echo "[mailzen-deploy][INFO] Use direct scripts under deploy/ec2/scripts for automation."
  exit 1
fi

while true; do
  show_menu
  read -r -p "Select an option [1-13]: " choice

  case "${choice}" in
  1)
    run_step "launch.sh"
    ;;
  2)
    run_step "bootstrap-ubuntu.sh"
    ;;
  3)
    run_step "setup.sh"
    ;;
  4)
    run_step "preflight.sh"
    ;;
  5)
    run_step "deploy.sh"
    ;;
  6)
    run_step "verify.sh"
    ;;
  7)
    run_step "status.sh"
    ;;
  8)
    run_step "logs.sh"
    ;;
  9)
    run_step "update.sh"
    ;;
  10)
    run_step "backup-db.sh"
    ;;
  11)
    run_step "dns-check.sh"
    ;;
  12)
    run_step "self-check.sh"
    ;;
  13)
    echo "[mailzen-deploy][INFO] Exiting menu."
    exit 0
    ;;
  *)
    echo "[mailzen-deploy][WARN] Invalid option '${choice}'. Please choose 1-13."
    ;;
  esac
done
