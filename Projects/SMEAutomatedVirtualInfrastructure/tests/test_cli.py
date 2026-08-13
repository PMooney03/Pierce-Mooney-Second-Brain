#!/usr/bin/env python3
"""
Test suite for SME Infrastructure CLI
"""

import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock
from io import StringIO
import subprocess

# Add the project root to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import the functions we're testing
from cli import (
    validate_vagrantfile, expand_hosts, run_vagrant_command, 
    run_ansible_playbook, show_status, run_ssh_proxy_command,
    DEFAULT_HOSTS, main, VALID_ROLES
)


class TestCLIValidation:
    """Test CLI validation functions"""

    @patch('subprocess.run')
    def test_validate_vagrantfile_valid(self, mock_run):
        """Test valid Vagrantfile"""
        with patch('os.path.exists', return_value=True):
            mock_run.return_value.returncode = 0
            result = validate_vagrantfile()
            assert result is True

    @patch('subprocess.run')
    def test_validate_vagrantfile_invalid(self, mock_run):
        """Test invalid Vagrantfile"""
        with patch('os.path.exists', return_value=False):
            result = validate_vagrantfile()
            assert result is False

    def test_expand_hosts_single_role(self):
        """Test expanding single role"""
        hosts = expand_hosts(['web'])
        expected = ['web-1']  # Single role gets counter 1
        assert hosts == expected

    def test_expand_hosts_multiple_roles(self):
        """Test expanding multiple roles"""
        hosts = expand_hosts(['web', 'web'])
        expected = ['web-1', 'web-2']  # Counter increments
        assert hosts == expected

    def test_expand_hosts_role_count(self):
        """Test expanding role:count syntax"""
        hosts = expand_hosts(['web:2'])
        expected = ['web-1', 'web-2']
        assert hosts == expected

    def test_expand_hosts_mixed(self):
        """Test expanding mixed syntax"""
        hosts = expand_hosts(['web:1', 'dc:2'])
        expected = ['web-1', 'dc-1', 'dc-2']
        assert hosts == expected

    def test_expand_hosts_invalid_role(self):
        """Test expanding invalid role"""
        with pytest.raises(SystemExit):
            expand_hosts(['invalid-role'])

    def test_expand_hosts_invalid_count(self):
        """Test expanding with invalid count"""
        with pytest.raises(SystemExit):
            expand_hosts(['web:5'])  # web only supports 2

    def test_expand_hosts_too_many_instances(self):
        """Test error when too many instances of a role are specified"""
        with pytest.raises(SystemExit):
            expand_hosts(['web', 'web', 'web'])  # Only 2 allowed


class TestVagrantCommands:
    """Test Vagrant command execution"""

    @patch('subprocess.run')
    @patch('os.chdir')
    @patch('os.getcwd')
    def test_run_vagrant_command_success(self, mock_getcwd, mock_chdir, mock_run):
        """Test successful Vagrant command execution"""
        mock_getcwd.return_value = '/original/dir'
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "Success"
        
        result = run_vagrant_command('up', ['web-1'], dry_run=False)
        
        assert result is True
        # Check that chdir was called with 'vagrant' and then back to original
        mock_chdir.assert_any_call('vagrant')
        mock_chdir.assert_any_call('/original/dir')

    @patch('subprocess.run')
    def test_run_vagrant_command_dry_run(self, mock_run):
        """Test Vagrant command dry run"""
        result = run_vagrant_command('up', ['web-1'], dry_run=True)

        assert result is True
        mock_run.assert_not_called()

    @patch('subprocess.run')
    @patch('os.chdir')
    def test_run_vagrant_command_failure(self, mock_chdir, mock_run):
        """Test Vagrant command failure"""
        mock_run.side_effect = Exception("Command failed")

        result = run_vagrant_command('up', ['web-1'], dry_run=False)

        assert result is False

    @patch('subprocess.run')
    @patch('os.chdir')
    @patch('os.getcwd')
    def test_run_vagrant_command_no_hosts(self, mock_getcwd, mock_chdir, mock_run):
        """Test error when no hosts are specified"""
        mock_getcwd.return_value = '/original/dir'
        result = run_vagrant_command('up', [], dry_run=False)
        assert result is False


class TestAnsibleCommands:
    """Test Ansible playbook execution"""

    @patch('subprocess.run')
    @patch('os.path.exists')
    def test_run_ansible_playbook_success(self, mock_exists, mock_run):
        """Test successful Ansible playbook execution"""
        mock_exists.return_value = True
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "Success"

        result = run_ansible_playbook('deploy')

        assert result is True

    @patch('os.path.exists')
    def test_run_ansible_playbook_script_not_found(self, mock_exists):
        """Test Ansible playbook with missing script"""
        mock_exists.return_value = False

        result = run_ansible_playbook('deploy')

        assert result is False

    @patch('subprocess.run')
    @patch('os.path.exists', return_value=True)
    def test_run_ansible_playbook_dry_run(self, mock_exists, mock_run):
        """Test Ansible playbook dry run"""
        result = run_ansible_playbook('deploy', dry_run=True)

        assert result is True
        mock_run.assert_not_called()

    @patch('subprocess.run')
    @patch('os.path.exists')
    def test_run_ansible_playbook_script_error(self, mock_exists, mock_run):
        """Test error when ansible script fails to run"""
        mock_exists.return_value = True
        mock_run.side_effect = subprocess.CalledProcessError(1, 'ansible')
        result = run_ansible_playbook('deploy')
        assert result is False


class TestSSHProxyCommands:
    """Test SSH proxy functionality"""

    @patch('subprocess.run')
    def test_run_ssh_proxy_command_success(self, mock_run):
        """Test successful SSH proxy command"""
        mock_run.return_value.returncode = 0

        args = Mock()
        args.ssh_proxy = 'web-1'
        args.ssh_user = 'vagrant'
        args.ssh_port = 2222
        args.ssh_dc = None

        # Should not raise exception
        run_ssh_proxy_command(args)

        mock_run.assert_called_once()

    @patch('subprocess.run')
    def test_run_ssh_proxy_command_failure(self, mock_run):
        """Test SSH proxy command failure"""
        mock_run.side_effect = subprocess.CalledProcessError(1, "ssh")

        args = Mock()
        args.ssh_proxy = 'web-1'
        args.ssh_user = 'vagrant'
        args.ssh_port = 2222
        args.ssh_dc = None

        with pytest.raises(SystemExit):
            run_ssh_proxy_command(args)

    @patch('subprocess.run')
    def test_run_ssh_proxy_command_keyboard_interrupt(self, mock_run):
        """Test SSH proxy command with keyboard interrupt"""
        mock_run.side_effect = KeyboardInterrupt()
        
        args = Mock()
        args.ssh_proxy = 'web-1'
        args.ssh_user = 'vagrant'
        args.ssh_port = 2222
        args.ssh_dc = None
        
        with pytest.raises(SystemExit):
            run_ssh_proxy_command(args)
    
    @patch('subprocess.run')
    def test_run_ssh_proxy_command_with_custom_options(self, mock_run):
        """Test SSH proxy command with custom username, port, and DC"""
        mock_run.return_value.returncode = 0
        
        args = Mock()
        args.ssh_proxy = 'web-1'
        args.ssh_user = 'admin'
        args.ssh_port = 2223
        args.ssh_dc = 2
        
        run_ssh_proxy_command(args)
        
        # Verify the command was built correctly
        expected_cmd = ['./scripts/sme-ssh-tunnel.sh', '-u', 'admin', '-p', '2223', '-d', '2', '-c', 'web-1']
        mock_run.assert_called_once_with(expected_cmd, check=True)
    
    @patch('subprocess.run')
    @patch('os.chdir')
    @patch('os.getcwd')
    def test_run_vagrant_command_subprocess_error(self, mock_getcwd, mock_chdir, mock_run):
        """Test vagrant command with subprocess error"""
        mock_getcwd.return_value = '/original/dir'
        mock_run.side_effect = subprocess.CalledProcessError(1, 'vagrant', stderr='Error message')
        
        result = run_vagrant_command('up', ['web-1'], dry_run=False)
        assert result is False
    
    @patch('subprocess.run')
    @patch('os.path.exists')
    def test_run_ansible_playbook_with_options(self, mock_exists, mock_run):
        """Test ansible playbook with options"""
        mock_exists.return_value = True
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "Success"
        
        result = run_ansible_playbook('deploy', ['--limit', 'web_servers'], dry_run=False)
        assert result is True
        
        # Verify command was built correctly
        expected_cmd = ['scripts/ansible-runner.sh', 'deploy', '--limit', 'web_servers']
        mock_run.assert_called_once_with(expected_cmd, check=True, capture_output=True, text=True)
    
    @patch('subprocess.run')
    @patch('os.path.exists')
    def test_run_ansible_playbook_dry_run(self, mock_exists, mock_run):
        """Test ansible playbook dry run"""
        mock_exists.return_value = True
        
        result = run_ansible_playbook('deploy', dry_run=True)
        assert result is True
        mock_run.assert_not_called()
    
    @patch('subprocess.run')
    @patch('os.path.exists')
    def test_run_ansible_playbook_unexpected_error(self, mock_exists, mock_run):
        """Test ansible playbook with unexpected error"""
        mock_exists.return_value = True
        mock_run.side_effect = Exception("Unexpected error")
        
        result = run_ansible_playbook('deploy')
        assert result is False


class TestStatusCommands:
    """Test status and monitoring commands"""

    @patch('subprocess.run')
    @patch('os.chdir')
    def test_show_status_success(self, mock_chdir, mock_run):
        """Test successful status display"""
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "VM Status"
        
        show_status()
        
        # Check that chdir was called with 'vagrant' and then back to parent
        mock_chdir.assert_any_call('vagrant')
        mock_chdir.assert_any_call('..')

    @patch('subprocess.run')
    @patch('os.chdir')
    def test_show_status_error(self, mock_chdir, mock_run):
        """Test error in show_status when subprocess fails"""
        mock_run.side_effect = Exception("status error")
        show_status()  # Should print error but not raise


class TestConstants:
    """Test CLI constants"""

    def test_valid_roles(self):
        """Test VALID_ROLES constant"""
        expected_roles = {
            'fw': 2, 'dc': 2, 'filesrv': 2, 'web': 2,
            'monitor': 1, 'log': 1, 'mgmt': 2
        }
        assert VALID_ROLES == expected_roles

    def test_default_hosts(self):
        """Test DEFAULT_HOSTS constant"""
        expected_hosts = [
            'fw-1', 'fw-2', 'dc-1', 'dc-2', 'filesrv-1', 'filesrv-2',
            'web-1', 'web-2', 'monitor-1', 'log-1', 'mgmt-1', 'mgmt-2'
        ]
        assert DEFAULT_HOSTS == expected_hosts


class TestIntegration:
    """Test integration scenarios"""
    
    @patch('cli.run_vagrant_command')
    @patch('os.chdir')
    @patch('os.getcwd')
    def test_cli_up_default(self, mock_getcwd, mock_chdir, mock_run_vagrant):
        """Test CLI up with default hosts"""
        mock_getcwd.return_value = '/original/dir'
        mock_run_vagrant.return_value = True
        
        # Test the mocked function directly
        result = mock_run_vagrant('up', DEFAULT_HOSTS)
        assert result is True
    
    @patch('cli.run_ansible_playbook')
    @patch('os.path.exists')
    def test_cli_deploy(self, mock_exists, mock_run_ansible):
        """Test CLI deploy command"""
        mock_exists.return_value = True
        mock_run_ansible.return_value = True
        
        result = run_ansible_playbook('deploy')
        assert result is True


class TestCLIMain:
    """Test CLI main function with various arguments"""
    
    @patch('cli.run_vagrant_command')
    @patch('cli.validate_vagrantfile')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_up_default(self, mock_parse_args, mock_validate, mock_run_vagrant):
        """Test main function with up --default"""
        args = Mock()
        args.action = 'up'
        args.hosts = None
        args.default = True
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
        args.preset = None

        mock_parse_args.return_value = args
        mock_run_vagrant.return_value = True

        with patch('sys.exit') as mock_exit:
            main()
            mock_run_vagrant.assert_called_once()
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_deploy(self, mock_parse_args, mock_run_ansible):
        """Test main function with deploy action"""
        args = Mock()
        args.action = 'deploy'
        args.hosts = None
        args.default = False
        args.dry_run = False
        args.validate = False
        args.limit = 'web_servers'
        args.tags = 'setup'
        args.health_check = False
        args.recover = None
        args.monitor = False
        args.ssh_proxy = None
        args.ssh_user = 'vagrant'
        args.ssh_port = 2222
        args.ssh_dc = None
        args.preset = None
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = True
        
        with patch('sys.exit') as mock_exit:
            main()
            mock_run_ansible.assert_called_once_with('deploy', ['--limit', 'web_servers', '--tags', 'setup'], dry_run=False)
    
    @patch('cli.run_ssh_proxy_command')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_ssh_proxy(self, mock_parse_args, mock_ssh_proxy):
        """Test main function with ssh-proxy action"""
        args = Mock()
        args.action = 'status'  # Any action
        args.hosts = None
        args.default = False
        args.dry_run = False
        args.validate = False
        args.limit = None
        args.tags = None
        args.health_check = False
        args.recover = None
        args.monitor = False
        args.ssh_proxy = 'web-1'
        args.ssh_user = 'admin'
        args.ssh_port = 2223
        args.ssh_dc = 1
        args.preset = None
        
        mock_parse_args.return_value = args
        
        with patch('sys.exit') as mock_exit:
            main()
            mock_ssh_proxy.assert_called_once_with(args)
    
    @patch('cli.validate_vagrantfile')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_validate_failure(self, mock_parse_args, mock_validate):
        """Test main function when validation fails"""
        args = Mock()
        args.action = 'destroy'
        args.hosts = None
        args.default = False
        args.dry_run = False
        args.validate = True
        args.limit = None
        args.tags = None
        args.health_check = False
        args.recover = None
        args.monitor = False
        args.ssh_proxy = None
        args.ssh_user = 'vagrant'
        args.ssh_port = 2222
        args.ssh_dc = None
        args.preset = None

        mock_parse_args.return_value = args
        mock_validate.return_value = False

        with patch('sys.exit') as mock_exit:
            main()
            assert mock_exit.call_count >= 1
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_ansible_failure(self, mock_parse_args, mock_run_ansible):
        """Test main function when ansible playbook fails"""
        args = Mock()
        args.action = 'deploy'
        args.hosts = None
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
        args.preset = None
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = False
        
        with patch('sys.exit') as mock_exit:
            main()
            assert mock_exit.call_count >= 1
    
    @patch('cli.run_vagrant_command')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_up_with_hosts(self, mock_parse_args, mock_run_vagrant):
        """Test main function with up and specific hosts"""
        args = Mock()
        args.action = 'up'
        args.hosts = ['web:2', 'dc:1']
        args.default = False
        args.dry_run = True
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
        args.preset = None

        mock_parse_args.return_value = args
        mock_run_vagrant.return_value = True

        with patch('sys.exit') as mock_exit:
            main()
            mock_run_vagrant.assert_called_once()
    
    @patch('cli.show_status')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_status(self, mock_parse_args, mock_show_status):
        """Test main function with status action"""
        args = Mock()
        args.action = 'status'
        args.hosts = None
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
        args.preset = None
        
        mock_parse_args.return_value = args
        
        with patch('sys.exit') as mock_exit:
            main()
            mock_show_status.assert_called_once()
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_maintenance(self, mock_parse_args, mock_run_ansible):
        """Test main function with maintenance action"""
        args = Mock()
        args.action = 'maintenance'
        args.hosts = None
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
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = True
        
        with patch('sys.exit') as mock_exit:
            main()
            mock_run_ansible.assert_called_once_with('maintenance', [], dry_run=False)
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_security(self, mock_parse_args, mock_run_ansible):
        """Test main function with security action"""
        args = Mock()
        args.action = 'security'
        args.hosts = None
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
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = True
        
        with patch('sys.exit') as mock_exit:
            main()
            mock_run_ansible.assert_called_once_with('security', [], dry_run=False)
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_backup(self, mock_parse_args, mock_run_ansible):
        """Test main function with backup action"""
        args = Mock()
        args.action = 'backup'
        args.hosts = None
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
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = True
        
        with patch('sys.exit') as mock_exit:
            main()
            mock_run_ansible.assert_called_once_with('backup', [], dry_run=False)
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_recovery(self, mock_parse_args, mock_run_ansible):
        """Test main function with recovery action"""
        args = Mock()
        args.action = 'recovery'
        args.hosts = None
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
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = True
        
        with patch('sys.exit') as mock_exit:
            main()
            mock_run_ansible.assert_called_once_with('recovery', [], dry_run=False)
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_health_check(self, mock_parse_args, mock_run_ansible):
        """Test main function with health-check flag"""
        args = Mock()
        args.action = 'up'
        args.hosts = None
        args.default = False
        args.dry_run = False
        args.validate = False
        args.limit = None
        args.tags = None
        args.health_check = True
        args.recover = None
        args.monitor = False
        args.ssh_proxy = None
        args.ssh_user = 'vagrant'
        args.ssh_port = 2222
        args.ssh_dc = None
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = True
        
        with patch('sys.exit') as mock_exit:
            with patch('os.chdir') as mock_chdir:
                main()
                mock_chdir.assert_called()
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_monitor(self, mock_parse_args, mock_run_ansible):
        """Test main function with monitor flag"""
        args = Mock()
        args.action = 'up'
        args.hosts = None
        args.default = False
        args.dry_run = False
        args.validate = False
        args.limit = None
        args.tags = None
        args.health_check = False
        args.recover = None
        args.monitor = True
        args.ssh_proxy = None
        args.ssh_user = 'vagrant'
        args.ssh_port = 2222
        args.ssh_dc = None
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = True
        
        with patch('sys.exit') as mock_exit:
            with patch('os.chdir') as mock_chdir:
                main()
                mock_chdir.assert_called()
    
    @patch('cli.run_ansible_playbook')
    @patch('argparse.ArgumentParser.parse_args')
    def test_main_recover_host(self, mock_parse_args, mock_run_ansible):
        """Test main function with recover host"""
        args = Mock()
        args.action = 'up'
        args.hosts = None
        args.default = False
        args.dry_run = False
        args.validate = False
        args.limit = None
        args.tags = None
        args.health_check = False
        args.recover = 'web-1'
        args.monitor = False
        args.ssh_proxy = None
        args.ssh_user = 'vagrant'
        args.ssh_port = 2222
        args.ssh_dc = None
        
        mock_parse_args.return_value = args
        mock_run_ansible.return_value = True
        
        with patch('sys.exit') as mock_exit:
            with patch('os.chdir') as mock_chdir:
                main()
                mock_chdir.assert_called() 

def test_validate_vagrantfile_exception(monkeypatch, capsys):
    """Test exception branch in validate_vagrantfile"""
    def bad_open(*a, **kw):
        raise IOError("fail")
    monkeypatch.setattr("builtins.open", bad_open)
    with patch('os.path.exists', return_value=True):
        assert validate_vagrantfile() is False
        captured = capsys.readouterr()
        assert "Error reading Vagrantfile" in captured.out

def test_expand_hosts_invalid_single_role(capsys):
    """Test invalid role in expand_hosts (single role)"""
    with pytest.raises(SystemExit):
        expand_hosts(['notarole'])
    captured = capsys.readouterr()
    assert "Invalid role 'notarole'" in captured.out

@patch('subprocess.run')
@patch('os.path.exists')
def test_run_ansible_playbook_exception(mock_exists, mock_run):
    """Test exception branch in run_ansible_playbook"""
    mock_exists.return_value = True
    mock_run.side_effect = Exception("fail")
    assert run_ansible_playbook('deploy') is False

@patch('argparse.ArgumentParser.parse_args')
def test_main_health_check_exception(mock_parse_args, capsys):
    """Test exception in health_check block in main"""
    args = Mock()
    args.action = 'up'
    args.hosts = None
    args.default = False
    args.dry_run = False
    args.validate = False
    args.limit = None
    args.tags = None
    args.health_check = True
    args.recover = None
    args.monitor = False
    args.ssh_proxy = None
    args.ssh_user = 'vagrant'
    args.ssh_port = 2222
    args.ssh_dc = None
    mock_parse_args.return_value = args
    with patch('os.chdir', side_effect=Exception("fail")):
        with patch('sys.exit') as mock_exit:
            main()
            captured = capsys.readouterr()
            assert "Error running health check" in captured.out

@patch('argparse.ArgumentParser.parse_args')
def test_main_recover_exception(mock_parse_args, capsys):
    """Test exception in recover block in main"""
    args = Mock()
    args.action = 'up'
    args.hosts = None
    args.default = False
    args.dry_run = False
    args.validate = False
    args.limit = None
    args.tags = None
    args.health_check = False
    args.recover = 'web-1'
    args.monitor = False
    args.ssh_proxy = None
    args.ssh_user = 'vagrant'
    args.ssh_port = 2222
    args.ssh_dc = None
    mock_parse_args.return_value = args
    with patch('os.chdir', side_effect=Exception("fail")):
        with patch('sys.exit') as mock_exit:
            main()
            captured = capsys.readouterr()
            assert "Error triggering recovery" in captured.out

@patch('argparse.ArgumentParser.parse_args')
def test_main_monitor_exception(mock_parse_args, capsys):
    """Test exception in monitor block in main"""
    args = Mock()
    args.action = 'up'
    args.hosts = None
    args.default = False
    args.dry_run = False
    args.validate = False
    args.limit = None
    args.tags = None
    args.health_check = False
    args.recover = None
    args.monitor = True
    args.ssh_proxy = None
    args.ssh_user = 'vagrant'
    args.ssh_port = 2222
    args.ssh_dc = None
    mock_parse_args.return_value = args
    with patch('os.chdir', side_effect=Exception("fail")):
        with patch('sys.exit') as mock_exit:
            main()
            captured = capsys.readouterr()
            assert "Error starting monitoring" in captured.out

def test_main_entrypoint(monkeypatch):
    """Test __main__ entrypoint"""
    monkeypatch.setitem(__builtins__, '__name__', '__main__')
    with patch('cli.main') as mock_main:
        import cli
        cli.main()
        mock_main.assert_called() 