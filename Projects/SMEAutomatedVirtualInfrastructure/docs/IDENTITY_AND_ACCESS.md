# Identity and Access – Production-Ready Design

This document describes the **central user definition**, **Ansible provisioning**, **Flask integration**, and **network security** so that a single `vagrant up` yields a fully configured, demo-ready stack with real user access.

---

## 1. Central user definition

**File:** `ansible/group_vars/all/users.yml`

- **`sme_central_users_enabled`** – When `true`, the `users` role creates Linux users and the Flask GUI reads from Ansible-generated data. When `false`, the legacy single admin user from the `common` role is used.
- **`sme_users`** – List of user dicts. Each must include:
  - **username** – Linux login and Flask login.
  - **hashed_password** – Werkzeug-style hash (e.g. `pbkdf2:sha256:600000$...` or `scrypt:...`). Used only by the Flask GUI; Linux auth is key-only.
  - **role** – `admin` or `user`. Drives sudo (admin) and Flask RBAC.
  - **ssh_public_key** – One-line public key for SSH to all VMs.

**Generate hashed_password (from project root, with venv):**

```bash
python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('YourPassword'))"
```

**Generate ssh_public_key:**

```bash
ssh-keygen -t ed25519 -C 'user@sme.local' -f userkey -N ''
# Paste contents of userkey.pub into users.yml.
```

---

## 2. Ansible role: `users`

**Path:** `ansible/roles/users/`

| File | Purpose |
|------|--------|
| `defaults/main.yml` | `sme_admin_group`, `sme_user_group`, `sme_sudoers_file` |
| `tasks/main.yml` | Create groups, users, `.ssh`, authorized_keys, sudoers drop-in, SSH key-only + AllowUsers, restart SSH |
| `templates/sme_sudoers.j2` | One line per admin: `username ALL=(ALL) NOPASSWD:ALL` |
| `templates/flask_users.json.j2` | JSON with `username`, `password` (hash), `role` for Flask |

**Behaviour:**

- **Linux users** – Created with `password: "!"` (locked); shell `/bin/bash`, group `sme-admin` or `sme-user` by role.
- **SSH** – `authorized_key` per user; `PasswordAuthentication no`, `PubkeyAuthentication yes`, `AllowUsers vagrant` + all `sme_users` usernames.
- **Sudo** – Admins get `/etc/sudoers.d/sme-users` with `NOPASSWD:ALL`; standard users get no sudo (only group membership).
- **Idempotency** – `user`, `authorized_key`, `lineinfile`, `template`/`copy` are idempotent; re-runs are safe.

---

## 3. Sudo and permissions

- **Admin** – In `sme_admin_group`, sudoers drop-in grants `ALL=(ALL) NOPASSWD:ALL`.
- **User** – In `sme_user_group` only; no sudoers entry, so no sudo (or add limited commands later in the same drop-in if needed).

---

## 4. Flask app integration

- **Data source** – Flask prefers `ansible/generated/users.json` (written by the deploy play). If missing, it uses `gui/users.json`. No hardcoded credentials.
- **Login** – `verify_user()` uses Werkzeug `check_password_hash()` on the `password` field from the JSON (hashed).
- **Session** – Session cookie holds `user` (username + role); secret from `SME_GUI_SECRET` (or default dev key).
- **RBAC** – `@admin_required` on VM actions (provision, restart, etc.); `@login_required` on dashboard and read-only API. Admin = full; user = read-only dashboard.

When `ansible/generated/users.json` exists, the GUI treats the user list as read-only and returns 403 on `POST /api/users` with a message that user management is via Ansible.

---

## 5. Ansible → Flask bridge

- **Play:** “Generate Flask users.json from central definition” (in `deploy.yml`).
- **Runs on:** `management`, `run_once: true`, so it runs on mgmt-1.
- **Writes:** `/sme-ansible/generated/users.json` (synced to host `ansible/generated/users.json`).
- **Content:** Rendered from `flask_users.json.j2`: only `username`, `password` (hashed), `role`. No `ssh_public_key`.
- Passwords stay hashed end-to-end; Flask never sees plain text.

---

## 6. Network security

- **Internal** – `network_subnet` (192.168.56.0/24) is allowed (Ansible and Vagrant).
- **User access** – `user_access_subnet` (e.g. 192.168.0.0/24) allows SSH to management and HTTP/HTTPS/Grafana/Kibana to the right hosts (see `user_access` role).
- **Control node** – Optional `control_node_networks` (list of CIDRs) can restrict SSH to the host machine; when set, SSH to management is allowed from those in addition to the above.
- Firewall rules are applied by the `user_access` and `firewall` roles; VM-to-VM is constrained by existing firewall/iptables design.

---

## 7. Idempotency

- All `users` role tasks are idempotent (user, authorized_key, template, lineinfile, service restart).
- Re-running the playbook does not duplicate users or break config; it only updates to match `group_vars/all/users.yml` and regenerates `users.json`.

---

## 8. End-to-end flow (vagrant up)

1. **Vagrant** – Brings up all VMs, runs bootstrap (including jump key on dc-1, Ansible on mgmt-1).
2. **Trigger** – After `vagrant up`, a trigger runs `python cli.py deploy` from the project root (unless `SME_SKIP_DEPLOY_ON_UP=1`).
3. **Deploy playbook** – Runs on mgmt-1 (via CLI), targets all hosts: `common` → `users` → firewalls, DCs, file, web, monitoring, logging, management, `user_access`, then “Generate Flask users.json” on management, then post-deployment checks.
4. **Result** – 12 VMs configured, users created everywhere, SSH key-only, sudo by role, UFW/iptables applied, `ansible/generated/users.json` written and synced to the host.
5. **Flask** – On start, reads `ansible/generated/users.json` (or `gui/users.json`), login and RBAC work; admin can run VM actions, user gets read-only dashboard.

No manual steps are required for a full demo after `vagrant up`.
