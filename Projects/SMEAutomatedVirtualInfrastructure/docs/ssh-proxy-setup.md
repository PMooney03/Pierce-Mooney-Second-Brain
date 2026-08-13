# SSH Proxy Setup for SME Infrastructure

## Overview

The SME infrastructure now implements **centralized SSH access control** through domain controllers (DC boxes). This provides:

- **Centralized logging** of all SSH access attempts
- **Access control** and monitoring
- **Security audit trail** for compliance
- **Failover capability** with multiple DCs
- **Simplified access management**

## Architecture

```
External User
      ↓
   SSH Tunnel
      ↓
   Domain Controller (DC-1/DC-2)
      ↓
   Internal Host (web-1, mgmt-1, etc.)
```

## How It Works

1. **SSH Proxy Service**: DC boxes run an additional SSH service on port 2222
2. **Tunnel Creation**: Users create SSH tunnels through DC boxes to target hosts
3. **Access Control**: All SSH access is logged and controlled through DCs
4. **Failover**: If DC-1 is down, connections automatically use DC-2

## Configuration

### Domain Controller Setup

The DC boxes are configured with:

- **SSH Proxy Service**: Port 2222 for tunnel connections
- **Access Logging**: All SSH attempts logged to `/var/log/sme/ssh-proxy-access.log`
- **Failover Logging**: Failed attempts logged to `/var/log/sme/ssh-proxy-failures.log`
- **Tunnel Support**: Enabled SSH forwarding and tunneling

### Firewall Rules

- **Direct SSH blocked**: Non-DC hosts block direct SSH access
- **DC SSH allowed**: Only DC boxes accept SSH connections
- **Tunnel forwarding**: DCs can forward SSH to internal hosts

## Usage

### Using the CLI

```bash
# Connect to web-1 through auto-selected DC
python3 cli.py --ssh-proxy web-1

# Connect as specific user
python3 cli.py --ssh-proxy mgmt-1 --ssh-user sme-admin

# Use specific DC
python3 cli.py --ssh-proxy filesrv-1 --ssh-dc 2

# Use custom port
python3 cli.py --ssh-proxy monitor-1 --ssh-port 2223
```

### Using the Script Directly

```bash
# List available hosts
./scripts/sme-ssh-tunnel.sh --list

# Connect to web-1
./scripts/sme-ssh-tunnel.sh -c web-1

# Connect with custom options
./scripts/sme-ssh-tunnel.sh -u sme-admin -p 2223 -d 2 mgmt-1
```

### Manual SSH Tunnel

```bash
# Create tunnel through DC-1 to web-1
ssh -L 2222:192.168.56.30:22 vagrant@192.168.56.10 -p 2222

# Connect to tunneled host
ssh vagrant@localhost -p 2222
```

## Available Hosts

| Host | IP Address | Description |
|------|------------|-------------|
| fw-1 | 192.168.56.3 | Primary firewall |
| fw-2 | 192.168.56.2 | Secondary firewall |
| dc-1 | 192.168.56.10 | Primary domain controller |
| dc-2 | 192.168.56.11 | Secondary domain controller |
| filesrv-1 | 192.168.56.20 | Primary file server |
| filesrv-2 | 192.168.56.21 | Secondary file server |
| web-1 | 192.168.56.30 | Primary web server |
| web-2 | 192.168.56.31 | Secondary web server |
| monitor-1 | 192.168.56.40 | Monitoring server |
| log-1 | 192.168.56.41 | Logging server |
| mgmt-1 | 192.168.56.50 | Primary management |
| mgmt-2 | 192.168.56.51 | Secondary management |

## Security Features

### Access Logging

All SSH access is logged with:
- **Connection attempts** (successful and failed)
- **User authentication** details
- **Source IP addresses**
- **Target hosts**
- **Timestamps**

### Failover Support

- **Automatic DC selection**: Primary DC preferred, secondary as backup
- **Health checking**: DC availability verified before connection
- **Graceful degradation**: If one DC is down, other is used

### Access Control

- **User restrictions**: Only authorized users can access SSH proxy
- **Host restrictions**: Only internal hosts can be accessed
- **Port restrictions**: SSH proxy only available on designated ports

## Monitoring and Troubleshooting

### Check SSH Proxy Status

```bash
# Check SSH proxy service on DC
ssh vagrant@192.168.56.10 "sudo systemctl status ssh-proxy"

# Check SSH proxy logs
ssh vagrant@192.168.56.10 "sudo tail -f /var/log/sme/ssh-proxy-access.log"
```

### Common Issues

1. **DC Unavailable**: Check if DC boxes are running
2. **Authentication Failed**: Verify username and credentials
3. **Port Conflicts**: Ensure local port is not in use
4. **Network Issues**: Verify network connectivity to DC

### Log Locations

- **Access Logs**: `/var/log/sme/ssh-proxy-access.log`
- **Failure Logs**: `/var/log/sme/ssh-proxy-failures.log`
- **System Logs**: `/var/log/auth.log`

## Benefits

### Security
- **Centralized access control**
- **Comprehensive audit trail**
- **Reduced attack surface**
- **Compliance support**

### Management
- **Simplified access management**
- **Centralized logging**
- **Easy monitoring**
- **Failover capability**

### Compliance
- **Access audit trails**
- **User activity logging**
- **Security event monitoring**
- **Regulatory compliance support**

## Best Practices

1. **Use strong authentication**: Implement key-based authentication
2. **Regular log review**: Monitor access logs for suspicious activity
3. **User management**: Regularly review and update user access
4. **Backup DC**: Ensure secondary DC is always available
5. **Network security**: Secure the internal network segment

## Migration from Direct SSH

If you were previously using direct SSH access:

1. **Update scripts**: Replace direct SSH with tunnel commands
2. **Update documentation**: Update access procedures
3. **Train users**: Educate users on new access method
4. **Test failover**: Verify DC failover works correctly
5. **Monitor logs**: Ensure logging is working as expected 