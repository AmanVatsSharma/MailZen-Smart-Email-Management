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
1) One-command launch (fully guided)
2) Bootstrap Docker on Ubuntu (run with sudo)
3) Setup environment (.env.ec2, guided overrides)
4) Preflight checks (prompt runtime + skip options)
5) Deploy stack (guided flags)
6) Verify deployment (guided checks)
7) Show status (prompt runtime/strict/skip options)
8) Show logs (guided filters)
9) Update stack (fully guided)
10) Backup database
11) List backups (optional latest/count filters)
12) Prune old backups (prompt keep-count + dry-run)
13) Rollback DB using latest backup (optional label/dry-run)
14) DNS readiness check
15) SSL certificate check
16) Host readiness check (disk/memory/cpu)
17) Host ports check (custom ports)
18) Environment audit (redacted)
19) Run diagnostics report (doctor, optional custom ports)
20) Generate support bundle (optional custom ports)
21) Rotate app secrets (prompt keys/dry-run)
22) Run pipeline check (config-only, optional custom ports)
23) Prune old diagnostics reports (keep latest 20)
24) Show command help
25) Run script self-check
26) Launch config-only dry-run validation (skip status)
27) Verify deployment (skip oauth + ssl checks)
28) Run diagnostics report (doctor, seeded env, optional custom ports)
29) Generate support bundle (seeded env, optional custom ports)
30) Run pipeline check (seeded env, optional custom ports)
31) Restart services (guided)
32) Stop stack (guided)
33) Exit
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
  read -r -p "Select an option [1-33]: " choice

  case "${choice}" in
  1)
    launch_args=()
    launch_direct_ports_enabled=true
    launch_status_runtime_enabled=false
    launch_status_skip_ports=false
    launch_deploy_dry_run=false
    launch_status_enabled=true
    launch_setup_enabled=true
    if prompt_yes_no "Skip setup step" "no"; then
      launch_args+=(--skip-setup)
      launch_setup_enabled=false
    fi
    if prompt_yes_no "Skip host readiness check" "no"; then
      launch_args+=(--skip-host-readiness)
    fi
    if prompt_yes_no "Skip DNS check" "no"; then
      launch_args+=(--skip-dns-check)
    fi
    if prompt_yes_no "Skip SSL check" "no"; then
      launch_args+=(--skip-ssl-check)
    fi
    if prompt_yes_no "Skip host ports check" "no"; then
      launch_args+=(--skip-ports-check)
      launch_direct_ports_enabled=false
    fi
    if prompt_yes_no "Run preflight in config-only mode" "no"; then
      launch_args+=(--preflight-config-only)
    fi
    if prompt_yes_no "Run deploy in dry-run mode" "no"; then
      launch_args+=(--deploy-dry-run)
      launch_deploy_dry_run=true
    fi
    if prompt_yes_no "Skip verify step" "no"; then
      launch_args+=(--skip-verify)
    else
      if [[ "${launch_deploy_dry_run}" == true ]]; then
        echo "[mailzen-deploy][MENU][INFO] Verify step will be skipped because deploy dry-run is enabled."
      else
        launch_verify_max_retries="$(prompt_with_default "Verify max retries (blank = default)" "")"
        if [[ -n "${launch_verify_max_retries}" ]]; then
          if [[ "${launch_verify_max_retries}" =~ ^[0-9]+$ ]] && [[ "${launch_verify_max_retries}" -gt 0 ]]; then
            launch_args+=(--verify-max-retries "${launch_verify_max_retries}")
          else
            echo "[mailzen-deploy][MENU][WARN] Ignoring invalid verify max retries value: ${launch_verify_max_retries}"
          fi
        fi
        launch_verify_retry_sleep="$(prompt_with_default "Verify retry sleep seconds (blank = default)" "")"
        if [[ -n "${launch_verify_retry_sleep}" ]]; then
          if [[ "${launch_verify_retry_sleep}" =~ ^[0-9]+$ ]] && [[ "${launch_verify_retry_sleep}" -gt 0 ]]; then
            launch_args+=(--verify-retry-sleep "${launch_verify_retry_sleep}")
          else
            echo "[mailzen-deploy][MENU][WARN] Ignoring invalid verify retry sleep value: ${launch_verify_retry_sleep}"
          fi
        fi
        launch_verify_skip_oauth=false
        if prompt_yes_no "Skip OAuth check in verify step" "no"; then
          launch_verify_skip_oauth=true
          launch_args+=(--verify-skip-oauth-check)
        fi
        if [[ "${launch_verify_skip_oauth}" == false ]]; then
          if prompt_yes_no "Require OAuth check in verify step (fail when OAuth keys are missing)" "no"; then
            launch_args+=(--verify-require-oauth-check)
          fi
        fi
        if prompt_yes_no "Skip SSL check in verify step" "no"; then
          launch_args+=(--verify-skip-ssl-check)
        fi
      fi
    fi
    if [[ "${launch_setup_enabled}" == true ]]; then
      if prompt_yes_no "Skip docker daemon check during setup step" "no"; then
        launch_args+=(--setup-skip-daemon)
      fi
      launch_domain="$(prompt_with_default "Setup domain override (blank = default env/template value)" "")"
      if [[ -n "${launch_domain}" ]]; then
        launch_args+=(--domain "${launch_domain}")
      fi
      launch_acme_email="$(prompt_with_default "Setup ACME email override (blank = default env/template value)" "")"
      if [[ -n "${launch_acme_email}" ]]; then
        launch_args+=(--acme-email "${launch_acme_email}")
      fi
    fi
    if ! prompt_yes_no "Run final status step after launch" "yes"; then
      launch_status_enabled=false
      launch_args+=(--skip-status)
    fi
    if [[ "${launch_status_enabled}" == true ]]; then
      if prompt_yes_no "Enable runtime checks in final status step" "no"; then
        launch_status_runtime_enabled=true
        launch_args+=(--status-runtime-checks)
        if prompt_yes_no "Skip host readiness inside status runtime checks" "no"; then
          launch_args+=(--status-skip-host-readiness)
        fi
        if prompt_yes_no "Skip DNS check inside status runtime checks" "yes"; then
          launch_args+=(--status-skip-dns-check)
        fi
        if prompt_yes_no "Skip SSL check inside status runtime checks" "yes"; then
          launch_args+=(--status-skip-ssl-check)
        fi
        if prompt_yes_no "Skip ports check inside status runtime checks" "no"; then
          launch_args+=(--status-skip-ports-check)
          launch_status_skip_ports=true
        fi
      fi
      if prompt_yes_no "Enable strict status mode (fail when daemon unavailable)" "no"; then
        launch_args+=(--status-strict)
      fi
    fi
    if [[ "${launch_direct_ports_enabled}" == true ]] || { [[ "${launch_status_runtime_enabled}" == true ]] && [[ "${launch_status_skip_ports}" == false ]]; }; then
      launch_ports="$(prompt_with_default "Custom ports-check targets for launch flow (blank = default)" "")"
      if [[ -n "${launch_ports}" ]]; then
        launch_args+=(--ports-check-ports "${launch_ports}")
      fi
    fi
    run_step "launch.sh" "${launch_args[@]}"
    ;;
  2)
    run_step "bootstrap-ubuntu.sh"
    ;;
  3)
    setup_args=()
    if prompt_yes_no "Run setup in non-interactive mode" "no"; then
      setup_args+=(--non-interactive)
    fi
    if prompt_yes_no "Skip docker daemon check during setup" "no"; then
      setup_args+=(--skip-daemon)
    fi
    setup_domain="$(prompt_with_default "Setup domain override (blank = keep current/template default)" "")"
    if [[ -n "${setup_domain}" ]]; then
      setup_args+=(--domain "${setup_domain}")
    fi
    setup_acme_email="$(prompt_with_default "Setup ACME email override (blank = keep current/template default)" "")"
    if [[ -n "${setup_acme_email}" ]]; then
      setup_args+=(--acme-email "${setup_acme_email}")
    fi
    run_step "setup.sh" "${setup_args[@]}"
    ;;
  4)
    preflight_args=()
    if prompt_yes_no "Enable runtime checks during preflight" "no"; then
      preflight_args+=(--with-runtime-checks)
      if prompt_yes_no "Skip host readiness during runtime checks" "no"; then
        preflight_args+=(--skip-host-readiness)
      fi
      if prompt_yes_no "Skip DNS check during runtime checks" "no"; then
        preflight_args+=(--skip-dns-check)
      fi
      if prompt_yes_no "Skip SSL check during runtime checks" "no"; then
        preflight_args+=(--skip-ssl-check)
      fi
      preflight_skip_ports=false
      if prompt_yes_no "Skip ports check during runtime checks" "no"; then
        preflight_skip_ports=true
        preflight_args+=(--skip-ports-check)
      fi
      if [[ "${preflight_skip_ports}" == false ]]; then
        preflight_ports="$(prompt_with_default "Ports for runtime ports-check (comma-separated)" "80,443")"
        preflight_args+=(--ports-check-ports "${preflight_ports}")
      fi
    fi
    run_step "preflight.sh" "${preflight_args[@]}"
    ;;
  5)
    deploy_args=()
    if prompt_yes_no "Validate compose config only (--config-only)" "no"; then
      deploy_args+=(--config-only)
      echo "[mailzen-deploy][MENU][INFO] Skipping runtime deploy prompts because config-only mode is enabled."
    else
      if prompt_yes_no "Skip image build (--no-build)" "no"; then
        deploy_args+=(--no-build)
      fi
      if prompt_yes_no "Always pull newer base images (--pull)" "no"; then
        deploy_args+=(--pull)
      fi
      if prompt_yes_no "Force recreate containers (--force-recreate)" "no"; then
        deploy_args+=(--force-recreate)
      fi
      if prompt_yes_no "Run deploy in dry-run mode" "no"; then
        deploy_args+=(--dry-run)
      fi
    fi
    run_step "deploy.sh" "${deploy_args[@]}"
    ;;
  6)
    verify_args=()
    verify_retries="$(prompt_with_default "Verify max retries (blank = default)" "")"
    if [[ -n "${verify_retries}" ]]; then
      if [[ "${verify_retries}" =~ ^[0-9]+$ ]] && [[ "${verify_retries}" -gt 0 ]]; then
        verify_args+=(--max-retries "${verify_retries}")
      else
        echo "[mailzen-deploy][MENU][WARN] Ignoring invalid max retries value: ${verify_retries}"
      fi
    fi
    verify_retry_sleep="$(prompt_with_default "Verify retry sleep seconds (blank = default)" "")"
    if [[ -n "${verify_retry_sleep}" ]]; then
      if [[ "${verify_retry_sleep}" =~ ^[0-9]+$ ]] && [[ "${verify_retry_sleep}" -gt 0 ]]; then
        verify_args+=(--retry-sleep "${verify_retry_sleep}")
      else
        echo "[mailzen-deploy][MENU][WARN] Ignoring invalid retry sleep value: ${verify_retry_sleep}"
      fi
    fi
    verify_skip_oauth=false
    if prompt_yes_no "Skip OAuth endpoint check" "no"; then
      verify_skip_oauth=true
      verify_args+=(--skip-oauth-check)
    fi
    if [[ "${verify_skip_oauth}" == false ]]; then
      if prompt_yes_no "Require OAuth check (fail when OAuth keys are missing)" "no"; then
        verify_args+=(--require-oauth-check)
      fi
    fi
    if prompt_yes_no "Skip SSL certificate check" "no"; then
      verify_args+=(--skip-ssl-check)
    fi
    run_step "verify.sh" "${verify_args[@]}"
    ;;
  7)
    status_args=()
    if prompt_yes_no "Enable runtime checks in status" "no"; then
      status_args+=(--with-runtime-checks)
      if prompt_yes_no "Skip host readiness during runtime checks" "no"; then
        status_args+=(--skip-host-readiness)
      fi
      if prompt_yes_no "Skip DNS check during runtime checks" "no"; then
        status_args+=(--skip-dns-check)
      fi
      if prompt_yes_no "Skip SSL check during runtime checks" "no"; then
        status_args+=(--skip-ssl-check)
      fi
      status_skip_ports=false
      if prompt_yes_no "Skip ports check during runtime checks" "no"; then
        status_skip_ports=true
        status_args+=(--skip-ports-check)
      fi
      if [[ "${status_skip_ports}" == false ]]; then
        status_ports="$(prompt_with_default "Ports for runtime ports-check (comma-separated)" "80,443")"
        status_args+=(--ports-check-ports "${status_ports}")
      fi
    fi
    if prompt_yes_no "Enable strict mode (fail when daemon unavailable)" "no"; then
      status_args+=(--strict)
    fi
    run_step "status.sh" "${status_args[@]}"
    ;;
  8)
    logs_args=()
    logs_service="$(prompt_with_default "Service name filter (blank = all services)" "")"
    if [[ -n "${logs_service}" ]]; then
      logs_args+=(--service "${logs_service}")
    fi
    logs_tail="$(prompt_with_default "Tail lines" "200")"
    if [[ "${logs_tail}" =~ ^[0-9]+$ ]] && [[ "${logs_tail}" -gt 0 ]]; then
      logs_args+=(--tail "${logs_tail}")
    else
      echo "[mailzen-deploy][MENU][WARN] Invalid tail value '${logs_tail}'. Using default 200."
      logs_args+=(--tail "200")
    fi
    logs_since="$(prompt_with_default "Since window (blank = no filter, examples: 30m,2h)" "")"
    if [[ -n "${logs_since}" ]]; then
      logs_args+=(--since "${logs_since}")
    fi
    if ! prompt_yes_no "Follow logs continuously" "yes"; then
      logs_args+=(--no-follow)
    fi
    run_step "logs.sh" "${logs_args[@]}"
    ;;
  9)
    update_args=()
    update_status_skip_ports=false
    update_deploy_dry_run=false
    if prompt_yes_no "Run preflight in config-only mode" "no"; then
      update_args+=(--preflight-config-only)
    fi
    if prompt_yes_no "Run deploy in dry-run mode" "no"; then
      update_args+=(--deploy-dry-run)
      update_deploy_dry_run=true
    fi

    if prompt_yes_no "Skip verify step" "no"; then
      update_args+=(--skip-verify)
    else
      if [[ "${update_deploy_dry_run}" == true ]]; then
        echo "[mailzen-deploy][MENU][INFO] Verify step will be skipped because deploy dry-run is enabled."
      else
        update_verify_max_retries="$(prompt_with_default "Verify max retries (blank = default)" "")"
        if [[ -n "${update_verify_max_retries}" ]]; then
          if [[ "${update_verify_max_retries}" =~ ^[0-9]+$ ]] && [[ "${update_verify_max_retries}" -gt 0 ]]; then
            update_args+=(--verify-max-retries "${update_verify_max_retries}")
          else
            echo "[mailzen-deploy][MENU][WARN] Ignoring invalid verify max retries value: ${update_verify_max_retries}"
          fi
        fi
        update_verify_retry_sleep="$(prompt_with_default "Verify retry sleep seconds (blank = default)" "")"
        if [[ -n "${update_verify_retry_sleep}" ]]; then
          if [[ "${update_verify_retry_sleep}" =~ ^[0-9]+$ ]] && [[ "${update_verify_retry_sleep}" -gt 0 ]]; then
            update_args+=(--verify-retry-sleep "${update_verify_retry_sleep}")
          else
            echo "[mailzen-deploy][MENU][WARN] Ignoring invalid verify retry sleep value: ${update_verify_retry_sleep}"
          fi
        fi
        update_verify_skip_oauth=false
        if prompt_yes_no "Skip OAuth check in verify step" "no"; then
          update_args+=(--verify-skip-oauth-check)
          update_verify_skip_oauth=true
        fi
        if [[ "${update_verify_skip_oauth}" == false ]]; then
          if prompt_yes_no "Require OAuth check in verify step (fail when OAuth keys are missing)" "no"; then
            update_args+=(--verify-require-oauth-check)
          fi
        fi
        if prompt_yes_no "Skip SSL check in verify step" "no"; then
          update_args+=(--verify-skip-ssl-check)
        fi
      fi
    fi

    status_enabled=true
    if ! prompt_yes_no "Run status step after update" "yes"; then
      status_enabled=false
      update_args+=(--skip-status)
    fi

    status_runtime_enabled=false
    if [[ "${status_enabled}" == true ]]; then
      if prompt_yes_no "Enable runtime checks in status step" "no"; then
        status_runtime_enabled=true
        update_args+=(--status-runtime-checks)
        if prompt_yes_no "Skip host readiness inside status runtime checks" "no"; then
          update_args+=(--status-skip-host-readiness)
        fi
        if prompt_yes_no "Skip DNS check inside status runtime checks" "yes"; then
          update_args+=(--status-skip-dns-check)
        fi
        if prompt_yes_no "Skip SSL check inside status runtime checks" "yes"; then
          update_args+=(--status-skip-ssl-check)
        fi
        if prompt_yes_no "Skip ports check inside status runtime checks" "no"; then
          update_args+=(--status-skip-ports-check)
          update_status_skip_ports=true
        fi
      fi
      if prompt_yes_no "Enable strict status mode" "no"; then
        update_args+=(--status-strict)
      fi
    fi

    if [[ "${status_runtime_enabled}" == true ]] && [[ "${update_status_skip_ports}" == false ]]; then
      update_ports="$(prompt_with_default "Custom ports-check targets for status runtime checks (blank = default)" "")"
      if [[ -n "${update_ports}" ]]; then
        update_args+=(--ports-check-ports "${update_ports}")
      fi
    fi

    run_step "update.sh" "${update_args[@]}"
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
    ports_list="$(prompt_with_default "Ports to check (comma-separated)" "80,443")"
    run_step "ports-check.sh" --ports "${ports_list}"
    ;;
  18)
    run_step "env-audit.sh"
    ;;
  19)
    doctor_args=()
    doctor_ports="$(prompt_with_default "Custom ports-check targets for diagnostics (blank = default)" "")"
    if [[ -n "${doctor_ports}" ]]; then
      doctor_args+=(--ports-check-ports "${doctor_ports}")
    fi
    run_step "doctor.sh" "${doctor_args[@]}"
    ;;
  20)
    support_bundle_args=()
    support_ports="$(prompt_with_default "Custom ports-check targets for support bundle (blank = default)" "")"
    if [[ -n "${support_ports}" ]]; then
      support_bundle_args+=(--ports-check-ports "${support_ports}")
    fi
    run_step "support-bundle.sh" "${support_bundle_args[@]}"
    ;;
  21)
    rotate_args=()
    rotate_keys="$(prompt_with_default "Rotate keys (all or comma-separated: JWT_SECRET,OAUTH_STATE_SECRET,AI_AGENT_PLATFORM_KEY)" "all")"
    if [[ "${rotate_keys}" != "all" ]]; then
      rotate_args+=(--keys "${rotate_keys}")
    fi
    rotate_dry_run=false
    if prompt_yes_no "Run secret rotation in dry-run mode" "yes"; then
      rotate_dry_run=true
      rotate_args+=(--dry-run)
    fi
    if [[ "${rotate_dry_run}" == false ]]; then
      if prompt_yes_no "Bypass confirmation prompt with --yes" "no"; then
        rotate_args+=(--yes)
      fi
    else
      echo "[mailzen-deploy][MENU][INFO] Skipping --yes prompt because dry-run mode is enabled."
    fi
    run_step "rotate-app-secrets.sh" "${rotate_args[@]}"
    ;;
  22)
    pipeline_check_args=()
    pipeline_ports="$(prompt_with_default "Custom ports-check targets for pipeline check (blank = default)" "")"
    if [[ -n "${pipeline_ports}" ]]; then
      pipeline_check_args+=(--ports-check-ports "${pipeline_ports}")
    fi
    run_step "pipeline-check.sh" "${pipeline_check_args[@]}"
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
    run_step "launch.sh" --skip-setup --skip-dns-check --skip-ssl-check --preflight-config-only --deploy-dry-run --skip-verify --skip-status
    ;;
  27)
    run_step "verify.sh" --skip-oauth-check --skip-ssl-check
    ;;
  28)
    doctor_seeded_args=(--seed-env)
    doctor_seeded_ports="$(prompt_with_default "Custom ports-check targets for seeded diagnostics (blank = default)" "")"
    if [[ -n "${doctor_seeded_ports}" ]]; then
      doctor_seeded_args+=(--ports-check-ports "${doctor_seeded_ports}")
    fi
    run_step "doctor.sh" "${doctor_seeded_args[@]}"
    ;;
  29)
    support_seeded_args=(--seed-env)
    support_seeded_ports="$(prompt_with_default "Custom ports-check targets for seeded support bundle (blank = default)" "")"
    if [[ -n "${support_seeded_ports}" ]]; then
      support_seeded_args+=(--ports-check-ports "${support_seeded_ports}")
    fi
    run_step "support-bundle.sh" "${support_seeded_args[@]}"
    ;;
  30)
    pipeline_seeded_args=(--seed-env)
    pipeline_seeded_ports="$(prompt_with_default "Custom ports-check targets for seeded pipeline check (blank = default)" "")"
    if [[ -n "${pipeline_seeded_ports}" ]]; then
      pipeline_seeded_args+=(--ports-check-ports "${pipeline_seeded_ports}")
    fi
    run_step "pipeline-check.sh" "${pipeline_seeded_args[@]}"
    ;;
  31)
    restart_args=()
    restart_service="$(prompt_with_default "Service to restart (blank = all services)" "")"
    if [[ -n "${restart_service}" ]]; then
      restart_args+=(--service "${restart_service}")
    fi
    restart_wait_seconds="$(prompt_with_default "Wait seconds before status snapshot" "0")"
    if [[ "${restart_wait_seconds}" =~ ^[0-9]+$ ]]; then
      restart_args+=(--wait-seconds "${restart_wait_seconds}")
    else
      echo "[mailzen-deploy][MENU][WARN] Invalid wait seconds value '${restart_wait_seconds}'. Using 0."
      restart_args+=(--wait-seconds "0")
    fi
    if prompt_yes_no "Run restart in dry-run mode" "no"; then
      restart_args+=(--dry-run)
    fi
    run_step "restart.sh" "${restart_args[@]}"
    ;;
  32)
    stop_args=()
    stop_purge_data=false
    if prompt_yes_no "Purge database/cache volumes while stopping" "no"; then
      stop_purge_data=true
      stop_args+=(--purge-data)
      if prompt_yes_no "Bypass purge confirmation with --yes" "no"; then
        stop_args+=(--yes)
      fi
    fi
    if prompt_yes_no "Run stop in dry-run mode" "no"; then
      stop_args+=(--dry-run)
    fi
    run_step "stop.sh" "${stop_args[@]}"
    ;;
  33)
    echo "[mailzen-deploy][INFO] Exiting menu."
    exit 0
    ;;
  *)
    echo "[mailzen-deploy][WARN] Invalid option '${choice}'. Please choose 1-33."
    ;;
  esac
done
