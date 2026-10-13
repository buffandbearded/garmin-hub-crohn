"""Per-activity detail (GPS track, HR / pace / elevation series, splits, HR zones), fetched from Garmin on demand
and cached in hub.db so each activity is only downloaded once.

The raw Garmin responses are also kept in activity_cache/<id>.json so the parsing can be tuned without re-downloading.
"""
import json
import math
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request

from db import connect

bp = Blueprint("activity", __name__)
CACHE = Path(__file__).parent / "activity_cache"
TOKEN_DIR = str(Path.home() / ".garminconnect")
_client = None

SCHEMA = "CREATE TABLE IF NOT EXISTS act_detail (id INTEGER PRIMARY KEY, data TEXT, fetched TEXT)"


# ---------------------------------------------------------------- Garmin access
def _login():
    """Log in with the cached tokens only. Never prompts (this runs inside the web server)."""
    global _client
    if _client is not None:
        return _client
    from garminconnect import Garmin
    try:
        g = Garmin()
        g.login(TOKEN_DIR)
    except Exception:
        raise RuntimeError("Not logged in to Garmin. Open a terminal in the hub folder, run  .venv\\Scripts\\python sync.py --days 3  once to sign in (it asks for your Garmin email and password and remembers the login), then try again.")
    _client = g
    return g


def _try(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except Exception as e:  # one failing endpoint should not lose the rest
        print(f"  ! {getattr(fn, '__name__', fn)} failed: {e}")
        return None


def fetch_raw(aid):
    g = _login()
    raw = {
        "summary": _try(g.get_activity, aid),
        "details": _try(g.get_activity_details, aid, maxchart=2000, maxpoly=4000),
        "splits": _try(g.get_activity_splits, aid),
        "zones": _try(g.get_activity_hr_in_timezones, aid),
    }
    if hasattr(g, "get_activity_exercise_sets"):
        raw["sets"] = _try(g.get_activity_exercise_sets, aid)
    if not any(raw.values()):
        raise RuntimeError("Garmin returned nothing for this activity (check your internet connection or sign-in).")
    return raw


# ---------------------------------------------------------------- reduction
def _num(v):
    return v if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)) else None


def _get(d, *path):
    for p in path:
        if not isinstance(d, dict):
            return None
        d = d.get(p)
    return d


def _thin(seq, n):
    if len(seq) <= n:
        return list(range(len(seq)))
    step = len(seq) / n
    idx = sorted({int(i * step) for i in range(n)} | {len(seq) - 1})
    return idx


def _series(details):
    """Column arrays from Garmin's metricDescriptors + activityDetailMetrics."""
    if not isinstance(details, dict):
        return {}
    keys = {d.get("key"): d.get("metricsIndex") for d in details.get("metricDescriptors") or []}
    rows = [r.get("metrics") or [] for r in details.get("activityDetailMetrics") or []]
    if not rows:
        return {}

    def col(*names):
        for n in names:
            i = keys.get(n)
            if i is not None:
                vals = [_num(r[i]) if i < len(r) else None for r in rows]
                if any(v is not None for v in vals):
                    return vals
        return None

    cols = {
        "ts": col("directTimestamp"),
        "elapsed": col("sumElapsedDuration", "sumDuration"),
        "dist": col("sumDistance"),
        "hr": col("directHeartRate"),
        "speed": col("directSpeed"),
        "elev": col("directElevation"),
        "cad": col("directRunCadence", "directBikeCadence", "directDoubleCadence"),
        "power": col("directPower"),
        "temp": col("directAirTemperature"),
    }
    cols = {k: v for k, v in cols.items() if v}
    n = len(rows)
    # time axis in seconds from the start
    if "ts" in cols:
        t0 = next((v for v in cols["ts"] if v is not None), 0)
        t = [None if v is None else (v - t0) / 1000.0 for v in cols["ts"]]
    elif "elapsed" in cols:
        t = cols["elapsed"]
    else:
        t = list(range(n))
    out = {"t": t, "_ts": cols.get("ts")}
    for k in ("dist", "hr", "speed", "elev", "cad", "power", "temp"):
        if k in cols:
            out[k] = cols[k]
    return out


def _round(v, d):
    return None if v is None else round(v, d)


def _reduce_series(s, max_points=700):
    if not s:
        return {}, []
    n = len(s["t"])
    idx = _thin(s["t"], max_points)
    out = {}
    for k, vals in s.items():
        if k == "_ts":
            continue
        dec = 3 if k in ("speed",) else (1 if k in ("t", "elev", "dist") else 0)
        out[k] = [_round(vals[i], dec) for i in idx]
    ts = [s["_ts"][i] for i in idx] if s.get("_ts") else None
    return out, ts


def _poly(details, series_raw, max_points=1200):
    """GPS points [lat, lon, hr, speed, elev] (hr/speed borrowed from the nearest series sample)."""
    pl = _get(details, "geoPolylineDTO", "polyline") if isinstance(details, dict) else None
    pts = [p for p in (pl or []) if isinstance(p, dict) and _num(p.get("lat")) is not None and _num(p.get("lon")) is not None]
    if not pts:
        return []
    idx = _thin(pts, max_points)
    pts = [pts[i] for i in idx]
    ts = (series_raw or {}).get("_ts")
    hr = (series_raw or {}).get("hr")
    sp = (series_raw or {}).get("speed")
    out = []
    j = 0
    for p in pts:
        h = s = None
        if ts and (hr or sp) and _num(p.get("time")) is not None:
            while j + 1 < len(ts) and (ts[j + 1] is None or ts[j + 1] <= p["time"]):
                j += 1
            h = hr[j] if hr else None
            s = sp[j] if sp else None
        if s is None:
            s = _num(p.get("speed"))
        out.append([round(p["lat"], 6), round(p["lon"], 6), _round(h, 0), _round(s, 3),
                    _round(_num(p.get("altitude")), 1), p.get("time")])
    return out


def _summary(raw):
    s = raw.get("summary") or {}
    d = s.get("summaryDTO") or {}
    keys = {
        "distance_m": "distance", "duration_s": "duration", "moving_s": "movingDuration",
        "avg_speed": "averageSpeed", "max_speed": "maxSpeed", "avg_hr": "averageHR", "max_hr": "maxHR",
        "min_hr": "minHR", "kcal": "calories", "gain": "elevationGain", "loss": "elevationLoss",
        "min_elev": "minElevation", "max_elev": "maxElevation", "avg_cad": "averageRunCadence",
        "max_cad": "maxRunCadence", "avg_bike_cad": "averageBikeCadence", "avg_power": "averagePower",
        "max_power": "maxPower", "norm_power": "normalizedPower", "aerobic_te": "trainingEffect",
        "anaerobic_te": "anaerobicTrainingEffect", "load": "activityTrainingLoad", "stride": "strideLength",
        "min_temp": "minTemperature", "max_temp": "maxTemperature", "vo2max": "vO2MaxValue",
        "avg_resp": "avgRespirationRate", "water_ml": "waterEstimated", "steps": "steps",
        "te_label": "trainingEffectLabel",
    }
    out = {k: d.get(v) for k, v in keys.items() if d.get(v) is not None}
    return out


def _splits(raw):
    laps = _get(raw.get("splits"), "lapDTOs") or []
    out = []
    for i, l in enumerate(laps):
        if not isinstance(l, dict):
            continue
        out.append({
            "n": i + 1, "dist": _round(_num(l.get("distance")), 1), "dur": _round(_num(l.get("duration")), 1),
            "speed": _round(_num(l.get("averageSpeed")), 3), "hr": _round(_num(l.get("averageHR")), 0),
            "gain": _round(_num(l.get("elevationGain")), 0), "loss": _round(_num(l.get("elevationLoss")), 0),
            "cad": _round(_num(l.get("averageRunCadence")), 0),
        })
    return out


def _zones(raw):
    z = raw.get("zones")
    out = []
    if isinstance(z, list):
        for r in z:
            if isinstance(r, dict) and _num(r.get("zoneNumber")) is not None:
                out.append({"zone": int(r["zoneNumber"]), "secs": _num(r.get("secsInZone")) or 0,
                            "low": _num(r.get("zoneLowBoundary"))})
    return sorted(out, key=lambda r: r["zone"])


def _sets(raw):
    sets = _get(raw.get("sets"), "exerciseSets") or []
    out = []
    for s in sets:
        if not isinstance(s, dict) or s.get("setType") == "REST":
            continue
        ex = (s.get("exercises") or [{}])[0] or {}
        out.append({"name": ex.get("name") or ex.get("category"), "reps": _num(s.get("repetitionCount")),
                    "weight": _round(_num(s.get("weight")) / 1000, 1) if _num(s.get("weight")) is not None else None,
                    "dur": _round(_num(s.get("duration")), 0)})
    return out


def reduce(aid, raw):
    s = raw.get("summary") or {}
    series_raw = _series(raw.get("details"))
    series, _ts = _reduce_series(series_raw)
    poly = _poly(raw.get("details"), series_raw)
    return {
        "id": aid,
        "name": s.get("activityName"),
        "type": _get(s, "activityTypeDTO", "typeKey"),
        "start": _get(s, "summaryDTO", "startTimeLocal") or s.get("startTimeLocal"),
        "summary": _summary(raw),
        "series": series,
        "series_ts": _ts,
        "poly": poly,
        "splits": _splits(raw),
        "zones": _zones(raw),
        "sets": _sets(raw),
    }


# ---------------------------------------------------------------- routes
@bp.route("/api/activity/<int:aid>")
def activity(aid):
    refresh = request.args.get("refresh") == "1"
    con = connect()
    con.execute(SCHEMA)
    row = None if refresh else con.execute("SELECT data FROM act_detail WHERE id=?", (aid,)).fetchone()
    if row:
        con.close()
        return jsonify(json.loads(row["data"]))
    try:
        raw = fetch_raw(aid)
        CACHE.mkdir(exist_ok=True)
        (CACHE / f"{aid}.json").write_text(json.dumps(raw), encoding="utf-8")
        res = reduce(aid, raw)
    except RuntimeError as e:
        con.close()
        return jsonify(error=str(e))
    except Exception as e:
        con.close()
        return jsonify(error=f"Could not load this activity ({type(e).__name__}: {e}).")
    con.execute("INSERT OR REPLACE INTO act_detail(id, data, fetched) VALUES (?,?,?)",
                (aid, json.dumps(res), datetime.now().isoformat(timespec="seconds")))
    con.commit()
    con.close()
    return jsonify(res)
