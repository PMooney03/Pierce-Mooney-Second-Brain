#!/usr/bin/env python3
"""
Pytest configuration and fixtures for SME Infrastructure tests
"""

import pytest
import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, patch

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope="session")
def project_root():
    """Return the project root directory"""
    return Path(__file__).parent.parent


@pytest.fixture(scope="session")
def test_data_dir():
    """Return the test data directory"""
    return Path(__file__).parent / "data"


@pytest.fixture(scope="session")
def temp_dir():
    """Create a temporary directory for tests"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def mock_subprocess_run():
    """Mock subprocess.run for testing"""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "Mock output"
        mock_run.return_value.stderr = ""
        yield mock_run


@pytest.fixture
def mock_os_path_exists():
    """Mock os.path.exists for testing"""
    with patch('os.path.exists') as mock_exists:
        mock_exists.return_value = True
        yield mock_exists


@pytest.fixture
def mock_os_chdir():
    """Mock os.chdir for testing"""
    with patch('os.chdir') as mock_chdir:
        yield mock_chdir


@pytest.fixture
def sample_vagrantfile():
    """Sample Vagrantfile content for testing"""
    return """
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "ubuntu/jammy64"

  config.vm.provider "virtualbox" do |vb|
    vb.memory = "1024"
    vb.cpus = 1
  end

  config.vm.define "web-1" do |web1|
    web1.vm.hostname = "web-1.local"
    web1.vm.network "private_network", ip: "192.168.56.30"
  end
end
"""


@pytest.fixture
def sample_inventory():
    """Sample Ansible inventory for testing"""
    return {
        'all': {
            'children': {
                'web_servers': {
                    'hosts': {
                        'web-1': {
                            'ansible_host': '192.168.56.30',
                            'ansible_user': 'vagrant'
                        }
                    }
                }
            }
        }
    }


@pytest.fixture
def mock_cli_args():
    """Mock CLI arguments for testing"""
    args = Mock()
    args.action = 'up'
    args.hosts = ['web:1']
    args.default = False
    args.dry_run = False
    args.validate = False
    args.limit = None
    args.tags = None
    args.health_check = False
    args.recover = None
    args.monitor = False
    args.ssh_proxy = None
    args.ssh_user = 'vagrant'
    args.ssh_port = 2222
    args.ssh_dc = None
    return args


@pytest.fixture(scope="session")
def coverage_config():
    """Coverage configuration for tests"""
    return {
        'source': ['cli.py', 'scripts/'],
        'omit': [
            '*/tests/*',
            '*/venv/*',
            '*/__pycache__/*',
            '*/migrations/*'
        ],
        'branch': True,
        'precision': 2
    }


@pytest.fixture
def fake_vagrantfile(tmp_path):
    """Create a fake Vagrantfile with some VM definitions."""
    vagrantfile = tmp_path / "Vagrantfile"
    vagrantfile.write_text('config.vm.define "fw-1"\nconfig.vm.define "web-1"\n')
    return vagrantfile

@pytest.fixture
def patch_vagrantfile(monkeypatch, fake_vagrantfile):
    """Patch os.path.exists and open to use the fake Vagrantfile."""
    monkeypatch.setattr(os.path, "exists", lambda path: True)
    
    # Store the original open function before patching
    original_open = open
    
    def fake_open(*args, **kwargs):
        # Use the original open function to avoid recursion
        return original_open(fake_vagrantfile, *args[1:], **kwargs)
    
    monkeypatch.setattr("builtins.open", fake_open)

@pytest.fixture
def patch_subprocess_success(monkeypatch):
    """Patch subprocess.run to always succeed."""
    def fake_run(*a, **k):
        class Result:
            returncode = 0
            stdout = "Success"
            stderr = ""
        return Result()
    monkeypatch.setattr("subprocess.run", fake_run)

@pytest.fixture
def patch_subprocess_fail(monkeypatch):
    """Patch subprocess.run to always fail."""
    def fake_run(*a, **k):
        raise Exception("subprocess failed")
    monkeypatch.setattr("subprocess.run", fake_run)

@pytest.fixture
def cli_output(capsys):
    """Capture CLI output for assertions."""
    yield capsys


# Pytest hooks
def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection"""
    for item in items:
        # Mark tests based on their location
        if 'test_cli.py' in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif 'test_ansible_config.py' in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif 'test_vagrant_config.py' in str(item.fspath):
            item.add_marker(pytest.mark.integration)


def pytest_html_report_title(report):
    """Set the title for HTML reports"""
    report.title = "SME Infrastructure Test Report"


def pytest_html_results_summary(prefix, summary, postfix):
    """Customize HTML report summary"""
    prefix.extend([
        "<h2>Test Summary</h2>",
        "<p>This report shows the test results for the SME Infrastructure project.</p>"
    ]) 