# PowerShell script to clear Vagrant locks
# Use this if you get "another process is already executing an action" errors

Write-Host "Clearing Vagrant locks..." -ForegroundColor Cyan
Write-Host ""

# Check for running Vagrant processes
Write-Host "Checking for running Vagrant processes..." -ForegroundColor Yellow
$vagrantProcesses = Get-Process -Name "vagrant" -ErrorAction SilentlyContinue
$rubyProcesses = Get-Process -Name "ruby" -ErrorAction SilentlyContinue

if ($vagrantProcesses) {
    Write-Host "  Found $($vagrantProcesses.Count) Vagrant process(es)" -ForegroundColor Yellow
    $response = Read-Host "Kill these processes? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        $vagrantProcesses | Stop-Process -Force
        Write-Host "  [OK] Killed Vagrant processes" -ForegroundColor Green
    }
} else {
    Write-Host "  [OK] No Vagrant processes found" -ForegroundColor Green
}

if ($rubyProcesses) {
    Write-Host "  Found $($rubyProcesses.Count) Ruby process(es)" -ForegroundColor Yellow
    $response = Read-Host "Kill these processes? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        $rubyProcesses | Stop-Process -Force
        Write-Host "  [OK] Killed Ruby processes" -ForegroundColor Green
    }
} else {
    Write-Host "  [OK] No Ruby processes found" -ForegroundColor Green
}

# Remove lock files
Write-Host ""
Write-Host "Removing Vagrant lock files..." -ForegroundColor Yellow
$lockFiles = Get-ChildItem -Path "vagrant\.vagrant" -Recurse -Filter "*.lock" -ErrorAction SilentlyContinue

if ($lockFiles) {
    Write-Host "  Found $($lockFiles.Count) lock file(s)" -ForegroundColor Yellow
    foreach ($lock in $lockFiles) {
        Write-Host "    Removing: $($lock.FullName)" -ForegroundColor Gray
        Remove-Item -Path $lock.FullName -Force
    }
    Write-Host "  [OK] Lock files removed" -ForegroundColor Green
} else {
    Write-Host "  [OK] No lock files found" -ForegroundColor Green
}

Write-Host ""
Write-Host "[SUCCESS] Vagrant locks cleared!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now try running your command again:" -ForegroundColor Cyan
Write-Host "  sme-spinup destroy --preset minimal" -ForegroundColor White
