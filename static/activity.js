/* Activity detail panel: map with coloured track, HR / pace / elevation charts, splits, HR zones. */
(function () {
  let MAP = null, ACTIVE = null;

  const pad = n => String(n).padStart(2, "0");
  const dur = s => { if (s == null) return "–"; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`; };
  const paceOf = sp => (sp && sp > 0.3) ? 1000 / sp : null;                  // seconds per km
  const pace = sp => { const p = paceOf(sp); if (p == null) return "–"; let m = Math.floor(p / 60), r = Math.round(p % 60); if (r === 60) { m++; r = 0; } return `${m}:${pad(r)}`; };
  const isFoot = t => /run|walk|hik|trail/i.test(t || "");
  const isCycle = t => /cycl|bik|ride/i.test(t || "");

  function ensureModal() {
    let m = document.getElementById("actModal");
    if (m) return m;
    m = document.createElement("div");
    m.id = "actModal";
    m.className = "amodal";
    m.innerHTML = `<div class="apanel" role="dialog" aria-modal="true"><button class="aclose" aria-label="Close">×</button><div id="actBody"></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => { if (e.target === m || e.target.closest(".aclose")) closeActivity(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && m.classList.contains("on")) closeActivity(); });
    return m;
  }

  function closeActivity() {
    const m = document.getElementById("actModal");
    if (m) m.classList.remove("on");
    document.body.classList.remove("noscroll");
    if (MAP) { MAP.remove(); MAP = null; }
    ["a_hr", "a_pace", "a_elev"].forEach(id => { const c = window.Chart && Chart.getChart(id); if (c) c.destroy(); });
    ACTIVE = null;
  }

  async function openActivity(id, refresh) {
    const m = ensureModal();
    m.classList.add("on");
    document.body.classList.add("noscroll");
    const body = document.getElementById("actBody");
    const row = (window.D && D.activities || []).find(a => a.id === id) || {};
    body.innerHTML = `<h2 class="at">${esc(row.name || row.type || "Activity")}</h2><div class="sub">${esc(row.date || "")}</div><div class="aload"><span class="spin"></span> Loading from Garmin…</div>`;
    let d;
    try {
      d = await (await fetch(`/api/activity/${id}${refresh ? "?refresh=1" : ""}`)).json();
    } catch (e) {
      d = { error: "Could not reach the hub." };
    }
    if (!m.classList.contains("on")) return;
    if (d.error) {
      body.innerHTML = `<h2 class="at">${esc(row.name || "Activity")}</h2><div class="sub">${esc(row.date || "")}</div>
        <div class="insight" style="margin-top:14px">${esc(d.error)}</div><button class="ghost" id="a_retry" style="margin-top:12px">Try again</button>`;
      document.getElementById("a_retry").onclick = () => openActivity(id, true);
      return;
    }
    ACTIVE = d;
    render(d, row);
  }

  // ------------------------------------------------------------ rendering
  function stat(label, value, unit) {
    return `<div class="astat"><div class="al">${label}</div><div class="av">${value}${unit ? `<span class="u">${unit}</span>` : ""}</div></div>`;
  }

  function render(d, row) {
    const s = d.summary || {}, foot = isFoot(d.type), cyc = isCycle(d.type);
    const hasPoly = d.poly && d.poly.length > 1;
    const ser = d.series || {};
    const hasSer = ser.t && ser.t.length > 1;
    const km = s.distance_m != null ? s.distance_m / 1000 : row.distance_km;
    const tiles = [];
    if (km) tiles.push(stat("Distance", fmt(km, 2), "km"));
    tiles.push(stat("Time", dur(s.duration_s != null ? s.duration_s : (row.duration_min || 0) * 60)));
    if (s.avg_speed && foot) tiles.push(stat("Avg pace", pace(s.avg_speed), "/km"));
    else if (s.avg_speed && (cyc || km)) tiles.push(stat("Avg speed", fmt(s.avg_speed * 3.6, 1), "km/h"));
    if (s.avg_hr || row.avg_hr) tiles.push(stat("Avg HR", fmt(s.avg_hr || row.avg_hr, 0), "bpm"));
    if (s.max_hr || row.max_hr) tiles.push(stat("Max HR", fmt(s.max_hr || row.max_hr, 0), "bpm"));
    if (s.gain != null) tiles.push(stat("Ascent", fmt(s.gain, 0), "m"));
    if (s.loss != null) tiles.push(stat("Descent", fmt(s.loss, 0), "m"));
    if (s.kcal || row.kcal) tiles.push(stat("Calories", fmt(s.kcal || row.kcal, 0), "kcal"));
    if (s.avg_cad) tiles.push(stat("Cadence", fmt(s.avg_cad, 0), "spm"));
    if (s.avg_power) tiles.push(stat("Avg power", fmt(s.avg_power, 0), "W"));
    if (s.aerobic_te != null) tiles.push(stat("Aerobic TE", fmt(s.aerobic_te, 1)));
    if (s.anaerobic_te) tiles.push(stat("Anaerobic TE", fmt(s.anaerobic_te, 1)));
    if (s.load != null || row.load) tiles.push(stat("Load", fmt(s.load != null ? s.load : row.load, 0)));
    if (s.vo2max) tiles.push(stat("VO₂ max", fmt(s.vo2max, 0)));
    if (s.min_temp != null && s.max_temp != null) tiles.push(stat("Temp", `${fmt(s.min_temp, 0)}–${fmt(s.max_temp, 0)}`, "°C"));

    const when = d.start ? String(d.start).replace("T", " ").slice(0, 16) : (row.date || "");
    const modes = (hasPoly ? [["pace", foot ? "Pace" : "Speed"], ["hr", "Heart rate"], ["elev", "Elevation"]] : []);

    document.getElementById("actBody").innerHTML = `
      <div class="ahead"><div><h2 class="at">${esc(d.name || row.name || d.type)}</h2>
        <div class="sub">${esc(when)} · ${esc((d.type || row.type || "").replace(/_/g, " "))}</div></div>
        <button class="ghost small" id="a_refresh" title="Download again from Garmin">Re-download</button></div>
      <div class="astats">${tiles.join("")}</div>
      ${hasPoly ? `<div class="amapwrap"><div id="a_map"></div>
         <div class="amapbar"><span class="chips" id="a_modes">${modes.map((m, i) => `<button class="chip${i ? "" : " on"}" data-m="${m[0]}">${m[1]}</button>`).join("")}</span>
         <span class="alegend"><span id="a_lo"></span><i></i><span id="a_hi"></span></span></div></div>`
        : `<div class="sub" style="margin:14px 0">No GPS track for this activity (indoor or strength session).</div>`}
      ${hasSer ? `<div class="achart"><h3>Heart rate</h3><div class="chart sm"><canvas id="a_hr"></canvas></div></div>
        ${ser.speed ? `<div class="achart"><h3>${foot ? "Pace (min/km)" : "Speed (km/h)"}</h3><div class="chart sm"><canvas id="a_pace"></canvas></div></div>` : ""}
        ${ser.elev ? `<div class="achart"><h3>Elevation (m)</h3><div class="chart sm"><canvas id="a_elev"></canvas></div></div>` : ""}` : ""}
      <div class="agrid">
        ${d.zones && d.zones.length ? zonesHtml(d.zones) : ""}
        ${d.splits && d.splits.length > 1 ? splitsHtml(d.splits, foot) : ""}
        ${d.sets && d.sets.length ? setsHtml(d.sets) : ""}
      </div>`;
    document.getElementById("a_refresh").onclick = () => openActivity(d.id, true);

    let hover = () => { };
    if (hasPoly) hover = drawMap(d, foot).hover;
    if (hasSer) drawCharts(d, foot, hover);
  }

  function zonesHtml(z) {
    const tot = z.reduce((a, r) => a + r.secs, 0) || 1;
    const colors = ["#6b7488", "#4ea1ff", "#3ecf8e", "#f5b84b", "#ef6a6a", "#d946a8"];
    return `<div class="acard"><h3>Time in heart-rate zones</h3>` + z.map(r => `
      <div class="zrow"><span class="zl">Z${r.zone}</span>
        <span class="zb"><i style="width:${(r.secs / tot * 100).toFixed(1)}%;background:${colors[Math.min(r.zone, 5)]}"></i></span>
        <span class="zv">${dur(r.secs)} <span class="sub">${(r.secs / tot * 100).toFixed(0)}%</span></span>
        <span class="sub zlow">${r.low ? "≥" + Math.round(r.low) : ""}</span></div>`).join("") + `</div>`;
  }

  function splitsHtml(sp, foot) {
    const vals = sp.map(r => r.speed).filter(Boolean);
    const max = Math.max(...vals, 0.1), best = Math.max(...vals, 0);
    const label = r => foot ? (r.speed ? `${pace(r.speed)}` : "–") : (r.speed ? fmt(r.speed * 3.6, 1) : "–");
    return `<div class="acard wide2"><h3>Splits</h3><table><tr><th>#</th><th>${foot ? "Pace" : "km/h"}</th><th></th><th>HR</th><th>↑ / ↓ m</th></tr>` +
      sp.map(r => `<tr><td>${r.n}</td><td><b${r.speed === best ? ' class="best"' : ""}>${label(r)}</b></td>
        <td style="width:40%"><span class="zb"><i style="width:${((r.speed || 0) / max * 100).toFixed(0)}%;background:var(--acc)"></i></span></td>
        <td>${r.hr || "–"}</td><td>${r.gain != null ? Math.round(r.gain) : "–"} / ${r.loss != null ? Math.round(r.loss) : "–"}</td></tr>`).join("") + `</table></div>`;
  }

  function setsHtml(sets) {
    return `<div class="acard wide2"><h3>Sets</h3><table><tr><th>#</th><th>Exercise</th><th>Reps</th><th>Weight</th></tr>` +
      sets.map((r, i) => `<tr><td>${i + 1}</td><td>${esc((r.name || "").replace(/_/g, " ").toLowerCase())}</td><td>${r.reps != null ? r.reps : "–"}</td><td>${r.weight != null ? r.weight + " kg" : "–"}</td></tr>`).join("") + `</table></div>`;
  }

  // ------------------------------------------------------------ map
  function ramp(t) {            // 0..1 -> blue..green..yellow..red
    const h = 220 - 220 * Math.max(0, Math.min(1, t));
    return `hsl(${h},85%,58%)`;
  }

  function drawMap(d, foot) {
    const P = d.poly;
    const map = MAP = L.map("a_map", { zoomControl: true, attributionControl: true, preferCanvas: true });
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: "dark-tiles",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics"
    });
    osm.addTo(map);
    L.control.layers({ "Map": osm, "Satellite": sat }, null, { position: "topright", collapsed: true }).addTo(map);
    const latlngs = P.map(p => [p[0], p[1]]);
    map.fitBounds(L.latLngBounds(latlngs), { padding: [24, 24] });
    const group = L.layerGroup().addTo(map);

    const val = { pace: p => p[3], hr: p => p[2], elev: p => p[4] };
    function paint(mode) {
      group.clearLayers();
      const get = val[mode];
      const v = P.map(get).filter(x => x != null && (mode !== "pace" || x > 0.3)).sort((a, b) => a - b);
      let lo = v.length ? v[Math.floor(v.length * 0.05)] : 0, hi = v.length ? v[Math.ceil(v.length * 0.95) - 1] : 1;
      if (hi === lo) hi = lo + 1;
      if (!v.length) {          // nothing to colour by: plain line
        L.polyline(latlngs, { color: "#4ea1ff", weight: 4 }).addTo(group);
      } else {
        for (let i = 1; i < P.length; i++) {
          const a = get(P[i]);
          const c = a == null ? "#6b7488" : ramp((a - lo) / (hi - lo));
          L.polyline([latlngs[i - 1], latlngs[i]], { color: c, weight: 4.5, opacity: .95, lineCap: "round" }).addTo(group);
        }
      }
      const fmtV = x => mode === "pace" ? (foot ? `${pace(x)} /km` : `${fmt(x * 3.6, 1)} km/h`) : mode === "hr" ? `${Math.round(x)} bpm` : `${Math.round(x)} m`;
      document.getElementById("a_lo").textContent = v.length ? fmtV(lo) : "";
      document.getElementById("a_hi").textContent = v.length ? fmtV(hi) : "";
      document.querySelector(".alegend").classList.toggle("off", !v.length);
    }
    paint("pace");
    document.getElementById("a_modes").onclick = e => {
      const b = e.target.closest("button[data-m]"); if (!b) return;
      document.querySelectorAll("#a_modes .chip").forEach(x => x.classList.toggle("on", x === b));
      paint(b.dataset.m);
    };
    const dot = (c) => L.circleMarker(latlngs[0], { radius: 7, color: "#0f1115", weight: 2, fillColor: c, fillOpacity: 1 });
    dot("#3ecf8e").addTo(map).setLatLng(latlngs[0]).bindTooltip("Start");
    dot("#ef6a6a").addTo(map).setLatLng(latlngs[latlngs.length - 1]).bindTooltip("Finish");
    const cursor = L.circleMarker(latlngs[0], { radius: 7, color: "#fff", weight: 2, fillColor: "#4ea1ff", fillOpacity: 1 });
    setTimeout(() => map.invalidateSize(), 60);

    // map position for each chart sample (match by timestamp, else by fraction)
    const ts = d.series_ts, n = (d.series && d.series.t || []).length;
    const pos = [];
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (ts && ts[i] != null && P[0][5] != null) {
        while (k + 1 < P.length && P[k + 1][5] != null && P[k + 1][5] <= ts[i]) k++;
        pos.push(latlngs[k]);
      } else pos.push(latlngs[Math.min(P.length - 1, Math.round(i / Math.max(1, n - 1) * (P.length - 1)))]);
    }
    return {
      hover(i) {
        if (i == null || !pos[i]) { map.removeLayer(cursor); return; }
        if (!map.hasLayer(cursor)) cursor.addTo(map);
        cursor.setLatLng(pos[i]);
      }
    };
  }

  // ------------------------------------------------------------ charts
  function drawCharts(d, foot, hover) {
    const s = d.series, n = s.t.length;
    const useKm = s.dist && s.dist.some(v => v != null);
    const labels = (useKm ? s.dist.map(v => v == null ? "" : (v / 1000).toFixed(2)) : s.t.map(v => (v / 60).toFixed(1)));
    const unit = useKm ? "km" : "min";
    const mk = (id, label, data, color, extra) => {
      const el = document.getElementById(id); if (!el) return null;
      const c = mkChart(id, {
        type: "line",
        data: { labels, datasets: [{ label, data, borderColor: color, pointRadius: 0, borderWidth: 2, spanGaps: true, tension: .25, fill: true, ...(extra && extra.ds) }] },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => it.length ? `${it[0].label} ${unit}` : "", label: it => (extra && extra.fmt ? extra.fmt(it.parsed.y) : fmt(it.parsed.y, 0)) } } },
          scales: {
            x: { ticks: { maxTicksLimit: 8, callback(v) { return (+this.getLabelForValue(v)).toFixed(1); } } },
            y: { afterFit(a) { a.width = 48; }, ...(extra && extra.y) }
          }
        }
      });
      return c;
    };
    const all = [];
    if (s.hr) all.push(mk("a_hr", "Heart rate", s.hr, "#ef6a6a", { fmt: v => `${Math.round(v)} bpm` }));
    if (s.speed) {
      if (foot) {
        const pc = s.speed.map(v => { const p = paceOf(v); return p == null || p > 900 ? null : +(p / 60).toFixed(3); });
        all.push(mk("a_pace", "Pace", pc, "#4ea1ff", {
          y: { reverse: true, ticks: { callback: v => `${Math.floor(v)}:${pad(Math.round((v % 1) * 60) % 60)}` } },
          fmt: v => `${Math.floor(v)}:${pad(Math.round((v % 1) * 60) % 60)} /km`
        }));
      } else {
        all.push(mk("a_pace", "Speed", s.speed.map(v => v == null ? null : +(v * 3.6).toFixed(1)), "#4ea1ff", { fmt: v => `${fmt(v, 1)} km/h` }));
      }
    }
    if (s.elev) all.push(mk("a_elev", "Elevation", s.elev, "#a78bfa", { fmt: v => `${Math.round(v)} m` }));
    const charts = all.filter(Boolean);
    charts.forEach(c => {
      const cv = c.canvas;
      cv.addEventListener("mousemove", e => {
        const el = c.getElementsAtEventForMode(e, "index", { intersect: false }, false)[0];
        if (!el) return;
        hover(el.index);
        charts.forEach(o => {
          if (o === c) return;
          try { o.setActiveElements([{ datasetIndex: 0, index: el.index }]); o.tooltip.setActiveElements([{ datasetIndex: 0, index: el.index }], { x: 0, y: 0 }); o.update("none"); } catch (_) { }
        });
      });
      cv.addEventListener("mouseleave", () => {
        hover(null);
        charts.forEach(o => { try { o.setActiveElements([]); o.tooltip.setActiveElements([], { x: 0, y: 0 }); o.update("none"); } catch (_) { } });
      });
    });
  }

  window.openActivity = openActivity;
})();
