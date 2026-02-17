#!/usr/bin/env bash

# -----------------------------------------------------------------------------
# MailZen EC2 docs-to-script consistency checker
# -----------------------------------------------------------------------------
# Validates that deployment docs only reference scripts that actually exist.
# Optionally enforces coverage so every script is referenced at least once.
#
# Usage:
#   ./deploy/ec2/scripts/docs-check.sh
#   ./deploy/ec2/scripts/docs-check.sh --strict-coverage
#   ./deploy/ec2/scripts/docs-check.sh --strict-coverage --include-common
# -----------------------------------------------------------------------------

set -Eeuo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

STRICT_COVERAGE=false
INCLUDE_COMMON=false
STRICT_COVERAGE_FLAG_SET=false
INCLUDE_COMMON_FLAG_SET=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --strict-coverage)
    if [[ "${STRICT_COVERAGE_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --strict-coverage flag detected; strict docs coverage remains enabled."
    fi
    STRICT_COVERAGE=true
    STRICT_COVERAGE_FLAG_SET=true
    shift
    ;;
  --include-common)
    if [[ "${INCLUDE_COMMON_FLAG_SET}" == true ]]; then
      log_warn "Duplicate --include-common flag detected; common helper coverage remains enabled."
    fi
    INCLUDE_COMMON=true
    INCLUDE_COMMON_FLAG_SET=true
    shift
    ;;
  *)
    log_error "Unknown argument: $1"
    log_error "Supported flags: --strict-coverage --include-common"
    exit 1
    ;;
  esac
done

require_cmd rg

doc_files=(
  "${REPO_ROOT}/README.md"
  "${REPO_ROOT}/deploy/ec2/README.md"
  "${REPO_ROOT}/deploy/ec2/FLOW.md"
  "${REPO_ROOT}/deploy/ec2/VALIDATION.md"
)

for doc_file in "${doc_files[@]}"; do
  if [[ ! -f "${doc_file}" ]]; then
    log_error "Documentation file not found: ${doc_file}"
    exit 1
  fi
done

log_info "Checking docs for script reference consistency..."
log_info "Scanned docs:"
for doc_file in "${doc_files[@]}"; do
  log_info "  - ${doc_file#${REPO_ROOT}/}"
done

mapfile -t referenced_script_paths < <(
  rg -o --no-filename "(?:\./)?deploy/ec2/scripts/[A-Za-z0-9._-]+\.sh" "${doc_files[@]}" |
    sed -E 's|^deploy/|./deploy/|' |
    sort -u
)

if [[ "${#referenced_script_paths[@]}" -eq 0 ]]; then
  log_error "No deploy script references found in docs."
  exit 1
fi

missing_references=()
declare -A referenced_script_basename_map=()
for relative_script_path in "${referenced_script_paths[@]}"; do
  absolute_script_path="${REPO_ROOT}/${relative_script_path#./}"
  script_basename="$(basename "${relative_script_path}")"
  referenced_script_basename_map["${script_basename}"]=1
  if [[ ! -f "${absolute_script_path}" ]]; then
    missing_references+=("${relative_script_path}")
  fi
done

if [[ "${#missing_references[@]}" -gt 0 ]]; then
  mapfile -t missing_references < <(printf "%s\n" "${missing_references[@]}" | sort -u)
  log_error "Docs reference missing script(s):"
  for missing_reference in "${missing_references[@]}"; do
    log_error "  - ${missing_reference}"
  done
  exit 1
fi

log_info "All script references found in docs point to existing files."
log_info "Found ${#referenced_script_paths[@]} unique script reference(s) in docs."

all_script_files=("${SCRIPT_DIR}"/*.sh)
unreferenced_scripts=()
for script_file in "${all_script_files[@]}"; do
  script_basename="$(basename "${script_file}")"
  if [[ "${script_basename}" == "common.sh" ]] && [[ "${INCLUDE_COMMON}" == false ]]; then
    continue
  fi
  if [[ -n "${referenced_script_basename_map[${script_basename}]:-}" ]]; then
    continue
  fi
  unreferenced_scripts+=("${script_basename}")
done

if [[ "${#unreferenced_scripts[@]}" -gt 0 ]]; then
  mapfile -t unreferenced_scripts < <(printf "%s\n" "${unreferenced_scripts[@]}" | sort -u)
  if [[ "${STRICT_COVERAGE}" == true ]]; then
    log_error "Unreferenced script(s) found with --strict-coverage enabled:"
    for unreferenced_script in "${unreferenced_scripts[@]}"; do
      log_error "  - ${unreferenced_script}"
    done
    exit 1
  fi
  log_warn "Unreferenced script(s) found (use --strict-coverage to fail):"
  for unreferenced_script in "${unreferenced_scripts[@]}"; do
    log_warn "  - ${unreferenced_script}"
  done
fi

if [[ "${STRICT_COVERAGE}" == true ]]; then
  if [[ "${INCLUDE_COMMON}" == true ]]; then
    log_info "Strict docs coverage mode passed (including common.sh)."
  else
    log_info "Strict docs coverage mode passed."
  fi
fi

log_info "Docs consistency check passed."
