# Quick Start Guide

Get SME Starter Infrastructure running in minutes.

---

## Prerequisites

| Tool      | Version   | Install |
|-----------|-----------|---------|
| Python    | 3.7+      | [python.org](https://www.python.org/downloads/) |
| VirtualBox| 7.1+      | [virtualbox.org](https://www.virtualbox.org/wiki/Downloads) |
| Vagrant   | 2.4+      | [vagrantup.com](https://www.vagrantup.com/downloads) |

**Verify installation:**

```powershell
# Windows
.\check_prerequisites.ps1
```

```bash
# Linux / macOS
chmod +x check_prerequisites.sh
./check_prerequisites.sh
```

Restart your terminal after installing.

---

## Setup

### 1. Clone and enter the project

```bash
cd sme-starter-infra
```

### 2. Create virtual environment (recommended)

```powershell
# Windows
.\setup_venv.ps1
.\venv\Scripts\Activate.ps1
```

```bash
# Linux / macOS
chmod +x setup_venv.sh
./setup_venv.sh
source venv/bin/activate
```

### 3. Install the CLI

```bash
pip install -e .
```

You can then use either:

- `python cli.py <action>` (works from project root)
- `sme-spinup <action>` (after pip install)

---

## Choose a Preset

| Preset       | Hosts                                             | RAM     | Time       |
|--------------|---------------------------------------------------|---------|------------|
| **minimal**  | dc-1, dc-2, mgmt-1                                | ~3 GB   | 15–25 min  |
| **basic**    | dc-1, dc-2, mgmt-1, web-1, web-2                  | ~5 GB   | 25–35 min  |
| **standard** | dc-1, dc-2, mgmt-1, mgmt-2, web-1, web-2, filesrv-1, monitor-1 | ~8 GB | 30–45 min  |
| **production** | fw-1, fw-2, dc-1, dc-2, filesrv-1, filesrv-2, web-1, web-2, monitor-1, log-1, mgmt-1, mgmt-2 | ~12 GB | 45–60 min |
| **development** | dc-1, mgmt-1, web-1                           | ~2 GB   | 10–15 min  |

**Start minimal (recommended for first run):**

```bash
python cli.py up --preset minimal
# or
sme-spinup up --preset minimal
```

---

## Monitor Progress

**In another terminal:**

```bash
sme-spinup status --watch --provisioning
```

Shows which VMs are running, provisioning (⏳), or ready (✅).

**Single check:**

```bash
sme-spinup status --provisioning
```

**Full output (debugging):**

```bash
cd vagrant
vagrant up dc-1 dc-2 mgmt-1
```

---

## Deploy (from your machine only)

After VMs are up and provisioning has finished, deploy configuration **without logging into any VM**:

```bash
sme-spinup status --provisioning   # wait until VMs show Ready (✅)
sme-spinup deploy
```

On Windows, deploy runs Ansible inside mgmt-1 for you; you stay on the host. No SSH into the VMs is required.

---

## Verify

**Status:**
```bash
sme-spinup status
```

**SSH to a VM:**
```bash
cd vagrant
vagrant ssh dc-1
exit
```

**Service checks (minimal preset):**
```bash
vagrant ssh dc-1 -c "systemctl status named"   # DNS
vagrant ssh dc-1 -c "systemctl status slapd"  # LDAP
vagrant ssh mgmt-1 -c "ansible --version"     # Ansible
```

---

## Access Points

| Service    | URL                    | Credentials  |
|------------|------------------------|--------------|
| Grafana    | http://192.168.56.40:3000 | admin/admin  |
| Kibana     | http://192.168.56.41:5601 | (if log-1 is running) |

**SSH:**
```bash
cd vagrant
vagrant ssh dc-1
vagrant ssh mgmt-1
```

**Daisy-chain via DC (recommended):** Connect to dc-1 first, then SSH to other hosts from there:
```bash
sme-ssh dc-1
# From inside dc-1:
ssh vagrant@web-1
ssh vagrant@mgmt-1
ssh vagrant@filesrv-1
```
A jump key is set up during provisioning so dc-1 and dc-2 can reach all other hosts.

**SSH via proxy:**
```bash
sme-spinup --ssh-proxy web-1
```

---

## Common Commands

| Command | Purpose |
|---------|---------|
| `sme-spinup up --preset minimal` | Start minimal setup |
| `sme-spinup status` | Check VM status |
| `sme-spinup status --watch --provisioning` | Watch provisioning |
| `sme-spinup halt --preset minimal` | Stop VMs |
| `sme-spinup destroy --preset minimal` | Remove VMs |
| `sme-spinup presets` | List presets |
| `sme-spinup debug --host-debug dc-1` | Debug a host |
| `sme-spinup gui` | Start web UI |

---

## Troubleshooting

**Provisioning stuck:**
```bash
sme-spinup debug --host-debug dc-1
vagrant ssh dc-1 -c "tail -100 /var/log/vagrant-provision.log"
```

**Resource check:**
```bash
vagrant ssh dc-1 -c "df -h && free -h"
```

**Failed services:**
```bash
vagrant ssh dc-1 -c "systemctl list-units --failed"
vagrant ssh dc-1 -c "journalctl -u <service> -n 50"
```

**Start over:**
```bash
sme-spinup destroy --preset minimal
sme-spinup up --preset minimal
```

See [docs/DEBUGGING.md](docs/DEBUGGING.md) for more.

---

## Suggested Workflow

**First run:**
```bash
.\check_prerequisites.ps1
.\setup_venv.ps1
.\venv\Scripts\Activate.ps1
pip install -e .
sme-spinup up --preset minimal
# In another terminal:
sme-spinup status --watch --provisioning
```

**Daily use:**
```bash
.\venv\Scripts\Activate.ps1
sme-spinup up --preset minimal
sme-spinup status
# When done:
sme-spinup halt --preset minimal
```

---

## Next Steps

- [README.md](README.md) — Project overview
- [PROJECT_EXPLANATION.md](PROJECT_EXPLANATION.md) — Architecture details
- [docs/DEBUGGING.md](docs/DEBUGGING.md) — Debugging guide
- [docs/ANSIBLE.md](docs/ANSIBLE.md) — Ansible usage
