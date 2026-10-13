/* Small UI touches: big numbers count up and get a muted unit. No dependencies. */
(function () {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = t => 1 - Math.pow(1 - t, 3);

  function run(el) {
    if (el.dataset.anim) return;
    el.dataset.anim = "1";
    const m = el.textContent.trim().match(/^([+\-]?)(\d+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    const sign = m[1], target = parseFloat(m[2]), rest = m[3], dec = (m[2].split(".")[1] || "").length;
    el.innerHTML = "";
    const n = document.createElement("span");
    el.appendChild(n);
    if (rest.trim()) {
      const u = document.createElement("span");
      u.className = "u";
      u.textContent = rest.trim();
      el.appendChild(u);
    }
    const set = v => { n.textContent = sign + v.toFixed(dec); };
    if (reduce) { set(target); return; }
    const t0 = performance.now(), dur = 750;
    (function frame(now) {
      const p = Math.min(1, (now - t0) / dur);
      set(target * ease(p));
      if (p < 1) requestAnimationFrame(frame);
    })(t0);
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(".big")) run(root);
    root.querySelectorAll && root.querySelectorAll(".big").forEach(run);
  }

  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(scan))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => scan(document.body));
})();
