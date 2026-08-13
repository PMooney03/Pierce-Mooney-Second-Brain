# Troubleshooting

## Quick Diagnostics

```bash
./status.sh
./validate.sh
vagrant status
docker compose ps
```

Logs are stored in `logs/`:

| Log | Contents |
|-----|----------|
| `vagrant-provision.log` | VM provisioning |
| `docker-setup.log` | Container startup |
| `ansible-provision.log` | Host-side Ansible |

---

## Prerequisites Failures

### `VBoxManage: command not found`

Install Oracle VirtualBox and ensure `VBoxManage` is in PATH.

### `vagrant: command not found`

Install Vagrant from https://www.vagrantup.com/downloads and restart your shell.

### Docker not running

```bash
# Linux
sudo systemctl start docker

# Windows / macOS
# Start Docker Desktop application
```

---

## Virtualization Issues

### Windows: Hyper-V conflict

VirtualBox and Hyper-V may conflict. Options:

1. Disable Hyper-V (if policy allows)
2. Use WSL2 backend with Docker Desktop while running VirtualBox in compatible mode
3. Run lab from a Linux host or dedicated lab machine

### `VT-x/AMD-V not available`

- Enable virtualization in BIOS/UEFI
- Close other hypervisors (VMware, Hyper-V)

---

## Vagrant / VM Issues

### Box download slow or fails

```bash
vagrant box update
vagrant up kali-attacker --provider virtualbox
```

Kali box is large (~3+ GB). Ensure stable disk space (50 GB+ recommended).

### `ansible_local` provisioner fails

```bash
vagrant ssh kali-attacker -c "sudo apt-get install -y ansible"
vagrant provision kali-attacker
```

Or run from host:

```bash
ansible-playbook -i ansible/inventory.ini ansible/site.yml --limit kali
```

### SSH auth failure to VM

```bash
vagrant ssh-config kali-attacker
vagrant ssh kali-attacker
```

Regenerate keys:

```bash
vagrant destroy kali-attacker -f
vagrant up kali-attacker
```

### Duplicate IP / host-only adapter missing

```bash
VBoxManage hostonlyif create
VBoxManage hostonlyif ipconfig vboxnet0 --ip 192.168.56.1 --netmask 255.255.255.0
vagrant reload
```

---

## Docker Issues

### DVWA not starting

```bash
docker compose logs dvwa
docker compose logs dvwa-db
docker compose up -d dvwa-db
sleep 30
docker compose up -d dvwa
```

### Port already in use

```bash
# Find process using port 8080
# Linux
ss -tlnp | grep 8080

# Windows PowerShell
netstat -ano | findstr :8080
```

Change ports in `docker-compose.yml` and update `group_vars/all.yml` accordingly.

### VMs cannot reach Docker on 192.168.56.1

1. Confirm Docker binds to `192.168.56.1` (not only 127.0.0.1)
2. Allow Docker through Windows Firewall for private networks
3. From Kali: `curl -v http://192.168.56.1:8080/`

---

## Ansible Issues

### `Permission denied` on ubuntu-target SSH

Wait for provisioning to complete:

```bash
vagrant provision ubuntu-target
```

### `sshd -t` validation failed

Check syntax:

```bash
vagrant ssh ubuntu-target -c "sudo sshd -t"
```

Re-run role:

```bash
ansible-playbook -i ansible/inventory.ini ansible/site.yml --limit ubuntu_target
```

---

## Windows Placeholder / AD Expansion

### Placeholder mode (default)

`windows-server` is Ubuntu-based. SSH as `vagrant` with default insecure key.

### Full Windows mode

```bash
export ENABLE_WINDOWS_VM=true
vagrant up windows-server
```

- Requires significant RAM (4 GB+ for VM)
- First boot may take 30+ minutes
- WinRM timeout extended to 1800s in Vagrantfile

---

## Performance Tuning

| VM | Minimum RAM | Recommended |
|----|-------------|-------------|
| kali-attacker | 2048 MB | 4096 MB |
| ubuntu-target | 1024 MB | 2048 MB |
| windows-server | 1024 MB | 4096 MB (Windows) |

Reduce parallel provisioning:

```bash
vagrant up kali-attacker
vagrant up ubuntu-target
vagrant up windows-server
```

---

## `/vagrant/ansible/site.yml` missing / playbook does not exist

**Cause:** VMs were created when the project lived in `enterprise-pentest/`. After moving files to the repo root (`PenetrationTesting/`), VirtualBox still syncs the old (deleted) folder.

**Symptoms:**

```text
playbook does not exist on the guest: /vagrant/ansible/site.yml
This machine used to live in .../enterprise-pentest but it's now at .../PenetrationTesting
```

**Fix** (from repo root where `Vagrantfile` and `ansible/` live):

```powershell
cd C:\Users\pierc\Desktop\PenetrationTesting
.\scripts\fix-vagrant-sync.ps1
```

Or manually:

```bash
vagrant reload
vagrant provision
```

Verify inside a VM:

```bash
vagrant ssh kali-attacker -c "ls /vagrant/ansible/site.yml"
```

Always run `vagrant` from the directory that contains `Vagrantfile` and `ansible/`.

---

## Complete Reset

```bash
FORCE=true ./destroy.sh
vagrant box prune
docker system prune -f
rm -rf .vagrant logs tmp
./setup.sh
```

---

## Getting Help

1. Collect `./status.sh` output
2. Review `logs/vagrant-provision.log`
3. Check [Vagrant docs](https://developer.hashicorp.com/vagrant/docs)
4. Check [Ansible docs](https://docs.ansible.com/)

Include OS version, VirtualBox version, and Vagrant version when reporting issues.
