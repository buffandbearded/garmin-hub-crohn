"""Pull data from Garmin Connect into hub.db.

Usage:
    python sync.py              # last 14 days
    python sync.py --days 400   # backfill (slow; one request per day per metric)

First run asks for your Garmin email/password (or set GARMIN_EMAIL / GARMIN_PASSWORD).
Login tokens are cached in ~/.garminconnect so you are not asked again.
"""
import argparse
import getpass
import os
import time
from datetime import date, timedelta
from pathlib import Path

from garminconnect import Garmin

from db import connect, upsert

TOKEN_DIR = str(Path.home() / ".garminconnect")


def login():
    try:
        g = Garmin()
        g.login(TOKEN_DIR)
        return g
    except Exception:
        pass
    email = os.getenv("GARMIN_EMAIL") or input("Garmin email: ")
    password = os.getenv("GARMIN_PASSWORD") or getpass.getpass("Garmin password: ")
    g = Garmin(email, password, prompt_mfa=lambda: input("MFA code: "))
    g.login(TOKEN_DIR)   # newer garminconnect saves the login tokens into TOKEN_DIR itself
    return g


def safe(fn, *a):
    try:
        return fn(*a)
    except Exception as e:
        print(f"  ! {getattr(fn, '__name__', fn)} failed: {e}")
        return None


def get(d, *path):
    for p in path:
        if not isinstance(d, dict):
            return None
        d = d.get(p)
    return d


def sync_day(g, con, day):
    iso = day.isoformat()
    row = {"date": iso}

    stats = safe(g.get_stats, iso) or {}
    row.update(
        steps=stats.get("totalSteps"),
        kcal_total=stats.get("totalKilocalories"),
        kcal_active=stats.get("activeKilocalories"),
        kcal_resting=stats.get("bmrKilocalories"),
        rhr=stats.get("restingHeartRate"),
        stress_avg=stats.get("averageStressLevel"),
        bb_high=stats.get("bodyBatteryHighestValue"),
        bb_low=stats.get("bodyBatteryLowestValue"),
        kcal_consumed=stats.get("consumedKilocalories") or None,
    )

    sleep = safe(g.get_sleep_data, iso) or {}
    s = sleep.get("dailySleepDTO") or {}
    row.update(
        sleep_sec=s.get("sleepTimeSeconds"),
        deep_sec=s.get("deepSleepSeconds"),
        light_sec=s.get("lightSleepSeconds"),
        rem_sec=s.get("remSleepSeconds"),
        awake_sec=s.get("awakeSleepSeconds"),
        sleep_score=get(s, "sleepScores", "overall", "value"),
    )

    hrv = safe(g.get_hrv_data, iso) or {}
    row.update(
        hrv_avg=get(hrv, "hrvSummary", "lastNightAvg"),
        hrv_status=get(hrv, "hrvSummary", "status"),
    )

    comp = safe(g.get_body_composition, iso, iso) or {}
    items = comp.get("dateWeightList") or []
    if items:
        w = items[-1]
        grams = w.get("weight")
        row.update(
            weight_kg=round(grams / 1000, 1) if grams else None,
            body_fat=w.get("bodyFat"),
            muscle_kg=round(w["muscleMass"] / 1000, 1) if w.get("muscleMass") else None,
        )

    upsert(con, "daily", row)


def sync_activities(g, con, start, end):
    acts = safe(g.get_activities_by_date, start.isoformat(), end.isoformat()) or []
    for a in acts:
        con.execute(
            "INSERT OR REPLACE INTO activities VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                a.get("activityId"),
                (a.get("startTimeLocal") or "")[:10],
                a.get("activityName"),
                get(a, "activityType", "typeKey"),
                round((a.get("duration") or 0) / 60, 1),
                round((a.get("distance") or 0) / 1000, 2),
                a.get("calories"),
                a.get("averageHR"),
                a.get("maxHR"),
                a.get("activityTrainingLoad"),
                a.get("aerobicTrainingEffect"),
                a.get("anaerobicTrainingEffect"),
            ),
        )
    return len(acts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14)
    args = ap.parse_args()

    con = connect()
    g = login()
    end = date.today()
    start = end - timedelta(days=args.days - 1)

    n = sync_activities(g, con, start, end)
    print(f"Activities: {n}")
    d = start
    while d <= end:
        print(f"Syncing {d}")
        sync_day(g, con, d)
        con.commit()
        d += timedelta(days=1)
        time.sleep(0.4)
    con.commit()
    print("Done.")


if __name__ == "__main__":
    main()
