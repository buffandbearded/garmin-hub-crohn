"""Crohn's symptoms, labs, lifting sets and joint-pain endpoints (kept separate from app.py)."""
from pathlib import Path
import datetime

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from db import connect

bp = Blueprint("extra", __name__)


def rows(sql, args=()):
    con = connect()
    out = [dict(r) for r in con.execute(sql, args).fetchall()]
    con.close()
    return out


def _save(table, fields, b, key="id"):
    vals = [b.get(f) for f in fields]
    con = connect()
    if table == "symptoms":
        cols = ",".join(fields)
        upd = ",".join(f"{f}=excluded.{f}" for f in fields if f != "date")
        con.execute(f"INSERT INTO symptoms({cols}) VALUES ({','.join('?' for _ in fields)}) "
                    f"ON CONFLICT(date) DO UPDATE SET {upd}", vals)
    elif b.get(key):
        con.execute(f"UPDATE {table} SET {','.join(f + '=?' for f in fields)} WHERE {key}=?", vals + [b[key]])
    else:
        con.execute(f"INSERT INTO {table}({','.join(fields)}) VALUES ({','.join('?' for _ in fields)})", vals)
    con.commit()
    con.close()


SYMPTOM_FIELDS = ["date", "wellbeing", "stools", "liquid", "pain", "urgency", "fatigue",
                  "blood", "night", "fever", "joints", "notes"]
LAB_FIELDS = ["date", "marker", "value", "unit", "note"]
PAIN_FIELDS = ["date", "joint", "level", "exercise", "notes"]


@bp.route("/api/extra")
def extra():
    """Crohn's symptoms, labs, lifting sets and joint pain in one call."""
    return jsonify(
        symptoms=rows("SELECT * FROM symptoms ORDER BY date"),
        labs=rows("SELECT * FROM labs ORDER BY date, id"),
        sets=rows("SELECT * FROM sets ORDER BY date, id"),
        pain=rows("SELECT * FROM painlog ORDER BY date, id"),
        intake=rows("SELECT * FROM intake ORDER BY date"),
        infusions=rows("SELECT * FROM infusions ORDER BY date, id"),
    )


@bp.route("/api/intake/add", methods=["POST"])
def intake_add():
    """Add caffeine (mg) and water (ml) on top of what is logged for the day."""
    b = request.get_json(force=True)
    day = b.get("date") or datetime.date.today().isoformat()
    caf, water = int(b.get("caffeine_mg") or 0), int(b.get("water_ml") or 0)
    con = connect()
    con.execute("INSERT INTO intake(date, caffeine_mg, water_ml, drinks) VALUES (?,?,?,?) ON CONFLICT(date) DO UPDATE SET "
                "caffeine_mg=MAX(0, caffeine_mg+excluded.caffeine_mg), water_ml=MAX(0, water_ml+excluded.water_ml), drinks=MAX(0, drinks+excluded.drinks)",
                (day, caf, water, 1 if caf > 0 else 0))
    con.commit()
    con.close()
    return jsonify(ok=True)


@bp.route("/api/infusions", methods=["POST"])
def infusion_add():
    b = request.get_json(force=True)
    if not b.get("date"):
        return jsonify(error="Date is required.")
    _save("infusions", ["date", "drug", "dose", "notes"], b)
    return jsonify(ok=True)


@bp.route("/api/infusions/<int:i>", methods=["DELETE"])
def infusion_del(i):
    con = connect()
    con.execute("DELETE FROM infusions WHERE id=?", (i,))
    con.commit()
    con.close()
    return jsonify(ok=True)


@bp.route("/api/symptoms", methods=["POST"])
def symptoms_save():
    _save("symptoms", SYMPTOM_FIELDS, request.get_json(force=True))
    return jsonify(ok=True)


@bp.route("/api/symptoms/<day>", methods=["DELETE"])
def symptoms_delete(day):
    con = connect()
    con.execute("DELETE FROM symptoms WHERE date=?", (day,))
    con.commit()
    return jsonify(ok=True)


@bp.route("/api/labs", methods=["POST"])
def labs_save():
    _save("labs", LAB_FIELDS, request.get_json(force=True))
    return jsonify(ok=True)


@bp.route("/api/labs/<int:i>", methods=["DELETE"])
def labs_delete(i):
    con = connect()
    con.execute("DELETE FROM labs WHERE id=?", (i,))
    con.commit()
    return jsonify(ok=True)


@bp.route("/api/pain", methods=["POST"])
def pain_save():
    _save("painlog", PAIN_FIELDS, request.get_json(force=True))
    return jsonify(ok=True)


@bp.route("/api/pain/<int:i>", methods=["DELETE"])
def pain_delete(i):
    con = connect()
    con.execute("DELETE FROM painlog WHERE id=?", (i,))
    con.commit()
    return jsonify(ok=True)


@bp.route("/api/sets", methods=["POST"])
def sets_save():
    """Body: {date, session, sets:[{exercise,set_no,weight,reps,rir}, ...]} (replaces that session+exercise rows for the date)."""
    b = request.get_json(force=True)
    con = connect()
    for exid in {s["exercise"] for s in b.get("sets", [])}:
        con.execute("DELETE FROM sets WHERE date=? AND exercise=?", (b["date"], exid))
    for s in b.get("sets", []):
        con.execute("INSERT INTO sets(date, session, exercise, set_no, weight, reps, rir) VALUES (?,?,?,?,?,?,?)",
                    (b["date"], b.get("session"), s["exercise"], s.get("set_no"), s.get("weight"), s.get("reps"), s.get("rir")))
    con.commit()
    return jsonify(ok=True)


@bp.route("/api/sets/<date>/<exercise>", methods=["DELETE"])
def sets_delete(date, exercise):
    con = connect()
    con.execute("DELETE FROM sets WHERE date=? AND exercise=?", (date, exercise))
    con.commit()
    return jsonify(ok=True)


UPLOADS = Path(__file__).parent / "lab_uploads"


@bp.route("/api/labs/scan", methods=["POST"])
def labs_scan():
    """Read a lab report (PDF / photo / pasted text) and return proposed results. Saves nothing to the database."""
    import labparse
    try:
        f = request.files.get("file")
        if f and f.filename:
            data = f.read()
            UPLOADS.mkdir(exist_ok=True)
            (UPLOADS / f"{datetime.date.today()}_{secure_filename(f.filename) or 'upload'}").write_bytes(data)
            res = labparse.scan(data=data, filename=f.filename)
        elif request.form.get("text", "").strip():
            res = labparse.scan(text=request.form["text"])
        else:
            return jsonify(error="Choose a file or paste the text first.")
        return jsonify(res)
    except RuntimeError as e:
        return jsonify(error=str(e))
    except Exception as e:  # unreadable or corrupt file
        return jsonify(error=f"Could not read that file ({type(e).__name__}). Try pasting the text instead.")
