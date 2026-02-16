#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 deployment pipeline check
# -----------------------------------------------------------------------------
# CI-friendly validation pipeline for deployment assets.
# Does not require docker daemon (config-only checks).
#
# Usage:
#   ./deploy/ec2/scripts/pipeline-check.sh
#   ./deploy/ec2/scripts/pipeline-check.sh --seed-env
# -----------------------------------------------------------------------------

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SEED_ENV=false
KEEP_SEEDED_ENV=false
SEEDED_ENV_FILE=""

cleanup() {
  if [[ -n "${SEEDED_ENV_FILE}" ]] && [[ "${KEEP_SEEDED_ENV}" == false ]] && [[ -f "${SEEDED_ENV_FILE}" ]]; then
    rm -f "${SEEDED_ENV_FILE}"
    echo "[mailzen-deploy][PIPELINE-CHECK] Removed seeded env file."
  fi
}
trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
  --seed-env)
    SEED_ENV=true
    shift
    ;;
  --keep-seeded-env)
    KEEP_SEEDED_ENV=true
    shift
    ;;
  *)
    echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] Unknown argument: $1"
    echo "[mailzen-deploy][PIPELINE-CHECK][INFO] Supported flags: --seed-env --keep-seeded-env"
    exit 1
    ;;
  esac
done

if [[ "${SEED_ENV}" == false ]] && [[ "${KEEP_SEEDED_ENV}" == true ]]; then
  echo "[mailzen-deploy][PIPELINE-CHECK][ERROR] --keep-seeded-env requires --seed-env"
  exit 1
fi

seed_env_file() {
  SEEDED_ENV_FILE="$(mktemp "${DEPLOY_DIR}/.env.pipeline-check.XXXXXX")"
  cp "${DEPLOY_DIR}/.env.ec2.example" "${SEEDED_ENV_FILE}"

  sed -i 's/^MAILZEN_DOMAIN=.*/MAILZEN_DOMAIN=mailzen.pipeline.local/' "${SEEDED_ENV_FILE}"
  sed -i 's/^ACME_EMAIL=.*/ACME_EMAIL=ops@mailzen-pipeline.dev/' "${SEEDED_ENV_FILE}"
  sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://mailzen.pipeline.local|' "${SEEDED_ENV_FILE}"
  sed -i 's|^NEXT_PUBLIC_GRAPHQL_ENDPOINT=.*|NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://mailzen.pipeline.local/graphql|' "${SEEDED_ENV_FILE}"
  sed -i 's/^JWT_SECRET=.*/JWT_SECRET=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd/' "${SEEDED_ENV_FILE}"
  sed -i 's/^OAUTH_STATE_SECRET=.*/OAUTH_STATE_SECRET=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789abcd/' "${SEEDED_ENV_FILE}"
  sed -i 's/^SECRETS_KEY=.*/SECRETS_KEY=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789abcd/' "${SEEDED_ENV_FILE}"
  sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=mailzenpipelinepostgrespassword123/' "${SEEDED_ENV_FILE}"
  sed -i 's/^AI_AGENT_PLATFORM_KEY=.*/AI_AGENT_PLATFORM_KEY=mailzenpipelineagentplatformkey1234567890abcd/' "${SEEDED_ENV_FILE}"
  sed -i 's|^GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=https://mailzen.pipeline.local/auth/google/callback|' "${SEEDED_ENV_FILE}"
  sed -i 's|^GOOGLE_PROVIDER_REDIRECT_URI=.*|GOOGLE_PROVIDER_REDIRECT_URI=https://mailzen.pipeline.local/email-integration/google/callback|' "${SEEDED_ENV_FILE}"
  sed -i 's|^OUTLOOK_REDIRECT_URI=.*|OUTLOOK_REDIRECT_URI=https://mailzen.pipeline.local/auth/microsoft/callback|' "${SEEDED_ENV_FILE}"
  sed -i 's|^OUTLOOK_PROVIDER_REDIRECT_URI=.*|OUTLOOK_PROVIDER_REDIRECT_URI=https://mailzen.pipeline.local/email-integration/microsoft/callback|' "${SEEDED_ENV_FILE}"
  sed -i 's|^PROVIDER_SECRETS_KEYRING=.*|PROVIDER_SECRETS_KEYRING=default:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789abcd|' "${SEEDED_ENV_FILE}"

  export MAILZEN_DEPLOY_ENV_FILE="${SEEDED_ENV_FILE}"
  echo "[mailzen-deploy][PIPELINE-CHECK] Seeded env file: ${SEEDED_ENV_FILE}"
}

echo "[mailzen-deploy][PIPELINE-CHECK] starting..."

if [[ "${SEED_ENV}" == true ]]; then
  seed_env_file
fi

"${SCRIPT_DIR}/self-check.sh"
"${SCRIPT_DIR}/env-audit.sh"
"${SCRIPT_DIR}/preflight.sh" --config-only
"${SCRIPT_DIR}/host-readiness.sh" --min-disk-gb 1 --min-memory-mb 256 --min-cpu-cores 1
"${SCRIPT_DIR}/ports-check.sh"

echo "[mailzen-deploy][PIPELINE-CHECK] rendering compose config..."
docker compose --env-file "${MAILZEN_DEPLOY_ENV_FILE:-${DEPLOY_DIR}/.env.ec2}" -f "${DEPLOY_DIR}/docker-compose.yml" config >/dev/null

echo "[mailzen-deploy][PIPELINE-CHECK] PASS"
