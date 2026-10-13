/* Chart theme: smoother lines, gradient area under the main series, rounded bars, cleaner grid and tooltips. */
(function () {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function rgba(c, a) {
    if (typeof c !== "string") return c;
    let m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
    m = c.match(/^#([0-9a-f]{3})$/i);
    if (m) { const h = m[1]; return `rgba(${parseInt(h[0] + h[0], 16)},${parseInt(h[1] + h[1], 16)},${parseInt(h[2] + h[2], 16)},${a})`; }
    return c;
  }
  function nice(label, withYear) {
    if (typeof label !== "string") return label;
    let m = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${+m[3]} ${MON[+m[2] - 1]}${withYear ? " " + m[1] : ""}`;
    m = label.match(/^(\d{2})-(\d{2})$/);
    if (m) return `${+m[2]} ${MON[+m[1] - 1]}`;
    return label;
  }
  function deepMerge(t, s) {
    for (const k of Object.keys(s || {})) {
      const v = s[k];
      if (v && typeof v === "object" && !Array.isArray(v) && typeof v !== "function") {
        t[k] = deepMerge(t[k] && typeof t[k] === "object" ? t[k] : {}, v);
      } else t[k] = v;
    }
    return t;
  }

  // thin vertical guide under the pointer
  const hoverLine = {
    id: "hoverLine",
    afterDatasetsDraw(chart) {
      const tt = chart.tooltip;
      if (!tt || !tt.getActiveElements || !tt.getActiveElements().length) return;
      const x = tt.getActiveElements()[0].element.x, a = chart.chartArea, c = chart.ctx;
      c.save(); c.beginPath(); c.moveTo(x, a.top); c.lineTo(x, a.bottom);
      c.lineWidth = 1; c.strokeStyle = "rgba(255,255,255,.14)"; c.setLineDash([3, 4]); c.stroke(); c.restore();
    }
  };

  const emptyState = {
    id: "emptyState",
    afterDraw(chart) {
      if (!chart.$empty) return;
      const a = chart.chartArea, c = chart.ctx;
      c.save(); c.fillStyle = css("--mut"); c.font = '13px Inter, system-ui, sans-serif';
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(chart.options.emptyText || "No data yet", (a.left + a.right) / 2, (a.top + a.bottom) / 2);
      c.restore();
    }
  };

  if (window.Chart) {
    Chart.register(hoverLine, emptyState);
    const d = Chart.defaults;
    d.font.family = 'Inter, system-ui, "Segoe UI", sans-serif';
    d.font.size = 12;
    d.color = css("--mut");
    d.borderColor = "rgba(255,255,255,.06)";
    d.animation = { duration: 900, easing: "easeOutQuart" };
  }

  window.mkChart = function (id, cfg) {
    const old = Chart.getChart(id);
    if (old) old.destroy();
    const mut = css("--mut"), tx = css("--tx"), bg = css("--bg");
    const dsets = (cfg.data && cfg.data.datasets) || [];
    let filled = false;

    dsets.forEach(ds => {
      const type = ds.type || cfg.type;
      if (type === "line") {
        if (ds.tension == null) ds.tension = 0.35;
        if (ds.borderWidth == null) ds.borderWidth = 2;
        if (ds.borderCapStyle == null) ds.borderCapStyle = "round";
        ds.pointHoverRadius = 5;
        ds.pointHoverBorderWidth = 2;
        ds.pointHoverBackgroundColor = ds.borderColor;
        ds.pointHoverBorderColor = bg;
        if (ds.pointRadius > 0) ds.pointBackgroundColor = ds.borderColor;
        // gradient under the first solid, non-hairline series
        if (!filled && !ds.borderDash && ds.borderWidth >= 2 && ds.fill == null) {
          filled = true;
          const col = ds.borderColor;
          ds.fill = true;
          ds.backgroundColor = ctx => {
            const a = ctx.chart.chartArea;
            if (!a) return "transparent";
            const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
            g.addColorStop(0, rgba(col, 0.28));
            g.addColorStop(1, rgba(col, 0));
            return g;
          };
        }
      } else if (type === "bar") {
        ds.borderRadius = ds.borderRadius == null ? 6 : ds.borderRadius;
        ds.borderSkipped = false;
        ds.maxBarThickness = ds.maxBarThickness || 28;
        if (typeof ds.backgroundColor === "string") ds.backgroundColor = rgba(ds.backgroundColor, 0.9);
      }
    });

    const stacked = !!(cfg.options && cfg.options.scales && cfg.options.scales.x && cfg.options.scales.x.stacked);
    if (stacked) dsets.forEach(ds => { if ((ds.type || cfg.type) === "bar") ds.borderRadius = 2; });

    const base = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 4, right: 4 } },
      animations: { colors: false },   // gradients can't be tweened; lines/bars still animate in
      plugins: {
        legend: {
          position: "top", align: "end",
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 16, color: mut }
        },
        tooltip: {
          backgroundColor: "rgba(15,17,21,.96)", borderColor: "#2c3342", borderWidth: 1,
          padding: 11, cornerRadius: 10, titleColor: tx, bodyColor: "#c9cfdd",
          titleFont: { weight: "600" }, usePointStyle: true, boxPadding: 5,
          callbacks: { title: items => (items.length ? nice(items[0].label, true) : "") }
        }
      },
      scales: {}
    };
    const merged = deepMerge(base, cfg.options || {});

    // default axis look for every axis (x and any y/y2 the caller defined)
    const scales = merged.scales;
    if (!scales.x) scales.x = {};
    if (!scales.y) scales.y = {};
    Object.keys(scales).forEach(k => {
      const s = scales[k], isX = k === "x";
      s.border = Object.assign({ display: false }, s.border);
      s.grid = Object.assign(isX ? { display: false } : { color: "rgba(255,255,255,.055)", tickLength: 0 }, s.grid);
      s.ticks = Object.assign({ padding: 8, color: mut }, isX
        ? { maxTicksLimit: 8, maxRotation: 0, autoSkipPadding: 18, callback: function (v) { return nice(this.getLabelForValue(v)); } }
        : { maxTicksLimit: 6 }, s.ticks);
    });
    const empty = !dsets.some(ds => (ds.data || []).some(v => v != null));
    if (empty) {
      Object.values(scales).forEach(s => { s.display = false; });
      merged.plugins.legend.display = false;
      merged.plugins.tooltip.enabled = false;
    }
    cfg.options = merged;
    const chart = new Chart(document.getElementById(id), cfg);
    chart.$empty = empty;
    return chart;
  };
})();
