"""Meal photo -> estimated macros, using a vision model that runs locally (Ollama or LM Studio).

Nothing leaves the computer. The hub starts LM Studio's local server if it is not running, loads the chosen model
with an idle timer (LM Studio unloads it again by itself after that many idle seconds, which frees the GPU), sends the
photo, and returns a structured estimate for you to check and correct before it is saved.

Two backends: LM Studio (default) or Ollama. Ollama is the fallback when LM Studio's GPU engine misbehaves.
Settings (all optional, stored in the hub's settings table):
    meal_backend  "lmstudio" (default) or "ollama"
    meal_model    model key (LM Studio: as shown by `lms ls`; Ollama: as shown by `ollama list`)
    meal_ttl      idle seconds before the model is unloaded (default 300)
Environment: LMSTUDIO_URL (default http://127.0.0.1:1234), OLLAMA_URL (default http://127.0.0.1:11434),
LMS_PATH (path to the `lms` command).
"""
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from flask import Blueprint, jsonify, request

from db import connect

bp = Blueprint("meal", __name__)
BASE = os.getenv("LMSTUDIO_URL", "http://127.0.0.1:1234").rstrip("/")
OLLAMA = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
NOWIN = 0x08000000 if sys.platform == "win32" else 0   # no flashing console windows

SYSTEM = (
    "You are a nutrition assistant. You look at a photo of a meal and estimate what is on the plate. "
    "Be realistic about portion sizes, include visible cooking fat, sauces and drinks, and never leave out items you can see. "
    "The user lives in Croatia, so dishes may be Croatian or Balkan (cevapi, sarma, burek, pasticada, soparnik, "
    "grah, juha, palacinke and so on). Give a best single estimate, not a range. Reply with JSON only. "
    "Always split the plate into its separate components, one entry per food or drink you can see, and estimate the numbers from the photo itself. "
    "Format (placeholders only, never copy them): "
    '{"dish":"<short name>","items":[{"name":"<food 1>","grams":<n>,"kcal":<n>,"protein_g":<n>,"carbs_g":<n>,"fat_g":<n>},{"name":"<food 2>",...}],'
    '"gluten":<true|false>,"lactose":<true|false>,"confidence":"<low|medium|high>","notes":"<one short sentence>"}'
)

SCHEMA = {
    "type": "object",
    "properties": {
        "dish": {"type": "string"},
        "items": {
            "type": "array", "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "grams": {"type": "number"},
                    "kcal": {"type": "number"},
                    "protein_g": {"type": "number"},
                    "carbs_g": {"type": "number"},
                    "fat_g": {"type": "number"},
                },
                "required": ["name", "grams", "kcal", "protein_g", "carbs_g", "fat_g"],
            },
        },
        "gluten": {"type": "boolean"},
        "lactose": {"type": "boolean"},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "notes": {"type": "string"},
    },
    "required": ["dish", "items", "gluten", "lactose", "confidence", "notes"],
}


LABEL_SCHEMA = {
    "type": "object",
    "properties": {"name": {"type": "string"}, "serving_g": {"type": "number"}, "kcal_100g": {"type": "number"}, "protein_100g": {"type": "number"},
                   "carbs_100g": {"type": "number"}, "fat_100g": {"type": "number"}, "gluten": {"type": "boolean"}, "lactose": {"type": "boolean"}, "notes": {"type": "string"}},
    "required": ["name", "serving_g", "kcal_100g", "protein_100g", "carbs_100g", "fat_100g", "gluten", "lactose", "notes"],
}


# ---------------------------------------------------------------- helpers
def _setting(key, default):
    try:
        con = connect()
        row = con.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        con.close()
        if row and str(row["value"]).strip():
            return str(row["value"]).strip()
    except Exception:
        pass
    return default


def lms_path():
    p = os.getenv("LMS_PATH") or shutil.which("lms")
    if p:
        return p
    for cand in (Path.home() / ".lmstudio" / "bin" / "lms.exe", Path.home() / ".lmstudio" / "bin" / "lms"):
        if cand.exists():
            return str(cand)
    return None


def _lms(*args, timeout=60):
    p = lms_path()
    if not p:
        raise RuntimeError("LM Studio's command line tool (lms) was not found. Install LM Studio and run it once, then try again.")
    return subprocess.run([p, *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, creationflags=NOWIN, stdin=subprocess.DEVNULL)


def server_up():
    try:
        with urllib.request.urlopen(BASE + "/v1/models", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def ensure_server():
    if server_up():
        return
    _lms("server", "start", timeout=60)
    for _ in range(40):
        if server_up():
            return
        time.sleep(1)
    raise RuntimeError("Could not start the LM Studio server. Open LM Studio once and check that it runs.")


def vision_models():
    try:
        out = _lms("ls", "--json", timeout=30).stdout
        return [m for m in json.loads(out) if m.get("type") == "llm" and m.get("vision")]
    except Exception:
        return []


def loaded_keys():
    try:
        out = _lms("ps", "--json", timeout=30).stdout
        return [m.get("modelKey") or m.get("identifier") for m in json.loads(out)]
    except Exception:
        return []


def choose_model():
    want = _setting("meal_model", "")
    models = vision_models()
    keys = [m["modelKey"] for m in models]
    if want and (want in keys or not keys):
        return want
    if keys:
        return keys[0]
    raise RuntimeError("No vision model is installed in LM Studio. Open LM Studio, go to the Discover tab and download a model with the eye (vision) icon.")


def ensure_loaded(model, ttl):
    if model in loaded_keys():
        return
    r = _lms("load", model, "--ttl", str(ttl), "-y", timeout=240)
    if r.returncode != 0:
        raise RuntimeError("LM Studio could not load the model: " + (r.stderr or r.stdout or "unknown error").strip()[-300:])


def _post(payload, timeout=240):
    req = urllib.request.Request(BASE + "/v1/chat/completions", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


# ---------------------------------------------------------------- Ollama backend
def _ollama_json(path, payload=None, timeout=240):
    req = urllib.request.Request(OLLAMA + path, data=None if payload is None else json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def ollama_up():
    try:
        _ollama_json("/api/tags", timeout=2)
        return True
    except Exception:
        return False


def ensure_ollama():
    if ollama_up():
        return
    exe = shutil.which("ollama")
    if not exe:
        raise RuntimeError("Ollama is not installed. Install it from ollama.com, or switch the meal backend to LM Studio.")
    env = dict(os.environ, OLLAMA_VULKAN=os.getenv("OLLAMA_VULKAN", "0"))   # Vulkan crashes the image encoder on some AMD cards
    subprocess.Popen([exe, "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL, creationflags=NOWIN, env=env)
    for _ in range(30):
        if ollama_up():
            return
        time.sleep(1)
    raise RuntimeError("Could not start Ollama.")


def ollama_models():
    try:
        out = []
        for m in _ollama_json("/api/tags", timeout=5).get("models", []):
            name = m.get("name")
            try:
                caps = _ollama_json("/api/show", {"model": name}, timeout=10).get("capabilities") or []
            except Exception:
                caps = []
            if "vision" in caps:
                out.append(name)
        return out
    except Exception:
        return []


def ollama_scan(img_b64, prompt, ttl, system=None):
    models = ollama_models()
    want = _setting("meal_model", "")
    model = want if want in models else (models[0] if models else None)
    if not model:
        raise RuntimeError("No vision model in Ollama. Run  ollama pull qwen2.5vl:7b  once.")
    res = _ollama_json("/api/chat", {
        "model": model, "stream": False, "format": "json", "keep_alive": f"{ttl}s",
        "options": {"temperature": 0.2, "num_predict": 900},
        "messages": [{"role": "system", "content": system or SYSTEM},
                     {"role": "user", "content": prompt, "images": [img_b64]}],
    })
    return model, res["message"]["content"]


def _num(v):
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return 0.0


def _parse(text):
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text or "", re.S)
        if not m:
            raise RuntimeError("The model did not return a readable answer. Try again or add a short note about the meal.")
        return json.loads(m.group(0))


def _clean(d):
    items = []
    for it in d.get("items") or []:
        if not isinstance(it, dict) or not str(it.get("name", "")).strip():
            continue
        items.append({"name": str(it["name"]).strip()[:80], "grams": _num(it.get("grams")), "kcal": _num(it.get("kcal")),
                      "protein_g": _num(it.get("protein_g")), "carbs_g": _num(it.get("carbs_g")), "fat_g": _num(it.get("fat_g"))})
    if not items:
        raise RuntimeError("I could not see any food in that photo. Try a closer, better-lit picture.")
    total = {k: round(sum(i[k] for i in items), 1) for k in ("kcal", "protein_g", "carbs_g", "fat_g")}
    conf = d.get("confidence") if d.get("confidence") in ("low", "medium", "high") else "low"
    return {"dish": str(d.get("dish") or items[0]["name"])[:100], "items": items, "total": total,
            "gluten": bool(d.get("gluten")), "lactose": bool(d.get("lactose")),
            "confidence": conf, "notes": str(d.get("notes") or "")[:400]}


# ---------------------------------------------------------------- routes
@bp.route("/api/meal/status")
def status():
    if _setting("meal_backend", "lmstudio") == "ollama":
        ms = ollama_models()
        return jsonify(backend="ollama", lms=True, server=ollama_up(), models=ms,
                       model=_setting("meal_model", ms[0] if ms else ""), ttl=int(_setting("meal_ttl", "300")))
    models = vision_models()
    return jsonify(backend="lmstudio", lms=bool(lms_path()), server=server_up(), models=[m["modelKey"] for m in models],
                   model=_setting("meal_model", models[0]["modelKey"] if models else ""),
                   ttl=int(_setting("meal_ttl", "300")))


LABEL_SYSTEM = (
    "You read food nutrition labels from a photo. Find the table of nutrition facts and report the values PER 100 g (or per 100 ml for drinks). "
    "If the label only gives values per serving, convert them to per 100 g using the stated serving size. Labels may be in Croatian, German, Italian or English "
    "(energija / Brennwert, bjelančevine / proteini / Eiweiss, ugljikohidrati / Kohlenhydrate, masti / Fett). Use kcal, not kJ. Reply with JSON only. "
    'Format (placeholders only, never copy them): {"name":"<product name>","serving_g":<grams in one serving or 0 if unknown>,"kcal_100g":<n>,"protein_100g":<n>,"carbs_100g":<n>,"fat_100g":<n>,'
    '"gluten":<true|false>,"lactose":<true|false>,"notes":"<one short sentence>"}'
)


def _vision(system, prompt, data, mime, schema, ttl):
    """Run one image + prompt through the chosen local engine. Returns (model, text)."""
    b64 = base64.b64encode(data).decode()
    if _setting("meal_backend", "lmstudio") == "ollama":
        ensure_ollama()
        return ollama_scan(b64, prompt, ttl, system)
    ensure_server()
    model = choose_model()
    ensure_loaded(model, ttl)
    payload = {
        "model": model, "temperature": 0.2, "max_tokens": 900,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": [{"type": "text", "text": prompt},
                                                  {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}]}],
        "response_format": {"type": "json_schema", "json_schema": {"name": "x", "strict": True, "schema": schema}},
    }
    try:
        res = _post(payload)
    except urllib.error.HTTPError as e:
        if e.code != 400:
            raise
        payload.pop("response_format")          # model/runtime without structured output: ask in plain text
        res = _post(payload)
    return model, res["choices"][0]["message"]["content"]


def _guarded(fn):
    try:
        return jsonify(fn())
    except RuntimeError as e:
        return jsonify(error=str(e))
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", "replace")[:300]
        except Exception:
            body = ""
        return jsonify(error=f"The local AI server returned an error ({e.code}). {body}".strip())
    except (urllib.error.URLError, ConnectionError, TimeoutError):
        return jsonify(error="The local AI server stopped responding (its GPU engine may have crashed). Try again, or switch backend/model in Model settings.")
    except subprocess.TimeoutExpired:
        return jsonify(error="The AI engine took too long to respond. Try again in a minute.")
    except Exception as e:
        return jsonify(error=f"Something went wrong ({type(e).__name__}). Try again, or enter it by hand.")


def _image():
    f = request.files.get("image")
    if not f:
        raise RuntimeError("Choose or take a photo first.")
    data = f.read()
    if len(data) > 12_000_000:
        raise RuntimeError("That photo is too large. Try again with a smaller one.")
    mime = f.mimetype if (f.mimetype or "").startswith("image/") else "image/jpeg"
    return data, mime


@bp.route("/api/meal/scan", methods=["POST"])
def scan():
    def go():
        data, mime = _image()
        note = (request.form.get("note") or "").strip()[:300]
        t0 = time.time()
        ttl = max(30, int(_setting("meal_ttl", "300")))
        prompt = ("Estimate the nutrition of this meal. The items array must contain one separate entry for EVERY distinct food or drink on the plate "
                  "(for example the protein, the starch, each vegetable or salad, bread, sauces, drinks), each with grams, kcal, protein, carbs and fat.")
        if note:
            prompt += f" The user says: {note}. Trust the user's note over your own guess where they conflict, and include every food the user names as its own item."
        model, text = _vision(SYSTEM, prompt, data, mime, SCHEMA, ttl)
        out = _clean(_parse(text))
        out.update(model=model, seconds=round(time.time() - t0, 1))
        return out
    return _guarded(go)


@bp.route("/api/meal/label", methods=["POST"])
def label():
    def go():
        data, mime = _image()
        t0 = time.time()
        ttl = max(30, int(_setting("meal_ttl", "300")))
        model, text = _vision(LABEL_SYSTEM, "Read the nutrition facts on this label.", data, mime, LABEL_SCHEMA, ttl)
        d = _parse(text)
        per = {k: _num(d.get(k + "_100g")) for k in ("kcal", "protein", "carbs", "fat")}
        if not per["kcal"] and not per["protein"] and not per["carbs"] and not per["fat"]:
            raise RuntimeError("I could not read a nutrition table in that photo. Try a closer, straight-on picture of the table.")
        # sanity: kcal should roughly match the macros (4/4/9); flag if far off, a sign of a misread
        calc = per["protein"] * 4 + per["carbs"] * 4 + per["fat"] * 9
        warn = bool(per["kcal"] and calc and abs(calc - per["kcal"]) > max(40, 0.35 * per["kcal"]))
        return {"name": str(d.get("name") or "Packaged food")[:80], "serving_g": _num(d.get("serving_g")), "per100": per,
                "gluten": bool(d.get("gluten")), "lactose": bool(d.get("lactose")), "notes": str(d.get("notes") or "")[:300],
                "check": warn, "model": model, "seconds": round(time.time() - t0, 1)}
    return _guarded(go)


# ---------------------------------------------------------------- saved meals (favourites)
SAVED_SQL = ("CREATE TABLE IF NOT EXISTS saved_meals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, data TEXT, uses INTEGER DEFAULT 0, last_used TEXT, created TEXT)")


@bp.route("/api/meal/saved")
def saved_list():
    con = connect()
    con.execute(SAVED_SQL)
    out = [{"id": r["id"], "name": r["name"], "uses": r["uses"], **json.loads(r["data"])} for r in
           con.execute("SELECT * FROM saved_meals ORDER BY uses DESC, COALESCE(last_used,'') DESC, id DESC").fetchall()]
    con.close()
    return jsonify(out)


@bp.route("/api/meal/saved", methods=["POST"])
def saved_add():
    b = request.get_json(force=True)
    try:
        d = _clean({"dish": b.get("name"), "items": b.get("items"), "gluten": b.get("gluten"), "lactose": b.get("lactose"), "confidence": "high"})
    except RuntimeError as e:
        return jsonify(error=str(e))
    name = (b.get("name") or d["dish"]).strip()[:60] or d["dish"]
    con = connect()
    con.execute(SAVED_SQL)
    con.execute("DELETE FROM saved_meals WHERE lower(name)=lower(?)", (name,))
    con.execute("INSERT INTO saved_meals(name, data, uses, created) VALUES (?,?,0,datetime('now'))",
                (name, json.dumps({"items": d["items"], "gluten": d["gluten"], "lactose": d["lactose"], "total": d["total"]})))
    con.commit()
    con.close()
    return jsonify(ok=True)


@bp.route("/api/meal/saved/<int:i>", methods=["DELETE"])
def saved_del(i):
    con = connect()
    con.execute(SAVED_SQL)
    con.execute("DELETE FROM saved_meals WHERE id=?", (i,))
    con.commit()
    con.close()
    return jsonify(ok=True)


@bp.route("/api/meal/saved/<int:i>/use", methods=["POST"])
def saved_use(i):
    con = connect()
    con.execute(SAVED_SQL)
    con.execute("UPDATE saved_meals SET uses=uses+1, last_used=datetime('now') WHERE id=?", (i,))
    con.commit()
    con.close()
    return jsonify(ok=True)
