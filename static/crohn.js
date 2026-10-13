/* Crohn's tab (symptom log, approximate HBI, flare early-warning, my file) and Labs tab.
   Reference tool, not a diagnosis. Relies on globals from index.html: D, X, $, avg, fmt, esc, lastN, col, mkChart, todayIso, daysAgo, load. */
var X = { symptoms: [], labs: [], sets: [], pain: [] };
async function loadExtra() {
  try { X = await (await fetch("/api/extra")).json(); } catch (e) { /* older server: leave empty */ }
}
const sd = a => { a = a.filter(v => v != null && !isNaN(v)); if (a.length < 3) return null; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const nz = v => (v === "" || v == null ? null : +v);

/* ---------- scoring ---------- */
// Harvey-Bradshaw Index from self-report: wellbeing 0-4 + pain band 0-3 + liquid stools per day.
// Abdominal mass and complications need an examination, so they are left out.
function hbi(s) {
  if (!s || s.wellbeing == null || s.pain == null || s.liquid == null) return null;
  const pb = s.pain <= 0 ? 0 : s.pain <= 3 ? 1 : s.pain <= 6 ? 2 : 3;
  return s.wellbeing + pb + s.liquid + (s.joints ? 1 : 0);
}
function hbiBand(v) { return v == null ? ["–", ""] : v < 5 ? ["Remission range", "good"] : v < 8 ? ["Mild activity", "warn"] : v < 17 ? ["Moderate activity", "bad"] : ["Severe activity", "bad"]; }

/* ---------- flare early-warning (experimental) ---------- */
function flareWatch() {
  const dl = D.daily.filter(d => d.date <= todayIso()), sy = X.symptoms;
  const sig = []; let phys = 0;
  const recent = dl.slice(-3), base = dl.slice(-31, -3);
  const dev = (key, label, dirBad, minAbs, unit) => {
    const r = avg(recent.map(d => d[key])), b = base.map(d => d[key]).filter(v => v != null), m = avg(b), s = sd(b);
    if (r == null || m == null || s == null || b.length < 14) return;
    const diff = r - m;
    if (dirBad * diff >= Math.max(s, minAbs)) phys++, sig.push(`${label} ${diff > 0 ? "up" : "down"} ${fmt(Math.abs(diff), 0)} ${unit} vs your 4-week normal`);
  };
  dev("rhr", "Resting HR", 1, 3, "bpm");
  dev("hrv_avg", "HRV", -1, 4, "ms");
  dev("sleep_score", "Sleep score", -1, 6, "pts");
  dev("bb_high", "Body Battery peak", -1, 8, "pts");
  dev("stress_avg", "Average stress", 1, 6, "pts");
  // symptoms
  const last7 = sy.filter(s => s.date >= daysAgo(6)), prev14 = sy.filter(s => s.date < daysAgo(6) && s.date >= daysAgo(20));
  const h7 = avg(last7.map(hbi)), h14 = avg(prev14.map(hbi));
  const st7 = avg(last7.map(s => s.stools)), st14 = avg(prev14.map(s => s.stools));
  let sym = 0;
  if (h7 != null && h7 >= 5) { sym++; sig.push(`Approx. HBI averaging ${fmt(h7, 1)} over 7 days (${hbiBand(h7)[0].toLowerCase()})`); }
  else if (h7 != null && h14 != null && h7 - h14 >= 2) { sym++; sig.push(`Approx. HBI up ${fmt(h7 - h14, 1)} vs the 2 weeks before`); }
  if (st7 != null && st14 != null && st14 > 0 && st7 >= st14 * 1.5 && st7 - st14 >= 1.5) { sym++; sig.push(`Stool count ${fmt(st7, 1)}/day vs ${fmt(st14, 1)} before`); }
  const blood = last7.filter(s => s.blood).length, night = last7.filter(s => s.night).length, fev = last7.filter(s => s.fever).length;
  if (blood) { sym += 2; sig.push(`Blood noted on ${blood} of the last 7 logged days`); }
  if (night >= 2) { sym++; sig.push(`Night-time stools on ${night} of the last 7 logged days`); }
  if (fev) { sym += 2; sig.push("Fever logged this week"); }
  const score = phys + sym;
  let level = "calm", head = "No warning signs", cls = "good";
  if (blood || fev || sym >= 3) { level = "act"; head = "Contact your IBD team"; cls = "bad"; }
  else if (score >= 3 || (sym >= 1 && phys >= 1)) { level = "check"; head = "Worth a closer look"; cls = "warn"; }
  else if (score >= 1) { level = "watch"; head = "Slight drift, keep an eye"; cls = "warn"; }
  const gaps = [];
  if (dl.length < 21) gaps.push("Needs about 3 weeks of Garmin data for a personal baseline.");
  if (sy.length < 7) gaps.push("Symptom log has under a week of entries, so most of the signal is missing. A 30-second daily entry makes this far more useful.");
  return { level, head, cls, sig, gaps, score };
}

/* ---------- Crohn's tab ---------- */
function renderCrohn() {
  const sec = $("crohn"), S = D.settings, sy = X.symptoms;
  const today = sy.find(s => s.date === ($("sy_date") ? $("sy_date").value : todayIso())) || {};
  const fw = flareWatch(), latest = [...sy].reverse().map(s => ({ s, h: hbi(s) })).find(x => x.h != null);
  const hb = latest ? hbiBand(latest.h) : ["No score yet", ""];
  const keep = id => ($(id) ? $(id).value : null);
  const dsel = keep("sy_date") || todayIso();
  const v = (k, d = "") => (today[k] == null ? d : today[k]);
  sec.innerHTML = `
  <div class="grid">
    <div class="card half"><h3>Flare early-warning</h3><div class="big ${fw.cls}" style="font-size:22px">${fw.head}</div>
      <div class="sub">Experimental: compares the last 3 days of Garmin data and your symptom log with your own 4-week normal.</div>
      ${fw.sig.length ? `<ul class="sig">${fw.sig.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<div class="sub" style="margin-top:8px">Nothing outside your normal range.</div>`}
      ${fw.gaps.map(g => `<div class="sub" style="margin-top:6px">${esc(g)}</div>`).join("")}
      <div class="note">Watch changes are a hint, not a diagnosis. Poor sleep, alcohol, a hard week, illness and steroids all move HRV and resting HR too. The objective check is a faecal calprotectin and CRP: log them in Labs.</div>
    </div>
    <div class="card half"><h3>Latest approximate HBI</h3><div class="big ${hb[1]}">${latest ? latest.h : "–"}</div>
      <div class="sub">${latest ? latest.s.date + ": " : ""}${hb[0]}. Harvey-Bradshaw style score from your own entries: wellbeing + pain + liquid stools (+1 for joint pain). Under 5 is the usual remission range.</div></div>
    <div class="card wide"><h3>Daily symptom log</h3>
      <div class="row">
        <label>Date<input type="date" id="sy_date" value="${dsel}"></label>
        <label>General wellbeing<select id="sy_wb">${["0 very well", "1 slightly below par", "2 poor", "3 very poor", "4 terrible"].map((t, i) => `<option value="${i}" ${v("wellbeing", 0) == i ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Stools today<input type="number" min="0" id="sy_st" style="width:90px" value="${v("stools")}"></label>
        <label>…of which liquid<input type="number" min="0" id="sy_lq" style="width:90px" value="${v("liquid")}"></label>
        <label>Abdominal pain 0-10<input type="number" min="0" max="10" id="sy_pn" style="width:90px" value="${v("pain")}"></label>
        <label>Urgency 0-10<input type="number" min="0" max="10" id="sy_ur" style="width:90px" value="${v("urgency")}"></label>
        <label>Fatigue 0-10<input type="number" min="0" max="10" id="sy_ft" style="width:90px" value="${v("fatigue")}"></label>
      </div>
      <div class="row">
        <label class="chk"><input type="checkbox" id="sy_bl" ${today.blood ? "checked" : ""}> blood in stool</label>
        <label class="chk"><input type="checkbox" id="sy_ni" ${today.night ? "checked" : ""}> woke at night to go</label>
        <label class="chk"><input type="checkbox" id="sy_fe" ${today.fever ? "checked" : ""}> fever</label>
        <label class="chk"><input type="checkbox" id="sy_jo" ${today.joints ? "checked" : ""}> joint pain / swelling</label>
        <label>Notes<input id="sy_nt" style="width:260px" value="${esc(today.notes || "")}"></label>
        <button class="act" id="sy_save">Save</button>
        ${today.date ? `<button class="ghost" id="sy_del">Delete this day</button>` : ""}
      </div>
      <div class="sub" style="margin-top:6px">Entries for a day can be re-opened by changing the date. Log it at the same time each evening so the days are comparable.</div>
    </div>
    <div class="card half"><h3>Approximate HBI (60 days)</h3><div class="chart"><canvas id="c_hbi"></canvas></div></div>
    <div class="card half"><h3>Pain, urgency and fatigue (60 days)</h3><div class="chart"><canvas id="c_sym"></canvas></div></div>
    <div class="card wide"><h3>My Crohn's file</h3>
      <div class="sub">Kept here so every suggestion in the hub can be read against it. Edit any field.</div>
      <div class="cols" style="margin-top:8px">
        ${[["crohn_mre", "Imaging (MR enterography)"], ["crohn_scopes", "Colonoscopy / gastroscopy (location, extent, ulcers, biopsies)"], ["crohn_meds", "Treatment history"], ["crohn_notes", "Other notes (surgery, extra-intestinal symptoms, triggers you've noticed)"]]
          .map(([k, l]) => `<label class="ta">${l}<textarea data-prof="${k}" rows="4">${esc(S[k] || "")}</textarea></label>`).join("")}
      </div>
      <div class="row"><button class="act" id="prof_save">Save file</button><span class="sub" id="prof_msg"></span></div>
      <div class="insight" style="margin-top:12px"><b>About imaging and scopes:</b> an MR enterography shows the small bowel and complications such as strictures, fistulas or abscesses, but not the colon well. A colonoscopy shows where the disease sits and how far it reaches, which in turn decides how much to worry about B12 and iron. Add your reports above so the hub can keep them with your data, and ask your IBD team what they mean for training and diet.</div>
    </div>
    <div class="card half"><h3>Red flags: call your IBD team</h3><ul>${K.RED_FLAGS.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="card half"><h3>Crohn's and training</h3>${K.CROHN_TRAIN.map(([t, x]) => `<details class="mini"><summary>${esc(t)}</summary><div class="sub">${esc(x)}</div></details>`).join("")}</div>
  </div>`;

  const num = nz;
  $("sy_date").onchange = () => renderCrohn();
  $("sy_save").onclick = async () => {
    await fetch("/api/symptoms", { method: "POST", body: JSON.stringify({ date: $("sy_date").value, wellbeing: +$("sy_wb").value, stools: num($("sy_st").value), liquid: num($("sy_lq").value), pain: num($("sy_pn").value), urgency: num($("sy_ur").value), fatigue: num($("sy_ft").value), blood: $("sy_bl").checked ? 1 : 0, night: $("sy_ni").checked ? 1 : 0, fever: $("sy_fe").checked ? 1 : 0, joints: $("sy_jo").checked ? 1 : 0, notes: $("sy_nt").value }) });
    await load();
  };
  if ($("sy_del")) $("sy_del").onclick = async () => { await fetch("/api/symptoms/" + $("sy_date").value, { method: "DELETE" }); await load(); };
  $("prof_save").onclick = async () => {
    const b = {}; document.querySelectorAll("[data-prof]").forEach(t => b[t.dataset.prof] = t.value);
    await fetch("/api/settings", { method: "POST", body: JSON.stringify(b) });
    $("prof_msg").textContent = "Saved ✓"; setTimeout(load, 500);
  };
  const rows60 = sy.filter(s => s.date >= daysAgo(60)), L = rows60.map(s => s.date);
  mkChart("c_hbi", { type: "line", data: { labels: L, datasets: [
    { label: "Approx. HBI", data: rows60.map(hbi), borderColor: col("--acc"), pointRadius: 3, spanGaps: true },
    { label: "Remission limit (5)", data: L.map(() => 5), borderColor: col("--good"), borderDash: [5, 4], pointRadius: 0, borderWidth: 1.2 },
    { label: "Moderate (8)", data: L.map(() => 8), borderColor: col("--bad"), borderDash: [5, 4], pointRadius: 0, borderWidth: 1.2 }] },
    options: { emptyText: "Log a few days of symptoms to see the trend.", scales: { y: { beginAtZero: true, grace: "10%" } } } });
  mkChart("c_sym", { type: "line", data: { labels: L, datasets: [
    { label: "Pain", data: rows60.map(s => s.pain), borderColor: col("--bad"), pointRadius: 2, spanGaps: true, fill: false },
    { label: "Urgency", data: rows60.map(s => s.urgency), borderColor: col("--warn"), pointRadius: 2, spanGaps: true, fill: false },
    { label: "Fatigue", data: rows60.map(s => s.fatigue), borderColor: col("--p"), pointRadius: 2, spanGaps: true, fill: false }] },
    options: { emptyText: "Nothing logged yet.", scales: { y: { min: 0, max: 10 } } } });
}

/* ---------- Labs tab ---------- */
let LABSEL = "crp";
let SCAN = null, SCANMSG = "";
function labStatus(m, val) {
  const L = K.LABS[m]; if (!L) return ["", ""];
  return val < L.lo ? ["low", "warn"] : val > L.hi ? ["high", "warn"] : ["in range", "good"];
}
function renderLabs() {
  const sec = $("labs"), keys = Object.keys(K.LABS);
  const byM = {}; X.labs.forEach(l => (byM[l.marker] = byM[l.marker] || []).push(l));
  const latest = keys.filter(k => byM[k]).map(k => { const a = byM[k], l = a[a.length - 1], p = a.length > 1 ? a[a.length - 2] : null; return { k, l, p }; });
  const L = K.LABS[LABSEL];
  const prev = SCAN ? (() => {
    const exists = (d, m) => X.labs.find(l => l.date === d && l.marker === m);
    const rows = SCAN.found.map((r, i) => { const ex = exists(SCAN.date || todayIso(), r.marker); return `<tr data-sr="${i}">
      <td><input type="checkbox" ${r.flag ? "" : "checked"} data-k="on"></td>
      <td><select data-k="m">${keys.map(k => `<option value="${k}" ${k === r.marker ? "selected" : ""}>${esc(K.LABS[k] ? K.LABS[k].n : k)}</option>`).join("")}</select></td>
      <td><input type="number" step="any" data-k="v" value="${r.value}" style="width:100px"></td>
      <td><input data-k="u" value="${esc(r.unit)}" style="width:120px"></td>
      <td class="sub">${r.flag ? `<span class="warn">implausible value, check it</span> ` : ""}${ex ? `<span class="warn">replaces ${ex.value} already logged</span> ` : ""}${esc(r.note)}<div class="sub" style="opacity:.7">${esc(r.line)}</div></td></tr>`; }).join("");
    return `<div style="margin-top:14px"><div class="row" style="margin-top:0">
        <label>Date of sample<input type="date" id="sc_date" value="${SCAN.date || todayIso()}"></label>
        <label>Lab<input id="sc_lab" value="${esc(SCAN.lab)}" style="width:200px" placeholder="e.g. Breyer"></label>
        <span class="sub">${SCAN.found.length} results recognised (${esc(SCAN.how)}). ${SCAN.date ? "" : "<span class='warn'>No sample date found, check it.</span>"}</span></div>
      ${SCAN.found.length ? `<table style="margin-top:8px"><tr><th></th><th>Marker</th><th>Value</th><th>Unit</th><th>Notes</th></tr>${rows}</table>` : `<div class="note">Nothing recognised. Open the PDF, copy the table text, and paste it in the box above. Lines I could not match are listed below.</div>`}
      ${SCAN.dups.length ? `<div class="sub" style="margin-top:6px">Duplicates ignored (first one kept): ${SCAN.dups.map(d => esc(K.LABS[d.marker].n)).join(", ")}</div>` : ""}
      ${SCAN.unmatched.length ? `<details class="mini"><summary>${SCAN.unmatched.length} lines with numbers I did not recognise (markers the hub does not track)</summary><div class="sub" style="white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:12px">${SCAN.unmatched.map(esc).join("\n")}</div></details>` : ""}
      <div class="row"><button class="act" id="sc_save">Save selected</button><button class="ghost" id="sc_drop">Discard</button></div></div>`;
  })() : "";
  sec.innerHTML = `
  <div class="grid">
    <div class="card wide" id="sc_card"><h3>Upload lab results</h3>
      <div class="sub">A PDF from Breyer or Rebro (or a photo, or pasted text). It is read on this computer and nothing is sent anywhere. You check the numbers before they are saved.</div>
      <div class="row"><label>File<input type="file" id="sc_file" accept=".pdf,.png,.jpg,.jpeg,.txt"></label><button class="act" id="sc_go">Scan</button><span class="sub" id="sc_msg">${esc(SCANMSG)}</span></div>
      <details class="mini"><summary>Or paste the text from the report</summary><textarea id="sc_text" rows="5" placeholder="Select all in the PDF, copy, paste here"></textarea><div class="row"><button class="ghost" id="sc_go2">Scan pasted text</button></div></details>
      ${prev}
    </div>
    <div class="card wide"><h3>Add a result</h3>
      <div class="row">
        <label>Date<input type="date" id="lb_date" value="${todayIso()}"></label>
        <label>Marker<select id="lb_m">${keys.map(k => `<option value="${k}" ${k === LABSEL ? "selected" : ""}>${esc(K.LABS[k].n)}</option>`).join("")}</select></label>
        <label>Value<input type="number" step="any" id="lb_v" style="width:110px"></label>
        <label>Unit<input id="lb_u" style="width:130px" value="${esc(L.u)}"></label>
        <label>Note<input id="lb_n" style="width:240px" placeholder="e.g. before infusion"></label>
        <button class="act" id="lb_add">Add</button>
      </div>
      <div class="sub" style="margin-top:6px">Reference bands below are generic adult ranges. Your lab's own range on the report is the one that counts, and some targets in Crohn's differ from "normal" (see each note).</div>
    </div>
    <div class="card wide"><h3 id="lb_title">${esc(L.n)} <span style="text-transform:none;letter-spacing:0;font-weight:400">· reference ${L.lo}–${L.hi} ${esc(L.u)}</span></h3>
      <div class="chips" id="lb_chips">${keys.map(k => `<button class="chip ${k === LABSEL ? "on" : ""}" data-lm="${k}">${esc(K.LABS[k].n)}${byM[k] ? ` · ${byM[k].length}` : ""}</button>`).join("")}</div>
      <div class="sub">${esc(L.why)}</div>
      <div class="chart" style="margin-top:8px"><canvas id="c_lab"></canvas></div>
    </div>
    <div class="card wide"><h3>Latest values</h3>
      ${latest.length ? `<table><tr><th>Marker</th><th>Latest</th><th>Date</th><th>Change</th><th>Status</th></tr>` + latest.map(({ k, l, p }) => { const st = labStatus(k, l.value); const ch = p ? l.value - p.value : null; return `<tr><td>${esc(K.LABS[k].n)}</td><td>${fmt(l.value, Math.abs(l.value) < 10 ? 1 : 0)} ${esc(l.unit || K.LABS[k].u)}</td><td>${l.date}</td><td>${ch == null ? "–" : (ch > 0 ? "+" : "") + fmt(ch, Math.abs(ch) < 10 ? 1 : 0)}</td><td class="${st[1]}">${st[0]}</td></tr>`; }).join("") + `</table>` : `<div class="sub">No results yet. Dig out your latest blood work and stool test and add them above.</div>`}
    </div>
    <div class="card wide"><h3>All entries</h3>
      ${X.labs.length ? `<table><tr><th>Date</th><th>Marker</th><th>Value</th><th>Note</th><th></th></tr>` + [...X.labs].reverse().slice(0, 80).map(l => `<tr><td>${l.date}</td><td>${esc((K.LABS[l.marker] || {}).n || l.marker)}</td><td>${l.value} ${esc(l.unit || "")}</td><td>${esc(l.note || "")}</td><td><button class="ghost" data-ld="${l.id}">×</button></td></tr>`).join("") + `</table>` : `<div class="sub">Nothing yet.</div>`}
    </div>
    <div class="card wide"><h3>What to track, and why</h3>
      <ul>
        <li><b>Inflammation:</b> CRP and faecal calprotectin. These are the objective numbers behind how you feel; calprotectin can rise before symptoms do.</li>
        <li><b>Nutrition and energy:</b> haemoglobin, ferritin, B12, folate, vitamin D, albumin and zinc. Low iron or vitamin D quietly cost you training quality and recovery.</li>
        <li><b>Drug safety (immunosuppressants such as azathioprine):</b> white cells, lymphocytes, neutrophils, ALT/AST. Your team orders these regularly; keeping them here lets you spot trends.</li>
        <li><b>Drug level (anti-TNF biologics such as infliximab):</b> trough level and antibodies, if your clinic measures them. They explain a fading response.</li>
        <li>Training heavily the day before can nudge AST, ALT and creatinine. If you can, draw blood on a rest day.</li>
      </ul>
    </div>
  </div>`;

  // ---- scan upload
  const doScan = async fd => {
    $("sc_msg").textContent = "Reading…";
    try {
      const r = await (await fetch("/api/labs/scan", { method: "POST", body: fd })).json();
      if (r.error) { SCAN = null; SCANMSG = r.error; } else { SCAN = r; SCANMSG = ""; }
    } catch (e) { SCAN = null; SCANMSG = "Could not reach the hub. Is app.py still running? You may need to restart it after this update."; }
    renderLabs();
  };
  $("sc_go").onclick = () => { const f = $("sc_file").files[0]; if (!f) { $("sc_msg").textContent = "Choose a file first."; return; } const fd = new FormData(); fd.append("file", f); doScan(fd); };
  $("sc_go2").onclick = () => { const t = $("sc_text").value; if (!t.trim()) return; const fd = new FormData(); fd.append("text", t); doScan(fd); };
  const scCard = $("sc_card");
  scCard.ondragover = e => { e.preventDefault(); scCard.style.borderColor = "var(--acc)"; };
  scCard.ondragleave = () => { scCard.style.borderColor = ""; };
  scCard.ondrop = e => { e.preventDefault(); scCard.style.borderColor = ""; const f = e.dataTransfer.files[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); doScan(fd); };
  if (SCAN) {
    $("sc_drop").onclick = () => { SCAN = null; renderLabs(); };
    $("sc_date").onchange = () => { SCAN.date = $("sc_date").value; renderLabs(); };
    $("sc_save").onclick = async () => {
      const date = $("sc_date").value, lab = $("sc_lab").value.trim(); let n = 0, first = null;
      for (const tr of sec.querySelectorAll("tr[data-sr]")) {
        const g = k => tr.querySelector(`[data-k="${k}"]`);
        if (!g("on").checked || g("v").value === "") continue;
        const marker = g("m").value, ex = X.labs.find(l => l.date === date && l.marker === marker), r = SCAN.found[+tr.dataset.sr];
        await fetch("/api/labs", { method: "POST", body: JSON.stringify({ id: ex ? ex.id : null, date, marker, value: +g("v").value, unit: g("u").value, note: ["scan", lab, r.note].filter(Boolean).join(" · ") }) });
        n++; first = first || marker;
      }
      SCAN = null; SCANMSG = n ? `Saved ${n} result${n > 1 ? "s" : ""}.` : "Nothing was selected."; if (first) LABSEL = first;
      await load();
    };
  }
  const draw = () => {
    const a = byM[LABSEL] || [], Lb = K.LABS[LABSEL];
    mkChart("c_lab", { type: "line", data: { labels: a.map(x => x.date), datasets: [
      { label: Lb.n, data: a.map(x => x.value), borderColor: col("--acc"), pointRadius: 4, spanGaps: true },
      { label: "Lower limit", data: a.map(() => Lb.lo), borderColor: col("--warn"), borderDash: [5, 4], pointRadius: 0, borderWidth: 1.2, fill: false },
      { label: "Upper limit", data: a.map(() => Lb.hi), borderColor: col("--warn"), borderDash: [5, 4], pointRadius: 0, borderWidth: 1.2, fill: false }] },
      options: { emptyText: "No results for this marker yet." } });
  };
  draw();
  $("lb_chips").onclick = e => { const m = e.target.dataset.lm; if (!m) return; LABSEL = m; renderLabs(); };
  $("lb_m").onchange = e => { LABSEL = e.target.value; renderLabs(); };
  $("lb_add").onclick = async () => {
    if ($("lb_v").value === "") return;
    await fetch("/api/labs", { method: "POST", body: JSON.stringify({ date: $("lb_date").value, marker: $("lb_m").value, value: +$("lb_v").value, unit: $("lb_u").value, note: $("lb_n").value }) });
    await load();
  };
  sec.querySelectorAll("[data-ld]").forEach(b => b.onclick = async () => { await fetch("/api/labs/" + b.dataset.ld, { method: "DELETE" }); await load(); });
}
