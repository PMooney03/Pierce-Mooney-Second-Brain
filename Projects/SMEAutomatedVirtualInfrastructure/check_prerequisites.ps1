# PowerShell script to check prerequisites for SME Starter Infrastructure
# Verifies that all required software is installed

Write-Host "Checking prerequisites for SME Starter Infrastructure..." -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Python
Write-Host "Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python (\d+)\.(\d+)") {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        if ($major -ge 3 -and ($major -gt 3 -or $minor -ge 7)) {
            Write-Host "  [OK] $pythonVersion" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Python 3.7+ required (found $pythonVersion)" -ForegroundColor Red
            $allGood = $false
        }
    } else {
        Write-Host "  [OK] $pythonVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "  [ERROR] Python not found. Please install Python 3.7 or higher." -ForegroundColor Red
    Write-Host "    Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    $allGood = $false
}

# Check VirtualBox
Write-Host ""
Write-Host "Checking VirtualBox..." -ForegroundColor Yellow
try {
    $vboxManage = Get-Command VBoxManage -ErrorAction SilentlyContinue
    if (-not $vboxManage) {
        $candidatePaths = @(
            $env:VBOX_INSTALL_PATH,
            $env:VBOX_MSI_INSTALL_PATH,
            "C:\Program Files\Oracle\VirtualBox",
            "C:\Program Files (x86)\Oracle\VirtualBox"
        ) | Where-Object { $_ }

        foreach ($basePath in $candidatePaths) {
            $candidateExe = Join-Path $basePath "VBoxManage.exe"
            if (Test-Path $candidateExe) {
                $vboxManage = @{ Source = $candidateExe }
                break
            }
        }
    }

    if (-not $vboxManage) {
        throw "VBoxManage not found"
    }

    $vboxVersion = & $vboxManage.Source --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] VirtualBox $vboxVersion" -ForegroundColor Green
    } else {
        throw "VBoxManage not found"
    }
} catch {
    Write-Host "  [ERROR] VirtualBox not found. Please install VirtualBox 7.1 or higher." -ForegroundColor Red
    Write-Host "    Download from: https://www.virtualbox.org/wiki/Downloads" -ForegroundColor Yellow
    $allGood = $false
}

# Check Vagrant
Write-Host ""
Write-Host "Checking Vagrant..." -ForegroundColor Yellow
try {
    $vagrantVersion = vagrant --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] $vagrantVersion" -ForegroundColor Green
    } else {
        throw "Vagrant not found"
    }
} catch {
    Write-Host "  [ERROR] Vagrant not found. Please install Vagrant 2.4 or higher." -ForegroundColor Red
    Write-Host "    Download from: https://www.vagrantup.com/downloads" -ForegroundColor Yellow
    $allGood = $false
}

# Check if vagrant directory exists
Write-Host ""
Write-Host "Checking project structure..." -ForegroundColor Yellow
if (Test-Path "vagrant\Vagrantfile") {
    Write-Host "  [OK] Vagrantfile found" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Vagrantfile not found at vagrant\Vagrantfile" -ForegroundColor Red
    Write-Host "    Make sure you're in the project root directory." -ForegroundColor Yellow
    $allGood = $false
}

if (Test-Path "cli.py") {
    Write-Host "  [OK] CLI script found" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] cli.py not found" -ForegroundColor Red
    Write-Host "    Make sure you're in the project root directory." -ForegroundColor Yellow
    $allGood = $false
}

# Summary
Write-Host ""
if ($allGood) {
    Write-Host "[SUCCESS] All prerequisites are installed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Cyan
    Write-Host "  python cli.py up --preset minimal" -ForegroundColor White
} else {
    Write-Host "[ERROR] Some prerequisites are missing. Please install them before proceeding." -ForegroundColor Red
    Write-Host ""
    Write-Host "Installation links:" -ForegroundColor Yellow
    Write-Host "  Python:    https://www.python.org/downloads/" -ForegroundColor White
    Write-Host "  VirtualBox: https://www.virtualbox.org/wiki/Downloads" -ForegroundColor White
    Write-Host "  Vagrant:   https://www.vagrantup.com/downloads" -ForegroundColor White
    exit 1
}
