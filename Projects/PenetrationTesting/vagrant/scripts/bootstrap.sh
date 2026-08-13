#!/usr/bin/env bash
# Bootstrap script - prepares guest for Ansible local provisioning
set -euo pipefail

HOST_ROLE="${1:-unknown}"
export DEBIAN_FRONTEND=noninteractive

echo "[bootstrap] Preparing ${HOST_ROLE} for Ansible provisioning..."

# Install Python and Ansible dependencies (Debian/Ubuntu family)
if command -v apt-get &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq \
    python3 \
    python3-apt \
    python3-pip \
    ansible \
    openssh-server \
    curl \
    ca-certificates \
    net-tools \
    iputils-ping
fi

# Ensure SSH is running for post-provision validation
# Kali/Debian often use socket-activated ssh.socket instead of ssh.service
if systemctl list-unit-files 'ssh.socket' &>/dev/null; then
  systemctl enable ssh.socket 2>/dev/null || true
  systemctl start ssh.socket 2>/dev/null || true
fi
if systemctl list-unit-files 'ssh.service' &>/dev/null; then
  systemctl enable ssh.service 2>/dev/null || true
  systemctl start ssh.service 2>/dev/null || true
fi
# Legacy unit names
systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null || true
systemctl start ssh 2>/dev/null || systemctl start sshd 2>/dev/null || true

# Lab marker file for validation scripts
mkdir -p /etc/enterprise-pentest-lab
echo "${HOST_ROLE}" > /etc/enterprise-pentest-lab/role
echo "$(date -Iseconds)" > /etc/enterprise-pentest-lab/bootstrap-timestamp

# Passwordless sudo for vagrant user (required by ansible_local provisioner)
if id vagrant &>/dev/null; then
  install -m 0440 /dev/null /etc/sudoers.d/vagrant
  echo 'vagrant ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/vagrant
  chmod 440 /etc/sudoers.d/vagrant
  visudo -cf /etc/sudoers.d/vagrant
fi

echo "[bootstrap] ${HOST_ROLE} bootstrap complete."
