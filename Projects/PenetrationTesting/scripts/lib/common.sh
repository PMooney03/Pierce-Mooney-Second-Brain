#!/usr/bin/env bash
# enterprise-pentest-lab - Shared library functions
# shellcheck disable=SC2034

set -euo pipefail

PROJECT_NAME="enterprise-pentest-lab"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TMP_DIR="${PROJECT_ROOT}/tmp"
LAB_SUMMARY="${PROJECT_ROOT}/lab-summary.txt"

# Lab network constants
LAB_NETWORK="192.168.56.0/24"
KALI_IP="192.168.56.10"
UBUNTU_IP="192.168.56.20"
WINDOWS_IP="192.168.56.30"
# Host-only gateway (auto-detected from VirtualBox; override with LAB_HOST_GATEWAY)
# shellcheck source=scripts/lib/detect-gateway.sh
source "${PROJECT_ROOT}/scripts/lib/detect-gateway.sh"
HOST_GATEWAY="$(detect_host_gateway)"

DVWA_PORT=8080
JUICE_SHOP_PORT=3000
GRAFANA_PORT=3001
PROMETHEUS_PORT=9090

# VM names
VMS=(kali-attacker ubuntu-target windows-server)

# Colors (when terminal supports)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

require_command() {
  local cmd="$1"
  local hint="${2:-}"
  if ! command -v "${cmd}" &>/dev/null; then
    log_error "Required command not found: ${cmd}"
    [[ -n "${hint}" ]] && log_error "Hint: ${hint}"
    return 1
  fi
  return 0
}

ensure_dirs() {
  mkdir -p "${LOG_DIR}" "${TMP_DIR}"
}

cd_project() {
  cd "${PROJECT_ROOT}"
}

check_virtualization() {
  log_info "Checking virtualization support..."
  if [[ "$(uname -s)" == "Linux" ]]; then
    if [[ -e /dev/kvm ]] || grep -Eq '(vmx|svm)' /proc/cpuinfo 2>/dev/null; then
      log_ok "Virtualization extensions detected"
    else
      log_warn "Hardware virtualization may be unavailable (nested VT-x/AMD-V)"
    fi
  elif [[ "$(uname -s)" == "Darwin" ]]; then
    log_ok "macOS host - ensure VirtualBox has required permissions"
  else
    log_warn "Windows host - enable virtualization in BIOS and Hyper-V policy per README"
  fi
}

check_prerequisites() {
  log_info "Validating prerequisites..."
  local failed=0

  require_command "vagrant" "Install from https://www.vagrantup.com/downloads" || ((failed++))
  require_command "VBoxManage" "Install Oracle VirtualBox" || ((failed++))
  require_command "docker" "Install Docker Desktop or Docker Engine" || ((failed++))
  require_command "docker" "Docker Compose v2 is included with modern Docker CLI" || true

  if ! docker compose version &>/dev/null && ! docker-compose version &>/dev/null; then
    log_error "Docker Compose not available"
    ((failed++))
  fi

  if ! VBoxManage list hostonlyifs &>/dev/null; then
    log_warn "Unable to list VirtualBox host-only interfaces"
  else
    log_info "Detected host-only gateway: ${HOST_GATEWAY}"
  fi

  if (( failed > 0 )); then
    return 1
  fi
  log_ok "All prerequisites satisfied"
  return 0
}

docker_compose_cmd() {
  if docker compose version &>/dev/null 2>&1; then
    echo "docker compose"
  else
    echo "docker-compose"
  fi
}

start_docker_services() {
  cd_project
  local dc
  dc=$(docker_compose_cmd)

  log_info "Starting Docker web application stack..."
  ${dc} -f docker-compose.yml up -d dvwa dvwa-db juice-shop 2>&1 | tee -a "${LOG_DIR}/docker-setup.log" || {
    log_warn "DVWA/Juice Shop startup issue - check ${LOG_DIR}/docker-setup.log"
  }

  log_ok "Docker web services started"
}

start_monitoring_stack() {
  cd_project
  local dc
  dc=$(docker_compose_cmd)

  log_info "Starting monitoring stack (cAdvisor, Prometheus, Grafana)..."
  ${dc} -f docker-compose.yml --profile monitoring up -d cadvisor prometheus grafana 2>&1 | tee -a "${LOG_DIR}/docker-monitoring.log" || {
    log_warn "Monitoring stack issue - check ${LOG_DIR}/docker-monitoring.log"
  }

  log_ok "Monitoring stack started (Grafana: http://127.0.0.1:${GRAFANA_PORT}/)"
}

stop_docker_services() {
  cd_project
  local dc
  dc=$(docker_compose_cmd)
  log_info "Stopping Docker containers..."
  ${dc} -f docker-compose.yml --profile monitoring down --remove-orphans 2>&1 | tee -a "${LOG_DIR}/docker-destroy.log" || true
  log_ok "Docker containers stopped"
}

provision_vagrant() {
  cd_project
  log_info "Provisioning Vagrant infrastructure (this may take 30-60+ minutes on first run)..."
  vagrant up 2>&1 | tee -a "${LOG_DIR}/vagrant-provision.log"
  log_ok "Vagrant provisioning complete"
}

run_ansible_from_host() {
  cd_project
  if command -v ansible-playbook &>/dev/null; then
    log_info "Running Ansible playbook from host..."
    ansible-playbook -i ansible/inventory.ini ansible/site.yml 2>&1 | tee -a "${LOG_DIR}/ansible-provision.log" || {
      log_warn "Host-side Ansible run failed (guest provisioning may have already applied config)"
    }
  else
    log_warn "ansible-playbook not found on host - relying on Vagrant ansible_local provisioner"
  fi
}

print_access_table() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  ${PROJECT_NAME} - Service Access Table"
  echo "═══════════════════════════════════════════════════════════════════"
  printf "  %-22s %-18s %-8s %s\n" "SERVICE" "ADDRESS" "PORT" "NOTES"
  echo "  ─────────────────────────────────────────────────────────────────"
  printf "  %-22s %-18s %-8s %s\n" "Kali Attacker (SSH)" "${KALI_IP}" "22" "vagrant / (box default)"
  printf "  %-22s %-18s %-8s %s\n" "Ubuntu Target (SSH)" "${UBUNTU_IP}" "22" "labuser / labuser123"
  printf "  %-22s %-18s %-8s %s\n" "Windows Placeholder" "${WINDOWS_IP}" "22" "vagrant (placeholder mode)"
  printf "  %-22s %-18s %-8s %s\n" "DVWA" "${HOST_GATEWAY}" "${DVWA_PORT}" "admin / password (default DVWA)"
  printf "  %-22s %-18s %-8s %s\n" "OWASP Juice Shop" "${HOST_GATEWAY}" "${JUICE_SHOP_PORT}" "Web UI"
  printf "  %-22s %-18s %-8s %s\n" "Grafana (optional)" "${HOST_GATEWAY}" "${GRAFANA_PORT}" "admin / labadmin"
  printf "  %-22s %-18s %-8s %s\n" "Prometheus (optional)" "${HOST_GATEWAY}" "${PROMETHEUS_PORT}" "Metrics UI"
  echo "═══════════════════════════════════════════════════════════════════"
  echo ""
}

write_ansible_local_gateway() {
  cd_project
  cat > "${PROJECT_ROOT}/ansible/group_vars/local.yml" <<EOF
---
# Auto-generated by setup — host-only gateway for Docker access from VMs
docker_host_ip: "${HOST_GATEWAY}"
EOF
  log_ok "Wrote ansible/group_vars/local.yml (docker_host_ip=${HOST_GATEWAY})"
}

generate_lab_summary() {
  cd_project
  {
    echo "# ${PROJECT_NAME} - Lab Summary"
    echo "Generated: $(date -Iseconds 2>/dev/null || date)"
    echo ""
    echo "## Network"
    echo "- CIDR: ${LAB_NETWORK}"
    echo "- Kali: ${KALI_IP}"
    echo "- Ubuntu Target: ${UBUNTU_IP}"
    echo "- Windows Server: ${WINDOWS_IP}"
    echo ""
    echo "## Docker Web Apps"
    echo "- Host gateway: ${HOST_GATEWAY}"
    echo "- DVWA: http://${HOST_GATEWAY}:${DVWA_PORT}/ (also http://127.0.0.1:${DVWA_PORT}/)"
    echo "- Juice Shop: http://${HOST_GATEWAY}:${JUICE_SHOP_PORT}/ (also http://127.0.0.1:${JUICE_SHOP_PORT}/)"
    echo ""
    echo "## Quick Commands"
    echo "- vagrant ssh kali-attacker"
    echo "- vagrant ssh ubuntu-target"
    echo "- ./status.sh"
    echo "- ./validate.sh"
  } > "${LAB_SUMMARY}"
  log_ok "Lab summary written to ${LAB_SUMMARY}"
}
