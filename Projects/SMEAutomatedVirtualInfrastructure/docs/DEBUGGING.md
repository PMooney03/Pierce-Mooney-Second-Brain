# 🔍 Debugging Provisioning Issues

This guide covers how to debug provisioning problems when VMs are being set up.

## Quick Debug Commands

### 1. Debug a Specific Host

```bash
# Use the built-in debug command
sme-spinup debug --host-debug dc-1

# Or manually check
cd vagrant
vagrant ssh dc-1
```

### 2. View Provisioning Logs

```bash
# View last 100 lines of provisioning log
vagrant ssh dc-1 -c "tail -100 /var/log/vagrant-provision.log"

# Watch provisioning in real-time (if still running)
vagrant ssh dc-1 -c "tail -f /var/log/vagrant-provision.log"

# View full provisioning output
vagrant up dc-1  # Without --async to see all output
```

### 3. Check What's Currently Running

```bash
# Check if provisioning processes are running
vagrant ssh dc-1 -c "ps aux | grep -E '(apt|install|configure|bootstrap)'"

# Check all running processes
vagrant ssh dc-1 -c "ps aux | head -30"

# Check system load
vagrant ssh dc-1 -c "uptime && free -h && df -h"
```

### 4. Check Service Status

```bash
# Check if specific services are running
vagrant ssh dc-1 -c "systemctl status named"      # DNS
vagrant ssh dc-1 -c "systemctl status slapd"      # LDAP
vagrant ssh dc-1 -c "systemctl status squid"      # Proxy

# List all services
vagrant ssh dc-1 -c "systemctl list-units --type=service --state=running"

# Check for failed services
vagrant ssh dc-1 -c "systemctl list-units --failed"
```

### 5. View System Logs

```bash
# View recent system logs
vagrant ssh dc-1 -c "journalctl -xe | tail -50"

# View logs for a specific service
vagrant ssh dc-1 -c "journalctl -u named -n 50"    # DNS logs
vagrant ssh dc-1 -c "journalctl -u slapd -n 50"   # LDAP logs

# View boot logs
vagrant ssh dc-1 -c "journalctl -b | tail -100"
```

### 6. Check Network Connectivity

```bash
# Test DNS resolution
vagrant ssh dc-1 -c "nslookup dc-1.sme.local"

# Test connectivity
vagrant ssh dc-1 -c "ping -c 3 8.8.8.8"

# Check network interfaces
vagrant ssh dc-1 -c "ip addr show"
```

## Common Issues and Solutions

### Issue: Provisioning Hangs or Takes Too Long

**Symptoms:**
- VM shows "running" but provisioning never completes
- SSH connection times out
- No output for extended periods

**Debugging:**
```bash
# Check if apt is stuck
vagrant ssh dc-1 -c "ps aux | grep apt"

# Check disk space (full disk can cause hangs)
vagrant ssh dc-1 -c "df -h"

# Check if package installation is waiting
vagrant ssh dc-1 -c "lsof | grep -E '(apt|dpkg)'"
```

**Solutions:**
- Wait longer (some packages take 10-20 minutes)
- Check internet connectivity
- Free up disk space
- Restart provisioning: `vagrant destroy dc-1 && vagrant up dc-1`

### Issue: Service Failed to Start

**Symptoms:**
- Provisioning completes but services aren't running
- Error messages in logs

**Debugging:**
```bash
# Check service status
vagrant ssh dc-1 -c "systemctl status named"

# View service logs
vagrant ssh dc-1 -c "journalctl -u named -n 100"

# Check configuration files
vagrant ssh dc-1 -c "named-checkconf /etc/bind/named.conf"
```

**Solutions:**
- Fix configuration errors
- Check service dependencies
- Restart service: `vagrant ssh dc-1 -c "sudo systemctl restart named"`

### Issue: Package Installation Fails

**Symptoms:**
- Error messages about package conflicts
- "Unable to locate package" errors
- Dependency resolution failures

**Debugging:**
```bash
# Check apt cache
vagrant ssh dc-1 -c "apt-cache search <package-name>"

# Check package repositories
vagrant ssh dc-1 -c "cat /etc/apt/sources.list"

# Check for broken packages
vagrant ssh dc-1 -c "dpkg --configure -a"
```

**Solutions:**
- Update package lists: `vagrant ssh dc-1 -c "sudo apt-get update"`
- Fix broken packages: `vagrant ssh dc-1 -c "sudo apt-get install -f"`
- Check internet connectivity

### Issue: DNS/Network Not Working

**Symptoms:**
- Can't resolve hostnames
- Can't connect to other VMs
- Services can't bind to ports

**Debugging:**
```bash
# Test DNS resolution
vagrant ssh dc-1 -c "nslookup dc-2.sme.local"

# Check DNS service
vagrant ssh dc-1 -c "systemctl status named"
vagrant ssh dc-1 -c "named-checkconf"

# Check network configuration
vagrant ssh dc-1 -c "ip route"
vagrant ssh dc-1 -c "cat /etc/resolv.conf"
```

**Solutions:**
- Restart DNS service
- Check firewall rules
- Verify network configuration in Vagrantfile

## Advanced Debugging

### View Full Provisioning Output

Instead of using `--async`, run provisioning synchronously to see all output:

```bash
cd vagrant
vagrant up dc-1  # See all output in real-time
```

### Re-run Provisioning

If provisioning failed partway through:

```bash
# Re-run provisioning for a specific VM
vagrant provision dc-1

# Or destroy and recreate
vagrant destroy -f dc-1
vagrant up dc-1
```

### Check Bootstrap Script Directly

```bash
# View the bootstrap script
cat vagrant/bootstrap/dc.sh

# Test script manually (SSH into VM first)
vagrant ssh dc-1
# Then run parts of the script manually to see where it fails
```

### Monitor Resource Usage

```bash
# Check CPU, memory, disk usage
vagrant ssh dc-1 -c "top -bn1 | head -20"
vagrant ssh dc-1 -c "free -h"
vagrant ssh dc-1 -c "df -h"
vagrant ssh dc-1 -c "iostat -x 1 5"
```

## Debugging Specific VM Types

### Domain Controllers (dc-1, dc-2)

```bash
# Check DNS
vagrant ssh dc-1 -c "systemctl status named"
vagrant ssh dc-1 -c "dig @localhost dc-1.sme.local"

# Check LDAP
vagrant ssh dc-1 -c "systemctl status slapd"
vagrant ssh dc-1 -c "ldapsearch -x -b dc=sme,dc=local"

# Check proxy
vagrant ssh dc-1 -c "systemctl status squid"
vagrant ssh dc-1 -c "curl -x localhost:3128 http://www.google.com"
```

### Web Servers (web-1, web-2)

```bash
# Check Apache
vagrant ssh web-1 -c "systemctl status apache2"
vagrant ssh web-1 -c "curl http://localhost:8080"

# Check Nginx
vagrant ssh web-1 -c "systemctl status nginx"
vagrant ssh web-1 -c "curl http://localhost"

# Check PHP
vagrant ssh web-1 -c "php -v"
vagrant ssh web-1 -c "systemctl status php8.1-fpm"
```

### Management Servers (mgmt-1, mgmt-2)

```bash
# Check Ansible
vagrant ssh mgmt-1 -c "ansible --version"
vagrant ssh mgmt-1 -c "ansible all -m ping"

# Check Python packages
vagrant ssh mgmt-1 -c "pip3 list"
```

### Monitoring Server (monitor-1)

```bash
# Check Prometheus
vagrant ssh monitor-1 -c "systemctl status prometheus"
vagrant ssh monitor-1 -c "curl http://localhost:9090"

# Check Grafana
vagrant ssh monitor-1 -c "systemctl status grafana-server"
vagrant ssh monitor-1 -c "curl http://localhost:3000"
```

### Log Server (log-1) — SSH slow or services not active

**Why is SSH to log-1 slow?**

1. **Load** — log-1 runs the ELK stack (Elasticsearch, Kibana, Logstash) plus nginx and rsyslog. Elasticsearch is CPU- and memory-heavy, so the VM can be busy and slow to accept new SSH sessions.
2. **sshd defaults** — Ubuntu’s sshd often has `UseDNS yes` (reverse DNS lookup on connect) and GSSAPI enabled, which can add several seconds per connection. The bootstrap script sets `UseDNS no` and `GSSAPIAuthentication no` to reduce this; reprovision if the VM was built before that change.
3. **First connection after boot** — Right after boot, many services start at once; SSH may be slow until the system settles.

The CLI uses longer timeouts (e.g. 15s) for log-1 for this reason.

### Log Server (log-1) — nginx, elasticsearch, kibana not active

The log VM is "Ready" only when **all four** are running: **rsyslog**, **nginx**, **elasticsearch**, **kibana**. They are all installed and started by `vagrant/bootstrap/log.sh`. If status shows only rsyslog active, use these steps to see why the others aren’t.

**1. Confirm packages are installed**

```bash
vagrant ssh log-1 -c "dpkg -l rsyslog nginx elasticsearch kibana | grep -E '^ii|^rc'"
```

- If any are missing (`ii` = installed), bootstrap may have failed during `apt-get install` (e.g. network or Elastic repo). Check provisioning log and retry: `vagrant provision log-1`.

**2. Service status (why “not active”)**

```bash
vagrant ssh log-1 -c "systemctl status rsyslog nginx elasticsearch kibana --no-pager -l"
```

- **nginx**: Often fails if config is missing or invalid. Check: `vagrant ssh log-1 -c "nginx -t"`.
- **elasticsearch**: Often needs enough RAM (Vagrantfile gives log-1 4GB). Check logs: `vagrant ssh log-1 -c "journalctl -u elasticsearch -n 50 --no-pager"`. Common: OOM, or still starting (bootstrap waits 45s).
- **kibana**: Starts after Elasticsearch; if ES isn’t up, Kibana may fail. Check: `vagrant ssh log-1 -c "journalctl -u kibana -n 50 --no-pager"`.

**3. Use the CLI debug command**

```bash
sme-spinup debug --host-debug log-1
```

This runs package checks, service status, and recent journalctl for elasticsearch and kibana.

**4. If bootstrap is still running**

```bash
vagrant ssh log-1 -c "ps aux | grep -E 'apt|dpkg|bootstrap'"
tail -f vagrant/.vagrant/...   # or re-run: vagrant up log-1 (without --async)
```

**5. Re-run provisioning**

```bash
cd vagrant
vagrant provision log-1
# Or full rebuild:
vagrant destroy -f log-1 && vagrant up log-1
```

## Getting Help

If you're stuck:

1. **Check the logs first:**
   ```bash
   sme-spinup debug --host-debug <hostname>
   ```

2. **View full provisioning output:**
   ```bash
   cd vagrant
   vagrant up <hostname>  # Without --async
   ```

3. **Check common issues:**
   - Disk space: `df -h`
   - Network: `ping 8.8.8.8`
   - Services: `systemctl list-units --failed`

4. **Review bootstrap scripts:**
   - Located in `vagrant/bootstrap/`
   - Each script shows what it's doing with echo statements

## Tips

- **Use `--async` for speed, but remove it for debugging** - You'll see all output
- **Check logs in order:** provisioning log → system logs → service logs
- **Most issues are:** network problems, disk space, or package installation
- **Provisioning can take 15-30 minutes** - Be patient for complex VMs like log-1
