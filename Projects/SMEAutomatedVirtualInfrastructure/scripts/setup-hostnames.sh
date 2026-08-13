#!/bin/bash

# SME Infrastructure Hostname Resolution Setup
# This script adds hostname resolution to management servers

set -e

echo "🔧 Setting up hostname resolution for SME Infrastructure..."

# Check if we're on a management server
if [[ ! "$(hostname)" =~ ^mgmt-[12]$ ]]; then
    echo "⚠️  Warning: This script is designed to run on management servers (mgmt-1 or mgmt-2)"
    echo "   Current hostname: $(hostname)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Backup existing hosts file
echo "📋 Backing up /etc/hosts..."
sudo cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)

# Check if SME hosts are already configured
if grep -q "SME Infrastructure Hosts" /etc/hosts; then
    echo "⚠️  SME Infrastructure hosts already configured in /etc/hosts"
    echo "   Removing existing configuration..."
    sudo sed -i '/# BEGIN SME Infrastructure Hosts/,/# END SME Infrastructure Hosts/d' /etc/hosts
fi

# Add infrastructure hostnames to /etc/hosts
echo "📝 Adding hostname mappings to /etc/hosts..."

sudo tee -a /etc/hosts > /dev/null << EOF

# BEGIN SME Infrastructure Hosts
192.168.56.1    fw-1
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
192.168.56.1    fw1
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
# END SME Infrastructure Hosts
EOF

echo "✅ Hostname mappings added to /etc/hosts"

# Test hostname resolution
echo "🧪 Testing hostname resolution..."

test_hosts=("dc-1" "dc-2" "web-1" "fw-1" "mgmt-1" "mgmt-2")
success_count=0

for host in "${test_hosts[@]}"; do
    if ping -c 1 -W 3 "$host" > /dev/null 2>&1; then
        echo "✅ $host - OK"
        ((success_count++))
    else
        echo "❌ $host - FAILED"
    fi
done

echo ""
echo "📊 Test Results: $success_count/${#test_hosts[@]} hosts reachable"

if [ $success_count -eq ${#test_hosts[@]} ]; then
    echo "🎉 All hostname resolution tests passed!"
else
    echo "⚠️  Some hosts are not reachable. This might be normal if VMs are not running."
fi

echo ""
echo "🚀 You can now use hostnames for:"
echo "   • ping dc-2"
echo "   • ssh web-1"
echo "   • ssh vagrant@dc-1"
echo "   • /opt/sme/scripts/auto-recovery.sh --host dc-2 --issue host_down"
echo ""
echo "📋 Available hostnames:"
echo "   • fw-1, fw-2 (firewalls)"
echo "   • dc-1, dc-2 (domain controllers)"
echo "   • filesrv-1, filesrv-2 (file servers)"
echo "   • web-1, web-2 (web servers)"
echo "   • monitor-1 (monitoring)"
echo "   • log-1 (logging)"
echo "   • mgmt-1, mgmt-2 (management)"
echo ""
echo "🔧 To restore original /etc/hosts: sudo cp /etc/hosts.backup.* /etc/hosts" 