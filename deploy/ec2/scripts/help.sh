#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 command help script
# -----------------------------------------------------------------------------
# Prints a concise command reference for operators.
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

domain="your-domain.example.com"
if [[ -f "${ENV_FILE}" ]]; then
  candidate_domain="$(read_env_value "MAILZEN_DOMAIN")"
  if [[ -n "${candidate_domain}" ]]; then
    domain="${candidate_domain}"
  fi
fi

cat <<HELP
[mailzen-deploy][HELP] MailZen EC2 command reference

Primary flow:
  ./deploy/ec2/scripts/launch.sh
  ./deploy/ec2/scripts/preflight.sh
  ./deploy/ec2/scripts/deploy.sh
  ./deploy/ec2/scripts/verify.sh
  ./deploy/ec2/scripts/status.sh
  ./deploy/ec2/scripts/status.sh --with-runtime-checks

Setup and env:
  ./deploy/ec2/scripts/setup.sh --non-interactive --skip-daemon
  ./deploy/ec2/scripts/env-audit.sh
  ./deploy/ec2/scripts/rotate-app-secrets.sh --yes

Readiness checks:
  ./deploy/ec2/scripts/host-readiness.sh
  ./deploy/ec2/scripts/dns-check.sh --domain ${domain}
  ./deploy/ec2/scripts/ssl-check.sh --domain ${domain}
  ./deploy/ec2/scripts/ports-check.sh

Operations:
  ./deploy/ec2/scripts/update.sh
  ./deploy/ec2/scripts/logs.sh backend
  ./deploy/ec2/scripts/logs.sh --service backend --tail 500 --no-follow
  ./deploy/ec2/scripts/restart.sh backend
  ./deploy/ec2/scripts/stop.sh

Backup and recovery:
  ./deploy/ec2/scripts/backup-db.sh
  ./deploy/ec2/scripts/backup-list.sh
  ./deploy/ec2/scripts/backup-prune.sh 20
  ./deploy/ec2/scripts/rollback-latest.sh

Diagnostics:
  ./deploy/ec2/scripts/doctor.sh
  ./deploy/ec2/scripts/support-bundle.sh
  ./deploy/ec2/scripts/pipeline-check.sh
  ./deploy/ec2/scripts/pipeline-check.sh --seed-env
  ./deploy/ec2/scripts/reports-prune.sh 20
  ./deploy/ec2/scripts/self-check.sh
HELP
