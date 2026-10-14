/* Insights tab: weekly review, "what moves together" comparisons from your own days, infusion windows, and data upkeep (auto sync, backup).
   Observations from your own data, not proof of cause. Relies on: D, X, FOOD, $, esc, daysAgo, todayIso. */
(function () {
  const A = a => { a = a.filter(v => v != null && !isNaN(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  const SD = a => { a = a.filter(v => v != null && !isNaN(v)); if (a.length < 3) return null; const m = A(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
  const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const f1 = (v, d = 1) => v == null ? "–" : (+v).toFixed(d);
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const hbiOf = s => (s && s.wellbeing != null && s.pain != null && s.liquid != null) ? s.wellbeing + (s.pain <= 0 ? 0 : s.pain <= 3 ? 1 : s.pain <= 6 ? 2 : 3) + s.liquid + (s.joints ? 1 : 0) : null;
  let SYS = null;

  function maps() {
    const dm = {}, sm = {}, im = {}, lm = {}, fb = {};
    D.daily.forEach(d => dm[d.date] = d);
    (X.symptoms || []).forEach(s => sm[s.date] = s);
    (X.intake || []).forEach(r => im[r.date] = r);
    D.activities.forEach(a => lm[a.date] = (lm[a.date] || 0) + (a.load || 0));
    (typeof FOOD !== "undefined" ? FOOD : []).forEach(f => { if (f.reaction === 2) fb[f.date] = 1; });
    return { dm, sm, im, lm, fb };
  }

  /* ---------- weekly review ---------- */
  function review(M) {
    const t = todayIso(), a0 = addDays(t, -6), b0 = addDays(t, -13), b1 = addDays(t, -7);
    const win = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
    const cur = win(a0, t), prev = win(b0, b1);
    const m = (days, f) => A(days.map(f));
    // [label, fn, decimals, better (+1 higher is better, -1 lower is better, 0 neutral), unit]
    const rows = [
      ["Approx. HBI", d => hbiOf(M.sm[d]), 1, -1, ""], ["Stools per day", d => M.sm[d] && M.sm[d].stools, 1, -1, ""], ["Abdominal pain 0-10", d => M.sm[d] && M.sm[d].pain, 1, -1, ""],
      ["Fatigue 0-10", d => M.sm[d] && M.sm[d].fatigue, 1, -1, ""],
      ["Sleep per night", d => M.dm[d] && M.dm[d].sleep_sec != null ? M.dm[d].sleep_sec / 3600 : null, 1, 1, " h"], ["Sleep score", d => M.dm[d] && M.dm[d].sleep_score, 0, 1, ""],
      ["HRV overnight", d => M.dm[d] && M.dm[d].hrv_avg, 0, 1, " ms"], ["Resting heart rate", d => M.dm[d] && M.dm[d].rhr, 0, -1, " bpm"],
      ["Average stress", d => M.dm[d] && M.dm[d].stress_avg, 0, -1, ""], ["Weight", d => M.dm[d] && M.dm[d].weight_kg, 1, 0, " kg"],
      ["Calories eaten (days logged)", d => M.dm[d] && M.dm[d].kcal_in, 0, 0, " kcal"], ["Protein (days logged)", d => M.dm[d] && M.dm[d].protein_g, 0, 1, " g"],
      ["Training sessions", null, 0, 0, ""], ["Caffeine (days logged)", d => M.im[d] && M.im[d].caffeine_mg, 0, 0, " mg"], ["Water (days logged)", d => M.im[d] && M.im[d].water_ml, 0, 1, " ml"],
    ];
    const body = rows.map(([label, fn, dec, better, unit]) => {
      let c, p;
      if (!fn) { c = D.activities.filter(a => a.date >= a0 && a.date <= t).length; p = D.activities.filter(a => a.date >= b0 && a.date <= b1).length; }
      else { c = m(cur, fn); p = m(prev, fn); }
      if (c == null && p == null) return "";
      const dlt = c != null && p != null ? c - p : null;
      const small = dlt != null && Math.abs(dlt) < Math.pow(10, -dec) * 0.5;
      const cls = dlt == null || small || better === 0 ? "" : (dlt * better > 0 ? "good" : "warn");
      return `<tr><td>${label}</td><td>${f1(c, dec)}${c != null ? unit : ""}</td><td>${f1(p, dec)}${p != null ? unit : ""}</td><td class="${cls}">${dlt == null ? "–" : (dlt > 0 ? "+" : "") + f1(dlt, dec)}</td></tr>`;
    }).join("");
    return `<table><tr><th></th><th>Last 7 days</th><th>The 7 days before</th><th>Change</th></tr>${body}</table>
      <div class="sub" style="margin-top:6px">Green means the change is in the usual healthy direction, amber the other way. Weight, calories and caffeine are shown without judgement.</div>`;
  }

  /* ---------- what moves together ---------- */
  // split pairs by threshold (median unless binary) and compare the outcome
  function cmp(pairs, thr) {
    pairs = pairs.filter(p => p.x != null && p.y != null && !isNaN(p.x) && !isNaN(p.y));
    if (pairs.length < 16) return null;
    const t = thr != null ? thr : med(pairs.map(p => p.x));
    let lo = pairs.filter(p => p.x < t), hi = pairs.filter(p => p.x >= t);
    if (thr == null && (lo.length < 8 || hi.length < 8)) { lo = pairs.filter(p => p.x <= t); hi = pairs.filter(p => p.x > t); }
    if (lo.length < 7 || hi.length < 7) return null;
    const yl = A(lo.map(p => p.y)), yh = A(hi.map(p => p.y)), sd = SD(pairs.map(p => p.y));
    if (!sd) return null;
    return { t, yl, yh, nl: lo.length, nh: hi.length, d: yh - yl, strong: Math.abs(yh - yl) >= 0.45 * sd };
  }
  function patterns(M) {
    const dates = Object.keys(M.dm).filter(d => d >= daysAgo(120)).sort();
    const nx = d => addDays(d, 1);
    const out = [];
    const add = (title, r, unit, fmtT, dir, sub) => out.push({ title, r, unit, fmtT, dir, sub });
    const sleepH = d => M.dm[d] && M.dm[d].sleep_sec != null ? M.dm[d].sleep_sec / 3600 : null;
    add("Short vs long sleep → that day's abdominal pain", cmp(dates.map(d => ({ x: sleepH(d), y: M.sm[d] && M.sm[d].pain }))), "/10", t => `${f1(t)} h`, "lowhigh", ["Slept less", "Slept more"]);
    add("Short vs long sleep → that day's fatigue", cmp(dates.map(d => ({ x: sleepH(d), y: M.sm[d] && M.sm[d].fatigue }))), "/10", t => `${f1(t)} h`, "lowhigh", ["Slept less", "Slept more"]);
    add("Lower vs higher HRV → next day's approx. HBI", cmp(dates.map(d => ({ x: M.dm[d].hrv_avg, y: hbiOf(M.sm[nx(d)]) }))), "", t => `${f1(t, 0)} ms`, "lowhigh", ["Lower HRV", "Higher HRV"]);
    add("Higher vs lower stress → that day's urgency", cmp(dates.map(d => ({ x: M.dm[d].stress_avg, y: M.sm[d] && M.sm[d].urgency }))), "/10", t => `${f1(t, 0)}`, "lowhigh", ["Calmer day", "More stressed day"]);
    add("Caffeine → that night's sleep score", cmp(dates.filter(d => M.im[d]).map(d => ({ x: M.im[d].caffeine_mg, y: M.dm[nx(d)] && M.dm[nx(d)].sleep_score }))), "", t => `${f1(t, 0)} mg`, "lowhigh", ["Less caffeine", "More caffeine"]);
    add("Caffeine → that day's stools", cmp(dates.filter(d => M.im[d]).map(d => ({ x: M.im[d].caffeine_mg, y: M.sm[d] && M.sm[d].stools }))), "", t => `${f1(t, 0)} mg`, "lowhigh", ["Less caffeine", "More caffeine"]);
    add("Training load → next morning's HRV", cmp(dates.map(d => ({ x: M.lm[d] || 0, y: M.dm[nx(d)] && M.dm[nx(d)].hrv_avg })), 1), " ms", () => "any session", "lowhigh", ["Rest day", "Training day"]);
    add("A meal with a bad reaction → next day's stools", cmp(dates.map(d => ({ x: M.fb[d] ? 1 : 0, y: M.sm[nx(d)] && M.sm[nx(d)].stools })), 1), "", () => "bad reaction", "lowhigh", ["No bad meal", "Bad meal"]);
    return out;
  }
  function patternsHtml(list) {
    const have = list.filter(p => p.r), strong = have.filter(p => p.r.strong), rest = have.filter(p => !p.r.strong), none = list.filter(p => !p.r);
    const line = p => `<tr><td>${p.title}</td><td>${p.sub[0]} (${p.r.nl} days): <b>${f1(p.r.yl)}</b>${p.unit}</td><td>${p.sub[1]} (${p.r.nh} days): <b>${f1(p.r.yh)}</b>${p.unit}</td><td class="sub">split at ${p.fmtT(p.r.t)}</td></tr>`;
    return `${strong.length ? `<div class="insight"><b>Stands out in your data</b></div><table><tr><th>Comparison</th><th></th><th></th><th></th></tr>${strong.map(line).join("")}</table>` : `<div class="sub">Nothing stands out yet. That is normal early on: it needs a few weeks of daily symptom entries next to the watch data.</div>`}
      ${rest.length ? `<details class="mini"><summary>${rest.length} comparison${rest.length > 1 ? "s" : ""} with no clear difference</summary><table>${rest.map(line).join("")}</table></details>` : ""}
      ${none.length ? `<details class="mini"><summary>${none.length} need more data</summary><div class="sub">${none.map(p => p.title).join("<br>")}</div></details>` : ""}
      <div class="note">These are patterns in your own days, not proof of cause. A day with poor sleep may also be a day with a flare starting. Use them to ask better questions, and test one change at a time.</div>`;
  }

  /* ---------- infusion windows ---------- */
  function infusionHtml(M) {
    const inf = (X.infusions || []).filter(i => i.date >= daysAgo(400));
    if (!inf.length) return `<div class="sub">Log infusions in the Medication tab to see how you look in the days around them.</div>`;
    const days = (from, to) => { const o = []; for (let i = from; i <= to; i++) o.push(i); return o; };
    const avgOf = (date, offs, fn) => A(offs.map(o => fn(addDays(date, o))));
    const metrics = [["HRV (ms)", d => M.dm[d] && M.dm[d].hrv_avg, 0], ["Resting HR", d => M.dm[d] && M.dm[d].rhr, 0], ["Sleep (h)", d => M.dm[d] && M.dm[d].sleep_sec != null ? M.dm[d].sleep_sec / 3600 : null, 1],
      ["Pain 0-10", d => M.sm[d] && M.sm[d].pain, 1], ["Fatigue 0-10", d => M.sm[d] && M.sm[d].fatigue, 1]];
    const rows = inf.slice().reverse().map(i => {
      const cells = metrics.map(([, fn, dec]) => { const b = avgOf(i.date, days(-3, -1), fn), a = avgOf(i.date, days(1, 3), fn); return `<td>${f1(b, dec)} → ${f1(a, dec)}</td>`; }).join("");
      return `<tr><td>${new Date(i.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}<div class="sub">${esc(i.drug || "")}</div></td>${cells}</tr>`;
    }).join("");
    return `<table><tr><th>Infusion</th>${metrics.map(m => `<th>${m[0]}<div class="sub">3 days before → 3 days after</div></th>`).join("")}</tr>${rows}</table>
      <div class="sub" style="margin-top:6px">Many people feel tired for a day or two after an infusion, and some feel better as the dose takes effect. If numbers drift worse in the last week before the next one, tell your IBD team: it can mean the dose or interval needs a look.</div>`;
  }

  /* ---------- upkeep ---------- */
  const when = iso => { if (!iso) return "never"; const h = (Date.now() - new Date(iso)) / 3600000; return h < 1 ? "less than an hour ago" : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`; };
  async function loadSys() { try { SYS = await (await fetch("/api/system")).json(); } catch (_) { SYS = null; } }
  function sysHtml() {
    if (!SYS) return `<div class="sub">Could not read the status.</div>`;
    const s = SYS;
    return `<div class="cols">
      <div><b>Automatic Garmin sync</b>
        <div class="row"><label class="chk"><input type="checkbox" id="au_on" ${s.autosync ? "checked" : ""}> sync every</label><input type="number" id="au_h" min="1" max="48" value="${s.autosync_hours}" style="width:70px"><span class="sub">hours while the hub is open</span></div>
        <div class="sub">${s.signed_in ? `Last sync: <b>${when(s.last_sync)}</b>${s.last_sync_ok === "0" ? ` <span class="warn">failed</span>: ${esc(s.last_sync_msg)}` : ""}` : `Not signed in to Garmin yet. Run <code>.venv\\Scripts\\python sync.py --days 3</code> once and automatic sync starts working.`}</div>
        <div class="row"><button class="ghost" id="au_sync">Sync now</button><span class="sub" id="au_smsg"></span></div></div>
      <div><b>Backup of hub.db</b>
        <div class="sub">Daily copy, newest 14 kept (${s.copies} saved). Last: <b>${when(s.last_backup)}</b>${s.last_backup_error ? ` <span class="warn">${esc(s.last_backup_error)}</span>` : ""}</div>
        <div class="row"><label style="flex:1;min-width:220px">Backup folder<input id="au_dir" value="${s.custom_dir ? esc(s.backup_dir) : ""}" placeholder="${esc(s.backup_dir)}"></label><button class="ghost" id="au_save">Save</button><button class="ghost" id="au_bk">Back up now</button></div>
        <div class="sub" id="au_bmsg">Tip: choose a folder inside OneDrive, Google Drive or Dropbox to also have an off-site copy of your medical history.</div></div></div>`;
  }

  /* ---------- page ---------- */
  window.renderInsights = async function () {
    const sec = $("weekly"), M = maps();
    sec.innerHTML = `<div class="grid">
      <div class="card wide"><h3>Weekly review</h3>${review(M)}</div>
      <div class="card wide"><h3>What moves together</h3><div class="sub">Compares your own days over the last four months: for example nights with less sleep against that day's pain.</div>${patternsHtml(patterns(M))}</div>
      <div class="card wide"><h3>Around infusions</h3>${infusionHtml(M)}</div>
      <div class="card wide"><h3>Automatic upkeep</h3><div id="sysbox"><div class="sub">Loading…</div></div></div></div>`;
    await loadSys();
    const box = $("sysbox"); if (!box) return;
    box.innerHTML = sysHtml();
    if (!SYS) return;
    const put = o => fetch("/api/settings", { method: "POST", body: JSON.stringify(o) });
    $("au_on").onchange = async e => { await put({ autosync: e.target.checked ? 1 : 0 }); };
    $("au_h").onchange = async e => { await put({ autosync_hours: Math.max(1, Math.min(48, +e.target.value || 6)) }); };
    $("au_sync").onclick = async () => { $("au_smsg").textContent = "Syncing, this can take a minute…"; const r = await (await fetch("/api/system/sync", { method: "POST" })).json(); $("au_smsg").textContent = r.ok ? "Done." : "Failed: " + (r.output || "").slice(-160); await load(); };
    $("au_save").onclick = async () => { await put({ backup_dir: $("au_dir").value.trim() }); $("au_bmsg").textContent = "Folder saved."; await loadSys(); $("sysbox").innerHTML = sysHtml(); renderInsightsBind(); };
    $("au_bk").onclick = async () => { $("au_bmsg").textContent = "Backing up…"; const r = await (await fetch("/api/system/backup", { method: "POST" })).json(); $("au_bmsg").textContent = r.ok ? "Saved: " + r.file : r.error; };
  };
  function renderInsightsBind() { window.renderInsights(); }
})();
