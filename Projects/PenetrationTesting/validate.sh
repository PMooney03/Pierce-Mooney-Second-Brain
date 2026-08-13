#!/usr/bin/env bash
# enterprise-pentest-lab - Comprehensive validation suite
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/scripts/lib/common.sh"

PASS=0
FAIL=0
WARN=0

record_pass() { log_ok "$1"; ((PASS++)); }
record_fail() { log_error "$1"; ((FAIL++)); }
record_warn() { log_warn "$1"; ((WARN++)); }

ping_check() {
  local name="$1"
  local ip="$2"
  if ping -c 1 -W 3 "${ip}" &>/dev/null 2>&1; then
    record_pass "Ping: ${name} (${ip})"
  elif ping -n 1 -w 3000 "${ip}" &>/dev/null 2>&1; then
    record_pass "Ping: ${name} (${ip})"
  else
    record_fail "Ping: ${name} (${ip})"
  fi
}

ssh_check() {
  local name="$1"
  local ip="$2"
  local user="${3:-vagrant}"
  if command -v nc &>/dev/null; then
    if nc -z -w 3 "${ip}" 22 2>/dev/null; then
      record_pass "SSH port open: ${name} (${ip}:22)"
    else
      record_fail "SSH port closed: ${name} (${ip}:22)"
    fi
  elif timeout 3 bash -c "echo >/dev/tcp/${ip}/22" 2>/dev/null; then
    record_pass "SSH port open: ${name} (${ip}:22)"
  else
    record_warn "SSH port check skipped for ${name} (install nc or use bash /dev/tcp)"
  fi
}

http_check() {
  local name="$1"
  local url="$2"
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 5 "${url}" 2>/dev/null || echo "000")
  if [[ "${code}" =~ ^[23] ]]; then
    record_pass "HTTP ${name}: ${url} (${code})"
  else
    record_fail "HTTP ${name}: ${url} (code: ${code})"
  fi
}

web_check() {
  local name="$1"
  local port="$2"
  local code url
  for url in "http://${HOST_GATEWAY}:${port}/" "http://127.0.0.1:${port}/"; do
    code=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 5 "${url}" 2>/dev/null || echo "000")
    if [[ "${code}" =~ ^[23] ]]; then
      record_pass "HTTP ${name}: ${url} (${code})"
      return 0
    fi
  done
  record_fail "HTTP ${name}: port ${port} (gateway and localhost unreachable)"
}

api_health_check() {
  local name="$1"
  local url="$2"
  if curl -sf --connect-timeout 5 "${url}" | grep -qiE 'prometheus|healthy|ok|grafana'; then
    record_pass "API health: ${name}"
  else
    # Prometheus returns metrics text without keyword - check non-empty body
    if curl -sf --connect-timeout 5 "${url}" | head -c 20 | grep -q .; then
      record_pass "API health: ${name} (endpoint responsive)"
    else
      record_warn "API health: ${name} - optional or not running"
    fi
  fi
}

main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║     enterprise-pentest-lab - Validation                      ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  ensure_dirs
  cd_project

  echo "── ICMP Checks ─────────────────────────────────────────────────"
  ping_check "kali-attacker" "${KALI_IP}"
  ping_check "ubuntu-target" "${UBUNTU_IP}"
  ping_check "windows-server" "${WINDOWS_IP}"

  echo ""
  echo "── SSH Checks ──────────────────────────────────────────────────"
  ssh_check "kali-attacker" "${KALI_IP}" "vagrant"
  ssh_check "ubuntu-target" "${UBUNTU_IP}" "vagrant"
  ssh_check "windows-server" "${WINDOWS_IP}" "vagrant"

  echo ""
  echo "── Web Service Checks (gateway: ${HOST_GATEWAY}) ───────────────"
  web_check "DVWA" "${DVWA_PORT}"
  web_check "Juice Shop" "${JUICE_SHOP_PORT}"

  echo ""
  echo "── Monitoring Stack ────────────────────────────────────────────"
  api_health_check "Prometheus" "http://127.0.0.1:${PROMETHEUS_PORT}/-/healthy"
  api_health_check "Grafana" "http://127.0.0.1:${GRAFANA_PORT}/api/health"
  web_check "cAdvisor" "8081"

  if curl -sf --connect-timeout 5 "http://127.0.0.1:${PROMETHEUS_PORT}/api/v1/targets" | grep -q '"health":"up"'; then
    record_pass "Prometheus scrape targets: at least one UP"
  else
    record_warn "Prometheus targets not all UP - run: vagrant provision (node_exporter) and docker compose --profile monitoring up -d"
  fi

  echo ""
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  Results: PASS=${PASS}  FAIL=${FAIL}  WARN=${WARN}"
  echo "═══════════════════════════════════════════════════════════════════"

  if (( FAIL > 0 )); then
    exit 1
  fi
  exit 0
}

main "$@"
