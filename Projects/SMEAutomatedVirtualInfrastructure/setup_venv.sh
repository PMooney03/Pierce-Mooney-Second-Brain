#!/bin/bash
# Setup script for creating a virtual environment for SME Starter Infrastructure

set -e

echo "[INFO] Setting up virtual environment for SME Starter Infrastructure..."
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 is not installed or not in PATH"
    echo "Please install Python 3.7 or higher"
    exit 1
fi

# Get Python version
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "[OK] Found Python ${PYTHON_VERSION}"

# Check Python version (3.7+)
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 7 ]); then
    echo "[ERROR] Python 3.7 or higher is required (found ${PYTHON_VERSION})"
    exit 1
fi

# Create virtual environment
VENV_DIR="venv"
if [ -d "$VENV_DIR" ]; then
    echo "[WARNING] Virtual environment already exists at $VENV_DIR"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing existing virtual environment..."
        rm -rf "$VENV_DIR"
    else
        echo "Using existing virtual environment"
        source "$VENV_DIR/bin/activate"
        echo "[OK] Virtual environment activated"
        echo ""
        echo "To activate manually, run:"
        echo "  source $VENV_DIR/bin/activate"
        exit 0
    fi
fi

echo "Creating virtual environment..."
python3 -m venv "$VENV_DIR"

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip setuptools wheel

# Install the package in development mode
echo "Installing SME Starter Infrastructure in development mode..."
pip install -e .

# Install development dependencies
echo "Installing development dependencies..."
pip install -e ".[dev]"

echo ""
echo "[SUCCESS] Virtual environment setup complete!"
echo ""
echo "Next steps:"
echo "  1. Activate the virtual environment:"
echo "     source $VENV_DIR/bin/activate"
echo ""
echo "  2. Run the CLI:"
echo "     python cli.py --help"
echo "     # or"
echo "     sme-spinup --help"
echo ""
echo "  3. Run tests:"
echo "     pytest"
echo ""
echo "  4. Deactivate when done:"
echo "     deactivate"
