#!/bin/bash

# Logging Server bootstrap script
# Works for log-1, log-2, etc.
# Gets HOSTNAME and HOST_IP from Vagrant

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=provision-log.sh
source "${SCRIPT_DIR}/provision-log.sh"

# Get hostname and IP from Vagrant (passed as positional arguments)
# $1 = hostname (e.g. "log-1"), $2 = IP (e.g. "192.168.56.41"), $3 = instance number
HOSTNAME=${1:-${HOSTNAME:-$(hostname)}}
HOST_IP=${2:-${HOST_IP:-$(ip route get 1 | awk '{print $7;exit}')}}

echo "Setting up Logging Server: $HOSTNAME ($HOST_IP)"

# Pre-configure packages to avoid interactive prompts
export DEBIAN_FRONTEND=noninteractive

# Tune SSH first so Vagrant stays connected during heavy apt/ELK work (avoids "timeout during server version negotiating")
echo "Tuning SSH for responsive connections during provisioning..."
for key in UseDNS GSSAPIAuthentication; do
  if grep -q "^${key}" /etc/ssh/sshd_config 2>/dev/null; then
    sed -i "s/^${key}.*/${key} no/" /etc/ssh/sshd_config
  else
    echo "${key} no" >> /etc/ssh/sshd_config
  fi
done
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true

# Update system (retry: first boot can be slow or apt locked)
echo "Updating system packages..."
for i in {1..3}; do
  if apt-get update; then
    echo "✅ Initial package lists updated"
    break
  fi
  echo "⚠️  apt-get update failed, retrying in 30s... (attempt $i/3)"
  sleep 30
done
apt-get upgrade -y || true

# Install basic packages first (retry: network/lock can fail on first run)
echo "Installing basic packages (nginx, wget, etc.)..."
for i in {1..3}; do
  if apt-get install -y wget curl apt-transport-https gnupg2 nginx ufw prometheus-node-exporter; then
    echo "✅ Basic packages installed"
    break
  fi
  echo "⚠️  Basic package install failed, retrying in 30s... (attempt $i/3)"
  sleep 30
done
if ! dpkg -l nginx 2>/dev/null | grep -q '^ii'; then
  echo "❌ nginx could not be installed after 3 attempts. Run: vagrant provision log-1"
  exit 1
fi

# Ensure swap exists so Elasticsearch is less likely to be OOM-killed
if ! grep -q '/swapfile' /etc/fstab 2>/dev/null; then
  echo "Configuring 2G swap for Elasticsearch..."
  if ! fallocate -l 2G /swapfile 2>/dev/null; then
    # fallocate may not be available on all filesystems; fall back to dd
    dd if=/dev/zero of=/swapfile bs=1M count=2048
  fi
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile || true
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "Swapfile already configured, skipping."
fi

# Add Elastic repository (retry: network can be slow on first run)
echo "Adding Elastic repository..."
for i in {1..3}; do
  if wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | gpg --dearmor -o /etc/apt/keyrings/elasticsearch.gpg; then
    echo "✅ Elastic GPG key installed"
    break
  fi
  echo "⚠️  wget Elastic key failed, retrying in 30s... (attempt $i/3)"
  sleep 30
done
echo "deb [signed-by=/etc/apt/keyrings/elasticsearch.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" > /etc/apt/sources.list.d/elastic-8.x.list

# Update package list with retry logic
echo "📦 Updating package lists..."
for i in {1..3}; do
    if apt-get update; then
        echo "✅ Package lists updated successfully"
        break
    else
        echo "⚠️  Package update failed, retrying in 30 seconds... (attempt $i/3)"
        sleep 30
    fi
done

# Install logging packages (retry ELK once: often slow on first run)
echo "Installing logging packages..."
apt-get install -y rsyslog || echo "⚠️ rsyslog already installed"
for attempt in 1 2; do
  if apt-get install -y elasticsearch kibana logstash 2>/dev/null; then
    echo "✅ ELK stack installed"
    break
  fi
  if [ "$attempt" -eq 1 ]; then
    echo "⚠️  ELK install failed, retrying in 45s..."
    sleep 45
  else
    echo "❌ ELK install failed after 2 attempts; trying individual packages..."
    apt-get install -y elasticsearch || echo "⚠️ Elasticsearch install failed"
    apt-get install -y kibana || echo "⚠️ Kibana install failed"
    apt-get install -y logstash || echo "⚠️ Logstash install failed"
  fi
done

# Set hostname
echo "Setting hostname to $HOSTNAME..."
hostnamectl set-hostname $HOSTNAME

# Configure rsyslog
echo "Configuring rsyslog..."
cat > /etc/rsyslog.conf << EOF
# /etc/rsyslog.conf configuration file for rsyslog
#
# For more information install rsyslog-doc and see
# /usr/share/doc/rsyslog-doc/html/configuration/index.html

#################
#### MODULES ####
#################

module(load="imuxsock") # provides support for local system logging
module(load="imklog")   # provides kernel logging support
module(load="imudp")    # provides UDP syslog reception
module(load="imtcp")    # provides TCP syslog reception

###########################
#### GLOBAL DIRECTIVES ####
###########################

# Use traditional timestamp format.
\$ActionFileDefaultTemplate RSYSLOG_TraditionalFileFormat

# Set the default permissions for all log files.
\$FileOwner syslog
\$FileGroup adm
\$FileCreateMode 0640
\$DirCreateMode 0755
\$Umask 0022
\$PrivDropToUser syslog
\$PrivDropToGroup syslog

# Where to place spool and state files
\$WorkDirectory /var/spool/rsyslog

# Include all config files in /etc/rsyslog.d/
\$IncludeConfig /etc/rsyslog.d/*.conf

###############
#### RULES ####
###############

# Log all kernel messages to the console.
kern.*                                                  /dev/console

# Log anything (except mail) of level info or higher.
*.info;mail.none;authpriv.none;cron.none                /var/log/messages

# The authpriv file has restricted access.
authpriv.*                                              /var/log/secure

# Log all the mail messages in one place.
mail.*                                                  /var/log/maillog

# Log cron stuff
cron.*                                                  /var/log/cron

# Everybody gets emergency messages
*.emerg                                                 :omusrmsg:*

# Save news errors of level crit and higher in a special file.
uucp,news.crit                                          /var/log/spooler

# Save boot messages also to boot.log
local7.*                                                /var/log/boot.log

# Remote logging for SME infrastructure
# Firewalls
:fromhost-ip, isequal, "192.168.56.1" /var/log/sme/fw-1.log
:fromhost-ip, isequal, "192.168.56.2" /var/log/sme/fw-2.log

# Domain Controllers
:fromhost-ip, isequal, "192.168.56.10" /var/log/sme/dc-1.log
:fromhost-ip, isequal, "192.168.56.11" /var/log/sme/dc-2.log

# File Servers
:fromhost-ip, isequal, "192.168.56.20" /var/log/sme/filesrv-1.log
:fromhost-ip, isequal, "192.168.56.21" /var/log/sme/filesrv-2.log

# Web Servers
:fromhost-ip, isequal, "192.168.56.30" /var/log/sme/web-1.log
:fromhost-ip, isequal, "192.168.56.31" /var/log/sme/web-2.log

# Management Servers
:fromhost-ip, isequal, "192.168.56.50" /var/log/sme/mgmt-1.log
:fromhost-ip, isequal, "192.168.56.51" /var/log/sme/mgmt-2.log

# All SME infrastructure logs
:fromhost-ip, startswith, "192.168.56." /var/log/sme/infrastructure.log
EOF

# Create log directories
echo "Creating log directories..."
mkdir -p /var/log/sme/{fw-1,fw-2,dc-1,dc-2,filesrv-1,filesrv-2,web-1,web-2,mgmt-1,mgmt-2,monitor-1,log-1}
touch /var/log/sme/{fw-1,fw-2,dc-1,dc-2,filesrv-1,filesrv-2,web-1,web-2,mgmt-1,mgmt-2,monitor-1,log-1}.log
chown -R syslog:adm /var/log/sme
chmod -R 755 /var/log/sme

# Configure Elasticsearch
echo "Configuring Elasticsearch..."
cat > /etc/elasticsearch/elasticsearch.yml << EOF
cluster.name: sme-infrastructure
node.name: $HOSTNAME
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch
network.host: 0.0.0.0
http.port: 9200
discovery.type: single-node

# Disable security for local development (enable in production!)
xpack.security.enabled: false
xpack.security.enrollment.enabled: false
xpack.security.http.ssl.enabled: false
xpack.security.transport.ssl.enabled: false
EOF

# Set proper ownership for Elasticsearch directories
echo "Setting Elasticsearch permissions..."
chown -R elasticsearch:elasticsearch /etc/elasticsearch
chown -R elasticsearch:elasticsearch /var/lib/elasticsearch
chown -R elasticsearch:elasticsearch /var/log/elasticsearch

# Configure Kibana
echo "Configuring Kibana..."
cat > /etc/kibana/kibana.yml << EOF
server.port: 5601
server.host: "0.0.0.0"
elasticsearch.hosts: ["http://localhost:9200"]

# Disable telemetry
telemetry.enabled: false
telemetry.optIn: false
EOF

# Set proper ownership for Kibana directories
chown -R kibana:kibana /etc/kibana

# Configure Logstash
echo "Configuring Logstash..."
cat > /etc/logstash/conf.d/sme.conf << EOF
input {
  file {
    path => "/var/log/sme/*.log"
    type => "sme-logs"
    start_position => "beginning"
  }
}

filter {
  if [type] == "sme-logs" {
    grok {
      match => { "message" => "%{SYSLOGTIMESTAMP:timestamp} %{SYSLOGHOST:hostname} %{DATA:program}(?:\[%{POSINT:pid}\])?: %{GREEDYDATA:message}" }
    }
    date {
      match => [ "timestamp", "MMM  d HH:mm:ss", "MMM dd HH:mm:ss" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "sme-logs-%{+YYYY.MM.dd}"
  }
  stdout { codec => rubydebug }
}
EOF

# Set proper ownership for Logstash directories
chown -R logstash:logstash /etc/logstash

# Reload systemd daemon
systemctl daemon-reload

# Start and enable services
echo "Starting logging services..."

# Start rsyslog first
systemctl enable rsyslog
systemctl restart rsyslog
systemctl enable prometheus-node-exporter
systemctl start prometheus-node-exporter

# Start Elasticsearch and wait for it to be ready
systemctl enable elasticsearch
systemctl start elasticsearch
echo "Waiting for Elasticsearch to start (this may take a minute)..."
sleep 45

# Start Kibana
systemctl enable kibana
systemctl start kibana

# Start Logstash
systemctl enable logstash
systemctl start logstash

# Create admin user (idempotent for re-provisioning)
echo "Creating admin user..."
if ! getent passwd sme-admin >/dev/null 2>&1; then
  useradd -m -s /bin/bash sme-admin
fi
echo "sme-admin:Admin123!" | chpasswd
usermod -aG sudo sme-admin 2>/dev/null || true

# Speed up SSH (log-1 is often slow to accept connections: reverse DNS + GSSAPI + ELK load)
echo "Speeding up SSH (UseDNS no, GSSAPIAuthentication no)..."
for key in UseDNS GSSAPIAuthentication; do
  if grep -q "^${key}" /etc/ssh/sshd_config; then
    sed -i "s/^${key}.*/${key} no/" /etc/ssh/sshd_config
  else
    echo "${key} no" >> /etc/ssh/sshd_config
  fi
done
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true

# Configure firewall for logging
echo "Configuring firewall for logging..."
ufw allow from 192.168.56.0/24 comment 'Lab management/monitoring'
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (nginx)
ufw allow 514/tcp   # rsyslog
ufw allow 514/udp   # rsyslog
ufw allow 9200/tcp  # Elasticsearch
ufw allow 5601/tcp  # Kibana
ufw allow 5044/tcp  # Logstash
ufw allow 9100/tcp  # Node Exporter
ufw --force enable

# Configure nginx
echo "Configuring nginx..."
systemctl enable nginx
systemctl start nginx

# Create logging dashboard
echo "Creating logging dashboard..."
cat > /var/www/html/logging.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>SME Infrastructure Logging - $HOSTNAME</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .content { background: #ecf0f1; padding: 20px; margin-top: 20px; border-radius: 5px; }
        .service { margin: 10px 0; padding: 15px; border-radius: 5px; background: white; }
        .running { border-left: 5px solid #27ae60; }
        .stopped { border-left: 5px solid #e74c3c; }
        .link { color: #3498db; text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .log-file { background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 3px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 SME Infrastructure Logging</h1>
            <h2>Logging Server: $HOSTNAME</h2>
        </div>
        <div class="content">
            <h3>Logging Services</h3>
            <div class="service running">
                <h4>📝 rsyslog</h4>
                <p><strong>Status:</strong> Running</p>
                <p><strong>Purpose:</strong> System logging and remote log collection</p>
                <p><strong>Port:</strong> 514 (TCP/UDP)</p>
            </div>
            <div class="service running">
                <h4>🔍 Elasticsearch</h4>
                <p><strong>Status:</strong> Running</p>
                <p><strong>URL:</strong> <a href="http://$HOST_IP:9200" class="link">http://$HOST_IP:9200</a></p>
                <p><strong>Purpose:</strong> Log storage and indexing</p>
            </div>
            <div class="service running">
                <h4>📊 Kibana</h4>
                <p><strong>Status:</strong> Running</p>
                <p><strong>URL:</strong> <a href="http://$HOST_IP:5601" class="link">http://$HOST_IP:5601</a></p>
                <p><strong>Purpose:</strong> Log visualization and search</p>
            </div>
            <div class="service running">
                <h4>🔄 Logstash</h4>
                <p><strong>Status:</strong> Running</p>
                <p><strong>Purpose:</strong> Log processing and transformation</p>
            </div>
            
            <h3>Log Files</h3>
            <div class="log-file">/var/log/sme/fw-1.log - Firewall 1 logs</div>
            <div class="log-file">/var/log/sme/fw-2.log - Firewall 2 logs</div>
            <div class="log-file">/var/log/sme/dc-1.log - Domain Controller 1 logs</div>
            <div class="log-file">/var/log/sme/dc-2.log - Domain Controller 2 logs</div>
            <div class="log-file">/var/log/sme/web-1.log - Web Server 1 logs</div>
            <div class="log-file">/var/log/sme/web-2.log - Web Server 2 logs</div>
            <div class="log-file">/var/log/sme/mgmt-1.log - Management 1 logs</div>
            <div class="log-file">/var/log/sme/mgmt-2.log - Management 2 logs</div>
            <div class="log-file">/var/log/sme/infrastructure.log - All infrastructure logs</div>
            
            <h3>Quick Access</h3>
            <p><a href="http://$HOST_IP:5601" class="link">📊 Kibana Dashboard</a></p>
            <p><a href="http://$HOST_IP:9200" class="link">🔍 Elasticsearch API</a></p>
            <p><a href="/var/log/sme/" class="link">📁 Log Files Directory</a></p>
        </div>
    </div>
</body>
</html>
EOF

# Test services
echo ""
echo "Testing logging services..."
echo "================================"

# Check each service
SERVICES_OK=true

if systemctl is-active --quiet rsyslog; then
    echo "✅ rsyslog service is running"
else
    echo "❌ rsyslog service failed"
    systemctl status rsyslog --no-pager -l || true
    SERVICES_OK=false
fi

if systemctl is-active --quiet elasticsearch; then
    echo "✅ Elasticsearch service is running"
else
    echo "❌ Elasticsearch service failed"
    systemctl status elasticsearch --no-pager -l || true
    SERVICES_OK=false
fi

if systemctl is-active --quiet kibana; then
    echo "✅ Kibana service is running"
else
    echo "❌ Kibana service failed"
    systemctl status kibana --no-pager -l || true
    SERVICES_OK=false
fi

if systemctl is-active --quiet logstash; then
    echo "✅ Logstash service is running"
else
    echo "❌ Logstash service failed"
    systemctl status logstash --no-pager -l || true
    SERVICES_OK=false
fi

if systemctl is-active --quiet prometheus-node-exporter; then
    echo "✅ Node Exporter service is running"
else
    echo "❌ Node Exporter service failed"
    systemctl status prometheus-node-exporter --no-pager -l || true
    SERVICES_OK=false
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx web server is running"
else
    echo "❌ Nginx service failed"
    SERVICES_OK=false
fi

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

echo ""
echo "================================"
if [ "$SERVICES_OK" = true ]; then
    echo "✅ Logging Server $HOSTNAME setup complete!"
else
    echo "⚠️  Logging Server $HOSTNAME setup completed with some warnings"
fi
echo "================================"
echo "rsyslog: Collecting logs from all infrastructure"
echo "Elasticsearch: http://$HOST_IP:9200"
echo "Kibana: http://$HOST_IP:5601"
echo "Log Files: /var/log/sme/"
echo "Dashboard: http://$HOST_IP/logging.html"
echo "================================" 