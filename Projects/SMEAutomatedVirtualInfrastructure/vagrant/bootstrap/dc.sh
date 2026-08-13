#!/bin/bash

# Domain Controller bootstrap script
# Works for dc-1, dc-2, etc.
# Gets HOSTNAME and HOST_IP from Vagrant

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=provision-log.sh
source "${SCRIPT_DIR}/provision-log.sh"

# Get hostname and IP from Vagrant (passed as positional arguments)
# $1 = hostname (e.g. "dc-1"), $2 = IP (e.g. "192.168.56.10"), $3 = instance number
HOSTNAME=${1:-${HOSTNAME:-$(hostname)}}
HOST_IP=${2:-${HOST_IP:-$(ip route get 1 | awk '{print $7;exit}')}}

echo "Setting up Domain Controller: $HOSTNAME ($HOST_IP)"

# Make package installs non-interactive
echo "Setting up non-interactive package installation..."
export DEBIAN_FRONTEND=noninteractive

# Pre-configure packages to avoid prompts
debconf-set-selections <<EOF
slapd slapd/password1 password Admin123!
slapd slapd/password2 password Admin123!
slapd slapd/domain string sme.local
slapd shared/organization string SME Infrastructure
slapd slapd/backend select MDB
slapd slapd/purge_database boolean true
slapd slapd/allow_ldap_v2 boolean false
slapd slapd/no_configuration boolean false
krb5-config krb5-config/default_realm string SME.LOCAL
krb5-config krb5-config/kerberos_servers string dc-1.sme.local dc-2.sme.local
krb5-config krb5-config/admin_server string dc-1.sme.local
krb5-config krb5-config/add_servers boolean true
krb5-config krb5-config/read_conf boolean true
EOF

# Set env vars for interactive packages
export SLAPD_CONF_PASSWORD=Admin123!
export SLAPD_CONF_PASSWORD_AGAIN=Admin123!
export SLAPD_CONF_NO_CONFIGURATION=no
export SLAPD_CONF_DOMAIN=sme.local

# Update system
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install domain controller packages
echo "Installing domain controller packages..."
apt-get install -y bind9 bind9utils ldap-utils krb5-kdc krb5-admin-server squid slapd prometheus-node-exporter

# Reset environment variable after installation
unset DEBIAN_FRONTEND

# Set hostname
echo "Setting hostname to $HOSTNAME..."
hostnamectl set-hostname $HOSTNAME

# SSH jump key for daisy-chain access - create early so other hosts can use it
echo "Setting up SSH jump key for daisy-chain access..."
mkdir -p /vagrant/ssh-jump
if [ ! -f /vagrant/ssh-jump/id_ed25519 ]; then
  ssh-keygen -t ed25519 -f /vagrant/ssh-jump/id_ed25519 -N "" -C "sme-dc-jump"
fi

# Add infra hosts for SSH resolution (before DNS is ready)
grep -q "192.168.56.20" /etc/hosts || cat >> /etc/hosts << 'HOSTSEOF'

# SME Infrastructure (for SSH daisy-chain)
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
HOSTSEOF

# Configure Squid proxy (gateway)
echo "Configuring Squid proxy..."
cat > /etc/squid/squid.conf << EOF
http_port 3128
http_access allow all
cache_dir ufs /var/spool/squid 100 16 256
coredump_dir /var/spool/squid
refresh_pattern ^ftp:           1440    20%     10080
refresh_pattern ^gopher:        1440    0%      1440
refresh_pattern -i (/cgi-bin/|\?) 0     0%      0
refresh_pattern .               0       20%     4320
EOF

# Configure Squid to start on boot
systemctl enable squid
systemctl start squid

# Configure iptables for routing
echo "Configuring iptables routing..."
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -A FORWARD -i eth1 -o eth0 -j ACCEPT
iptables -A FORWARD -i eth0 -o eth1 -m state --state RELATED,ESTABLISHED -j ACCEPT

# Save iptables rules
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# Configure basic DNS
echo "Configuring DNS..."
cat > /etc/bind/named.conf.local << EOF
zone "sme.local" {
    type master;
    file "/etc/bind/zones/sme.local";
};
EOF

mkdir -p /etc/bind/zones
cat > /etc/bind/zones/sme.local << EOF
\$TTL    604800
@       IN      SOA     dc-1.sme.local. admin.sme.local. (
                     2023120101         ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
;
@       IN      NS      dc-1.sme.local.
@       IN      A       192.168.56.10
dc-1    IN      A       192.168.56.10
dc-2    IN      A       192.168.56.11
fw-1    IN      A       192.168.56.3
fw-2    IN      A       192.168.56.2
web-1   IN      A       192.168.56.30
web-2   IN      A       192.168.56.31
mgmt-1  IN      A       192.168.56.50
mgmt-2  IN      A       192.168.56.51
EOF

# Verify LDAP config (should be set by debconf)
echo "Verifying LDAP configuration..."
systemctl stop slapd 2>/dev/null || true

# Ensure proper permissions
mkdir -p /var/lib/ldap
chown openldap:openldap /var/lib/ldap
chmod 750 /var/lib/ldap

# Start and enable services
echo "Starting domain controller services..."
systemctl enable named
systemctl start named
systemctl enable slapd
systemctl start slapd
systemctl enable prometheus-node-exporter
systemctl start prometheus-node-exporter

# Create admin user (idempotent for re-provisioning)
echo "Creating admin user..."
if ! getent passwd sme-admin >/dev/null 2>&1; then
  useradd -m -s /bin/bash sme-admin
fi
echo "sme-admin:Admin123!" | chpasswd
usermod -aG sudo sme-admin 2>/dev/null || true

# Test services
echo "Testing domain controller services..."
systemctl is-active named > /dev/null && echo "✅ DNS service is running" || echo "❌ DNS service failed"
systemctl is-active slapd > /dev/null && echo "✅ LDAP service is running" || echo "❌ LDAP service failed"
systemctl is-active squid > /dev/null && echo "✅ Proxy service is running" || echo "❌ Proxy service failed"
systemctl is-active prometheus-node-exporter > /dev/null && echo "✅ Node Exporter is running" || echo "❌ Node Exporter failed"

# Install jump key on DC for outgoing SSH to other hosts, and allow mgmt-1 to SSH in with same key
mkdir -p /home/vagrant/.ssh
chmod 700 /home/vagrant/.ssh
cp /vagrant/ssh-jump/id_ed25519 /home/vagrant/.ssh/id_ed25519
chmod 600 /home/vagrant/.ssh/id_ed25519
if [ -f /vagrant/ssh-jump/id_ed25519.pub ]; then
  grep -qF "$(cat /vagrant/ssh-jump/id_ed25519.pub)" /home/vagrant/.ssh/authorized_keys 2>/dev/null || cat /vagrant/ssh-jump/id_ed25519.pub >> /home/vagrant/.ssh/authorized_keys
  chmod 600 /home/vagrant/.ssh/authorized_keys
fi
chown -R vagrant:vagrant /home/vagrant/.ssh
# SSH config: no host key check for internal network
cat > /home/vagrant/.ssh/config << 'SSHEOF'
Host 192.168.56.* fw-1 fw-2 dc-1 dc-2 filesrv-1 filesrv-2 web-1 web-2 monitor-1 log-1 mgmt-1 mgmt-2
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
SSHEOF
chown vagrant:vagrant /home/vagrant/.ssh/config
chmod 600 /home/vagrant/.ssh/config
echo "✅ SSH jump key installed - use 'ssh vagrant@web-1' etc. from DC"

echo "✅ Domain Controller $HOSTNAME setup complete!"
echo "DNS: bind9 service running"
echo "LDAP: slapd service running"
echo "Proxy: Squid running on port 3128"
echo "Routing: iptables configured for gateway functionality" 