#!/bin/bash
# SME SSH Tunnel Client Script
# This script allows users to connect to internal hosts through DC proxy

DC1_IP="192.168.56.10"
DC2_IP="192.168.56.11"
SSH_PROXY_PORT="2222"

# Function to show usage
show_usage() {
    echo "SME SSH Tunnel Client"
    echo "===================="
    echo ""
    echo "Usage: $0 [OPTIONS] <target_host>"
    echo ""
    echo "Options:"
    echo "  -u, --user USERNAME    SSH username (default: vagrant)"
    echo "  -p, --port PORT        Local port to bind (default: 2222)"
    echo "  -d, --dc DC_NUMBER     Use specific DC (1 or 2, default: auto)"
    echo "  -l, --list             List available hosts"
    echo "  -c, --connect          Connect directly after tunnel setup"
    echo "  -h, --help             Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 web-1                    # Setup tunnel to web-1"
    echo "  $0 -c web-1                 # Setup tunnel and connect to web-1"
    echo "  $0 -u sme-admin -p 2223 mgmt-1  # Connect as sme-admin on port 2223"
    echo "  $0 -d 2 filesrv-1           # Use DC-2 for connection"
    echo ""
    echo "After tunnel setup, connect with:"
    echo "  ssh USERNAME@localhost -p LOCAL_PORT"
    echo ""
}

# Function to list available hosts
list_hosts() {
    echo "Available SME Infrastructure Hosts:"
    echo "==================================="
    echo ""
    echo "Firewalls:"
    echo "  fw-1      (192.168.56.1)  - Primary firewall"
    echo "  fw-2      (192.168.56.2)  - Secondary firewall"
    echo ""
    echo "Domain Controllers:"
    echo "  dc-1      (192.168.56.10) - Primary DC (SSH proxy)"
    echo "  dc-2      (192.168.56.11) - Secondary DC (SSH proxy)"
    echo ""
    echo "File Servers:"
    echo "  filesrv-1 (192.168.56.20) - Primary file server"
    echo "  filesrv-2 (192.168.56.21) - Secondary file server"
    echo ""
    echo "Web Servers:"
    echo "  web-1     (192.168.56.30) - Primary web server"
    echo "  web-2     (192.168.56.31) - Secondary web server"
    echo ""
    echo "Monitoring:"
    echo "  monitor-1 (192.168.56.40) - Monitoring server"
    echo ""
    echo "Logging:"
    echo "  log-1     (192.168.56.41) - Logging server"
    echo ""
    echo "Management:"
    echo "  mgmt-1    (192.168.56.50) - Primary management"
    echo "  mgmt-2    (192.168.56.51) - Secondary management"
    echo ""
}

# Function to get host IP
get_host_ip() {
    local hostname=$1
    case $hostname in
        fw-1) echo "192.168.56.1" ;;
        fw-2) echo "192.168.56.2" ;;
        dc-1) echo "192.168.56.10" ;;
        dc-2) echo "192.168.56.11" ;;
        filesrv-1) echo "192.168.56.20" ;;
        filesrv-2) echo "192.168.56.21" ;;
        web-1) echo "192.168.56.30" ;;
        web-2) echo "192.168.56.31" ;;
        monitor-1) echo "192.168.56.40" ;;
        log-1) echo "192.168.56.41" ;;
        mgmt-1) echo "192.168.56.50" ;;
        mgmt-2) echo "192.168.56.51" ;;
        *) echo "" ;;
    esac
}

# Function to check DC availability
check_dc() {
    local dc_ip=$1
    ping -c 1 -W 2 $dc_ip > /dev/null 2>&1
    return $?
}

# Function to select best DC
select_dc() {
    local dc1_available=false
    local dc2_available=false
    
    echo "Checking DC availability..."
    
    if check_dc $DC1_IP; then
        dc1_available=true
        echo "✓ DC-1 ($DC1_IP) is available"
    else
        echo "✗ DC-1 ($DC1_IP) is not available"
    fi
    
    if check_dc $DC2_IP; then
        dc2_available=true
        echo "✓ DC-2 ($DC2_IP) is available"
    else
        echo "✗ DC-2 ($DC2_IP) is not available"
    fi
    
    if [ "$dc1_available" = true ] && [ "$dc2_available" = true ]; then
        echo "Using DC-1 (primary) for connection"
        echo $DC1_IP
    elif [ "$dc1_available" = true ]; then
        echo "Using DC-1 for connection"
        echo $DC1_IP
    elif [ "$dc2_available" = true ]; then
        echo "Using DC-2 for connection"
        echo $DC2_IP
    else
        echo "ERROR: No DC available for SSH proxy"
        exit 1
    fi
}

# Function to create tunnel
create_tunnel() {
    local dc_ip=$1
    local target_ip=$2
    local local_port=$3
    local username=$4
    
    echo "Creating SSH tunnel..."
    echo "  DC: $dc_ip"
    echo "  Target: $target_ip"
    echo "  Local Port: $local_port"
    echo "  Username: $username"
    echo ""
    
    # Create tunnel in background
    ssh -f -N -L $local_port:$target_ip:22 $username@$dc_ip -p $SSH_PROXY_PORT
    
    if [ $? -eq 0 ]; then
        echo "✓ SSH tunnel created successfully"
        echo "  You can now connect with: ssh $username@localhost -p $local_port"
        return 0
    else
        echo "✗ Failed to create SSH tunnel"
        return 1
    fi
}

# Parse command line arguments
USERNAME="vagrant"
LOCAL_PORT="2222"
DC_NUMBER=""
TARGET_HOST=""
CONNECT_DIRECT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--user)
            USERNAME="$2"
            shift 2
            ;;
        -p|--port)
            LOCAL_PORT="$2"
            shift 2
            ;;
        -d|--dc)
            DC_NUMBER="$2"
            shift 2
            ;;
        -l|--list)
            list_hosts
            exit 0
            ;;
        -c|--connect)
            CONNECT_DIRECT=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            TARGET_HOST="$1"
            shift
            ;;
    esac
done

# Check if target host is provided
if [ -z "$TARGET_HOST" ]; then
    echo "ERROR: Target host is required"
    show_usage
    exit 1
fi

# Get target host IP
TARGET_IP=$(get_host_ip $TARGET_HOST)
if [ -z "$TARGET_IP" ]; then
    echo "ERROR: Unknown host: $TARGET_HOST"
    list_hosts
    exit 1
fi

# Select DC
if [ -n "$DC_NUMBER" ]; then
    case $DC_NUMBER in
        1) DC_IP=$DC1_IP ;;
        2) DC_IP=$DC2_IP ;;
        *) echo "ERROR: Invalid DC number. Use 1 or 2"; exit 1 ;;
    esac
    
    if ! check_dc $DC_IP; then
        echo "ERROR: DC-$DC_NUMBER ($DC_IP) is not available"
        exit 1
    fi
else
    DC_IP=$(select_dc)
    if [[ $DC_IP == ERROR* ]]; then
        echo $DC_IP
        exit 1
    fi
fi

echo "SME SSH Tunnel Setup"
echo "===================="
echo "Target: $TARGET_HOST ($TARGET_IP)"
echo "DC: $DC_IP"
echo "Local Port: $LOCAL_PORT"
echo "Username: $USERNAME"
echo ""

# Create tunnel
if create_tunnel $DC_IP $TARGET_IP $LOCAL_PORT $USERNAME; then
    if [ "$CONNECT_DIRECT" = true ]; then
        echo ""
        echo "Connecting to $TARGET_HOST..."
        echo "Press Ctrl+D to disconnect"
        echo ""
        ssh $USERNAME@localhost -p $LOCAL_PORT
    else
        echo ""
        echo "Tunnel is active. To connect:"
        echo "  ssh $USERNAME@localhost -p $LOCAL_PORT"
        echo ""
        echo "To stop the tunnel:"
        echo "  pkill -f 'ssh.*$LOCAL_PORT:$TARGET_IP:22'"
        echo ""
        echo "Press Ctrl+C to stop the tunnel"
        
        # Keep tunnel alive
        while true; do
            sleep 1
        done
    fi
else
    exit 1
fi 