import argparse
import subprocess
from collections import Counter, defaultdict
import re
import sys
import os
import threading
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent

# On Windows, default console (cp1252) can't encode emoji; avoid UnicodeEncodeError
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(errors="replace")
        sys.stderr.reconfigure(errors="replace")
    except Exception:
        pass

# When invoked by the GUI with a venv, subprocess may start in the venv dir so the launcher finds pyvenv.cfg.
# SME_PROJECT_ROOT tells us where to run from so vagrant/ and paths are correct.
_sme_project_root = os.environ.get("SME_PROJECT_ROOT")
if _sme_project_root and os.path.isdir(_sme_project_root):
    os.chdir(_sme_project_root)

# Vagrant must be run from the directory containing the Vagrantfile. Use this in subprocess calls
# so provisioning checks work correctly when the CLI is invoked from the GUI (where process cwd can change).
VAGRANT_CWD = Path(__file__).resolve().parent / "vagrant"

# Default group of VMs (full stack)
DEFAULT_HOSTS = [
    "dc-1", "dc-2",
    "filesrv-1", "filesrv-2",
    "web-1", "web-2",
    "monitor-1", "log-1",
    "mgmt-1", "mgmt-2",
    "fw-1", "fw-2",
]

# Valid VM roles and their expected counts
VALID_ROLES = {
    "fw": 2,      # Firewalls
    "dc": 2,      # Domain Controllers
    "filesrv": 2, # File Servers
    "web": 2,     # Web Servers
    "monitor": 1, # Monitoring
    "log": 1,     # Logging
    "mgmt": 2     # Management
}

# Minimum required configuration for functional infrastructure
MINIMUM_REQUIRED = {
    "critical": ["dc"],      # Domain controllers are absolutely required
    "recommended": ["mgmt"], # Management servers for monitoring/recovery
    "optional": ["fw", "filesrv", "web", "monitor", "log"]
}

# Service dependencies - what requires what
SERVICE_DEPENDENCIES = {
    "web": ["dc"],           # Web servers need DC for DNS and auth
    "filesrv": ["dc"],       # File servers need DC for AD auth
    "monitor": ["dc"],       # Monitoring needs DC for DNS
    "log": ["dc"],           # Logging needs DC for DNS
    "mgmt": ["dc"],          # Management needs DC for DNS
    "ssh_proxy": ["dc"],     # SSH proxy requires DC
    "recovery": ["mgmt"],    # Recovery system needs management
    "monitoring": ["mgmt"]   # Health monitoring needs management
}

# Configuration presets for common use cases
CONFIGURATION_PRESETS = {
    "minimal": {
        "description": "Minimal functional infrastructure (DC + Management)",
        "hosts": ["dc-1", "dc-2", "mgmt-1"],
        "warning": "Limited functionality - no web servers, file servers, or monitoring"
    },
    "basic": {
        "description": "Basic infrastructure with core services",
        "hosts": ["dc-1", "dc-2", "mgmt-1", "web-1", "web-2"],
        "warning": "No file servers or monitoring - suitable for development"
    },
    "standard": {
        "description": "Standard SME infrastructure (recommended)",
        "hosts": ["dc-1", "dc-2", "mgmt-1", "mgmt-2", "web-1", "web-2", "filesrv-1", "monitor-1"],
        "warning": "No firewalls or logging - suitable for internal use"
    },
    "production": {
        "description": "Production-ready infrastructure with full redundancy",
        "hosts": DEFAULT_HOSTS,
        "warning": "Full infrastructure - requires significant resources"
    },
    "development": {
        "description": "Development environment (minimal resources)",
        "hosts": ["dc-1", "mgmt-1", "web-1"],
        "warning": "Single instances only - not suitable for production"
    }
}

def check_prerequisites():
    """Check if required tools (Vagrant, VirtualBox) are available"""
    missing_tools = []
    
    # Check Vagrant
    try:
        result = subprocess.run(["vagrant", "--version"], 
                               capture_output=True, text=True, 
                               encoding='utf-8', errors='replace', timeout=5)
        if result.returncode != 0:
            missing_tools.append("Vagrant")
    except FileNotFoundError:
        missing_tools.append("Vagrant")
    except Exception:
        # TimeoutExpired or other errors - treat as not found
        missing_tools.append("Vagrant")
    
    # Check VirtualBox (optional check, may not be in PATH on Windows)
    # We'll let Vagrant handle VirtualBox detection
    
    if missing_tools:
        print("[!] Error: Required tools not found:")
        for tool in missing_tools:
            print(f"   * {tool}")
        print("\nPlease install the missing tools:")
        print("   * Vagrant: https://www.vagrantup.com/downloads")
        print("   * VirtualBox: https://www.virtualbox.org/wiki/Downloads")
        print("\nYou can also run the prerequisite check script:")
        print("   Windows: .\\check_prerequisites.ps1")
        print("   Linux/macOS: ./check_prerequisites.sh")
        return False
    
    return True

def validate_vagrantfile():
    """Check if Vagrantfile exists and has the VMs we need"""
    vagrantfile_path = os.path.join("vagrant", "Vagrantfile")
    if not os.path.exists(vagrantfile_path):
        print("[!] Error: Vagrantfile not found at vagrant/Vagrantfile")
        print("   Make sure you're in the project root directory.")
        return False
    
    # Check Vagrantfile for VM definitions
    try:
        with open(vagrantfile_path, 'r') as f:
            content = f.read()
            for host in DEFAULT_HOSTS:
                if f'config.vm.define "{host}"' not in content:
                    print(f"[!]  Warning: VM '{host}' not found in Vagrantfile")
    except Exception as e:
        print(f"[!] Error reading Vagrantfile: {e}")
        return False
    
    return True

def validate_minimum_configuration(requested_hosts):
    """Check if the config has the minimum required components"""
    # Get roles from host list
    requested_roles = set()
    for host in requested_hosts:
        role = host.split('-')[0]
        requested_roles.add(role)
    
    # Check critical requirements
    missing_critical = []
    for critical_role in MINIMUM_REQUIRED["critical"]:
        if critical_role not in requested_roles:
            missing_critical.append(critical_role)
    
    if missing_critical:
        print(f"[!] Error: Missing critical components: {', '.join(missing_critical)}")
        print("Critical components are required for basic functionality:")
        for role in missing_critical:
            if role == "dc":
                print("   * Domain Controllers (dc): Required for DNS, authentication, and routing")
        return False
    
    # Check dependencies
    missing_dependencies = []
    for role in requested_roles:
        if role in SERVICE_DEPENDENCIES:
            for dependency in SERVICE_DEPENDENCIES[role]:
                if dependency not in requested_roles:
                    missing_dependencies.append(f"{role} requires {dependency}")
    
    if missing_dependencies:
        print("[!]  Warning: Missing dependencies detected:")
        for dep in missing_dependencies:
            print(f"   * {dep}")
        print("   Some services may not function correctly.")
        
        # Ask if user wants to continue anyway
        response = input("\nContinue anyway? (y/N): ").strip().lower()
        if response not in ['y', 'yes']:
            return False
    
    # Check recommended components
    missing_recommended = []
    for recommended_role in MINIMUM_REQUIRED["recommended"]:
        if recommended_role not in requested_roles:
            missing_recommended.append(recommended_role)
    
    if missing_recommended:
        print("[!]  Warning: Missing recommended components:")
        for role in missing_recommended:
            if role == "mgmt":
                print("   * Management servers (mgmt): Recommended for monitoring and recovery")
        print("   Consider adding these for full functionality.")
    
    return True

def check_ssh_proxy_dependencies(args):
    """Check if SSH proxy is available"""
    if not args.ssh_proxy:
        return True
    
    # SSH proxy requires domain controllers
    if "dc" not in MINIMUM_REQUIRED["critical"]:
        print("[!] Error: SSH proxy requires domain controllers")
        print("   Please include domain controllers in your configuration")
        return False
    
    return True

def expand_hosts(raw_hosts):
    """Handle both -h web and -h web:3 syntax"""
    role_counts = Counter()
    expanded = []

    for item in raw_hosts:
        # support role:count like web:3
        match = re.match(r"^([a-zA-Z0-9_-]+):(\d+)$", item)
        if match:
            role, count = match.groups()
            count = int(count)
            
            # Validate role and count
            if role not in VALID_ROLES:
                print(f"[!] Error: Invalid role '{role}'. Valid roles: {', '.join(VALID_ROLES.keys())}")
                sys.exit(1)
            
            if count > VALID_ROLES[role]:
                print(f"[!] Error: Role '{role}' only supports up to {VALID_ROLES[role]} instances, requested {count}")
                sys.exit(1)
            
            for i in range(1, count + 1):
                expanded.append(f"{role}-{i}")
        else:
            # Single role specification
            if item not in VALID_ROLES:
                print(f"[!] Error: Invalid role '{item}'. Valid roles: {', '.join(VALID_ROLES.keys())}")
                sys.exit(1)
            
            role_counts[item] += 1
            if role_counts[item] > VALID_ROLES[item]:
                print(f"[!] Error: Too many instances of '{item}' specified. Maximum: {VALID_ROLES[item]}")
                sys.exit(1)
            
            expanded.append(f"{item}-{role_counts[item]}")

    return expanded

def run_vagrant_command(command, hosts, dry_run=False, async_mode=False):
    """Run vagrant command"""
    if not hosts:
        print("[!] Error: No hosts specified")
        return False
    
    # For 'up' command, boot asynchronously if requested
    if command == "up" and async_mode:
        return run_vagrant_up_async(hosts)
    # Destroy and halt run per-host so one locked/stuck VM does not block the rest
    if command == "destroy":
        return run_destroy_per_host(hosts, dry_run)
    if command == "halt":
        return run_halt_per_host(hosts, dry_run)

    base_cmd = ["vagrant", command] + (["--provision"] if command == "up" else []) + hosts
    
    # Add force flag for destroy command to avoid prompts
    if command == "destroy":
        base_cmd.insert(2, "-f")  # Insert -f after "vagrant destroy"
    
    print(f"\nCommand: {' '.join(base_cmd)}")
    
    if dry_run:
        print(" Dry run mode - command would be executed")
        return True
    
    try:
        # Change to vagrant directory
        original_dir = os.getcwd()
        os.chdir("vagrant")

        session_log = None
        if command == "up":
            from ai_assistant.session_logs import (
                append_vagrant_session,
                begin_vagrant_session,
                finish_vagrant_session,
            )

            session_log = begin_vagrant_session(PROJECT_ROOT, command, hosts)

        # For destroy and other commands that might take time, show real-time output
        # Use Popen with real-time streaming for better feedback
        if command in ["destroy", "up", "provision", "halt"]:
            process = subprocess.Popen(
                base_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                bufsize=1,
                universal_newlines=True
            )

            # Stream output in real-time
            for line in process.stdout:
                print(line, end='', flush=True)
                if session_log is not None:
                    append_vagrant_session(session_log, line)

            process.wait()

            if session_log is not None:
                finish_vagrant_session(session_log, process.returncode)
                try:
                    rel_log = session_log.relative_to(PROJECT_ROOT)
                except ValueError:
                    rel_log = session_log
                print(f"\nSession log saved: {rel_log}")
                print(f"Analyse with: python cli.py ai-log --latest")

            if process.returncode == 0:
                print("\n[OK] Command executed successfully")
                os.chdir(original_dir)
                return True
            else:
                print(f"\n[!] Command failed with exit code {process.returncode}")
                os.chdir(original_dir)
                return False
        else:
            # For other commands, use standard capture_output
            result = subprocess.run(base_cmd, check=True, capture_output=True, 
                                   text=True, encoding='utf-8', errors='replace')
            print("[OK] Command executed successfully")
            if result.stdout:
                print(result.stdout)
            
            # Change back to original directory
            os.chdir(original_dir)
            return True
        
    except subprocess.CalledProcessError as e:
        print(f"[!] Error executing command: {e}")
        if e.stderr:
            print(f"Error output: {e.stderr}")
        os.chdir(original_dir)
        return False
    except Exception as e:
        print(f"[!] Unexpected error: {e}")
        os.chdir(original_dir)
        return False


def _vagrant_host_state(host, cwd=None):
    """Return Vagrant state for one host: 'running', 'saved', 'poweroff', 'not_created', or None."""
    r = subprocess.run(
        ["vagrant", "status", host],
        cwd=cwd or os.getcwd(),
        capture_output=True,
        text=True,
        timeout=15,
    )
    if r.returncode != 0 or not r.stdout:
        return None
    for line in (r.stdout or "").splitlines():
        if host not in line:
            continue
        line_lower = line.lower()
        if "running" in line_lower:
            return "running"
        if "saved" in line_lower:
            return "saved"
        if "poweroff" in line_lower or "powered off" in line_lower:
            return "poweroff"
        if "not created" in line_lower:
            return "not_created"
        if "aborted" in line_lower:
            return "poweroff"  # treat like poweroff for resume
    return None


def run_resume(hosts, dry_run=False):
    """Resume or start VMs: use 'vagrant resume' for saved, 'vagrant up' for poweroff/not_created. Continue on per-host failure."""
    if not hosts:
        print("[!] Error: No hosts specified")
        return False
    original_dir = os.getcwd()
    try:
        os.chdir("vagrant")
    except OSError:
        print("[!] Error: vagrant directory not found. Run from project root.")
        return False
    print("\nResuming / starting VMs (saved -> resume, poweroff/not_created -> up)...\n")
    session_log = None
    if not dry_run:
        from ai_assistant.session_logs import (
            append_vagrant_session,
            begin_vagrant_session,
            finish_vagrant_session,
        )

        session_log = begin_vagrant_session(PROJECT_ROOT, "up", hosts)

    ok_count = 0
    fail_count = 0
    for host in hosts:
        state = _vagrant_host_state(host)
        if state == "running":
            print(f"  {host}: already running")
            ok_count += 1
            continue
        if dry_run:
            cmd = "vagrant resume" if state == "saved" else "vagrant up"
            print(f"  [dry run] would run: {cmd} {host}")
            ok_count += 1
            continue
        if state == "saved":
            cmd = ["vagrant", "resume", host]
        else:
            cmd = ["vagrant", "up", host]
        try:
            r = subprocess.run(
                cmd,
                cwd=os.getcwd(),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                # Resume should be fast; keep a shorter timeout so the CLI doesn't appear hung.
                timeout=240,
            )
            if session_log is not None:
                append_vagrant_session(
                    session_log,
                    f"\n### vagrant {'resume' if state == 'saved' else 'up'} {host} (exit {r.returncode})\n",
                )
                if r.stdout:
                    append_vagrant_session(session_log, r.stdout)
                if r.stderr:
                    append_vagrant_session(session_log, r.stderr)

            if r.returncode == 0:
                print(f"  [OK] {host}: started")
                ok_count += 1
            else:
                print(f"  [!] {host}: failed (exit {r.returncode})")
                if r.stdout:
                    for line in (r.stdout or "").strip().splitlines()[-5:]:
                        print(f"      {line}")
                # If the VM ended up running despite a non-zero exit, treat it as started.
                new_state = _vagrant_host_state(host)
                if new_state == "running":
                    print(f"      Note: Vagrant now reports {host} as running; treating as started.")
                    ok_count += 1
                else:
                    fail_count += 1
        except subprocess.TimeoutExpired:
            print(f"  [!] {host}: timed out")
            # Timeouts can happen even if the VM eventually boots; re-check state.
            new_state = _vagrant_host_state(host)
            if new_state == "running":
                print(f"      Note: {host} appears to be running after timeout; treating as started.")
                ok_count += 1
            else:
                fail_count += 1
        except Exception as e:
            print(f"  [!] {host}: {e}")
            fail_count += 1
    os.chdir(original_dir)
    if session_log is not None:
        exit_code = 0 if fail_count == 0 else 1
        finish_vagrant_session(session_log, exit_code)
        try:
            rel_log = session_log.relative_to(PROJECT_ROOT)
        except ValueError:
            rel_log = session_log
        print(f"Session log saved: {rel_log}")
        print("Analyse with: python cli.py ai-log --latest")
    print()
    if fail_count == 0:
        print("[OK] All target VMs are running.")
        return True
    print(f"[!]  {ok_count} started, {fail_count} failed. Fix failed hosts and run again if needed.")
    return fail_count == 0


def run_reprovision(hosts):
    """
    Bring up any preset VMs that are down (saved/poweroff/aborted), then run vagrant provision
    on all preset hosts. Use after PC sleep or when provisioning failed (e.g. clock skew).
    Streams output for GUI. Returns True if all steps succeeded.
    """
    if not hosts:
        print("[!] Error: No hosts specified")
        return False
    vagrant_cwd = str(VAGRANT_CWD)
    if not os.path.isdir(vagrant_cwd):
        print("[!] Error: vagrant directory not found. Run from project root.")
        return False
    original_dir = os.getcwd()
    try:
        os.chdir(vagrant_cwd)
    except OSError:
        print("[!] Error: cannot change to vagrant directory")
        return False
    fail_count = 0
    try:
        print("\nRe-Provision: checking VM states and bringing up any that are down...\n")
        for host in hosts:
            state = _vagrant_host_state(host, cwd=vagrant_cwd)
            if state == "running":
                print(f"  {host}: already running")
                continue
            if state == "saved":
                cmd = ["vagrant", "resume", host]
                print(f"  Resuming {host}...\n")
            else:
                cmd = ["vagrant", "up", host]
                print(f"  Bringing up {host}...\n")
            try:
                p = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                    cwd=vagrant_cwd,
                )
                out_lines = []
                for line in p.stdout:
                    print(line, end="", flush=True)
                    out_lines.append(line)
                p.wait()
                if p.returncode != 0:
                    out_text = "".join(out_lines).lower()
                    port_collision = (
                        "collide" in out_text and "port" in out_text
                    ) or "already in use" in out_text and "port" in out_text
                    if port_collision:
                        print(f"\n  Port collision detected for {host}. Trying 'vagrant reload' to re-apply ports...\n")
                        r = subprocess.Popen(
                            ["vagrant", "reload", host],
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            text=True,
                            encoding="utf-8",
                            errors="replace",
                            bufsize=1,
                            cwd=vagrant_cwd,
                        )
                        for reline in r.stdout:
                            print(reline, end="", flush=True)
                        r.wait()
                        if r.returncode == 0:
                            print(f"  [OK] {host}: reload succeeded.\n")
                        else:
                            print(f"\n[!] {host}: reload failed (exit {r.returncode})")
                            fail_count += 1
                    else:
                        print(f"\n[!] {host}: failed (exit {p.returncode})")
                        fail_count += 1
            except Exception as e:
                print(f"\n[!] {host}: {e}")
                fail_count += 1
        if fail_count > 0:
            print(f"\n[!] {fail_count} VM(s) failed to come up. Re-provision will continue for the rest.\n")
        print("\nRe-Provision: running provisioning on all preset VMs...\n")
        try:
            p = subprocess.Popen(
                ["vagrant", "provision"] + hosts,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                cwd=vagrant_cwd,
            )
            for line in p.stdout:
                print(line, end="", flush=True)
            p.wait()
            if p.returncode != 0:
                print(f"\n[!] Provisioning failed (exit {p.returncode})")
                fail_count += 1
        except Exception as e:
            print(f"\n[!] Provisioning error: {e}")
            fail_count += 1
        if fail_count == 0:
            print("\n[OK] Re-Provision complete. All VMs are up and provisioned.")
        else:
            print(f"\n[!] Re-Provision finished with {fail_count} failure(s). Check output above.")
        return fail_count == 0
    finally:
        os.chdir(original_dir)


def run_destroy_per_host(hosts, dry_run=False):
    """Destroy VMs one at a time. Continue on failure so one locked VM does not block the rest."""
    if not hosts:
        print("[!] Error: No hosts specified")
        return False
    original_dir = os.getcwd()
    try:
        os.chdir("vagrant")
    except OSError:
        print("[!] Error: vagrant directory not found. Run from project root.")
        return False
    vagrant_cwd = os.getcwd()
    print("\nDestroying VMs (per host; continuing on failure)...\n")
    ok_count = 0
    fail_count = 0
    for host in hosts:
        if dry_run:
            print(f"  [dry run] would run: vagrant destroy -f {host}")
            ok_count += 1
            continue
        try:
            r = subprocess.run(
                ["vagrant", "destroy", "-f", host],
                cwd=vagrant_cwd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=300,
            )
            if r.returncode == 0:
                print(f"  [OK] {host}: destroyed")
                ok_count += 1
            else:
                out = (r.stdout or "") + (r.stderr or "")
                print(f"  [!] {host}: failed (exit {r.returncode})")
                for line in (out or "").strip().splitlines()[-6:]:
                    print(f"      {line}")
                if "another process is already executing" in out or "another process is already executing" in (r.stderr or ""):
                    print(f"      Tip: Run from project root and close other Vagrant/terminals. To clear the lock: remove vagrant\\.vagrant\\machines\\{host} or kill stray vagrant/ruby processes, then run destroy again for this host.")
                fail_count += 1
        except subprocess.TimeoutExpired:
            print(f"  [!] {host}: timed out")
            fail_count += 1
        except Exception as e:
            print(f"  [!] {host}: {e}")
            fail_count += 1
    os.chdir(original_dir)
    print()
    if fail_count == 0:
        print("[OK] All target VMs destroyed.")
        return True
    print(f"[!]  {ok_count} destroyed, {fail_count} failed. Fix failed hosts (see tips above) and run destroy again if needed.")
    return False


def run_halt_per_host(hosts, dry_run=False):
    """Halt VMs one at a time. Continue on failure so one stuck VM does not block the rest."""
    if not hosts:
        print("[!] Error: No hosts specified")
        return False
    original_dir = os.getcwd()
    try:
        os.chdir("vagrant")
    except OSError:
        print("[!] Error: vagrant directory not found. Run from project root.")
        return False
    vagrant_cwd = os.getcwd()
    print("\nHalting VMs (per host; continuing on failure)...\n")
    ok_count = 0
    fail_count = 0
    for host in hosts:
        if dry_run:
            print(f"  [dry run] would run: vagrant halt {host}")
            ok_count += 1
            continue
        try:
            process = subprocess.Popen(
                ["vagrant", "halt", host],
                cwd=vagrant_cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
            halt_out = []
            for line in process.stdout:
                halt_out.append(line)
                print(line, end="", flush=True)
            process.wait()
            out_text = "".join(halt_out)
            if process.returncode == 0:
                ok_count += 1
            else:
                fail_count += 1
                if "another process is already executing" in out_text:
                    print(f"      Tip: Run from project root and close other Vagrant/terminals. To clear the lock: remove vagrant\\.vagrant\\machines\\{host} or kill stray vagrant/ruby processes.")
        except Exception as e:
            print(f"  [!] {host}: {e}")
            fail_count += 1
    os.chdir(original_dir)
    print()
    if fail_count == 0:
        print("[OK] All target VMs halted.")
        return True
    print(f"[!]  {ok_count} halted, {fail_count} failed. Fix failed hosts and run halt again if needed.")
    return False


def run_vagrant_up_async(hosts):
    """Phase 1: DCs sequentially (avoids VirtualBox lock). Phase 2 & 3: remaining VMs in two batches of 5 in parallel. All with --provision."""
    original_dir = os.getcwd()
    try:
        os.chdir("vagrant")
    except OSError:
        print("[!] Error: vagrant directory not found. Run from project root.")
        return False
    vagrant_cwd = os.getcwd()

    dc_hosts = [h for h in hosts if h.startswith("dc-")]
    other_hosts = [h for h in hosts if not h.startswith("dc-")]

    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    def run_one(host):
        kwargs = dict(
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            cwd=vagrant_cwd,
        )
        if creationflags:
            kwargs["creationflags"] = creationflags
        return subprocess.Popen(
            ["vagrant", "up", "--provision", host],
            **kwargs
        )

    def stream_output(pipe, prefix):
        for line in pipe:
            print(f"[{prefix}] {line}", end="", flush=True)
        pipe.close()

    def run_batch(batch_hosts):
        """Start one vagrant up --provision per host in parallel; stream output; wait for all. Returns list of (host, returncode)."""
        if not batch_hosts:
            return []
        procs = []
        for host in batch_hosts:
            p = run_one(host)
            procs.append((host, p))
            t = threading.Thread(target=stream_output, args=(p.stdout, host), daemon=True)
            t.start()
        results = []
        for host, p in procs:
            p.wait()
            results.append((host, p.returncode))
        return results

    failed = []
    try:
        # Phase 1: DCs one at a time (avoids VirtualBox lock when two vagrant processes run together)
        if dc_hosts:
            print(f"\nPhase 1: Starting DCs sequentially ({', '.join(dc_hosts)})...\n")
            for host in dc_hosts:
                print(f"Starting {host}...\n")
                p = run_one(host)
                t = threading.Thread(target=stream_output, args=(p.stdout, host), daemon=True)
                t.start()
                p.wait()
                if p.returncode != 0:
                    failed.append(host)
            if failed:
                print(f"\n[!] Phase 1 failed: {', '.join(failed)}")
                return False
            print(f"\n[OK] Phase 1 complete. DCs are up.\n")

        # Phase 2: First batch of 5 (or fewer) in parallel
        batch1 = other_hosts[:5]
        if batch1:
            print(f"Phase 2: Starting first batch in parallel ({', '.join(batch1)})...\n")
            for host, code in run_batch(batch1):
                if code != 0:
                    failed.append(host)
            if failed:
                print(f"\n[!] Failed: {', '.join(failed)}")
                return False
            print(f"\n[OK] Phase 2 complete.\n")

        # Phase 3: Second batch of 5 (or remainder) in parallel
        batch2 = other_hosts[5:]
        if batch2:
            print(f"Phase 3: Starting second batch in parallel ({', '.join(batch2)})...\n")
            for host, code in run_batch(batch2):
                if code != 0:
                    failed.append(host)
            if failed:
                print(f"\n[!] Failed: {', '.join(failed)}")
                return False
            print(f"\n[OK] Phase 3 complete.\n")

        print("[OK] All VMs are up and provisioned.")
        return True
    except Exception as e:
        print(f"[!] Error: {e}")
        return False
    finally:
        os.chdir(original_dir)

def run_ansible_playbook(playbook, options=None, dry_run=False, skip_key_check=False):
    """Run Ansible playbook. On Windows, runs via vagrant ssh mgmt-1 (Ansible needs fcntl)."""
    import shutil
    project_root = Path(__file__).resolve().parent
    ansible_dir = project_root / "ansible"
    vagrant_dir = project_root / "vagrant"
    playbook_path = ansible_dir / "playbooks" / f"{playbook}.yml"
    if not playbook_path.exists():
        print(f"[!] Error: Playbook not found: {playbook_path}")
        return False
    options = list(options) if options else []
    if dry_run:
        options.append("--check")

    if sys.platform == "win32":
        # Ansible uses fcntl (Unix-only); run playbook inside mgmt-1. User stays on host - no need to log into any VM.
        if not (vagrant_dir / "Vagrantfile").exists():
            print("[!] Error: vagrant/Vagrantfile not found. Run from project root.")
            return False
        # Pre-check: Vagrant state, then SSH reachability (with retries), then SSH jump key.
        if not skip_key_check:
            def _run_ssh(cmd, timeout=60):
                try:
                    return subprocess.run(
                        ["vagrant", "ssh", "mgmt-1", "-c", cmd],
                        cwd=str(vagrant_dir),
                        capture_output=True,
                        text=True,
                        timeout=timeout,
                    )
                except subprocess.TimeoutExpired as e:
                    return subprocess.CompletedProcess(
                        e.cmd,
                        returncode=124,
                        stdout=e.stdout or "",
                        stderr=e.stderr or "Timed out while waiting for mgmt-1 SSH",
                    )

            def _vagrant_mgmt1_state():
                r = subprocess.run(
                    ["vagrant", "status"],
                    cwd=str(vagrant_dir),
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if r.returncode != 0 or not r.stdout:
                    return None
                for line in (r.stdout or "").splitlines():
                    if "mgmt-1" in line:
                        line_lower = line.lower()
                        if "running" in line_lower:
                            return "running"
                        if "poweroff" in line_lower or "saved" in line_lower or "aborted" in line_lower:
                            return "poweroff"
                        if "not created" in line_lower:
                            return "not_created"
                        return "unknown"
                return None

            state = _vagrant_mgmt1_state()
            if state and state != "running":
                print("[!] Deploy cannot run yet: Vagrant reports mgmt-1 is not running.")
                print(f"   Vagrant state for mgmt-1: {state!r}")
                if state == "not_created":
                    print("   If the VM exists in VirtualBox but Vagrant says 'not created', run:")
                    print("     python cli.py repair-vm mgmt-1")
                print("   Then from the vagrant folder run:  vagrant up mgmt-1")
                print("   Or from project root:  sme-spinup up --preset production  (then wait for Ready, then deploy)")
                return False

            # Retry SSH until ready (VM may have just booted)
            max_attempts = 8
            interval_sec = 15
            reachable = None
            for attempt in range(1, max_attempts + 1):
                reachable = _run_ssh("true")
                if reachable.returncode == 0:
                    break
                if attempt < max_attempts:
                    print(f"   Waiting for mgmt-1 SSH (attempt {attempt}/{max_attempts})...")
                    time.sleep(interval_sec)

            if reachable.returncode != 0:
                state_after = _vagrant_mgmt1_state()
                if state_after and state_after != "running":
                    print("[!] Deploy cannot run yet: Vagrant state for mgmt-1 is no longer running.")
                    print(f"   State: {state_after!r}. Run: vagrant up mgmt-1  (from vagrant folder)")
                    return False
                print("[!] Deploy cannot run yet: mgmt-1 is unreachable (SSH not responding).")
                out = (reachable.stdout or "").strip()
                err = (reachable.stderr or "").strip()
                if out or err:
                    if out:
                        print(f"   vagrant ssh output: {out[:400]}")
                    if err:
                        print(f"   vagrant ssh stderr: {err[:400]}")
                print("   From project root: cd vagrant && vagrant status  then  vagrant ssh mgmt-1  to diagnose.")
                print("   If VM is up in VirtualBox but Vagrant fails: python cli.py repair-vm mgmt-1  then  vagrant up mgmt-1")
                return False

            key_check = _run_ssh("test -f /vagrant/ssh-jump/id_ed25519")
            if key_check.returncode != 0:
                print("[!] Deploy cannot run yet: SSH jump key missing at /vagrant/ssh-jump/id_ed25519.")
                print("   The key is created by dc-1 during provisioning. Ensure dc-1 has been brought up and provisioned:")
                print("     vagrant up dc-1   (or sme-spinup up --preset production)")
                print("   Then wait until provisioning completes (sme-spinup status --provisioning), then run:")
                print("     sme-spinup deploy")
                print("   To skip this check and try anyway (will fail if key is missing): sme-spinup deploy --skip-key-check")
                return False
        import shlex
        # Synced folder forces 0777 on the key; SSH refuses it. Copy to local path and chmod 600.
        # Override inventory key path with -e so Ansible definitely uses the copy (inventory has /vagrant/... which is 0777).
        key_path = "/home/vagrant/.ssh/sme_jump_key"
        ansible_extra = ["-e", f"ansible_ssh_private_key_file={key_path}"]
        remote_parts = [
            "mkdir -p /home/vagrant/.ssh",
            "&&", "cp", "/vagrant/ssh-jump/id_ed25519", key_path,
            "&&", "chmod", "600", key_path,
            "&&", "cd", "/sme-ansible",
            "&&", "ANSIBLE_ROLES_PATH=/sme-ansible/roles",
            "/usr/bin/ansible-playbook", "-i", "inventory/hosts.yml"
        ]
        remote_parts.extend(ansible_extra)
        remote_parts.append(f"playbooks/{playbook}.yml")
        remote_parts.extend(shlex.quote(str(o)) for o in options)
        remote_cmd = " ".join(remote_parts)
        cmd = ["vagrant", "ssh", "mgmt-1", "-c", remote_cmd]
        print(f"\nRunning Ansible playbook: {playbook} (from your machine; no need to log into any VM)")
        print(f"Command: vagrant ssh mgmt-1 -c \"... ansible-playbook playbooks/{playbook}.yml ...\"")
    else:
        ansible_playbook = shutil.which("ansible-playbook")
        if not ansible_playbook:
            print("[!] Error: ansible-playbook not found. Install Ansible (e.g. pip install ansible).")
            return False
        cmd = [ansible_playbook, str(playbook_path)]
        cmd.extend(options)
        print(f"\nRunning Ansible playbook: {playbook}")
        print(f"Command: {' '.join(cmd)}")

    if dry_run:
        print(" Dry run mode (--check) - no changes applied")
        return True
    try:
        cwd = str(vagrant_dir) if sys.platform == "win32" else str(ansible_dir)
        result = subprocess.run(
            cmd,
            cwd=cwd,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode == 0:
            print("[OK] Ansible playbook completed successfully")
            if result.stdout:
                print(result.stdout)
            return True
        print(f"[!] Error running Ansible playbook (exit code {result.returncode})")
        if result.stdout:
            print("Stdout:", result.stdout)
        if result.stderr:
            print("Stderr:", result.stderr)
        if sys.platform == "win32" and not result.stdout and not result.stderr:
            print("Tip: If /sme-ansible is missing in the VM, run: cd vagrant && vagrant reload mgmt-1")
        print(
            "\nTip: Save the output above to a .log file and run:\n"
            "  python cli.py ai-log deploy-error.log\n"
            "Or analyse a VM provisioning log directly:\n"
            "  python cli.py ai-log --host-debug mgmt-1"
        )
        return False
    except subprocess.CalledProcessError as e:
        print(f"[!] Error running Ansible playbook: {e}")
        if e.stdout:
            print("Stdout:", e.stdout)
        if e.stderr:
            print("Stderr:", e.stderr)
        return False
    except OSError as e:
        if getattr(e, "winerror", None) == 193:
            print("[!] Error: ansible-playbook could not be run (not a valid Win32 application). On Windows, install Ansible via: pip install ansible")
        else:
            print(f"[!] Unexpected error: {e}")
        return False
    except Exception as e:
        print(f"[!] Unexpected error: {e}")
        return False

# log-* VMs take longer to accept SSH (initial setup; once up, ~8s is common). Use longer timeouts so they don't report "timeout" when up.
# SSH connection takes ~23s, full provisioning check takes ~48s, but with network delays need more buffer
SSH_TIMEOUT_DEFAULT = 120  # Increased to 120 seconds to allow full provisioning check with network delays
SSH_TIMEOUT_LOG = 150  # Increased to 150 seconds for log VMs (ELK stack is heavy)

def _run_with_hard_timeout(cmd, timeout_seconds=15, cwd=None):
    """Run a command and kill it if it exceeds timeout. Works on Windows where run(timeout=) may not kill the child.
    cwd: if set, run command in this directory (e.g. VAGRANT_CWD for vagrant ssh)."""
    kwargs = dict(
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    if cwd is not None:
        kwargs["cwd"] = str(cwd)
    proc = subprocess.Popen(cmd, **kwargs)
    try:
        stdout, stderr = proc.communicate(timeout=timeout_seconds)
        return proc.returncode, stdout or "", stderr or ""
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        raise


def _check_provisioning_status_inner(host):
    """Returns (status, reason). status is 'ready'|'provisioning'|'timeout'. reason is set when status is provisioning or timeout."""
    ssh_timeout = SSH_TIMEOUT_LOG if host.startswith("log-") else SSH_TIMEOUT_DEFAULT
    try:
        # Check for active provisioning (narrow: apt-get/dpkg front-end, bootstrap script)
        # Skip for log-* so we always run the service check (grep can false-positive on log hosts)
        if not host.startswith("log-"):
            proc_check_rc, proc_check_out, _ = _run_with_hard_timeout(
                ["vagrant", "ssh", host, "-c",
                 "timeout 4 sh -c \"ps aux | grep -E 'apt-get|/usr/bin/dpkg|/vagrant/bootstrap/' | grep -v grep | head -1\""],
                timeout_seconds=ssh_timeout,
                cwd=VAGRANT_CWD,
            )
            if proc_check_rc == 0 and proc_check_out.strip():
                return "provisioning", "Installing packages (apt, bootstrap)…"

        # Check if key services are installed and running
        if host.startswith("dc-"):
            # First verify the required packages are actually installed
            pkg_check = subprocess.run(
                ["vagrant", "ssh", host, "-c", "dpkg -l | grep -E '^ii\\s+(bind9|slapd|krb5-kdc|krb5-admin-server|squid)\\s' | wc -l"],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
            )
            if pkg_check.returncode == 0:
                pkg_count_str = pkg_check.stdout.strip()
                if pkg_count_str and int(pkg_count_str) >= 3:  # At least 3 of the 5 main packages
                    # Packages installed, now check services are running
                    service_check = subprocess.run(
                        ["vagrant", "ssh", host, "-c", "systemctl is-active named 2>/dev/null || systemctl is-active slapd 2>/dev/null || systemctl is-active squid 2>/dev/null"],
                        capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
                    )
                    if service_check.returncode == 0 and service_check.stdout.strip():
                        return "ready", None
            # If packages aren't installed or services aren't running, return provisioning
            return "provisioning", "Packages not installed or services not running"
        elif host.startswith("mgmt-"):
            service_check = subprocess.run(
                ["vagrant", "ssh", host, "-c", "which ansible >/dev/null 2>&1 && echo ready"],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
            )
            if service_check.returncode == 0 and "ready" in service_check.stdout.lower():
                return "ready", None
        elif host.startswith("web-"):
            service_check = subprocess.run(
                ["vagrant", "ssh", host, "-c", "systemctl is-active apache2 2>/dev/null || systemctl is-active nginx 2>/dev/null"],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
            )
            if service_check.returncode == 0 and service_check.stdout.strip():
                return "ready", None
        elif host.startswith("filesrv-"):
            service_check = subprocess.run(
                ["vagrant", "ssh", host, "-c", "systemctl is-active smbd 2>/dev/null || systemctl is-active nfs-kernel-server 2>/dev/null"],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
            )
            if service_check.returncode == 0 and service_check.stdout.strip():
                return "ready", None
        elif host.startswith("fw-"):
            service_check = subprocess.run(
                ["vagrant", "ssh", host, "-c", "which iptables >/dev/null 2>&1 && echo ready"],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
            )
            if service_check.returncode == 0 and "ready" in service_check.stdout.lower():
                return "ready", None
        elif host.startswith("monitor-"):
            service_check = subprocess.run(
                ["vagrant", "ssh", host, "-c", "systemctl is-active prometheus 2>/dev/null || systemctl is-active grafana-server 2>/dev/null"],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
            )
            if service_check.returncode == 0 and service_check.stdout.strip():
                return "ready", None
        elif host.startswith("log-"):
            # Check rsyslog and nginx only (same subprocess.run pattern as other VMs). Check elasticsearch/kibana yourself.
            rsyslog_check = subprocess.run(
                ["vagrant", "ssh", host, "-c", "systemctl is-active rsyslog 2>/dev/null"],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
            )
            nginx_check = subprocess.run(
                ["vagrant", "ssh", host, "-c", "systemctl is-active nginx 2>/dev/null"],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=ssh_timeout, cwd=str(VAGRANT_CWD)
            )
            if (rsyslog_check.returncode == 0 and (rsyslog_check.stdout or "").strip() == "active"
                    and nginx_check.returncode == 0 and (nginx_check.stdout or "").strip() == "active"):
                return "ready", None
            return "provisioning", "rsyslog and nginx must be active (check elasticsearch/kibana yourself). Run: sme-spinup debug --host-debug log-1"
        # Generic fallback
        try:
            ssh_rc, _, _ = _run_with_hard_timeout(
                ["vagrant", "ssh", host, "-c", "echo ready"],
                timeout_seconds=ssh_timeout,
                cwd=VAGRANT_CWD,
            )
            if ssh_rc == 0:
                return "ready", None
        except subprocess.TimeoutExpired:
            pass
        return "provisioning", "Services not ready or still starting"

    except subprocess.TimeoutExpired:
        return "timeout", "Check timed out"
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "provisioning", "SSH or startup in progress"
    except Exception:
        return "provisioning", None


def check_provisioning_status(host):
    """Check if a VM is still provisioning by checking services and packages. Returns 'ready'|'provisioning'|'timeout'."""
    status, _ = _check_provisioning_status_inner(host)
    return status


def check_provisioning_status_with_reason(host):
    """Returns dict with status ('ready'|'provisioning'|'timeout') and optional reason (str) for UI feedback."""
    status, reason = _check_provisioning_status_inner(host)
    return {"status": status, "reason": reason}


def debug_provisioning_check(host):
    """Run provisioning check steps with timing to see which step fails or times out."""
    import time
    orig = os.getcwd()
    try:
        os.chdir("vagrant")
    except Exception as e:
        print(f"[!] Cannot chdir to vagrant: {e}")
        return
    try:
        print(f"\n  Provisioning diagnostic: {host}")
        print("  " + "=" * 56)
        print("  This shows what the UI uses to show Ready / Provisioning / Timeout.")
        print()

        result_for_ui = None  # "ready" | "provisioning" | "timeout"
        status_ssh_timeout = SSH_TIMEOUT_LOG if host.startswith("log-") else SSH_TIMEOUT_DEFAULT

        # Step 1a: Can we connect to the VM?
        print("  1. Can we connect to the VM?")
        t0 = time.perf_counter()
        try:
            rc, out, _ = _run_with_hard_timeout(
                ["vagrant", "ssh", host, "-c", "echo ok"],
                timeout_seconds=status_ssh_timeout,
                cwd=VAGRANT_CWD,
            )
            elapsed = time.perf_counter() - t0
            if rc == 0:
                print(f"     [PASS] Yes, connected in {elapsed:.1f}s.")
            else:
                print(f"     [FAIL] SSH returned code {rc} ({elapsed:.1f}s).")
        except subprocess.TimeoutExpired:
            elapsed = time.perf_counter() - t0
            print(f"     [TIMEOUT] No response after {elapsed:.1f}s - VM or SSH is slow.")
            result_for_ui = "timeout"
        except Exception as e:
            print(f"     [ERROR] {e}")
            result_for_ui = "timeout"

        # Step 1b: Is the VM finished installing (apt/bootstrap)?
        if result_for_ui is None:
            print("\n  2. Is the VM finished installing (apt, bootstrap)?")
            t0 = time.perf_counter()
            try:
                rc, out, _ = _run_with_hard_timeout(
                    ["vagrant", "ssh", host, "-c",
                     "timeout 4 sh -c \"ps aux | grep -E 'apt-get|/usr/bin/dpkg|/vagrant/bootstrap/' | grep -v grep | head -1\""],
                    timeout_seconds=status_ssh_timeout,
                    cwd=VAGRANT_CWD,
                )
                elapsed = time.perf_counter() - t0
                if rc == 0 and out.strip():
                    print(f"     [-] No, still installing -> UI would show: Provisioning")
                    result_for_ui = "provisioning"
                else:
                    print(f"     [PASS] Yes, finished installing ({elapsed:.1f}s). Checking services next.")
            except subprocess.TimeoutExpired:
                elapsed = time.perf_counter() - t0
                print(f"     [TIMEOUT] Check took too long ({elapsed:.1f}s) -> UI would show: Timeout")
                result_for_ui = "timeout"
            except Exception as e:
                print(f"     [ERROR] {e}")
                result_for_ui = "timeout"

        # Step 2: Are key services running? All of rsyslog, nginx, elasticsearch, kibana must be active for Ready
        if result_for_ui is None and host.startswith("log-"):
            print("\n  3. Are key services running? (all of rsyslog, nginx, elasticsearch, kibana must be active = Ready)")
            service_checks = [
                ("rsyslog", "timeout 2 systemctl is-active rsyslog 2>/dev/null"),
                ("nginx", "timeout 2 systemctl is-active nginx 2>/dev/null"),
                ("elasticsearch", "timeout 2 systemctl is-active elasticsearch 2>/dev/null"),
                ("kibana", "timeout 2 systemctl is-active kibana 2>/dev/null"),
            ]
            all_active = True
            for label, cmd in service_checks:
                t0 = time.perf_counter()
                try:
                    rc, out, _ = _run_with_hard_timeout(
                        ["vagrant", "ssh", host, "-c", cmd],
                        timeout_seconds=status_ssh_timeout,
                        cwd=VAGRANT_CWD,
                    )
                    elapsed = time.perf_counter() - t0
                    if rc == 0 and (out or "").strip():
                        print(f"     [PASS] {label} is active ({elapsed:.1f}s)")
                    else:
                        print(f"     [-] {label} not active ({elapsed:.1f}s)")
                        all_active = False
                except subprocess.TimeoutExpired:
                    elapsed = time.perf_counter() - t0
                    print(f"     [TIMEOUT] {label} check took too long ({elapsed:.1f}s)")
                    all_active = False
                except Exception as e:
                    print(f"     [ERROR] {label}: {e}")
                    all_active = False
            if all_active:
                print(f"     [PASS] All key services active -> UI would show: Ready")
                result_for_ui = "ready"
            else:
                print(f"     [-] Not all services active -> UI would show: Provisioning")
                result_for_ui = "provisioning"
        elif result_for_ui is None:
            t0 = time.perf_counter()
            try:
                result_for_ui = check_provisioning_status(host) or "-"
                elapsed = time.perf_counter() - t0
                print(f"\n  3. Full check: {result_for_ui!r} ({elapsed:.1f}s)")
            except subprocess.TimeoutExpired:
                result_for_ui = "timeout"
                print(f"\n  3. [TIMEOUT] Full check did not complete in time.")
            except Exception as e:
                print(f"\n  3. [ERROR] {e}")
                result_for_ui = "timeout"

        # Summary
        print()
        print("  " + "=" * 56)
        if result_for_ui == "ready":
            print("  RESULT: This VM would show as READY in the UI (services are up).")
        elif result_for_ui == "provisioning":
            print("  RESULT: This VM would show as PROVISIONING or - (still installing or services not up).")
        elif result_for_ui == "timeout":
            print("  RESULT: This VM would show as TIMEOUT (the check did not finish in time; SSH may be slow).")
        else:
            print(f"  RESULT: {result_for_ui}")
        print()
    finally:
        os.chdir(orig)


def show_status(watch=False, interval=5, show_provisioning=False):
    """Show VM status"""
    if watch:
        print("\nWatching VM status (press Ctrl+C to stop)...")
        print(f"   Refreshing every {interval} seconds\n")
        try:
            original_dir = os.getcwd()
            os.chdir("vagrant")
            import time
            while True:
                # Clear screen (works on most terminals)
                if os.name == 'nt':  # Windows
                    os.system('cls')
                else:  # Unix/Linux/Mac
                    os.system('clear')
                
                print(f"\nVM Status (Last updated: {time.strftime('%H:%M:%S')})")
                print("=" * 60)
                result = subprocess.run(["vagrant", "status"], capture_output=True, 
                                       text=True, encoding='utf-8', errors='replace')
                print(result.stdout)
                if result.stderr:
                    print(result.stderr, file=sys.stderr)
                
                # Show provisioning status if requested
                if show_provisioning:
                    print("\nProvisioning Status:")
                    print("-" * 60)
                    # Extract running VMs from status (reuse same result)
                    for line in result.stdout.split('\n'):
                        if 'running' in line.lower():
                            host = line.split()[0]
                            prov_status = check_provisioning_status(host)
                            status_icon = "..." if prov_status == "provisioning" else "[OK]"
                            print(f"  {status_icon} {host}: {prov_status}")
                
                print("=" * 60)
                print(f"\nRefreshing in {interval} seconds... (Ctrl+C to stop)")
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\n\nStopped watching status.")
            os.chdir(original_dir)
        except Exception as e:
            print(f"[!] Error checking status: {e}")
            os.chdir(original_dir)
    else:
        print("\nChecking VM status...")
        try:
            original_dir = os.getcwd()
            os.chdir("vagrant")
            result = subprocess.run(["vagrant", "status"], capture_output=True, 
                                   text=True, encoding='utf-8', errors='replace')
            print(result.stdout)
            if result.stderr:
                print(result.stderr, file=sys.stderr)
            
            # Show provisioning status if requested
            if show_provisioning:
                print("\nProvisioning Status:")
                print("-" * 60)
                # Extract running VMs from status
                for line in result.stdout.split('\n'):
                    if 'running' in line.lower():
                        host = line.split()[0]
                        prov_status = check_provisioning_status(host)
                        status_icon = "..." if prov_status == "provisioning" else "[OK]"
                        print(f"  {status_icon} {host}: {prov_status}")
            
            os.chdir(original_dir)
        except Exception as e:
            print(f"[!] Error checking status: {e}")
            os.chdir(original_dir)

def run_ssh_proxy_command(args):
    """Connect to host via SSH proxy through DC"""
    target_host = args.ssh_proxy
    username = args.ssh_user
    local_port = args.ssh_port
    dc_number = args.ssh_dc
    
    print(f"Setting up SSH proxy connection to {target_host}")
    print(f"Username: {username}")
    print(f"Local port: {local_port}")
    if dc_number:
        print(f"Using DC-{dc_number}")
    print()
    
    # Build SSH tunnel command
    cmd = ["./scripts/sme-ssh-tunnel.sh"]
    
    if username != 'vagrant':
        cmd.extend(["-u", username])
    
    if local_port != 2222:
        cmd.extend(["-p", str(local_port)])
    
    if dc_number:
        cmd.extend(["-d", str(dc_number)])
    
    cmd.extend(["-c", target_host])  # Connect directly
    
    print(f"Running: {' '.join(cmd)}")
    print()
    
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[!] SSH proxy connection failed: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nSSH proxy connection interrupted")
        sys.exit(0)

def _resolve_vboxmanage():
    """Return path to VBoxManage executable, or None. On Windows try common install paths."""
    import shutil
    exe = "VBoxManage.exe" if sys.platform == "win32" else "VBoxManage"
    path = shutil.which(exe) or shutil.which("VBoxManage")
    if path:
        return path
    if sys.platform != "win32":
        return None
    for base in (
        os.environ.get("VBOX_INSTALL_PATH", ""),
        os.environ.get("VBOX_MSI_INSTALL_PATH", ""),
        r"C:\Program Files\Oracle\VirtualBox",
        r"C:\Program Files (x86)\Oracle\VirtualBox",
    ):
        if not base:
            continue
        p = Path(base) / exe
        if p.is_file():
            return str(p)
    return None


def repair_vm(host):
    """Re-register a VM with Vagrant when the VM exists in VirtualBox but Vagrant reports 'not created'.
    Writes the VirtualBox UUID to .vagrant/machines/<host>/virtualbox/id so Vagrant recognizes the VM.
    """
    known = {"fw-1", "fw-2", "dc-1", "dc-2", "filesrv-1", "filesrv-2",
             "web-1", "web-2", "monitor-1", "log-1", "mgmt-1", "mgmt-2"}
    if host not in known:
        print(f"[!] Unknown host: {host}. Use one of: {', '.join(sorted(known))}")
        return False
    vbox = _resolve_vboxmanage()
    if not vbox:
        print("[!] VBoxManage not found. Install VirtualBox or add it to PATH.")
        return False
    vagrant_dir = Path("vagrant").resolve()
    if not (vagrant_dir / "Vagrantfile").exists():
        print("[!] Run this from the project root (parent of vagrant/).")
        return False
    # List all VMs (running and stopped) so we can find fw-2 even if it were powered off
    for list_cmd in ("runningvms", "vms"):
        r = subprocess.run(
            [vbox, "list", list_cmd],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
        )
        if r.returncode != 0 or not r.stdout:
            continue
        # Format: "vagrant_fw-2_1770742407580_67692" {uuid}
        for line in (r.stdout or "").splitlines():
            line = line.strip()
            if not line or not line.startswith('"'):
                continue
            end = line.find('"', 1)
            if end == -1:
                continue
            name = line[1:end]
            if not name.startswith("vagrant_"):
                continue
            rest = name[8:]
            if rest != host and not rest.startswith(host + "_"):
                continue
            # Extract UUID: after the closing quote comes space and {uuid}
            uuid_part = line[end + 1 :].strip()
            if uuid_part.startswith("{"):
                uuid_part = uuid_part[1:]
            if uuid_part.endswith("}"):
                uuid_part = uuid_part[:-1]
            uuid_part = uuid_part.strip()
            if not uuid_part or len(uuid_part) < 30:
                continue
            id_dir = vagrant_dir / ".vagrant" / "machines" / host / "virtualbox"
            id_dir.mkdir(parents=True, exist_ok=True)
            id_file = id_dir / "id"
            id_file.write_text(uuid_part.strip(), encoding="utf-8")
            print(f"[OK] Re-registered {host} with Vagrant (UUID written to .vagrant/machines/{host}/virtualbox/id)")
            print(f"   Run: sme-spinup status   or   vagrant status {host}")
            return True
    print(f"[!] No VirtualBox VM found for '{host}' (looking for name like vagrant_{host}_...).")
    print("   Start the VM in VirtualBox first, or run: vagrant up " + host)
    return False


def debug_host(host=None):
    """Debug provisioning for a specific host or show general debugging info"""
    if not host:
        print("\n Provisioning Debug Guide")
        print("=" * 60)
        print("\nTo debug a specific host, use:")
        print("  sme-spinup debug --host-debug <hostname>")
        print("\nTo re-run provisioning (install missing packages), add --reprovision:")
        print("  sme-spinup debug --reprovision              # all hosts")
        print("  sme-spinup debug --host-debug log-1 --reprovision   # single host")
        print("\nExample:")
        print("  sme-spinup debug --host-debug dc-1")
        print("\nAvailable debugging methods:")
        print("\n1. View provisioning logs:")
        print("   vagrant ssh <host> -c 'tail -100 /var/log/vagrant-provision.log'")
        print("\n2. Check running processes:")
        print("   vagrant ssh <host> -c 'ps aux | grep -E \"(apt|install|configure)\"'")
        print("\n3. Check service status:")
        print("   vagrant ssh <host> -c 'systemctl status <service-name>'")
        print("\n4. View system logs:")
        print("   vagrant ssh <host> -c 'journalctl -xe'")
        print("\n5. Check disk space:")
        print("   vagrant ssh <host> -c 'df -h'")
        print("\n6. View bootstrap script output:")
        print("   vagrant up <host>  # (without --async to see full output)")
        return
    
    print(f"\n Debugging host: {host}")
    print("=" * 60)
    
    try:
        original_dir = os.getcwd()
        os.chdir("vagrant")
        
        # Check if VM exists and is running
        print("\n1. Checking VM status...")
        status_result = subprocess.run(
            ["vagrant", "status", host],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        print(status_result.stdout)
        if "not created" in (status_result.stdout or "").lower():
            print("   Tip: If this VM is actually running in VirtualBox, re-register it with:")
            print(f"      sme-spinup repair-vm {host}")
            print()
        
        # Try to SSH and get info (log-1 uses longer timeout - often slow to accept SSH)
        print("\n2. Checking provisioning status...")
        ssh_check_timeout = SSH_TIMEOUT_LOG if host.startswith("log-") else SSH_TIMEOUT_DEFAULT
        try:
            prov_result = subprocess.run(
                ["vagrant", "ssh", host, "-c", "echo 'SSH connection successful'"],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=ssh_check_timeout
            )
            if prov_result.returncode == 0:
                print("   [OK] SSH connection works")
            else:
                print("   ... SSH command returned non-zero - provisioning may still be running")
        except subprocess.TimeoutExpired:
            print("   ... SSH timed out (VM may be slow to accept connections)")
        except subprocess.CalledProcessError:
            print("   ... SSH failed - provisioning may still be running")
        
        # Check for provisioning log
        print("\n3. Checking for provisioning logs...")
        log_result = subprocess.run(
            ["vagrant", "ssh", host, "-c", "test -f /var/log/vagrant-provision.log && tail -20 /var/log/vagrant-provision.log || echo 'No provisioning log found'"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=ssh_check_timeout
        )
        if log_result.returncode == 0:
            print(log_result.stdout)
        
        # Check running processes
        print("\n4. Checking running processes...")
        proc_result = subprocess.run(
            ["vagrant", "ssh", host, "-c", "ps aux | head -20"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=ssh_check_timeout
        )
        if proc_result.returncode == 0:
            print(proc_result.stdout)
        
        # Check system resources
        print("\n5. Checking system resources...")
        df_result = subprocess.run(
            ["vagrant", "ssh", host, "-c", "df -h /"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=ssh_check_timeout
        )
        if df_result.returncode == 0:
            print(df_result.stdout)
        
        # Log server: why aren't nginx, elasticsearch, kibana active? (all required for Ready)
        if host.startswith("log-"):
            print("\n6. Log server services (rsyslog, nginx, elasticsearch, kibana must all be active):")
            for label, cmd in [
                ("Packages installed?", "dpkg -l rsyslog nginx elasticsearch kibana 2>/dev/null | grep -E '^ii|^rc' || echo 'Some packages missing'"),
                ("Service status", "systemctl is-active rsyslog nginx elasticsearch kibana 2>/dev/null; systemctl status rsyslog nginx elasticsearch kibana --no-pager -l 2>/dev/null | head -80"),
            ]:
                try:
                    r = subprocess.run(
                        ["vagrant", "ssh", host, "-c", cmd],
                        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=ssh_check_timeout
                    )
                    print(f"   --- {label} ---")
                    print(r.stdout or r.stderr or "(no output)")
                except subprocess.TimeoutExpired:
                    print(f"   --- {label} --- (timed out)")
                except Exception as e:
                    print(f"   --- {label} --- Error: {e}")
            for svc in ["elasticsearch", "kibana"]:
                try:
                    r = subprocess.run(
                        ["vagrant", "ssh", host, "-c", f"journalctl -u {svc} -n 20 --no-pager 2>/dev/null"],
                        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=ssh_check_timeout
                    )
                    if r.stdout and r.stdout.strip():
                        print(f"   --- journalctl {svc} (last 20) ---")
                        print(r.stdout)
                except (subprocess.TimeoutExpired, Exception):
                    pass
        
        print("\n" + "=" * 60)
        print("\nTip: Additional debugging commands:")
        print(f"   vagrant ssh {host} -c 'journalctl -xe | tail -50'  # System logs")
        print(f"   vagrant ssh {host} -c 'systemctl list-units --failed'  # Failed services")
        print(f"   vagrant ssh {host} -c 'tail -f /var/log/vagrant-provision.log'  # Watch logs")
        
        os.chdir(original_dir)
    except Exception as e:
        print(f"[!] Error debugging host: {e}")
        os.chdir(original_dir)

def show_presets():
    """List available presets"""
    print("Available Configuration Presets:")
    print()
    
    for preset_name, preset_info in CONFIGURATION_PRESETS.items():
        print(f"Target: {preset_name.upper()}")
        print(f"   Description: {preset_info['description']}")
        print(f"   Hosts: {', '.join(preset_info['hosts'])}")
        print(f"   [!]  {preset_info['warning']}")
        print()
    
    print("Tip: Usage:")
    print("  python cli.py up --preset minimal")
    print("  python cli.py up --preset standard")
    print("  python cli.py up --preset production")

def get_preset_hosts(preset_name):
    """Get the host list for a preset"""
    if preset_name not in CONFIGURATION_PRESETS:
        print(f"[!] Error: Unknown preset '{preset_name}'")
        print("Available presets:")
        for preset in CONFIGURATION_PRESETS.keys():
            print(f"  * {preset}")
        return None
    
    preset_info = CONFIGURATION_PRESETS[preset_name]
    print(f"Target: Using preset: {preset_name.upper()}")
    print(f"   {preset_info['description']}")
    print(f"   [!]  {preset_info['warning']}")
    
    return preset_info['hosts']

def main():
    parser = argparse.ArgumentParser(description="SmeSpinUp CLI for managing SME VMs")

    parser.add_argument('action', choices=[
        'up', 'halt', 'destroy', 'status', 'deploy', 'poweroff', 'resume', 'reprovision',
        'maintenance', 'security', 'backup', 'recovery', 'presets', 'debug', 'gui', 'repair-vm',
        'ai-log', 'ai-alert', 'ask', 'start',
    ], help='Action to perform')
    parser.add_argument('target', nargs='?', help='Target host for repair-vm (e.g. fw-2)')
    parser.add_argument("--host", action="append", help="VM role or role:count (e.g., web or web:2)", dest="hosts")
    parser.add_argument("--default", action="store_true", help="Start full default SME setup")
    parser.add_argument("--dry-run", action="store_true", help="Print the command that would be run")
    parser.add_argument("--validate", action="store_true", help="Validate configuration before running")
    parser.add_argument("--limit", help="Limit Ansible operations to specific hosts")
    parser.add_argument("--tags", help="Run only specific Ansible tags")
    parser.add_argument("--health-check", action="store_true", help="Run health check on all hosts")
    parser.add_argument("--recover", metavar='HOST', help="Trigger recovery for specific host")
    parser.add_argument("--monitor", action="store_true", help="Start continuous monitoring")
    parser.add_argument('--ssh-proxy', metavar='HOST', help='Connect to host through SSH proxy (DC)')
    parser.add_argument('--ssh-user', default='vagrant', help='SSH username for proxy connection')
    parser.add_argument('--ssh-port', type=int, default=2222, help='Local port for SSH tunnel')
    parser.add_argument('--ssh-dc', type=int, choices=[1, 2], help='Use specific DC for SSH proxy')
    parser.add_argument("--preset", choices=CONFIGURATION_PRESETS.keys(), help="Apply a preset configuration")
    parser.add_argument("--async", action="store_true", dest="async_mode", help="Boot VMs asynchronously (fire and forget)")
    parser.add_argument("--watch", action="store_true", help="Watch status continuously (for use with status command)")
    parser.add_argument("--interval", type=int, default=5, help="Refresh interval in seconds for watch mode (default: 5)")
    parser.add_argument("--provisioning", action="store_true", help="Show provisioning status (check if bootstrap scripts are still running)")
    parser.add_argument("--host-debug", metavar='HOST', help="Debug a specific host (for use with debug command)")
    parser.add_argument("--debug-provisioning", action="store_true", help="Run provisioning-check diagnostic (use with debug --host-debug HOST)")
    parser.add_argument("--reprovision", action="store_true", help="Re-run provisioning (all hosts, or one host with --host-debug HOST)")
    parser.add_argument("--skip-key-check", action="store_true", dest="skip_key_check",
        help="(Windows) Skip pre-deploy check for mgmt-1 and SSH jump key; deploy may fail if key is missing")
    parser.add_argument(
        "--model",
        default=None,
        help="OpenAI model override for ai-log / ai-alert (default: OPENAI_MODEL or gpt-4.1-mini)",
    )
    parser.add_argument(
        "--show-excerpt",
        action="store_true",
        help="Print extracted log lines before AI analysis (ai-log only)",
    )
    parser.add_argument(
        "--max-lines",
        type=int,
        default=200,
        help="Maximum log lines sent to the AI for ai-log (default: 200)",
    )
    parser.add_argument(
        "--latest",
        action="store_true",
        help="Analyse the most recent saved vagrant up session log (ai-log only)",
    )
    parser.add_argument(
        "--run-up",
        action="store_true",
        dest="run_up",
        help="With start: run vagrant up for the chosen preset after the guide",
    )
    parser.add_argument(
        "-i",
        "--interactive",
        action="store_true",
        help="Interactive Q&A loop (ask action only)",
    )

    args = parser.parse_args()

    # Documentation Q&A support agent (retrieve project docs + LLM)
    if args.action == "ask":
        from ai_assistant.ask import ask_documentation, ask_interactive

        if args.interactive or not args.target:
            sys.exit(
                ask_interactive(project_root=PROJECT_ROOT, model=args.model)
            )
        sys.exit(
            ask_documentation(
                args.target,
                project_root=PROJECT_ROOT,
                model=args.model,
            )
        )

    # Interactive setup guide (log collection + optional AI tips)
    if args.action == "start":
        from ai_assistant.setup_guide import run_setup_guide

        sys.exit(
            run_setup_guide(
                preset=args.preset,
                run_up=args.run_up,
                dry_run=args.dry_run,
                project_root=PROJECT_ROOT,
            )
        )

    # AI-assisted troubleshooting (requires OPENAI_API_KEY)
    if args.action in ("ai-log", "ai-alert"):
        from ai_assistant.analysis import (
            analyse_alert_file,
            analyse_host_provision_log,
            analyse_setup_log_file,
        )

        if args.action == "ai-log":
            if args.latest:
                from ai_assistant.session_logs import resolve_latest_vagrant_log

                latest_log = resolve_latest_vagrant_log(PROJECT_ROOT)
                if latest_log is None:
                    print("[!] No saved vagrant up logs found.")
                    print("    Run: python cli.py up --preset minimal  (or vagrant up from vagrant/)")
                    print("    Logs are stored under logs/vagrant/")
                    sys.exit(1)
                print(f"Using latest session log: {latest_log}")
                sys.exit(
                    analyse_setup_log_file(
                        latest_log,
                        model=args.model,
                        max_lines=args.max_lines,
                        show_excerpt=args.show_excerpt,
                    )
                )
            if args.host_debug:
                sys.exit(
                    analyse_host_provision_log(
                        args.host_debug,
                        vagrant_cwd=VAGRANT_CWD,
                        model=args.model,
                        max_lines=args.max_lines,
                        show_excerpt=args.show_excerpt,
                    )
                )
            if not args.target:
                print("Usage: python cli.py ai-log <log-file>")
                print("       python cli.py ai-log --latest")
                print("       python cli.py ai-log --host-debug <host>")
                print("Examples:")
                print("  python cli.py ai-log ai_assistant/examples/sample_setup_error.log")
                print("  python cli.py ai-log --latest")
                print("  python cli.py ai-log --host-debug dc-1")
                sys.exit(1)
            sys.exit(
                analyse_setup_log_file(
                    args.target,
                    model=args.model,
                    max_lines=args.max_lines,
                    show_excerpt=args.show_excerpt,
                )
            )

        if not args.target:
            print("Usage: python cli.py ai-alert <alert-json-file>")
            print("Example:")
            print("  python cli.py ai-alert ai_assistant/examples/sample_prometheus_alert.json")
            sys.exit(1)
        sys.exit(analyse_alert_file(args.target, model=args.model))

    # GUI: start web UI and open browser
    if args.action == "gui":
        try:
            from gui.app import run_server
            import webbrowser
            import threading
            port = 5051
            url = f"http://127.0.0.1:{port}"
            threading.Timer(1.2, lambda: webbrowser.open(url)).start()
            print("Starting GUI at", url)
            print("Press Ctrl+C to stop. If you see 500, close ALL other Python/terminals and run again.")
            run_server(port=port)
        except ImportError as e:
            print("GUI requires Flask. Use the project venv and install dependencies:")
            print("  1. Activate venv:  .\\venv\\Scripts\\Activate.ps1   (PowerShell) or  venv\\Scripts\\activate   (cmd)")
            print("  2. Install:        pip install -e .")
            print("  3. Run again:      python cli.py gui")
            print("Error:", e)
            sys.exit(1)
        return

    # Repair VM: re-register with Vagrant when VM exists in VirtualBox but Vagrant says "not created"
    if args.action == "repair-vm":
        if not args.target:
            print("Usage: sme-spinup repair-vm <host>")
            print("Example: sme-spinup repair-vm fw-2")
            print("Use when Vagrant reports 'not created' but the VM is running in VirtualBox.")
            sys.exit(1)
        try:
            ok = repair_vm(args.target)
            sys.exit(0 if ok else 1)
        except Exception as e:
            print(f"[!] Error: {e}")
            sys.exit(1)

    # Initialize all_hosts variable
    all_hosts = []

    # Re-Provision: bring up any down VMs then provision all (preset required)
    if args.action == "reprovision":
        if not args.preset:
            print("[!] Error: reprovision requires --preset (e.g. --preset production)")
            sys.exit(1)
        if not check_prerequisites():
            sys.exit(1)
        hosts = CONFIGURATION_PRESETS.get(args.preset, {}).get("hosts", [])
        if not hosts:
            print(f"[!] Error: preset '{args.preset}' has no hosts")
            sys.exit(1)
        success = run_reprovision(hosts)
        sys.exit(0 if success else 1)

    # Check prerequisites for actions that need Vagrant
    if args.action in ["up", "halt", "destroy", "status", "poweroff", "resume"]:
        if not check_prerequisites():
            sys.exit(1)
    
    # Validate Vagrantfile if requested or if this is a destructive operation
    if args.validate or args.action in ["destroy", "halt"]:
        if not validate_vagrantfile():
            sys.exit(1)

    # Handle Ansible-based actions
    if args.action in ["deploy", "maintenance", "security", "backup", "recovery"]:
        options = []
        if args.limit:
            options.extend(["--limit", args.limit])
        if args.tags:
            options.extend(["--tags", args.tags])
        
        success = run_ansible_playbook(args.action, options, dry_run=args.dry_run, skip_key_check=getattr(args, "skip_key_check", False))
        if not success:
            sys.exit(1)
        return

    # Handle recovery-specific actions
    if args.health_check:
        print("\n Running health check on all hosts...")
        try:
            os.chdir("vagrant")
            # Run health check via SSH to management server
            result = subprocess.run([
                "vagrant", "ssh", "mgmt-1", "--", 
                "/opt/sme/scripts/health-monitor.py", "--check"
            ], capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
            print(result.stdout)
            os.chdir("..")
        except Exception as e:
            print(f"[!] Error running health check: {e}")
        return

    if args.recover:
        print(f"\n Triggering recovery for host: {args.recover}")
        try:
            os.chdir("vagrant")
            # Run recovery via SSH to management server
            result = subprocess.run([
                "vagrant", "ssh", "mgmt-1", "--",
                "/opt/sme/scripts/auto-recovery.sh", "--host", args.recover, "--issue", "host_down"
            ], capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
            print(result.stdout)
            os.chdir("..")
        except Exception as e:
            print(f"[!] Error triggering recovery: {e}")
        return

    if args.monitor:
        print("\nStarting continuous monitoring...")
        try:
            os.chdir("vagrant")
            # Start monitoring via SSH to management server
            result = subprocess.run([
                "vagrant", "ssh", "mgmt-1", "--",
                "/opt/sme/scripts/health-monitor.py", "--monitor", "--interval", "300"
            ], capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
            print(result.stdout)
            os.chdir("..")
        except Exception as e:
            print(f"[!] Error starting monitoring: {e}")
        return

    if args.ssh_proxy:
        if not check_ssh_proxy_dependencies(args):
            sys.exit(1)
        run_ssh_proxy_command(args)
        return

    if args.action == "status":
        show_status(watch=args.watch, interval=args.interval, show_provisioning=args.provisioning)
        return

    if args.action == "presets":
        show_presets()
        return

    if args.action == "debug":
        if args.reprovision:
            if not check_prerequisites():
                sys.exit(1)
            original_dir = os.getcwd()
            try:
                os.chdir("vagrant")
                if args.host_debug:
                    print(f"\n Re-provisioning {args.host_debug}...")
                    subprocess.run(
                        ["vagrant", "provision", args.host_debug],
                        check=True,
                    )
                    print(f"[OK] Provisioning complete. Running debug checks...\n")
                else:
                    print("\n Re-provisioning all hosts...")
                    subprocess.run(
                        ["vagrant", "provision"],
                        check=True,
                    )
                    print("[OK] Provisioning complete for all hosts.")
                    print("   Run 'sme-spinup status' or 'sme-spinup debug --host-debug <host>' to check.\n")
                os.chdir(original_dir)
            except subprocess.CalledProcessError as e:
                os.chdir(original_dir)
                print(f"[!] Provisioning failed (exit code {e.returncode})")
                if args.host_debug:
                    print(
                        f"\nTip: Analyse the provisioning log with AI:\n"
                        f"  python cli.py ai-log --host-debug {args.host_debug}"
                    )
                sys.exit(1)
        if args.debug_provisioning and args.host_debug:
            debug_provisioning_check(args.host_debug)
        else:
            debug_host(args.host_debug)
        return

    if args.preset:
        preset_hosts = get_preset_hosts(args.preset)
        if preset_hosts:
            all_hosts.extend(preset_hosts)
        else:
            sys.exit(1)
    elif not args.hosts and not args.default:
        print("[!] Error: Specify at least one `--host`, use `--default`, or choose a `--preset`")
        print("\nAvailable roles:")
        for role, count in VALID_ROLES.items():
            print(f"  {role}: up to {count} instances")
        print("\nCritical requirements:")
        print("  * Domain Controllers (dc) are REQUIRED for basic functionality")
        print("  * Management servers (mgmt) are RECOMMENDED for monitoring")
        print("\nTip: Examples:")
        print("  python cli.py up --default")
        print("  python cli.py up --preset minimal")
        print("  python cli.py up --preset standard")
        print("  python cli.py poweroff --preset production   # stop VMs cleanly")
        print("  python cli.py resume --preset production     # start from saved/powered-off")
        print("  python cli.py up --host dc:2 --host web:2")
        print("  python cli.py up --host dc:2 --host mgmt:1 --host web:2")
        print("\nAnsible actions:")
        print("  python cli.py deploy")
        print("  python cli.py maintenance --limit web_servers")
        print("  python cli.py security --dry-run")
        sys.exit(1)
    else:
        if args.default:
            all_hosts.extend(DEFAULT_HOSTS)

        if args.hosts:
            all_hosts.extend(expand_hosts(args.hosts))

    # Remove duplicates while preserving order
    seen = set()
    unique_hosts = []
    for host in all_hosts:
        if host not in seen:
            seen.add(host)
            unique_hosts.append(host)

    # Validate minimum configuration requirements
    if not validate_minimum_configuration(unique_hosts):
        sys.exit(1)

    print(f"\nTarget: Target hosts: {', '.join(unique_hosts)}")

    if args.action == "resume":
        success = run_resume(unique_hosts, dry_run=args.dry_run)
        sys.exit(0 if success else 1)

    vagrant_cmd = "halt" if args.action == "poweroff" else args.action
    success = run_vagrant_command(vagrant_cmd, unique_hosts, dry_run=args.dry_run, async_mode=args.async_mode)
    if not success:
        sys.exit(1)

if __name__ == "__main__":  # pragma: no cover
    main()

