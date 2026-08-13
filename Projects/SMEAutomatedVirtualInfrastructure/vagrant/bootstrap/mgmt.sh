#!/bin/bash

# Management Server bootstrap script
# Works for mgmt-1, mgmt-2, etc.
# Gets HOSTNAME and HOST_IP from Vagrant

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=provision-log.sh
source "${SCRIPT_DIR}/provision-log.sh"

# Get hostname and IP from Vagrant (passed as positional arguments)
# $1 = hostname (e.g. "mgmt-1"), $2 = IP (e.g. "192.168.56.50"), $3 = instance number
HOSTNAME=${1:-${HOSTNAME:-$(hostname)}}
HOST_IP=${2:-${HOST_IP:-$(ip route get 1 | awk '{print $7;exit}')}}

echo "Setting up Management Server: $HOSTNAME ($HOST_IP)"

# Update system
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Pre-configure to avoid prompts
echo "Pre-configuring management packages..."
export DEBIAN_FRONTEND=noninteractive

# Install Ansible and management tools
echo "Installing management tools..."
apt-get install -y ansible python3-pip git vim htop prometheus-node-exporter
systemctl enable prometheus-node-exporter
systemctl start prometheus-node-exporter

# Install additional Python packages
echo "Installing Python packages..."
pip3 install boto3 paramiko

# Set hostname
echo "Setting hostname to $HOSTNAME..."
hostnamectl set-hostname $HOSTNAME

# Create Ansible configuration
echo "Configuring Ansible..."
mkdir -p /etc/ansible
cat > /etc/ansible/ansible.cfg << EOF
[defaults]
inventory = /etc/ansible/hosts
remote_user = vagrant
host_key_checking = False
timeout = 30
gathering = smart
fact_caching = memory
EOF

# Create inventory file
echo "Creating Ansible inventory..."
cat > /etc/ansible/hosts << EOF
[firewalls]
fw-1 ansible_host=192.168.56.3
fw-2 ansible_host=192.168.56.2

[domain_controllers]
dc-1 ansible_host=192.168.56.10
dc-2 ansible_host=192.168.56.11

[file_servers]
filesrv-1 ansible_host=192.168.56.20
filesrv-2 ansible_host=192.168.56.21

[web_servers]
web-1 ansible_host=192.168.56.30
web-2 ansible_host=192.168.56.31

[monitoring]
monitor-1 ansible_host=192.168.56.40

[logging]
log-1 ansible_host=192.168.56.41

[management]
mgmt-1 ansible_host=192.168.56.50
mgmt-2 ansible_host=192.168.56.51

[all:vars]
ansible_python_interpreter=/usr/bin/python3
EOF

# Configure hostname resolution
echo "Configuring hostname resolution..."

# Backup existing hosts file
cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)

# Add infrastructure hostnames to /etc/hosts
cat >> /etc/hosts << EOF

# SME Infrastructure Hosts
192.168.56.3    fw-1
192.168.56.2    fw-2
192.168.56.10   dc-1
192.168.56.11   dc-2
192.168.56.20   filesrv-1
192.168.56.21   filesrv-2
192.168.56.30   web-1
192.168.56.31   web-2
192.168.56.40   monitor-1
192.168.56.41   log-1
192.168.56.50   mgmt-1
192.168.56.51   mgmt-2

# Alternative short names
192.168.56.3    fw1
192.168.56.2    fw2
192.168.56.10   dc1
192.168.56.11   dc2
192.168.56.20   fs1
192.168.56.21   fs2
192.168.56.30   web1
192.168.56.31   web2
192.168.56.40   mon1
192.168.56.41   log1
192.168.56.50   mgmt1
192.168.56.51   mgmt2
EOF

# Create management scripts directory
echo "Creating management scripts directory..."
mkdir -p /opt/sme/scripts

# Create basic management script
cat > /opt/sme/scripts/check_status.sh << EOF
#!/bin/bash
echo "=== SME Infrastructure Status ==="
echo "Checking all hosts..."
ansible all -m ping
echo "=== System Information ==="
ansible all -m setup -a "filter=ansible_distribution*"
EOF

chmod +x /opt/sme/scripts/check_status.sh

# Create admin user (idempotent for re-provisioning)
echo "Creating admin user..."
if ! getent passwd sme-admin >/dev/null 2>&1; then
  useradd -m -s /bin/bash sme-admin
fi
echo "sme-admin:Admin123!" | chpasswd
usermod -aG sudo sme-admin 2>/dev/null || true

# Test hostname resolution
echo "Testing hostname resolution..."
ping -c 1 dc-1 > /dev/null && echo "✅ dc-1 resolution works" || echo "❌ dc-1 resolution failed"
ping -c 1 dc-2 > /dev/null && echo "✅ dc-2 resolution works" || echo "❌ dc-2 resolution failed"
ping -c 1 web-1 > /dev/null && echo "✅ web-1 resolution works" || echo "❌ web-1 resolution failed"

# Allow DC daisy-chain SSH access
echo "Setting up SSH jump key for DC access..."
mkdir -p /home/vagrant/.ssh
chmod 700 /home/vagrant/.ssh
for i in $(seq 1 72); do
  if [ -f /vagrant/ssh-jump/id_ed25519.pub ]; then
    grep -qF "$(cat /vagrant/ssh-jump/id_ed25519.pub)" /home/vagrant/.ssh/authorized_keys 2>/dev/null || cat /vagrant/ssh-jump/id_ed25519.pub >> /home/vagrant/.ssh/authorized_keys
    chmod 600 /home/vagrant/.ssh/authorized_keys
    chown -R vagrant:vagrant /home/vagrant/.ssh
    # Install private key for Ansible (so ansible/ansible-playbook from mgmt-1 can reach all hosts)
    if [ -f /vagrant/ssh-jump/id_ed25519 ]; then
      cp /vagrant/ssh-jump/id_ed25519 /home/vagrant/.ssh/sme_jump_key
      chmod 600 /home/vagrant/.ssh/sme_jump_key
      chown vagrant:vagrant /home/vagrant/.ssh/sme_jump_key
    fi
    # Use project inventory and key when running Ansible (avoids world-writable /sme-ansible cfg being ignored)
    mkdir -p /home/vagrant/.ansible
    cat > /home/vagrant/.ansible/sme-ansible.cfg << 'ANSCFG'
[defaults]
inventory = /sme-ansible/inventory/hosts.yml
private_key_file = /home/vagrant/.ssh/sme_jump_key
roles_path = /sme-ansible/roles
ANSCFG
    grep -q 'ANSIBLE_CONFIG=/home/vagrant/.ansible/sme-ansible.cfg' /home/vagrant/.bashrc 2>/dev/null || echo 'export ANSIBLE_CONFIG=/home/vagrant/.ansible/sme-ansible.cfg' >> /home/vagrant/.bashrc
    chown -R vagrant:vagrant /home/vagrant/.ansible
    echo "✅ SSH jump key installed (DC can connect)"
    echo "✅ Ansible key and config set (ansible/ansible-playbook from /sme-ansible will work)"
    break
  fi
  echo "  Waiting for DC jump key... ($i/72)"
  sleep 5
done

echo "✅ Management Server $HOSTNAME setup complete!"
echo "Hostname resolution configured - you can now use: ping dc-2, ssh web-1, etc."
echo "Available commands:"
echo "   • ansible all -m ping"
echo "   • /opt/sme/scripts/check_status.sh"
echo "   • ssh vagrant@dc-1" 