#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 command help script
# -----------------------------------------------------------------------------
# Prints a concise command reference for operators.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

domain="your-domain.example.com"
active_env_file="$(get_env_file)"
active_compose_file="$(get_compose_file)"
if [[ -f "${active_env_file}" ]]; then
  candidate_domain="$(read_env_value "MAILZEN_DOMAIN")"
  if [[ -n "${candidate_domain}" ]]; then
    domain="${candidate_domain}"
  fi
fi

cat <<HELP
[mailzen-deploy][HELP] MailZen EC2 command reference
[mailzen-deploy][HELP] Active env file: ${active_env_file}
[mailzen-deploy][HELP] Active compose file: ${active_compose_file}

Primary flow:
  ./deploy/ec2/scripts/launch.sh
  ./deploy/ec2/scripts/launch.sh --preflight-config-only --deploy-dry-run --skip-verify
  ./deploy/ec2/scripts/launch.sh --domain mail.example.com --acme-email ops@example.com --setup-skip-daemon
  ./deploy/ec2/scripts/launch.sh --verify-max-retries 10 --verify-retry-sleep 5
  ./deploy/ec2/scripts/launch.sh --ports-check-ports 80,443,8100
  ./deploy/ec2/scripts/launch.sh --status-runtime-checks --status-skip-dns-check --status-skip-ssl-check
  ./deploy/ec2/scripts/launch.sh --status-runtime-checks --status-skip-host-readiness --status-skip-ports-check
  ./deploy/ec2/scripts/preflight.sh
  ./deploy/ec2/scripts/preflight.sh --with-runtime-checks --ports-check-ports 80,443,8100
  ./deploy/ec2/scripts/deploy.sh
  ./deploy/ec2/scripts/verify.sh
  ./deploy/ec2/scripts/verify.sh --skip-oauth-check
  ./deploy/ec2/scripts/status.sh
  ./deploy/ec2/scripts/status.sh --with-runtime-checks
  ./deploy/ec2/scripts/status.sh --with-runtime-checks --ports-check-ports 80,443,8100

Setup and env:
  ./deploy/ec2/scripts/setup.sh --non-interactive --skip-daemon
  ./deploy/ec2/scripts/env-audit.sh
  ./deploy/ec2/scripts/rotate-app-secrets.sh --yes
  ./deploy/ec2/scripts/rotate-app-secrets.sh --keys JWT_SECRET --dry-run

Readiness checks:
  ./deploy/ec2/scripts/host-readiness.sh
  ./deploy/ec2/scripts/dns-check.sh --domain ${domain}
  ./deploy/ec2/scripts/ssl-check.sh --domain ${domain}
  ./deploy/ec2/scripts/ports-check.sh
  ./deploy/ec2/scripts/ports-check.sh --ports 80,443,8100

Operations:
  ./deploy/ec2/scripts/update.sh
  ./deploy/ec2/scripts/update.sh --verify-skip-oauth-check --status-runtime-checks
  ./deploy/ec2/scripts/update.sh --verify-max-retries 10 --verify-retry-sleep 5
  ./deploy/ec2/scripts/update.sh --status-runtime-checks --ports-check-ports 80,443,8100
  ./deploy/ec2/scripts/update.sh --status-runtime-checks --status-skip-dns-check --status-skip-ssl-check
  ./deploy/ec2/scripts/update.sh --status-runtime-checks --status-skip-host-readiness --status-skip-ports-check
  ./deploy/ec2/scripts/logs.sh backend
  ./deploy/ec2/scripts/logs.sh --service backend --tail 500 --no-follow
  ./deploy/ec2/scripts/restart.sh backend
  ./deploy/ec2/scripts/restart.sh --service backend --wait-seconds 5
  ./deploy/ec2/scripts/stop.sh
  ./deploy/ec2/scripts/stop.sh --purge-data --yes

Backup and recovery:
  ./deploy/ec2/scripts/backup-db.sh --label before-release
  ./deploy/ec2/scripts/backup-db.sh --label smoke --dry-run
  ./deploy/ec2/scripts/backup-list.sh --label before-release --count 5
  ./deploy/ec2/scripts/backup-prune.sh --keep-count 20 --dry-run
  ./deploy/ec2/scripts/backup-prune.sh --label before-release --keep-count 5 --dry-run
  ./deploy/ec2/scripts/backup-prune.sh 20
  ./deploy/ec2/scripts/restore-db.sh --yes deploy/ec2/backups/your-backup.sql.gz
  ./deploy/ec2/scripts/rollback-latest.sh --yes
  ./deploy/ec2/scripts/rollback-latest.sh --label before-release --dry-run

Diagnostics:
  ./deploy/ec2/scripts/doctor.sh
  ./deploy/ec2/scripts/doctor.sh --seed-env
  ./deploy/ec2/scripts/doctor.sh --ports-check-ports 80,443,8100
  ./deploy/ec2/scripts/support-bundle.sh
  ./deploy/ec2/scripts/support-bundle.sh --seed-env
  ./deploy/ec2/scripts/support-bundle.sh --ports-check-ports 80,443,8100
  ./deploy/ec2/scripts/support-bundle.sh --seed-env --keep-work-dir
  ./deploy/ec2/scripts/pipeline-check.sh
  ./deploy/ec2/scripts/pipeline-check.sh --seed-env
  ./deploy/ec2/scripts/pipeline-check.sh --ports-check-ports 80,443,8100
  ./deploy/ec2/scripts/reports-prune.sh --keep-count 50 --dry-run
  ./deploy/ec2/scripts/reports-prune.sh 20
  ./deploy/ec2/scripts/self-check.sh
HELP
