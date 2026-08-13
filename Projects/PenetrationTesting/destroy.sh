#!/usr/bin/env bash
# enterprise-pentest-lab - Safe lab teardown
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/scripts/lib/common.sh"

FORCE="${FORCE:-false}"

confirm_destroy() {
  if [[ "${FORCE}" == "true" ]]; then
    return 0
  fi
  echo ""
  log_warn "This will destroy all lab VMs and stop Docker containers."
  read -r -p "Continue? [y/N]: " response
  case "${response}" in
    y|Y|yes|YES) return 0 ;;
    *) log_info "Aborted."; exit 0 ;;
  esac
}

clean_temp_files() {
  cd_project
  log_info "Cleaning temporary files..."
  rm -rf "${TMP_DIR:?}"/*
  rm -f .connectivity-cache 2>/dev/null || true
  # Preserve logs for troubleshooting; truncate large logs optionally
  log_ok "Temporary files cleaned"
}

main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║     enterprise-pentest-lab - Destroy                         ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  confirm_destroy
  ensure_dirs
  cd_project

  log_info "Stopping Docker containers..."
  stop_docker_services

  log_info "Destroying Vagrant VMs..."
  vagrant destroy -f 2>&1 | tee -a "${LOG_DIR}/vagrant-destroy.log" || {
    log_warn "Vagrant destroy encountered issues - check ${LOG_DIR}/vagrant-destroy.log"
  }

  clean_temp_files

  log_ok "Lab destroyed successfully."
  echo ""
}

main "$@"
