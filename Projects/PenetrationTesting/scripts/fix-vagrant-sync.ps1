# Fix /vagrant sync after moving project from enterprise-pentest/ to repo root
# Run from: PenetrationTesting (where Vagrantfile lives)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "[INFO]  Project root: $(Get-Location)" -ForegroundColor Blue
if (-not (Test-Path ".\ansible\site.yml")) {
    Write-Host "[ERROR] ansible/site.yml not found. Run this from the repo root (PenetrationTesting)." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO]  Reloading VMs to remount /vagrant to current folder..." -ForegroundColor Blue
vagrant reload

Write-Host "[INFO]  Re-provisioning (Ansible + node_exporter)..." -ForegroundColor Blue
vagrant provision

Write-Host "[OK]    Done. Verify: vagrant ssh kali-attacker -c 'test -f /vagrant/ansible/site.yml && echo OK'" -ForegroundColor Green
