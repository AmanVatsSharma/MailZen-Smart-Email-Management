#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 update script
# -----------------------------------------------------------------------------
# Convenient wrapper for production updates:
# - validates env + compose config
# - pulls latest base layers
# - rebuilds app images
# - force-recreates containers
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

log_info "Starting MailZen update workflow..."

"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/preflight.sh"
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy.sh" --pull --force-recreate

log_info "Update workflow completed."
