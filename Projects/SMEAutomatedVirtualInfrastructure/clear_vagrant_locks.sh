#!/bin/bash
# Bash script to clear Vagrant locks
# Use this if you get "another process is already executing an action" errors

echo "Clearing Vagrant locks..."
echo ""

# Check for running Vagrant processes
echo "Checking for running Vagrant processes..."
VAGRANT_PIDS=$(pgrep -f vagrant 2>/dev/null)
RUBY_PIDS=$(pgrep -f ruby 2>/dev/null)

if [ -n "$VAGRANT_PIDS" ]; then
    echo "  Found Vagrant process(es): $VAGRANT_PIDS"
    read -p "Kill these processes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $VAGRANT_PIDS 2>/dev/null
        echo "  [OK] Killed Vagrant processes"
    fi
else
    echo "  [OK] No Vagrant processes found"
fi

if [ -n "$RUBY_PIDS" ]; then
    echo "  Found Ruby process(es): $RUBY_PIDS"
    read -p "Kill these processes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $RUBY_PIDS 2>/dev/null
        echo "  [OK] Killed Ruby processes"
    fi
else
    echo "  [OK] No Ruby processes found"
fi

# Remove lock files
echo ""
echo "Removing Vagrant lock files..."
LOCK_COUNT=0
if [ -d "vagrant/.vagrant" ]; then
    find vagrant/.vagrant -name "*.lock" -type f | while read -r lockfile; do
        echo "    Removing: $lockfile"
        rm -f "$lockfile"
        LOCK_COUNT=$((LOCK_COUNT + 1))
    done
    
    if [ $LOCK_COUNT -gt 0 ]; then
        echo "  [OK] Removed $LOCK_COUNT lock file(s)"
    else
        echo "  [OK] No lock files found"
    fi
else
    echo "  [OK] No .vagrant directory found"
fi

echo ""
echo "[SUCCESS] Vagrant locks cleared!"
echo ""
echo "You can now try running your command again:"
echo "  sme-spinup destroy --preset minimal"
