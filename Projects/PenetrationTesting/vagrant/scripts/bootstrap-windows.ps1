# Bootstrap Windows Server eval VM for future AD expansion
Write-Host "[bootstrap-windows] Preparing windows-server for lab use..."

# Enable WinRM for Ansible (future expansion)
Enable-PSRemoting -Force -SkipNetworkProfileCheck

# Lab marker
$labPath = "C:\enterprise-pentest-lab"
New-Item -ItemType Directory -Force -Path $labPath | Out-Null
"windows-server" | Set-Content -Path "$labPath\role.txt"
(Get-Date -Format o) | Set-Content -Path "$labPath\bootstrap-timestamp.txt"

Write-Host "[bootstrap-windows] Placeholder complete. Expand with AD roles in ansible/roles/ when ready."
