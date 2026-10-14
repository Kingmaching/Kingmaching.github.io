// Scroll story controller: ME 572 data, live charts and the stage readout.
// Works with or without WebGL; building.js reads window.Story for the 3D scene.
//
// Data is transcribed from ME572_All_Project_Data.xlsx (Group 14 final reports):
//   Project 2: 5,000 ft² office, Rochester NY (Zone 5A), ASHRAE 90.1-2004 baseline.
//   Project 1: COMFEN lighting power density sensitivity, Toronto weather.
// In every chart, moving right means reducing the variable.

(function () {
  const story = document.getElementById("story");
  if (!story) return;

  const DATA = {
    shgc: {
      label: "Glazing SHGC", unit: "", fmt: v => v.toFixed(2), control: 0,
      runs: [
        { x: 0.70, cost: 12642, cool: 247.6, ghg: 19448, gas: 2902 },
        { x: 0.60, cost: 12359, cool: 226.5, ghg: 19867, gas: 3008 },
        { x: 0.50, cost: 12099, cool: 206.0, ghg: 20350, gas: 3127 },
        { x: 0.40, cost: 11886, cool: 186.7, ghg: 20873, gas: 3250 },
        { x: 0.30, cost: 11698, cool: 169.5, ghg: 21511, gas: 3393 },
      ],
    },
    vent: {
      label: "Outdoor air", unit: " cfm/person", fmt: v => String(v), control: 2,
      runs: [
        { x: 30, cost: 12972, cool: 247.3, ghg: 21271, heat: 209.6 },
        { x: 25, cost: 12804, cool: 247.4, ghg: 20344, heat: 203.0 },
        { x: 20, cost: 12642, cool: 247.6, ghg: 19448, heat: 196.4 },
        { x: 15, cost: 12480, cool: 247.7, ghg: 18555, heat: 189.8 },
        { x: 10, cost: 12331, cool: 248.0, ghg: 17698, heat: 183.2 },
      ],
    },
    lpd: {
      label: "Lighting power", unit: " W/ft²", fmt: v => v.toFixed(2), control: 2,
      runs: [
        { x: 0.78, eui: 21.89, cool: 3.63, heat: 2.93, light: 8.37 },
        { x: 0.65, eui: 20.58, cool: 3.51, heat: 3.39, light: 6.97 },
        { x: 0.52, eui: 19.32, cool: 3.39, heat: 3.89, light: 5.58 },
        { x: 0.39, eui: 18.10, cool: 3.28, heat: 4.42, light: 4.18 },
      ],
    },
    baseline: { eui: 104.34, cost: 12642, ghg: 19448, starMedian: 85, star25: 118 },
  };

  // Series: colour follows meaning in every chart.
  // overall (red) = cost or total energy, cool (blue) = cooling, heat (yellow) = heating / gas emissions.
  const SERIES = {
    shgc: [
      { key: "cost", name: "Energy cost", tone: "overall" },
      { key: "cool", name: "Peak cooling", tone: "cool" },
      { key: "ghg", name: "GHG emissions", tone: "heat" },
    ],
    vent: [
      { key: "cost", name: "Energy cost", tone: "overall" },
      { key: "cool", name: "Peak cooling", tone: "cool" },
      { key: "ghg", name: "GHG emissions", tone: "heat" },
    ],
    lpd: [
      { key: "eui", name: "Total EUI", tone: "overall" },
      { key: "cool", name: "Cooling", tone: "cool" },
      { key: "heat", name: "Heating", tone: "heat" },
    ],
  };

  // Where each data step sits in scroll progress q (step k is centred at q = k).
  // Four night-time steps come first (intro, background, what's next, Project 01), so q runs from
  // −PRE to 5: q < 0 is the night prologue and q = 0 is the Project 01 introduction.
  const RANGES = { shgc: [1.55, 2.45], vent: [2.55, 3.45], lpd: [3.55, 4.45] };
  const PRE = 3;
  const STEPS = 9;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct = (v, base) => (v - base) / base;
  const fmtPct = p => (p > 0 ? "+" : p < 0 ? "−" : "±") + Math.abs(p * 100).toFixed(1) + "%";
  const fmtInt = v => Math.round(v).toLocaleString("en-US");

  function runIndex(name, q) {
    const [a, b] = RANGES[name];
    const n = DATA[name].runs.length - 1;
    return Math.round(clamp((q - a) / (b - a), 0, 1) * n);
  }

  // ---------- Charts (inline SVG) ----------
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  const charts = {};

  function buildLineChart(fig, name) {
    const d = DATA[name], series = SERIES[name];
    const ctrl = d.runs[d.control];
    const W = 320, H = 150, m = { l: 34, r: 74, t: 10, b: 24 };
    const values = series.map(s => d.runs.map(r => pct(r[s.key], ctrl[s.key])));
    const all = values.flat();
    const step = 0.1;
    const lo = Math.min(-step, Math.floor(Math.min(...all) / step) * step);
    const hi = Math.max(step, Math.ceil(Math.max(...all) / step) * step);
    const x = i => m.l + (i / (d.runs.length - 1)) * (W - m.l - m.r);
    const y = v => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img",
      "aria-label": `${d.label}: percent change in ${series.map(s => s.name.toLowerCase()).join(", ")} versus the control case` });

    for (let t = lo; t <= hi + 1e-9; t += step) {
      const v = Math.round(t * 100) / 100;
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v === 0 ? "axis-zero" : "grid" }, svg);
      const lab = el("text", { x: m.l - 6, y: y(v) + 3, class: "tick", "text-anchor": "end" }, svg);
      lab.textContent = (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v * 100)) + "%";
    }
    d.runs.forEach((r, i) => {
      const t = el("text", { x: x(i), y: H - 6, class: "tick", "text-anchor": "middle" }, svg);
      t.textContent = d.fmt(r.x);
    });

    const cursor = el("line", { y1: m.t, y2: H - m.b, class: "cursor" }, svg);

    const dots = [];
    series.forEach((s, si) => {
      const pts = values[si].map((v, i) => `${x(i)},${y(v)}`).join(" ");
      el("polyline", { points: pts, class: `line tone-${s.tone}` }, svg);
      dots.push(el("circle", { r: 4.5, class: `dot tone-${s.tone}` }, svg));
    });

    // Direct labels at the right end, nudged apart if they would collide.
    const ends = series.map((s, si) => ({ s, v: values[si][values[si].length - 1], y: y(values[si][values[si].length - 1]) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
    ends.forEach(e => {
      const t = el("text", { x: W - m.r + 6, y: e.y + 3, class: "end-label" }, svg);
      t.textContent = `${e.s.name.split(" ").pop()} ${fmtPct(e.v)}`;
    });

    // Hover columns: wider than the marks.
    const hits = d.runs.map((r, i) => {
      const half = (W - m.l - m.r) / (d.runs.length - 1) / 2;
      const rect = el("rect", { x: x(i) - half, y: 0, width: half * 2, height: H, class: "hit" }, svg);
      rect.addEventListener("pointerenter", () => { charts[name].hover = i; renderChart(name); });
      rect.addEventListener("pointerleave", () => { charts[name].hover = null; renderChart(name); });
      return rect;
    });

    const legend = document.createElement("ul");
    legend.className = "legend";
    legend.innerHTML = series.map(s => `<li><span class="swatch tone-${s.tone}"></span>${s.name}</li>`).join("");

    const readout = document.createElement("p");
    readout.className = "chart-readout";

    fig.replaceChildren(legend, svg, readout);
    charts[name] = { fig, svg, x, y, values, dots, cursor, readout, hover: null, current: 0, hits };
  }

  function renderChart(name) {
    const c = charts[name];
    if (!c) return;
    const d = DATA[name], series = SERIES[name];
    const i = c.hover ?? c.current;
    c.cursor.setAttribute("x1", c.x(i));
    c.cursor.setAttribute("x2", c.x(i));
    c.dots.forEach((dot, si) => {
      dot.setAttribute("cx", c.x(i));
      dot.setAttribute("cy", c.y(c.values[si][i]));
    });
    const r = d.runs[i];
    const parts = series.map((s, si) => `${s.name} ${fmtPct(c.values[si][i])}`);
    const tag = i === d.control ? " (control)" : "";
    c.readout.textContent = `${d.label} ${d.fmt(r.x)}${d.unit}${tag}: ${parts.join(", ")}`;
  }

  function buildBenchmarkChart(fig) {
    const b = DATA.baseline;
    const rows = [
      { name: "My model (predicted)", v: b.eui, cls: "bar-model" },
      { name: "ENERGY STAR median", v: b.starMedian, cls: "bar-bench" },
      { name: "ENERGY STAR 25th pct.", v: b.star25, cls: "bar-bench" },
      { name: "Measured", v: null, cls: "bar-empty" },
    ];
    const W = 320, rowH = 28, m = { l: 132, r: 46 };
    const H = rows.length * rowH + 6;
    const max = 130;
    const x = v => m.l + (v / max) * (W - m.l - m.r);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img",
      "aria-label": "Site energy use intensity in kBtu per square foot per year: model 104.3, ENERGY STAR median 85, 25th percentile 118, measured no data yet" });
    rows.forEach((r, i) => {
      const cy = i * rowH + 4;
      const lab = el("text", { x: m.l - 8, y: cy + 15, class: "bar-label", "text-anchor": "end" }, svg);
      lab.textContent = r.name;
      if (r.v == null) {
        el("rect", { x: m.l, y: cy + 4, width: x(b.eui) - m.l, height: 16, rx: 4, class: r.cls }, svg);
        const t = el("text", { x: m.l + 8, y: cy + 16, class: "bar-empty-text" }, svg);
        t.textContent = "no data yet";
      } else {
        el("rect", { x: m.l, y: cy + 4, width: x(r.v) - m.l, height: 16, rx: 4, class: r.cls }, svg);
        const t = el("text", { x: x(r.v) + 6, y: cy + 16, class: "bar-value" }, svg);
        t.textContent = r.v.toFixed(r.v % 1 ? 1 : 0);
      }
    });
    const legend = document.createElement("p");
    legend.className = "chart-readout";
    legend.textContent = "Site EUI, kBtu/ft²·yr. ENERGY STAR values are benchmarks from surveyed real offices.";
    fig.replaceChildren(svg, legend);
  }

  document.querySelectorAll("[data-chart]").forEach(fig => {
    const name = fig.dataset.chart;
    if (name === "benchmark") buildBenchmarkChart(fig);
    else if (DATA[name]) { buildLineChart(fig, name); renderChart(name); }
  });

  // ---------- Stage readout ----------
  const readout = document.getElementById("readout");
  const roTitle = document.getElementById("ro-title");
  const roCells = [...document.querySelectorAll("#readout .ro-cell")];
  let lastKey = "";

  function cells(title, list) {
    const key = title + JSON.stringify(list);
    if (key === lastKey || !readout) return;
    lastKey = key;
    roTitle.textContent = title;
    roCells.forEach((cell, i) => {
      const item = list[i];
      cell.hidden = !item;
      if (!item) return;
      cell.querySelector("span").textContent = item[0];
      cell.querySelector("strong").textContent = item[1];
      const em = cell.querySelector("em");
      em.textContent = item[2] || "";
      em.className = item[3] || "";
    });
  }
  const delta = (p, goodWhenDown = true) => [fmtPct(p), Math.abs(p) < 0.0005 ? "" : (p < 0) === goodWhenDown ? "is-down" : "is-up"];

  function updateReadout(q) {
    const b = DATA.baseline;
    if (q < 1.5) {
      cells("ME 572 model · 5,000 ft² office · Rochester, NY", [
        ["Site EUI", b.eui.toFixed(1), "kBtu/ft²·yr"],
        ["Energy cost", "$" + fmtInt(b.cost), "per year"],
        ["GHG", fmtInt(b.ghg), "kg CO₂e/yr"],
      ]);
    } else if (q < 2.5) {
      const d = DATA.shgc, r = d.runs[runIndex("shgc", q)], c = d.runs[0];
      cells("Envelope run · glazing SHGC", [
        ["SHGC", d.fmt(r.x), r === c ? "control" : ""],
        ["Energy cost", "$" + fmtInt(r.cost), ...delta(pct(r.cost, c.cost))],
        ["Peak cooling", r.cool.toFixed(1), ...delta(pct(r.cool, c.cool))],
        ["GHG", fmtInt(r.ghg), ...delta(pct(r.ghg, c.ghg))],
      ]);
    } else if (q < 3.5) {
      const d = DATA.vent, r = d.runs[runIndex("vent", q)], c = d.runs[d.control];
      cells("Ventilation run · outdoor air", [
        ["cfm/person", String(r.x), r === c ? "control" : ""],
        ["Energy cost", "$" + fmtInt(r.cost), ...delta(pct(r.cost, c.cost))],
        ["Peak heating", r.heat.toFixed(1), ...delta(pct(r.heat, c.heat))],
        ["GHG", fmtInt(r.ghg), ...delta(pct(r.ghg, c.ghg))],
      ]);
    } else if (q < 4.5) {
      const d = DATA.lpd, r = d.runs[runIndex("lpd", q)], c = d.runs[d.control];
      cells("Lighting run · COMFEN, Toronto", [
        ["W/ft²", d.fmt(r.x), r === c ? "design" : ""],
        ["Total EUI", r.eui.toFixed(2), ...delta(pct(r.eui, c.eui))],
        ["Heating", r.heat.toFixed(2), ...delta(pct(r.heat, c.heat))],
        ["Lighting", r.light.toFixed(2), ...delta(pct(r.light, c.light))],
      ]);
    } else {
      cells("Predicted vs measured", [
        ["Model EUI", b.eui.toFixed(1), "predicted"],
        ["ENERGY STAR", String(b.starMedian), "median office"],
        ["Measured", "—", "no data yet"],
      ]);
    }
  }

  // ---------- Louvres: the backdrop for Background and What's next ----------
  // Slats swing shut (intro → Background), flip from forest to dawn (→ What's next), then open (→ Project 01).
  // Each slat runs a little behind the one above it (below it, when opening), so the motion sweeps the screen.
  const louvres = story.querySelector(".louvres");
  const N = 12, LAG = 0.7;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slats = louvres ? Array.from({ length: N }, (_, k) => {
    const s = document.createElement("div");
    s.className = "slat";
    s.style.cssText = `--n: ${N}; --k: ${k / (N - 1)}`;
    s.innerHTML = "<i></i><i></i>";
    louvres.appendChild(s);
    return s;
  }) : [];
  const ease = t => t * t * (3 - 2 * t);
  const phase = (a, b) => clamp((q - a) / (b - a), 0, 1);
  const lag = (t, k) => ease(clamp(t * (1 + LAG) - k * LAG, 0, 1));
  function turnLouvres() {
    if (!louvres) return;
    const shut = phase(-2.95, -2.15), flip = phase(-1.9, -1.15), open = phase(-0.95, -0.2);
    louvres.style.visibility = shut > 0 && open < 1 ? "visible" : "hidden";
    if (reduceMotion) {                  // no turning: fade the whole screen, swap faces at the halfway point
      louvres.style.opacity = shut * (1 - open);
      slats.forEach(s => s.style.setProperty("--a", flip < 0.5 ? "0deg" : "180deg"));
      return;
    }
    slats.forEach((s, i) => {
      const k = i / (N - 1);
      const a = 90 * (1 - lag(shut, k)) + 180 * lag(flip, k) + 90 * lag(open, 1 - k);
      s.style.setProperty("--a", a.toFixed(1) + "deg");
    });
  }

  // ---------- Scroll progress ----------
  // The steps end with a tail (padding-bottom on .steps) where q holds at the last step, so the last card
  // can scroll away over the finished scene; tail runs 0 → 1 across it and building.js fades out on it.
  const steps = story.querySelector(".steps");
  let q = -PRE, tail = 0;
  function readScroll() {
    const rect = story.getBoundingClientRect();
    const tailPx = steps ? parseFloat(getComputedStyle(steps).paddingBottom) || 0 : 0;
    const range = rect.height - window.innerHeight - tailPx;
    q = (range > 0 ? clamp(-rect.top / range, 0, 1) * (STEPS - 1) : 0) - PRE;
    tail = tailPx > 0 ? clamp((-rect.top - range) / tailPx, 0, 1) : 0;
    turnLouvres();
    ["shgc", "vent", "lpd"].forEach(name => {
      const c = charts[name];
      if (!c) return;
      const i = runIndex(name, q);
      if (i !== c.current) { c.current = i; renderChart(name); }
    });
    updateReadout(q);
  }
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", readScroll);
  readScroll();

  // Shared with building.js
  window.Story = {
    STEPS,
    PRE,
    DATA,
    progress: () => q,
    tail: () => tail,
    runIndex,
  };
})();
