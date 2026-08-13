#!/bin/bash

# File Server bootstrap script
# Works for filesrv-1, filesrv-2, etc.
# Gets HOSTNAME and HOST_IP from Vagrant

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=provision-log.sh
source "${SCRIPT_DIR}/provision-log.sh"

# Get hostname and IP from Vagrant (passed as positional arguments)
# $1 = hostname (e.g. "filesrv-1"), $2 = IP (e.g. "192.168.56.20"), $3 = instance number
HOSTNAME=${1:-${HOSTNAME:-$(hostname)}}
HOST_IP=${2:-${HOST_IP:-$(ip route get 1 | awk '{print $7;exit}')}}

echo "Setting up File Server: $HOSTNAME ($HOST_IP)"

# Update system
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Pre-configure to avoid prompts
echo "Pre-configuring file server packages..."
export DEBIAN_FRONTEND=noninteractive

# Install file server packages
echo "Installing file server packages..."
apt-get install -y nfs-kernel-server samba samba-common glusterfs-server prometheus-node-exporter

# Set hostname
echo "Setting hostname to $HOSTNAME..."
hostnamectl set-hostname $HOSTNAME

# Create shared directories
echo "Creating shared directories..."
mkdir -p /srv/shares/{public,private,backup,home}
mkdir -p /srv/shares/public/{documents,media,software}
mkdir -p /srv/shares/private/{finance,hr,legal}
mkdir -p /srv/shares/backup/{daily,weekly,monthly}

# Set permissions
chown -R nobody:nogroup /srv/shares/public
chmod -R 755 /srv/shares/public
chown -R root:root /srv/shares/private
chmod -R 700 /srv/shares/private
chown -R root:root /srv/shares/backup
chmod -R 700 /srv/shares/backup

# Configure NFS
echo "Configuring NFS..."
cat > /etc/exports << EOF
/srv/shares/public    192.168.56.0/24(ro,sync,no_subtree_check)
/srv/shares/private   192.168.56.0/24(rw,sync,no_subtree_check)
/srv/shares/backup    192.168.56.0/24(rw,sync,no_subtree_check)
/srv/shares/home      192.168.56.0/24(rw,sync,no_subtree_check)
EOF

# Configure Samba
echo "Configuring Samba..."
cat > /etc/samba/smb.conf << EOF
[global]
   workgroup = SME
   server string = SME File Server
   security = user
   map to guest = bad user
   dns proxy = no
   log level = 1

[public]
   comment = Public Share
   path = /srv/shares/public
   browseable = yes
   writable = yes
   guest ok = yes
   read only = no
   create mask = 0644
   directory mask = 0755

[private]
   comment = Private Share
   path = /srv/shares/private
   browseable = yes
   writable = yes
   guest ok = no
   valid users = sme-admin
   create mask = 0640
   directory mask = 0750

[backup]
   comment = Backup Share
   path = /srv/shares/backup
   browseable = yes
   writable = yes
   guest ok = no
   valid users = sme-admin
   create mask = 0640
   directory mask = 0750

[home]
   comment = Home Directories
   path = /srv/shares/home
   browseable = yes
   writable = yes
   guest ok = no
   valid users = %S
   create mask = 0644
   directory mask = 0755
EOF

# Configure GlusterFS
echo "Configuring GlusterFS..."
mkdir -p /var/lib/glusterd
mkdir -p /srv/glusterfs

# Start and enable services
echo "Starting file server services..."
systemctl enable nfs-kernel-server
systemctl start nfs-kernel-server
systemctl enable smbd
systemctl start smbd
systemctl enable nmbd
systemctl start nmbd
systemctl enable glusterd
systemctl start glusterd
systemctl enable prometheus-node-exporter
systemctl start prometheus-node-exporter

# Export NFS shares
exportfs -ra

# Create admin user FIRST (idempotent for re-provisioning)
echo "Creating admin user..."
if ! getent passwd sme-admin >/dev/null 2>&1; then
  useradd -m -s /bin/bash sme-admin
fi
echo "sme-admin:Admin123!" | chpasswd
usermod -aG sudo sme-admin 2>/dev/null || true

# Create Samba user SECOND (after system user exists)
echo "Creating Samba user..."
echo -e "Admin123!\nAdmin123!" | smbpasswd -a sme-admin -s

# Create sample files
echo "Creating sample files..."
echo "Welcome to the SME Infrastructure File Server!" > /srv/shares/public/documents/welcome.txt
echo "This is a private document." > /srv/shares/private/private_doc.txt
echo "Backup configuration" > /srv/shares/backup/backup_config.txt

# Set proper ownership
chown sme-admin:sme-admin /srv/shares/private/private_doc.txt
chown sme-admin:sme-admin /srv/shares/backup/backup_config.txt

# Configure firewall for file services
echo "Configuring firewall for file services..."
ufw allow 2049/tcp  # NFS
ufw allow 2049/udp  # NFS
ufw allow 137/udp   # Samba
ufw allow 138/udp   # Samba
ufw allow 139/tcp   # Samba
ufw allow 445/tcp   # Samba
ufw allow 24007/tcp # GlusterFS
ufw allow 24008/tcp # GlusterFS
ufw allow 49152:49251/tcp # GlusterFS

# Test services
echo "Testing file server services..."
systemctl is-active nfs-kernel-server > /dev/null && echo "✅ NFS service is running" || echo "❌ NFS service failed"
systemctl is-active smbd > /dev/null && echo "✅ Samba service is running" || echo "❌ Samba service failed"
systemctl is-active glusterd > /dev/null && echo "✅ GlusterFS service is running" || echo "❌ GlusterFS service failed"
systemctl is-active prometheus-node-exporter > /dev/null && echo "✅ Node Exporter is running" || echo "❌ Node Exporter failed"

# Show available shares
echo "Available shares:"
echo "   • NFS: /srv/shares/public (read-only)"
echo "   • NFS: /srv/shares/private (read-write)"
echo "   • NFS: /srv/shares/backup (read-write)"
echo "   • NFS: /srv/shares/home (read-write)"
echo "   • Samba: \\\\$HOST_IP\\public"
echo "   • Samba: \\\\$HOST_IP\\private"
echo "   • Samba: \\\\$HOST_IP\\backup"
echo "   • Samba: \\\\$HOST_IP\\home"

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

echo "✅ File Server $HOSTNAME setup complete!"
echo "NFS: Multiple shares configured"
echo "Samba: Windows-compatible shares"
echo "GlusterFS: Distributed storage ready" 