// Interactive sections below the hero.
// Every number here comes from Marco's reports (ME 572, ME 362, ME 481, the robotic crane
// report and the IEEE poster). Where a picture is illustrative rather than data, it says so.

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

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

  // ---------- 01 · Envelope: best tested value vs control ----------
  (function envelope() {
    const svg = $("#envelope-svg");
    if (!svg) return;
    // ME 572 Project 2, "Comparison of Lowest Tested Values vs Control" (% change)
    const ROWS = [
      { name: "Roof U-value", change: "0.063 → 0.033", cost: -3.05, eui: -6.02, ghg: -7.93 },
      { name: "Wall U-value", change: "0.084 → 0.044", cost: -2.17, eui: -4.10, ghg: -5.34 },
      { name: "Glazing SHGC", change: "0.70 → 0.30", cost: -7.47, eui: 3.49, ghg: 10.61 },
      { name: "Outdoor air", change: "20 → 10 cfm/p", cost: -2.46, eui: -6.45, ghg: -9.00 },
    ];
    const L = 150, R = 470, top = 26, rowH = 50, lim = 12;
    const x = v => L + ((v + lim) / (2 * lim)) * (R - L);
    for (let t = -10; t <= 10; t += 5) {
      svgEl("line", { x1: x(t), x2: x(t), y1: top - 8, y2: top + rowH * 4, class: t === 0 ? "d-axis" : "d-grid" }, svg);
      text(svg, x(t), top + rowH * 4 + 16, (t > 0 ? "+" : t < 0 ? "−" : "") + Math.abs(t) + "%", "d-text", "middle");
    }
    text(svg, x(-lim) + 2, top - 12, "← better", "d-text");
    text(svg, x(lim) - 2, top - 12, "worse →", "d-text", "end");
    const bars = ROWS.map((r, i) => {
      const y = top + i * rowH + 8;
      text(svg, 0, y + 12, r.name, "d-label");
      text(svg, 0, y + 27, r.change, "d-text");
      const bar = svgEl("rect", { y, height: 22, rx: 4 }, svg);
      const val = text(svg, 0, y + 15, "", "d-value");
      const tip = svgEl("title", {}, bar);
      return { r, bar, val, tip };
    });
    function render(metric) {
      bars.forEach(({ r, bar, val, tip }) => {
        const v = r[metric];
        bar.setAttribute("x", Math.min(x(0), x(v)));
        bar.setAttribute("width", Math.max(2, Math.abs(x(v) - x(0))));
        bar.setAttribute("class", v < 0 ? "d-cyan" : "d-neon");
        val.textContent = (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%";
        val.setAttribute("x", v < 0 ? x(v) - 6 : x(v) + 6);
        val.setAttribute("text-anchor", v < 0 ? "end" : "start");
        tip.textContent = `${r.name} ${r.change}: ${val.textContent}`;
      });
    }
    const group = svg.closest(".demo");
    $$("[data-metric]", group).forEach(b => b.addEventListener("click", () => {
      setPressed(group, "data-metric", b.dataset.metric);
      render(b.dataset.metric);
    }));
    render("ghg");

    // All 17 runs (control repeated once per parameter)
    const runs = [
      ["Roof U-value", [[0.033, 12256, 98.06, 17905, 239.8, 187.3], [0.048, 12449, 101.21, 18677, 243.7, 191.7], [0.063, 12642, 104.34, 19448, 247.6, 196.4], [0.078, 12832, 107.41, 20209, 251.4, 201.0], [0.093, 13023, 110.54, 20984, 255.0, 205.6]], 0.063],
      ["Wall U-value", [[0.044, 12368, 100.06, 18409, 240.1, 190.1], [0.064, 12506, 102.22, 18934, 243.8, 193.2], [0.084, 12642, 104.34, 19448, 247.6, 196.4], [0.104, 12775, 106.41, 19955, 251.3, 199.5], [0.124, 12909, 108.48, 20463, 254.9, 202.6]], 0.084],
      ["Glazing SHGC", [[0.30, 11698, 107.98, 21511, 169.5, 201.0], [0.40, 11886, 106.50, 20873, 186.7, 200.1], [0.50, 12099, 105.49, 20350, 206.0, 199.0], [0.60, 12359, 104.75, 19867, 226.5, 197.8], [0.70, 12642, 104.34, 19448, 247.6, 196.4]], 0.70],
      ["Outdoor air", [[10, 12331, 97.61, 17698, 248.0, 183.2], [15, 12480, 100.89, 18555, 247.7, 189.8], [20, 12642, 104.34, 19448, 247.6, 196.4], [25, 12804, 107.77, 20344, 247.4, 203.0], [30, 12972, 111.33, 21271, 247.3, 209.6]], 20],
    ];
    const table = $("#runs-table");
    if (table) {
      const fmt = (name, v) => name === "Glazing SHGC" ? v.toFixed(2) : String(v);
      table.innerHTML = `<thead><tr><th scope="col">Parameter</th><th scope="col">Value</th><th scope="col">Cost/yr</th><th scope="col">Site EUI</th><th scope="col">GHG kg</th><th scope="col">Peak cool</th><th scope="col">Peak heat</th></tr></thead><tbody>` +
        runs.flatMap(([name, rows, ctrl]) => rows.map(([v, c, e, g, pc, ph]) =>
          `<tr${v === ctrl ? ' class="is-control"' : ""}><th scope="row">${name}</th><td>${fmt(name, v)}</td><td>$${c.toLocaleString("en-US")}</td><td>${e.toFixed(2)}</td><td>${g.toLocaleString("en-US")}</td><td>${pc.toFixed(1)}</td><td>${ph.toFixed(1)}</td></tr>`)).join("") +
        `</tbody><caption class="demo-note" style="caption-side:bottom;text-align:left;padding-top:8px">Highlighted: control case (one run, listed per parameter). EUI in kBtu/ft²·yr, peaks in kBtu/h.</caption>`;
    }
  })();

  // ---------- 02 · Lighting plan ----------
  (function lighting() {
    const svg = $("#lighting-svg"), meters = $("#lighting-meters");
    if (!svg) return;
    const W = 48, D = 34, s = Math.min(460 / W, 250 / D);
    const ox = (520 - W * s) / 2, oy = 22;
    const OPTIONS = [
      { cols: 4, rows: 4, n: 16, fc: 42, lpd: 0.41, note: "Passes, but with no illuminance margin." },
      { cols: 5, rows: 4, n: 20, fc: 52, lpd: 0.52, note: "Chosen: 10 fc of margin, still under the power cap." },
    ];
    const defs = svgEl("defs", {}, svg);
    const grad = svgEl("radialGradient", { id: "pool" }, defs);
    svgEl("stop", { offset: "0%", "stop-color": "#ffd88a", "stop-opacity": "0.55" }, grad);
    svgEl("stop", { offset: "100%", "stop-color": "#ffd88a", "stop-opacity": "0" }, grad);
    svgEl("rect", { x: ox, y: oy, width: W * s, height: D * s, fill: "#131923", stroke: "#8e98a8", "stroke-width": 2 }, svg);
    // South window: 44 ft wide, 2 ft from the left (COMFEN model)
    svgEl("line", { x1: ox + 2 * s, x2: ox + 46 * s, y1: oy + D * s, y2: oy + D * s, stroke: "#2a9fd6", "stroke-width": 5 }, svg);
    text(svg, ox + 24 * s, oy + D * s + 16, "South window · 44 ft", "d-text", "middle");
    text(svg, ox, oy - 8, "48 ft", "d-text");
    text(svg, ox + W * s + 6, oy + 10, "34 ft", "d-text");
    const layer = svgEl("g", {}, svg);
    function render(i) {
      const o = OPTIONS[i];
      layer.replaceChildren();
      const sx = W / o.cols, sy = D / o.rows;
      for (let c = 0; c < o.cols; c++) for (let r = 0; r < o.rows; r++) {
        const cx = ox + (c + 0.5) * sx * s, cy = oy + (r + 0.5) * sy * s;
        svgEl("circle", { cx, cy, r: 6.5 * s, fill: "url(#pool)" }, layer);
        svgEl("rect", { x: cx - 2 * s, y: cy - 1 * s, width: 4 * s, height: 2 * s, rx: 2, fill: "#fff1c9" }, layer);
      }
      // spacing dimension on the first row
      const y = oy + 0.5 * sy * s - 14;
      const x1 = ox + 0.5 * sx * s, x2 = ox + 1.5 * sx * s;
      svgEl("line", { x1, x2, y1: y, y2: y, class: "d-dim" }, layer);
      text(layer, (x1 + x2) / 2, y - 4, sx.toFixed(1) + " ft", "d-value", "middle");
      meters.innerHTML = `
        <div class="meter"><span>Illuminance <b>${o.fc} fc</b> · min 42</span>
          <div class="meter-bar"><div class="meter-fill" style="width:${(o.fc / 70) * 100}%"></div><div class="meter-mark" style="left:${(42 / 70) * 100}%"></div></div></div>
        <div class="meter"><span>Power density <b>${o.lpd.toFixed(2)} W/ft²</b> · max 0.60</span>
          <div class="meter-bar"><div class="meter-fill" style="width:${(o.lpd / 0.8) * 100}%;background:var(--amber)"></div><div class="meter-mark" style="left:${(0.6 / 0.8) * 100}%"></div></div></div>
        <p class="demo-note" style="grid-column:1/-1">${o.n} luminaires. ${o.note}</p>`;
    }
    const group = svg.closest(".demo");
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
    const proj = (lon, lat) => [((lon - 113.95) / 0.4) * 520, ((22.45 - lat) / 0.3) * 260];
    const SRC = { name: "Cheung Chau", p: proj(114.028, 22.209) };
    const STATIONS = [
      { name: "School", p: proj(114.131, 22.262), dy: -7 },
      { name: "Cyberport 2", p: proj(114.131, 22.262), dy: 7 },
      { name: "Sai Kung", p: proj(114.272, 22.383), dy: 0 },
    ];
    // Radar-style dot grid in place of a coastline: this is a schematic, not a map.
    for (let gx = 10; gx < 520; gx += 20) for (let gy = 10; gy < 260; gy += 20) svgEl("circle", { cx: gx, cy: gy, r: 0.9, fill: "#2a3344" }, svg);
    const rings = svgEl("g", {}, svg);
    svgEl("circle", { cx: SRC.p[0], cy: SRC.p[1], r: 6, class: "d-neon" }, svg);
    text(svg, SRC.p[0] + 10, SRC.p[1] + 4, "Cheung Chau · source", "d-label");
    const dots = STATIONS.map((st, i) => {
      const [x, y] = st.p;
      const d = svgEl("rect", { x: x - 5 + (i === 1 ? 7 : 0), y: y - 5 + (i === 0 ? -6 : i === 1 ? 4 : 0), width: 10, height: 10, rx: 2, fill: "#2a9fd6" }, svg);
      return d;
    });
    text(svg, STATIONS[0].p[0] + 18, STATIONS[0].p[1] - 4, "Pokfulam · 2 Raspberry Shakes", "d-label");
    text(svg, STATIONS[0].p[0] + 18, STATIONS[0].p[1] + 10, "280 m apart", "d-text");
    text(svg, STATIONS[2].p[0] - 10, STATIONS[2].p[1] - 10, "Sai Kung seismograph", "d-label", "end");
    text(svg, 10, 250, "HKO catalogue: ≥ M3.0 · this project: down to ~M1", "d-text");

    const dist = STATIONS.map(st => Math.hypot(st.p[0] - SRC.p[0], st.p[1] - SRC.p[1]));
    const ctx = canvas.getContext("2d");
    const LABELS = ["School", "Cyberport", "Sai Kung"];
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
          if (rr > 0) svgEl("circle", { cx: SRC.p[0], cy: SRC.p[1], r: rr, fill: "none", stroke: "#ff3d6e", "stroke-opacity": Math.max(0, 0.8 - rr / 520) * (1 - k * 0.25), "stroke-width": 2 }, rings);
        });
        rows.forEach((row, i) => { if (!row.hit && r >= dist[i]) { row.hit = true; row.amp = 1; dots[i].setAttribute("fill", "#ff3d6e"); } });
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
        if (row.amp < 0.05 && row.hit) dots[i].setAttribute("fill", "#2a9fd6");
        const mid = rh * i + rh / 2;
        ctx.strokeStyle = "#2a3344"; ctx.beginPath(); ctx.moveTo(70, mid); ctx.lineTo(W, mid); ctx.stroke();
        ctx.fillStyle = "#9aa3b3"; ctx.font = "10px Geist Mono, monospace"; ctx.fillText(LABELS[i], 8, mid + 3);
        ctx.strokeStyle = row.amp > 0.1 ? "#ff3d6e" : "#2a9fd6"; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let k = 0; k < row.buf.length; k++) {
          const px = 70 + (k / (row.buf.length - 1)) * (W - 74), py = mid - row.buf[k] * rh * 0.42;
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
      const n = Math.hypot(...axis), ax = axis.map(a => a / n), th = (launch * Math.PI) / 180, w = (rpm * 2 * Math.PI) / 60;
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
    const mlbBox = svgEl("rect", { fill: "rgba(42,159,214,0.18)", stroke: "#2a9fd6", "stroke-dasharray": "3 3" }, svg);
    const mlbText = text(svg, 0, 0, "MLB range", "d-text");
    const sidePath = svgEl("polyline", { fill: "none", stroke: "#ff3d6e", "stroke-width": 2.5, "stroke-linecap": "round" }, svg);
    const ball = svgEl("circle", { r: 5, fill: "#fff" }, svg);
    const hit = svgEl("circle", { r: 6, fill: "#ff3d6e", stroke: "#0a0d12", "stroke-width": 2 }, svg);
    const ballC = svgEl("circle", { r: 5, fill: "#fff" }, svg);

    const group = svg.closest(".demo"), vIn = $("#pitch-v"), rIn = $("#pitch-rpm"), out = $("#pitch-readout");
    let current = "curveball", anim = 0;

    function run(animate = true) {
      const P = PITCHES[current], V = Number(vIn.value), rpm = Number(rIn.value);
      $("#pitch-v-out").textContent = V + " m/s";
      $("#pitch-rpm-out").textContent = rpm + " rpm";
      const res = simulate(V, rpm, P.axis, P.launch);
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
      vIn.value = PITCHES[current].V; rIn.value = PITCHES[current].rpm;
      run();
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
    svgEl("rect", { x: 20, y: FLOOR, width: 480, height: 4, fill: "#2a3344" }, svg);
    svgEl("rect", { x: COLX - 34, y: FLOOR - 16, width: 68, height: 16, rx: 4, fill: "#5b6776" }, svg);   // base / turntable
    svgEl("rect", { x: COLX - 9, y: TOPY, width: 18, height: FLOOR - 16 - TOPY, fill: "#8e98a8" }, svg);  // 2040 column
    svgEl("rect", { x: COLX, y: TOPY - 10, width: ARM + 14, height: 10, fill: "#a3adb8" }, svg);          // 2020 arm
    svgEl("rect", { x: COLX + PAD * PX - 16, y: FLOOR - 4, width: 32, height: 4, fill: "#ff3d6e" }, svg);  // target pad
    text(svg, COLX + PAD * PX, FLOOR + 18, "target ±5 mm", "d-text", "middle");
    for (let c = 0; c <= 40; c += 10) text(svg, COLX + c * PX, TOPY - 16, c + "", "d-text", "middle");
    text(svg, COLX + ARM, TOPY - 16, "51 cm", "d-text", "end");
    const trolley = svgEl("rect", { width: 26, height: 12, rx: 3, fill: "#ff3d6e" }, svg);
    const wire = svgEl("line", { stroke: "#eef0f4", "stroke-width": 1.5 }, svg);
    const head = svgEl("rect", { width: 22, height: 14, rx: 3, fill: "#5b6776" }, svg);
    const jawL = svgEl("rect", { width: 4, height: 14, fill: "#eef0f4" }, svg);
    const jawR = svgEl("rect", { width: 4, height: 14, fill: "#eef0f4" }, svg);
    const stackG = svgEl("g", {}, svg);
    const benchy = svgEl("path", { d: BENCHY_PATH, fill: "#f5a623" }, svg);
    // top-view dial for base rotation
    const dial = svgEl("g", { transform: "translate(470 210)" }, svg);
    svgEl("circle", { r: 26, fill: "none", stroke: "#2a3344", "stroke-width": 2 }, dial);
    const dialArm = svgEl("line", { x1: 0, y1: 0, x2: 0, y2: -24, stroke: "#ff3d6e", "stroke-width": 3, "stroke-linecap": "round" }, dial);
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
      for (let i = 0; i < st.stacked; i++) svgEl("path", { d: BENCHY_PATH, fill: "#f5a623", opacity: 0.85, transform: `translate(${COLX + PAD * PX} ${FLOOR - i * BPX}) scale(${BPX / 20})` }, stackG);
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
    svgEl("rect", { x: 0, y: GROUND, width: 520, height: 3, fill: "#2a3344" }, svg);
    const frame = svgEl("rect", { height: 14, rx: 3, fill: "#5b6776" }, svg);
    const arm = svgEl("line", { stroke: "#a3adb8", "stroke-width": 9, "stroke-linecap": "round" }, svg);
    const coil = svgEl("polyline", { fill: "none", stroke: "#ff3d6e", "stroke-width": 3, "stroke-linejoin": "round" }, svg);
    const tyre = svgEl("circle", { cx: WX, cy: WY, r: WHEEL_R * S, fill: "#1c2330", stroke: "#8e98a8", "stroke-width": 8 }, svg);
    svgEl("circle", { cx: WX, cy: WY, r: 8, fill: "#a3adb8" }, svg);
    const pivot = svgEl("circle", { r: 6, fill: "#f5a623" }, svg);
    const sagLabel = text(svg, 0, 0, "", "d-value");
    const load = svgEl("rect", { width: 70, rx: 4, fill: "rgba(245,166,35,0.25)", stroke: "#f5a623" }, svg);
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
  (function route() {
    const btns = $$(".stop-btn"), panels = $$(".stop-panel");
    btns.forEach(b => b.addEventListener("click", () => {
      btns.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      panels.forEach(p => { p.hidden = p.dataset.panel !== b.dataset.stop; });
    }));
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
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // ease-in-out cubic
    let lenis = null;
    if (!reduceMotion && window.Lenis) {
      lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, touchMultiplier: 1.2, smoothWheel: true });
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
      if (lenis) lenis.scrollTo(target, { offset: id === "#top" ? 0 : -76, duration: 1.8, easing: ease });
      else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      history.replaceState(null, "", id);
    });
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
