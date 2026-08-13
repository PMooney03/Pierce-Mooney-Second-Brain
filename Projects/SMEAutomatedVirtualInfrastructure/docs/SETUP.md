# SME Starter Infrastructure - Setup Guide

## 🚀 Quick Start

### Prerequisites

1. **VirtualBox** (6.1 or later)
   - Download from: https://www.virtualbox.org/
   - Install VirtualBox Extension Pack for full functionality

2. **Vagrant** (2.2 or later)
   - Download from: https://www.vagrantup.com/
   - Ensure `vagrant` command is available in your PATH

3. **Python 3.7+** (for CLI)
   - Required for the `cli.py` management tool

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd sme-starter-infra
   ```

2. **Validate your setup:**
   ```bash
   python cli.py status --validate
   ```

3. **Start the full infrastructure:**
   ```bash
   python cli.py up --default
   ```

4. **Or use a configuration preset:**
   ```bash
   python cli.py up --preset minimal
   python cli.py up --preset standard
   python cli.py up --preset production
   ```

5. **Or start specific components (must include DCs):**
   ```bash
   python cli.py up --host web:2 --host dc:2 --host fw:1
   ```

6. **Show all available presets:**
   ```bash
   python cli.py presets
   ```

7. **Deploy with DC Gateway architecture:**
   ```bash
   python cli.py deploy
   ```

---

## ⚠️ Minimum Configuration Requirements

> **Critical:** You must include at least one Domain Controller (`dc-1` or `dc-2`) in any configuration. Without a DC, DNS, authentication, routing, and SSH proxying will not work.
>
> **Recommended:** Include at least one Management server (`mgmt-1`) for monitoring, recovery, and orchestration.

If you try to start a configuration without a DC, the CLI will block the operation and show an error. If you omit recommended components, the CLI will warn you but allow you to proceed.

---

## 🧩 Configuration Presets

| Preset      | Description                                 | Hosts Included                                 |
|-------------|---------------------------------------------|-----------------------------------------------|
| minimal     | Minimal functional infra (DC + mgmt)        | dc-1, dc-2, mgmt-1                            |
| basic       | Basic infra with core services              | dc-1, dc-2, mgmt-1, web-1, web-2              |
| standard    | Standard SME infra (recommended)            | dc-1, dc-2, mgmt-1, mgmt-2, web-1, web-2, filesrv-1, monitor-1 |
| production  | Full infra with redundancy                  | fw-1, fw-2, dc-1, dc-2, filesrv-1, filesrv-2, web-1, web-2, monitor-1, log-1, mgmt-1, mgmt-2 |
| development | Dev environment (minimal resources)         | dc-1, mgmt-1, web-1                            |

---

## 🛠️ CLI Usage

### Basic Commands

```bash
# Start all VMs
python3 cli.py up --default

# Use a preset
python3 cli.py up --preset minimal
python3 cli.py up --preset standard

# Start specific services (must include DCs)
python3 cli.py up --host web:2 --host dc:2

# Show all presets
python3 cli.py presets

# Check status
python3 cli.py status

# Stop VMs
python3 cli.py halt --host web

# Destroy VMs
python3 cli.py destroy --default --dry-run
```

### Advanced Usage

```bash
# Validate configuration
python3 cli.py up --validate

# Dry run (preview commands)
python3 cli.py up --host web --dry-run

# Start infrastructure in stages (must include DCs)
python3 cli.py up -h fw -h dc    # Start core network
python3 cli.py up -h filesrv -h web  # Start services
python3 cli.py up -h monitor -h log  # Start monitoring
```

#### What happens if you try an invalid config?
- If you omit required roles (like DCs), the CLI will block the operation and show an error.
- If you omit recommended roles (like mgmt), the CLI will warn you but allow you to continue.
- If you omit optional roles, the CLI will allow it, but may warn about missing dependencies for some services.

---

## 🛠️ Troubleshooting

- **Error: Missing critical components: dc**
  - You must include at least one domain controller (e.g., `--host dc:1` or use a preset).
- **Warning: Missing recommended components: mgmt**
  - Management servers are recommended for monitoring and recovery, but not strictly required.
- **Some services may not function correctly**
  - The CLI will warn you if you try to start a configuration with missing dependencies (e.g., web servers without DCs).
- **To see all available configuration presets:**
  - Run `python cli.py presets`

---

## 📋 Infrastructure Components

### Core Services

| Service | Hosts | IP Range | Purpose |
|---------|-------|----------|---------|
| **Firewalls** | fw-1, fw-2 | 192.168.56.3, 192.168.56.2 | Network security, NAT, VRRP |
| **Domain Controllers** | dc-1, dc-2 | 192.168.56.10-11 | Active Directory, DNS, **Gateway** |
| **File Servers** | filesrv-1, filesrv-2 | 192.168.56.20-21 | File sharing, backup storage |
| **Web Servers** | web-1, web-2 | 192.168.56.30-31 | Web applications, load balancing |

### Support Systems

| Service | Hosts | IP Range | Purpose |
|---------|-------|----------|---------|
| **Monitoring** | monitor-1 | 192.168.56.40 | Prometheus + Grafana |
| **Logging** | log-1 | 192.168.56.41 | ELK Stack (Elasticsearch, Logstash, Kibana) |
| **Management** | mgmt-1, mgmt-2 | 192.168.56.50-51 | Ansible, admin tools |

## 🔧 Configuration

### Network Design (DC Gateway Architecture)

```
Internet
    │
    ▼
┌─────────┐  ┌─────────┐
│  fw-1   │  │  fw-2   │  ← VRRP Virtual IP: 192.168.56.3
└─────────┘  └─────────┘
    │            │
    └────────────┘
         │
    ┌─────────┐
    │  LAN    │  ← 192.168.56.0/24
    └─────────┘
         │
    ┌─────────┐  ┌─────────┐
    │  dc-1   │  │  dc-2   │  ← **GATEWAY SERVERS**
    └─────────┘  └─────────┘
         │            │
         └────────────┘
              │
         ┌─────────┐
         │ All VMs │  ← **ALL TRAFFIC ROUTED THROUGH DCs**
         └─────────┘
```

### Traffic Flow

1. **All internal VMs** route traffic through **dc-1** (primary) or **dc-2** (backup)
2. **Domain controllers** act as:
   - **Authentication gateway** (Active Directory)
   - **Proxy servers** (Squid)
   - **DNS servers**
   - **Network gateway**
3. **Firewalls** provide:
   - External network security
   - VRRP high availability
   - NAT for domain controllers

### Default Credentials

| Service | Username | Password | Notes |
|---------|----------|----------|-------|
| **Domain Admin** | Administrator | Admin123! | Active Directory |
| **Management** | sme-admin | Admin123! | Management servers |
| **Grafana** | admin | admin | Monitoring dashboard |
| **Vagrant** | vagrant | vagrant | VM access |

## 📊 Monitoring & Logging

### Access Points

- **Grafana Dashboard**: http://192.168.56.40:3000
  - Username: `admin`
  - Password: `admin`

- **Kibana Dashboard**: http://192.168.56.41:5601
  - No authentication by default

- **Prometheus**: http://192.168.56.40:9090
  - No authentication by default

- **Gateway Status**: http://192.168.56.10/gateway-status.html
  - Shows DC gateway status and proxy statistics

### Management Tools

```bash
# SSH to management server
vagrant ssh mgmt-1

# Check infrastructure status
/opt/sme/scripts/check_status.sh

# Check backup status
/opt/sme/scripts/backup_check.sh

# Check gateway status
curl http://192.168.56.10/gateway-status.html
```

## 🔒 Security Considerations

### Network Security

- **All traffic authenticated** through Active Directory
- **Domain controllers** act as security gateways
- **Proxy authentication** required for web access
- **Network segmentation** with DC-controlled access
- **VRRP provides high availability** for gateway services

### Authentication

- **Active Directory** provides centralized authentication
- **All web traffic** goes through authenticated proxy
- **Domain membership** required for network access
- **Management servers** have restricted access
- **Default passwords should be changed** in production

### Recommendations

1. **Change default passwords** before production use
2. **Implement SSL certificates** for web services
3. **Configure backup encryption** for sensitive data
4. **Implement proper logging** and monitoring alerts
5. **Set up domain policies** for security compliance

## 🚨 Troubleshooting

### Common Issues

1. **Vagrant not found**
   ```bash
   # Ensure Vagrant is installed and in PATH
   vagrant --version
   ```

2. **VirtualBox errors**
   ```bash
   # Check VirtualBox installation
   VBoxManage --version
   ```

3. **Network connectivity issues**
   ```bash
   # Check VM status
   python3 cli.py status
   
   # SSH to problematic VM
   vagrant ssh <vm-name>
   
   # Test gateway connectivity
   ping 8.8.8.8
   ```

4. **Domain controller issues**
   ```bash
   # Check Samba services
   vagrant ssh dc-1
   sudo systemctl status smbd nmbd squid
   
   # Check gateway status
   curl http://192.168.56.10/gateway-status.html
   ```

5. **Proxy authentication issues**
   ```bash
   # Check Squid proxy
   vagrant ssh dc-1
   sudo systemctl status squid
   
   # Test proxy access
   curl -x http://192.168.56.10:3128 http://google.com
   ```

### Log Locations

- **Vagrant logs**: `vagrant/logs/`
- **Samba logs**: `/var/log/samba/`
- **Squid proxy logs**: `/var/log/squid/`
- **Apache logs**: `/var/log/apache2/`
- **System logs**: `/var/log/syslog`

## 📈 Scaling

### Adding More VMs

1. **Edit Vagrantfile** to add new VM definitions
2. **Update CLI** to include new roles in `VALID_ROLES`
3. **Create bootstrap scripts** for new VMs
4. **Update documentation** and IP addressing
5. **New VMs automatically** use DC gateway

### Resource Allocation

Current VM specifications:
- **Memory**: 1024MB per VM
- **CPU**: 1 core per VM
- **Storage**: 10GB per VM (expandable)

To increase resources:
1. Edit the `Vagrantfile`
2. Modify `vb.memory` and `vb.cpus` values
3. Consider host system capabilities

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

### Testing

```bash
# Test CLI functionality
python3 cli.py up --dry-run

# Test specific components
python3 cli.py up --host web:1 --dry-run

# Validate configuration
python3 cli.py status --validate

# Test DC gateway
python3 cli.py deploy --limit domain_controllers
```

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs
3. Open an issue on GitHub
4. Consult the documentation

---

**Note**: This is a development/testing environment. Do not use default credentials or configurations in production environments. 