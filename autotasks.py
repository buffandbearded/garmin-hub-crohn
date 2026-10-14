"""Background chores that keep the hub tidy without you pressing buttons:
  - automatic Garmin sync (a few recent days, every N hours, only when you are already signed in)
  - a daily backup of hub.db, keeping the newest 14 copies (set a folder in a cloud-synced directory to also get an off-site copy)

Both run in a small background thread while the hub is open. Status and controls live on the Insights tab.
"""
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

from flask import Blueprint, jsonify, request

from db import DB_PATH, connect

bp = Blueprint("auto", __name__)
ROOT = Path(__file__).parent
TOKENS = Path.home() / ".garminconnect"
KEEP = 14
_lock = threading.Lock()


def _get(key, default=""):
    try:
        con = connect()
        row = con.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        con.close()
        return row["value"] if row and row["value"] is not None else default
    except Exception:
        return default


def _put(**kv):
    con = connect()
    for k, v in kv.items():
        con.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?,?)", (k, str(v)))
    con.commit()
    con.close()


def backup_dir():
    d = _get("backup_dir", "").strip()
    return Path(d) if d else ROOT / "backups"


def do_backup():
    """Copy the database safely (SQLite backup API, fine while the hub is running). Returns the file written."""
    folder = backup_dir()
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / f"hub_{datetime.now():%Y-%m-%d_%H%M}.db"
    src = sqlite3.connect(DB_PATH)
    dst = sqlite3.connect(dest)
    with dst:
        src.backup(dst)
    dst.close()
    src.close()
    copies = sorted(folder.glob("hub_*.db"))
    for old in copies[:-KEEP]:
        try:
            old.unlink()
        except OSError:
            pass
    _put(last_backup=datetime.now().isoformat(timespec="seconds"), last_backup_file=str(dest), last_backup_error="")
    return dest


def do_sync(days=3):
    """Run sync.py for the last few days. Returns (ok, text)."""
    with _lock:
        r = subprocess.run([sys.executable, str(ROOT / "sync.py"), "--days", str(days)], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=900, cwd=ROOT, stdin=subprocess.DEVNULL)
        ok = r.returncode == 0
        _put(last_sync=datetime.now().isoformat(timespec="seconds"), last_sync_ok="1" if ok else "0",
             last_sync_msg=(r.stdout + r.stderr)[-300:] if not ok else "")
        return ok, (r.stdout + r.stderr)[-1500:]


def _age_hours(iso):
    try:
        return (datetime.now() - datetime.fromisoformat(iso)).total_seconds() / 3600
    except Exception:
        return 1e9


def tick():
    # backup once a day
    if _age_hours(_get("last_backup", "")) >= 24:
        try:
            do_backup()
        except Exception as e:
            _put(last_backup_error=f"{type(e).__name__}: {e}"[:200])
    # sync every N hours, only if signed in and enabled
    if _get("autosync", "1") == "1" and TOKENS.exists():
        hours = max(1, float(_get("autosync_hours", "6") or 6))
        if _age_hours(_get("last_sync", "")) >= hours:
            try:
                do_sync(3)
            except Exception as e:
                _put(last_sync=datetime.now().isoformat(timespec="seconds"), last_sync_ok="0", last_sync_msg=f"{type(e).__name__}: {e}"[:200])


def _loop():
    time.sleep(20)          # let the hub finish starting
    while True:
        try:
            tick()
        except Exception:
            pass
        time.sleep(15 * 60)


def start_background():
    threading.Thread(target=_loop, daemon=True, name="hub-auto").start()


@bp.route("/api/system")
def system():
    folder = backup_dir()
    copies = sorted(folder.glob("hub_*.db")) if folder.exists() else []
    return jsonify(autosync=_get("autosync", "1") == "1", autosync_hours=_get("autosync_hours", "6"),
                   signed_in=TOKENS.exists(), last_sync=_get("last_sync"), last_sync_ok=_get("last_sync_ok"), last_sync_msg=_get("last_sync_msg"),
                   backup_dir=str(folder), custom_dir=bool(_get("backup_dir", "").strip()), last_backup=_get("last_backup"),
                   last_backup_file=_get("last_backup_file"), last_backup_error=_get("last_backup_error"), copies=len(copies))


@bp.route("/api/system/backup", methods=["POST"])
def backup_now():
    try:
        f = do_backup()
        return jsonify(ok=True, file=str(f))
    except Exception as e:
        _put(last_backup_error=f"{type(e).__name__}: {e}"[:200])
        return jsonify(ok=False, error=f"Could not write the backup: {e}")


@bp.route("/api/system/sync", methods=["POST"])
def sync_now():
    try:
        ok, out = do_sync(int(request.args.get("days", 3)))
        return jsonify(ok=ok, output=out)
    except Exception as e:
        return jsonify(ok=False, output=str(e))
