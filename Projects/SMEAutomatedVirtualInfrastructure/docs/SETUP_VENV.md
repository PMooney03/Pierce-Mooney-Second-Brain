# Virtual Environment Setup Guide

This guide explains how to set up a Python virtual environment for the SME Starter Infrastructure project.

## Quick Start

### Windows (PowerShell)

```powershell
# Run the setup script
.\setup_venv.ps1

# Activate the virtual environment
.\venv\Scripts\Activate.ps1
```

### Linux/macOS (Bash)

```bash
# Make the script executable (first time only)
chmod +x setup_venv.sh

# Run the setup script
./setup_venv.sh

# Activate the virtual environment
source venv/bin/activate
```

## Manual Setup

If you prefer to set up the virtual environment manually:

### 1. Create Virtual Environment

**Windows:**
```powershell
python -m venv venv
```

**Linux/macOS:**
```bash
python3 -m venv venv
```

### 2. Activate Virtual Environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
```

**Linux/macOS:**
```bash
source venv/bin/activate
```

### 3. Upgrade pip

```bash
pip install --upgrade pip setuptools wheel
```

### 4. Install the Package

Install in development mode (editable install):

```bash
pip install -e .
```

### 5. Install Development Dependencies (Optional)

For testing and development:

```bash
pip install -e ".[dev]"
```

Or install test dependencies separately:

```bash
pip install -r requirements-test.txt
```

## Using the CLI

After setting up the virtual environment, you can use the CLI in two ways:

### Option 1: Direct Python Script

```bash
python cli.py up --preset minimal
python cli.py status
```

### Option 2: Installed Command (after `pip install -e .`)

```bash
sme-spinup up --preset minimal
sme-spinup status
# or
sme-infra up --preset minimal
```

## Running Tests

With the virtual environment activated:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov

# Run specific test file
pytest tests/test_cli.py

# Run with verbose output
pytest -v
```

## Deactivating

When you're done working:

```bash
deactivate
```

## Troubleshooting

### Python Version Issues

The project requires Python 3.7 or higher. Check your version:

```bash
python --version  # Windows
python3 --version  # Linux/macOS
```

### Virtual Environment Not Activating (Windows)

If you get an execution policy error on Windows PowerShell:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Permission Denied (Linux/macOS)

If you get permission errors, make sure the script is executable:

```bash
chmod +x setup_venv.sh
```

### Virtual Environment Already Exists

If you want to recreate the virtual environment, delete it first:

```bash
# Windows
Remove-Item -Recurse -Force venv

# Linux/macOS
rm -rf venv
```

Then run the setup script again.

## Project Structure

After setup, your project structure will include:

```
sme-starter-infra/
├── venv/              # Virtual environment (gitignored)
├── setup.py           # Package setup configuration
├── requirements.txt   # Runtime dependencies
├── requirements-test.txt  # Test dependencies
├── cli.py             # Main CLI script
└── ...
```

## Benefits of Virtual Environment

- **Isolation**: Keeps project dependencies separate from system Python
- **Reproducibility**: Ensures consistent environment across different machines
- **Version Control**: Easy to recreate the exact environment
- **Clean Uninstall**: Simply delete the `venv` folder to remove everything

## Next Steps

1. ✅ Set up virtual environment (you're here!)
2. 📖 Read the [README.md](../README.md) for project overview
3. 🚀 Start using the CLI: `python cli.py up --preset minimal`
4. 🧪 Run tests: `pytest`
5. 📚 Check [docs/](../docs/) for more documentation
