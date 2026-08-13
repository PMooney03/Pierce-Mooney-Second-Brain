# 🚨 SME Infrastructure Recovery Capabilities

## Overview

The management servers (`mgmt-1` and `mgmt-2`) now have **comprehensive recovery capabilities** to automatically detect and recover downed infrastructure components.

## ✅ **What the Management Servers Can Do**

### 🔍 **Health Monitoring**
- **Continuous monitoring** of all infrastructure hosts (every 5 minutes)
- **Ping tests** to check host connectivity
- **SSH connectivity** verification
- **Service health checks** for critical services (DNS, LDAP, web servers, etc.)
- **Real-time status reporting** with detailed logs

### 🔄 **Automated Recovery**
- **VM restart** via Vagrant for completely down hosts
- **Service restart** for hosts with SSH issues
- **Network recovery** for connectivity problems
- **Backup restoration** from daily backups
- **Intelligent retry logic** with configurable timeouts

### 📊 **Recovery Types Supported**

| Issue Type | Description | Recovery Action |
|------------|-------------|-----------------|
| `host_down` | Host completely unreachable | VM restart via Vagrant |
| `ssh_issue` | Host reachable but SSH down | Service restart |
| `service_down` | Host up but services failing | Targeted service restart |
| `network_issue` | Network connectivity problems | Network interface recovery |
| `backup_restore` | Complete system failure | Restore from backup |

### 🛠️ **Recovery Tools Available**

#### Health Monitor (`/opt/sme/scripts/health-monitor.py`)
```bash
# Single health check
python3 /opt/sme/scripts/health-monitor.py --check

# Continuous monitoring
python3 /opt/sme/scripts/health-monitor.py --monitor --interval 300

# Health check without auto-recovery
python3 /opt/sme/scripts/health-monitor.py --check --no-recovery
```

#### Auto-Recovery (`/opt/sme/scripts/auto-recovery.sh`)
```bash
# Manual recovery for specific host
/opt/sme/scripts/auto-recovery.sh --host dc-1 --issue host_down

# Dry run to see what would be done
/opt/sme/scripts/auto-recovery.sh --host web-1 --issue service_down --dry-run

# Recovery with verbose output
/opt/sme/scripts/auto-recovery.sh --host fw-1 --issue network_issue --verbose
```

#### Disaster Recovery (`/opt/sme/scripts/disaster-recovery.sh`)
```bash
# Full disaster recovery test
/opt/sme/scripts/disaster-recovery.sh --test

# Actual disaster recovery
/opt/sme/scripts/disaster-recovery.sh --execute
```

#### Backup Automation (`/opt/sme/scripts/backup-automation.sh`)
```bash
# Daily backup
/opt/sme/scripts/backup-automation.sh --daily

# Manual backup
/opt/sme/scripts/backup-automation.sh --manual

# Restore from backup
/opt/sme/scripts/backup-automation.sh --restore --host dc-1
```

## 🎯 **Recovery Priority System**

The system prioritizes recovery based on host importance:

| Priority | Hosts | Description |
|----------|-------|-------------|
| **Critical** | `dc-1`, `dc-2`, `mgmt-1`, `mgmt-2` | Domain controllers and management servers |
| **High** | `fw-1`, `fw-2`, `filesrv-1`, `filesrv-2` | Firewalls and file servers |
| **Medium** | `web-1`, `web-2`, `monitor-1`, `log-1` | Web servers, monitoring, and logging |

## 📋 **CLI Integration**

The recovery system is fully integrated with the CLI:

```bash
# Run health check on all hosts
python cli.py status --health-check

# Trigger recovery for specific host
python cli.py status --recover dc-1

# Start continuous monitoring
python cli.py status --monitor

# Deploy recovery system
python cli.py recovery
```

## 🔧 **Configuration**

Recovery behavior is configured in `/opt/sme/config/recovery-config.json`:

```json
{
  "monitoring": {
    "check_interval": 300,
    "auto_recovery": true,
    "alert_threshold": 3
  },
  "hosts": {
    "dc-1": {
      "ip": "192.168.56.10",
      "type": "domain_controller",
      "recovery_priority": "critical",
      "services": ["bind9", "slapd", "krb5-kdc", "squid"]
    }
  }
}
```

## 📊 **Monitoring Dashboard**

Access the web-based monitoring dashboard at:
- **URL**: `http://mgmt-1/monitoring-dashboard.html`
- **Features**: Real-time status, recovery history, system metrics

## 📝 **Logging and Alerts**

### Log Locations
- **Health monitoring**: `/var/log/sme/recovery/health-monitor.log`
- **Auto-recovery**: `/var/log/sme/recovery/auto-recovery.log`
- **Backup operations**: `/var/log/sme/recovery/backup.log`

### Alert Configuration
- **Email alerts** for critical failures
- **Webhook notifications** for integration with external systems
- **Configurable thresholds** for different alert levels

## 🚀 **Usage Examples**

### Scenario 1: Web Server Down
```bash
# 1. Check health status
python cli.py status --health-check

# 2. If web-1 is down, trigger recovery
python cli.py status --recover web-1

# 3. Monitor recovery progress
tail -f /var/log/sme/recovery/auto-recovery.log
```

### Scenario 2: Domain Controller Issues
```bash
# 1. Check DC health
ssh mgmt-1 "/opt/sme/scripts/health-monitor.py --check"

# 2. If SSH issues detected, restart services
ssh mgmt-1 "/opt/sme/scripts/auto-recovery.sh --host dc-1 --issue ssh_issue"

# 3. Verify DNS and LDAP services
ssh mgmt-1 "systemctl status bind9 slapd"
```

### Scenario 3: Complete Infrastructure Recovery
```bash
# 1. Run disaster recovery test
ssh mgmt-1 "/opt/sme/scripts/disaster-recovery.sh --test"

# 2. If test passes, execute recovery
ssh mgmt-1 "/opt/sme/scripts/disaster-recovery.sh --execute"

# 3. Monitor recovery progress
ssh mgmt-1 "tail -f /var/log/sme/recovery/*.log"
```

### Scenario 2: Domain Controller Issues
```bash
# 1. Check DC health
ssh mgmt-1 "/opt/sme/scripts/health-monitor.py --check"

# 2. If SSH issues detected, restart services
ssh mgmt-1 "/opt/sme/scripts/auto-recovery.sh --host dc-1 --issue ssh_issue"

# 3. Verify DNS and LDAP services
ssh mgmt-1 "systemctl status bind9 slapd"
```

### Scenario 3: Complete Infrastructure Recovery
```bash
# 1. Run disaster recovery test
ssh mgmt-1 "/opt/sme/scripts/disaster-recovery.sh --test"

# 2. If test passes, execute recovery
ssh mgmt-1 "/opt/sme/scripts/disaster-recovery.sh --execute"

# 3. Monitor recovery progress
ssh mgmt-1 "tail -f /var/log/sme/recovery/*.log"
```

## 🔒 **Security Features**

- **SSH key-based authentication** for secure host access
- **Sudo privileges** for recovery commands only
- **Audit logging** of all recovery actions
- **Encrypted backup storage** for sensitive data

## 🌐 **Hostname Resolution**

The management servers are configured with hostname resolution for all infrastructure components, allowing you to use hostnames instead of IP addresses:

### **Available Hostnames**
```bash
# Firewalls
ping fw-1    # 192.168.56.3
ping fw-2    # 192.168.56.2

# Domain Controllers
ping dc-1    # 192.168.56.10
ping dc-2    # 192.168.56.11

# File Servers
ping filesrv-1    # 192.168.56.20
ping filesrv-2    # 192.168.56.21

# Web Servers
ping web-1    # 192.168.56.30
ping web-2    # 192.168.56.31

# Monitoring & Logging
ping monitor-1    # 192.168.56.40
ping log-1        # 192.168.56.41

# Management Servers
ping mgmt-1    # 192.168.56.50
ping mgmt-2    # 192.168.56.51
```

### **Alternative Short Names**
```bash
# Short versions also work
ping dc1    # same as dc-1
ping web1   # same as web-1
ping fw1    # same as fw-1
```

### **Recovery with Hostnames**
```bash
# Use hostnames in recovery commands
/opt/sme/scripts/auto-recovery.sh --host dc-2 --issue host_down
/opt/sme/scripts/health-monitor.py --check

# SSH using hostnames
ssh vagrant@dc-1
ssh vagrant@web-1
```

### **Manual Setup (if needed)**
If hostname resolution isn't working, run this on the management server:
```bash
# From management server
sudo ./scripts/setup-hostnames.sh
```

## 📈 **Performance Metrics**

The recovery system tracks:
- **Recovery success rate**
- **Mean time to recovery (MTTR)**
- **Service availability**
- **Backup integrity**
- **System resource usage**

## 🎉 **Benefits**

✅ **Zero-downtime operations** with automatic failover  
✅ **Reduced manual intervention** with intelligent automation  
✅ **Comprehensive monitoring** of all infrastructure components  
✅ **Fast recovery times** with optimized procedures  
✅ **Audit trail** for compliance and troubleshooting  
✅ **Scalable architecture** for growing infrastructure  

## 🚨 **Emergency Procedures**

### Manual Recovery (if auto-recovery fails)
1. **SSH to management server**: `ssh vagrant@192.168.56.50`
2. **Check logs**: `tail -f /var/log/sme/recovery/*.log`
3. **Manual VM restart**: `cd /vagrant && vagrant up HOSTNAME`
4. **Service verification**: `/opt/sme/scripts/health-monitor.py --check`

### Complete System Reset
1. **Stop all VMs**: `python cli.py halt --default`
2. **Destroy and recreate**: `python cli.py destroy --default && python cli.py up --default`
3. **Redeploy infrastructure**: `python cli.py deploy`
4. **Verify recovery system**: `python cli.py recovery`

---

**The management servers now provide enterprise-grade recovery capabilities, ensuring your SME infrastructure remains resilient and self-healing!** 🛡️ 