import subprocess
import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from db import connect
from extra_routes import bp as extra_bp
from activity_detail import bp as activity_bp
from meal_vision import bp as meal_bp

app = Flask(__name__, static_folder="static")
app.register_blueprint(extra_bp)
app.register_blueprint(activity_bp)
app.register_blueprint(meal_bp)
ROOT = Path(__file__).parent

# General reference only. Not medical advice: confirm anything that matters with your doctor/pharmacist.
MED_INFO = {
    "prednisone": {
        "label": "Prednisone / prednisolone (corticosteroid)",
        "training": [
            "Can promote muscle protein breakdown (steroid myopathy, mostly thighs/hips) with long or high-dose use, so progress on lifts may be slower and lower-body weakness is worth watching.",
            "Resistance training and adequate protein are among the best countermeasures, as is keeping to the lowest effective dose your doctor allows.",
            "Raises appetite and causes fluid retention, so scale weight and body-fat readings can mislead; trust the multi-week trend.",
            "Reduces bone density over time. Calcium, vitamin D and loaded exercise help; ask about bone scans if you use it long term.",
        ],
        "sleep_recovery": [
            "Often disrupts sleep (insomnia, lighter sleep), particularly if taken late. Morning dosing is the usual advice.",
            "May raise resting heart rate and blood sugar and lower HRV, so a worse recovery score on dose days may be the drug, not overtraining.",
        ],
        "watch": "Never stop suddenly after long use. Taper with your doctor.",
    },
    "budesonide": {
        "label": "Budesonide (locally acting corticosteroid)",
        "training": ["Much less systemic effect than prednisone because most is cleared by the liver, but similar effects on sleep, appetite and muscle can still occur at higher doses."],
        "sleep_recovery": ["Mild sleep or mood effects are possible in some people."],
        "watch": "Grapefruit juice can increase its levels.",
    },
    "azathioprine": {
        "label": "Azathioprine (immunosuppressant)",
        "training": ["No direct effect on muscle, but fatigue and nausea can reduce training quality, especially after dose changes."],
        "sleep_recovery": ["Immune suppression means more infection risk: if you feel ill, skip hard sessions and sleep more."],
        "watch": "Regular blood tests (blood counts, liver) are standard. Protect skin from strong sun.",
    },
    "mesalazine": {
        "label": "Mesalazine / mesalamine (5-ASA)",
        "training": ["Little to no direct effect on training or recovery."],
        "sleep_recovery": ["Occasional headache or nausea in some people."],
        "watch": "Kidney function is monitored periodically.",
    },
    "adalimumab": {
        "label": "Adalimumab / infliximab / vedolizumab / ustekinumab (biologics)",
        "training": ["Generally compatible with training. Some people feel tired for a day or two after a dose or infusion."],
        "sleep_recovery": ["Infection risk is higher with TNF blockers: treat fevers and persistent illness seriously and rest."],
        "watch": "Report infections, unusual bruising or persistent fever to your doctor.",
    },
    "vitamin d": {
        "label": "Vitamin D",
        "training": ["Supports bone and muscle function; useful alongside long-term steroids and in Crohn's, where absorption is often poor."],
        "sleep_recovery": ["No notable effect when taken in normal doses."],
        "watch": "Levels are best guided by a blood test.",
    },
    "iron": {
        "label": "Iron",
        "training": ["Low iron lowers endurance and recovery; correcting a real deficiency can noticeably improve energy."],
        "sleep_recovery": ["Can cause stomach upset. Best on an empty stomach but may be taken with food."],
        "watch": "Only supplement when blood tests show deficiency.",
    },
    "b12": {
        "label": "Vitamin B12",
        "training": ["Important for energy and red blood cells; absorption is often reduced in Crohn's affecting the ileum or after surgery."],
        "sleep_recovery": ["No notable effect in normal doses."],
        "watch": "Check levels periodically.",
    },
}


def rows(sql, args=()):
    con = connect()
    out = [dict(r) for r in con.execute(sql, args).fetchall()]
    con.close()
    return out


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/data")
def data():
    daily = rows("SELECT * FROM daily ORDER BY date")
    manual = {m["date"]: m for m in rows("SELECT * FROM manual")}
    for d in daily:
        m = manual.get(d["date"], {})
        if m.get("weight_kg"):
            d["weight_kg"] = m["weight_kg"]
        d["kcal_in"] = m.get("kcal_in") or d.get("kcal_consumed")
        d["protein_g"] = m.get("protein_g")
        d["waist_cm"] = m.get("waist_cm")
    # days that only exist in the manual log (no Garmin row yet)
    have = {d["date"] for d in daily}
    for dt, m in manual.items():
        if dt not in have:
            daily.append({"date": dt, "weight_kg": m.get("weight_kg"), "kcal_in": m.get("kcal_in"),
                          "protein_g": m.get("protein_g"), "waist_cm": m.get("waist_cm")})
    daily.sort(key=lambda d: d["date"])
    settings = {r["key"]: r["value"] for r in rows("SELECT * FROM settings")}
    return jsonify(
        daily=daily,
        activities=rows("SELECT * FROM activities ORDER BY date"),
        meds=rows("SELECT * FROM meds ORDER BY id"),
        settings=settings,
    )


@app.route("/api/log", methods=["POST"])
def log():
    b = request.get_json(force=True)
    con = connect()
    con.execute(
        "INSERT INTO manual(date, weight_kg, kcal_in, protein_g, waist_cm) VALUES (?,?,?,?,?) "
        "ON CONFLICT(date) DO UPDATE SET weight_kg=COALESCE(excluded.weight_kg, weight_kg), "
        "kcal_in=COALESCE(excluded.kcal_in, kcal_in), protein_g=COALESCE(excluded.protein_g, protein_g), "
        "waist_cm=COALESCE(excluded.waist_cm, waist_cm)",
        (b["date"], b.get("weight_kg"), b.get("kcal_in"), b.get("protein_g"), b.get("waist_cm")),
    )
    con.commit()
    return jsonify(ok=True)


@app.route("/api/log/add", methods=["POST"])
def log_add():
    """Add calories/protein on top of what is already logged for the day (used by the recipe buttons)."""
    b = request.get_json(force=True)
    con = connect()
    con.execute(
        "INSERT INTO manual(date, kcal_in, protein_g) VALUES (?,?,?) "
        "ON CONFLICT(date) DO UPDATE SET kcal_in=COALESCE(kcal_in,0)+COALESCE(excluded.kcal_in,0), "
        "protein_g=COALESCE(protein_g,0)+COALESCE(excluded.protein_g,0)",
        (b["date"], int(b.get("kcal_in") or 0), int(b.get("protein_g") or 0)),
    )
    con.commit()
    return jsonify(ok=True)


FOOD_FIELDS = ["date", "time", "meal", "foods", "recipe", "gluten", "lactose", "reaction",
               "pain", "bloating", "nausea", "toilet", "blood", "notes"]


@app.route("/api/food")
def food_list():
    return jsonify(rows("SELECT * FROM foodlog ORDER BY date DESC, time DESC, id DESC"))


@app.route("/api/food", methods=["POST"])
def food_save():
    b = request.get_json(force=True)
    vals = [b.get(f) for f in FOOD_FIELDS]
    con = connect()
    if b.get("id"):
        sets = ",".join(f"{f}=?" for f in FOOD_FIELDS)
        con.execute(f"UPDATE foodlog SET {sets} WHERE id=?", vals + [b["id"]])
    else:
        con.execute(f"INSERT INTO foodlog({','.join(FOOD_FIELDS)}) VALUES ({','.join('?' for _ in FOOD_FIELDS)})", vals)
    con.commit()
    return jsonify(ok=True)


@app.route("/api/food/<int:food_id>", methods=["DELETE"])
def food_delete(food_id):
    con = connect()
    con.execute("DELETE FROM foodlog WHERE id=?", (food_id,))
    con.commit()
    return jsonify(ok=True)


@app.route("/api/recipes")
def recipes():
    return send_from_directory(ROOT, "recipes.json")


@app.route("/api/settings", methods=["POST"])
def settings():
    con = connect()
    for k, v in request.get_json(force=True).items():
        con.execute("INSERT OR REPLACE INTO settings VALUES (?,?)", (k, str(v)))
    con.commit()
    return jsonify(ok=True)


@app.route("/api/meds", methods=["POST"])
def add_med():
    b = request.get_json(force=True)
    con = connect()
    con.execute(
        "INSERT INTO meds(name, dose, schedule, started, notes) VALUES (?,?,?,?,?)",
        (b.get("name"), b.get("dose"), b.get("schedule"), b.get("started"), b.get("notes")),
    )
    con.commit()
    return jsonify(ok=True)


@app.route("/api/meds/<int:med_id>", methods=["DELETE"])
def del_med(med_id):
    con = connect()
    con.execute("DELETE FROM meds WHERE id=?", (med_id,))
    con.commit()
    return jsonify(ok=True)


@app.route("/api/medinfo")
def medinfo():
    return jsonify(MED_INFO)


@app.route("/api/sync", methods=["POST"])
def sync():
    days = str(int(request.args.get("days", 7)))
    try:
        r = subprocess.run(
            [sys.executable, str(ROOT / "sync.py"), "--days", days],
            capture_output=True, text=True, timeout=600, cwd=ROOT, stdin=subprocess.DEVNULL,
        )
        return jsonify(ok=r.returncode == 0, output=(r.stdout + r.stderr)[-1500:])
    except Exception as e:
        return jsonify(ok=False, output=str(e))


if __name__ == "__main__":
    connect().close()
    print("Open http://localhost:5055")
    app.run(host="127.0.0.1", port=5055, debug=False)
