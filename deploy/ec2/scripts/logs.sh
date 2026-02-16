#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 logs script
# -----------------------------------------------------------------------------
# Usage:
#   ./deploy/ec2/scripts/logs.sh                 # all services, tail=200
#   ./deploy/ec2/scripts/logs.sh backend         # one service
#   ./deploy/ec2/scripts/logs.sh backend 500     # one service, custom tail
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

SERVICE_NAME="${1:-}"
TAIL_LINES="${2:-200}"

log_info "Opening logs (tail=${TAIL_LINES})..."
require_cmd docker
ensure_required_files_exist

if [[ -n "${SERVICE_NAME}" ]]; then
  compose logs --tail "${TAIL_LINES}" -f "${SERVICE_NAME}"
  exit 0
fi

compose logs --tail "${TAIL_LINES}" -f
