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
1) Bootstrap Docker on Ubuntu (run with sudo)
2) Setup environment (.env.ec2)
3) Preflight checks
4) Deploy stack
5) Verify deployment (smoke checks)
6) Show status
7) Show logs (all services)
8) Update stack (pull + recreate)
9) Exit
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
  read -r -p "Select an option [1-9]: " choice

  case "${choice}" in
  1)
    run_step "bootstrap-ubuntu.sh"
    ;;
  2)
    run_step "setup.sh"
    ;;
  3)
    run_step "preflight.sh"
    ;;
  4)
    run_step "deploy.sh"
    ;;
  5)
    run_step "verify.sh"
    ;;
  6)
    run_step "status.sh"
    ;;
  7)
    run_step "logs.sh"
    ;;
  8)
    run_step "update.sh"
    ;;
  9)
    echo "[mailzen-deploy][INFO] Exiting menu."
    exit 0
    ;;
  *)
    echo "[mailzen-deploy][WARN] Invalid option '${choice}'. Please choose 1-9."
    ;;
  esac
done
