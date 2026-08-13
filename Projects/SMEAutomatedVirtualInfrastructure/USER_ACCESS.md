# User access: using the VMs from other laptops

After you run **Vagrant** and **Ansible deploy**, these VMs are reachable from any device on your **same LAN** (e.g. home Wi‑Fi) so users can log in and use the services.

## What was changed

- **Bridged NIC** added to: `mgmt-1`, `mgmt-2`, `web-1`, `web-2`, `monitor-1`, `log-1`. Each gets a second IP on your LAN (e.g. `192.168.0.x`) via DHCP.
- **Firewall (UFW)** is opened from your LAN subnet (`192.168.0.0/24` by default) for:
  - **mgmt-1 / mgmt-2**: SSH (22)
  - **web-1 / web-2**: HTTP (80), HTTPS (443)
  - **monitor-1**: Grafana (3000), Prometheus (9090)
  - **log-1**: Kibana (5601)

Internal Ansible and Vagrant still use the host-only network (`192.168.56.x`); nothing there was removed.

---

## 1. Get the bridged IPs

After `vagrant up` and first deploy, each VM gets a LAN IP from your router. From your **Windows host** (PowerShell), run:

```powershell
cd vagrant
vagrant ssh mgmt-1 -c "echo 'mgmt-1:' && ip -4 addr show | grep -E 'inet 192\.168\.' | grep -v 192.168.56"
vagrant ssh web-1 -c "echo 'web-1:' && ip -4 addr show | grep -E 'inet 192\.168\.' | grep -v 192.168.56"
vagrant ssh monitor-1 -c "echo 'monitor-1:' && ip -4 addr show | grep -E 'inet 192\.168\.' | grep -v 192.168.56"
vagrant ssh log-1 -c "echo 'log-1:' && ip -4 addr show | grep -E 'inet 192\.168\.' | grep -v 192.168.56"
```

Or from **inside** `mgmt-1` (e.g. after `vagrant ssh mgmt-1`):

```bash
for h in mgmt-1 web-1 web-2 monitor-1 log-1; do
  echo -n "$h: "
  ssh -o ConnectTimeout=2 vagrant@$h "ip -4 addr show | grep -oP 'inet \K192\.168\.(?!56)[0-9.]+'" 2>/dev/null || echo "n/a"
done
```

Write down the **192.168.0.x** addresses (one per VM). Example: mgmt-1 → `192.168.0.105`, web-1 → `192.168.0.106`, etc.

---

## 2. From another laptop (same Wi‑Fi)

- **SSH (admin)**  
  `ssh sme-admin@<mgmt-1-bridged-IP>`  
  (or `vagrant@<mgmt-1-bridged-IP>` if you use the vagrant key).  
  Use the password you set for `sme-admin` (or the one from the Ansible `common` role).

- **Web app**  
  Browser: `http://<web-1-bridged-IP>` or `http://<web-2-bridged-IP>`

- **Grafana**  
  Browser: `http://<monitor-1-bridged-IP>:3000`

- **Kibana**  
  Browser: `http://<log-1-bridged-IP>:5601`

No VPN or port forwarding needed as long as the device is on the same LAN and the host PC + VMs are on.

---

## 3. Change or disable LAN access

- **Different subnet**  
  In `ansible/inventory/hosts.yml`, set:

  ```yaml
  user_access_subnet: "192.168.1.0/24"   # your LAN
  ```

  Re-run the deploy so the `user_access` role re-applies UFW.

- **Disable user access from LAN**  
  Set:

  ```yaml
  user_access_subnet: ""
  ```

  and re-run deploy.

---

## 4. First-time Vagrant up with bridged NIC

When you run `vagrant up` and a VM gets a **public_network** (bridged) adapter for the first time, Vagrant may ask you to **choose which interface** to bridge to (e.g. "Ethernet" or "Wi-Fi"). Pick the adapter that is on your LAN (same as your PC’s 192.168.0.x). If you don’t want to be prompted, you can set the bridge name in the Vagrantfile (e.g. `bridge: "Ethernet"` in the `public_network` block).
