# enterprise-pentest-lab - Windows PowerShell setup wrapper
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

$EnableMonitoring = if ($env:ENABLE_MONITORING) { $env:ENABLE_MONITORING } else { "true" }
$SkipVagrant = $env:SKIP_VAGRANT -eq "true"

Write-Host ""
Write-Host "enterprise-pentest-lab - PowerShell Setup" -ForegroundColor Cyan
Write-Host ""

# Detect VirtualBox host-only gateway
$gateway = "192.168.56.1"
if (Get-Command VBoxManage -ErrorAction SilentlyContinue) {
    $vboxOut = VBoxManage list hostonlyifs 2>$null
    if ($vboxOut -match "IPAddress:\s+(\S+)") {
        $gateway = $Matches[1]
    }
}
$env:LAB_HOST_GATEWAY = $gateway
Write-Host "[INFO]  Host gateway: $gateway" -ForegroundColor Blue

# Ansible local override
@"
---
docker_host_ip: "$gateway"
"@ | Set-Content -Path "ansible\group_vars\local.yml" -Encoding UTF8
Write-Host "[OK]    Wrote ansible/group_vars/local.yml" -ForegroundColor Green

# Docker web apps
Write-Host "[INFO]  Starting Docker web services..." -ForegroundColor Blue
docker compose -f docker-compose.yml up -d dvwa dvwa-db juice-shop
if ($LASTEXITCODE -ne 0) { throw "Docker compose failed" }

# Vagrant (installs node_exporter via Ansible)
if (-not $SkipVagrant) {
    Write-Host "[INFO]  Provisioning Vagrant VMs..." -ForegroundColor Blue
    vagrant up
    if ($LASTEXITCODE -ne 0) { throw "Vagrant up failed" }
}

# Monitoring stack (after VMs have node_exporter)
if ($EnableMonitoring -eq "true") {
    Write-Host "[INFO]  Starting monitoring stack..." -ForegroundColor Blue
    docker compose -f docker-compose.yml --profile monitoring up -d cadvisor prometheus grafana
    if ($LASTEXITCODE -ne 0) { throw "Monitoring stack failed" }
}

Write-Host ""
Write-Host "Service Access:" -ForegroundColor Cyan
Write-Host "  DVWA:       http://127.0.0.1:8080/"
Write-Host "  Juice Shop: http://127.0.0.1:3000/"
Write-Host "  Grafana:    http://127.0.0.1:3001/  (admin / labadmin)"
Write-Host "  Prometheus: http://127.0.0.1:9090/targets"
Write-Host "  From VMs:   http://${gateway}:8080/ and :3000/"
Write-Host ""
Write-Host "[OK] Setup complete." -ForegroundColor Green
