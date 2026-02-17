#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 runtime smoke script (container-internal probes)
# -----------------------------------------------------------------------------
# Purpose:
# - validate service runtime health without relying on public DNS/TLS
# - verify core app endpoints from inside running containers
# - verify backend container can reach postgres + redis over compose network
#
# Checks:
# 1) frontend internal HTTP endpoint (`http://127.0.0.1:3000/`)
# 2) frontend login endpoint (`http://127.0.0.1:3000/login`)
# 3) backend GraphQL GET endpoint (`http://127.0.0.1:4000/graphql`)
# 4) backend GraphQL POST introspection-lite query (`__typename`)
# 5) ai-agent-platform health endpoint (`http://127.0.0.1:8100/health`)
# 6) backend container TCP reachability to postgres:5432 + redis:6379
#
# Usage:
#   ./deploy/ec2/scripts/runtime-smoke.sh
#   ./deploy/ec2/scripts/runtime-smoke.sh --max-retries 15 --retry-sleep 4
#   ./deploy/ec2/scripts/runtime-smoke.sh --skip-compose-ps
#   ./deploy/ec2/scripts/runtime-smoke.sh --skip-backend-dependency-check
#   ./deploy/ec2/scripts/runtime-smoke.sh --dry-run
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

MAX_RETRIES="10"
RETRY_SLEEP_SECONDS="3"
RUN_COMPOSE_PS=true
RUN_BACKEND_DEPENDENCY_CHECK=true
DRY_RUN=false
MAX_RETRIES_FLAG_SET=false
RETRY_SLEEP_FLAG_SET=false
MAX_RETRIES_FLAG_VALUE=""
RETRY_SLEEP_FLAG_VALUE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
  --max-retries)
    max_retries_arg="${2:-}"
    if [[ -z "${max_retries_arg}" ]]; then
      log_error "--max-retries requires a value."
      exit 1
    fi
    if [[ "${MAX_RETRIES_FLAG_SET}" == true ]] && [[ "${max_retries_arg}" != "${MAX_RETRIES_FLAG_VALUE}" ]]; then
      log_warn "Earlier --max-retries '${MAX_RETRIES_FLAG_VALUE}' overridden by --max-retries '${max_retries_arg}'."
    fi
    MAX_RETRIES="${max_retries_arg}"
    MAX_RETRIES_FLAG_SET=true
    MAX_RETRIES_FLAG_VALUE="${max_retries_arg}"
    shift 2
    ;;
  --retry-sleep)
    retry_sleep_arg="${2:-}"
    if [[ -z "${retry_sleep_arg}" ]]; then
      log_error "--retry-sleep requires a value."
      exit 1
    fi
    if [[ "${RETRY_SLEEP_FLAG_SET}" == true ]] && [[ "${retry_sleep_arg}" != "${RETRY_SLEEP_FLAG_VALUE}" ]]; then
      log_warn "Earlier --retry-sleep '${RETRY_SLEEP_FLAG_VALUE}' overridden by --retry-sleep '${retry_sleep_arg}'."
    fi
    RETRY_SLEEP_SECONDS="${retry_sleep_arg}"
    RETRY_SLEEP_FLAG_SET=true
    RETRY_SLEEP_FLAG_VALUE="${retry_sleep_arg}"
    shift 2
    ;;
  --skip-compose-ps)
    RUN_COMPOSE_PS=false
    shift
    ;;
  --skip-backend-dependency-check)
    RUN_BACKEND_DEPENDENCY_CHECK=false
    shift
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --max-retries <n> --retry-sleep <n> --skip-compose-ps --skip-backend-dependency-check --dry-run"
    exit 1
    ;;
  esac
done

assert_positive_integer "--max-retries" "${MAX_RETRIES}" || exit 1
assert_positive_integer "--retry-sleep" "${RETRY_SLEEP_SECONDS}" || exit 1

require_cmd docker
ensure_required_files_exist
validate_core_env
log_info "Active env file: $(get_env_file)"
log_info "Active compose file: $(get_compose_file)"

if [[ "${DRY_RUN}" == true ]]; then
  log_info "Dry-run enabled; runtime checks will not execute."
  log_info "Would validate frontend internal HTTP endpoint."
  log_info "Would validate frontend login endpoint."
  log_info "Would validate backend GraphQL GET endpoint."
  log_info "Would validate backend GraphQL POST endpoint."
  log_info "Would validate AI health endpoint."
  if [[ "${RUN_BACKEND_DEPENDENCY_CHECK}" == true ]]; then
    log_info "Would validate backend TCP connectivity to postgres:5432 and redis:6379."
  else
    log_warn "Backend dependency connectivity check is skipped (--skip-backend-dependency-check)."
  fi
  if [[ "${RUN_COMPOSE_PS}" == true ]]; then
    log_info "Would print compose status snapshot."
  else
    log_warn "Compose status snapshot is skipped (--skip-compose-ps)."
  fi
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not reachable. Start Docker and retry."
  exit 1
fi

retry_check() {
  local label="$1"
  local description="$2"
  shift 2

  local attempt=1
  local command_output=""
  while [[ "${attempt}" -le "${MAX_RETRIES}" ]]; do
    log_info "[${label}] attempt ${attempt}/${MAX_RETRIES}: ${description}"
    if command_output="$("$@" 2>&1)"; then
      log_info "[${label}] PASS"
      return 0
    fi

    if [[ -n "${command_output}" ]]; then
      log_warn "[${label}] pending/fail: ${command_output}"
    else
      log_warn "[${label}] pending/fail"
    fi

    if [[ "${attempt}" -lt "${MAX_RETRIES}" ]]; then
      sleep "${RETRY_SLEEP_SECONDS}"
    fi
    attempt=$((attempt + 1))
  done

  log_error "[${label}] FAIL after ${MAX_RETRIES} attempts."
  return 1
}

check_frontend_internal() {
  compose exec -T frontend node -e "require('http').get('http://127.0.0.1:3000/', (res) => process.exit((res.statusCode >= 200 && res.statusCode < 500) ? 0 : 1)).on('error', () => process.exit(1));"
}

check_frontend_login() {
  compose exec -T frontend node -e "require('http').get('http://127.0.0.1:3000/login', (res) => process.exit((res.statusCode >= 200 && res.statusCode < 500) ? 0 : 1)).on('error', () => process.exit(1));"
}

check_backend_graphql_get() {
  compose exec -T backend node -e "require('http').get('http://127.0.0.1:4000/graphql', (res) => process.exit((res.statusCode >= 200 && res.statusCode < 500) ? 0 : 1)).on('error', () => process.exit(1));"
}

check_backend_graphql_post() {
  compose exec -T backend node -e "const http=require('http'); const body=JSON.stringify({query:'query RuntimeSmoke { __typename }'}); const req=http.request({hostname:'127.0.0.1', port:4000, path:'/graphql', method:'POST', headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}}, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.write(body); req.end();"
}

check_ai_health() {
  compose exec -T ai-agent-platform python -c "import sys, urllib.request; status=urllib.request.urlopen('http://127.0.0.1:8100/health', timeout=3).getcode(); sys.exit(0 if 200 <= status < 400 else 1)"
}

check_backend_dependencies() {
  compose exec -T backend node -e "const net=require('net'); const check=(host,port,next)=>{const socket=net.connect({host,port},()=>{socket.end(); next();}); socket.setTimeout(3000); socket.on('timeout',()=>{socket.destroy(); process.exit(1);}); socket.on('error',()=>process.exit(1));}; check('postgres',5432,()=>check('redis',6379,()=>process.exit(0)));"
}

log_info "Starting runtime smoke checks (container-internal probes)..."

if [[ "${RUN_COMPOSE_PS}" == true ]]; then
  log_info "Compose status snapshot:"
  compose ps || true
fi

frontend_ok=true
frontend_login_ok=true
backend_graphql_get_ok=true
backend_graphql_post_ok=true
ai_health_ok=true
backend_dependency_ok=true

retry_check "frontend-internal-http" "GET / on frontend container localhost:3000" check_frontend_internal || frontend_ok=false
retry_check "frontend-login" "GET /login on frontend container localhost:3000" check_frontend_login || frontend_login_ok=false
retry_check "backend-graphql-get" "GET /graphql on backend container localhost:4000" check_backend_graphql_get || backend_graphql_get_ok=false
retry_check "backend-graphql-post" "POST /graphql query { __typename } on backend container localhost:4000" check_backend_graphql_post || backend_graphql_post_ok=false
retry_check "ai-health" "GET /health on ai-agent-platform container localhost:8100" check_ai_health || ai_health_ok=false

if [[ "${RUN_BACKEND_DEPENDENCY_CHECK}" == true ]]; then
  retry_check "backend-dependencies" "backend container TCP connectivity to postgres:5432 and redis:6379" check_backend_dependencies || backend_dependency_ok=false
else
  log_warn "Skipping backend dependency connectivity check (--skip-backend-dependency-check)."
fi

if [[ "${frontend_ok}" == true ]] &&
  [[ "${frontend_login_ok}" == true ]] &&
  [[ "${backend_graphql_get_ok}" == true ]] &&
  [[ "${backend_graphql_post_ok}" == true ]] &&
  [[ "${ai_health_ok}" == true ]] &&
  [[ "${backend_dependency_ok}" == true ]]; then
  log_info "Runtime smoke checks passed."
  exit 0
fi

log_error "One or more runtime smoke checks failed."
exit 1
