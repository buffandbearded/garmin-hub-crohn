/* Doctor report: a printable health summary in English or Croatian, built from the data already in the hub.
   Print it, or choose "Save as PDF" in the print dialog. Relies on globals from index.html: D, X, K, $, avg, esc, daysAgo, todayIso, load. */
(function () {
  let LANG = "en", MONTHS = 3;
  try { LANG = localStorage.getItem("rp_lang") || "en"; MONTHS = +(localStorage.getItem("rp_months") || 3); } catch (_) { /* storage blocked: defaults */ }

  const T = {
    en: {
      title: "Health summary", sub: "Self-tracked data (Garmin watch and personal logs) prepared for a clinical visit",
      patient: "Patient", period: "Period", generated: "Generated", name_ph: "Your name",
      s_summary: "Summary", s_trend: "Trends", s_weekly: "Overview by period", s_labs: "Laboratory results", s_meds: "Medication and history",
      s_food: "Food and reactions", s_act: "Physical activity", s_q: "Questions for the doctor", s_notes: "Notes",
      k_days: "Days with symptom entries", k_hbi: "Approx. Harvey-Bradshaw index (average / latest)", k_stools: "Stools per day (average)",
      k_liquid: "Liquid stools per day (average)", k_pain: "Abdominal pain 0-10 (average)", k_urg: "Urgency 0-10 (average)", k_fat: "Fatigue 0-10 (average)",
      k_blood: "Days with blood in stool", k_night: "Days with night-time stools", k_fever: "Days with fever", k_joint: "Days with joint pain",
      k_weight: "Weight (start → end)", k_rhr: "Resting heart rate (average)", k_hrv: "HRV overnight (average)", k_sleep: "Sleep per night (average)",
      hbi_note: "The index is approximate: it is calculated from self-reported general wellbeing, abdominal pain and liquid stools (plus one point for joint symptoms). There was no abdominal examination, so it is not a clinical score. Below 5 is the usual remission range.",
      band: ["Remission range", "Mild activity", "Moderate activity", "Severe activity"],
      c_hbi: "Approx. HBI (weekly average)", c_weight: "Weight (kg)", c_hrv: "HRV overnight (ms)", c_rhr: "Resting heart rate (bpm)",
      th_period: "Period", th_logged: "Days logged", th_hbi: "HBI", th_st: "Stools/day", th_pain: "Pain", th_blood: "Blood (days)", th_sleep: "Sleep (h)", th_hrv: "HRV", th_rhr: "Resting HR", th_w: "Weight (kg)",
      week_of: "Week of", noData: "No data in this period.",
      l_marker: "Marker", l_latest: "Latest result", l_ref: "Reference", l_status: "Status", l_prev: "Earlier results", l_trend: "Trend",
      l_in: "in range", l_low: "low", l_high: "high", l_note: "Reference ranges are generic ones used by the hub. The range printed on the laboratory's own report applies.", l_none: "No laboratory results logged.",
      m_list: "Medication list", m_name: "Medication", m_dose: "Dose", m_sched: "Schedule", m_start: "Started", m_notes: "Notes", m_none: "No medication entered.",
      f_treat: "Treatment history (as written)", f_mre: "Imaging (MR enterography)", f_scope: "Endoscopy (colonoscopy / gastroscopy)", f_other: "Other notes", f_orig: "Entered in the hub; shown in the language it was written in.",
      fd_intro: "Meals logged: {n}. Meals with a reaction: {r}.", fd_gl: "Reaction rate with gluten {a} ({na} meals) vs without {b} ({nb} meals).", fd_la: "Reaction rate with lactose {a} ({na} meals) vs without {b} ({nb} meals).",
      fd_th: ["Date", "Meal", "Foods", "Reaction", "Pain / bloating / nausea / toilet"], fd_none: "No meals with a reaction in this period.",
      react: ["none", "mild", "bad"], meals: { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snack" },
      act: "{n} sessions, {h} h in total, {w} per week on average.", act_none: "No activities recorded in this period.",
      q_ph: "Write questions to ask at the appointment", q_none: "",
      disc: "This summary was generated from personal tracking. It is not a medical record or a diagnosis. Garmin values are estimates from a wrist sensor. Everything marked approximate should be read as a pointer for discussion, not as a measurement.",
      print: "Print / Save as PDF", lang: "Language", per: "Period", months: ["3 months", "6 months", "12 months"], hint: "Tip: in the print dialog choose “Save as PDF”. On a phone use Share → Print.",
      unitsh: "h", of: "of",
    },
    hr: {
      title: "Zdravstveni sažetak", sub: "Samostalno praćeni podaci (Garmin sat i osobni zapisi) pripremljeni za liječnički pregled",
      patient: "Pacijent", period: "Razdoblje", generated: "Izrađeno", name_ph: "Vaše ime",
      s_summary: "Sažetak", s_trend: "Trendovi", s_weekly: "Pregled po razdobljima", s_labs: "Laboratorijski nalazi", s_meds: "Lijekovi i povijest bolesti",
      s_food: "Prehrana i reakcije", s_act: "Tjelesna aktivnost", s_q: "Pitanja za liječnika", s_notes: "Napomene",
      k_days: "Dana s unesenim simptomima", k_hbi: "Približni Harvey-Bradshaw indeks (prosjek / zadnji)", k_stools: "Stolica na dan (prosjek)",
      k_liquid: "Tekućih stolica na dan (prosjek)", k_pain: "Bol u trbuhu 0-10 (prosjek)", k_urg: "Hitnost stolice 0-10 (prosjek)", k_fat: "Umor 0-10 (prosjek)",
      k_blood: "Dana s krvlju u stolici", k_night: "Dana s noćnim stolicama", k_fever: "Dana s vrućicom", k_joint: "Dana s bolovima u zglobovima",
      k_weight: "Tjelesna težina (početak → kraj)", k_rhr: "Srčana frekvencija u mirovanju (prosjek)", k_hrv: "HRV tijekom noći (prosjek)", k_sleep: "San po noći (prosjek)",
      hbi_note: "Indeks je približan: izračunat je iz samoprocjene općeg stanja, boli u trbuhu i tekućih stolica (uz jedan bod za zglobne simptome). Nije bilo pregleda trbuha, pa to nije klinički izračunat indeks. Vrijednost ispod 5 uobičajeno odgovara remisiji.",
      band: ["Raspon remisije", "Blaga aktivnost", "Umjerena aktivnost", "Teška aktivnost"],
      c_hbi: "Približni HBI (tjedni prosjek)", c_weight: "Tjelesna težina (kg)", c_hrv: "HRV tijekom noći (ms)", c_rhr: "Puls u mirovanju (otkucaja/min)",
      th_period: "Razdoblje", th_logged: "Dana unosa", th_hbi: "HBI", th_st: "Stolica/dan", th_pain: "Bol", th_blood: "Krv (dani)", th_sleep: "San (h)", th_hrv: "HRV", th_rhr: "Puls u mirovanju", th_w: "Težina (kg)",
      week_of: "Tjedan od", noData: "Nema podataka u ovom razdoblju.",
      l_marker: "Pokazatelj", l_latest: "Zadnji rezultat", l_ref: "Referentni raspon", l_status: "Status", l_prev: "Raniji rezultati", l_trend: "Kretanje",
      l_in: "u rasponu", l_low: "nisko", l_high: "visoko", l_note: "Prikazani su opći referentni rasponi koje koristi aplikacija. Vrijedi raspon otisnut na nalazu laboratorija koji ga je izdao.", l_none: "Nema unesenih laboratorijskih nalaza.",
      m_list: "Popis lijekova", m_name: "Lijek", m_dose: "Doza", m_sched: "Raspored", m_start: "Početak", m_notes: "Napomena", m_none: "Nema unesenih lijekova.",
      f_treat: "Povijest liječenja (kako je zapisano)", f_mre: "Slikovna dijagnostika (MR enterografija)", f_scope: "Endoskopija (kolonoskopija / gastroskopija)", f_other: "Ostale bilješke", f_orig: "Uneseno u aplikaciju; prikazano na jeziku na kojem je zapisano.",
      fd_intro: "Zabilježenih obroka: {n}. Obroka s reakcijom: {r}.", fd_gl: "Udio obroka s reakcijom uz gluten {a} ({na} obroka), bez glutena {b} ({nb} obroka).", fd_la: "Udio obroka s reakcijom uz laktozu {a} ({na} obroka), bez laktoze {b} ({nb} obroka).",
      fd_th: ["Datum", "Obrok", "Namirnice", "Reakcija", "Bol / nadutost / mučnina / stolica"], fd_none: "Nema obroka s reakcijom u ovom razdoblju.",
      react: ["bez reakcije", "blaga", "jaka"], meals: { breakfast: "doručak", lunch: "ručak", dinner: "večera", snack: "užina" },
      act: "{n} treninga, ukupno {h} h, u prosjeku {w} tjedno.", act_none: "Nema zabilježenih aktivnosti u ovom razdoblju.",
      q_ph: "Napišite pitanja za pregled", q_none: "",
      disc: "Ovaj sažetak izrađen je iz osobnog praćenja. Nije medicinski karton niti dijagnoza. Garmin vrijednosti su procjene sa senzora na zapešću. Sve označeno kao približno treba shvatiti kao smjernicu za razgovor, a ne kao mjerenje.",
      print: "Ispiši / spremi kao PDF", lang: "Jezik", per: "Razdoblje", months: ["3 mjeseca", "6 mjeseci", "12 mjeseci"], hint: "Savjet: u prozoru za ispis odaberite „Spremi kao PDF”. Na mobitelu: Podijeli → Ispis.",
      unitsh: "h", of: "od",
    },
  };
  const LABHR = { crp: "CRP", calpro: "Fekalni kalprotektin", ferritin: "Feritin", hb: "Hemoglobin", b12: "Vitamin B12", vitd: "Vitamin D (25-OH)", folate: "Folati", albumin: "Albumin", zinc: "Cink",
    alt: "ALT", ast: "AST", wbc: "Leukociti (L)", lymph: "Limfociti", neut: "Neutrofili", creat: "Kreatinin", ifx: "Infliksimab (najniža razina)", tgn: "6-TGN (azatioprin)", mcv: "MCV", plt: "Trombociti",
    k: "Kalij", mg: "Magnezij", ca: "Kalcij", glucose: "Glukoza (natašte)", tsh: "TSH", ft4: "Slobodni T4", testo: "Testosteron (ukupni)", cortisol: "Kortizol (jutarnji)", ldl: "LDL kolesterol" };

  const t = k => (T[LANG][k] != null ? T[LANG][k] : T.en[k]);
  const MON = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
  const dstr = iso => { if (!iso) return "–"; const [y, m, d] = iso.split("-"); return LANG === "hr" ? `${+d}.${+m}.${y}.` : `${+d} ${MON.en[+m - 1]} ${y}`; };
  const short = iso => { const [, m, d] = iso.split("-"); return LANG === "hr" ? `${+d}.${+m}.` : `${+d} ${MON.en[+m - 1]}`; };
  const num = (v, d = 1) => { if (v == null || isNaN(v)) return "–"; const s = (+v).toFixed(d); return LANG === "hr" ? s.replace(".", ",") : s; };
  const rng = (a, b) => `${num(a, a % 1 ? 1 : 0)}–${num(b, b % 1 ? 1 : 0)}`;
  const A = a => { a = a.filter(v => v != null && !isNaN(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
  const hbiOf = s => (s && s.wellbeing != null && s.pain != null && s.liquid != null)
    ? s.wellbeing + (s.pain <= 0 ? 0 : s.pain <= 3 ? 1 : s.pain <= 6 ? 2 : 3) + s.liquid + (s.joints ? 1 : 0) : null;
  const bandOf = v => v == null ? "–" : t("band")[v < 5 ? 0 : v < 8 ? 1 : v < 17 ? 2 : 3];

  /* ---------- small SVG chart (prints crisply, no canvas) ---------- */
  function chart(title, labels, vals, opt = {}) {
    const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null && !isNaN(p[1]));
    if (pts.length < 2) return `<div class="rp-chart"><div class="rp-ct">${esc(title)}</div><div class="rp-sub">${t("noData")}</div></div>`;
    const W = 330, H = 110, L = 34, R = 8, Tp = 8, B = 20;
    let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
    if (opt.min != null) lo = Math.min(lo, opt.min);
    if (opt.ref) { lo = Math.min(lo, ...opt.ref.map(r => r[0])); hi = Math.max(hi, ...opt.ref.map(r => r[0])); }
    if (hi === lo) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const x = i => L + (vals.length === 1 ? 0 : (i / (vals.length - 1)) * (W - L - R));
    const y = v => Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - B);
    const poly = pts.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
    const refs = (opt.ref || []).map(r => `<line x1="${L}" x2="${W - R}" y1="${y(r[0]).toFixed(1)}" y2="${y(r[0]).toFixed(1)}" stroke="#888" stroke-dasharray="4 3" stroke-width=".8"/><text x="${W - R}" y="${(y(r[0]) - 2).toFixed(1)}" text-anchor="end" font-size="8" fill="#666">${esc(r[1])}</text>`).join("");
    const last = pts[pts.length - 1];
    return `<div class="rp-chart"><div class="rp-ct">${esc(title)}</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(title)}">
        <line x1="${L}" x2="${L}" y1="${Tp}" y2="${H - B}" stroke="#bbb" stroke-width=".8"/><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#bbb" stroke-width=".8"/>
        <text x="${L - 4}" y="${Tp + 6}" text-anchor="end" font-size="8.5" fill="#555">${num(hi - pad, hi - pad >= 100 ? 0 : 1)}</text>
        <text x="${L - 4}" y="${H - B}" text-anchor="end" font-size="8.5" fill="#555">${num(lo + pad, lo + pad >= 100 ? 0 : 1)}</text>
        ${refs}
        <polyline points="${poly}" fill="none" stroke="#1a5fb4" stroke-width="1.6" stroke-linejoin="round"/>
        ${pts.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="1.9" fill="#1a5fb4"/>`).join("")}
        <text x="${L}" y="${H - 6}" font-size="8.5" fill="#555">${esc(labels[0])}</text>
        <text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="8.5" fill="#555">${esc(labels[labels.length - 1])}</text>
        <text x="${(x(last[0]) - 5).toFixed(1)}" y="${(y(last[1]) - 6).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="700" fill="#111">${num(last[1], opt.dec == null ? 1 : opt.dec)}</text>
      </svg></div>`;
  }
  function spark(vals, lo, hi) {
    const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
    if (pts.length < 2) return "";
    const W = 90, H = 22;
    let mn = Math.min(...pts.map(p => p[1]), lo), mx = Math.max(...pts.map(p => p[1]), hi);
    if (mx === mn) mx += 1;
    const x = i => 2 + (i / (vals.length - 1)) * (W - 4), y = v => 2 + (1 - (v - mn) / (mx - mn)) * (H - 4);
    return `<svg viewBox="0 0 ${W} ${H}" width="90" height="22"><rect x="2" y="${y(hi).toFixed(1)}" width="${W - 4}" height="${Math.max(1, y(lo) - y(hi)).toFixed(1)}" fill="#e6f2e6"/>
      <polyline points="${pts.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="#1a5fb4" stroke-width="1.3"/>
      <circle cx="${x(pts[pts.length - 1][0]).toFixed(1)}" cy="${y(pts[pts.length - 1][1]).toFixed(1)}" r="1.8" fill="#1a5fb4"/></svg>`;
  }

  /* ---------- data ---------- */
  function weekStart(iso) { const d = new Date(iso + "T00:00:00Z"), k = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - k); return d.toISOString().slice(0, 10); }
  function bucketKey(iso) { return MONTHS > 6 ? iso.slice(0, 7) : weekStart(iso); }
  function bucketLabel(k) { if (k.length === 7) { const [y, m] = k.split("-"); return `${LANG === "hr" ? m + "." : MON.en[+m - 1]} ${y}`; } return short(k); }

  function gather() {
    const from = daysAgo(MONTHS * 30), to = todayIso();
    const dl = D.daily.filter(d => d.date >= from && d.date <= to);
    const sy = X.symptoms.filter(s => s.date >= from && s.date <= to);
    const food = FOOD.filter(f => f.date >= from && f.date <= to);
    const acts = D.activities.filter(a => a.date >= from && a.date <= to);
    const labs = X.labs;
    const keys = new Set([...dl.map(d => bucketKey(d.date)), ...sy.map(s => bucketKey(s.date))]);
    const rows = [...keys].sort().map(k => {
      const d = dl.filter(x => bucketKey(x.date) === k), s = sy.filter(x => bucketKey(x.date) === k);
      return { k, n: s.length, hbi: A(s.map(hbiOf)), st: A(s.map(x => x.stools)), pain: A(s.map(x => x.pain)), blood: s.filter(x => x.blood).length,
        sleep: A(d.map(x => x.sleep_sec == null ? null : x.sleep_sec / 3600)), hrv: A(d.map(x => x.hrv_avg)), rhr: A(d.map(x => x.rhr)), w: A(d.map(x => x.weight_kg)) };
    });
    return { from, to, dl, sy, food, acts, labs, rows };
  }

  /* ---------- sections ---------- */
  function summary(g) {
    const { sy, dl } = g, hb = sy.map(hbiOf).filter(v => v != null);
    const lastH = [...sy].reverse().map(hbiOf).find(v => v != null);
    const w = dl.filter(d => d.weight_kg != null);
    const row = (k, v) => `<tr><td>${t(k)}</td><td><b>${v}</b></td></tr>`;
    const cnt = f => sy.filter(f).length;
    return `<table class="rp-kv">
      ${row("k_days", sy.length)}
      ${row("k_hbi", hb.length ? `${num(A(hb))} / ${lastH != null ? lastH : "–"} (${bandOf(lastH)})` : "–")}
      ${row("k_stools", num(A(sy.map(s => s.stools))))}${row("k_liquid", num(A(sy.map(s => s.liquid))))}
      ${row("k_pain", num(A(sy.map(s => s.pain))))}${row("k_urg", num(A(sy.map(s => s.urgency))))}${row("k_fat", num(A(sy.map(s => s.fatigue))))}
      ${row("k_blood", cnt(s => s.blood))}${row("k_night", cnt(s => s.night))}${row("k_fever", cnt(s => s.fever))}${row("k_joint", cnt(s => s.joints))}
      ${row("k_weight", w.length ? `${num(w[0].weight_kg)} → ${num(w[w.length - 1].weight_kg)} kg` : "–")}
      ${row("k_rhr", `${num(A(dl.map(d => d.rhr)), 0)} bpm`)}${row("k_hrv", `${num(A(dl.map(d => d.hrv_avg)), 0)} ms`)}
      ${row("k_sleep", `${num(A(dl.map(d => d.sleep_sec == null ? null : d.sleep_sec / 3600)))} ${t("unitsh")}`)}
    </table><p class="rp-sub">${t("hbi_note")}</p>`;
  }
  function trends(g) {
    const L = g.rows.map(r => bucketLabel(r.k));
    return `<div class="rp-charts">${chart(t("c_hbi"), L, g.rows.map(r => r.hbi), { min: 0, ref: [[5, "5"]] })}${chart(t("c_weight"), L, g.rows.map(r => r.w))}
      ${chart(t("c_hrv"), L, g.rows.map(r => r.hrv), { dec: 0 })}${chart(t("c_rhr"), L, g.rows.map(r => r.rhr), { dec: 0 })}</div>`;
  }
  function weekly(g) {
    if (!g.rows.length) return `<p class="rp-sub">${t("noData")}</p>`;
    const th = ["th_period", "th_logged", "th_hbi", "th_st", "th_pain", "th_blood", "th_sleep", "th_hrv", "th_rhr", "th_w"].map(k => `<th>${t(k)}</th>`).join("");
    const body = g.rows.map(r => `<tr><td>${esc((MONTHS > 6 ? "" : t("week_of") + " ") + bucketLabel(r.k))}</td><td>${r.n || "–"}</td><td>${num(r.hbi)}</td><td>${num(r.st)}</td><td>${num(r.pain)}</td><td>${r.n ? r.blood : "–"}</td>
      <td>${num(r.sleep)}</td><td>${num(r.hrv, 0)}</td><td>${num(r.rhr, 0)}</td><td>${num(r.w)}</td></tr>`).join("");
    return `<table class="rp-t"><tr>${th}</tr>${body}</table>`;
  }
  function labs(g) {
    const byM = {}; g.labs.forEach(l => (byM[l.marker] = byM[l.marker] || []).push(l));
    const keys = Object.keys(K.LABS).filter(k => byM[k] && byM[k].some(l => l.date >= daysAgo(MONTHS * 30 + 365)));
    if (!keys.length) return `<p class="rp-sub">${t("l_none")}</p>`;
    const body = keys.map(k => {
      const a = byM[k].slice().sort((x, y) => x.date.localeCompare(y.date)), l = a[a.length - 1], R = K.LABS[k], prev = a.slice(-6, -1).reverse();
      const st = l.value < R.lo ? ["l_low", "rp-warn"] : l.value > R.hi ? ["l_high", "rp-warn"] : ["l_in", "rp-ok"];
      const name = LANG === "hr" ? (LABHR[k] || R.n) : R.n;
      return `<tr><td><b>${esc(name)}</b></td><td><b>${num(l.value, l.value % 1 ? 2 : 0)}</b> ${esc(l.unit || R.u)}<div class="rp-sub">${dstr(l.date)}</div></td>
        <td>${rng(R.lo, R.hi)} ${esc(R.u)}</td><td class="${st[1]}">${t(st[0])}</td>
        <td class="rp-sub">${prev.map(p => `${num(p.value, p.value % 1 ? 2 : 0)} (${short(p.date)}${p.date.slice(0, 4) !== l.date.slice(0, 4) ? " " + p.date.slice(0, 4) : ""})`).join("; ") || "–"}</td>
        <td>${spark(a.slice(-8).map(p => p.value), R.lo, R.hi)}</td></tr>`;
    }).join("");
    return `<table class="rp-t"><tr><th>${t("l_marker")}</th><th>${t("l_latest")}</th><th>${t("l_ref")}</th><th>${t("l_status")}</th><th>${t("l_prev")}</th><th>${t("l_trend")}</th></tr>${body}</table><p class="rp-sub">${t("l_note")}</p>`;
  }
  function meds() {
    const S = D.settings, M = window.MEDS_ROWS || [];
    const list = M.length ? `<table class="rp-t"><tr><th>${t("m_name")}</th><th>${t("m_dose")}</th><th>${t("m_sched")}</th><th>${t("m_start")}</th><th>${t("m_notes")}</th></tr>
      ${M.map(m => `<tr><td><b>${esc(m.name)}</b></td><td>${esc(m.dose)}</td><td>${esc(m.schedule)}</td><td>${m.started ? dstr(m.started) : "–"}</td><td>${esc(m.notes)}</td></tr>`).join("")}</table>` : `<p class="rp-sub">${t("m_none")}</p>`;
    const blocks = [["crohn_meds", "f_treat"], ["crohn_mre", "f_mre"], ["crohn_scopes", "f_scope"], ["crohn_notes", "f_other"]]
      .filter(([k]) => (S[k] || "").trim()).map(([k, h]) => `<h4>${t(h)}</h4><div class="rp-pre">${esc(S[k])}</div>`).join("");
    return `<h4>${t("m_list")}</h4>${list}${blocks ? `${blocks}<p class="rp-sub">${t("f_orig")}</p>` : ""}`;
  }
  function food(g) {
    const rated = g.food.filter(f => f.reaction != null), bad = g.food.filter(f => f.reaction > 0);
    const rate = (a) => a.length ? Math.round(100 * a.filter(f => f.reaction > 0).length / a.length) + "%" : "–";
    const cmp = (key, tpl) => {
      const w = rated.filter(f => f[key]), wo = rated.filter(f => !f[key]);
      return w.length >= 4 && wo.length >= 4 ? `<p class="rp-sub">${fill(t(tpl), { a: rate(w), na: w.length, b: rate(wo), nb: wo.length })}</p>` : "";
    };
    const rows = bad.slice(0, 20).map(f => `<tr><td>${dstr(f.date)}</td><td>${esc(t("meals")[(f.meal || "").toLowerCase()] || f.meal || "")}</td><td>${esc(f.foods)}</td>
      <td class="${f.reaction > 1 ? "rp-warn" : ""}">${t("react")[f.reaction] || ""}</td><td>${[f.pain, f.bloating, f.nausea, f.toilet].map(v => (v == null ? "–" : v)).join(" / ")}</td></tr>`).join("");
    return `<p>${fill(t("fd_intro"), { n: g.food.length, r: bad.length })}</p>${cmp("gluten", "fd_gl")}${cmp("lactose", "fd_la")}
      ${rows ? `<table class="rp-t"><tr>${t("fd_th").map(h => `<th>${h}</th>`).join("")}</tr>${rows}</table>` : `<p class="rp-sub">${t("fd_none")}</p>`}`;
  }
  function activity(g) {
    if (!g.acts.length) return `<p class="rp-sub">${t("act_none")}</p>`;
    const mins = g.acts.reduce((s, a) => s + (a.duration_min || 0), 0), weeks = (MONTHS * 30) / 7;
    return `<p>${fill(t("act"), { n: g.acts.length, h: num(mins / 60), w: num(g.acts.length / weeks) })}</p>`;
  }

  /* ---------- page ---------- */
  window.renderReport = async function () {
    const sec = $("report"), S = D.settings;
    try { window.MEDS_ROWS = D.meds || []; } catch (_) { window.MEDS_ROWS = []; }
    const g = gather(), name = S.patient_name || "", qs = S.report_questions || "";
    const opt = (v, cur, label) => `<option value="${v}" ${v == cur ? "selected" : ""}>${label}</option>`;
    sec.innerHTML = `<div class="rp-ctl noprint">
        <label>${t("lang")}<select id="rp_lang">${opt("en", LANG, "English")}${opt("hr", LANG, "Hrvatski")}</select></label>
        <label>${t("per")}<select id="rp_per">${[3, 6, 12].map((m, i) => opt(m, MONTHS, t("months")[i])).join("")}</select></label>
        <label>${t("patient")}<input id="rp_name" value="${esc(name)}" placeholder="${esc(t("name_ph"))}"></label>
        <button class="act" id="rp_print">${t("print")}</button>
        <label class="rp-q">${t("s_q")}<textarea id="rp_q" rows="3" placeholder="${esc(t("q_ph"))}">${esc(qs)}</textarea></label>
        <div class="sub">${t("hint")}</div></div>
      <article class="paper">
        <div class="rp-h"><div><h2>${t("title")}</h2><div class="rp-sub">${t("sub")}</div></div>
          <div class="rp-meta"><div>${t("patient")}: <b id="rp_nm">${esc(name) || "&nbsp;"}</b></div><div>${t("period")}: <b>${dstr(g.from)} – ${dstr(g.to)}</b></div><div>${t("generated")}: ${dstr(g.to)}</div></div></div>
        <h3>${t("s_summary")}</h3>${summary(g)}
        <h3>${t("s_trend")}</h3>${trends(g)}
        <h3>${t("s_weekly")}</h3>${weekly(g)}
        <h3>${t("s_labs")}</h3>${labs(g)}
        <h3>${t("s_meds")}</h3>${meds()}
        <h3>${t("s_food")}</h3>${food(g)}
        <h3>${t("s_act")}</h3>${activity(g)}
        <div id="rp_qbox" style="${qs.trim() ? "" : "display:none"}"><h3>${t("s_q")}</h3><div class="rp-pre" id="rp_qout">${esc(qs)}</div></div>
        <p class="rp-disc">${t("disc")}</p>
      </article>`;
    const save = async o => { try { await fetch("/api/settings", { method: "POST", body: JSON.stringify(o) }); D.settings = Object.assign(D.settings, o); } catch (_) { /* ignore */ } };
    $("rp_lang").onchange = e => { LANG = e.target.value; try { localStorage.setItem("rp_lang", LANG); } catch (_) {} renderReport(); };
    $("rp_per").onchange = e => { MONTHS = +e.target.value; try { localStorage.setItem("rp_months", MONTHS); } catch (_) {} renderReport(); };
    $("rp_name").oninput = e => { $("rp_nm").textContent = e.target.value || " "; };
    $("rp_name").onchange = e => save({ patient_name: e.target.value });
    $("rp_q").oninput = e => { $("rp_qout").textContent = e.target.value; $("rp_qbox").style.display = e.target.value.trim() ? "" : "none"; };
    $("rp_q").onchange = e => save({ report_questions: e.target.value });
    $("rp_print").onclick = () => window.print();
  };
})();
