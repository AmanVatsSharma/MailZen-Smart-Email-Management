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

prompt_with_default() {
  local prompt_text="$1"
  local default_value="$2"
  local input=""
  if [[ -n "${default_value}" ]]; then
    read -r -p "${prompt_text} [${default_value}]: " input
  else
    read -r -p "${prompt_text}: " input
  fi
  echo "${input:-${default_value}}"
}

prompt_yes_no() {
  local prompt_text="$1"
  local default_choice="${2:-no}"
  local default_hint="y/N"
  if [[ "${default_choice}" == "yes" ]]; then
    default_hint="Y/n"
  fi

  local input=""
  read -r -p "${prompt_text} (${default_hint}): " input
  input="$(printf '%s' "${input:-}" | tr '[:upper:]' '[:lower:]')"
  if [[ -z "${input}" ]]; then
    input="${default_choice}"
  fi

  if [[ "${input}" == "y" ]] || [[ "${input}" == "yes" ]]; then
    return 0
  fi
  return 1
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
9) Update stack (pull + recreate + verify)
10) Backup database
11) List backups (optional latest/count filters)
12) Prune old backups (prompt keep-count + dry-run)
13) Rollback DB using latest backup (optional label/dry-run)
14) DNS readiness check
15) SSL certificate check
16) Host readiness check (disk/memory/cpu)
17) Host ports check (80/443)
18) Environment audit (redacted)
19) Run diagnostics report (doctor)
20) Generate support bundle
21) Rotate app secrets (prompt keys/dry-run)
22) Run pipeline check (config-only)
23) Prune old diagnostics reports (keep latest 20)
24) Show command help
25) Run script self-check
26) Launch config-only dry-run validation
27) Verify deployment (skip oauth + ssl checks)
28) Run diagnostics report (doctor, seeded env)
29) Generate support bundle (seeded env)
30) Run pipeline check (seeded env)
31) Exit
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
  read -r -p "Select an option [1-31]: " choice

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
    backup_label="$(prompt_with_default "Backup label" "manual")"
    backup_args=(--label "${backup_label}")
    if prompt_yes_no "Run backup in dry-run mode" "no"; then
      backup_args+=(--dry-run)
    fi
    run_step "backup-db.sh" "${backup_args[@]}"
    ;;
  11)
    backup_list_args=()
    if prompt_yes_no "Show only latest backup" "no"; then
      backup_list_args+=(--latest)
    else
      backup_count="$(prompt_with_default "How many latest backups to show (leave as 0 for all)" "0")"
      if [[ "${backup_count}" =~ ^[0-9]+$ ]] && [[ "${backup_count}" -gt 0 ]]; then
        backup_list_args+=(--count "${backup_count}")
      fi
    fi
    run_step "backup-list.sh" "${backup_list_args[@]}"
    ;;
  12)
    prune_keep_count="$(prompt_with_default "Keep latest backups count" "10")"
    backup_prune_args=(--keep-count "${prune_keep_count}")
    if prompt_yes_no "Run prune in dry-run mode" "yes"; then
      backup_prune_args+=(--dry-run)
    fi
    run_step "backup-prune.sh" "${backup_prune_args[@]}"
    ;;
  13)
    rollback_args=()
    rollback_label="$(prompt_with_default "Rollback label filter (blank for any)" "")"
    if [[ -n "${rollback_label}" ]]; then
      rollback_args+=(--label "${rollback_label}")
    fi
    if prompt_yes_no "Run rollback in dry-run mode" "yes"; then
      rollback_args+=(--dry-run)
    fi
    if prompt_yes_no "Bypass restore confirmation with --yes" "no"; then
      rollback_args+=(--yes)
    fi
    run_step "rollback-latest.sh" "${rollback_args[@]}"
    ;;
  14)
    run_step "dns-check.sh"
    ;;
  15)
    run_step "ssl-check.sh"
    ;;
  16)
    run_step "host-readiness.sh"
    ;;
  17)
    run_step "ports-check.sh"
    ;;
  18)
    run_step "env-audit.sh"
    ;;
  19)
    run_step "doctor.sh"
    ;;
  20)
    run_step "support-bundle.sh"
    ;;
  21)
    rotate_args=()
    rotate_keys="$(prompt_with_default "Rotate keys (all or comma-separated: JWT_SECRET,OAUTH_STATE_SECRET,AI_AGENT_PLATFORM_KEY)" "all")"
    if [[ "${rotate_keys}" != "all" ]]; then
      rotate_args+=(--keys "${rotate_keys}")
    fi
    if prompt_yes_no "Run secret rotation in dry-run mode" "yes"; then
      rotate_args+=(--dry-run)
    fi
    if prompt_yes_no "Bypass confirmation prompt with --yes" "no"; then
      rotate_args+=(--yes)
    fi
    run_step "rotate-app-secrets.sh" "${rotate_args[@]}"
    ;;
  22)
    run_step "pipeline-check.sh"
    ;;
  23)
    reports_keep_count="$(prompt_with_default "Keep latest report artifacts count" "20")"
    reports_prune_args=(--keep-count "${reports_keep_count}")
    if prompt_yes_no "Run report prune in dry-run mode" "yes"; then
      reports_prune_args+=(--dry-run)
    fi
    run_step "reports-prune.sh" "${reports_prune_args[@]}"
    ;;
  24)
    run_step "help.sh"
    ;;
  25)
    run_step "self-check.sh"
    ;;
  26)
    run_step "launch.sh" --skip-setup --skip-dns-check --skip-ssl-check --preflight-config-only --deploy-dry-run --skip-verify
    ;;
  27)
    run_step "verify.sh" --skip-oauth-check --skip-ssl-check
    ;;
  28)
    run_step "doctor.sh" --seed-env
    ;;
  29)
    run_step "support-bundle.sh" --seed-env
    ;;
  30)
    run_step "pipeline-check.sh" --seed-env
    ;;
  31)
    echo "[mailzen-deploy][INFO] Exiting menu."
    exit 0
    ;;
  *)
    echo "[mailzen-deploy][WARN] Invalid option '${choice}'. Please choose 1-31."
    ;;
  esac
done
