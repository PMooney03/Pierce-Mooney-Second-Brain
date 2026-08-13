#!/bin/bash
# Bash script to check prerequisites for SME Starter Infrastructure
# Verifies that all required software is installed

echo "Checking prerequisites for SME Starter Infrastructure..."
echo ""

all_good=true

# Check Python
echo "Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    PYTHON_VER=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    PYTHON_MAJOR=$(echo $PYTHON_VER | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VER | cut -d'.' -f2)
    
    if [ "$PYTHON_MAJOR" -ge 3 ] && ([ "$PYTHON_MAJOR" -gt 3 ] || [ "$PYTHON_MINOR" -ge 7 ]); then
        echo "  [OK] $PYTHON_VERSION"
    else
        echo "  [ERROR] Python 3.7+ required (found $PYTHON_VERSION)"
        all_good=false
    fi
else
    echo "  [ERROR] Python 3 not found. Please install Python 3.7 or higher."
    echo "    Download from: https://www.python.org/downloads/"
    all_good=false
fi

# Check VirtualBox
echo ""
echo "Checking VirtualBox..."
if command -v VBoxManage &> /dev/null; then
    VBOX_VERSION=$(VBoxManage --version 2>&1)
    echo "  [OK] VirtualBox $VBOX_VERSION"
else
    echo "  [ERROR] VirtualBox not found. Please install VirtualBox 7.1 or higher."
    echo "    Download from: https://www.virtualbox.org/wiki/Downloads"
    all_good=false
fi

# Check Vagrant
echo ""
echo "Checking Vagrant..."
if command -v vagrant &> /dev/null; then
    VAGRANT_VERSION=$(vagrant --version 2>&1)
    echo "  [OK] $VAGRANT_VERSION"
else
    echo "  [ERROR] Vagrant not found. Please install Vagrant 2.4 or higher."
    echo "    Download from: https://www.vagrantup.com/downloads"
    all_good=false
fi

# Check if vagrant directory exists
echo ""
echo "Checking project structure..."
if [ -f "vagrant/Vagrantfile" ]; then
    echo "  [OK] Vagrantfile found"
else
    echo "  [ERROR] Vagrantfile not found at vagrant/Vagrantfile"
    echo "    Make sure you're in the project root directory."
    all_good=false
fi

if [ -f "cli.py" ]; then
    echo "  [OK] CLI script found"
else
    echo "  [ERROR] cli.py not found"
    echo "    Make sure you're in the project root directory."
    all_good=false
fi

# Summary
echo ""
if [ "$all_good" = true ]; then
    echo "[SUCCESS] All prerequisites are installed!"
    echo ""
    echo "You can now run:"
    echo "  python cli.py up --preset minimal"
    exit 0
else
    echo "[ERROR] Some prerequisites are missing. Please install them before proceeding."
    echo ""
    echo "Installation links:"
    echo "  Python:    https://www.python.org/downloads/"
    echo "  VirtualBox: https://www.virtualbox.org/wiki/Downloads"
    echo "  Vagrant:   https://www.vagrantup.com/downloads"
    exit 1
fi
