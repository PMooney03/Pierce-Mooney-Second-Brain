"""
Thin layer over CLI/Vagrant for the GUI. Runs from project root.
"""
import re
import subprocess
import sys
import os
import threading
import queue
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FutureTimeoutError
from pathlib import Path

# Project root = parent of gui/
PROJECT_ROOT = Path(__file__).resolve().parent.parent
VAGRANT_DIR = PROJECT_ROOT / "vagrant"


def _cli_python_and_venv():
    """
    Return (python_exe, venv_root_or_none) for running cli.py.
    On Windows, always use base Python from pyvenv.cfg + VIRTUAL_ENV when a project venv exists,
    so we never invoke the venv launcher (which looks for pyvenv.cfg in cwd and fails).
    """
    project_root = PROJECT_ROOT.resolve()
    # On Windows, never use the venv's python.exe for the subprocess (it's a launcher that fails).
    # Prefer base Python from pyvenv.cfg so we can set VIRTUAL_ENV and avoid the launcher.
    if sys.platform == "win32":
        for name in ("venv_new", "venv"):
            venv_root = project_root / name
            cfg = venv_root / "pyvenv.cfg"
            if cfg.exists():
                try:
                    with open(cfg, encoding="utf-8", errors="replace") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("executable="):
                                base_exe = line.split("=", 1)[1].strip()
                                if base_exe and Path(base_exe).exists():
                                    return base_exe, venv_root
                                break
                            if line.startswith("home="):
                                home = line.split("=", 1)[1].strip()
                                if home:
                                    base_exe = str(Path(home) / "python.exe")
                                    if Path(base_exe).exists():
                                        return base_exe, venv_root
                                break
                except (OSError, IndexError):
                    pass
    # Non-Windows, or no project venv: use same interpreter if in project, else venv script, else sys.executable
    try:
        current = Path(sys.executable).resolve()
        try:
            if current.is_relative_to(project_root):
                return sys.executable, None
        except AttributeError:
            pass
        root_str = str(project_root) + os.sep
        if str(current).startswith(root_str) or current == project_root:
            return sys.executable, None
    except (ValueError, OSError):
        pass
    for name in ("venv_new", "venv"):
        venv_root = project_root / name
        for script in ("Scripts", "bin"):
            exe = "python.exe" if script == "Scripts" else "python"
            path = venv_root / script / exe
            if path.exists():
                return str(path), venv_root
    return sys.executable, None


def _cli_python():
    """Python executable for running cli.py (backward compat)."""
    exe, _ = _cli_python_and_venv()
    return exe


# Known Vagrant machine names (must match Vagrantfile and frontend)
KNOWN_VM_NAMES_LIST = [
    "fw-1", "fw-2", "dc-1", "dc-2", "filesrv-1", "filesrv-2",
    "web-1", "web-2", "monitor-1", "log-1", "mgmt-1", "mgmt-2",
]


def _resolve_vboxmanage():
    """Return path to VBoxManage executable, or None if not found.
    On Windows, PATH often doesn't include VirtualBox; try common install locations.
    """
    import shutil
    exe = "VBoxManage.exe" if sys.platform == "win32" else "VBoxManage"
    # 1) Try PATH
    path = shutil.which(exe) or shutil.which("VBoxManage")
    if path:
        return path
    if sys.platform != "win32":
        return None
    # 2) Windows: try common VirtualBox install paths
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


def _run_cli(*args, timeout=300):
    """Run cli.py with given args from project root. Returns (success, stdout, stderr)."""
    python_exe, venv_root = _cli_python_and_venv()
    cli_path = str((PROJECT_ROOT / "cli.py").resolve())
    cmd = [python_exe, cli_path] + list(args)
    env = os.environ.copy()
    if venv_root is not None:
        env["VIRTUAL_ENV"] = str(venv_root)
        env["SME_PROJECT_ROOT"] = str(PROJECT_ROOT.resolve())
    try:
        r = subprocess.run(
            cmd,
            cwd=str(PROJECT_ROOT),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        return r.returncode == 0, r.stdout or "", r.stderr or ""
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except Exception as e:
        return False, "", str(e)


def _run_cli_streaming(*args, timeout=600):
    """
    Run cli.py with given args; yield (line, None) for each line of stdout+stderr,
    then yield (None, returncode). Uses in-process runner so Start/Halt/Destroy work
    regardless of Python/venv path (no subprocess, no pyvenv.cfg issues).
    """
    for item in _run_cli_inprocess_streaming(*args, timeout=timeout):
        yield item


def _run_cli_inprocess_streaming(*args, timeout=600):
    """
    Run CLI by importing and calling main() in a thread. No subprocess = no pyvenv.cfg.
    Used on Windows when the venv launcher fails. Yields (line, None) then (None, returncode).
    """
    line_queue = queue.Queue()
    returncode_holder = [0]

    class StreamToQueue:
        def __init__(self, queue):
            self._q = queue
            self._buf = ""

        def write(self, s):
            if s:
                self._buf += s
                while "\n" in self._buf or "\r" in self._buf:
                    line, rest = self._buf.split("\n", 1) if "\n" in self._buf else self._buf.split("\r", 1)
                    self._buf = rest
                    line = line.strip()
                    if line:
                        self._q.put(("line", line))
                if self._buf and len(self._buf) > 4096:
                    self._q.put(("line", self._buf))
                    self._buf = ""

        def flush(self):
            if self._buf.strip():
                self._q.put(("line", self._buf.strip()))
            self._buf = ""

    def target():
        project_root = str(PROJECT_ROOT.resolve())
        old_cwd = os.getcwd()
        old_argv = list(sys.argv)
        old_stdout, old_stderr = sys.stdout, sys.stderr
        try:
            os.chdir(project_root)
            sys.argv = ["cli.py"] + list(args)
            sys.stdout = sys.stderr = StreamToQueue(line_queue)
            import cli
            cli.main()
        except SystemExit as e:
            returncode_holder[0] = int(e.code) if e.code is not None else 0
        except Exception as e:
            returncode_holder[0] = 1
            line_queue.put(("line", "Error: " + str(e)))
        finally:
            sys.stdout.flush()
            sys.stderr.flush()
            sys.stdout, sys.stderr = old_stdout, old_stderr
            sys.argv = old_argv
            os.chdir(old_cwd)
            line_queue.put(("done", None))

    t = threading.Thread(target=target, daemon=True)
    t.start()
    deadline = time.time() + timeout if timeout else None
    while True:
        try:
            wait = 10.0
            if deadline:
                wait = min(wait, max(0.1, deadline - time.time()))
            kind, payload = line_queue.get(timeout=wait)
        except queue.Empty:
            yield ("\x00KEEPALIVE", None)
            continue
        if kind == "done":
            break
        if kind == "line":
            yield (payload, None)
    t.join(timeout=5)
    if t.is_alive():
        returncode_holder[0] = -1
    yield (None, returncode_holder[0])


def get_prerequisites():
    """Return {ok: bool, missing: list, message: str}."""
    try:
        import cli
        ok = cli.check_prerequisites()
        if ok:
            return {"ok": True, "missing": [], "message": "All prerequisites installed."}
        # Be tolerant if the CLI check is pessimistic – the GUI can still try to run actions.
        # Treat this as a soft warning instead of blocking the UI with a red error banner.
        return {
            "ok": True,
            "missing": [],
            "message": "Prerequisite check reported issues, but the GUI will still try to use Vagrant/VirtualBox."
        }
    except Exception as e:
        # On unexpected errors, do not hard-block the UI; just surface a warning message.
        return {
            "ok": True,
            "missing": [],
            "message": f"Prerequisite check failed: {e}. The GUI will still try to run actions."
        }


def get_presets():
    """Return list of {id, description, hosts, host_count}."""
    try:
        import cli
        presets = []
        for pid, info in cli.CONFIGURATION_PRESETS.items():
            presets.append({
                "id": pid,
                "description": info["description"],
                "hosts": info["hosts"],
                "host_count": len(info["hosts"]),
            })
        return presets
    except Exception as e:
        return []


def _vbox_running_machine_names():
    """Return set of Vagrant machine names (e.g. fw-2) that have a running VM in VirtualBox.
    Uses VBoxManage (with Windows path fallback). VirtualBox is the source of truth for running state.
    """
    vbox = _resolve_vboxmanage()
    if not vbox:
        return set()
    try:
        r = subprocess.run(
            [vbox, "list", "runningvms"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
        )
        if r.returncode != 0 or not r.stdout:
            return set()
        # Format: "vagrant_fw-2_1770742407580_67692" {uuid}  (Windows/Linux)
        running = set()
        for line in (r.stdout or "").splitlines():
            line = line.strip()
            if not line or not line.startswith('"'):
                continue
            end = line.find('"', 1)
            if end == -1:
                continue
            name = line[1:end]
            # Vagrant VBox names: vagrant_<machine>_<id> e.g. vagrant_fw-2_123_456
            if name.startswith("vagrant_"):
                rest = name[8:]  # after "vagrant_"
                for known in KNOWN_VM_NAMES_LIST:
                    if rest == known or rest.startswith(known + "_"):
                        running.add(known)
                        break
        return running
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        return set()


def _apply_vbox_running_fallback(vms):
    """Use VirtualBox as source of truth for running state.
    For any VM that is running in VBox, set state to 'running' regardless of what Vagrant reports.
    Fixes GUI when Vagrant metadata is out of sync (e.g. fw-2 shows 'not created' but is running in VBox).
    """
    vbox_running = _vbox_running_machine_names()
    if not vbox_running:
        return
    for vm in vms:
        if vm.get("name") in vbox_running:
            vm["state"] = "running"


def _vbox_existing_machine_names():
    """Return set of Vagrant machine names that exist in VirtualBox (running or powered off).
    This lets the GUI show 'Stopped' instead of 'Not created' when VBox has a VM but Vagrant metadata is missing.
    """
    vbox = _resolve_vboxmanage()
    if not vbox:
        return set()
    try:
        r = subprocess.run(
            [vbox, "list", "vms"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
        )
        if r.returncode != 0 or not r.stdout:
            return set()
        existing = set()
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
            for known in KNOWN_VM_NAMES_LIST:
                if rest == known or rest.startswith(known + "_"):
                    existing.add(known)
                    break
        return existing
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        return set()


def _apply_vbox_existing_fallback(vms):
    """If VBox has a VM but Vagrant reports 'not created', treat it as 'poweroff' so the GUI shows Stopped."""
    vbox_existing = _vbox_existing_machine_names()
    if not vbox_existing:
        return
    for vm in vms:
        name = vm.get("name")
        state = (vm.get("state") or "").lower()
        if name in vbox_existing and "not created" in state:
            vm["state"] = "poweroff"


def get_status(include_provisioning=False):
    """Return {ok: bool, vms: [{name, state, provisioning?}], raw: str}."""
    if not (VAGRANT_DIR / "Vagrantfile").exists():
        return {"ok": False, "vms": [], "raw": "Vagrantfile not found."}
    known_vms = set(KNOWN_VM_NAMES_LIST)
    try:
        # Try machine-readable first, but fall back to regular status if it times out
        vms_by_name = {}
        raw = ""
        machine_readable_worked = False
        
        try:
            r = subprocess.run(
                ["vagrant", "status", "--machine-readable"],
                cwd=str(VAGRANT_DIR),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=10,  # Short timeout, fall back quickly
            )
            raw = (r.stdout or "") + (r.stderr or "")
            
            # Only parse if it succeeded and didn't timeout
            if r.returncode == 0 and "timed out" not in raw.lower():
                machine_readable_worked = True
                # Normal line-by-line parse (Vagrant usually outputs one record per line)
                for line in raw.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    # Format: timestamp,target,type,data...
                    parts = line.split(",", 3)
                    if len(parts) >= 4:
                        _ts, target, msg_type, data = parts[0], parts[1].strip().strip('"'), parts[2], parts[3]
                        if msg_type == "state" and target and target in known_vms:
                            # state id: running, not_created, poweroff, saved, etc.
                            vms_by_name[target] = {"name": target, "state": data.strip()}
                # On Windows, Vagrant sometimes outputs machine-readable as one long line (space-separated
                # records). If we got no state entries above, split by record boundary (timestamp,).
                if len(vms_by_name) == 0 and raw.strip():
                    for chunk in re.split(r"(?=\d{10},)", raw):
                        chunk = chunk.strip()
                        if not chunk or not chunk[0].isdigit():
                            continue
                        parts = chunk.split(",", 3)
                        if len(parts) >= 4:
                            _ts, target, msg_type, data = parts[0], parts[1].strip().strip('"'), parts[2], parts[3]
                            if msg_type == "state" and target and target in known_vms:
                                vms_by_name[target] = {"name": target, "state": data.strip()}
        except subprocess.TimeoutExpired:
            # Machine-readable timed out, will use regular status
            machine_readable_worked = False
        except Exception as e:
            # Other error, will use regular status
            machine_readable_worked = False

        # Build list: use machine-readable results, then fill missing from human-readable
        vms = []
        missing = known_vms - set(vms_by_name)
        if missing and len(vms_by_name) > 0:
            # Some VMs missing from machine-readable; get them via per-VM status
            for name in sorted(missing):
                r2 = subprocess.run(
                    ["vagrant", "status", name],
                    cwd=str(VAGRANT_DIR),
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=10,
                )
                out = (r2.stdout or "") + (r2.stderr or "")
                state = ""
                for line in out.splitlines():
                    line = line.strip()
                    parts = line.split()
                    if len(parts) >= 2 and name == parts[0].strip('"'):
                        state = " ".join(parts[1:]).strip('"')
                        break
                vms_by_name[name] = {"name": name, "state": state or "unknown"}
        for name in sorted(known_vms):
            if name in vms_by_name:
                vms.append(vms_by_name[name])

        # If machine-readable gave nothing useful or timed out, fall back to regular status
        vagrant_status_ok = False
        if len(vms) == 0 or not machine_readable_worked:
            try:
                r = subprocess.run(
                    ["vagrant", "status"],
                    cwd=str(VAGRANT_DIR),
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=30,  # Increased timeout to 30 seconds
                )
                raw = (r.stdout or "") + (r.stderr or "")
                vagrant_status_ok = (r.returncode == 0)  # Track if vagrant succeeded
                vms = []
                for line in raw.splitlines():
                    line = line.strip()
                    parts = line.split()
                    if len(parts) >= 2 and not line.startswith("Current") and "machine" not in line.lower():
                        name = parts[0].strip('"')
                        state = " ".join(parts[1:]).strip('"') if len(parts) > 1 else ""
                        if name in known_vms:
                            vms.append({"name": name, "state": state})
            except subprocess.TimeoutExpired:
                # If vagrant status times out, use VirtualBox as fallback
                raw = "Vagrant status timed out, using VirtualBox status"
                vagrant_status_ok = False  # We used fallback, so not from vagrant
                vbox_running = _vbox_running_machine_names()
                vms = []
                for name in sorted(known_vms):
                    if name in vbox_running:
                        vms.append({"name": name, "state": "running"})
                    else:
                        vms.append({"name": name, "state": "not created"})

        # Normalize state for display: machine-readable uses "not_created", UI expects "not created"
        for vm in vms:
            s = (vm.get("state") or "").replace("_", " ")
            vm["state"] = s

        # Use VirtualBox as a source of truth when Vagrant metadata is out of sync:
        # - If VBox says a VM is running, show "Running" even if Vagrant reports "not created".
        # - If VBox has a VM (powered off) but Vagrant reports "not created", show "Stopped" instead.
        _apply_vbox_running_fallback(vms)
        _apply_vbox_existing_fallback(vms)

        if include_provisioning and vms:
            try:
                import cli
                orig_cwd = os.getcwd()
                os.chdir(str(VAGRANT_DIR))
                running = [v for v in vms if "running" in (v.get("state") or "").lower()]
                if running:
                    def check_one(name):
                        return cli.check_provisioning_status_with_reason(name)
                    # Use 2 concurrent workers with timeout wrapper to prevent hanging
                    # Each check can take up to 120s (SSH timeout), so 2 concurrent = ~2min per batch
                    with ThreadPoolExecutor(max_workers=2) as executor:
                        name_to_result = {}
                        futures = {executor.submit(check_one, v["name"]): v for v in running}
                        for future in as_completed(futures):
                            vm = futures[future]
                            try:
                                # Add timeout wrapper: 150s per check (120s SSH + 30s buffer)
                                # This prevents the whole request from hanging if SSH is very slow
                                name_to_result[vm["name"]] = future.result(timeout=150)
                            except FutureTimeoutError:
                                # Future timed out - the provisioning check took too long
                                name_to_result[vm["name"]] = {"status": "timeout", "reason": "Check timed out (took longer than 150s)"}
                            except Exception as e:
                                # Other error during check
                                error_msg = str(e)[:50] if str(e) else "Check failed"
                                name_to_result[vm["name"]] = {"status": None, "reason": f"Check failed: {error_msg}"}
                        for v in running:
                            res = name_to_result.get(v["name"]) or {}
                            v["provisioning"] = res.get("status")
                            v["provisioning_reason"] = res.get("reason")
                for vm in vms:
                    if "provisioning" not in vm:
                        vm["provisioning"] = None
                    if "provisioning_reason" not in vm:
                        vm["provisioning_reason"] = None
                os.chdir(orig_cwd)
            except Exception:
                for vm in vms:
                    if "provisioning" not in vm:
                        vm["provisioning"] = None
                    if "provisioning_reason" not in vm:
                        vm["provisioning_reason"] = None

        # Determine if we got successful results (either from vagrant or VirtualBox fallback)
        # Success if we got any VMs (from machine-readable or fallback) or vagrant reported OK
        ok = len(vms) > 0 or vagrant_status_ok
        return {"ok": ok, "vms": vms, "raw": raw}
    except FileNotFoundError:
        return {"ok": False, "vms": [], "raw": "Vagrant not found."}
    except Exception as e:
        return {"ok": False, "vms": [], "raw": str(e)}


KNOWN_VM_NAMES = set(KNOWN_VM_NAMES_LIST)


def get_provisioning(host: str):
    """Return {name, provisioning, provisioning_reason?} for one VM. Used for progressive status loading."""
    if host not in KNOWN_VM_NAMES:
        return {"name": host, "provisioning": None, "provisioning_reason": None}
    if not (VAGRANT_DIR / "Vagrantfile").exists():
        return {"name": host, "provisioning": None, "provisioning_reason": None}
    try:
        import cli
        orig_cwd = os.getcwd()
        os.chdir(str(VAGRANT_DIR))
        try:
            res = cli.check_provisioning_status_with_reason(host)
            return {
                "name": host,
                "provisioning": res.get("status"),
                "provisioning_reason": res.get("reason"),
            }
        finally:
            os.chdir(orig_cwd)
    except Exception:
        return {"name": host, "provisioning": None, "provisioning_reason": None}


def run_action(preset: str, action: str, run_async: bool = True):
    """Run up, halt, destroy, or reprovision for preset. Returns (success, stdout, stderr). run_async only applies to action 'up'."""
    if action not in ("up", "halt", "destroy", "reprovision"):
        return False, "", "Invalid action"
    if action == "up":
        args = [action, "--preset", preset]
        if run_async:
            args.append("--async")
        return _run_cli(*args, timeout=2700)
    if action == "reprovision":
        return _run_cli("reprovision", "--preset", preset, timeout=2700)
    return _run_cli(action, "--preset", preset, timeout=600)


def run_action_streaming(preset: str, action: str, run_async: bool = True):
    """
    Run up, halt, destroy, or reprovision for preset; yield (line, None) for each output line,
    then (None, returncode). run_async only applies to action 'up'.
    """
    if action not in ("up", "halt", "destroy", "reprovision"):
        yield ("Invalid action", None)
        yield (None, -1)
        return
    # "up" and "reprovision" can take 15–30+ min; use 45 min so it's not killed mid-run
    timeout = 2700 if action in ("up", "reprovision") else 600
    args = [action, "--preset", preset]
    if action == "up" and run_async:
        args.append("--async")
    for item in _run_cli_streaming(*args, timeout=timeout):
        yield item
