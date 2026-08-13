# SME Infrastructure AI Support Agent — Evaluation Set

Use these questions to test `python cli.py ask "..."` and `python cli.py ai-log`.
Record whether the answer is grounded in cited sources and technically correct for this repo.

| # | Question | Good answer should mention |
|---|----------|----------------------------|
| 1 | How do I deploy the basic environment? | `python cli.py up --preset`, minimal/basic, deploy playbook, mgmt-1 on Windows |
| 2 | What does dc-1 do? | Domain controller, 192.168.56.10, DNS/LDAP/Samba AD |
| 3 | Why is my Vagrant VM not starting? | Prerequisites, VirtualBox, bridge adapter choice, `vagrant up`, logs |
| 4 | How do I check if Ansible completed successfully? | `python cli.py deploy`, playbook exit code, mgmt-1 SSH path on Windows |
| 5 | What should I do if the web server is not reachable? | web-1 IP 192.168.56.30, DC/DNS dependency, status/debug commands |
| 6 | What is the minimal preset? | dc-1, dc-2, mgmt-1 and approximate RAM/time |
| 7 | How do I use the AI assistant after a failed bring-up? | `ai-log --latest`, logs/vagrant, Ollama env vars |
| 8 | How do I start the GUI? | `python cli.py gui`, port 5051 |
| 9 | What is mgmt-1 for? | Management, Ansible jump, monitoring/recovery |
| 10 | How do I analyse a Prometheus alert? | `python cli.py ai-alert`, sample JSON path |
| 11 | What network should I pick when Vagrant asks for a bridge? | Main Ethernet/Wi-Fi, not VPN/Hyper-V |
| 12 | Where are Grafana and Kibana? | monitor-1 :3000, log-1 :5601 (when those VMs exist) |
| 13 | How do I run the interactive setup guide? | `python cli.py start`, `--preset`, `--run-up` |
| 14 | Does the AI train on my logs? | No — retrieval/analysis on demand only |
| 15 | What command shows VM provisioning progress? | `python cli.py status --provisioning` |

## Scoring (manual)

- **Pass**: Answer matches docs; sources list relevant files.
- **Partial**: Mostly correct but vague or missing key command/IP.
- **Fail**: Invents hosts/commands not in project docs.

## Example commands

```bash
python cli.py ask "How do I deploy the basic environment?"
python cli.py ask "What does dc-1 do?"
python cli.py ask -i
```
