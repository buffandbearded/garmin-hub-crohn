"""Read lab results from a PDF, image or pasted text and map them to the hub's markers.

Everything runs on this computer. Nothing is uploaded anywhere.
Croatian and English test names are recognised (Breyer, KBC Zagreb/Rebro and similar layouts).
The result is only a proposal: the UI shows it for review before anything is saved.
"""
import datetime
import io
import re
import unicodedata

# marker -> regex on normalised text (lowercase, no diacritics, decimal comma kept as is)
ALIASES = {
    "crp": r"c[\s-]*reaktivni protein|\bhs[\s-]*crp\b|\bcrp\b",
    "calpro": r"kalprotektin|calprotectin",
    "ferritin": r"feritin|ferritin",
    "hb": r"\bhemoglobin(?!\s*a1c)|\bhaemoglobin|\bhgb\b|\bhb\b(?!a)",
    "b12": r"vitamin\s*b[\s-]*12|\bb[\s-]*12\b|cijanokobalamin|kobalamin|cobalamin",
    "vitd": r"25[\s-]*(?:oh|hidroksi)[\s-]*(?:vitamin\s*)?d\d?|vitamin\s*d\b|kalcidiol",
    "folate": r"folna kiselina|folati?\b|folate|folic",
    "albumin": r"(?<!mikro)albumin(?!\s*/)",
    "zinc": r"\bcink\b|\bzinc\b",
    "alt": r"\balt\b|alanin[\s-]*aminotransferaza|\bsgpt\b",
    "ast": r"\bast\b|aspartat[\s-]*aminotransferaza|\bsgot\b",
    "wbc": r"leukociti|\bwbc\b|broj leukocita|bijele krvne",
    "lymph": r"limfocit\w*|lymphocyt\w*",
    "neut": r"neutrofil\w*|neutrophil\w*",
    "creat": r"kreatinin(?!\s*klirens)|creatinine",
    "ifx": r"infliksimab|infliximab",
    "tgn": r"6[\s-]*tgn|tioguanin",
    "tsh": r"\btsh\b|tireotropin|tireostimulirajuci",
    "ft4": r"\bft4\b|slobodni tiroksin|free t4|\bt4\s*slobodni",
    "testo": r"testosteron(?!\s*slobodni)",
    "cortisol": r"kortizol|cortisol",
    "glucose": r"glukoza|glucose|gukoza",
    "mcv": r"\bmcv\b|prosjecni volumen eritrocita",
    "plt": r"trombociti|\bplt\b|platelet\w*",
    "mg": r"magnezij\w*|magnesium",
    "k": r"\bkalij\b|potassium",
    "ca": r"\bkalcij\b|calcium",
    "ldl": r"\bldl\b",
}
ALIASES = {k: re.compile(v) for k, v in ALIASES.items()}

# target unit shown in the hub, plausible range (after conversion)
TARGET = {
    "crp": ("mg/L", 0, 500), "calpro": ("µg/g", 0, 5000), "ferritin": ("µg/L", 0, 5000), "hb": ("g/L", 50, 220),
    "b12": ("pg/mL", 50, 3000), "vitd": ("nmol/L", 5, 400), "folate": ("ng/mL", 0, 50), "albumin": ("g/L", 10, 60),
    "zinc": ("µmol/L", 3, 40), "alt": ("U/L", 0, 2000), "ast": ("U/L", 0, 2000), "wbc": ("x10^9/L", 0.5, 50),
    "lymph": ("x10^9/L", 0, 15), "neut": ("x10^9/L", 0, 30), "creat": ("µmol/L", 20, 400), "ifx": ("µg/mL", 0, 100),
    "tgn": ("pmol/8x10^8 RBC", 0, 2000), "tsh": ("mIU/L", 0, 100), "ft4": ("pmol/L", 3, 60), "testo": ("nmol/L", 0.5, 80),
    "cortisol": ("nmol/L", 10, 2000), "glucose": ("mmol/L", 1, 40), "mcv": ("fL", 50, 130), "plt": ("x10^9/L", 10, 1000),
    "mg": ("mmol/L", 0.2, 2), "k": ("mmol/L", 2, 8), "ca": ("mmol/L", 1.5, 3.5), "ldl": ("mmol/L", 0.3, 10),
}
# (marker, normalised unit) -> factor to the target unit. A unit equal to the target counts as 1.
CONVERT = {
    ("crp", "mg/dl"): 10, ("hb", "g/dl"): 10, ("albumin", "g/dl"): 10,
    ("b12", "pmol/l"): 1.355, ("b12", "ng/l"): 1, ("vitd", "ng/ml"): 2.496, ("vitd", "ug/l"): 2.496,
    ("folate", "nmol/l"): 0.4414, ("folate", "ug/l"): 1, ("ferritin", "ng/ml"): 1, ("ferritin", "pmol/l"): 0.445,
    ("zinc", "ug/dl"): 0.153, ("creat", "mg/dl"): 88.4, ("testo", "ng/dl"): 0.0347, ("testo", "ng/ml"): 3.47,
    ("cortisol", "ug/dl"): 27.59, ("glucose", "mg/dl"): 0.0555, ("ldl", "mg/dl"): 0.02586, ("mg", "mg/dl"): 0.4114,
    ("ca", "mg/dl"): 0.2495, ("ft4", "ng/dl"): 12.87, ("ft4", "ng/l"): 1.287, ("calpro", "mg/kg"): 1, ("calpro", "ug/g"): 1,
    ("ifx", "ug/ml"): 1, ("tsh", "uiu/ml"): 1, ("tsh", "miu/l"): 1,
}
SAME = {  # normalised spellings of the target unit
    "mg/l", "ug/g", "ug/l", "g/l", "ug/ml", "ng/ml", "pg/ml", "pmol/l", "nmol/l", "umol/l", "mmol/l", "u/l", "iu/l",
    "miu/l", "fl", "10^9/l", "x10^9/l", "10*9/l", "g/l", "10e9/l", "10 9/l", "tis/ul", "x10^3/ul", "10^3/ul",
}
UNIT_RE = re.compile(
    r"(mg/dl|mg/l|g/dl|g/l|ug/l|ug/ml|ug/dl|ug/g|ng/ml|ng/dl|ng/l|pg/ml|pmol/l|nmol/l|umol/l|mmol/l|mmol/mol|u/l|iu/l|miu/l|uiu/ml|"
    r"mg/kg|x?10\^9/l|10\*9/l|10e9/l|x?10\^3/ul|tis\.?/ul|fl|%)", re.I)
NUM_RE = re.compile(r"([<>]=?)?\s*(\d+(?:[.,]\d+)?)")
DATE_RE = re.compile(r"(?<!\d)(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})(?!\d)|(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)")
DATE_KEYS = re.compile(r"uzorkovan|uzorak|datum prijema|primljen|uzet|collect|sampl|datum nalaza|datum")


def norm(s):
    s = s.replace("đ", "d").replace("Đ", "D").replace("µ", "u").replace("μ", "u")
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def extract_text(data, filename):
    """Return (text, how). Raises RuntimeError with a plain-language reason."""
    name = (filename or "").lower()
    if name.endswith((".txt", ".csv", ".md")):
        return data.decode("utf-8", "replace"), "text"
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError:
            raise RuntimeError("The PDF reader is not installed. In PowerShell (venv active) run: pip install pypdf")
        rd = PdfReader(io.BytesIO(data))
        pages = []
        for p in rd.pages:
            try:
                pages.append(p.extract_text(extraction_mode="layout") or "")
            except Exception:
                pages.append(p.extract_text() or "")
        text = "\n".join(pages)
        if len(re.sub(r"\s", "", text)) >= 60:
            return text, "pdf"
        # scanned PDF: try OCR
        try:
            import pytesseract
            from pdf2image import convert_from_bytes
            imgs = convert_from_bytes(data, dpi=200)
            return "\n".join(pytesseract.image_to_string(i, lang="hrv+eng") for i in imgs), "ocr"
        except Exception:
            raise RuntimeError("This PDF has no readable text (it is a scan). Either open it, select all, copy and paste the text into the box, or install OCR: Tesseract plus pip install pytesseract pdf2image.")
    if name.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff")):
        try:
            import pytesseract
            from PIL import Image
            return pytesseract.image_to_string(Image.open(io.BytesIO(data)), lang="hrv+eng"), "ocr"
        except Exception:
            raise RuntimeError("Reading photos needs OCR (Tesseract + pip install pytesseract pillow). Easier: upload the PDF, or paste the text.")
    raise RuntimeError("Unsupported file type. Use a PDF, a photo, or paste the text.")


def find_date(text):
    t = norm(text)
    cands = []
    for m in DATE_RE.finditer(t):
        try:
            d = datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1))) if m.group(1) else datetime.date(int(m.group(4)), int(m.group(5)), int(m.group(6)))
        except ValueError:
            continue
        if d.year < 2015 or d > datetime.date.today():
            continue  # skips birth dates and nonsense
        near = DATE_KEYS.search(t[max(0, m.start() - 70):m.start()])
        cands.append((0 if near else 1, m.start(), d))
    if not cands:
        return None
    cands.sort()
    return cands[0][2].isoformat()


def find_lab(text):
    t = norm(text)
    if "breyer" in t:
        return "Poliklinika Breyer"
    if "rebro" in t or "kbc zagreb" in t or "klinicki bolnicki centar zagreb" in t:
        return "KBC Zagreb (Rebro)"
    return ""


def parse(text):
    lines = [l.rstrip() for l in text.replace("\r", "").split("\n")]
    nl = [norm(l) for l in lines]
    found, seen, dups, unmatched = [], set(), [], []
    for i, l in enumerate(nl):
        if not l.strip():
            continue
        best = None
        for mk, rx in ALIASES.items():
            m = rx.search(l)
            if m and (best is None or m.start() < best[1].start() or (m.start() == best[1].start() and m.end() > best[1].end())):
                best = (mk, m)
        if not best:
            if re.search(r"\d", l) and UNIT_RE.search(l) and len(unmatched) < 40:
                unmatched.append(lines[i].strip())
            continue
        mk, m = best
        rest = l[m.end():]
        nxt = [nl[j].strip() for j in range(i + 1, min(len(nl), i + 4)) if nl[j].strip()]  # following non-empty lines
        used = 0
        if not NUM_RE.search(rest) and nxt and NUM_RE.match(nxt[0]):
            rest, used = rest + " " + nxt[0], 1
        nm = NUM_RE.search(rest)
        if not nm or "%" in rest[:nm.start()]:
            continue  # no value, or a percentage row (e.g. neutrophils %)
        cmp_, num = nm.group(1), float(nm.group(2).replace(",", "."))
        after = rest[nm.end():]
        um = UNIT_RE.search(after)
        if not um:  # unit on its own line below the value (table exported column by column)
            for t in nxt[used:used + 2]:
                um = UNIT_RE.match(t)
                if um:
                    break
        unit_raw = um.group(1).lower().replace("x10", "10").replace("tis.", "tis") if um else ""
        if unit_raw == "%":
            continue
        tgt, lo, hi = TARGET[mk]
        value, unit, note = num, tgt, ""
        if unit_raw:
            u = unit_raw
            if (mk, u) in CONVERT:
                value = num * CONVERT[(mk, u)]
                if CONVERT[(mk, u)] != 1:
                    note = f"converted from {num:g} {unit_raw}"
            elif u not in SAME and u != "mmol/mol":
                note = f"unit {unit_raw} not converted"
        else:
            note = "unit not found, assumed " + tgt
        value = round(value, 2 if value < 100 else 1)
        flag = "" if lo <= value <= hi else "check"
        if cmp_:
            note = (note + "; " if note else "") + f"reported as {cmp_}{num:g}"
        row = {"marker": mk, "value": value, "unit": unit, "note": note, "flag": flag, "line": re.sub(r"\s+", " ", lines[i].strip())[:140]}
        if mk in seen:
            dups.append(row)
            continue
        seen.add(mk)
        found.append(row)
    return found, dups, unmatched


def scan(data=None, filename="", text=None):
    how = "pasted text"
    if text is None:
        text, how = extract_text(data, filename)
    found, dups, unmatched = parse(text)
    return {"date": find_date(text), "lab": find_lab(text), "found": found, "dups": dups, "unmatched": unmatched, "how": how, "chars": len(text)}
