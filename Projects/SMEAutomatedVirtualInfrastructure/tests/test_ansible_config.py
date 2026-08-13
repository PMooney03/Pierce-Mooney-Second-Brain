#!/usr/bin/env python3
"""
Test suite for Ansible configuration validation
"""

import pytest
import yaml
import os
import sys
from pathlib import Path
from unittest.mock import patch, mock_open

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestAnsibleYAMLValidation:
    """Test Ansible YAML file validation"""

    def test_inventory_yaml_syntax(self):
        """Test inventory YAML syntax"""
        inventory_path = Path(__file__).parent.parent / 'ansible' / 'inventory' / 'hosts.yml'
        
        if inventory_path.exists():
            with open(inventory_path, 'r') as f:
                content = f.read()
                # Should not raise YAMLError
                yaml.safe_load(content)

    def test_playbook_yaml_syntax(self):
        """Test playbook YAML syntax"""
        playbooks_dir = Path(__file__).parent.parent / 'ansible' / 'playbooks'
        
        if playbooks_dir.exists():
            for playbook_file in playbooks_dir.glob('*.yml'):
                with open(playbook_file, 'r') as f:
                    content = f.read()
                    # Should not raise YAMLError
                    yaml.safe_load(content)

    def test_role_yaml_syntax(self):
        """Test role YAML syntax"""
        roles_dir = Path(__file__).parent.parent / 'ansible' / 'roles'
        
        if roles_dir.exists():
            for role_dir in roles_dir.iterdir():
                if role_dir.is_dir():
                    # Check tasks
                    tasks_file = role_dir / 'tasks' / 'main.yml'
                    if tasks_file.exists():
                        with open(tasks_file, 'r') as f:
                            content = f.read()
                            yaml.safe_load(content)
                    
                    # Check handlers
                    handlers_file = role_dir / 'handlers' / 'main.yml'
                    if handlers_file.exists():
                        with open(handlers_file, 'r') as f:
                            content = f.read()
                            yaml.safe_load(content)

    def test_boolean_values_are_true_false(self):
        """Test that YAML files use true/false instead of yes/no"""
        project_root = Path(__file__).parent.parent
        yaml_files = []
        
        # Find all YAML files
        for root, dirs, files in os.walk(project_root):
            for file in files:
                if file.endswith('.yml') or file.endswith('.yaml'):
                    yaml_files.append(Path(root) / file)
        
        for yaml_file in yaml_files:
            with open(yaml_file, 'r') as f:
                content = f.read()
                # Check for yes/no boolean values (should be true/false)
                # Look for patterns like "yes:" or "no:" or "yes" or "no" as standalone values
                lines = content.split('\n')
                for i, line in enumerate(lines, 1):
                    stripped = line.strip()
                    if stripped.startswith('yes:') or stripped.startswith('no:'):
                        pytest.fail(f"Found boolean 'yes' or 'no' in {yaml_file}:{i}: {line}")
                    if stripped == 'yes' or stripped == 'no':
                        pytest.fail(f"Found boolean 'yes' or 'no' in {yaml_file}:{i}: {line}")
                    # Check for yes/no in value positions (after colon)
                    if ': yes' in line or ': no' in line:
                        # But exclude common patterns like "not in", "not found", etc.
                        if not any(pattern in line for pattern in ['not in', 'not found', 'not exist', 'not available']):
                            pytest.fail(f"Found boolean 'yes' or 'no' in {yaml_file}:{i}: {line}")


class TestAnsibleConfiguration:
    """Test Ansible configuration files"""

    def test_ansible_cfg_exists(self):
        """Test that ansible.cfg exists"""
        ansible_cfg = Path(__file__).parent.parent / 'ansible' / 'ansible.cfg'
        assert ansible_cfg.exists(), "ansible.cfg should exist"

    def test_inventory_structure(self):
        """Test inventory structure"""
        inventory_path = Path(__file__).parent.parent / 'ansible' / 'inventory' / 'hosts.yml'
        
        if inventory_path.exists():
            with open(inventory_path, 'r') as f:
                inventory = yaml.safe_load(f)
                
                # Check required groups exist
                required_groups = ['firewalls', 'domain_controllers', 'file_servers', 
                                 'web_servers', 'monitoring', 'logging', 'management']
                
                for group in required_groups:
                    assert group in inventory['all']['children'], f"Missing group: {group}"

    def test_playbook_structure(self):
        """Test playbook structure"""
        playbooks_dir = Path(__file__).parent.parent / 'ansible' / 'playbooks'
        
        if playbooks_dir.exists():
            required_playbooks = ['deploy.yml', 'security.yml', 'maintenance.yml', 'recovery.yml']
            
            for playbook in required_playbooks:
                playbook_path = playbooks_dir / playbook
                assert playbook_path.exists(), f"Missing playbook: {playbook}"

    def test_role_structure(self):
        """Test role structure"""
        roles_dir = Path(__file__).parent.parent / 'ansible' / 'roles'
        
        if roles_dir.exists():
            required_roles = ['common', 'firewall', 'domain_controller', 'management']
            
            for role in required_roles:
                role_path = roles_dir / role
                assert role_path.exists(), f"Missing role: {role}"
                
                # Check role has tasks
                tasks_path = role_path / 'tasks' / 'main.yml'
                assert tasks_path.exists(), f"Missing tasks for role: {role}"


class TestNetworkConfiguration:
    """Test network configuration validation"""

    def test_ip_addresses_unique(self):
        """Test that all IP addresses are unique"""
        inventory_path = Path(__file__).parent.parent / 'ansible' / 'inventory' / 'hosts.yml'
        
        if inventory_path.exists():
            with open(inventory_path, 'r') as f:
                inventory = yaml.safe_load(f)
                
                ip_addresses = []
                
                # Extract all IP addresses
                for group_name, group_data in inventory['all']['children'].items():
                    if 'hosts' in group_data:
                        for host_name, host_data in group_data['hosts'].items():
                            if 'ansible_host' in host_data:
                                ip_addresses.append(host_data['ansible_host'])
                
                # Check for duplicates
                assert len(ip_addresses) == len(set(ip_addresses)), "Duplicate IP addresses found"

    def test_subnet_consistency(self):
        """Test that all IPs are in the same subnet"""
        inventory_path = Path(__file__).parent.parent / 'ansible' / 'inventory' / 'hosts.yml'
        
        if inventory_path.exists():
            with open(inventory_path, 'r') as f:
                inventory = yaml.safe_load(f)
                
                ip_addresses = []
                
                # Extract all IP addresses
                for group_name, group_data in inventory['all']['children'].items():
                    if 'hosts' in group_data:
                        for host_name, host_data in group_data['hosts'].items():
                            if 'ansible_host' in host_data:
                                ip_addresses.append(host_data['ansible_host'])
                
                # Check all IPs are in 192.168.56.x subnet
                for ip in ip_addresses:
                    assert ip.startswith('192.168.56.'), f"IP {ip} not in expected subnet"


class TestSSHProxyConfiguration:
    """Test SSH proxy configuration"""

    def test_ssh_proxy_templates_exist(self):
        """Test that SSH proxy templates exist"""
        templates_dir = Path(__file__).parent.parent / 'ansible' / 'roles' / 'domain_controller' / 'templates'
        
        if templates_dir.exists():
            required_templates = [
                'ssh-proxy.conf.j2',
                'ssh-proxy.service.j2',
                'ssh-tunnel.sh.j2',
                'ssh-logging.conf.j2'
            ]
            
            for template in required_templates:
                template_path = templates_dir / template
                assert template_path.exists(), f"Missing SSH proxy template: {template}"

    def test_ssh_tunnel_script_exists(self):
        """Test that SSH tunnel script exists"""
        script_path = Path(__file__).parent.parent / 'scripts' / 'sme-ssh-tunnel.sh'
        assert script_path.exists(), "SSH tunnel script should exist"
        
        # Check script is executable
        assert os.access(script_path, os.X_OK), "SSH tunnel script should be executable"


if __name__ == '__main__':
    pytest.main([__file__]) 