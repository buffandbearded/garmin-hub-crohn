/* Meal photo -> estimated macros (vision model running locally in Ollama or LM Studio). */
(function () {
  let blob = null, preview = null, RES = null, timer = null;
  const mealByHour = () => { const h = new Date().getHours(); return h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snack"; };
  const num = v => (v === "" || v == null || isNaN(+v)) ? 0 : +v;

  // shrink the photo in the browser: faster upload, and the model does not need 12 megapixels
  function shrink(file, max = 1024) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? resolve({ blob: b, url: c.toDataURL("image/jpeg", .6) }) : reject(), "image/jpeg", 0.85);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  function shell() {
    const el = document.getElementById("mealCard");
    if (!el) return null;
    if (!el.dataset.ready) {
      el.dataset.ready = "1";
      el.innerHTML = `<h3>Meal photo to macros</h3>
        <div class="sub">Take or choose a photo and a vision model on this PC estimates the macros. Nothing leaves your computer. The first photo after a while takes up to ~30 s while the model loads; it unloads itself afterwards to free the GPU.</div>
        <div id="m_saved" class="mchips"></div>
        <div class="mrow">
          <label class="act filebtn">Take / choose photo<input type="file" id="m_file" accept="image/*" hidden></label>
          <label class="ghost filebtn2" title="Photo of the nutrition table on a package">Scan a label<input type="file" id="m_label" accept="image/*" hidden></label>
          <input id="m_note" placeholder="Optional note, e.g. 200 g chicken, 2 tbsp oil" style="flex:1;min-width:180px">
          <button class="act" id="m_go" disabled>Estimate</button>
        </div>
        <div id="m_msg" class="sub"></div>
        <div id="m_out"></div>
        <details class="mini"><summary>Model settings</summary><div id="m_set" class="sub">Loading…</div></details>`;
      document.getElementById("m_file").onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        RES = null; document.getElementById("m_out").innerHTML = "";
        try {
          const r = await shrink(f); blob = r.blob; preview = r.url;
          document.getElementById("m_out").innerHTML = `<img class="mprev" src="${preview}" alt="meal photo">`;
          document.getElementById("m_go").disabled = false;
          document.getElementById("m_msg").textContent = "";
        } catch (_) { document.getElementById("m_msg").textContent = "Could not read that image."; }
      };
      document.getElementById("m_go").onclick = analyze;
      document.getElementById("m_label").onchange = scanLabel;
      document.getElementById("m_saved").onclick = savedClick;
      loadSaved();
      settings();
    }
    return el;
  }

  async function settings() {
    const box = document.getElementById("m_set");
    try {
      const s = await (await fetch("/api/meal/status")).json();
      const name = s.backend === "ollama" ? "Ollama" : "LM Studio";
      box.innerHTML = `<div class="mrow"><label>Engine<select id="m_back"><option value="lmstudio" ${s.backend !== "ollama" ? "selected" : ""}>LM Studio</option><option value="ollama" ${s.backend === "ollama" ? "selected" : ""}>Ollama</option></select></label></div>
        ${name} server: <b>${s.server ? "running" : "stopped (starts automatically with the first photo)"}</b>
        <div class="mrow" style="margin-top:8px">
          <label>Vision model<select id="m_model">${s.models.map(m => `<option ${m === s.model ? "selected" : ""}>${esc(m)}</option>`).join("") || "<option value=''>none installed</option>"}</select></label>
          <label>Unload after idle (min)<input type="number" id="m_ttl" min="1" max="120" value="${Math.round(s.ttl / 60)}" style="width:80px"></label>
          <button class="ghost" id="m_save">Save</button></div>`;
      document.getElementById("m_back").onchange = async e => {
        await fetch("/api/settings", { method: "POST", body: JSON.stringify({ meal_backend: e.target.value, meal_model: "" }) });
        settings();
      };
      document.getElementById("m_save").onclick = async () => {
        await fetch("/api/settings", { method: "POST", body: JSON.stringify({ meal_model: document.getElementById("m_model").value, meal_ttl: Math.max(1, num(document.getElementById("m_ttl").value)) * 60 }) });
        document.getElementById("m_save").textContent = "Saved";
      };
    } catch (_) { box.textContent = "Could not read the AI engine status."; }
  }

  async function analyze() {
    if (!blob) return;
    const go = document.getElementById("m_go"), msg = document.getElementById("m_msg");
    go.disabled = true;
    const t0 = Date.now();
    const tick = () => { msg.innerHTML = `<span class="spin"></span> Analysing… ${Math.round((Date.now() - t0) / 1000)} s`; };
    tick(); timer = setInterval(tick, 1000);
    const fd = new FormData();
    fd.append("image", blob, "meal.jpg"); fd.append("note", document.getElementById("m_note").value);
    let d;
    try { d = await (await fetch("/api/meal/scan", { method: "POST", body: fd })).json(); }
    catch (_) { d = { error: "Could not reach the hub." }; }
    clearInterval(timer); go.disabled = false;
    if (d.error) { msg.textContent = d.error; return; }
    msg.textContent = ""; RES = d; RES.items.forEach(perGram); renderResult();
    settings();
  }

  /* ---------- favourites and label scan ---------- */
  let SAVED = [];
  async function loadSaved() {
    try { SAVED = await (await fetch("/api/meal/saved")).json(); } catch (_) { SAVED = []; }
    const box = document.getElementById("m_saved");
    if (!box) return;
    box.innerHTML = SAVED.length ? `<span class="sub">Saved meals:</span> ` + SAVED.map(m => `<span class="mchip"><button class="ghost" data-fav="${m.id}" title="${Math.round(m.total.kcal)} kcal">${esc(m.name)} <span class="sub">${Math.round(m.total.kcal)}</span></button><button class="ghost x" data-favdel="${m.id}" title="Delete">×</button></span>`).join("") : "";
  }
  function perGram(it) { const g = num(it.grams); if (g > 0) it._p = { kcal: it.kcal / g, protein_g: it.protein_g / g, carbs_g: it.carbs_g / g, fat_g: it.fat_g / g }; return it; }
  function rescale(it, row) {
    if (!it._p) return;
    const g = num(it.grams);
    for (const k of ["kcal", "protein_g", "carbs_g", "fat_g"]) { it[k] = Math.round(it._p[k] * g * 10) / 10; const inp = row.querySelector(`[data-f="${k}"]`); if (inp) inp.value = it[k]; }
  }
  async function savedClick(e) {
    const use = e.target.closest("[data-fav]"), del = e.target.closest("[data-favdel]");
    if (use) {
      const m = SAVED.find(x => x.id == use.dataset.fav); if (!m) return;
      RES = { dish: m.name, items: m.items.map(i => perGram({ ...i })), gluten: m.gluten, lactose: m.lactose, confidence: "high", notes: "", seconds: 0, favId: m.id, fav: true };
      preview = null; document.getElementById("m_msg").textContent = ""; renderResult();
    } else if (del) {
      await fetch("/api/meal/saved/" + del.dataset.favdel, { method: "DELETE" }); loadSaved();
    }
  }
  async function scanLabel(e) {
    const f = e.target.files[0]; if (!f) return;
    const msg = document.getElementById("m_msg"), out = document.getElementById("m_out");
    RES = null; out.innerHTML = "";
    const t0 = Date.now(), tick = () => { msg.innerHTML = `<span class="spin"></span> Reading the label… ${Math.round((Date.now() - t0) / 1000)} s`; };
    tick(); const iv = setInterval(tick, 1000);
    let d;
    try {
      const r = await shrink(f, 1600);
      const fd = new FormData(); fd.append("image", r.blob, "label.jpg"); preview = r.url;
      d = await (await fetch("/api/meal/label", { method: "POST", body: fd })).json();
    } catch (_) { d = { error: "Could not read that image." }; }
    clearInterval(iv); e.target.value = "";
    if (d.error) { msg.textContent = d.error; return; }
    const g = d.serving_g > 0 ? d.serving_g : 100, p = d.per100, k = g / 100;
    const it = { name: d.name, grams: g, kcal: p.kcal * k, protein_g: p.protein * k, carbs_g: p.carbs * k, fat_g: p.fat * k };
    it._p = { kcal: p.kcal / 100, protein_g: p.protein / 100, carbs_g: p.carbs / 100, fat_g: p.fat / 100 };
    ["kcal", "protein_g", "carbs_g", "fat_g"].forEach(x => it[x] = Math.round(it[x] * 10) / 10);
    msg.textContent = "";
    RES = { dish: d.name, items: [it], gluten: d.gluten, lactose: d.lactose, confidence: d.check ? "low" : "high", seconds: d.seconds, label: true,
      notes: `From the label, per 100 g: ${Math.round(p.kcal)} kcal, protein ${p.protein} g, carbs ${p.carbs} g, fat ${p.fat} g. Set the grams you ate${d.serving_g > 0 ? ` (one serving is ${d.serving_g} g)` : ""}.${d.check ? " The numbers do not add up, so check them against the package." : ""}` };
    renderResult();
  }
  async function saveFav() {
    const name = document.getElementById("m_fname").value.trim() || RES.dish, btn = document.getElementById("m_fav"), msg = document.getElementById("m_msg");
    const r = await (await fetch("/api/meal/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, items: RES.items, gluten: document.getElementById("m_g").checked, lactose: document.getElementById("m_l").checked }) })).json();
    if (r.error) { msg.textContent = r.error; return; }
    btn.textContent = "Saved ✓"; btn.disabled = true; loadSaved();
  }

  function totals() {
    const t = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    RES.items.forEach(i => { for (const k in t) t[k] += num(i[k]); });
    return t;
  }
  function sumRow() {
    const t = totals();
    document.getElementById("m_tot").innerHTML = `<b>${Math.round(t.kcal)}</b> kcal · protein <b>${Math.round(t.protein_g)}</b> g · carbs <b>${Math.round(t.carbs_g)}</b> g · fat <b>${Math.round(t.fat_g)}</b> g`;
  }

  function renderResult() {
    const out = document.getElementById("m_out"), conf = { low: "bad", medium: "warn", high: "good" }[RES.confidence] || "warn";
    const F = [["grams", "g"], ["kcal", "kcal"], ["protein_g", "P g"], ["carbs_g", "C g"], ["fat_g", "F g"]];
    out.innerHTML = `${preview ? `<img class="mprev" src="${preview}" alt="meal photo">` : ""}
      <div class="mhead"><b>${esc(RES.dish)}</b> ${RES.fav ? `<span class="sub">· saved meal, change grams to rescale</span>` : RES.label ? `<span class="${conf}">· label</span>` : `<span class="${conf}">· ${RES.confidence} confidence</span><span class="sub"> · ${RES.seconds}s</span>`}</div>
      ${RES.notes ? `<div class="sub">${esc(RES.notes)}</div>` : ""}
      <div class="mitems">${RES.items.map((it, n) => `<div class="mitem" data-n="${n}">
        <input class="mname" data-f="name" value="${esc(it.name)}">
        <button class="ghost" data-del="${n}" title="Remove">×</button>
        ${F.map(([k, l]) => `<label><span>${l}</span><input type="number" step="any" data-f="${k}" value="${it[k]}"></label>`).join("")}</div>`).join("")}</div>
      <div class="mrow"><button class="ghost" id="m_add">+ Add item</button>
        <label>Meal<select id="m_meal">${["breakfast", "lunch", "dinner", "snack"].map(m => `<option ${m === mealByHour() ? "selected" : ""}>${m}</option>`).join("")}</select></label>
        <label class="chk"><input type="checkbox" id="m_g" ${RES.gluten ? "checked" : ""}> contains gluten</label>
        <label class="chk"><input type="checkbox" id="m_l" ${RES.lactose ? "checked" : ""}> contains lactose</label></div>
      <div class="mtot" id="m_tot"></div>
      ${RES.fav || RES.label ? "" : `<div class="sub">An estimate from a photo can easily be 20–30% off, especially for oil, sauces and portion size. Correct the numbers above before saving.</div>`}
      <div class="mrow"><button class="act" id="m_save_meal">Add to today</button><button class="ghost" id="m_drop">Discard</button></div>
      ${RES.fav ? "" : `<div class="mrow"><label>Save as a favourite<input id="m_fname" value="${esc(RES.dish)}" style="width:220px"></label><button class="ghost" id="m_fav">Save meal</button></div>`}`;
    sumRow();
    out.oninput = e => {
      const row = e.target.closest(".mitem"); if (!row || !e.target.dataset.f) return;
      const f = e.target.dataset.f, it = RES.items[+row.dataset.n];
      it[f] = f === "name" ? e.target.value : num(e.target.value);
      if (f === "grams") rescale(it, row);
      sumRow();
    };
    out.onclick = async e => {
      if (e.target.dataset.del != null) { RES.items.splice(+e.target.dataset.del, 1); renderResult(); }
      if (e.target.id === "m_add") { RES.items.push({ name: "", grams: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }); renderResult(); }
      if (e.target.id === "m_drop") { RES = null; blob = null; preview = null; out.innerHTML = ""; document.getElementById("m_go").disabled = true; document.getElementById("m_file").value = ""; }
      if (e.target.id === "m_save_meal") save();
      if (e.target.id === "m_fav") saveFav();
    };
  }

  async function save() {
    const t = totals(), btn = document.getElementById("m_save_meal");
    const names = RES.items.map(i => i.name.trim()).filter(Boolean);
    if (!names.length) return;
    btn.disabled = true;
    const day = todayIso(), now = new Date().toTimeString().slice(0, 5);
    const post = async (url, body) => {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(url + " returned " + r.status);
    };
    const say = (html, cls) => { const m = document.getElementById("m_msg"); if (m) { m.className = cls || "good"; m.innerHTML = html; m.scrollIntoView({ block: "nearest" }); } };
    try {
      await post("/api/food", { date: day, time: now, meal: document.getElementById("m_meal").value, foods: names.join(", "), recipe: "",
        gluten: document.getElementById("m_g").checked ? 1 : 0, lactose: document.getElementById("m_l").checked ? 1 : 0, reaction: null,
        notes: `Photo estimate: ${Math.round(t.kcal)} kcal, P ${Math.round(t.protein_g)} g, C ${Math.round(t.carbs_g)} g, F ${Math.round(t.fat_g)} g` });
      await post("/api/log/add", { date: day, kcal_in: Math.round(t.kcal), protein_g: Math.round(t.protein_g) });
    } catch (e) {
      btn.disabled = false;
      say("Could not save: " + esc(e.message), "bad");
      return;
    }
    if (RES.favId) { try { await fetch("/api/meal/saved/" + RES.favId + "/use", { method: "POST" }); } catch (_) {} }
    RES = null; blob = null; preview = null;
    await load();   // refreshes the log and today's totals
    say(`Added to today: <b>${Math.round(t.kcal)}</b> kcal, <b>${Math.round(t.protein_g)}</b> g protein (${esc(names.join(", "))}). It is in the food list below and in today's calories.`);
  }

  window.renderMeal = function () { shell(); };
})();
