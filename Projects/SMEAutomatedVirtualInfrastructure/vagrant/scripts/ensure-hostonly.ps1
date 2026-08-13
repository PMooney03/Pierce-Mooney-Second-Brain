# Ensure a VirtualBox host-only adapter exists on 192.168.56.0/24 so VMs can communicate.
# Host uses 192.168.56.254 so fw-1 can use 192.168.56.1 without conflict.
# Run on the host before vagrant up (via Vagrant trigger). Requires VBoxManage in PATH.
# Safe: only configures host-side host-only NICs; does not change VM adapters. Always exits 0.

$HostIP  = "192.168.56.254"
$Netmask = "255.255.255.0"

# Find VBoxManage
$vbox = Get-Command VBoxManage -ErrorAction SilentlyContinue
if (-not $vbox) {
    $vboxPath = "${env:ProgramFiles}\Oracle\VirtualBox\VBoxManage.exe"
    if (-not (Test-Path $vboxPath)) { $vboxPath = "${env:ProgramFiles(x86)}\Oracle\VirtualBox\VBoxManage.exe" }
    if (-not (Test-Path $vboxPath)) {
        Write-Host "Ensure-HostOnly: VBoxManage not found. Skipping host-only network setup."
        exit 0
    }
    $vbox = $vboxPath
} else {
    $vbox = $vbox.Source
}

# List existing host-only interfaces
$list = & $vbox list hostonlyifs 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ensure-HostOnly: VBoxManage list hostonlyifs failed. Skipping."
    exit 0
}

# If any adapter is already at desired HostIP, we're done
if (($list | Out-String) -match "IPAddress:\s+$HostIP\s") {
    Write-Host "Ensure-HostOnly: Host-only network $HostIP/24 already present."
    exit 0
}

# Try to find an adapter that currently has 192.168.56.1 (old setting) and reuse it
$adapterName = $null
$blocks = -split ($list -replace "`r",""), "`n`n"
foreach ($block in $blocks) {
    if ($block -match "Name:\s+(\S+)" -and $block -match "IPAddress:\s+192\.168\.56\.1") {
        $adapterName = $Matches[1]
        break
    }
}

# If not found, pick any host-only with 169.254.x.x (link-local),
# or create a new one if needed.
if (-not $adapterName) {
    foreach ($block in $blocks) {
        if ($block -match "Name:\s+(\S+)" -and $block -match "IPAddress:\s+169\.254\.\d+\.\d+") {
            $adapterName = $Matches[1]
            break
        }
    }
}

if (-not $adapterName) {
    $createOut = & $vbox hostonlyif create 2>&1
    if ($createOut -match "Interface '([^']+)' was successfully created") {
        $adapterName = $Matches[1]
    } elseif ($createOut -match "([^\s]+)\s+was successfully created") {
        $adapterName = $Matches[1].Trim()
    }
}

if (-not $adapterName) {
    Write-Host "Ensure-HostOnly: Could not create or find a host-only adapter. Configure one manually to $HostIP/$Netmask"
    exit 0
}

# Set IP on the chosen adapter
& $vbox hostonlyif ipconfig "$adapterName" --ip $HostIP --netmask $Netmask 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Ensure-HostOnly: Set $adapterName to $HostIP/$Netmask"
} else {
    Write-Host "Ensure-HostOnly: Failed to set IP on $adapterName (try setting manually in VirtualBox Host-Only Networks)."
}
exit 0
