#!/usr/bin/env bash
# enterprise-pentest-lab - Operational status dashboard
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/scripts/lib/common.sh"

show_vm_status() {
  echo ""
  echo "── Virtual Machine Status ──────────────────────────────────────"
  cd_project
  vagrant status 2>/dev/null || log_warn "Vagrant status unavailable"
}

show_docker_status() {
  echo ""
  echo "── Docker Container Status ─────────────────────────────────────"
  cd_project
  local dc
  dc=$(docker_compose_cmd)
  ${dc} -f docker-compose.yml --profile monitoring ps 2>/dev/null || docker ps --filter "name=epl-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

show_ip_assignments() {
  echo ""
  echo "── IP Assignments (Host-Only 192.168.56.0/24) ───────────────────"
  printf "  %-20s %s\n" "kali-attacker" "${KALI_IP}"
  printf "  %-20s %s\n" "ubuntu-target" "${UBUNTU_IP}"
  printf "  %-20s %s\n" "windows-server" "${WINDOWS_IP}"
  printf "  %-20s %s\n" "host-gateway" "${HOST_GATEWAY}"
}

quick_connectivity() {
  echo ""
  echo "── Quick Connectivity ──────────────────────────────────────────"
  for ip in "${KALI_IP}" "${UBUNTU_IP}" "${WINDOWS_IP}"; do
    if ping -c 1 -W 2 "${ip}" &>/dev/null 2>&1 || ping -n 1 -w 2000 "${ip}" &>/dev/null 2>&1; then
      log_ok "Ping ${ip}"
    else
      log_warn "Ping ${ip} - unreachable from host"
    fi
  done
}

main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║     enterprise-pentest-lab - Status                          ║"
  echo "╚══════════════════════════════════════════════════════════════╝"

  show_vm_status
  show_docker_status
  show_ip_assignments
  quick_connectivity
  print_access_table
  echo ""
}

main "$@"
