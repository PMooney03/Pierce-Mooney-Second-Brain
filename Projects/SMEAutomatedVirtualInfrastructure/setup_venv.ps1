# PowerShell script for setting up virtual environment on Windows
# Setup script for creating a virtual environment for SME Starter Infrastructure

Write-Host "Setting up virtual environment for SME Starter Infrastructure..." -ForegroundColor Cyan
Write-Host ""

# Check if Python 3 is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Found $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.7 or higher" -ForegroundColor Yellow
    exit 1
}

# Check Python version
$versionOutput = python --version 2>&1
$versionMatch = $versionOutput -match "(\d+)\.(\d+)"
if ($versionMatch) {
    $major = [int]$matches[1]
    $minor = [int]$matches[2]
    
    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 7)) {
        Write-Host "[ERROR] Python 3.7 or higher is required" -ForegroundColor Red
        exit 1
    }
}

# Create virtual environment
$venvDir = "venv"
if (Test-Path $venvDir) {
    Write-Host "[WARNING] Virtual environment already exists at $venvDir" -ForegroundColor Yellow
    $response = Read-Host "Do you want to recreate it? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Removing existing virtual environment..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $venvDir
    } else {
        Write-Host "Using existing virtual environment" -ForegroundColor Green
        Write-Host ""
        Write-Host "To activate manually, run:" -ForegroundColor Cyan
        Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
        exit 0
    }
}

Write-Host "Creating virtual environment..." -ForegroundColor Cyan
python -m venv $venvDir

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& "$venvDir\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip setuptools wheel

# Install the package in development mode
Write-Host "Installing SME Starter Infrastructure in development mode..." -ForegroundColor Cyan
pip install -e .

# Install development dependencies
Write-Host "Installing development dependencies..." -ForegroundColor Cyan
pip install -e ".[dev]"

Write-Host ""
Write-Host "[SUCCESS] Virtual environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Activate the virtual environment:" -ForegroundColor White
Write-Host "     .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Run the CLI:" -ForegroundColor White
Write-Host "     python cli.py --help" -ForegroundColor Yellow
Write-Host "     # or" -ForegroundColor Gray
Write-Host "     sme-spinup --help" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Run tests:" -ForegroundColor White
Write-Host "     pytest" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Deactivate when done:" -ForegroundColor White
Write-Host "     deactivate" -ForegroundColor Yellow
