import pytest
import subprocess
import os
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock

def test_fake_vagrantfile(fake_vagrantfile):
    """Test the fake_vagrantfile fixture creates a valid Vagrantfile."""
    assert fake_vagrantfile.exists()
    content = fake_vagrantfile.read_text()
    assert "config.vm.define" in content
    assert "fw-1" in content
    assert "web-1" in content

def test_patch_vagrantfile(patch_vagrantfile):
    """Test the patch_vagrantfile fixture works."""
    # Just using the fixture is enough for coverage
    assert os.path.exists("any_path")  # Should return True due to patch
    # Test that we can open the fake vagrantfile
    with open("vagrant/Vagrantfile") as f:
        content = f.read()
        assert "config.vm.define" in content

def test_patch_subprocess_success(patch_subprocess_success):
    """Test the patch_subprocess_success fixture."""
    result = subprocess.run(["echo", "hi"])
    assert result.returncode == 0
    assert result.stdout == "Success"
    assert result.stderr == ""

def test_patch_subprocess_fail(patch_subprocess_fail):
    """Test the patch_subprocess_fail fixture."""
    with pytest.raises(Exception, match="subprocess failed"):
        subprocess.run(["echo", "fail"])

def test_cli_output(cli_output):
    """Test the cli_output fixture captures output."""
    print("hello world")
    captured = cli_output.readouterr()
    assert "hello world" in captured.out
    assert captured.err == ""

def test_cli_output_error(cli_output):
    """Test the cli_output fixture captures error output."""
    import sys
    print("error message", file=sys.stderr)
    captured = cli_output.readouterr()
    assert "error message" in captured.err

# Test session-scoped fixtures
def test_project_root(project_root):
    """Test the project_root fixture."""
    assert isinstance(project_root, Path)
    assert project_root.name == "sme-starter-infra"
    assert (project_root / "cli.py").exists()

def test_test_data_dir(test_data_dir):
    """Test the test_data_dir fixture."""
    assert isinstance(test_data_dir, Path)
    assert test_data_dir.name == "data"
    assert test_data_dir.parent.name == "tests"

def test_temp_dir(temp_dir):
    """Test the temp_dir fixture creates and cleans up temp directory."""
    assert isinstance(temp_dir, str)
    assert os.path.exists(temp_dir)
    # The cleanup happens after the test, so we just verify it exists

def test_mock_subprocess_run(mock_subprocess_run):
    """Test the mock_subprocess_run fixture."""
    result = subprocess.run(["test", "command"])
    assert result.returncode == 0
    assert result.stdout == "Mock output"
    assert result.stderr == ""
    mock_subprocess_run.assert_called()

def test_mock_os_path_exists(mock_os_path_exists):
    """Test the mock_os_path_exists fixture."""
    assert os.path.exists("any_path") == True
    mock_os_path_exists.assert_called()

def test_mock_os_chdir(mock_os_chdir):
    """Test the mock_os_chdir fixture."""
    os.chdir("/some/path")
    mock_os_chdir.assert_called_with("/some/path")

def test_sample_vagrantfile(sample_vagrantfile):
    """Test the sample_vagrantfile fixture."""
    assert isinstance(sample_vagrantfile, str)
    assert "VAGRANTFILE_API_VERSION" in sample_vagrantfile
    assert "config.vm.define" in sample_vagrantfile
    assert "web-1" in sample_vagrantfile

def test_sample_inventory(sample_inventory):
    """Test the sample_inventory fixture."""
    assert isinstance(sample_inventory, dict)
    assert "all" in sample_inventory
    assert "children" in sample_inventory["all"]
    assert "web_servers" in sample_inventory["all"]["children"]
    assert "web-1" in sample_inventory["all"]["children"]["web_servers"]["hosts"]

def test_mock_cli_args(mock_cli_args):
    """Test the mock_cli_args fixture."""
    assert isinstance(mock_cli_args, Mock)
    assert mock_cli_args.action == 'up'
    assert mock_cli_args.hosts == ['web:1']
    assert mock_cli_args.default == False
    assert mock_cli_args.dry_run == False
    assert mock_cli_args.validate == False
    assert mock_cli_args.limit == None
    assert mock_cli_args.tags == None
    assert mock_cli_args.health_check == False
    assert mock_cli_args.recover == None
    assert mock_cli_args.monitor == False
    assert mock_cli_args.ssh_proxy == None
    assert mock_cli_args.ssh_user == 'vagrant'
    assert mock_cli_args.ssh_port == 2222
    assert mock_cli_args.ssh_dc == None

def test_coverage_config(coverage_config):
    """Test the coverage_config fixture."""
    assert isinstance(coverage_config, dict)
    assert "source" in coverage_config
    assert "omit" in coverage_config
    assert "branch" in coverage_config
    assert "precision" in coverage_config
    assert coverage_config["source"] == ['cli.py', 'scripts/']
    assert coverage_config["branch"] == True
    assert coverage_config["precision"] == 2

# Test pytest hooks (these are harder to test directly, so we test them indirectly)
def test_pytest_configure_hook():
    """Test that pytest_configure hook is working."""
    # Test that the hook function exists and is callable
    from tests.conftest import pytest_configure
    assert callable(pytest_configure)
    
    # Test that the function can be called with mock parameters
    class MockConfig:
        def addinivalue_line(self, name, value):
            pass
    
    config = MockConfig()
    
    # This should not raise an exception
    pytest_configure(config)

def test_pytest_collection_modifyitems_hook():
    """Test that pytest_collection_modifyitems hook is working."""
    # This test verifies that the collection hook has been called
    # by checking if test files have the expected markers
    import pytest
    
    # The hook should have marked tests based on their file names
    # We can't easily test this directly, but we can verify the hook function exists
    from tests.conftest import pytest_collection_modifyitems
    assert callable(pytest_collection_modifyitems)
    
    # Test that the function can be called with mock parameters
    class MockConfig:
        pass
    
    class MockItem:
        def __init__(self, fspath):
            self.fspath = fspath
        
        def add_marker(self, marker):
            pass
    
    config = MockConfig()
    items = [
        MockItem("test_cli.py"),
        MockItem("test_ansible_config.py"),
        MockItem("test_vagrant_config.py")
    ]
    
    # This should not raise an exception
    pytest_collection_modifyitems(config, items)

def test_pytest_html_report_title_hook():
    """Test that pytest_html_report_title hook is working."""
    # Test the hook function directly
    from tests.conftest import pytest_html_report_title
    
    class MockReport:
        def __init__(self):
            self.title = None
    
    report = MockReport()
    pytest_html_report_title(report)
    assert report.title == "SME Infrastructure Test Report"

def test_pytest_html_results_summary_hook():
    """Test that pytest_html_results_summary hook is working."""
    # Test the hook function directly
    from tests.conftest import pytest_html_results_summary
    
    prefix = []
    summary = []
    postfix = []
    
    pytest_html_results_summary(prefix, summary, postfix)
    
    assert len(prefix) == 2
    assert "<h2>Test Summary</h2>" in prefix[0]
    assert "<p>This report shows the test results for the SME Infrastructure project.</p>" in prefix[1]

# Test the sys.path modification
def test_sys_path_modification():
    """Test that the sys.path modification in conftest.py works."""
    import sys
    project_root = Path(__file__).parent.parent
    assert str(project_root) in sys.path

# Test tempfile and shutil imports are working
def test_tempfile_shutil_imports():
    """Test that tempfile and shutil imports work correctly."""
    temp_dir = tempfile.mkdtemp()
    try:
        assert os.path.exists(temp_dir)
        # Create a test file
        test_file = os.path.join(temp_dir, "test.txt")
        with open(test_file, "w") as f:
            f.write("test")
        assert os.path.exists(test_file)
    finally:
        shutil.rmtree(temp_dir) 