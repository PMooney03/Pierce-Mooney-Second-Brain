#!/usr/bin/env bash
# Detect VirtualBox host-only gateway IP for Docker access from lab VMs
detect_host_gateway() {
  if [[ -n "${LAB_HOST_GATEWAY:-}" ]]; then
    echo "${LAB_HOST_GATEWAY}"
    return 0
  fi
  if command -v VBoxManage &>/dev/null; then
    local ip
    ip=$(VBoxManage list hostonlyifs 2>/dev/null | awk '/^IPAddress:/ {print $2; exit}')
    if [[ -n "${ip}" ]]; then
      echo "${ip}"
      return 0
    fi
  fi
  echo "192.168.56.1"
}
