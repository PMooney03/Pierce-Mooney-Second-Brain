# Security Guide

## SSH Daisy-Chain (Recommended)

Access other hosts through a domain controller (dc-1 or dc-2) as a jump host:

```bash
sme-ssh dc-1
# From inside dc-1:
ssh vagrant@web-1
ssh vagrant@mgmt-1
ssh vagrant@filesrv-1
```

During provisioning, a jump key is created on the DCs and the public key is added to all other hosts. No manual setup is required.

---

## Access Control Overview

### Management Hosts (mgmt-1, mgmt-2)

Management servers run Ansible, recovery scripts, and orchestration tools. Access to them is restricted.

**sme-ssh PIN gate**

When using `sme-ssh mgmt-1` or `sme-ssh mgmt-2`, you must enter a PIN. The PIN is stored locally as a hash in `.sme-ssh-pin` (gitignored).

**First-time setup:**
```bash
sme-ssh --set-pin
# Enter and confirm a PIN (4+ characters)
```

**Using management access:**
```bash
sme-ssh mgmt-1
# Enter PIN when prompted
```

**Change PIN:**
```bash
sme-ssh --set-pin
```

**Bypass (development only):**
```bash
# Windows PowerShell
$env:SME_SSH_INSECURE = "1"
sme-ssh mgmt-1

# Linux/macOS
SME_SSH_INSECURE=1 sme-ssh mgmt-1
```

### Other Hosts

`dc-1`, `dc-2`, `web-1`, `web-2`, and the rest do **not** require a PIN. They are considered service/infrastructure nodes rather than privileged administration nodes.

### Vagrant Bypass

**Note:** `vagrant ssh mgmt-1` from the `vagrant/` directory does **not** use the PIN. The PIN gate applies only to `sme-ssh`. To enforce the same gate for direct Vagrant use, always use `sme-ssh` for management hosts.

## VM-Level Security (Ansible)

When Ansible playbooks are applied:

- **Firewall (UFW):** Non-DC hosts accept SSH only from domain controllers (192.168.56.10, 192.168.56.11), enforcing jump-host access.
- **SSH:** Root login disabled; `AllowUsers` restricts to `vagrant` and `sme-admin`.
- **Fail2ban:** Limits brute-force attempts on SSH.

Vagrant connects via port forwarding from the host, so VM firewalls do not block `vagrant ssh`. The PIN gate adds a local control for management access.

## Extending Protected Hosts

To require a PIN for additional hosts, add them to `SENSITIVE_HOSTS` in `cli.py`:

```python
SENSITIVE_HOSTS = ("mgmt-1", "mgmt-2", "dc-1")  # example: protect DCs too
```

## Credentials File

- **Path:** `.sme-ssh-pin` in the project root
- **Content:** SHA-256 hash of (PIN + salt)
- **Permissions:** 0600 on Unix (when supported)
- **Git:** Ignored via `.gitignore`

Do not commit `.sme-ssh-pin`. Each developer or machine should have its own PIN.
