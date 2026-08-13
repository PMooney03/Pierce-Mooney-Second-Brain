#!/bin/bash

# Monitoring Server bootstrap script
# Works for monitor-1, monitor-2, etc.
# Gets HOSTNAME and HOST_IP from Vagrant

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=provision-log.sh
source "${SCRIPT_DIR}/provision-log.sh"

# Get hostname and IP from Vagrant (passed as positional arguments)
# $1 = hostname (e.g. "monitor-1"), $2 = IP (e.g. "192.168.56.40"), $3 = instance number
HOSTNAME=${1:-${HOSTNAME:-$(hostname)}}
HOST_IP=${2:-${HOST_IP:-$(ip route get 1 | awk '{print $7;exit}')}}

echo "Setting up Monitoring Server: $HOSTNAME ($HOST_IP)"

# Pre-configure packages to avoid interactive prompts
export DEBIAN_FRONTEND=noninteractive

# Update system
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install basic packages first
echo "Installing basic packages..."
apt-get install -y wget curl gnupg2 software-properties-common nginx ufw

# Create prometheus system user early (needed for services)
echo "Creating prometheus system user..."
if ! id prometheus &>/dev/null; then
    useradd --system --no-create-home --shell /bin/false prometheus
fi

# Add Grafana repository (modern way for Ubuntu Jammy)
echo "Adding Grafana repository..."
mkdir -p /etc/apt/keyrings
wget -q -O - https://apt.grafana.com/gpg.key | gpg --batch --yes --dearmor -o /etc/apt/keyrings/grafana.gpg
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" > /etc/apt/sources.list.d/grafana.list

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

# Install monitoring tools
echo "Installing monitoring tools..."
apt-get install -y prometheus grafana prometheus-node-exporter || {
    echo "❌ Failed to install prometheus or grafana"
    apt-get install -y prometheus || echo "⚠️ Prometheus install failed"
    apt-get install -y grafana || echo "⚠️ Grafana install failed"
}

# Set hostname
echo "Setting hostname to $HOSTNAME..."
hostnamectl set-hostname $HOSTNAME

# Create config directories with correct permissions
echo "Setting up configuration directories..."
mkdir -p /etc/prometheus
mkdir -p /var/lib/prometheus
mkdir -p /var/lib/node_exporter/textfile_collector
chown -R prometheus:prometheus /etc/prometheus
chown -R prometheus:prometheus /var/lib/prometheus
chown -R prometheus:prometheus /var/lib/node_exporter

# Configure Prometheus
echo "Configuring Prometheus..."
cat > /etc/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'sme-infrastructure'
    static_configs:
      - targets: 
        - '192.168.56.3:9100'   # fw-1
        - '192.168.56.2:9100'   # fw-2
        - '192.168.56.10:9100'  # dc-1
        - '192.168.56.11:9100'  # dc-2
        - '192.168.56.20:9100'  # filesrv-1
        - '192.168.56.21:9100'  # filesrv-2
        - '192.168.56.30:9100'  # web-1
        - '192.168.56.31:9100'  # web-2
        - '192.168.56.40:9100'  # monitor-1
        - '192.168.56.41:9100'  # log-1
        - '192.168.56.50:9100'  # mgmt-1
        - '192.168.56.51:9100'  # mgmt-2
EOF

# Set proper ownership for Prometheus config
chown prometheus:prometheus /etc/prometheus/prometheus.yml

# Ensure Prometheus always loads the intended config file.
# This avoids fallback/minimal configs after package updates or restarts.
cat > /etc/default/prometheus << EOF
# Set the command-line arguments to pass to the server.
ARGS="--config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/var/lib/prometheus --web.console.templates=/usr/share/prometheus/consoles --web.console.libraries=/usr/share/prometheus/console_libraries"
EOF

# Validate config before we continue to service startup.
if command -v promtool >/dev/null 2>&1; then
    promtool check config /etc/prometheus/prometheus.yml
fi

# Note: Node Exporter is pre-configured by the prometheus-node-exporter package
echo "✅ Node Exporter configured via package"

# Configure Grafana
echo "Configuring Grafana..."
cat > /etc/grafana/grafana.ini << EOF
[server]
http_port = 3000
domain = $HOST_IP

[security]
admin_user = admin
admin_password = Admin123!

[database]
type = sqlite3
path = /var/lib/grafana/grafana.db

[users]
allow_sign_up = false
EOF

# Provision Grafana datasource and a basic infrastructure dashboard so the UI is usable immediately.
mkdir -p /etc/grafana/provisioning/datasources
mkdir -p /etc/grafana/provisioning/dashboards
mkdir -p /var/lib/grafana/dashboards

cat > /etc/grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    editable: true
EOF

cat > /etc/grafana/provisioning/dashboards/sme-provider.yml << 'EOF'
apiVersion: 1

providers:
  - name: SME Dashboards
    orgId: 1
    folder: SME
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
EOF

cat > /var/lib/grafana/dashboards/sme-overview.json << 'EOF'
{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": {
          "type": "grafana",
          "uid": "-- Grafana --"
        },
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": null,
  "links": [],
  "liveNow": false,
  "panels": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "prometheus"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "red",
                "value": null
              },
              {
                "color": "green",
                "value": 1
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 1,
      "options": {
        "colorMode": "value",
        "graphMode": "none",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "pluginVersion": "11.1.0",
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus"
          },
          "editorMode": "code",
          "expr": "sum(up{job=\"sme-infrastructure\"})",
          "instant": true,
          "legendFormat": "",
          "range": false,
          "refId": "A"
        }
      ],
      "title": "Infrastructure Targets Up",
      "type": "stat"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "prometheus"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 0
      },
      "id": 2,
      "options": {
        "legend": {
          "calcs": [],
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": {
          "mode": "single",
          "sort": "none"
        }
      },
      "pluginVersion": "11.1.0",
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus"
          },
          "editorMode": "code",
          "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\",job=\"sme-infrastructure\"}[5m])) * 100)",
          "instant": false,
          "legendFormat": "{{instance}}",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "CPU Usage by VM (%)",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "prometheus"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          },
          "unit": "percent"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 24,
        "x": 0,
        "y": 8
      },
      "id": 3,
      "options": {
        "legend": {
          "calcs": [],
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": {
          "mode": "single",
          "sort": "none"
        }
      },
      "pluginVersion": "11.1.0",
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus"
          },
          "editorMode": "code",
          "expr": "(1 - (node_memory_MemAvailable_bytes{job=\"sme-infrastructure\"} / node_memory_MemTotal_bytes{job=\"sme-infrastructure\"})) * 100",
          "instant": false,
          "legendFormat": "{{instance}}",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Memory Usage by VM (%)",
      "type": "timeseries"
    }
  ],
  "refresh": "30s",
  "schemaVersion": 39,
  "style": "dark",
  "tags": [
    "sme",
    "infrastructure"
  ],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "",
  "title": "SME Infrastructure Overview",
  "uid": "sme-infra-overview",
  "version": 1,
  "weekStart": ""
}
EOF

chown -R grafana:grafana /etc/grafana/provisioning /var/lib/grafana/dashboards

# Reload systemd daemon
systemctl daemon-reload

# Start and enable services
echo "Starting monitoring services..."
systemctl enable prometheus
systemctl start prometheus
systemctl enable prometheus-node-exporter
systemctl start prometheus-node-exporter
systemctl enable grafana-server
systemctl start grafana-server

# Create admin user (idempotent for re-provisioning)
echo "Creating admin user..."
if ! getent passwd sme-admin >/dev/null 2>&1; then
  useradd -m -s /bin/bash sme-admin
fi
echo "sme-admin:Admin123!" | chpasswd
usermod -aG sudo sme-admin 2>/dev/null || true

# Configure firewall for monitoring
echo "Configuring firewall for monitoring..."
ufw allow from 192.168.56.0/24 comment 'Lab management/logging'
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (nginx)
ufw allow 9090/tcp  # Prometheus
ufw allow 9100/tcp  # Node Exporter
ufw allow 3000/tcp  # Grafana
ufw --force enable

# Configure nginx
echo "Configuring nginx..."
systemctl enable nginx
systemctl start nginx

# Create monitoring dashboard
echo "Creating monitoring dashboard..."
cat > /var/www/html/monitoring.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>SME Infrastructure Monitoring - $HOSTNAME</title>
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 SME Infrastructure Monitoring</h1>
            <h2>Monitoring Server: $HOSTNAME</h2>
        </div>
        <div class="content">
            <h3>Monitoring Services</h3>
            <div class="service running">
                <h4>📊 Prometheus</h4>
                <p><strong>Status:</strong> Running</p>
                <p><strong>URL:</strong> <a href="http://$HOST_IP:9090" class="link">http://$HOST_IP:9090</a></p>
                <p><strong>Purpose:</strong> Metrics collection and alerting</p>
            </div>
            <div class="service running">
                <h4>📈 Grafana</h4>
                <p><strong>Status:</strong> Running</p>
                <p><strong>URL:</strong> <a href="http://$HOST_IP:3000" class="link">http://$HOST_IP:3000</a></p>
                <p><strong>Login:</strong> admin / Admin123!</p>
                <p><strong>Purpose:</strong> Data visualization and dashboards</p>
            </div>
            <div class="service running">
                <h4>🖥️ Node Exporter</h4>
                <p><strong>Status:</strong> Running</p>
                <p><strong>URL:</strong> <a href="http://$HOST_IP:9100" class="link">http://$HOST_IP:9100</a></p>
                <p><strong>Purpose:</strong> System metrics collection</p>
            </div>
            
            <h3>Monitored Infrastructure</h3>
            <ul>
                <li>🌐 Firewalls (fw-1, fw-2)</li>
                <li>🏛️ Domain Controllers (dc-1, dc-2)</li>
                <li>📁 File Servers (filesrv-1, filesrv-2)</li>
                <li>🌐 Web Servers (web-1, web-2)</li>
                <li>📊 Monitoring (monitor-1)</li>
                <li>📝 Logging (log-1)</li>
                <li>⚙️ Management (mgmt-1, mgmt-2)</li>
            </ul>
            
            <h3>Quick Access</h3>
            <p><a href="http://$HOST_IP:3000" class="link">📊 Grafana Dashboards</a></p>
            <p><a href="http://$HOST_IP:9090" class="link">📈 Prometheus Targets</a></p>
            <p><a href="http://$HOST_IP:9100" class="link">🖥️ Node Exporter Metrics</a></p>
        </div>
    </div>
</body>
</html>
EOF

# Test services
echo ""
echo "Testing monitoring services..."
echo "================================"

# Check each service
SERVICES_OK=true

if systemctl is-active --quiet prometheus; then
    echo "✅ Prometheus service is running"
else
    echo "❌ Prometheus service failed"
    systemctl status prometheus --no-pager -l || true
    SERVICES_OK=false
fi

if systemctl is-active --quiet prometheus-node-exporter; then
    echo "✅ Node Exporter service is running"
else
    echo "❌ Node Exporter service failed"
    systemctl status prometheus-node-exporter --no-pager -l || true
    SERVICES_OK=false
fi

if systemctl is-active --quiet grafana-server; then
    echo "✅ Grafana service is running"
else
    echo "❌ Grafana service failed"
    systemctl status grafana-server --no-pager -l || true
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
    echo "✅ Monitoring Server $HOSTNAME setup complete!"
else
    echo "⚠️  Monitoring Server $HOSTNAME setup completed with some warnings"
fi
echo "================================"
echo "Prometheus: http://$HOST_IP:9090"
echo "Grafana: http://$HOST_IP:3000 (admin/Admin123!)"
echo "Node Exporter: http://$HOST_IP:9100"
echo "Dashboard: http://$HOST_IP/monitoring.html"
echo "================================" 