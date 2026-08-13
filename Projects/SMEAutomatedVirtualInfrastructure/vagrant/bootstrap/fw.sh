#!/bin/bash

# Firewall bootstrap script
# Works for fw-1, fw-2, etc.
# Gets HOSTNAME and HOST_IP from Vagrant

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=provision-log.sh
source "${SCRIPT_DIR}/provision-log.sh"

# Get hostname and IP from Vagrant (passed as positional arguments)
# $1 = hostname (e.g. "fw-1"), $2 = IP (e.g. "192.168.56.1"), $3 = instance number
HOSTNAME=${1:-${HOSTNAME:-$(hostname)}}
HOST_IP=${2:-${HOST_IP:-$(ip route get 1 | awk '{print $7;exit}')}}

echo "Setting up Firewall: $HOSTNAME ($HOST_IP)"

# Update system
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Pre-configure iptables-persistent to avoid prompts
echo "Pre-configuring iptables-persistent..."
export DEBIAN_FRONTEND=noninteractive
echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections

# Install firewall packages
echo "Installing firewall packages..."
apt-get install -y ufw iptables-persistent netfilter-persistent prometheus-node-exporter

# Set hostname
echo "Setting hostname to $HOSTNAME..."
hostnamectl set-hostname $HOSTNAME

# Configure UFW (Uncomplicated Firewall)
echo "Configuring UFW firewall..."

# Reset UFW to default
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow the project network (192.168.56.0/24) for management, monitoring, logging, and Ansible (includes ping)
ufw allow from 192.168.56.0/24 comment 'Project management/monitoring/logging'

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow DNS
ufw allow 53/tcp
ufw allow 53/udp

# Allow LDAP
ufw allow 389/tcp
ufw allow 636/tcp

# Allow Kerberos
ufw allow 88/tcp
ufw allow 88/udp

# Allow NTP
ufw allow 123/udp

# Allow SMTP
ufw allow 25/tcp
ufw allow 587/tcp

# Allow IMAP/POP3
ufw allow 143/tcp
ufw allow 993/tcp
ufw allow 110/tcp
ufw allow 995/tcp

# Allow Squid proxy (for DC gateway)
ufw allow 3128/tcp

# Allow NFS
ufw allow 2049/tcp
ufw allow 2049/udp

# Allow Samba
ufw allow 137/udp
ufw allow 138/udp
ufw allow 139/tcp
ufw allow 445/tcp

# Allow GlusterFS
ufw allow 24007/tcp
ufw allow 24008/tcp
ufw allow 49152:49251/tcp

# Allow monitoring ports
ufw allow 9090/tcp  # Prometheus
ufw allow 3000/tcp  # Grafana
ufw allow 9100/tcp  # Node Exporter
ufw allow 9200/tcp  # Elasticsearch
ufw allow 5601/tcp  # Kibana

# Enable UFW
ufw --force enable

# Configure iptables for additional security
echo "Configuring iptables rules..."

# Basic iptables rules
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Rate limiting for SSH
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set --name SSH
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 --name SSH -j DROP

# Save iptables rules
iptables-save > /etc/iptables/rules.v4

# Start and enable node exporter for central monitoring
systemctl enable prometheus-node-exporter
systemctl start prometheus-node-exporter

# Create admin user (idempotent for re-provisioning)
echo "Creating admin user..."
if ! getent passwd sme-admin >/dev/null 2>&1; then
  useradd -m -s /bin/bash sme-admin
fi
echo "sme-admin:Admin123!" | chpasswd
usermod -aG sudo sme-admin 2>/dev/null || true

# Test firewall
echo "Testing firewall configuration..."
ufw status verbose | head -20

# Allow DC daisy-chain SSH access
echo "Setting up SSH jump key for DC access..."
mkdir -p /home/vagrant/.ssh
chmod 700 /home/vagrant/.ssh
for i in $(seq 1 72); do
  if [ -f /vagrant/ssh-jump/id_ed25519.pub ]; then
    grep -qF "$(cat /vagrant/ssh-jump/id_ed25519.pub)" /home/vagrant/.ssh/authorized_keys 2>/dev/null || cat /vagrant/ssh-jump/id_ed25519.pub >> /home/vagrant/.ssh/authorized_keys
    chmod 600 /home/vagrant/.ssh/authorized_keys
    chown -R vagrant:vagrant /home/vagrant/.ssh
    echo "✅ SSH jump key installed (DC can connect)"
    break
  fi
  echo "  Waiting for DC jump key... ($i/72)"
  sleep 5
done

echo "✅ Firewall $HOSTNAME setup complete!"
echo "UFW: Enabled with comprehensive rules"
echo "iptables: Additional security rules configured"
echo "Rate limiting: SSH brute force protection enabled" 