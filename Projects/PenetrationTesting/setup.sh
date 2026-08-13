#!/usr/bin/env bash
# enterprise-pentest-lab - Full lab deployment orchestration
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/scripts/lib/common.sh"

ENABLE_MONITORING="${ENABLE_MONITORING:-true}"
SKIP_VAGRANT="${SKIP_VAGRANT:-false}"

main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║     enterprise-pentest-lab - Automated Setup                 ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  ensure_dirs
  cd_project

  log_info "Phase 1/6: Prerequisites"
  check_prerequisites
  check_virtualization
  write_ansible_local_gateway

  log_info "Phase 2/6: Docker web services"
  start_docker_services

  if [[ "${SKIP_VAGRANT}" != "true" ]]; then
    log_info "Phase 3/6: Vagrant infrastructure"
    provision_vagrant

    log_info "Phase 4/6: Ansible provisioning"
    run_ansible_from_host
  else
    log_warn "SKIP_VAGRANT=true - skipping VM provisioning"
  fi

  if [[ "${ENABLE_MONITORING}" == "true" ]]; then
    log_info "Phase 5/6: Monitoring stack (after node_exporter on VMs)"
    start_monitoring_stack
  else
    log_warn "ENABLE_MONITORING=false - skipping Prometheus/Grafana"
  fi

  log_info "Phase 6/6: Generating lab artifacts"
  print_access_table
  generate_lab_summary

  echo ""
  log_ok "Setup complete. Run ./validate.sh to verify connectivity."
  echo ""
}

main "$@"
