// Interactive sections below the hero.
// Every number here comes from Marco's reports (ME 572, ME 362, ME 481, the robotic crane
// report and the IEEE poster). Where a picture is illustrative rather than data, it says so.

(function () {
  // Motion is part of the design, so it stays on even when the system asks for reduced motion.
  const reduceMotion = false;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // Animate from 0 to 1 over `ms`, calling fn(eased). Returns a cancel function.
  function tween(ms, fn) {
    if (reduceMotion || ms <= 0) { fn(1); return () => {}; }
    let raf = 0; const t0 = performance.now();
    (function step(now) {
      const k = clamp((now - t0) / ms, 0, 1);
      fn(easeIO(k));
      if (k < 1) raf = requestAnimationFrame(step);
    })(t0);
    return () => cancelAnimationFrame(raf);
  }
  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls = "d-text", anchor = "start") {
    const t = svgEl("text", { x, y, class: cls, "text-anchor": anchor }, parent);
    t.textContent = str;
    return t;
  }
  function whenVisible(el, onEnter, onLeave, threshold = 0.2) {
    if (!el) return;
    new IntersectionObserver(([e]) => (e.isIntersecting ? onEnter() : onLeave && onLeave()), { threshold }).observe(el);
  }
  function setPressed(group, attr, value) {
    $$(`[${attr}]`, group).forEach(b => b.setAttribute("aria-pressed", String(b.getAttribute(attr) === String(value))));
    $$(".seg", group).forEach(syncPill);
  }

  // ---------- Sliding tabs: a pill that glides to the pressed option ----------
  function syncPill(seg) {
    const pill = seg.querySelector(".seg-pill"), on = seg.querySelector('button[aria-pressed="true"]');
    if (!pill || !on) return;
    pill.style.left = on.offsetLeft + "px";
    pill.style.width = on.offsetWidth + "px";
    pill.style.top = on.offsetTop + "px";
    pill.style.height = on.offsetHeight + "px";
    pill.style.bottom = "auto";
  }
  $$(".seg").forEach(seg => {
    const pill = document.createElement("span");
    pill.className = "seg-pill";
    pill.setAttribute("aria-hidden", "true");
    seg.prepend(pill);
    seg.classList.add("has-pill");
    pill.style.transition = "none";
    syncPill(seg);
    requestAnimationFrame(() => { pill.style.transition = ""; });
  });
  window.addEventListener("resize", () => $$(".seg").forEach(syncPill));
  document.fonts?.ready.then(() => $$(".seg").forEach(syncPill));

  // ---------- Statement: words light up as it scrolls through ----------
  const statement = $("[data-reveal]");
  if (statement) {
    (function wrap(node) {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrap(n);
      });
    })(statement);
    const words = $$(".w", statement);
    const update = () => {
      const r = statement.getBoundingClientRect(), vh = window.innerHeight;
      const p = reduceMotion ? 1 : clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < n));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // ---------- 01 · Envelope: best tested value vs control, or all 17 runs ----------
  (function envelope() {
    const svg = $("#envelope-svg");
    if (!svg) return;
    // ME 572 Project 2 parametric runs (ascending parameter value; control marked)
    const RUNS = [
      { name: "Roof U-value", unit: "Btu/h·ft²·°F", ctrl: 2, best: 0, xs: ["0.033", "0.048", "0.063", "0.078", "0.093"],
        cost: [12256, 12449, 12642, 12832, 13023], eui: [98.06, 101.21, 104.34, 107.41, 110.54], ghg: [17905, 18677, 19448, 20209, 20984] },
      { name: "Wall U-value", unit: "Btu/h·ft²·°F", ctrl: 2, best: 0, xs: ["0.044", "0.064", "0.084", "0.104", "0.124"],
        cost: [12368, 12506, 12642, 12775, 12909], eui: [100.06, 102.22, 104.34, 106.41, 108.48], ghg: [18409, 18934, 19448, 19955, 20463] },
      { name: "Glazing SHGC", unit: "", ctrl: 4, best: 0, xs: ["0.30", "0.40", "0.50", "0.60", "0.70"],
        cost: [11698, 11886, 12099, 12359, 12642], eui: [107.98, 106.50, 105.49, 104.75, 104.34], ghg: [21511, 20873, 20350, 19867, 19448] },
      { name: "Outdoor air", unit: "cfm/person", ctrl: 2, best: 0, xs: ["10", "15", "20", "25", "30"],
        cost: [12331, 12480, 12642, 12804, 12972], eui: [97.61, 100.89, 104.34, 107.77, 111.33], ghg: [17698, 18555, 19448, 20344, 21271] },
    ];
    const pct = (r, m) => r[m].map(v => ((v - r[m][r.ctrl]) / r[m][r.ctrl]) * 100);
    const lim = 12;

    // View 1: diverging bars of the lowest tested value vs control
    const vBars = svgEl("g", { class: "view" }, svg);
    const L = 150, R = 470, top = 26, rowH = 50;
    const x = v => L + ((v + lim) / (2 * lim)) * (R - L);
    for (let t = -10; t <= 10; t += 5) {
      svgEl("line", { x1: x(t), x2: x(t), y1: top - 8, y2: top + rowH * 4, class: t === 0 ? "d-axis" : "d-grid" }, vBars);
      text(vBars, x(t), top + rowH * 4 + 16, (t > 0 ? "+" : t < 0 ? "−" : "") + Math.abs(t) + "%", "d-text", "middle");
    }
    text(vBars, x(-lim) + 2, top - 12, "← better", "d-text");
    text(vBars, x(lim) - 2, top - 12, "worse →", "d-text", "end");
    const bars = RUNS.map((r, i) => {
      const y = top + i * rowH + 8;
      text(vBars, 0, y + 12, r.name, "d-label");
      text(vBars, 0, y + 27, `${r.xs[r.ctrl]} → ${r.xs[r.best]}`, "d-text");
      const bar = svgEl("rect", { y, height: 22, rx: 4 }, vBars);
      const val = text(vBars, 0, y + 15, "", "d-value");
      return { bar, val };
    });

    // View 2: small multiples, one panel per parameter, all five runs
    const vRuns = svgEl("g", { class: "view is-off" }, svg);
    const PW = 252, PH = 118;
    const panels = RUNS.map((r, i) => {
      const ox = (i % 2) * 268, oy = Math.floor(i / 2) * 130;
      const g = svgEl("g", { transform: `translate(${ox} ${oy})` }, vRuns);
      const px = j => 34 + (j / 4) * (PW - 50), py = v => 24 + ((lim - v) / (2 * lim)) * 72;
      text(g, 0, 12, r.name, "d-label");
      text(g, PW - 6, 12, r.unit, "d-text", "end");
      svgEl("line", { x1: 30, x2: PW - 10, y1: py(0), y2: py(0), class: "d-axis" }, g);
      [-10, 10].forEach(t => { svgEl("line", { x1: 30, x2: PW - 10, y1: py(t), y2: py(t), class: "d-grid" }, g); text(g, 26, py(t) + 3, (t > 0 ? "+" : "−") + "10%", "d-text", "end"); });
      r.xs.forEach((v, j) => text(g, px(j), PH - 4, v, "d-text", "middle"));
      const line = svgEl("polyline", { fill: "none", stroke: "#b6d0bf", "stroke-width": 1.6 }, g);
      const dots = r.xs.map((_, j) => svgEl("circle", { r: j === r.ctrl ? 4.5 : 4, stroke: "#144425", "stroke-width": 2 }, g));
      const endLabel = text(g, 0, 0, "", "d-value");
      return { r, px, py, line, dots, endLabel };
    });

    let shown = Object.fromEntries(["cost", "eui", "ghg"].map(m => [m, null]));
    let metric = "ghg", cancel = () => {};
    let cur = RUNS.map(r => pct(r, metric));
    function draw(vals) {
      bars.forEach(({ bar, val }, i) => {
        const v = vals[i][RUNS[i].best];
        bar.setAttribute("x", Math.min(x(0), x(v)));
        bar.setAttribute("width", Math.max(2, Math.abs(x(v) - x(0))));
        bar.setAttribute("class", v < 0 ? "d-cyan" : "d-neon");
        val.textContent = (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%";
        val.setAttribute("x", v < 0 ? x(v) - 6 : x(v) + 6);
        val.setAttribute("text-anchor", v < 0 ? "end" : "start");
      });
      panels.forEach((p, i) => {
        const v = vals[i];
        p.line.setAttribute("points", v.map((y, j) => `${p.px(j)},${p.py(y)}`).join(" "));
        p.dots.forEach((d, j) => {
          d.setAttribute("cx", p.px(j)); d.setAttribute("cy", p.py(v[j]));
          d.setAttribute("fill", j === p.r.ctrl ? "#f1f8ef" : v[j] < 0 ? "#7cc3ea" : "#b5d984");
        });
        const far = v[0] * v[0] > v[4] * v[4] ? 0 : 4;
        p.endLabel.textContent = (v[far] > 0 ? "+" : "−") + Math.abs(v[far]).toFixed(1) + "%";
        p.endLabel.setAttribute("x", p.px(far) + (far ? -8 : 8));
        p.endLabel.setAttribute("y", p.py(v[far]) + (v[far] > 0 ? -8 : 14));
        p.endLabel.setAttribute("text-anchor", far ? "end" : "start");
      });
    }
    function setMetric(m) {
      const from = cur.map(a => a.slice()), to = RUNS.map(r => pct(r, m));
      metric = m;
      cancel();
      cancel = tween(480, e => { cur = from.map((a, i) => a.map((v, j) => v + (to[i][j] - v) * e)); draw(cur); });
    }
    const group = svg.closest(".demo");
    $$("[data-metric]", group).forEach(b => b.addEventListener("click", () => {
      setPressed(group, "data-metric", b.dataset.metric);
      setMetric(b.dataset.metric);
    }));
    const toggle = $("#runs-toggle"), title = $("#envelope-title");
    toggle.addEventListener("click", () => {
      const on = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(on));
      toggle.textContent = on ? "Back to best vs control" : "Show all 17 runs";
      vBars.classList.toggle("is-off", on);
      vRuns.classList.toggle("is-off", !on);
      title.classList.add("fade-swap"); title.style.opacity = 0;
      setTimeout(() => { title.textContent = on ? "All 17 runs · % change vs control" : "Best tested value vs control"; title.style.opacity = 1; }, 220);
      svg.setAttribute("aria-label", on ? "Percent change for every run of each parameter" : "Percent change from the control case for the best tested value of each parameter");
    });
    draw(cur);
  })();

  // ---------- 3.2 · Lighting layout ----------
  // The plan itself is the tower's top floor in 3D (building.js listens for "lighting-layout");
  // this card keeps the meters and the layout buttons.
  (function lighting() {
    const meters = $("#lighting-meters");
    if (!meters) return;
    const OPTIONS = [
      { cols: 4, rows: 4, n: 16, fc: 42, lpd: 0.41, note: "Passes, but with no illuminance margin." },
      { cols: 5, rows: 4, n: 20, fc: 52, lpd: 0.52, note: "Chosen: 10 fc of margin, still under the power cap." },
    ];
    function render(i) {
      const o = OPTIONS[i];
      window.lightingLayout = o;
      window.dispatchEvent(new CustomEvent("lighting-layout", { detail: o }));
      meters.innerHTML = `
        <div class="meter"><span>Illuminance <b>${o.fc} fc</b> · min 42</span>
          <div class="meter-bar"><div class="meter-fill" data-w="${(o.fc / 70) * 100}"></div><div class="meter-mark" style="left:${(42 / 70) * 100}%"></div></div></div>
        <div class="meter"><span>Power density <b>${o.lpd.toFixed(2)} W/ft²</b> · max 0.60</span>
          <div class="meter-bar"><div class="meter-fill" data-w="${(o.lpd / 0.8) * 100}" style="background:var(--amber)"></div><div class="meter-mark" style="left:${(0.6 / 0.8) * 100}%"></div></div></div>
        <p class="demo-note" style="grid-column:1/-1">${o.n} luminaires. ${o.note}</p>`;
      $$(".meter-fill", meters).forEach(f => { f.style.width = "0%"; });
      requestAnimationFrame(() => $$(".meter-fill", meters).forEach(f => { f.style.width = f.dataset.w + "%"; }));
    }
    const group = meters.closest("[data-demo]");
    $$("[data-layout]", group).forEach(b => b.addEventListener("click", () => {
      setPressed(group, "data-layout", b.dataset.layout);
      render(Number(b.dataset.layout));
    }));
    render(1);
  })();

  // ---------- 03 · Seismic schematic ----------
  (function seismic() {
    const svg = $("#seismic-svg"), canvas = $("#seismic-traces"), btn = $("#quake-btn");
    if (!svg || !canvas) return;
    // True-scale map of 113.83–114.59°E, 22.15–22.50°N (x shrunk by cos 22.3° so the coast keeps its shape).
    const K = 260 / 0.35, KX = K * Math.cos((22.3 * Math.PI) / 180);
    const proj = (lon, lat) => [(lon - 113.83) * KX, (22.5 - lat) * K];
    // Coastline from Natural Earth 1:10m land (public domain), clipped to this frame and simplified.
    const HK_LAND = [
      "M520.0 0.0L520.0 3.8L509.0 11.7L489.5 16.3L480.9 23.6L471.4 35.2L461.6 35.6L455.1 26.8L450.3 23.5L449.0 11.5L444.6 7.5L446.8 0.0L341.3 0.0L326.8 12.6L309.6 20.1L301.5 26.0L298.3 31.1L291.2 35.8L285.9 35.8L275.8 22.4L266.1 24.3L262.4 21.9L260.7 25.4L261.8 31.7L265.0 33.4L266.1 38.7L261.2 37.5L260.7 34.1L255.8 31.1L247.8 32.3L245.2 35.8L232.0 38.6L262.4 59.0L261.2 64.8L264.5 67.7L260.7 75.3L265.0 74.0L270.4 63.1L277.8 55.9L280.6 48.0L284.4 47.9L289.7 51.5L300.5 51.5L302.0 55.3L300.5 62.4L304.2 67.1L306.9 59.6L315.5 55.0L306.9 41.6L315.5 34.7L324.1 32.3L323.6 26.0L339.3 14.8L340.2 18.4L344.2 19.2L340.2 26.5L347.6 28.4L349.2 39.8L345.6 44.6L348.7 50.8L352.4 46.3L355.7 57.3L359.0 56.7L358.5 43.8L364.2 28.8L369.7 33.4L369.3 39.9L371.3 44.6L382.0 45.1L391.6 47.4L390.0 53.2L392.7 64.8L384.4 61.0L379.2 60.1L371.3 75.8L374.6 73.9L381.4 83.7L384.7 99.6L382.5 100.1L382.0 96.4L375.5 96.1L377.7 102.4L375.0 108.9L371.3 112.3L364.9 114.6L362.6 124.5L359.0 119.3L359.0 110.0L351.9 114.6L349.9 109.4L345.6 104.2L346.6 92.6L337.1 88.6L335.8 82.2L330.0 86.3L323.1 88.0L313.4 81.0L307.9 81.0L301.5 90.3L304.7 101.3L309.1 107.7L306.9 112.9L300.5 107.1L299.9 99.6L294.4 102.4L292.5 107.0L299.5 114.1L304.2 133.2L317.0 136.3L317.6 144.7L325.7 143.6L331.0 150.6L326.9 155.4L321.4 159.2L316.5 157.5L315.5 158.1L315.9 168.0L323.1 165.6L325.2 171.5L325.2 176.7L320.8 179.6L315.5 174.9L308.1 170.5L309.1 163.9L304.7 151.7L298.9 147.1L299.9 136.7L292.5 132.0L289.7 144.7L290.7 151.7L281.1 162.2L273.6 154.6L262.4 140.7L264.5 147.7L262.9 147.7L251.2 135.0L245.0 142.1L248.4 147.1L248.4 149.4L243.1 147.1L241.7 152.7L235.0 156.9L231.8 152.9L232.5 144.5L230.7 140.7L230.2 137.3L226.5 137.3L226.5 132.0L221.4 127.4L202.3 117.2L201.8 121.0L194.8 109.4L193.1 99.6L188.9 96.7L183.9 101.8L171.2 99.6L170.7 101.9L165.2 101.9L163.0 104.7L156.7 103.0L144.3 107.7L130.9 111.2L127.1 108.9L127.1 104.7L115.9 104.7L111.3 101.0L104.9 99.0L100.9 89.7L98.2 89.1L96.7 83.9L92.3 88.6L99.4 95.0L85.9 96.7L78.9 102.4L69.2 97.3L65.9 97.3L58.0 92.0L60.7 83.3L55.4 75.3L46.0 67.8L54.6 60.5L69.2 59.6L76.3 54.4L85.3 37.5L101.4 30.6L115.9 8.5L120.2 8.5L125.6 10.3L124.5 20.1L127.1 18.4L137.4 16.2L138.4 13.2L137.9 3.3L144.4 0.0L81.6 0.0L80.9 7.1L65.3 9.6L58.6 8.4L55.2 10.5L54.8 16.6L41.5 35.1L35.4 19.8L30.5 16.2L26.0 3.8L25.7 0.0Z",
      "M11.3 225.0L6.3 219.2L5.0 201.6L6.3 197.5L13.2 197.5L13.2 190.1L18.4 188.7L18.4 184.0L14.2 180.7L25.4 171.6L25.8 170.3L32.2 169.2L37.1 163.9L43.0 154.0L62.9 154.6L67.6 159.8L74.7 156.9L90.7 147.7L100.9 150.0L105.7 141.9L111.6 140.7L116.5 132.0L128.8 122.2L130.9 127.4L146.9 114.6L150.7 117.2L154.5 121.6L152.4 127.4L151.4 133.8L148.6 131.4L138.4 130.3L137.2 141.9L125.6 140.1L125.6 150.0L132.1 147.2L128.9 156.7L129.8 174.9L119.7 174.9L113.7 172.5L121.8 184.2L111.6 192.3L127.1 202.7L117.0 210.9L104.4 216.7L103.5 211.5L103.5 195.2L79.5 195.2L67.6 205.0L62.9 205.0L60.7 208.6L67.6 210.3L67.6 214.9L61.3 219.1L52.4 219.9L44.0 211.5L43.0 206.2L37.1 208.0L20.0 221.8Z",
      "M265.0 159.2L269.3 163.9L273.6 162.8L278.9 165.0L284.3 174.9L289.7 179.0L289.7 186.5L285.4 191.7L291.2 205.0L288.0 206.2L292.9 220.2L284.3 221.9L282.1 219.0L276.8 214.3L276.8 206.5L274.6 197.9L269.9 194.0L265.9 197.4L269.9 198.7L269.9 204.5L267.1 205.0L262.4 210.9L267.1 218.4L265.0 223.6L267.7 228.9L259.6 230.6L258.5 219.0L260.7 217.3L258.8 213.7L251.6 217.3L248.4 215.5L251.6 211.5L246.8 208.6L250.0 203.9L248.4 199.8L242.4 198.7L243.2 192.4L234.5 198.1L231.8 202.2L230.2 202.2L227.5 192.9L221.4 189.4L210.3 188.9L205.6 186.5L198.5 171.5L194.2 169.7L194.8 165.0L196.3 163.9L205.6 159.2L212.4 156.9L230.7 163.9L239.8 163.9L246.2 158.1L252.1 154.6Z",
      "M211.3 238.6L193.0 239.9L195.3 233.5L195.3 210.9L188.5 211.0L190.0 206.2L190.2 196.3L194.7 198.1L197.6 206.6L203.3 212.9L208.1 210.9L208.1 215.5L203.3 219.0L219.7 218.4L223.1 220.2L215.2 225.7L212.4 229.5L216.7 238.7Z",
      "M188.9 129.2L178.0 132.0L176.5 119.3L171.2 111.7L171.2 107.1L175.5 104.7L187.3 108.9L191.6 118.7Z",
      "M342.9 117.0L328.4 117.0L326.8 114.6L326.3 104.7L325.2 100.1L330.5 92.0L334.3 92.0L336.4 104.7L342.9 111.2Z",
      "M298.3 250.8L292.9 256.6L289.1 250.8L292.9 243.9L299.9 238.7L302.0 243.9L302.0 249.2Z",
      "M320.3 182.4L320.3 187.1L322.0 191.2L319.7 195.2L315.0 198.7L312.8 194.6L310.2 194.0L311.3 185.9L311.3 186.5Z",
      "M77.4 132.0L75.2 139.0L72.9 141.3L69.8 154.0L68.7 154.0L68.7 147.7L64.4 140.1L64.4 138.4L68.7 136.7L70.8 132.0L72.9 134.9Z",
      "M146.4 192.3L143.2 192.3L138.4 185.9L130.9 181.9L145.9 181.3Z",
      "M344.5 129.2L336.4 130.9L334.3 121.6L339.2 119.3L342.9 121.0Z",
      "M368.0 19.0L363.7 25.4L359.5 14.4L363.1 9.7L366.4 10.3Z",
      "M132.1 217.8L135.3 219.0L140.6 219.0L138.4 225.9L135.3 223.6L127.7 228.9L127.1 224.2L132.1 220.8Z",
      "M320.3 102.4L320.3 112.3L316.0 108.9L315.5 100.1L315.5 97.3L318.1 95.5Z",
      "M288.0 239.8L283.8 241.0L283.8 234.0L287.6 234.0L291.2 232.9L292.9 236.3L289.7 239.8Z",
      "M110.5 228.9L109.4 232.9L106.2 231.7L101.4 227.7L105.7 223.6L108.3 223.6Z",
      "M224.3 199.3L221.4 199.8L216.1 195.8L214.6 191.7L224.3 194.0Z",
      "M159.3 119.3L155.6 119.3L154.5 113.5L156.7 110.0L162.0 112.3L159.9 114.6Z",
      "M209.2 133.8L214.0 136.7L216.7 136.1L217.8 138.4L214.0 140.7L210.8 138.4L206.1 137.3L205.6 136.7Z",
      "M50.4 253.7L46.1 253.7L47.8 250.3L55.4 248.0L55.4 253.7Z",
      "M144.8 155.2L143.2 159.2L146.4 159.2L146.4 162.2L140.6 163.9L140.6 156.9Z",
      "M37.1 89.7L34.3 96.7L31.7 86.2Z",
      "M371.3 144.7L370.2 144.7L367.0 139.0L368.6 134.9L371.3 140.1Z",
      "M359.0 139.0L355.1 141.3L359.5 132.0L361.6 132.0Z",
      "M55.4 238.7L55.4 240.4L50.4 238.7L50.4 232.9Z",
      "M304.2 166.3L298.9 170.9L299.4 163.9Z",
      "M149.7 180.7L146.4 180.7L148.0 176.7L152.4 177.3Z",
      "M357.4 174.9L355.1 179.0L353.6 176.0L355.1 171.5Z",
      "M167.4 163.3L164.7 163.3L164.7 159.2L166.3 159.2L168.0 160.4Z",
    ];
    const SRC = { name: "Cheung Chau", p: proj(114.028, 22.209) };
    const STATIONS = [
      { name: "Telegraph Bay", p: proj(114.131, 22.262), dy: -7 },
      { name: "Cyberport 2", p: proj(114.131, 22.262), dy: 7 },
      { name: "Sai Kung", p: proj(114.272, 22.383), dy: 0 },
    ];
    HK_LAND.forEach(d => svgEl("path", { d, class: "d-land" }, svg));
    [["Lantau", 113.93, 22.262], ["Hong Kong Island", 114.19, 22.215], ["Kowloon", 114.175, 22.322], ["New Territories", 114.13, 22.43]]
      .forEach(([name, lon, lat]) => text(svg, ...proj(lon, lat), name, "d-place", "middle"));
    const rings = svgEl("g", {}, svg);
    svgEl("circle", { cx: SRC.p[0], cy: SRC.p[1], r: 6, class: "d-neon" }, svg);
    text(svg, SRC.p[0] - 10, SRC.p[1] + 4, "Cheung Chau · source", "d-label", "end");
    const dots = STATIONS.map((st, i) => {
      const [x, y] = st.p;
      const d = svgEl("rect", { x: x - 5 + (i === 1 ? 7 : 0), y: y - 5 + (i === 0 ? -6 : i === 1 ? 4 : 0), width: 10, height: 10, rx: 2, fill: "#7cc3ea" }, svg);
      return d;
    });
    text(svg, STATIONS[0].p[0] + 18, STATIONS[0].p[1] - 4, "Pokfulam · 2 Raspberry Shakes", "d-label");
    text(svg, STATIONS[0].p[0] + 18, STATIONS[0].p[1] + 10, "280 m apart", "d-text");
    text(svg, STATIONS[2].p[0] - 10, STATIONS[2].p[1] - 10, "Sai Kung seismograph", "d-label", "end");
    text(svg, 10, 250, "HKO catalogue: ≥ M3.0 · this project: down to ~M1", "d-text");

    const dist = STATIONS.map(st => Math.hypot(st.p[0] - SRC.p[0], st.p[1] - SRC.p[1]));
    const ctx = canvas.getContext("2d");
    const LABELS = ["Telegraph Bay", "Cyberport", "Sai Kung"];
    const rows = LABELS.map(() => ({ buf: new Float32Array(260), amp: 0 }));
    let quakeT = -1, running = false, last = 0, autoTimer = 0;
    const SPEED = 110; // px per second, illustrative

    function trigger() { quakeT = 0; rows.forEach(r => (r.hit = false)); }
    btn.addEventListener("click", trigger);

    function draw(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (!reduceMotion) { autoTimer += dt; if (autoTimer > 7) { autoTimer = 0; trigger(); } }
      rings.replaceChildren();
      if (quakeT >= 0) {
        quakeT += dt;
        const r = quakeT * SPEED;
        [0, 26, 52].forEach((off, k) => {
          const rr = r - off;
          if (rr > 0) svgEl("circle", { cx: SRC.p[0], cy: SRC.p[1], r: rr, fill: "none", stroke: "#b5d984", "stroke-opacity": Math.max(0, 0.8 - rr / 520) * (1 - k * 0.25), "stroke-width": 2 }, rings);
        });
        rows.forEach((row, i) => { if (!row.hit && r >= dist[i]) { row.hit = true; row.amp = 1; dots[i].setAttribute("fill", "#b5d984"); } });
        if (r > 560) quakeT = -1;
      }
      // traces scroll left
      const W = canvas.width, H = canvas.height, rh = H / 3;
      ctx.clearRect(0, 0, W, H);
      rows.forEach((row, i) => {
        row.buf.copyWithin(0, 1);
        const noise = (Math.random() - 0.5) * 0.08;
        const quake = row.amp * Math.sin(now / 18) * (0.6 + Math.random() * 0.4);
        row.buf[row.buf.length - 1] = noise + quake;
        row.amp *= 0.965;
        if (row.amp < 0.05 && row.hit) dots[i].setAttribute("fill", "#7cc3ea");
        const mid = rh * i + rh / 2;
        ctx.strokeStyle = "#2f7046"; ctx.beginPath(); ctx.moveTo(96, mid); ctx.lineTo(W, mid); ctx.stroke();
        ctx.fillStyle = "#b6d0bf"; ctx.font = "10px Geist Mono, monospace"; ctx.fillText(LABELS[i], 8, mid + 3);
        ctx.strokeStyle = row.amp > 0.1 ? "#b5d984" : "#7cc3ea"; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let k = 0; k < row.buf.length; k++) {
          const px = 96 + (k / (row.buf.length - 1)) * (W - 100), py = mid - row.buf[k] * rh * 0.42;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      });
      requestAnimationFrame(draw);
    }
    whenVisible(svg.closest(".demo"), () => { if (!running) { running = true; last = performance.now(); trigger(); requestAnimationFrame(draw); } }, () => { running = false; });
  })();

  // ---------- 04 · Pitch model (ME 362, re-implemented) ----------
  (function pitch() {
    const svg = $("#pitch-svg");
    if (!svg) return;
    // Table 1 constants; spin axes and launch angles from Tables 3–6
    const PITCHES = {
      fastball: { V: 42, rpm: 2300, axis: [0, 1, 0], launch: -2, report: [1.0, 0.0], mlb: [[0.8, 1.0], [0, 0.1]] },
      curveball: { V: 35, rpm: 2600, axis: [0, -0.8, 0.4], launch: 2, report: [1.5, 0.35], mlb: [[1.2, 1.6], [0.15, 0.35]] },
      slider: { V: 38, rpm: 2300, axis: [0, 0.7, 0.7], launch: -1, report: [1.1, 0.48], mlb: [[0.9, 1.3], [0.2, 0.5]] },
      knuckleball: { V: 28, rpm: 50, axis: [0, 1, 0], launch: -1, report: [1.8, 0], mlb: null },
    };
    function simulate(V, rpm, axis, launch) {
      const rho = 1.2, m = 0.145, R = 0.0366, A = 0.0042, Cd = 0.35, g = 9.81, X = 18.44, dt = 0.0005;
      const n = Math.hypot(...axis) || 1, ax = axis.map(a => a / n), th = (launch * Math.PI) / 180, w = (rpm * 2 * Math.PI) / 60;
      let p = [0, 0, 1.8], v = [V * Math.cos(th), 0, V * Math.sin(th)], t = 0;
      const path = [p.slice()];
      while (p[0] < X && p[2] > 0 && t < 3) {
        const sp = Math.hypot(...v), vh = v.map(c => c / sp);
        const S = (R * w) / sp, CL = S <= 0.1 ? 1.5 * S : 0.09 + 0.6 * S;
        const cr = [vh[1] * ax[2] - vh[2] * ax[1], vh[2] * ax[0] - vh[0] * ax[2], vh[0] * ax[1] - vh[1] * ax[0]];
        const cn = Math.hypot(...cr) || 1, q = (0.5 * rho * sp * sp * A) / m;
        const a = [0, 1, 2].map(i => -q * Cd * vh[i] + (q * CL * cr[i]) / cn - (i === 2 ? g : 0));
        v = v.map((c, i) => c + a[i] * dt); p = p.map((c, i) => c + v[i] * dt); t += dt;
        if (path.length < 2000 && Math.round(t / dt) % 10 === 0) path.push(p.slice());
      }
      path.push(p.slice());
      return { path, t, end: p, reached: p[0] >= X - 1e-6 };
    }

    // Layout: side view (x–z) left, catcher's view (y–z) right
    const SX = x => 24 + (x / 18.44) * 300, SZ = z => 200 - (z / 2.2) * 170;
    const CX = y => 430 + (y / 0.7) * 70, CZ = SZ;
    svgEl("line", { x1: SX(0), x2: SX(18.44), y1: SZ(0), y2: SZ(0), class: "d-axis" }, svg);
    for (let z = 0.5; z <= 2; z += 0.5) {
      svgEl("line", { x1: SX(0), x2: SX(18.44), y1: SZ(z), y2: SZ(z), class: "d-grid" }, svg);
      text(svg, SX(0) - 4, SZ(z) + 3, z.toFixed(1), "d-text", "end");
    }
    text(svg, SX(0), 222, "Mound", "d-text"); text(svg, SX(18.44), 222, "Plate · 18.44 m", "d-text", "end");
    text(svg, SX(0), 16, "Side view (m)", "d-text");
    svgEl("rect", { x: CX(-0.35), y: SZ(2.1), width: CX(0.35) - CX(-0.35), height: SZ(0) - SZ(2.1), fill: "none", class: "d-grid" }, svg);
    svgEl("line", { x1: CX(-0.35), x2: CX(0.35), y1: SZ(0), y2: SZ(0), class: "d-axis" }, svg);
    svgEl("line", { x1: CX(0), x2: CX(0), y1: SZ(2.1), y2: SZ(0), class: "d-grid" }, svg);
    text(svg, CX(0), 16, "At the plate", "d-text", "middle");
    text(svg, CX(-0.35), 222, "← glove side", "d-text");
    const mlbBox = svgEl("rect", { fill: "rgba(42,159,214,0.18)", stroke: "#7cc3ea", "stroke-dasharray": "3 3", class: "fade-swap" }, svg);
    const mlbText = text(svg, 0, 0, "MLB range", "d-text");
    mlbText.classList.add("fade-swap");
    const sidePath = svgEl("polyline", { fill: "none", stroke: "#b5d984", "stroke-width": 2.5, "stroke-linecap": "round" }, svg);
    const ball = svgEl("circle", { r: 5, fill: "#fff" }, svg);
    const hit = svgEl("circle", { r: 6, fill: "#b5d984", stroke: "#144425", "stroke-width": 2 }, svg);
    const ballC = svgEl("circle", { r: 5, fill: "#fff" }, svg);

    const group = svg.closest(".demo"), vIn = $("#pitch-v"), rIn = $("#pitch-rpm"), out = $("#pitch-readout");
    let current = "curveball", anim = 0, cancelMorph = () => {};
    const cur = { axis: PITCHES.curveball.axis.slice(), launch: PITCHES.curveball.launch };

    function run(animate = true) {
      const P = PITCHES[current], V = Number(vIn.value), rpm = Number(rIn.value);
      $("#pitch-v-out").textContent = V + " m/s";
      $("#pitch-rpm-out").textContent = rpm + " rpm";
      const res = simulate(V, rpm, cur.axis, cur.launch);
      sidePath.setAttribute("points", res.path.map(p => `${SX(p[0])},${SZ(p[2])}`).join(" "));
      const [ex, ey, ez] = res.end;
      hit.setAttribute("cx", CX(ey)); hit.setAttribute("cy", CZ(Math.max(0, ez)));
      if (P.mlb) {
        const [[dz0, dz1], [dy0, dy1]] = P.mlb;
        mlbBox.setAttribute("x", CX(-dy1)); mlbBox.setAttribute("width", CX(-dy0) - CX(-dy1) || 2);
        mlbBox.setAttribute("y", CZ(1.8 - dz0)); mlbBox.setAttribute("height", CZ(1.8 - dz1) - CZ(1.8 - dz0));
        mlbText.setAttribute("x", CX(-dy1) - 4); mlbText.setAttribute("y", CZ(1.8 - dz0) - 4); mlbText.setAttribute("text-anchor", "end");
        mlbBox.style.display = mlbText.style.display = "";
      } else mlbBox.style.display = mlbText.style.display = "none";
      const drop = 1.8 - Math.max(0, ez), brk = Math.abs(ey);
      const side = ey < -0.005 ? " glove side" : "";
      out.innerHTML = res.reached
        ? `<strong>Drop ${drop.toFixed(2)} m · break ${brk.toFixed(2)} m${side}</strong> · ${res.t.toFixed(2)} s to the plate. Report: ${P.report[0]} m / ${P.report[1]} m.`
        : `<strong>Hits the ground at ${ex.toFixed(1)} m.</strong> A smooth sphere has no seam forces, so the model can’t keep a knuckleball in the air.`;
      cancelAnimationFrame(anim);
      const pts = res.path, total = reduceMotion || !animate ? 0 : 1100;
      const t0 = performance.now();
      (function step(now) {
        const k = total ? clamp((now - t0) / total, 0, 1) : 1;
        const p = pts[Math.min(pts.length - 1, Math.floor(k * (pts.length - 1)))];
        ball.setAttribute("cx", SX(p[0])); ball.setAttribute("cy", SZ(p[2]));
        ballC.setAttribute("cx", CX(p[1])); ballC.setAttribute("cy", CZ(Math.max(0, p[2])));
        ballC.setAttribute("r", 2 + 4 * (p[0] / 18.44));
        if (k < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    $$("[data-pitch]", group).forEach(b => b.addEventListener("click", () => {
      current = b.dataset.pitch;
      setPressed(group, "data-pitch", current);
      const P = PITCHES[current];
      const from = { V: Number(vIn.value), rpm: Number(rIn.value), axis: cur.axis.slice(), launch: cur.launch };
      cancelMorph();
      mlbBox.style.opacity = mlbText.style.opacity = 0.15;
      cancelMorph = tween(700, e => {             // the trajectory morphs into the new pitch
        vIn.value = Math.round(from.V + (P.V - from.V) * e);
        rIn.value = Math.round((from.rpm + (P.rpm - from.rpm) * e) / 50) * 50;
        cur.axis = from.axis.map((a, i) => a + (P.axis[i] - a) * e);
        cur.launch = from.launch + (P.launch - from.launch) * e;
        run(false);
        if (e >= 1) { mlbBox.style.opacity = mlbText.style.opacity = 1; run(true); }
      });
    }));
    vIn.addEventListener("input", () => run(false));
    rIn.addEventListener("input", () => run(false));
    run(false);
    let thrown = false;
    whenVisible(group, () => { if (!thrown) { thrown = true; run(); } });
  })();

  // ---------- 05 · Robotic crane ----------
  (function crane() {
    const svg = $("#crane-svg"), demo = svg && svg.closest(".demo"), out = $("#crane-readout");
    if (!svg) return;
    const PX = 6.5;                       // px per cm; the arm spans the crane's 51 cm reach
    const COLX = 100, TOPY = 46, FLOOR = 250, ARM = 51 * PX, HOIST_MAX = 25, BENCHY = 4.8; // cm
    const PAD = 40;                       // target pad position (cm from the column)
    const JAW_FLOOR = FLOOR - 10;         // jaw tips at full hoist depth
    const K = (JAW_FLOOR - 28 - (TOPY + 8)) / HOIST_MAX;  // px per cm of hoist
    const BPX = BENCHY * K;               // drawn Benchy height in px
    const BENCHY_PATH = "M-12 0 L12 0 L9 -10 L2 -10 L2 -20 L-6 -20 L-6 -10 L-10 -10 Z";
    const st = { t: 30, h: 4, theta: 0, grip: false, carrying: false, benchy: 18, stacked: 0 };

    // static parts
    svgEl("rect", { x: 20, y: FLOOR, width: 480, height: 4, fill: "#2f7046" }, svg);
    svgEl("rect", { x: COLX - 34, y: FLOOR - 16, width: 68, height: 16, rx: 4, fill: "#5b6776" }, svg);   // base / turntable
    svgEl("rect", { x: COLX - 9, y: TOPY, width: 18, height: FLOOR - 16 - TOPY, fill: "#8e98a8" }, svg);  // 2040 column
    svgEl("rect", { x: COLX, y: TOPY - 10, width: ARM + 14, height: 10, fill: "#a3adb8" }, svg);          // 2020 arm
    svgEl("rect", { x: COLX + PAD * PX - 16, y: FLOOR - 4, width: 32, height: 4, fill: "#b5d984" }, svg);  // target pad
    text(svg, COLX + PAD * PX, FLOOR + 18, "target ±5 mm", "d-text", "middle");
    for (let c = 0; c <= 40; c += 10) text(svg, COLX + c * PX, TOPY - 16, c + "", "d-text", "middle");
    text(svg, COLX + ARM, TOPY - 16, "51 cm", "d-text", "end");
    const trolley = svgEl("rect", { width: 26, height: 12, rx: 3, fill: "#b5d984" }, svg);
    const wire = svgEl("line", { stroke: "#f1f8ef", "stroke-width": 1.5 }, svg);
    const head = svgEl("rect", { width: 22, height: 14, rx: 3, fill: "#5b6776" }, svg);
    const jawL = svgEl("rect", { width: 4, height: 14, fill: "#f1f8ef" }, svg);
    const jawR = svgEl("rect", { width: 4, height: 14, fill: "#f1f8ef" }, svg);
    const stackG = svgEl("g", {}, svg);
    const benchy = svgEl("path", { d: BENCHY_PATH, fill: "#82d1c5" }, svg);
    // top-view dial for base rotation
    const dial = svgEl("g", { transform: "translate(470 210)" }, svg);
    svgEl("circle", { r: 26, fill: "none", stroke: "#2f7046", "stroke-width": 2 }, dial);
    const dialArm = svgEl("line", { x1: 0, y1: 0, x2: 0, y2: -24, stroke: "#b5d984", "stroke-width": 3, "stroke-linecap": "round" }, dial);
    text(dial, 0, 42, "top view", "d-text", "middle");

    const contactDepth = () => {          // hoist depth where the jaws (or a carried Benchy) meet the floor or the stack
      const atPad = Math.abs(st.t - PAD) <= 1.5;
      return HOIST_MAX - (atPad ? st.stacked * BENCHY : 0) - (st.carrying ? BENCHY * 0.5 : 0);
    };
    function draw() {
      const tx = COLX + st.t * PX, hy = TOPY + 8 + st.h * K;
      trolley.setAttribute("x", tx - 13); trolley.setAttribute("y", TOPY - 2);
      wire.setAttribute("x1", tx); wire.setAttribute("x2", tx); wire.setAttribute("y1", TOPY + 10); wire.setAttribute("y2", hy);
      head.setAttribute("x", tx - 11); head.setAttribute("y", hy);
      const open = st.grip ? 6 : 13;
      jawL.setAttribute("x", tx - open - 2); jawL.setAttribute("y", hy + 14);
      jawR.setAttribute("x", tx + open - 2); jawR.setAttribute("y", hy + 14);
      const sc = BPX / 20;                // path is 20 units tall
      const by = st.carrying ? hy + 14 + BPX : FLOOR;
      const bx = st.carrying ? tx : COLX + st.benchy * PX;
      benchy.setAttribute("transform", `translate(${bx} ${by}) scale(${sc})`);
      benchy.style.display = st.stacked >= 3 && !st.carrying ? "none" : "";
      stackG.replaceChildren();
      for (let i = 0; i < st.stacked; i++) svgEl("path", { d: BENCHY_PATH, fill: "#82d1c5", opacity: 0.85, transform: `translate(${COLX + PAD * PX} ${FLOOR - i * BPX}) scale(${BPX / 20})` }, stackG);
      dialArm.setAttribute("transform", `rotate(${st.theta})`);
      out.innerHTML = `<strong>Reach ${st.t.toFixed(1)} cm · hoist ${st.h.toFixed(0)} cm · base ${Math.round(st.theta)}°</strong> · Stacked ${st.stacked}/3 on the ±5 mm pad${st.stacked >= 3 ? " · validated, like the real one" : ""}`;
    }
    function act(cmd) {
      if (cmd === "left") st.t = clamp(st.t - 0.5, 6, 51);
      if (cmd === "right") st.t = clamp(st.t + 0.5, 6, 51);
      st.h = Math.min(st.h, contactDepth());
      if (cmd === "up") st.h = clamp(st.h - 1, 0, HOIST_MAX);
      if (cmd === "down") st.h = clamp(st.h + 1, 0, contactDepth());
      if (cmd === "ccw") st.theta = (st.theta - 5) % 360;
      if (cmd === "cw") st.theta = (st.theta + 5) % 360;
      if (cmd === "grip") {
        const atBottom = st.h >= contactDepth() - 0.5;
        if (!st.grip) {
          st.grip = true;
          if (!st.carrying && atBottom && Math.abs(st.t - st.benchy) <= 1 && st.stacked < 3) st.carrying = true;
        } else {
          st.grip = false;
          if (st.carrying) {
            st.carrying = false;
            if (Math.abs(st.t - PAD) <= 0.5) { st.stacked++; st.benchy = 18; }  // within ±5 mm
            else st.benchy = st.t;
          }
        }
      }
      draw();
    }
    const KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", q: "ccw", Q: "ccw", e: "cw", E: "cw", " ": "grip" };
    demo.addEventListener("keydown", ev => { const c = KEYS[ev.key]; if (c) { ev.preventDefault(); act(c); } });
    $$("[data-crane]", demo).forEach(b => {
      let timer = 0;
      const stop = () => clearInterval(timer);
      b.addEventListener("pointerdown", () => {
        act(b.dataset.crane);
        if (b.dataset.crane !== "grip") timer = setInterval(() => act(b.dataset.crane), 90);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(t => b.addEventListener(t, stop));
      b.addEventListener("keydown", ev => { if (ev.key === "Enter") act(b.dataset.crane); });
    });
    draw();
  })();

  // ---------- 06 · Wagon suspension (ME 481 analysis) ----------
  (function suspension() {
    const svg = $("#susp-svg"), input = $("#susp-load"), out = $("#susp-readout");
    if (!svg) return;
    const K_SHOCK = 131, MR = 0.316, KW = K_SHOCK * MR * MR;   // N/mm → 13.1 N/mm wheel rate
    const TRAVEL = 50, ARM = 263, WHEEL_R = 127;                // mm
    const S = 0.62;                                             // px per mm
    const GROUND = 214, WX = 330, WY = GROUND - WHEEL_R * S;    // wheel centre stays on the ground
    const PIVOT_Y0 = WY - 70;                                   // unloaded pivot height
    svgEl("rect", { x: 0, y: GROUND, width: 520, height: 3, fill: "#2f7046" }, svg);
    const frame = svgEl("rect", { height: 14, rx: 3, fill: "#5b6776" }, svg);
    const arm = svgEl("line", { stroke: "#a3adb8", "stroke-width": 9, "stroke-linecap": "round" }, svg);
    const coil = svgEl("polyline", { fill: "none", stroke: "#b5d984", "stroke-width": 3, "stroke-linejoin": "round" }, svg);
    const tyre = svgEl("circle", { cx: WX, cy: WY, r: WHEEL_R * S, fill: "#22603a", stroke: "#8e98a8", "stroke-width": 8 }, svg);
    svgEl("circle", { cx: WX, cy: WY, r: 8, fill: "#a3adb8" }, svg);
    const pivot = svgEl("circle", { r: 6, fill: "#82d1c5" }, svg);
    const sagLabel = text(svg, 0, 0, "", "d-value");
    const load = svgEl("rect", { width: 70, rx: 4, fill: "rgba(130,209,197,0.25)", stroke: "#82d1c5" }, svg);
    const loadText = text(svg, 0, 0, "", "d-value", "middle");
    tyre.setAttribute("aria-hidden", "true");

    function geometry(sag) {
      const py = PIVOT_Y0 + sag * S, dy = WY - py;
      const dx = Math.sqrt(Math.max(1, (ARM * S) ** 2 - dy * dy));
      return { px: WX - dx, py };
    }
    function drawAt(sag, kg) {
      const { px, py } = geometry(sag);
      frame.setAttribute("x", px - 120); frame.setAttribute("y", py - 34); frame.setAttribute("width", 300);
      arm.setAttribute("x1", px); arm.setAttribute("y1", py); arm.setAttribute("x2", WX); arm.setAttribute("y2", WY);
      pivot.setAttribute("cx", px); pivot.setAttribute("cy", py);
      // shock: frame mount above the arm point at the motion-ratio position
      const ax = px + (WX - px) * MR, ay = py + (WY - py) * MR, top = py - 20;
      const pts = [[ax, top]], n = 10, len = ay - top;
      for (let i = 1; i < n; i++) pts.push([ax + (i % 2 ? 7 : -7), top + (len * i) / n]);
      pts.push([ax, ay]);
      coil.setAttribute("points", pts.map(p => p.join(",")).join(" "));
      const h = 16 + kg * 1.1;
      load.setAttribute("x", px + 30); load.setAttribute("y", py - 34 - h); load.setAttribute("height", h);
      loadText.setAttribute("x", px + 65); loadText.setAttribute("y", py - 40 - h);
      loadText.textContent = kg + " kg";
      sagLabel.setAttribute("x", WX + WHEEL_R * S + 12); sagLabel.setAttribute("y", WY);
      sagLabel.textContent = `sag ${sag.toFixed(1)} mm`;
    }
    let bumpAnim = 0;
    function update() {
      const kg = Number(input.value);
      $("#susp-load-out").textContent = kg + " kg";
      const sag = (kg * 9.81) / KW, f = Math.sqrt((KW * 1000) / kg) / (2 * Math.PI);
      const left = TRAVEL - sag, shockF = (kg * 9.81) / MR;
      drawAt(Math.min(sag, TRAVEL), kg);
      out.innerHTML = `<strong>Sag ${sag.toFixed(1)} mm · ride frequency ${f.toFixed(1)} Hz</strong> · shock force ${Math.round(shockF)} N · ${left > 0 ? left.toFixed(0) + " mm of travel left" : "bottomed out"}. Design point: 20 kg → 15 mm, 4.1 Hz. <button type="button" class="demo-btn" id="bump-btn">Hit a bump</button>`;
      $("#bump-btn").addEventListener("click", () => bump(kg, sag, f));
    }
    function bump(kg, sag, f) {
      cancelAnimationFrame(bumpAnim);
      if (reduceMotion) return;
      const t0 = performance.now(), zeta = 0.3, wn = 2 * Math.PI * f, wd = wn * Math.sqrt(1 - zeta * zeta);
      (function step(now) {
        const t = ((now - t0) / 1000) / 4;          // shown at quarter speed
        const x = 18 * Math.exp(-zeta * wn * t) * Math.cos(wd * t);
        drawAt(clamp(sag + x, 0, TRAVEL), kg);
        if (t < 1.6) bumpAnim = requestAnimationFrame(step); else drawAt(sag, kg);
      })(t0);
    }
    input.addEventListener("input", update);
    update();
  })();

  // ---------- Experience: MTR route ----------
  // A train rides the line to the chosen station (longer trips take longer), then that
  // station's panel slides in from the direction of travel.
  (function route() {
    const routeEl = $(".route"), train = $(".route-train");
    const btns = $$(".stop-btn"), panels = $$(".stop-panel"), steps = $$(".route-step");
    if (!routeEl || !btns.length) return;
    const names = btns.map(b => b.querySelector(".stop-en").textContent);
    let cur = Math.max(0, btns.findIndex(b => b.getAttribute("aria-pressed") === "true"));

    function placeTrain(i, ms) {
      if (!train) return;
      const r = routeEl.getBoundingClientRect(), d = btns[i].querySelector(".stop-dot").getBoundingClientRect();
      train.style.setProperty("--ride", ms + "ms");
      train.style.setProperty("--train", getComputedStyle(btns[i].closest(".stop")).getPropertyValue("--line"));
      train.style.transform = `translate(${d.left + d.width / 2 - r.left}px, ${d.top + d.height / 2 - r.top}px)`;
    }
    function syncSteps() {
      steps.forEach(b => {
        const to = cur + Number(b.dataset.dir), ok = to >= 0 && to < btns.length;
        b.disabled = !ok;
        b.querySelector(".route-step-label").textContent = ok ? names[to] : (to < 0 ? "First station" : "Last station");
        b.setAttribute("aria-label", ok ? `${b.dataset.dir > 0 ? "Next" : "Previous"} station: ${names[to]}` : "No more stations");
      });
    }
    function go(i) {
      if (i === cur || i < 0 || i >= btns.length) return;
      const dir = i > cur ? 1 : -1, hops = Math.abs(i - cur);
      const ride = Math.min(500 + hops * 350, 1700);
      train?.classList.toggle("is-reversed", dir < 0);           // the cab leads the way
      btns.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
      const out = panels[cur], inn = panels[i];
      // Old panel leaves against the direction of travel; the new one arrives as the train pulls in.
      out.style.setProperty("--shift", -dir * 70 + "px");
      out.classList.remove("is-active");
      inn.style.transition = "none";
      inn.style.setProperty("--shift", dir * 70 + "px");
      void inn.offsetWidth;
      inn.style.transition = "";
      inn.style.setProperty("--delay", Math.round(ride * 0.45) + "ms");
      inn.classList.add("is-active");
      panels.forEach(p => { p.inert = p !== inn; p.setAttribute("aria-hidden", String(p !== inn)); });
      cur = i;
      placeTrain(i, ride);
      syncSteps();
    }
    panels.forEach((p, k) => { p.inert = k !== cur; p.setAttribute("aria-hidden", String(k !== cur)); });
    btns.forEach((b, i) => b.addEventListener("click", () => go(i)));
    steps.forEach(b => b.addEventListener("click", () => go(cur + Number(b.dataset.dir))));
    routeEl.addEventListener("keydown", ev => {
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      ev.preventDefault();
      go(cur + (ev.key === "ArrowRight" ? 1 : -1));
      btns[cur].focus();
    });
    placeTrain(cur, 0);
    syncSteps();
    window.addEventListener("resize", () => placeTrain(cur, 0));
    document.fonts?.ready.then(() => placeTrain(cur, 0));
  })();

  // ---------- Toolbox: the lid swings open when it comes into view ----------
  (function toolbox() {
    const box = $("#toolbox");
    if (!box || reduceMotion) return;
    box.classList.add("is-closed");
    whenVisible(box, () => box.classList.remove("is-closed"), null, 0.35);
  })();

  // ---------- Contact form ----------
  (function contactForm() {
    const form = $("#mail-form"), status = $("#form-status");
    if (!form) return;
    const TO = "marcokingching@gmail.com";
    const fields = ["#f-first", "#f-last", "#f-email", "#f-body"].map(id => $(id));
    const say = (msg, kind = "") => { status.textContent = msg; status.className = "form-status" + (kind ? " is-" + kind : ""); };
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      let bad = null;
      fields.forEach(f => {
        const ok = f.value.trim() !== "" && (f.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
        f.setAttribute("aria-invalid", String(!ok));
        if (!ok && !bad) bad = f;
      });
      if (bad) { say(bad.type === "email" ? "Check the email address, it needs an @ and a domain." : "Fill in every field so I know who to reply to."); bad.focus(); return; }
      const [first, last, email, body] = fields.map(f => f.value.trim());
      const name = `${first} ${last}`, subject = `Website message from ${name}`;
      const key = form.dataset.accessKey;
      if (key) {
        say("Sending…");
        try {
          const res = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ access_key: key, subject, from_name: name, name, email, message: body, replyto: email }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.message || "Send failed");
          form.reset();
          say(`Sent. I’ll reply to ${email}.`, "ok");
        } catch (err) {
          say(`That didn’t go through (${err.message}). Email ${TO} directly instead.`, "error");
        }
        return;
      }
      const href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n${name}\n${email}`)}`;
      window.location.href = href;
      say(`Your email app should open with the message ready to send. If nothing opens, email ${TO}.`, "ok");
    });
    fields.forEach(f => f.addEventListener("input", () => f.removeAttribute("aria-invalid")));
  })();

  // ---------- Smooth scrolling with weight, and eased jumps to sections ----------
  (function smoothScroll() {
    const ease = t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);   // ease-in-out quart: speeds up, then slows down
    let lenis = null;
    if (window.Lenis) {
      // Quick, with just a short glide at the end of each scroll.
      lenis = new Lenis({ lerp: 0.16, wheelMultiplier: 1.25, touchMultiplier: 1.3, smoothWheel: true });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
      document.documentElement.classList.add("lenis-on");
    }
    document.addEventListener("click", ev => {
      const a = ev.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      const target = id === "#top" ? document.body : $(id);
      if (!target) return;
      ev.preventDefault();
      // Story steps fill the screen, so they line up with the top; other sections clear the top bar.
      const offset = id === "#top" || target.closest(".story") ? 0 : -76;
      const distance = Math.abs(target.getBoundingClientRect().top + offset);
      const duration = clamp(0.45 + distance / 9000, 0.6, 1.2);
      if (lenis) lenis.scrollTo(target, { offset, duration, easing: ease });
      else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + offset, behavior: "smooth" });
      history.replaceState(null, "", id);
    });
  })();

  // ---------- Top bar: mark the section you're scrolling through ----------
  // Every region carries data-nav with the id its top-bar link points to; an underline glides between links.
  (function navSpy() {
    const nav = $(".nav-links");
    const links = $$('.nav-links a[href^="#"]');
    const regions = $$("[data-nav]");
    if (!nav || !links.length || !regions.length) return;
    const ink = document.createElement("span");
    ink.className = "nav-ink";
    ink.setAttribute("aria-hidden", "true");
    nav.appendChild(ink);
    let current, queued = false;
    function moveInk() {
      if (!current) { ink.style.opacity = "0"; return; }
      ink.style.opacity = "1";
      ink.style.width = current.offsetWidth + "px";
      ink.style.transform = `translateX(${current.offsetLeft}px)`;
    }
    function mark() {
      queued = false;
      const line = window.innerHeight * 0.4;                // a region counts once its top passes this line
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let key = atEnd ? regions[regions.length - 1].dataset.nav : null;
      if (!key) regions.forEach(r => { const b = r.getBoundingClientRect(); if (b.top <= line && b.bottom > line) key = r.dataset.nav; });
      const on = key ? links.find(a => a.getAttribute("href") === "#" + key) || null : null;
      if (on === current) return;
      current = on;
      links.forEach(a => (a === on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
      moveInk();
      // On phones the links scroll sideways: keep the marked one in view.
      if (on && nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: "smooth" });
      }
    }
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(mark); } };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", () => { moveInk(); queue(); });
    document.fonts?.ready.then(moveInk);
    mark();
  })();

  // ---------- Content below the story slides up into place as it arrives ----------
  (function slideIn() {
    const items = $$(".projects .proj, .sec-head, .route-hint, .route, .route-nav, .stop-panels, .toolbox, .contact-side, .mail-form");
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach(el => { el.classList.add("slide-in"); io.observe(el); });
  })();

  // ---------- Water: the page surface ripples where the pointer goes ----------
  // A fixed canvas behind the light sections (the 3D stage covers it in the story). Moving the pointer
  // leaves expanding rings and a soft patch of light follows it; a tap or click drops a bigger ripple.
  // Nothing moves on its own: the loop runs only while there is a ring or the light is still catching up.
  (function water() {
    const canvas = $("#water");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = { x: -1e4, y: -1e4, t: 0 };
    const rings = [], glow = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, a: 0, ta: 0 };
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wake();
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      glow.x += (glow.tx - glow.x) * 0.12; glow.y += (glow.ty - glow.y) * 0.12; glow.a += (glow.ta - glow.a) * 0.08;
      if (glow.a > 0.01) {
        const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 260);
        g.addColorStop(0, `rgba(130, 209, 197, ${0.34 * glow.a})`);
        g.addColorStop(0.45, `rgba(75, 151, 192, ${0.12 * glow.a})`);
        g.addColorStop(1, "rgba(75, 151, 192, 0)");
        ctx.fillStyle = g; ctx.fillRect(glow.x - 260, glow.y - 260, 520, 520);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i], k = (now - r.t) / r.life;
        if (k >= 1) { rings.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - k, 3);
        [0, 0.35].forEach((lag, j) => {          // a ring and a fainter one behind it
          const kk = clamp((e - lag) / (1 - lag), 0, 1);
          if (kk <= 0) return;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, r.size * kk, r.size * kk * 0.62, 0, 0, Math.PI * 2);   // seen at an angle, like a pond
          ctx.strokeStyle = `rgba(${j ? "70, 149, 61" : "43, 119, 161"}, ${(1 - k) * (j ? 0.26 : 0.45)})`;
          ctx.lineWidth = 1.6 - j * 0.6;
          ctx.stroke();
        });
      }
      const settling = Math.abs(glow.tx - glow.x) + Math.abs(glow.ty - glow.y) > 0.5 || Math.abs(glow.ta - glow.a) > 0.01;
      if (rings.length || settling) wake();
    }
    function drop(x, y, size, life) {
      if (calm) return;
      rings.push({ x, y, size, life, t: performance.now() });
      if (rings.length > 40) rings.shift();
    }
    window.addEventListener("pointermove", e => {
      glow.tx = e.clientX; glow.ty = e.clientY; glow.ta = 1;
      if (glow.x < -1000) { glow.x = e.clientX; glow.y = e.clientY; }
      const moved = Math.hypot(e.clientX - last.x, e.clientY - last.y), now = performance.now();
      if (moved > 36 || (moved > 6 && now - last.t > 140)) {
        drop(e.clientX, e.clientY, 46 + Math.min(moved, 90) * 0.5, 1700);
        last = { x: e.clientX, y: e.clientY, t: now };
      }
      wake();
    }, { passive: true });
    window.addEventListener("pointerdown", e => { drop(e.clientX, e.clientY, 140, 1800); wake(); }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { glow.ta = 0; wake(); });
    window.addEventListener("resize", size);
    size();
  })();

  // ---------- Titles: letters near the pointer thin out, like type seen through moving water ----------
  // Each [data-swell] heading is split into letter spans (aria-hidden; the heading keeps an aria-label)
  // and grows from light to its full weight when it first scrolls into view.
  (function swell() {
    const heads = $$("[data-swell]");
    if (!heads.length) return;
    const items = heads.map(h => {
      h.setAttribute("aria-label", h.textContent.replace(/\s+/g, " ").trim());
      const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach(n => {
        const frag = document.createDocumentFragment();
        [...n.textContent].forEach(ch => {
          if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); return; }
          const sp = document.createElement("span");
          sp.className = "sw"; sp.textContent = ch; sp.setAttribute("aria-hidden", "true");
          frag.appendChild(sp);
        });
        n.replaceWith(frag);
      });
      return { h, letters: $$(".sw", h), centres: null };
    });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { threshold: 0.3 });
    heads.forEach(h => io.observe(h));
    function measure(it) {                         // letter centres relative to the heading, at rest
      const b = it.h.getBoundingClientRect();
      it.centres = it.letters.map(l => { const r = l.getBoundingClientRect(); return [r.left + r.width / 2 - b.left, r.top + r.height / 2 - b.top]; });
    }
    window.addEventListener("resize", () => items.forEach(it => { it.centres = null; }));
    document.fonts?.ready.then(() => items.forEach(it => { it.centres = null; }));
    let px = -1e4, py = -1e4, queued = false;
    function apply() {
      queued = false;
      items.forEach(it => {
        const b = it.h.getBoundingClientRect();
        if (b.bottom < -200 || b.top > innerHeight + 200) return;
        if (!it.centres) measure(it);
        const reach = Math.max(90, b.height * 0.9);
        it.letters.forEach((l, i) => {
          const d = Math.hypot(px - b.left - it.centres[i][0], py - b.top - it.centres[i][1]);
          const lift = Math.round(-380 * Math.exp(-(d * d) / (2 * reach * reach)));
          if (l._lift !== lift) { l._lift = lift; l.style.setProperty("--lift", lift); }
        });
      });
    }
    window.addEventListener("pointermove", e => { px = e.clientX; py = e.clientY; if (!queued) { queued = true; requestAnimationFrame(apply); } }, { passive: true });
    window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(apply); } }, { passive: true });
  })();

  // ---------- Copy email, year ----------
  const copyButton = $("#copy-email");
  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.email);
      copyButton.textContent = "Copied";
    } catch {
      const range = document.createRange();
      range.selectNodeContents($(".contact-email"));
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      copyButton.textContent = "Selected, press Ctrl+C";
    }
    setTimeout(() => { copyButton.textContent = "Copy email"; }, 2200);
  });
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
