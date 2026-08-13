#!/usr/bin/env bash
# Ensure a VirtualBox host-only adapter exists on 192.168.56.0/24 so VMs can communicate.
# Host uses .254 so fw-1 can use .1 without conflict. Run on the host before vagrant up
# (e.g. via Vagrant trigger). Requires VBoxManage in PATH. Safe: only configures host-side
# host-only NICs; does not change VM adapters (Adapter 1/2). Always exits 0.

set -e
HOST_IP="192.168.56.254"
NETMASK="255.255.255.0"

if ! command -v VBoxManage >/dev/null 2>&1; then
  echo "Ensure-HostOnly: VBoxManage not found. Skipping host-only network setup."
  exit 0
fi

if VBoxManage list hostonlyifs | grep -q "IPAddress:.*${HOST_IP}"; then
  echo "Ensure-HostOnly: Host-only network ${HOST_IP}/24 already present."
  exit 0
fi

# Create a new host-only interface
OUT=$(VBoxManage hostonlyif create 2>&1) || true
NAME=""
if echo "$OUT" | grep -q "successfully created"; then
  # Parse name: "Interface 'vboxnet0' was successfully created" or similar
  NAME=$(echo "$OUT" | sed -n "s/.*['\"]\\([^'\"]*\\)['\"].*successfully created/\\1/p" | head -1)
fi

if [ -z "$NAME" ]; then
  # Use only an adapter with link-local (169.254.x) so we don't overwrite another project's host-only
  NAME=$(VBoxManage list hostonlyifs | awk -v ip="$HOST_IP" '
    /^Name:/ { n = $2 }
    /^IPAddress:/ { if ($2 != ip && $2 ~ /^169\.254\./) { print n; exit } }
  ')
fi

if [ -z "$NAME" ]; then
  echo "Ensure-HostOnly: Could not create or find a host-only adapter. Configure one manually to ${HOST_IP}/${NETMASK}"
  exit 0
fi

if VBoxManage hostonlyif ipconfig "$NAME" --ip "$HOST_IP" --netmask "$NETMASK" 2>/dev/null; then
  echo "Ensure-HostOnly: Set $NAME to ${HOST_IP}/${NETMASK}"
else
  echo "Ensure-HostOnly: Failed to set IP on $NAME (try setting manually in VirtualBox Host-Only Networks)."
fi
exit 0
