/* Quick caffeine / water counters (Food log tab) and the infusion tracker (Medication tab, plus a reminder on Overview).
   Relies on globals from index.html and crohn.js: D, X, $, esc, daysAgo, todayIso, load. */
(function () {
  const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const A = a => { a = a.filter(v => v != null && !isNaN(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diffDays = (a, b) => Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 86400000);
  const nice = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  let last = null;   // last quick-add, for Undo

  /* ---------- caffeine + water ---------- */
  window.renderIntake = function () {
    const el = $("intakeCard"); if (!el) return;
    const today = todayIso(), rows = (X.intake || []), t = rows.find(r => r.date === today) || { caffeine_mg: 0, water_ml: 0, drinks: 0 };
    const w7 = rows.filter(r => r.date >= daysAgo(6)), n7 = Math.max(1, w7.length);
    const avgC = Math.round(w7.reduce((s, r) => s + (r.caffeine_mg || 0), 0) / n7), avgW = Math.round(w7.reduce((s, r) => s + (r.water_ml || 0), 0) / n7);
    const btn = (id, label, caf, water) => `<button class="ghost" data-q="${id}" data-c="${caf}" data-w="${water}">${label}</button>`;
    el.innerHTML = `<h3>Caffeine and water</h3>
      <div class="row" style="margin-top:0;align-items:baseline;gap:22px">
        <div><div class="big" style="font-size:26px">${(t.water_ml / 1000).toFixed(2)}<span class="u">L water</span></div></div>
        <div><div class="big" style="font-size:26px">${t.caffeine_mg}<span class="u">mg caffeine${t.drinks ? ` · ${t.drinks} drink${t.drinks > 1 ? "s" : ""}` : ""}</span></div></div>
        <div class="sub">Last 7 days (days logged): ${avgW ? (avgW / 1000).toFixed(1) + " L" : "–"} water, ${avgC || "–"} mg caffeine per day</div></div>
      <div class="row">${btn("w250", "+ 250 ml water", 0, 250)}${btn("w500", "+ 500 ml water", 0, 500)}${btn("cof", "Coffee +80 mg", 80, 0)}${btn("esp", "Espresso +65 mg", 65, 0)}${btn("tea", "Tea +40 mg", 40, 0)}${btn("en", "Energy drink 500 ml +160 mg", 160, 0)}
        <label>Other caffeine mg<input type="number" id="in_c" min="0" style="width:90px"></label><button class="ghost" id="in_add">Add</button>
        <button class="ghost" id="in_undo" ${last ? "" : "disabled"}>Undo last</button></div>
      <div class="sub">Typical amounts, check the label for exact values. Some people notice more urgency or looser stools with caffeine; the Insights tab compares your own days.</div>`;
    const send = async (c, w, remember = true) => {
      await post("/api/intake/add", { date: today, caffeine_mg: c, water_ml: w });
      if (remember) last = { c, w };
      X.intake = await (await fetch("/api/extra")).json().then(j => j.intake); renderIntake();
    };
    el.onclick = async e => {
      const b = e.target.closest("[data-q]");
      if (b) return send(+b.dataset.c, +b.dataset.w);
      if (e.target.id === "in_add") { const v = +$("in_c").value; if (v > 0) send(v, 0); }
      if (e.target.id === "in_undo" && last) { const l = last; last = null; send(-l.c, -l.w, false); }
    };
  };

  /* ---------- infusions ---------- */
  function nextDue() {
    const inf = (X.infusions || []).filter(i => i.date), weeks = +(D.settings.infusion_weeks || 8);
    if (!inf.length) return null;
    const lastI = inf[inf.length - 1], due = addDays(lastI.date, weeks * 7);
    return { last: lastI, due, days: diffDays(due, todayIso()), weeks };
  }
  window.renderDue = function () {
    const el = $("dueBanner"); if (!el) return;
    const n = nextDue();
    if (!n || n.days > 7) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="note" style="margin-bottom:14px"><b>${n.days < 0 ? "Infusion overdue" : n.days === 0 ? "Infusion due today" : "Infusion due soon"}</b>: ${esc(n.last.drug || "Infusion")} on ${nice(n.due)} ${n.days > 0 ? `(in ${n.days} day${n.days > 1 ? "s" : ""})` : n.days < 0 ? `(${-n.days} day${-n.days > 1 ? "s" : ""} ago)` : ""}, based on every ${n.weeks} weeks from the last one on ${nice(n.last.date)}. Confirm the date with your IBD team.</div>`;
  };
  window.renderInfusions = function () {
    const el = $("infCard"); if (!el) return;
    const inf = (X.infusions || []).slice().reverse(), n = nextDue();
    el.innerHTML = `<h3>Infusions and drug levels</h3>
      <div class="row" style="margin-top:0">
        ${n ? `<div><div class="big" style="font-size:24px">${n.days < 0 ? "Overdue" : n.days === 0 ? "Today" : n.days}<span class="u">${n.days > 0 ? "days to next infusion" : ""}</span></div><div class="sub">${esc(n.last.drug || "Infusion")} · ${nice(n.due)} (last: ${nice(n.last.date)})</div></div>` : `<div class="sub">Log an infusion to see the next due date.</div>`}
      </div>
      <div class="row">
        <label>Date<input type="date" id="if_date" value="${todayIso()}"></label>
        <label>Drug<input id="if_drug" value="${esc(inf[0] ? inf[0].drug : "Infliximab")}" style="width:150px"></label>
        <label>Dose<input id="if_dose" value="${esc(inf[0] ? inf[0].dose : "")}" placeholder="e.g. 5 mg/kg" style="width:120px"></label>
        <label>Notes<input id="if_notes" style="width:180px"></label>
        <label>Interval (weeks)<input type="number" id="if_weeks" min="1" max="26" value="${+(D.settings.infusion_weeks || 8)}" style="width:80px"></label>
        <button class="act" id="if_add">Log infusion</button></div>
      ${inf.length ? `<table><tr><th>Date</th><th>Drug</th><th>Dose</th><th>Notes</th><th></th></tr>${inf.map(i => `<tr><td>${nice(i.date)}</td><td>${esc(i.drug)}</td><td>${esc(i.dose)}</td><td>${esc(i.notes)}</td><td><button class="ghost" data-ifdel="${i.id}">×</button></td></tr>`).join("")}</table>` : ""}
      <div class="sub" style="margin-top:6px">Trough levels and antibodies go in the Labs tab (marker “Infliximab trough”). The Insights tab shows how HRV, resting heart rate, sleep and pain look in the days around each infusion.</div>`;
    $("if_weeks").onchange = async e => { await post("/api/settings", { infusion_weeks: Math.max(1, +e.target.value || 8) }); await load(); };
    $("if_add").onclick = async () => {
      await post("/api/infusions", { date: $("if_date").value, drug: $("if_drug").value.trim() || "Infliximab", dose: $("if_dose").value, notes: $("if_notes").value });
      await load();
    };
    el.onclick = async e => { const b = e.target.closest("[data-ifdel]"); if (b) { await fetch("/api/infusions/" + b.dataset.ifdel, { method: "DELETE" }); await load(); } };
  };
})();
