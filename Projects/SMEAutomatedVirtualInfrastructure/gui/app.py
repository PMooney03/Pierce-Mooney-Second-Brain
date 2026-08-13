"""
Flask app for SME Starter Infrastructure GUI.
Run from project root; access at http://127.0.0.1:5051
"""
import json
import os
import sys
import traceback
from functools import wraps
from pathlib import Path
from shutil import copyfile

from flask import (
    Flask,
    Response,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    stream_with_context,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

from gui.logic import get_prerequisites, get_presets, get_status, get_provisioning, run_action_streaming

APP_DIR = Path(__file__).resolve().parent
# Error traceback saved here on 500 (project root, next to cli.py)
LAST_ERROR_FILE = APP_DIR.parent / "last_error.txt"
app = Flask(__name__, static_folder=str(APP_DIR / "static"), template_folder=str(APP_DIR / "templates"))

# Basic session secret so we can keep users logged in.
# For local/dev use only; override with SME_GUI_SECRET env var in production.
app.secret_key = os.environ.get("SME_GUI_SECRET", "dev-change-me")

# GUI-managed auth store. Keep this writable so "Manage users" can create accounts.
USERS_PATH = APP_DIR / "users.json"
USERS_TEMPLATE_PATH = APP_DIR / "users.example.json"
USERS_READONLY = False

# Roles: "admin" = full access (dashboard + start/halt/destroy); "user" = dashboard only (view status, no actions)
VALID_ROLES = ("admin", "user")


def _ensure_users_file():
    """Create gui/users.json from the tracked example file on first run."""
    if USERS_PATH.exists():
        return
    try:
        if USERS_TEMPLATE_PATH.exists():
            copyfile(USERS_TEMPLATE_PATH, USERS_PATH)
            return

        default = {
            "users": [
                {
                    "username": "admin",
                    "password": generate_password_hash("admin"),
                    "role": "admin",
                }
            ]
        }
        with open(USERS_PATH, "w", encoding="utf-8") as f:
            json.dump(default, f, indent=2)
            f.write("\n")
    except OSError:
        pass


_ensure_users_file()


def _password_is_hashed(pw):
    return isinstance(pw, str) and (pw.startswith("scrypt:") or pw.startswith("pbkdf2:"))


def load_users():
    """Load user store from users.json. Passwords should be stored hashed; plain text is migrated on first login."""
    try:
        with open(USERS_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}
    users = {}
    for u in data.get("users", []):
        if not isinstance(u, dict):
            continue
        username = u.get("username")
        if username and u.get("role") in VALID_ROLES:
            users[username] = dict(u)
    return users


def save_users(users_list):
    """Persist user list to users.json. Each item must have username, password (hashed), role."""
    try:
        data = {"users": users_list}
        with open(USERS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    except OSError as e:
        raise RuntimeError(f"Cannot write users.json: {e}") from e


def verify_user(username, password):
    """
    Verify credentials. Returns (user_dict, None) on success with role; (None, error_msg) on failure.
    Migrates plain-text passwords to hashed on successful login.
    """
    username = (username or "").strip()
    password = password or ""
    users = load_users()
    user = users.get(username)
    if not user:
        return None, "Invalid username or password"
    stored = user.get("password") or ""
    if _password_is_hashed(stored):
        if not check_password_hash(stored, password):
            return None, "Invalid username or password"
    else:
        if stored != password:
            return None, "Invalid username or password"
        # Migrate to hashed and persist (skip when using Ansible-generated file)
        if not USERS_READONLY:
            user_list = list(load_users().values())
            for i, u in enumerate(user_list):
                if u.get("username") == username:
                    user_list[i] = {**u, "password": generate_password_hash(password)}
                    break
            save_users(user_list)
    return {"username": username, "role": user.get("role") or "user"}, None


def _safe_session_user():
    """Return session.get('user') or None. On bad cookie/session error, clear and return None (avoids 500)."""
    try:
        return session.get("user")
    except Exception as e:
        print(f"SME GUI: session read failed (e.g. bad cookie), redirecting to login: {e}", file=sys.stderr)
        try:
            session.clear()
        except Exception:
            pass
        return None


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = _safe_session_user()
        if user is None:
            next_path = request.path if request.method == "GET" else url_for("dashboard")
            return redirect(url_for("login", next=next_path))
        return view(*args, **kwargs)

    return wrapped


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = _safe_session_user()
        if not user or user.get("role") != "admin":
            if request.path.startswith("/api/"):
                return jsonify({"success": False, "error": "Admin access required", "require_admin": True}), 403
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapped


def _write_last_error(tb):
    """Write traceback to last_error.txt (project root). Tries LAST_ERROR_FILE then cwd."""
    for path in (LAST_ERROR_FILE, Path(os.getcwd()) / "last_error.txt"):
        try:
            path = Path(path).resolve()
            path.write_text(tb, encoding="utf-8")
            print(f"SME GUI: traceback saved to {path}", file=sys.stderr)
            return str(path)
        except Exception as e:
            print(f"SME GUI: could not write {path}: {e}", file=sys.stderr)
    return None


def _error_response(err, is_api=False):
    """Return 500 with traceback as HTML or JSON. Never raises. Saves traceback to last_error.txt."""
    try:
        tb = "".join(traceback.format_exception(type(err), err, err.__traceback__))
    except Exception:
        tb = str(err) if err else "Unknown error"
    print("\n[SME GUI 500]", file=sys.stderr)
    print(tb, file=sys.stderr)
    _write_last_error(tb)
    try:
        err_str = str(err) if err else "Unknown error"
    except Exception:
        err_str = "Unknown error"
    if is_api:
        try:
            return jsonify({"success": False, "error": err_str, "traceback": tb}), 500
        except Exception:
            return (f'{{"success":false,"error":{json.dumps(err_str)},"traceback":{json.dumps(tb)}}}', 500, {"Content-Type": "application/json"})
    try:
        escaped = tb.replace("<", "&lt;").replace(">", "&gt;")
    except Exception:
        escaped = err_str
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Error</title></head><body>"
        "<h1>Internal Server Error</h1>"
        "<p>The error was saved to <strong>last_error.txt</strong> in the project root (same folder as cli.py). Open it and paste its contents to get help.</p>"
        "<pre style='white-space:pre-wrap;font-size:12px;'>"
        + escaped + "</pre><p><a href='/login'>Login</a></p></body></html>"
    )
    return html, 500


@app.route("/login", methods=["GET", "POST"])
def login():
    try:
        error = None
        next_url = request.args.get("next", "") if request.method == "GET" else (request.form.get("next") or "")
        if request.method == "POST":
            username = (request.form.get("username") or "").strip()
            password = request.form.get("password") or ""
            user_info, err = verify_user(username, password)
            if user_info:
                session["user"] = user_info
                next_url = next_url or url_for("dashboard")
                return redirect(next_url)
            error = err or "Invalid username or password"
        return render_template("login.html", error=error, next_url=next_url)
    except Exception as e:
        return _error_response(e, is_api=False)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/", methods=["GET", "POST"])
def index():
    """Root: show login page (GET) or process login (POST). No session read until after POST."""
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        next_url = request.form.get("next") or ""
        user_info, err = verify_user(username, password)
        if user_info:
            session["user"] = user_info
            return redirect(next_url or url_for("dashboard"))
        return render_template("login.html", error=err or "Invalid username or password", next_url=next_url)
    return render_template("login.html", error=None, next_url=request.args.get("next", ""))


@app.route("/dashboard")
@login_required
def dashboard():
    try:
        user = session.get("user") or {}
        username = user.get("username") or ""
        role = user.get("role") if user.get("role") in VALID_ROLES else "user"
        return render_template("index.html", username=username, role=role)
    except Exception as e:
        return _error_response(e, is_api=False)


@app.route("/presets")
@admin_required
def presets_page():
    """Admin-only page for configuration presets and quick actions."""
    user = session.get("user") or {}
    username = user.get("username") or ""
    role = user.get("role") if user.get("role") in VALID_ROLES else "user"
    return render_template("presets.html", username=username, role=role)


@app.route("/admin/users")
@admin_required
def admin_users():
    """Admin-only page for managing users and roles."""
    user = session.get("user") or {}
    username = user.get("username") or ""
    role = user.get("role") if user.get("role") in VALID_ROLES else "user"
    return render_template("admin_users.html", username=username, role=role)


@app.route("/api/prerequisites")
@login_required
def api_prerequisites():
    try:
        return jsonify(get_prerequisites())
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/presets")
@login_required
def api_presets():
    try:
        return jsonify(get_presets())
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/status")
@login_required
def api_status():
    try:
        include_provisioning = request.args.get("provisioning", "0").lower() in ("1", "true", "yes")
        return jsonify(get_status(include_provisioning=include_provisioning))
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/status/provisioning/<host>")
@login_required
def api_status_provisioning(host):
    try:
        return jsonify(get_provisioning(host))
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/me")
@login_required
def api_me():
    """Return current user for frontend (role so we can show/hide admin actions)."""
    try:
        user = session.get("user") or {}
        return jsonify({"username": user.get("username"), "role": user.get("role", "user")})
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/users", methods=["GET"])
@admin_required
def api_users_list():
    try:
        users = load_users()
        out = [{"username": u, "role": (users[u].get("role") or "user")} for u in users]
        return jsonify({"users": out})
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/users", methods=["POST"])
@admin_required
def api_users_create():
    try:
        data = request.get_json() or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        role = (data.get("role") or "user").lower()
        if role not in VALID_ROLES:
            role = "user"
        if not username:
            return jsonify({"success": False, "error": "Username is required"}), 400
        if len(username) < 2:
            return jsonify({"success": False, "error": "Username must be at least 2 characters"}), 400
        if not password:
            return jsonify({"success": False, "error": "Password is required"}), 400
        if len(password) < 2:
            return jsonify({"success": False, "error": "Password must be at least 2 characters"}), 400
        users = load_users()
        if username in users:
            return jsonify({"success": False, "error": "Username already exists"}), 400
        user_list = list(users.values())
        user_list.append({
            "username": username,
            "password": generate_password_hash(password),
            "role": role,
        })
        save_users(user_list)
        return jsonify({"success": True, "username": username, "role": role}), 201
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/users/<username>", methods=["PATCH"])
@admin_required
def api_users_update(username):
    try:
        username = (username or "").strip()
        if not username:
            return jsonify({"success": False, "error": "Username is required"}), 400
        data = request.get_json() or {}
        role = (data.get("role") or "").lower()
        if role not in VALID_ROLES:
            return jsonify({"success": False, "error": "Role must be admin or user"}), 400

        users = load_users()
        target = users.get(username)
        if not target:
            return jsonify({"success": False, "error": "User not found"}), 404

        current_role = (target.get("role") or "user").lower()
        if current_role == "admin" and role != "admin":
            admin_count = sum(1 for u in users.values() if (u.get("role") or "user").lower() == "admin")
            if admin_count <= 1:
                return jsonify({"success": False, "error": "Cannot demote the last admin"}), 400

        target["role"] = role
        save_users(list(users.values()))
        return jsonify({"success": True, "username": username, "role": role}), 200
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/users/<username>", methods=["DELETE"])
@admin_required
def api_users_delete(username):
    try:
        username = (username or "").strip()
        if not username:
            return jsonify({"success": False, "error": "Username is required"}), 400

        users = load_users()
        target = users.get(username)
        if not target:
            return jsonify({"success": False, "error": "User not found"}), 404

        current_user = _safe_session_user() or {}
        if username == (current_user.get("username") or ""):
            return jsonify({"success": False, "error": "You cannot delete your own active account"}), 400

        if (target.get("role") or "user").lower() == "admin":
            admin_count = sum(1 for u in users.values() if (u.get("role") or "user").lower() == "admin")
            if admin_count <= 1:
                return jsonify({"success": False, "error": "Cannot delete the last admin"}), 400

        updated_users = [u for u in users.values() if u.get("username") != username]
        save_users(updated_users)
        return jsonify({"success": True, "username": username}), 200
    except Exception as e:
        return _error_response(e, is_api=True)


@app.route("/api/action", methods=["POST"])
@admin_required
def api_action():
    data = request.get_json() or {}
    preset = data.get("preset", "minimal")
    action = data.get("action", "up")
    # run_async only applies to action "up"; accept "run_async" or "async", default True
    run_async = data.get("run_async", data.get("async", True))
    if not isinstance(run_async, bool):
        run_async = bool(run_async)
    if action not in ("up", "halt", "destroy", "reprovision"):
        return jsonify({"success": False, "stdout": "", "stderr": "Invalid action"}), 400

    def generate():
        for line, returncode in run_action_streaming(preset, action, run_async=run_async):
            if returncode is not None:
                yield "data: " + json.dumps({"type": "done", "success": returncode == 0}) + "\n\n"
            elif line == "\x00KEEPALIVE":
                # Send a data event so the UI can show "still running" during long gaps (e.g. importing box)
                yield "data: " + json.dumps({"type": "keepalive"}) + "\n\n"
            elif line is not None:
                yield "data: " + json.dumps({"type": "line", "text": line}) + "\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.errorhandler(500)
def handle_500(err):
    """Return a readable error page with traceback. Never raises."""
    return _error_response(err, is_api=_request_is_api())


def _request_is_api():
    """True if current request path is under /api/. Safe to call even outside request context."""
    try:
        return bool(request and request.path.startswith("/api/"))
    except Exception:
        return False


def run_server(host="127.0.0.1", port=5051, debug=None):
    _ensure_users_file()

    # Catch any exception before response is sent; return 200 with traceback so the browser shows the real error
    _wsgi = app.wsgi_app
    def _capture_errors(environ, start_response):
        try:
            return _wsgi(environ, start_response)
        except Exception as e:
            tb = "".join(traceback.format_exception(type(e), e, e.__traceback__))
            try:
                _write_last_error(tb)
            except Exception:
                pass
            body = ("<html><head><meta charset='utf-8'><title>Error</title></head><body><h1>Server error</h1>"
                    "<p>Copy the traceback below so we can fix it.</p><pre style='white-space:pre-wrap;font-size:11px;'>"
                    + tb.replace("<", "&lt;").replace(">", "&gt;") + "</pre></body></html>")
            body = body.encode("utf-8")
            start_response("200 OK", [("Content-Type", "text/html; charset=utf-8"), ("Content-Length", str(len(body)))])
            return [body]
    app.wsgi_app = _capture_errors

    if debug is None:
        debug = os.environ.get("SME_GUI_DEBUG", "").strip().lower() in ("1", "true", "yes")
    if debug:
        print("SME GUI: debug mode ON — tracebacks will show in the browser. Set SME_GUI_DEBUG=0 to disable.", file=sys.stderr)
    app.run(host=host, port=port, debug=debug, use_reloader=False)


if __name__ == "__main__":
    run_server()
