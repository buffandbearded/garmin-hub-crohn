import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "hub.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS daily (
  date TEXT PRIMARY KEY,
  steps INTEGER, kcal_total INTEGER, kcal_active INTEGER, kcal_resting INTEGER,
  rhr INTEGER, stress_avg INTEGER, bb_high INTEGER, bb_low INTEGER,
  sleep_sec INTEGER, deep_sec INTEGER, light_sec INTEGER, rem_sec INTEGER, awake_sec INTEGER,
  sleep_score INTEGER, hrv_avg INTEGER, hrv_status TEXT,
  weight_kg REAL, body_fat REAL, muscle_kg REAL, kcal_consumed INTEGER
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY, date TEXT, name TEXT, type TEXT,
  duration_min REAL, distance_km REAL, kcal INTEGER, avg_hr INTEGER, max_hr INTEGER,
  load REAL, aerobic_te REAL, anaerobic_te REAL
);
CREATE TABLE IF NOT EXISTS manual (
  date TEXT PRIMARY KEY, weight_kg REAL, kcal_in INTEGER, protein_g INTEGER, waist_cm REAL
);
CREATE TABLE IF NOT EXISTS meds (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, dose TEXT, schedule TEXT, started TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS foodlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT, time TEXT, meal TEXT, foods TEXT, recipe TEXT,
  gluten INTEGER, lactose INTEGER,
  reaction INTEGER,          -- 0 none, 1 mild, 2 bad (your own judgement); NULL = not rated yet
  pain INTEGER, bloating INTEGER, nausea INTEGER, toilet INTEGER,
  blood INTEGER, notes TEXT
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS symptoms (
  date TEXT PRIMARY KEY,
  wellbeing INTEGER,          -- 0 very well .. 4 terrible (Harvey-Bradshaw wording)
  stools INTEGER, liquid INTEGER,
  pain INTEGER, urgency INTEGER, fatigue INTEGER,   -- 0-10
  blood INTEGER, night INTEGER, fever INTEGER, joints INTEGER, notes TEXT
);
CREATE TABLE IF NOT EXISTS labs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, marker TEXT, value REAL, unit TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, session TEXT, exercise TEXT,
  set_no INTEGER, weight REAL, reps INTEGER, rir INTEGER
);
CREATE TABLE IF NOT EXISTS intake (
  date TEXT PRIMARY KEY, caffeine_mg INTEGER DEFAULT 0, water_ml INTEGER DEFAULT 0, drinks INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS infusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, drug TEXT, dose TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS painlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, joint TEXT, level INTEGER, exercise TEXT, notes TEXT
);
"""

# Placeholders you can change on the Plan tab: sleep_target_h, workouts_per_week, meals_per_day,
# fat_pct, protein_g_per_kg.
DEFAULT_SETTINGS = {
    "target_weight": "100",
    "height_cm": "175",
    "pace_kg_week": "0.7",
    "protein_g_per_kg": "2.0",
    "fat_pct": "25",
    "meals_per_day": "5",
    "sleep_target_h": "8",
    "workouts_per_week": "4",
    "lift_ramp": "1",           # 1 = treat me as returning after a break (3-week ramp)
    "crohn_meds": "",
    "crohn_mre": "",
    "crohn_scopes": "",
    "crohn_notes": "",
    "infusion_weeks": "8",
    "autosync": "1",
    "autosync_hours": "6",
}


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    # migrate older databases
    cols = [r[1] for r in con.execute("PRAGMA table_info(manual)")]
    if "waist_cm" not in cols:
        con.execute("ALTER TABLE manual ADD COLUMN waist_cm REAL")
    for k, v in DEFAULT_SETTINGS.items():
        con.execute("INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", (k, v))
    # one-time switch from the old placeholder goals (75 kg etc.) to the real ones
    if not con.execute("SELECT 1 FROM settings WHERE key='goals_v2'").fetchone():
        for k in ("target_weight", "height_cm", "pace_kg_week", "protein_g_per_kg", "fat_pct", "meals_per_day"):
            con.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (k, DEFAULT_SETTINGS[k]))
        con.execute("INSERT INTO settings(key, value) VALUES ('goals_v2', '1')")
    # keep a copy of settings that may have been added in newer versions (INSERT OR IGNORE above handles it)
    con.commit()
    return con


def upsert(con, table, row, key="date"):
    cols = list(row)
    placeholders = ",".join("?" for _ in cols)
    updates = ",".join(f"{c}=COALESCE(excluded.{c}, {table}.{c})" for c in cols if c != key)
    con.execute(
        f"INSERT INTO {table}({','.join(cols)}) VALUES ({placeholders}) "
        f"ON CONFLICT({key}) DO UPDATE SET {updates}",
        [row[c] for c in cols],
    )
