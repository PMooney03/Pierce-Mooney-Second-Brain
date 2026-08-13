# Ansible Automation for SME Infrastructure

## 🎯 Overview

This document describes the Ansible automation system for the SME Starter Infrastructure project. Ansible provides configuration management, deployment automation, and operational tasks for the entire infrastructure.

## 📁 Directory Structure

```
ansible/
├── ansible.cfg              # Ansible configuration
├── inventory/
│   └── hosts.yml           # Host inventory and variables
├── playbooks/
│   ├── deploy.yml          # Full infrastructure deployment
│   ├── maintenance.yml     # Routine maintenance tasks
│   └── security.yml        # Security hardening
├── roles/
│   ├── common/             # Common configuration for all servers
│   ├── firewall/           # Firewall configuration
│   ├── domain_controller/  # Active Directory setup
│   ├── file_server/        # File sharing configuration
│   ├── web_server/         # Web server setup
│   ├── monitoring/         # Monitoring stack
│   ├── logging/            # Logging stack
│   └── management/         # Management tools
└── logs/                   # Ansible execution logs
```

## 🚀 Quick Start

### Prerequisites

1. **Ansible Installation**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install ansible
   
   # macOS
   brew install ansible
   
   # Verify installation
   ansible --version
   ```

2. **SSH Key Setup**
   ```bash
   # Generate SSH key if needed
   ssh-keygen -t rsa -b 4096
   
   # Copy to VMs (if using password auth, this step is optional)
   ssh-copy-id vagrant@192.168.56.3
   ```

### Basic Usage

1. **Deploy Full Infrastructure**
   ```bash
   # Using the CLI
   python3 cli.py deploy
   
   # Using Ansible directly
   cd ansible
   ansible-playbook playbooks/deploy.yml
   ```

2. **Run Maintenance Tasks**
   ```bash
   python3 cli.py maintenance
   ```

3. **Apply Security Hardening**
   ```bash
   python3 cli.py security --dry-run  # Preview changes
   python3 cli.py security            # Apply changes
   ```

## 📋 Inventory Management

### Host Groups

The inventory is organized into logical groups:

- **firewalls**: Network security and routing
- **domain_controllers**: Active Directory and DNS
- **file_servers**: File sharing and storage
- **web_servers**: Web applications
- **monitoring**: Prometheus and Grafana
- **logging**: ELK stack
- **management**: Ansible and admin tools

### Variables

Variables are defined at different levels:

1. **Global Variables** (in `hosts.yml`)
   ```yaml
   ansible_python_interpreter: /usr/bin/python3
   network_domain: sme.local
   timezone: UTC
   ```

2. **Group Variables** (per host group)
   ```yaml
   firewalls:
     vars:
       firewall_virtual_ip: 192.168.56.3
       vrrp_password: "1234"
   ```

3. **Host Variables** (per individual host)
   ```yaml
   fw-1:
     vrrp_priority: 100
     vrrp_state: MASTER
   ```

## 🎭 Roles

### Common Role

Applied to all servers, provides:
- System updates and package management
- SSH configuration
- Firewall setup (UFW)
- Fail2ban configuration
- NTP time synchronization
- Admin user creation
- Log rotation

### Firewall Role

Configures network security:
- iptables rules
- VRRP high availability
- NAT configuration
- Traffic filtering

### Domain Controller Role

Sets up Active Directory:
- Samba installation and configuration
- Domain provisioning
- DNS configuration
- User/group management

### File Server Role

Configures file sharing:
- Samba shares
- Permission management
- Backup directories
- Domain integration

### Web Server Role

Sets up web services:
- Apache configuration
- PHP modules
- Virtual hosts
- SSL certificates

### Monitoring Role

Deploys monitoring stack:
- Prometheus installation
- Grafana configuration
- Node exporter setup
- Dashboard creation

### Logging Role

Configures logging infrastructure:
- Elasticsearch setup
- Logstash configuration
- Kibana installation
- Log aggregation

### Management Role

Provides admin tools:
- Ansible configuration
- Management scripts
- Backup tools
- Monitoring utilities

## 📜 Playbooks

### deploy.yml

Main deployment playbook that:
1. Applies common configuration to all servers
2. Configures each service group
3. Performs post-deployment verification

**Usage:**
```bash
# Deploy everything
ansible-playbook playbooks/deploy.yml

# Deploy specific groups
ansible-playbook playbooks/deploy.yml --limit firewalls
ansible-playbook playbooks/deploy.yml --limit web_servers

# Dry run
ansible-playbook playbooks/deploy.yml --check
```

### maintenance.yml

Routine maintenance tasks:
- Package updates
- System health checks
- Log cleanup
- Service status verification

**Usage:**
```bash
# Run maintenance on all servers
ansible-playbook playbooks/maintenance.yml

# Maintenance on specific servers
ansible-playbook playbooks/maintenance.yml --limit web_servers
```

### security.yml

Security hardening:
- SSH security configuration
- Firewall rules
- File permissions
- Kernel parameters
- Service hardening

**Usage:**
```bash
# Preview security changes
ansible-playbook playbooks/security.yml --check

# Apply security hardening
ansible-playbook playbooks/security.yml
```

## 🔧 Advanced Usage

### Tags

Use tags to run specific parts of playbooks:

```bash
# Run only firewall configuration
ansible-playbook playbooks/deploy.yml --tags firewall

# Run security and monitoring
ansible-playbook playbooks/deploy.yml --tags "security,monitoring"
```

### Limit Hosts

Target specific hosts or groups:

```bash
# Single host
ansible-playbook playbooks/maintenance.yml --limit fw-1

# Multiple hosts
ansible-playbook playbooks/maintenance.yml --limit "fw-1,fw-2"

# Host group
ansible-playbook playbooks/maintenance.yml --limit firewalls
```

### Variables

Override variables at runtime:

```bash
# Override admin password
ansible-playbook playbooks/deploy.yml -e "admin_password=NewPassword123!"

# Override network configuration
ansible-playbook playbooks/deploy.yml -e "network_domain=company.local"
```

### Parallel Execution

Control parallel execution:

```bash
# Run with 5 parallel processes
ansible-playbook playbooks/deploy.yml -f 5

# Run sequentially
ansible-playbook playbooks/deploy.yml -f 1
```

## 🔍 Monitoring and Troubleshooting

### Logs

Ansible logs are stored in:
- `ansible/logs/ansible.log` - Main execution log
- Console output - Real-time execution details

### Debugging

Enable verbose output:

```bash
# Verbose output
ansible-playbook playbooks/deploy.yml -v

# More verbose
ansible-playbook playbooks/deploy.yml -vvv
```

### Testing Connectivity

Test connectivity to hosts:

```bash
# Ping all hosts
ansible all -m ping

# Test specific group
ansible firewalls -m ping

# Check facts
ansible all -m setup
```

### Common Issues

1. **SSH Connection Issues**
   ```bash
   # Test SSH connection
   ssh vagrant@192.168.56.3
   
   # Check SSH configuration
   ansible all -m raw -a "systemctl status ssh"
   ```

2. **Permission Issues**
   ```bash
   # Check sudo access
   ansible all -m raw -a "sudo whoami"
   ```

3. **Package Installation Issues**
   ```bash
   # Update package cache
   ansible all -m apt -a "update_cache=yes"
   ```

## 🔄 Backup and Recovery

### Creating Backups

```bash
# Create configuration backup
python3 cli.py backup

# Backup specific components
ansible firewalls -m fetch -a "src=/etc/iptables/rules.v4 dest=backups/ flat=yes"
```

### Restoring from Backup

```bash
# Restore from backup
python3 cli.py restore backups/20231201_143022/

# Restore specific files
ansible firewalls -m copy -a "src=backups/rules.v4 dest=/etc/iptables/rules.v4"
```

## 📊 Best Practices

### 1. Use Dry Runs
Always test changes with `--check` before applying:
```bash
ansible-playbook playbooks/security.yml --check
```

### 2. Version Control
Keep Ansible playbooks in version control:
```bash
git add ansible/
git commit -m "Add Ansible automation"
```

### 3. Environment Separation
Use different inventories for different environments:
```bash
ansible-playbook playbooks/deploy.yml -i inventory/production.yml
```

### 4. Regular Maintenance
Schedule regular maintenance runs:
```bash
# Cron job for weekly maintenance
0 2 * * 0 /path/to/cli.py maintenance
```

### 5. Monitoring Integration
Integrate Ansible with monitoring:
```bash
# Send notifications on playbook completion
ansible-playbook playbooks/deploy.yml --callback=slack
```

## 🔐 Security Considerations

### 1. Credential Management
- Use Ansible Vault for sensitive data
- Store passwords in encrypted files
- Use SSH keys instead of passwords

### 2. Access Control
- Limit Ansible execution to management servers
- Use sudo with specific commands
- Audit Ansible execution logs

### 3. Network Security
- Run Ansible over secure connections
- Use VPN for remote management
- Implement proper firewall rules

## 📈 Scaling

### Adding New Hosts

1. **Update Inventory**
   ```yaml
   web_servers:
     hosts:
       web-3:
         ansible_host: 192.168.56.32
   ```

2. **Run Deployment**
   ```bash
   ansible-playbook playbooks/deploy.yml --limit web-3
   ```

### Adding New Roles

1. **Create Role Structure**
   ```bash
   mkdir -p ansible/roles/new_role/{tasks,handlers,templates,vars,defaults}
   ```

2. **Define Tasks**
   ```yaml
   # ansible/roles/new_role/tasks/main.yml
   - name: Install new service
     apt:
       name: new-service
       state: present
   ```

3. **Add to Playbooks**
   ```yaml
   - name: Configure New Service
     hosts: new_servers
     roles:
       - new_role
   ```

## 🤝 Contributing

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-ansible-role
   ```

2. **Test Changes**
   ```bash
   ansible-playbook playbooks/deploy.yml --check
   ```

3. **Submit Pull Request**
   - Include documentation
   - Add tests if applicable
   - Update inventory if needed

### Code Style

- Use YAML syntax highlighting
- Follow Ansible best practices
- Include comments for complex tasks
- Use meaningful variable names

---

For more information, see the main [README.md](../README.md) and [SETUP.md](SETUP.md) files. 