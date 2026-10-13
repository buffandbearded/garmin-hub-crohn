"""Fill hub.db with realistic demo data so you can preview the dashboard without Garmin.

    python demo.py
"""
import math
import random
from datetime import date, timedelta

from db import connect

random.seed(7)
con = connect()
con.execute("DELETE FROM daily")
con.execute("DELETE FROM activities")
con.execute("DELETE FROM manual")

today = date.today()
days = 120
weight = 69.0
aid = 1
for i in range(days, -1, -1):
    d = today - timedelta(days=i)
    iso = d.isoformat()
    weight += 0.02 + random.uniform(-0.25, 0.25) * 0.5
    sleep_h = max(5.0, min(9.3, random.gauss(7.2, 0.8)))
    sleep = int(sleep_h * 3600)
    deep = int(sleep * random.uniform(0.14, 0.22))
    rem = int(sleep * random.uniform(0.18, 0.26))
    awake = int(random.uniform(1200, 3000))
    light = sleep - deep - rem
    hrv = int(random.gauss(62, 8) + (sleep_h - 7) * 3)
    trained = d.weekday() in (0, 1, 3, 4) and random.random() > 0.15
    active = random.randint(350, 650) + (350 if trained else 0)
    resting = 1750
    con.execute(
        "INSERT INTO daily VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            iso, random.randint(5000, 14000), resting + active, active, resting,
            random.randint(50, 58), random.randint(20, 40), random.randint(70, 100), random.randint(8, 30),
            sleep, deep, light, rem, awake,
            int(55 + sleep_h * 4 + random.uniform(-6, 6)), hrv,
            "BALANCED" if hrv > 55 else "LOW",
            round(weight, 1), round(random.uniform(12, 15), 1), round(weight * 0.45, 1), None,
        ),
    )
    if random.random() > 0.2:
        con.execute(
            "INSERT INTO manual(date, weight_kg, kcal_in, protein_g) VALUES (?,?,?,?)",
            (iso, None, random.randint(2400, 3000), random.randint(110, 165)),
        )
    if trained:
        kind = ["strength_training", "strength_training", "running", "strength_training"][d.weekday() % 4]
        dur = random.randint(45, 80)
        con.execute(
            "INSERT INTO activities VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (aid, iso, kind.replace("_", " ").title(), kind, dur,
             round(random.uniform(4, 9), 1) if kind == "running" else 0,
             int(dur * random.uniform(6, 9)), random.randint(105, 140), random.randint(150, 175),
             round(random.uniform(60, 180), 0), round(random.uniform(1.5, 3.8), 1),
             round(random.uniform(0.5, 3.0), 1)),
        )
        aid += 1

con.commit()
print("Demo data loaded. Run: python app.py")
