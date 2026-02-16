#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 Ubuntu bootstrap script
# -----------------------------------------------------------------------------
# Purpose:
# - install Docker engine + compose plugin on Ubuntu
# - enable/start Docker service
# - optionally add current user to docker group
#
# Usage:
#   sudo ./deploy/ec2/scripts/bootstrap-ubuntu.sh
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  log_error "This script must run as root. Use: sudo ./deploy/ec2/scripts/bootstrap-ubuntu.sh"
  exit 1
fi

if [[ ! -f /etc/os-release ]]; then
  log_error "Cannot detect OS (/etc/os-release missing)."
  exit 1
fi

# shellcheck disable=SC1091
source /etc/os-release
os_id="${ID:-unknown}"

if [[ "${os_id}" != "ubuntu" ]]; then
  log_warn "This bootstrap script is optimized for Ubuntu; detected: ${os_id}"
  log_warn "Proceeding anyway, but package names may differ."
fi

log_info "Updating apt package index..."
apt-get update -y

log_info "Installing Docker runtime dependencies..."
apt-get install -y ca-certificates curl gnupg lsb-release

if ! command -v docker >/dev/null 2>&1; then
  log_info "Installing docker.io + docker-compose-v2 package..."
  apt-get install -y docker.io docker-compose-v2
else
  log_info "Docker already installed; ensuring compose plugin package is present..."
  apt-get install -y docker-compose-v2
fi

log_info "Enabling and starting Docker service..."
systemctl enable docker
systemctl restart docker

if ! systemctl is-active --quiet docker; then
  log_error "Docker service is not active after startup."
  systemctl status docker --no-pager || true
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  log_info "Docker version: $(docker --version)"
fi

if docker compose version >/dev/null 2>&1; then
  log_info "Docker Compose version: $(docker compose version | head -n 1)"
else
  log_error "Docker Compose plugin still unavailable."
  exit 1
fi

target_user="${SUDO_USER:-}"
if [[ -n "${target_user}" ]] && ! id -nG "${target_user}" | grep -qw docker; then
  log_info "Adding user '${target_user}' to docker group for passwordless docker usage."
  usermod -aG docker "${target_user}"
  log_warn "User '${target_user}' may need to re-login for group changes to apply."
fi

log_info "Bootstrap complete. Next steps (as non-root user):"
log_info "  ./deploy/ec2/scripts/setup.sh"
log_info "  ./deploy/ec2/scripts/preflight.sh"
log_info "  ./deploy/ec2/scripts/deploy.sh"
