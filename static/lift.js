/* Lifting tab (readiness, session logger, progression, weekly volume, joint health) and Program tab.
   Relies on globals: D, X, K, $, avg, fmt, esc, lastN, col, mkChart, todayIso, daysAgo, mondayOf, hbi, sd, load. */
const LIFT = { day: null, date: null, swap: {}, extra: [], prog: "", sel: "" };
const exName = id => (K.EX[id] || { n: id }).n;
const wkNo = () => { const f = X.sets[0]; return f ? Math.floor((new Date(todayIso()) - new Date(f.date)) / 864e5 / 7) : 0; };
const rampOn = () => D.settings.lift_ramp !== "0";
function rampFactor() { if (!rampOn()) return 1; const w = wkNo(); return w <= 0 ? 0.6 : w === 1 ? 0.75 : w === 2 ? 0.9 : 1; }
function program() { return K.PROGRAMS[+D.settings.workouts_per_week <= 3 ? 3 : 4]; }

/* ---------- joints ---------- */
function jointStatus() {
  const out = {};
  K.JOINTS.forEach(([k, n]) => {
    const r = [...X.pain].reverse().find(p => p.joint === k && p.date >= daysAgo(10));
    out[k] = r ? { level: r.level, date: r.date, n } : null;
  });
  return out;
}
function flaggedJoints() { const js = jointStatus(); return Object.keys(js).filter(k => js[k] && js[k].level >= 4); }

/* ---------- readiness ---------- */
function readiness() {
  const reasons = [], dl = D.daily.filter(d => d.date <= todayIso());
  let red = 0, yel = 0;
  const sy = [...X.symptoms].reverse().find(s => s.date >= daysAgo(1));
  if (sy) {
    const h = hbi(sy);
    if (sy.blood) { red += 2; reasons.push("Blood in stool logged: rest and contact your IBD team."); }
    if (sy.fever) { red += 2; reasons.push("Fever logged: no hard training while ill."); }
    if (h != null && h >= 8) { red++; reasons.push(`Approx. HBI ${h}: moderate symptom activity.`); }
    else if (h != null && h >= 5) { yel++; reasons.push(`Approx. HBI ${h}: mild symptom activity.`); }
    if (sy.pain != null && sy.pain >= 7) { red++; reasons.push(`Abdominal pain ${sy.pain}/10.`); }
    else if (sy.pain != null && sy.pain >= 4) { yel++; reasons.push(`Abdominal pain ${sy.pain}/10.`); }
    if (sy.urgency != null && sy.urgency >= 8) { red++; reasons.push(`Urgency ${sy.urgency}/10: stay near a toilet.`); }
    if (sy.fatigue != null && sy.fatigue >= 7) { yel++; reasons.push(`Fatigue ${sy.fatigue}/10.`); }
    if (sy.night) { yel++; reasons.push("Woke at night to go to the toilet."); }
  } else reasons.push("No symptom entry for today or yesterday. Log one in Crohn's so this is accurate.");
  const night = [...dl].reverse().find(d => d.sleep_sec != null && d.date >= daysAgo(2));
  if (night) {
    const h = night.sleep_sec / 3600;
    if (h < 5.5) { yel += 2; reasons.push(`Slept ${fmt(h)} h.`); } else if (h < 6.5) { yel++; reasons.push(`Slept ${fmt(h)} h.`); }
  }
  const rec = dl.slice(-2), base = dl.slice(-30, -2);
  const hrv = avg(rec.map(d => d.hrv_avg)), hrvB = avg(base.map(d => d.hrv_avg));
  if (hrv != null && hrvB && hrv < hrvB * 0.88) { yel++; reasons.push(`HRV ${fmt(hrv, 0)} ms, ${fmt((1 - hrv / hrvB) * 100, 0)}% below your 4-week normal.`); }
  const rhr = avg(rec.map(d => d.rhr)), rhrB = avg(base.map(d => d.rhr));
  if (rhr != null && rhrB && rhr >= rhrB + 5) { yel++; reasons.push(`Resting HR ${fmt(rhr, 0)}, ${fmt(rhr - rhrB, 0)} bpm above normal.`); }
  const fj = flaggedJoints();
  if (fj.length) { yel++; reasons.push(`Joint pain flagged: ${fj.map(k => jointStatus()[k].n.toLowerCase()).join(", ")}. See swaps in the session.`); }
  let level = "green";
  if (red >= 1 || yel >= 4) level = "red"; else if (yel >= 1) level = "yellow";
  const meta = {
    green: { label: "Green: train as planned", cls: "good", factor: 1, rirAdd: 0, advice: "Normal session. Push the sets that are meant to be hard." },
    yellow: { label: "Yellow: train, but trim", cls: "warn", factor: 0.7, rirAdd: 1, advice: "Keep the exercises, cut about a third of the sets, leave one extra rep in reserve, keep the load the same. Skipping a day is also fine." },
    red: { label: "Red: rest or easy movement", cls: "bad", factor: 0, rirAdd: 2, advice: "Skip heavy training today. A walk and food that stays down are the work. If symptoms persist, speak to your IBD team." }
  }[level];
  return Object.assign({ level, reasons }, meta);
}
function readinessCard() {
  if (!X || !D) return "";
  const r = readiness();
  return card("Training readiness", `<span class="${r.cls}" style="font-size:22px">${r.label.split(":")[0]}</span>`, esc(r.reasons[0] || r.advice));
}

/* ---------- load / volume maths ---------- */
const hard = s => s.rir == null || s.rir <= 3;
function weekSets(mon) {
  const out = {}; K.MUSCLES.forEach(m => out[m.k] = 0);
  X.sets.filter(s => mondayOf(s.date) === mon && hard(s)).forEach(s => {
    const e = K.EX[s.exercise]; if (!e) return;
    e.p.forEach(m => out[m] = (out[m] || 0) + 1); e.s.forEach(m => out[m] = (out[m] || 0) + 0.5);
  });
  return out;
}
const epley = s => s.weight * (1 + (s.reps + (s.rir == null ? 0 : s.rir)) / 30);
function suggest(slot) {
  const e = K.EX[slot.id], rows = X.sets.filter(s => s.exercise === slot.id && s.weight != null && s.reps != null);
  if (!rows.length) return null;
  const d = rows[rows.length - 1].date, last = rows.filter(s => s.date === d), w = Math.max(...last.map(s => s.weight));
  const lo = slot.reps[0], hi = slot.reps[1], txt = last.map(s => `${s.weight}×${s.reps}`).join(", ");
  const topSets = last.filter(s => s.weight === w);
  let next;
  if (topSets.every(s => s.reps >= hi) && topSets.every(s => s.rir == null || s.rir <= 2)) next = `Go up to ${+(w + e.inc).toFixed(2)} kg and aim for ${lo}+ reps.`;
  else if (topSets.some(s => s.reps < lo)) next = `Stay at ${w} kg and get every set to ${lo}+ reps. If that fails twice, drop about 5-10%.`;
  else next = `Stay at ${w} kg and add a rep to each set (target ${hi} on every set).`;
  return { last: `${d}: ${txt}`, next };
}

/* ---------- Lifting tab ---------- */
function nextDayIndex(p) {
  const lastSess = [...X.sets].reverse().find(s => s.session);
  const i = lastSess ? p.days.findIndex(x => x.name === lastSess.session) : -1;
  return i < 0 ? 0 : (i + 1) % p.days.length;
}
function renderLift() {
  const sec = $("lift"), p = program(), rd = readiness(), rf = rampFactor();
  if (LIFT.day == null || LIFT.day >= p.days.length) LIFT.day = nextDayIndex(p);
  if (!LIFT.date) LIFT.date = todayIso();
  const day = p.days[LIFT.day], mon = mondayOf(LIFT.date === todayIso() ? todayIso() : LIFT.date);
  const slots = [...day.ex.map(x => Object.assign({}, x, { id: LIFT.swap[x.id] || x.id, orig: x.id })), ...LIFT.extra.map(id => ({ id, orig: id, sets: 3, reps: [8, 12], rir: 2, rest: "2 min", extra: 1 }))];
  const fj = flaggedJoints(), js = jointStatus(), eff = rd.factor * rf;
  const dateSets = X.sets.filter(s => s.date === LIFT.date);
  const blocks = slots.map((x, i) => {
    const e = K.EX[x.id] || { n: x.id, j: [], subs: {}, cue: "" }, sug = suggest(x), logged = dateSets.filter(s => s.exercise === x.id);
    const n = logged.length || Math.max(1, Math.round(x.sets * (rd.level === "red" ? rf : eff)));
    const flag = (e.j || []).find(j => fj.includes(j));
    const sub = flag && e.subs && e.subs[flag] && e.subs[flag] !== x.id ? e.subs[flag] : null;
    const rirT = Math.min(4, x.rir + rd.rirAdd + (rf < 1 ? 1 : 0));
    let rows = ""; for (let j = 0; j < n; j++) { const l = logged[j] || {}; rows += `<div class="setrow"><span>Set ${j + 1}</span><input type="number" step="0.5" inputmode="decimal" placeholder="kg" data-f="w" data-i="${i}" data-j="${j}" value="${l.weight ?? ""}"><input type="number" inputmode="numeric" placeholder="reps" data-f="r" data-i="${i}" data-j="${j}" value="${l.reps ?? ""}"><input type="number" min="0" max="5" inputmode="numeric" placeholder="RIR" data-f="i" data-i="${i}" data-j="${j}" value="${l.rir ?? ""}"></div>`; }
    return `<div class="ex" data-ex="${x.id}">
      <div class="exh"><b>${esc(e.n)}</b><span class="tag">${n} × ${x.reps[0]}-${x.reps[1]} · RIR ${rirT} · rest ${x.rest}</span></div>
      ${sug ? `<div class="sub">Last: ${esc(sug.last)}<br><span class="good">Next: ${esc(sug.next)}</span></div>` : `<div class="sub">First time. Pick a weight you could do ${x.reps[1] + 3}+ reps with, then work up.</div>`}
      ${flag ? `<div class="note" style="margin:6px 0">${esc(js[flag].n)} pain flagged (${js[flag].level}/10). ${sub ? `Swap to <b>${esc(exName(sub))}</b>? <button class="ghost" data-swap="${x.orig}" data-to="${sub}">Swap</button>` : "Lower the load and range, or ask a physio."}</div>` : ""}
      <details class="mini"><summary>Technique cue</summary><div class="sub">${esc(e.cue || "")}</div></details>
      ${rows}
      <div class="row" style="margin-top:6px"><button class="ghost" data-addset="${i}">+ set</button>${logged.length ? `<button class="ghost" data-clear="${x.id}">Clear logged</button>` : ""}${x.extra ? `<button class="ghost" data-rmx="${x.id}">Remove</button>` : ""}</div>
    </div>`;
  }).join("");

  // volume this week
  const vs = weekSets(mon), rampNote = rf < 1 ? ` (ramp: targets ×${rf})` : "";
  const meters = K.MUSCLES.map(m => { const v = vs[m.k] || 0, lo = m.min * rf, hi = m.max * rf, mx = Math.max(m.max, v) * 1.15;
    const c = v === 0 ? "" : v < lo ? "warn" : v > hi * 1.15 ? "bad" : "good";
    return `<div class="meter"><span class="ml">${m.k}</span><div class="mt"><i class="band" style="left:${lo / mx * 100}%;width:${(hi - lo) / mx * 100}%"></i><i class="fill ${c}" style="width:${Math.min(100, v / mx * 100)}%"></i></div><span class="mv">${fmt(v, 1)} <span class="sub">/ ${fmt(lo, 0)}-${fmt(hi, 0)}</span></span></div>`; }).join("");

  // weekly load ramp
  const monsAll = [...new Set(X.sets.map(s => mondayOf(s.date)))].sort(), cur = mondayOf(todayIso());
  const tot = m => Object.values(weekSets(m)).reduce((a, b) => a + b, 0);
  const prevMons = monsAll.filter(m => m < cur).slice(-3), prevAvg = prevMons.length >= 2 ? avg(prevMons.map(tot)) : null, nowTot = tot(cur);
  let rampMsg = "Needs two completed training weeks to compare.";
  if (prevAvg) { const r = nowTot / prevAvg; rampMsg = r > 1.3 ? `<span class="warn">This week's hard sets (${fmt(nowTot, 0)}) are ${fmt((r - 1) * 100, 0)}% above your recent average (${fmt(prevAvg, 0)}).</span> Jumps of more than ~20% are where tendons and joints complain. Hold here or back off a little.` : r < 0.6 && nowTot > 0 ? `This week is lighter than usual (${fmt(nowTot, 0)} vs ${fmt(prevAvg, 0)}). Fine if it is a deload or a recovery week.` : `<span class="good">Volume is steady</span> (${fmt(nowTot, 0)} hard sets vs ${fmt(prevAvg, 0)} recent average).`; }
  // consecutive training weeks and stalled lifts
  let streak = 0; for (let i = monsAll.length - 1; i >= 0; i--) { const dts = new Set(X.sets.filter(s => mondayOf(s.date) === monsAll[i]).map(s => s.date)); if (dts.size >= 2 || monsAll[i] === cur) streak++; else break; }
  const stalled = []; [...new Set(X.sets.map(s => s.exercise))].forEach(id => { const dts = [...new Set(X.sets.filter(s => s.exercise === id).map(s => s.date))]; if (dts.length < 6) return; const best = ds => Math.max(...X.sets.filter(s => s.exercise === id && ds.includes(s.date) && s.weight != null && s.reps != null).map(epley)); if (best(dts.slice(-3)) <= best(dts.slice(-6, -3))) stalled.push(exName(id)); });
  const deloadMsg = streak >= 6 || stalled.length >= 3 ? `<span class="warn">Consider a deload week.</span> ${streak >= 6 ? `${streak} training weeks in a row. ` : ""}${stalled.length >= 3 ? `Stalled lifts: ${stalled.slice(0, 4).map(esc).join(", ")}. Check sleep and calories first. ` : ""}Halve the sets, keep the weights, leave 3+ reps in reserve.` : `<span class="good">No deload needed yet</span>${streak ? ` (${streak} training week${streak > 1 ? "s" : ""} in a row; plan one at 5-8)` : ""}.`;

  // sessions table
  const bd = {}; X.sets.forEach(s => { const b = bd[s.date] = bd[s.date] || { s: s.session, n: 0, t: 0, ex: new Set() }; b.n++; b.t += (s.weight || 0) * (s.reps || 0); b.ex.add(s.exercise); });
  const sess = Object.keys(bd).sort().reverse().slice(0, 10);
  const loggedEx = [...new Set(X.sets.map(s => s.exercise))];
  if (!LIFT.sel || !loggedEx.includes(LIFT.sel)) LIFT.sel = loggedEx[0] || "";

  sec.innerHTML = `
  <div class="grid">
    <div class="card half ${"rd-" + rd.level}"><h3>Today's readiness</h3><div class="big ${rd.cls}" style="font-size:24px">${rd.label}</div>
      <div class="sub" style="margin-top:6px">${rd.advice}</div>
      <ul class="sig">${rd.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      ${rf < 1 ? `<div class="note">Re-entry ramp on: week ${Math.max(1, wkNo() + 1)} of 3, so sets are scaled to ${Math.round(rf * 100)}% and you stay a rep further from failure. Switch it off in Program if you are already training at full volume.</div>` : ""}
    </div>
    <div class="card half"><h3>Weekly hard sets per muscle${rampNote}</h3>${meters}
      <div class="sub" style="margin-top:6px">A hard set is within 3 reps of failure. Secondary muscles count half. Shaded = target range.</div></div>
    <div class="card wide"><h3>Log a session</h3>
      <div class="row">
        <label>Session<select id="lf_day">${p.days.map((d, i) => `<option value="${i}" ${i === LIFT.day ? "selected" : ""}>${esc(d.name)}: ${esc(d.focus)}</option>`).join("")}</select></label>
        <label>Date<input type="date" id="lf_date" value="${LIFT.date}"></label>
        <label>Add exercise<select id="lf_add"><option value="">choose…</option>${Object.keys(K.EX).map(k => `<option value="${k}">${esc(K.EX[k].n)}</option>`).join("")}</select></label>
        <button class="act" id="lf_save">Save session</button>
      </div>
      <div class="exlist">${blocks}</div>
    </div>
    <div class="card half"><h3>Progress</h3>
      <div class="row" style="margin-top:0"><label>Exercise<select id="lf_sel">${loggedEx.map(id => `<option value="${id}" ${id === LIFT.sel ? "selected" : ""}>${esc(exName(id))}</option>`).join("")}</select></label></div>
      <div class="chart" style="margin-top:8px"><canvas id="c_prog"></canvas></div></div>
    <div class="card half"><h3>Load and deload check</h3>
      <div class="insight">${rampMsg}</div><div class="insight">${deloadMsg}</div>
      <div class="chart" style="height:170px;margin-top:8px"><canvas id="c_wk"></canvas></div></div>
    <div class="card wide"><h3>Joint health</h3>
      <div class="row">
        <label>Date<input type="date" id="jp_date" value="${todayIso()}"></label>
        <label>Joint<select id="jp_j">${K.JOINTS.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></label>
        <label>Pain 0-10<input type="number" min="0" max="10" id="jp_l" style="width:90px"></label>
        <label>During<input id="jp_e" style="width:200px" placeholder="exercise or activity"></label>
        <label>Notes<input id="jp_n" style="width:220px"></label>
        <button class="act" id="jp_add">Log</button>
      </div>
      <div class="chips" style="margin-top:10px">${K.JOINTS.map(([k, n]) => { const s = js[k]; return `<span class="chip stat ${s ? (s.level >= 7 ? "bad" : s.level >= 4 ? "warn" : "good") : ""}">${n}${s ? ` ${s.level}/10` : ""}</span>`; }).join("")}</div>
      <ul class="sig">${K.PAIN_RULES.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      ${X.pain.length ? `<table style="margin-top:8px"><tr><th>Date</th><th>Joint</th><th>Pain</th><th>During</th><th>Notes</th><th></th></tr>${[...X.pain].reverse().slice(0, 10).map(p => `<tr><td>${p.date}</td><td>${esc((K.JOINTS.find(j => j[0] === p.joint) || [0, p.joint])[1])}</td><td>${p.level}/10</td><td>${esc(p.exercise || "")}</td><td>${esc(p.notes || "")}</td><td><button class="ghost" data-pd="${p.id}">×</button></td></tr>`).join("")}</table>` : ""}
    </div>
    <div class="card wide"><h3>Recent sessions</h3>
      ${sess.length ? `<table><tr><th>Date</th><th>Session</th><th>Exercises</th><th>Sets</th><th>Volume (kg)</th></tr>${sess.map(d => `<tr><td>${d}</td><td>${esc(bd[d].s || "")}</td><td>${bd[d].ex.size}</td><td>${bd[d].n}</td><td>${Math.round(bd[d].t).toLocaleString()}</td></tr>`).join("")}</table>` : `<div class="sub">Log your first session above.</div>`}
    </div>
  </div>`;

  // events
  $("lf_day").onchange = e => { LIFT.day = +e.target.value; LIFT.swap = {}; LIFT.extra = []; renderLift(); };
  $("lf_date").onchange = e => { LIFT.date = e.target.value || todayIso(); renderLift(); };
  $("lf_add").onchange = e => { if (e.target.value) { LIFT.extra.push(e.target.value); renderLift(); } };
  $("lf_sel").onchange = e => { LIFT.sel = e.target.value; renderLift(); };
  sec.querySelectorAll("[data-swap]").forEach(b => b.onclick = () => { LIFT.swap[b.dataset.swap] = b.dataset.to; renderLift(); });
  sec.querySelectorAll("[data-rmx]").forEach(b => b.onclick = () => { LIFT.extra.splice(LIFT.extra.indexOf(b.dataset.rmx), 1); renderLift(); });
  sec.querySelectorAll("[data-clear]").forEach(b => b.onclick = async () => { await fetch(`/api/sets/${LIFT.date}/${b.dataset.clear}`, { method: "DELETE" }); await load(); });
  sec.querySelectorAll("[data-addset]").forEach(b => b.onclick = () => {
    const blk = b.closest(".ex"), last = blk.querySelectorAll(".setrow"), j = last.length, i = b.dataset.addset, clone = last[last.length - 1].cloneNode(true);
    clone.querySelector("span").textContent = `Set ${j + 1}`; clone.querySelectorAll("input").forEach(x => { x.dataset.j = j; x.value = ""; }); last[last.length - 1].after(clone);
  });
  $("lf_save").onclick = async () => {
    const out = [];
    sec.querySelectorAll(".ex").forEach(blk => {
      let n = 0; blk.querySelectorAll(".setrow").forEach(r => {
        const w = nz(r.querySelector('[data-f="w"]').value), rep = nz(r.querySelector('[data-f="r"]').value), ri = nz(r.querySelector('[data-f="i"]').value);
        if (w == null && rep == null) return; n++; out.push({ exercise: blk.dataset.ex, set_no: n, weight: w, reps: rep, rir: ri });
      });
    });
    if (!out.length) return;
    await fetch("/api/sets", { method: "POST", body: JSON.stringify({ date: LIFT.date, session: day.name, sets: out }) });
    LIFT.extra = []; LIFT.swap = {}; LIFT.day = null; await load();
  };
  $("jp_add").onclick = async () => {
    if ($("jp_l").value === "") return;
    await fetch("/api/pain", { method: "POST", body: JSON.stringify({ date: $("jp_date").value, joint: $("jp_j").value, level: +$("jp_l").value, exercise: $("jp_e").value, notes: $("jp_n").value }) });
    await load();
  };
  sec.querySelectorAll("[data-pd]").forEach(b => b.onclick = async () => { await fetch("/api/pain/" + b.dataset.pd, { method: "DELETE" }); await load(); });

  // charts
  const pd = [...new Set(X.sets.filter(s => s.exercise === LIFT.sel).map(s => s.date))].sort();
  mkChart("c_prog", { type: "line", data: { labels: pd, datasets: [
    { label: "Est. 1RM (kg)", data: pd.map(d => Math.max(...X.sets.filter(s => s.exercise === LIFT.sel && s.date === d && s.weight != null && s.reps != null).map(epley))), borderColor: col("--acc"), pointRadius: 4, spanGaps: true },
    { label: "Heaviest set (kg)", data: pd.map(d => Math.max(...X.sets.filter(s => s.exercise === LIFT.sel && s.date === d && s.weight != null).map(s => s.weight))), borderColor: col("--good"), borderDash: [5, 4], pointRadius: 3, fill: false }] },
    options: { emptyText: "Log sets to see strength progress." } });
  const wks = monsAll.slice(-8);
  mkChart("c_wk", { type: "bar", data: { labels: wks.map(m => m.slice(5)), datasets: [{ label: "Hard sets", data: wks.map(tot), backgroundColor: col("--acc") }] }, options: { emptyText: "No weekly data yet.", plugins: { legend: { display: false } } } });
}

/* ---------- Program tab ---------- */
function renderProgram() {
  const sec = $("program"), w = +D.settings.workouts_per_week <= 3 ? 3 : 4, p = K.PROGRAMS[w];
  const cards = p.days.map(d => `<div class="card half"><h3>${esc(d.name)}</h3><div class="sub" style="margin-bottom:6px">${esc(d.focus)}</div>
    <table><tr><th>Exercise</th><th>Sets × reps</th><th>RIR</th></tr>${d.ex.map(x => `<tr><td>${esc(exName(x.id))}</td><td>${x.sets} × ${x.reps[0]}-${x.reps[1]}</td><td>${x.rir}</td></tr>`).join("")}</table></div>`).join("");
  const lib = Object.keys(K.EX).map(k => { const e = K.EX[k]; return `<details class="mini"><summary>${esc(e.n)} <span class="sub">· ${e.p.join(", ")}</span></summary>
    <div class="sub">${esc(e.cue)}</div>
    <div class="sub" style="margin-top:4px">Loads: ${e.j.length ? e.j.map(j => (K.JOINTS.find(x => x[0] === j) || [0, j])[1].toLowerCase()).join(", ") : "low joint stress"}${Object.keys(e.subs).length ? ` · If sore: ${Object.keys(e.subs).map(j => `${(K.JOINTS.find(x => x[0] === j) || [0, j])[1].toLowerCase()} → ${esc(exName(e.subs[j]))}`).join("; ")}` : ""} · smallest jump ${e.inc} kg</div></details>`; }).join("");
  sec.innerHTML = `
  <div class="grid">
    <div class="card wide"><h3>Your program</h3>
      <div class="row" style="margin-top:0"><span class="chip ${w === 4 ? "on" : ""}" data-w="4">4 days: Upper / Lower</span><span class="chip ${w === 3 ? "on" : ""}" data-w="3">3 days: Full body</span>
        <label class="chk" style="margin-left:auto"><input type="checkbox" id="pr_ramp" ${rampOn() ? "checked" : ""}> I'm returning after a break (3-week ramp)</label></div>
      <div class="sub" style="margin-top:8px">${esc(p.why)}</div>
      <div class="note">The default is 4 days upper/lower because it matches the workouts-per-week goal in your Plan. The ramp is a cautious start for anyone returning after a break, illness or a steroid course: week 1 at about 60% of the sets, week 2 at 75%, week 3 at 90%, with an extra rep in reserve. Muscle comes back quickly, tendons and bone do not. Untick it if you are already training consistently.</div>
    </div>
    ${cards}
    <div class="card wide"><h3>How the program is built</h3><div class="cols">${K.PRINCIPLES.map(([t, x]) => `<div><b>${esc(t)}</b><div class="sub">${esc(x)}</div></div>`).join("")}</div></div>
    <div class="card half"><h3>Warm-up (about 8 minutes)</h3><ol>${K.WARMUP.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
      <h3 style="margin-top:14px">Weekly hard-set targets</h3><table><tr><th>Muscle</th><th>Sets / week</th></tr>${K.MUSCLES.map(m => `<tr><td>${m.k}</td><td>${m.min}-${m.max}</td></tr>`).join("")}</table></div>
    <div class="card half"><h3>Exercise library, with swaps for a sore joint</h3>${lib}</div>
    <div class="note wide" style="grid-column:1/-1">General training information for a healthy adult, adapted to what you told me. Not a prescription: a physio can assess your technique and any joint that keeps hurting, and your IBD team has the final say on anything that touches your disease or medication.</div>
  </div>`;
  sec.querySelectorAll("[data-w]").forEach(b => b.onclick = async () => { await fetch("/api/settings", { method: "POST", body: JSON.stringify({ workouts_per_week: b.dataset.w }) }); LIFT.day = null; await load(); });
  $("pr_ramp").onchange = async e => { await fetch("/api/settings", { method: "POST", body: JSON.stringify({ lift_ramp: e.target.checked ? "1" : "0" }) }); await load(); };
}
