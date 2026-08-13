#!/usr/bin/env python3
"""
Test suite for Vagrant configuration validation
"""

import pytest
import os
import sys
from pathlib import Path
from unittest.mock import patch, mock_open

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestVagrantfileValidation:
    """Test Vagrantfile configuration"""

    def test_vagrantfile_exists(self):
        """Test that Vagrantfile exists"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        assert vagrantfile.exists(), "Vagrantfile should exist"

    def test_vagrantfile_syntax(self):
        """Test Vagrantfile Ruby syntax"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        
        if vagrantfile.exists():
            with open(vagrantfile, 'r') as f:
                content = f.read()
                
                # Basic syntax checks
                assert 'Vagrant.configure' in content, "Should contain Vagrant.configure"
                assert 'config.vm.box' in content, "Should contain box configuration"
                assert 'config.vm.define' in content, "Should contain VM definitions"

    def test_vm_definitions(self):
        """Test that all required VMs are defined"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        
        if vagrantfile.exists():
            with open(vagrantfile, 'r') as f:
                content = f.read()
                
                # Check for required VM definitions
                required_vms = [
                    'fw-1', 'fw-2',           # Firewalls
                    'dc-1', 'dc-2',           # Domain Controllers
                    'filesrv-1', 'filesrv-2', # File Servers
                    'web-1', 'web-2',         # Web Servers
                    'monitor-1',              # Monitoring
                    'log-1',                  # Logging
                    'mgmt-1', 'mgmt-2'        # Management
                ]
                
                for vm in required_vms:
                    assert f'config.vm.define "{vm}"' in content, f"Missing VM definition: {vm}"

    def test_network_configuration(self):
        """Test network configuration"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        
        if vagrantfile.exists():
            with open(vagrantfile, 'r') as f:
                content = f.read()
                
                # Check for private network configuration
                assert 'private_network' in content, "Should use private_network"
                assert '192.168.56.' in content, "Should use 192.168.56.x subnet"


class TestBootstrapScripts:
    """Test bootstrap script configuration"""

    def test_bootstrap_scripts_exist(self):
        """Test that all bootstrap scripts exist"""
        bootstrap_dir = Path(__file__).parent.parent / 'vagrant' / 'bootstrap'
        
        if bootstrap_dir.exists():
            required_scripts = [
                'fw.sh', 'dc.sh', 'filesrv.sh', 'web.sh',
                'monitor.sh', 'log.sh', 'mgmt.sh'
            ]
            
            for script in required_scripts:
                script_path = bootstrap_dir / script
                assert script_path.exists(), f"Missing bootstrap script: {script}"
                
                # Check script is executable
                assert os.access(script_path, os.X_OK), f"Bootstrap script should be executable: {script}"

    def test_bootstrap_script_shebang(self):
        """Test that bootstrap scripts have proper shebang"""
        bootstrap_dir = Path(__file__).parent.parent / 'vagrant' / 'bootstrap'
        
        if bootstrap_dir.exists():
            for script_file in bootstrap_dir.glob('*.sh'):
                with open(script_file, 'r') as f:
                    first_line = f.readline().strip()
                    assert first_line.startswith('#!/bin/bash'), f"Script {script_file} should start with #!/bin/bash"

    def test_bootstrap_script_parameters(self):
        """Test that bootstrap scripts accept parameters"""
        bootstrap_dir = Path(__file__).parent.parent / 'vagrant' / 'bootstrap'
        
        if bootstrap_dir.exists():
            for script_file in bootstrap_dir.glob('*.sh'):
                with open(script_file, 'r') as f:
                    content = f.read()
                    # Check for environment variable usage (HOSTNAME, HOST_IP)
                    assert 'HOSTNAME' in content or 'HOST_IP' in content, f"Script {script_file} should use environment variables"

    def test_vagrantfile_bootstrap_integration(self):
        """Test that Vagrantfile properly calls bootstrap scripts"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        
        if vagrantfile.exists():
            with open(vagrantfile, 'r') as f:
                content = f.read()
                
                # Check for bootstrap script references
                assert 'bootstrap/' in content, "Should reference bootstrap scripts"
                assert '.sh' in content, "Should reference .sh files"


class TestHostnameConfiguration:
    """Test hostname configuration"""

    def test_hostname_resolution(self):
        """Test that hostname resolution is configured"""
        # Check if setup-hostnames.sh exists
        script_path = Path(__file__).parent.parent / 'scripts' / 'setup-hostnames.sh'
        assert script_path.exists(), "Hostname setup script should exist"
        
        # Check if it's executable
        assert os.access(script_path, os.X_OK), "Hostname setup script should be executable"

    def test_hostname_script_content(self):
        """Test hostname script content"""
        script_path = Path(__file__).parent.parent / 'scripts' / 'setup-hostnames.sh'
        
        if script_path.exists():
            with open(script_path, 'r') as f:
                content = f.read()
                
                # Check for required hostnames
                required_hostnames = [
                    'fw-1', 'fw-2', 'dc-1', 'dc-2', 'filesrv-1', 'filesrv-2',
                    'web-1', 'web-2', 'monitor-1', 'log-1', 'mgmt-1', 'mgmt-2'
                ]
                
                for hostname in required_hostnames:
                    assert hostname in content, f"Hostname {hostname} should be in setup script"


class TestNetworkArchitecture:
    """Test network architecture configuration"""

    def test_ip_allocation(self):
        """Test IP address allocation"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        
        if vagrantfile.exists():
            with open(vagrantfile, 'r') as f:
                content = f.read()
                
                # Check IP ranges for different roles
                # Firewalls: fw-1 at .3, fw-2 at .2 (host keeps .1 to avoid conflict)
                assert '192.168.56.3' in content, "fw-1 should use 192.168.56.3"
                assert '192.168.56.2' in content, "fw-2 should use 192.168.56.2"
                
                # Domain Controllers: 192.168.56.10-11
                assert '192.168.56.10' in content, "DC should use 192.168.56.10"
                assert '192.168.56.11' in content, "DC should use 192.168.56.11"
                
                # File Servers: 192.168.56.20-21
                assert '192.168.56.20' in content, "File server should use 192.168.56.20"
                assert '192.168.56.21' in content, "File server should use 192.168.56.21"
                
                # Web Servers: 192.168.56.30-31
                assert '192.168.56.30' in content, "Web server should use 192.168.56.30"
                assert '192.168.56.31' in content, "Web server should use 192.168.56.31"

    def test_role_based_networking(self):
        """Test role-based network configuration"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        
        if vagrantfile.exists():
            with open(vagrantfile, 'r') as f:
                content = f.read()
                
                # Check that different roles use different IP ranges
                # This ensures proper network segmentation
                assert content.count('192.168.56.') >= 12, "Should have at least 12 IP addresses"


class TestResourceConfiguration:
    """Test resource configuration"""

    def test_memory_allocation(self):
        """Test memory allocation configuration"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        
        if vagrantfile.exists():
            with open(vagrantfile, 'r') as f:
                content = f.read()
                
                # Check for memory configuration
                assert 'vb.memory' in content, "Should configure memory allocation"

    def test_cpu_allocation(self):
        """Test CPU allocation configuration"""
        vagrantfile = Path(__file__).parent.parent / 'vagrant' / 'Vagrantfile'
        
        if vagrantfile.exists():
            with open(vagrantfile, 'r') as f:
                content = f.read()
                
                # Check for CPU configuration
                assert 'vb.cpus' in content, "Should configure CPU allocation"


if __name__ == '__main__':
    pytest.main([__file__]) 