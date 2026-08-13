# Testing Guide

> **Scope:** All activities in this guide are restricted to the **isolated enterprise-pentest-lab environment** (192.168.56.0/24). Do not apply these techniques to systems you do not own or lack explicit written authorization to test.

## Methodology Reference

This lab supports practice aligned with common frameworks:

| Framework | Application in Lab |
|-----------|-------------------|
| PTES | Scoping, intelligence, vulnerability analysis |
| OWASP Testing Guide | Web application chapters |
| NIST SP 800-115 | Technical security testing approaches |
| Cyber Kill Chain | Recon → exploitation → post-exploitation (lab only) |

---

## Phase 1: Lab Access & Scoping

### Connect to attacker workstation

```bash
vagrant ssh kali-attacker
cd ~/lab-workspace
mkdir -p evidence/{scans,web,privesc,reports}
```

(`vagrant ssh` logs in as user `vagrant`; use `sudo -i` only if you prefer working as root in `/root/lab-workspace`.)

### Confirm scope

```bash
cat ~/lab-targets.txt
/usr/local/bin/lab-validate-connectivity
```

Document scope in `evidence/reports/scope.md`:

- Network: 192.168.56.0/24 only
- In-scope hosts: .10, .20, .30, host gateway .1
- Out of scope: all external addresses

---

## Phase 2: Internal Nmap Scanning

### Host discovery (lab subnet only)

```bash
nmap -sn 192.168.56.0/24 -oA evidence/scans/host-discovery
```

### Service enumeration — Ubuntu target

```bash
nmap -sV -sC -p- 192.168.56.20 -oA evidence/scans/ubuntu-target-full
nmap -sV --script vuln 192.168.56.20 -oA evidence/scans/ubuntu-target-vuln
```

### Service enumeration — Windows placeholder

```bash
nmap -sV -sC 192.168.56.30 -oA evidence/scans/windows-server
```

### Docker host services

```bash
nmap -sV -p 8080,3000,3001,9090 192.168.56.1 -oA evidence/scans/docker-host
```

---

## Phase 3: Service Enumeration

### SSH banner and algorithms

```bash
nc -nv 192.168.56.20 22
nmap --script ssh2-enum-algos,ssh-auth-methods -p 22 192.168.56.20
```

### SMB/RPC (when Windows VM enabled)

```bash
nmap -p 445,135,139 --script smb-os-discovery 192.168.56.30
```

### Directory enumeration (web)

```bash
dirb http://192.168.56.1:8080/ /usr/share/wordlists/dirb/common.txt -o evidence/web/dvwa-dirb.txt
```

---

## Phase 4: HTTP Fingerprinting

```bash
whatweb http://192.168.56.1:8080/
whatweb http://192.168.56.1:3000/
curl -I http://192.168.56.1:8080/
curl -I http://192.168.56.1:3000/
```

Capture headers and technologies in `evidence/web/fingerprint.txt`.

---

## Phase 5: Web Application Assessment

### DVWA (192.168.56.1:8080)

1. Browse to `http://192.168.56.1:8080/`
2. Complete DVWA setup wizard (lab environment)
3. Set security level to **low** for training
4. Practice modules:
   - SQL Injection
   - XSS (stored/reflected)
   - Command injection
   - File upload
   - CSRF

```bash
# Example: manual SQLi parameter test (lab only)
curl "http://192.168.56.1:8080/vulnerabilities/sqli/?id=1'&Submit=Submit" \
  --cookie "security=low; PHPSESSID=<session>"
```

### OWASP Juice Shop (192.168.56.1:3000)

1. Browse to `http://192.168.56.1:3000/`
2. Work through OWASP Top 10 challenges
3. Use browser developer tools for client-side issues
4. Document each finding with CWE reference

---

## Phase 6: Linux Privilege Escalation (ubuntu-target)

### Initial access

```bash
ssh labuser@192.168.56.20
# Password: labuser123 (lab only)
```

### Enumeration checklist

```bash
id
uname -a
cat /etc/os-release
find / -perm -4000 2>/dev/null
sudo -l
cat /home/labuser/notes.txt
ls -la /usr/local/bin/
ls -la /opt/lab-backup
```

### Practice paths (intentional misconfigurations)

| Vector | Hint |
|--------|------|
| Weak credentials | `devops` / `devops2024` |
| SUID binary | `/usr/local/bin/lab-helper` |
| Writable directory | `/opt/lab-backup` |
| Sudo misconfiguration | `sudo -l` as devops |

### Post-exploitation (documentation only)

```bash
# After gaining elevated access - document only
whoami
hostname
```

Do **not** install persistence, exfiltration tools, or reverse shells to external IPs.

---

## Phase 7: Password Auditing (Lab Only)

### SSH password spraying (single host, lab accounts)

```bash
hydra -l labuser -P /usr/share/wordlists/fasttrack.txt \
  ssh://192.168.56.20 -t 4 -f -o evidence/scans/ssh-hydra.txt
```

Use only lab-provided wordlists. Do not use breached password databases against real services.

### Hash identification (if hashes found in lab files)

```bash
hashid <hash>
john --wordlist=/usr/share/wordlists/rockyou.txt lab-hash.txt
```

---

## Phase 8: Logging & Reporting Workflow

### Evidence collection structure

```
evidence/
├── scans/          # Nmap XML, grepable output
├── web/            # Screenshots, HTTP transcripts
├── privesc/        # Command output, notes
└── reports/
    ├── scope.md
    ├── executive-summary.md
    └── technical-findings.md
```

### Finding template

```markdown
## FINDING-001: [Title]

**Severity:** Medium
**Host:** 192.168.56.20
**CWE:** CWE-xxx

### Description
[What was found]

### Evidence
[Command output, screenshot reference]

### Remediation
[How to fix in production environments]

### References
- OWASP / MITRE ATT&CK technique ID
```

### Professional reporting tips

- Executive summary: business risk, 1 page
- Technical appendix: reproducible steps
- Include scope statement and rules of engagement
- Map findings to MITRE ATT&CK (enterprise) or OWASP Top 10 (web)

---

## Phase 9: Defensive Review (Blue Team)

After offensive exercises:

1. Review `/var/log/auth.log` on ubuntu-target
2. Identify detectable artifacts (nmap, hydra, failed SSH)
3. Write detection recommendations (Sigma rule concepts, SIEM alerts)
4. Compare intentional misconfigurations to CIS benchmarks

---

## Tools Referenced (Preconfigured on Kali)

| Tool | Purpose |
|------|---------|
| nmap | Network scanning |
| dirb | Directory brute force |
| whatweb | HTTP fingerprinting |
| curl | Manual HTTP testing |
| hydra | Credential testing (lab scope) |
| ssh | Remote access |

See `~/lab-workspace/TOOLING_REFERENCE.md` on kali-attacker (or `/root/lab-workspace/` if using `sudo -i`).

---

## Legal & Ethical Reminder

- Test **only** 192.168.56.0/24 systems in this lab
- Do not scan your employer, ISP, or public IP ranges from this lab
- Do not distribute lab malware or weaponized payloads
- Document everything for portfolio and interview discussion
