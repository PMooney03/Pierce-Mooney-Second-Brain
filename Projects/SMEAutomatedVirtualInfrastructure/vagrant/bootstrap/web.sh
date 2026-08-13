#!/bin/bash

# Web Server bootstrap script
# Works for web-1, web-2, etc.
# Gets HOSTNAME and HOST_IP from Vagrant

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=provision-log.sh
source "${SCRIPT_DIR}/provision-log.sh"

# Get hostname and IP from Vagrant (passed as positional arguments)
# $1 = hostname (e.g. "web-1"), $2 = IP (e.g. "192.168.56.30"), $3 = instance number
HOSTNAME=${1:-${HOSTNAME:-$(hostname)}}
HOST_IP=${2:-${HOST_IP:-$(ip route get 1 | awk '{print $7;exit}')}}

echo "Setting up Web Server: $HOSTNAME ($HOST_IP)"

# Update system
echo "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install web server packages
echo "Installing web server packages..."
# Stop services to avoid conflicts
systemctl stop apache2 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Install packages
DEBIAN_FRONTEND=noninteractive apt-get install -y apache2 nginx php8.1-fpm libapache2-mod-php8.1 php8.1-mysql php8.1-curl php8.1-gd php8.1-mbstring php8.1-xml php8.1-zip prometheus-node-exporter

# Stop services again after install
systemctl stop apache2 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Set hostname
echo "Setting hostname to $HOSTNAME..."
hostnamectl set-hostname $HOSTNAME

# Configure Apache to run on port 8080
echo "Configuring Apache..."

# Apache will listen on 8080

cat > /etc/apache2/sites-available/000-default.conf << EOF
<VirtualHost *:8080>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html
    
    <Directory /var/www/html>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog \${APACHE_LOG_DIR}/error.log
    CustomLog \${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
EOF

# Configure Nginx as reverse proxy to Apache2
echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/default << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    root /var/www/html;
    index index.html index.htm index.php;
    
    server_name _;
    
    # Static files and PHP handled directly by Nginx
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }
    
    # Static files served directly by Nginx
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    
    # All other requests proxied to Apache2
    location / {
        try_files \$uri \$uri/ @apache;
    }
    
    location @apache {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
    }
}
EOF

# Create sample web page
echo "Creating sample web page..."
cat > /var/www/html/index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>SME Infrastructure - $HOSTNAME</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .content { background: #ecf0f1; padding: 20px; margin-top: 20px; border-radius: 5px; }
        .status { background: #27ae60; color: white; padding: 10px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 SME Infrastructure</h1>
            <h2>Web Server: $HOSTNAME</h2>
        </div>
        <div class="content">
            <h3>System Information</h3>
            <p><strong>Hostname:</strong> $HOSTNAME</p>
            <p><strong>IP Address:</strong> $HOST_IP</p>
            <p><strong>Server:</strong> Nginx (Proxy) + Apache2 + PHP 8.1</p>
            <p><strong>Status:</strong> <span class="status">✅ Online</span></p>
            
            <h3>Services</h3>
            <ul>
                <li>🌐 Nginx (Reverse Proxy)</li>
                <li>🌐 Apache2 (Backend Server)</li>
                <li>🐘 PHP 8.1 FastCGI</li>
                <li>🔒 SSL/TLS Support</li>
            </ul>
            
            <h3>Quick Links</h3>
            <ul>
                <li><a href="/status">Server Status</a></li>
                <li><a href="/phpinfo.php">PHP Information</a></li>
            </ul>
        </div>
    </div>
</body>
</html>
EOF

# Create PHP info page
cat > /var/www/html/phpinfo.php << EOF
<?php
phpinfo();
?>
EOF

# Create status page
cat > /var/www/html/status << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Server Status - $HOSTNAME</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .content { background: #ecf0f1; padding: 20px; margin-top: 20px; border-radius: 5px; }
        .service { margin: 10px 0; padding: 10px; border-radius: 3px; }
        .running { background: #27ae60; color: white; }
        .stopped { background: #e74c3c; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Server Status</h1>
            <h2>$HOSTNAME</h2>
        </div>
        <div class="content">
            <h3>Service Status</h3>
            <div class="service running">✅ Apache2: Running</div>
            <div class="service running">✅ Nginx: Running</div>
            <div class="service running">✅ PHP-FPM: Running</div>
            
            <h3>System Information</h3>
            <p><strong>Uptime:</strong> $(uptime)</p>
            <p><strong>Load Average:</strong> $(cat /proc/loadavg | awk '{print $1, $2, $3}')</p>
            <p><strong>Memory Usage:</strong> $(free -h | grep Mem | awk '{print $3 "/" $2}')</p>
            <p><strong>Disk Usage:</strong> $(df -h / | tail -1 | awk '{print $5}')</p>
        </div>
    </div>
</body>
</html>
EOF

# Set proper permissions
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html

# Configure PHP
echo "Configuring PHP..."
# Configure PHP for Apache2
if [ -f /etc/php/8.1/apache2/php.ini ]; then
    sed -i 's/upload_max_filesize = 2M/upload_max_filesize = 64M/' /etc/php/8.1/apache2/php.ini
    sed -i 's/post_max_size = 8M/post_max_size = 64M/' /etc/php/8.1/apache2/php.ini
    sed -i 's/memory_limit = 128M/memory_limit = 256M/' /etc/php/8.1/apache2/php.ini
    echo "✅ Apache2 PHP configuration updated"
fi

# Configure PHP-FPM
if [ -f /etc/php/8.1/fpm/php.ini ]; then
    sed -i 's/upload_max_filesize = 2M/upload_max_filesize = 64M/' /etc/php/8.1/fpm/php.ini
    sed -i 's/post_max_size = 8M/post_max_size = 64M/' /etc/php/8.1/fpm/php.ini
    sed -i 's/memory_limit = 128M/memory_limit = 256M/' /etc/php/8.1/fpm/php.ini
    echo "✅ PHP-FPM configuration updated"
fi

# Configure Apache2 for PHP support
echo "Configuring Apache2 for PHP support..."
a2enmod php8.1
a2enmod proxy_fcgi setenvif

# Enable PHP-FPM configuration for Apache2
if [ -f /etc/apache2/conf-available/php8.1-fpm.conf ]; then
    a2enconf php8.1-fpm || echo "⚠️  PHP-FPM Apache configuration not available or already enabled"
fi

# Configure Nginx proxy module
echo "Configuring Nginx proxy module..."
# Proxy module should be enabled by default

# Finalize Apache config
echo "Finalizing Apache configuration..."

# Remove port 80, add port 8080
if [ -f /etc/apache2/ports.conf ]; then
    # Backup original ports.conf
    cp /etc/apache2/ports.conf /etc/apache2/ports.conf.backup 2>/dev/null || true
    # Remove Listen 80 and Listen [::]:80 from ports.conf
    sed -i '/^Listen 80$/d; /^Listen \[::\]:80$/d' /etc/apache2/ports.conf
    # Ensure port 8080 is configured
    if ! grep -q "^Listen 8080$" /etc/apache2/ports.conf; then
        echo "Listen 8080" >> /etc/apache2/ports.conf
    fi
    echo "✅ Configured Apache to listen on port 8080 only"
else
    # Create ports.conf if it doesn't exist
    echo "Listen 8080" > /etc/apache2/ports.conf
    echo "Listen 443" >> /etc/apache2/ports.conf
fi

# Disable and re-enable site to ensure proper configuration
a2dissite 000-default 2>/dev/null || true
a2ensite 000-default

# Test configurations before starting services
echo "Testing configurations..."
apache2ctl configtest && echo "✅ Apache2 configuration is valid" || echo "⚠️  Apache2 configuration issues detected"

# Start services in correct order
echo "Starting web server services..."

# Stop services first
systemctl stop apache2 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Start Apache first (on port 8080)
echo "Starting Apache2 on port 8080..."
systemctl enable apache2
systemctl start apache2

# Verify Apache started successfully
if systemctl is-active --quiet apache2; then
    echo "✅ Apache2 started successfully"
else
    echo "❌ Apache2 failed to start, checking logs..."
    systemctl status apache2 --no-pager || true
fi

# Test and start Nginx (on port 80)
echo "Starting Nginx on port 80..."
systemctl enable nginx
if nginx -t; then
    systemctl start nginx
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx started successfully"
    else
        echo "❌ Nginx failed to start, checking logs..."
        systemctl status nginx --no-pager || true
    fi
else
    echo "⚠️  Nginx configuration test failed"
fi

# Start PHP-FPM
systemctl enable php8.1-fpm
systemctl start php8.1-fpm
systemctl enable prometheus-node-exporter
systemctl start prometheus-node-exporter

# Configure firewall
echo "Configuring firewall..."
ufw allow 80/tcp
ufw allow 8080/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw allow 9100/tcp

# Create admin user (idempotent for re-provisioning)
echo "Creating admin user..."
if ! getent passwd sme-admin >/dev/null 2>&1; then
  useradd -m -s /bin/bash sme-admin
fi
echo "sme-admin:Admin123!" | chpasswd
usermod -aG sudo sme-admin 2>/dev/null || true

# Test services
echo "Testing web server services..."
systemctl is-active apache2 > /dev/null && echo "✅ Apache2 service is running" || echo "❌ Apache2 service failed"
systemctl is-active nginx > /dev/null && echo "✅ Nginx service is running" || echo "❌ Nginx service failed"
systemctl is-active php8.1-fpm > /dev/null && echo "✅ PHP-FPM service is running" || echo "❌ PHP-FPM service failed"
systemctl is-active prometheus-node-exporter > /dev/null && echo "✅ Node Exporter is running" || echo "❌ Node Exporter failed"

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

echo "✅ Web Server $HOSTNAME setup complete!"
echo "Nginx (Frontend): http://$HOST_IP"
echo "Apache2 (Backend): http://$HOST_IP:8080"
echo "PHP: http://$HOST_IP/phpinfo.php"
echo "Status: http://$HOST_IP/status" 