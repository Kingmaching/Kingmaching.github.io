// Scroll-driven 3D building for the hero.
// A street-level tower wrapped in an adaptive louvre facade with planted fins, set in a
// park-filled Hong Kong neighbourhood across the harbour from a stylised skyline.
// Scroll progress q (−3 → 5, one unit per story step, from story.js) drives:
//  −3 → 0  night prologue (intro, background, what's next, Project 01): the camera holds still;
//          scrolling moves the traffic, people and the harbour light show
//   0 → 1  night to morning; the harbour light show ends as day breaks; louvres adapt to the sun
//   1 → 2  facade pulls away; glazing tint and solar rays follow the SHGC run
//   2 → 3  floors separate; airflow arrows follow the outdoor-air run
//   3 → 4  airflow gives way to heating points; ceiling lights follow the lighting-power run
//   4 → 5  sensors switch on as the sun sets
// Cars, people and the night-time harbour light show all move with the scroll. The skyline is drawn by a
// second renderer onto #backdrop-canvas, which CSS blurs, so the tower stays the one thing in focus.
// The tower is illustrative; the numbers belong to the ME 572 models. Units are metres; the
// landmarks are scaled down to fit the frame.

(function () {
  const canvas = document.getElementById("building-canvas");
  const story = document.getElementById("story");
  const S = window.Story;
  if (!canvas || !story || !S) return;
  if (!window.THREE) { canvas.hidden = true; return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    canvas.hidden = true;
    return;
  }

  // Background layer: everything across the harbour, rendered at half resolution and blurred by CSS.
  // Without a second context the backdrop is simply drawn sharp by the main renderer.
  const BACK = 1;
  const backCanvas = document.getElementById("backdrop-canvas");
  let backRenderer = null;
  if (backCanvas) {
    try {
      backRenderer = new THREE.WebGLRenderer({ canvas: backCanvas, antialias: false, alpha: true });
      backRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * 0.5);
    } catch (err) {
      backCanvas.hidden = true;
    }
  }

  const reduceMotion = false;                        // motion stays on (see sections.js)
  const { clamp, lerp, smoothstep, degToRad } = THREE.MathUtils;
  const D = S.DATA;

  const FLOORS = 14, FH = 3.6, W = 20;              // tower: 14 storeys, 20 m square, at street level
  const PANELS = 9;                                 // 9 louvres per side per floor
  const GAP = 2.4;                                  // extra space per floor when exploded
  const RING = 31;                                  // ring road centreline half-size

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x121b28, 320, 900);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 1400);
  const stage = canvas.parentElement;

  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const C = hex => new THREE.Color(hex);

  // ---------- Materials ----------
  const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05, ...o });
  const mat = {
    concrete: std(), core: std(), slab: std(),
    panel: std({ roughness: 0.45, metalness: 0.3, color: 0xffffff }),     // tinted per instance
    mullion: std({ roughness: 0.4, metalness: 0.5 }),
    glass: std({ roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.4, depthWrite: false }),
    ground: std({ roughness: 1 }), road: std({ roughness: 0.95 }), walk: std({ roughness: 0.95 }),
    water: std({ roughness: 0.22, metalness: 0.35 }),
    green: std({ roughness: 0.9 }), hedge: std({ roughness: 0.95 }), trunk: std({ roughness: 1, color: 0x6b5641 }),
    canopy: std({ roughness: 0.9, flatShading: true, color: 0xffffff }),
    hill: std({ roughness: 1, flatShading: true }),
    plant: std({ roughness: 0.6, metalness: 0.4 }),
    car: std({ roughness: 0.45, metalness: 0.3, color: 0xffffff }),
    person: std({ roughness: 0.8, color: 0xffffff }),
    air: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    arrow: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    sensor: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    lamp: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    accent: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, color: 0xf5b83d }),
    headlight: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, color: 0xfff2c8 }),
    brace: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5, color: 0xffffff }),
    sun: new THREE.MeshBasicMaterial({ color: 0xffe7a8, fog: false }),
  };
  const rayMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0 });
  const UP = new THREE.Vector3(0, 1, 0);

  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // Palettes: night (start), day, sunset (end). update() blends between them.
  const PAL = {
    night: { concrete: C("#3b4552"), slab: C("#5b6776"), panelTint: C("#7d8792"), glass: C("#ffcf86"), ground: C("#121a16"),
      road: C("#14181e"), walk: C("#2a2f36"), water: C("#0b1826"), green: C("#26462f"), context: C("#16261f"), hill: C("#14231a"),
      skyTop: C("#04110d"), skyLow: C("#10291f"), light: C("#9cbcb0") },
    day: { concrete: C("#a9b1b6"), slab: C("#d6dadc"), panelTint: C("#ffffff"), glass: C("#86b6d0"), ground: C("#7e9a6c"),
      road: C("#50565e"), walk: C("#c4c0b4"), water: C("#4f8fb3"), green: C("#6f9e5c"), context: C("#b4bec6"), hill: C("#5f8a52"),
      skyTop: C("#3d82cc"), skyLow: C("#c6e0f0"), light: C("#fff3df") },
    sunset: { concrete: C("#9e8f8a"), slab: C("#d2bdb0"), panelTint: C("#f4d9c4"), glass: C("#f0a978"), ground: C("#6c7d55"),
      road: C("#4a4446"), walk: C("#b9a594"), water: C("#c27a6a"), green: C("#5c7d48"), context: C("#9b8f98"), hill: C("#4d5e45"),
      skyTop: C("#3f4f86"), skyLow: C("#ffaa6b"), light: C("#ffb37a") },
  };
  const tmp = {};
  function blend(key, day, dusk) {
    const c = tmp[key] || (tmp[key] = new THREE.Color());
    return c.copy(PAL.night[key]).lerp(PAL.day[key], day).lerp(PAL.sunset[key], dusk);
  }

  function applyTheme() {
    mat.air.color.set(cssColor("--c-cool", "#2a9fd6"));
    mat.arrow.color.set(cssColor("--c-cool", "#2a9fd6"));
    rayMat.color.set("#ffc46b");
    mat.sensor.color.set("#f4f8ff");                 // sensors are white so they never read as heat
    mat.lamp.color.set(cssColor("--b-lamp", "#ffd88a"));
    mat.accent.color.set(cssColor("--neon", "#f5b83d"));
  }

  // Lit-window texture for the surrounding towers (mostly warm, a few cool and neon).
  function makeWindowTexture() {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, 64, 128);
    const tones = ["#ffd9a0", "#ffe9bf", "#fff4d6", "#ffd9a0", "#bfe8ff", "#ff7aa0"];
    for (let r = 0; r < 16; r++) for (let col = 0; col < 4; col++) {
      if (rand() < 0.5) { g.fillStyle = tones[Math.floor(rand() * tones.length)]; g.fillRect(4 + col * 15, 3 + r * 8, 10, 4); }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const windowTex = makeWindowTexture();

  // Soft orange glow with a hot core, for the heating points.
  function makeGlowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 245, 220, 1)");
    grad.addColorStop(0.18, "rgba(255, 170, 70, 1)");
    grad.addColorStop(0.45, "rgba(255, 110, 20, 0.55)");
    grad.addColorStop(1, "rgba(255, 90, 0, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const cityMats = [], nearMats = [];
  function cityMaterial(w, h, list = cityMats) {
    const tex = windowTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 8)));
    const m = std({ emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.5, metalness: 0.2 });
    list.push(m);
    return m;
  }

  function box(w, h, d, material, parent, x = 0, y = 0, z = 0, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = shadow;
    parent.add(m);
    return m;
  }
  function toBack(obj) { obj.traverse(o => o.layers.set(BACK)); return obj; }

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4a3c, 0.9);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xfff3df, 0.8);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.radius = 4;
  Object.assign(sunLight.shadow.camera, { left: -90, right: 90, top: 120, bottom: -50, near: 20, far: 450 });
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight, sunLight.target);
  hemi.layers.enable(BACK); sunLight.layers.enable(BACK);
  const sunDisc = toBack(new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), mat.sun));
  scene.add(sunDisc);

  // ---------- Ground: parks, roads, harbour ----------
  // In focus: the ground out to the far shore. Behind it, the backdrop gets its own full ground disc
  // so the skyline stands on something and the blur has no gaps to bleed into.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(255, 72), mat.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const farGround = toBack(new THREE.Mesh(new THREE.CircleGeometry(900, 72), mat.ground));
  farGround.rotation.x = -Math.PI / 2;
  scene.add(farGround);

  // Harbour on the far side, with the skyline beyond it. Ring theta maps to world angle −θ.
  const HARBOUR = [3.25, 6.05];
  const water = new THREE.Mesh(new THREE.RingGeometry(92, 255, 64, 1, -HARBOUR[1], HARBOUR[1] - HARBOUR[0]), mat.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.06;
  scene.add(water);

  function flat(w, d, material, x, z, y = 0.04) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  // Sidewalk apron around the podium, ring road, and four spurs (the far ones stop at the water).
  flat(2 * (RING - 4), 2 * (RING - 4), mat.walk, 0, 0, 0.03);
  [[0, -RING, 2 * RING + 8, 8], [0, RING, 2 * RING + 8, 8], [-RING, 0, 8, 2 * RING + 8], [RING, 0, 8, 2 * RING + 8]]
    .forEach(([x, z, w, d]) => flat(w, d, mat.road, x, z, 0.05));
  flat(8, 120, mat.road, 0, RING + 64, 0.05);           // +z avenue (camera side)
  flat(120, 8, mat.road, RING + 64, 0, 0.05);           // +x avenue (camera side)
  flat(8, 50, mat.road, 0, -RING - 29, 0.05);           // −z avenue to the waterfront
  flat(50, 8, mat.road, -RING - 29, 0, 0.05);           // −x avenue to the waterfront
  // Lane markings
  const dash = new THREE.MeshBasicMaterial({ color: 0xe8e2c8, transparent: true, opacity: 0.55 });
  for (let s = -RING; s < RING; s += 6) {
    [[s, -RING, 2.5, 0.25], [s, RING, 2.5, 0.25], [-RING, s, 0.25, 2.5], [RING, s, 0.25, 2.5]].forEach(([x, z, w, d]) => flat(w, d, dash, x, z, 0.07));
  }

  // ---------- Hong Kong skyline across the harbour (stylised, scaled down) ----------
  const skyline = new THREE.Group();
  scene.add(skyline);
  const beamSources = [];                  // rooftops the light show fires from
  function place(obj, angle, r, top = obj.userData.top) {
    r *= 1.45;                             // across the harbour, hazed by distance
    obj.scale.setScalar(0.6);
    obj.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    skyline.add(obj);
    if (top) beamSources.push(new THREE.Vector3(obj.position.x, top * 0.6, obj.position.z));
    return obj;
  }
  function stack(levels) {                 // stepped tower from [w, h] pairs, bottom up
    const g = new THREE.Group();
    let y = 0;
    levels.forEach(([w, h]) => { box(w, h, w, cityMaterial(w, h), g, 0, y + h / 2, 0, false); y += h; });
    g.userData.top = y;
    return g;
  }
  // IFC 2: stepped tower with a crown of fins
  const ifc = stack([[30, 105], [27, 22], [24, 14], [21, 10]]);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => box(2, 18, 2, mat.mullion, ifc, sx * 9.5, ifc.userData.top + 9, sz * 9.5, false));
  place(ifc, 4.15, 205);
  // ICC: tallest, slim, with a tapered top
  const icc = stack([[24, 150], [21, 18], [17, 10]]);
  place(icc, 4.95, 235);
  // Bank of China: four triangular shafts of rising height with lit X-bracing
  const boc = new THREE.Group();
  const half = 13, bocH = [78, 104, 128, 150];
  [[[half, -half], [half, half]], [[half, half], [-half, half]], [[-half, half], [-half, -half]], [[-half, -half], [half, -half]]].forEach(([a, b], i) => {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(a[0], a[1]), new THREE.Vector2(b[0], b[1])]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: bocH[i], bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, cityMaterial(20, bocH[i]));
    boc.add(m);
    // X-bracing on the outer face, in square modules
    const pts = [];
    for (let y = 0; y + 26 <= bocH[i] + 0.1; y += 26) {
      pts.push(a[0], y, -a[1], b[0], y + 26, -b[1], b[0], y, -b[1], a[0], y + 26, -a[1]);
      pts.push(a[0], y, -a[1], b[0], y, -b[1]);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(lg, mat.brace);
    lines.scale.set(1.01, 1, 1.01);
    boc.add(lines);
  });
  [[-3, 1], [3, -1]].forEach(([x, z], i) => box(0.7, 26 + i * 4, 0.7, mat.mullion, boc, x, 150 + 13 + i * 2, z, false));
  place(boc, 4.55, 215, 150);
  // Central Plaza: triangular tower, pyramid top and mast, with coloured bands at night
  const cp = new THREE.Group();
  const cpBody = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 128, 3), cityMaterial(26, 128));
  cpBody.position.y = 64; cp.add(cpBody);
  const cpTop = new THREE.Mesh(new THREE.ConeGeometry(15, 22, 3), cityMaterial(20, 20));
  cpTop.position.y = 139; cp.add(cpTop);
  box(0.8, 30, 0.8, mat.mullion, cp, 0, 165, 0, false);
  [100, 112, 124].forEach(y => { const ring = new THREE.Mesh(new THREE.CylinderGeometry(15.3, 15.3, 1.2, 3, 1, true), mat.accent); ring.position.y = y; cp.add(ring); });
  place(cp, 5.35, 190, 150);
  // The Center: square tower with neon rings
  const center = stack([[22, 118], [18, 12]]);
  for (let y = 30; y < 118; y += 14) { const r = box(22.4, 0.8, 22.4, mat.accent, center, 0, y, 0, false); r.material = mat.accent; }
  place(center, 3.75, 198);
  // Light-show colours on the skyline: neon bands and crowns that change hue as you scroll.
  const showMats = [0.0, 0.2, 0.45, 0.58, 0.75, 0.88].map(h => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(h, 1, 0.6) });
    m.userData.hue = h;
    return m;
  });
  // Supporting towers to fill the skyline, all with their lights on. Every third one gets a lit crown.
  for (let i = 0; i < 40; i++) {
    const a = HARBOUR[0] + 0.05 + rand() * (HARBOUR[1] - HARBOUR[0] - 0.1), r = 182 + rand() * 95;
    const w = 12 + rand() * 12, h = 36 + rand() * 90;
    const t = stack([[w, h]]);
    if (i % 3 === 0) {
      const crown = showMats[i % showMats.length];
      box(w + 0.6, 2.2, w + 0.6, crown, t, 0, h - 4, 0, false);
      box(w + 0.6, 1.2, w + 0.6, crown, t, 0, h * 0.55, 0, false);
    }
    place(t, a, r, i % 2 === 0 ? h : 0);
  }
  // The Peak and the hills behind: green, not grey
  for (let i = 0; i < 9; i++) {
    const a = HARBOUR[0] - 0.1 + (i / 8) * (HARBOUR[1] - HARBOUR[0] + 0.2);
    const hill = new THREE.Mesh(new THREE.ConeGeometry(110 + rand() * 60, 90 + rand() * 80, 7), mat.hill);
    hill.position.set(Math.cos(a) * (430 + rand() * 70), 30, Math.sin(a) * (430 + rand() * 70));
    hill.rotation.y = rand() * 3;
    hill.scale.y = 1.2;
    scene.add(toBack(hill));
  }
  toBack(skyline);

  // ---------- Harbour light show: coloured searchlights from the skyline rooftops ----------
  // Each beam is an open cone that fades along its length and towards its edges. Aim and colour
  // are functions of scroll progress, so the show sweeps as the reader scrolls.
  const beamGeo = new THREE.CylinderGeometry(5, 0.35, 1, 18, 1, true);
  beamGeo.translate(0, 0.5, 0);                         // base at the origin, pointing +y
  const beamShader = {
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
    vertexShader: `
      varying float vT; varying float vEdge;
      void main() {
        vT = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vEdge = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vT; varying float vEdge;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity * pow(1.0 - vT, 1.4) * pow(vEdge, 1.6));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  };
  const beams = [];
  beamSources.forEach((src, i) => {
    for (let k = 0; k < (i < 5 ? 2 : 1); k++) {          // landmarks fire two beams each
      const m = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({ ...beamShader, uniforms: THREE.UniformsUtils.clone(beamShader.uniforms) }));
      m.position.copy(src);
      m.scale.set(1, 300 + rand() * 120, 1);
      m.frustumCulled = false;
      m.userData = {
        az: Math.atan2(src.z, src.x) + (rand() - 0.5) * 1.2,  // roughly away from the camera
        el: degToRad(42 + rand() * 30),
        sweep: 0.5 + rand() * 0.6, rate: 0.8 + rand() * 1.1, phase: rand() * 6.28,
        hue: (beams.length * 0.137) % 1,
      };
      scene.add(toBack(m));
      beams.push(m);
    }
  });
  const beamDir = new THREE.Vector3();
  const neon = new THREE.Color();
  function layoutShow(q, strength, ctx) {
    beams.forEach(b => {
      b.visible = strength > 0.005;
      const u = b.userData;
      const az = u.az + Math.sin(q * u.rate + u.phase) * u.sweep;
      const el = u.el + Math.sin(q * u.rate * 0.7 + u.phase * 2) * 0.22;
      beamDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      b.quaternion.setFromUnitVectors(UP, beamDir);
      b.material.uniforms.uColor.value.setHSL((u.hue + q * 0.09) % 1, 1, 0.62);
      b.material.uniforms.uOpacity.value = strength;
    });
    // Off, the neon bands take the colour of the building they sit on.
    const on = clamp(strength / 0.62, 0, 1);
    showMats.forEach(m => m.color.copy(ctx).lerp(neon.setHSL((m.userData.hue + q * 0.09) % 1, 1, 0.6), on));
    mat.accent.color.setHSL((0.92 + q * 0.09) % 1, 1, 0.6);
    mat.accent.opacity = on;
  }

  // Low-rise neighbours on this side of the harbour, away from the camera's path
  // The three closest to the tower are left out so it has room around it.
  const neighbours = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.15;
    if (a > 0.05 && a < 2.75) continue;
    neighbours.push({ a, r: 52 + rand() * 32, h: 10 + rand() * 26, w: 9 + rand() * 7 });
  }
  neighbours.sort((p, q) => p.r - q.r).slice(3).forEach(({ a, r, h, w }) => {
    const b = box(w, h, w, cityMaterial(w, h, nearMats), scene, Math.cos(a) * r, h / 2, Math.sin(a) * r);
    box(w * 0.9, 0.6, w * 0.9, mat.green, scene, b.position.x, h + 0.3, b.position.z, false);   // green roofs
  });

  // ---------- Trees: street trees, parks, podium (instanced) ----------
  const treeSpots = [];
  for (let s = -RING - 6; s <= RING + 6; s += 16) {       // street trees along the outside of the ring road
    treeSpots.push([s, -RING - 6], [s, RING + 6], [-RING - 6, s], [RING + 6, s]);
  }
  for (let i = 0; i < 60; i++) {                          // parks between the spurs
    const a = rand() * Math.PI * 2, r = 44 + rand() * 60;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;      // keep the avenues clear
    if (a > HARBOUR[0] && a < HARBOUR[1] && r > 88) continue;
    treeSpots.push([x, z]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6);
  trunkGeo.translate(0, 1.5, 0);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
  const PLAZA_TREES = [[-20, -14], [21, 12], [-21, 5], [8, 21], [-6, -21], [14, 20]];
  const trunks = new THREE.InstancedMesh(trunkGeo, mat.trunk, treeSpots.length + PLAZA_TREES.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, mat.canopy, treeSpots.length + PLAZA_TREES.length);
  canopies.castShadow = true;
  const dummy = new THREE.Object3D(), leaf = new THREE.Color();
  const LEAVES = ["#4f8a45", "#5d9a4c", "#3f7a3f", "#6aa451", "#7aa85a"];
  function addTree(i, x, y, z, s) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, rand() * 3, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = y + 3 * s + 1.2 * s; dummy.scale.set(2.2 * s, 2 * s, 2.2 * s); dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
    canopies.setColorAt(i, leaf.set(LEAVES[i % LEAVES.length]));
  }
  treeSpots.forEach(([x, z], i) => addTree(i, x, 0, z, 0.8 + rand() * 0.7));
  // A ring of trees on the plaza at the tower's foot
  PLAZA_TREES.forEach(([x, z], k) => addTree(treeSpots.length + k, x, 0, z, 0.75));
  scene.add(trunks, canopies);
  // A lawn under the plaza trees
  flat(46, 46, mat.green, 0, 0, 0.035);

  // ---------- Floors ----------
  const floors = [], risers = [], sensors = [], streams = [], heaters = [];
  const sensorGeo = new THREE.SphereGeometry(0.45, 12, 10);
  const lampGeo = new THREE.PlaneGeometry(W - 2, W - 2);
  const smallCanopy = new THREE.IcosahedronGeometry(1.3, 0);
  const SKY_GARDENS = [4, 9];
  const heaterGeo = new THREE.BufferGeometry();
  {
    const pts = [];
    for (let k = -1; k <= 1; k++) pts.push(k * 6.5, 0, 8.6, k * 6.5, 0, -8.6, 8.6, 0, k * 6.5, -8.6, 0, k * 6.5);
    heaterGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  }
  // Drawn over the facade (no depth test) so the heat reads through the louvres.
  const heaterMat = new THREE.PointsMaterial({ map: makeGlowTexture(), size: 9, transparent: true, opacity: 0, depthWrite: false, depthTest: false });

  for (let i = 0; i < FLOORS; i++) {
    const g = new THREE.Group();
    scene.add(g);
    box(W + 1.6, 0.45, W + 1.6, mat.slab, g, 0, 0.22, 0);                                  // slab with balcony edge
    const glazing = box(W - 0.6, FH - 0.45, W - 0.6, mat.glass, g, 0, 0.45 + (FH - 0.45) / 2, 0);
    glazing.castShadow = false;
    box(6, FH - 0.45, 6, mat.core, g, 0, 0.45 + (FH - 0.45) / 2, 0);
    // planters with hedges along two balcony edges: greenery on every floor
    box(W + 1.2, 0.5, 0.7, mat.slab, g, 0, 0.7, W / 2 + 0.35, false);
    box(W + 1.0, 0.45, 0.6, mat.hedge, g, 0, 1.15, W / 2 + 0.35, false);
    box(0.7, 0.5, W + 1.2, mat.slab, g, -W / 2 - 0.35, 0.7, 0, false);
    box(0.6, 0.45, W + 1.0, mat.hedge, g, -W / 2 - 0.35, 1.15, 0, false);
    if (SKY_GARDENS.includes(i)) {                                                          // sky garden trees
      [[-7, 7], [7, 7], [-7, -7], [7, -7]].forEach(([x, z]) => {
        const t = new THREE.Mesh(smallCanopy, mat.canopy);
        t.position.set(x, 2.1, z); t.castShadow = true; g.add(t);
      });
    }

    const lamp = new THREE.Mesh(lampGeo, mat.lamp);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.y = FH - 0.05;
    g.add(lamp);

    const riser = box(1.3, FH, 1.3, mat.air, g, 3.8, FH / 2, 3.8, false);
    risers.push(riser);

    // Perimeter heaters: glowing orange points under the windows, shown once the airflow is gone.
    const heat = new THREE.Points(heaterGeo, heaterMat);
    heat.position.y = 1.1;
    heat.visible = false;
    heat.renderOrder = 5;
    g.add(heat);
    heaters.push(heat);

    [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]].forEach(([x, z]) => {
      const s = new THREE.Mesh(sensorGeo, mat.sensor);
      s.position.set(x, 1.6, z);
      s.scale.setScalar(0.001);
      g.add(s);
      sensors.push(s);
    });

    // Cross-ventilation on every third floor, windward (−x) to leeward (+x): thick tubes + moving arrowheads.
    if (i % 3 === 1) {
      [-5, 0, 5].forEach((z, k) => {
        const pts = [];
        for (let s = 0; s <= 12; s++) {
          const x = -32 + s * 5.3;
          pts.push(new THREE.Vector3(x, 1.9 + Math.sin(s * 0.9 + k) * 0.35, z + Math.sin(s * 0.55 + k * 2) * 1.8));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.28, 8, false), mat.air);
        g.add(tube);
        streams.push({ curve, group: g, tube, phase: k * 0.21 });
      });
    }

    // Roof: green roof, rooftop plant (AHUs), and a lit crown
    if (i === FLOORS - 1) {
      box(W + 1.6, 0.5, W + 1.6, mat.slab, g, 0, FH + 0.25, 0);
      box(W - 1, 0.4, W - 1, mat.green, g, 0, FH + 0.7, 0, false);
      [[-5, -5, 5, 2.4, 3], [4, -5, 4, 2, 4], [0, 5, 7, 2.6, 3.5]].forEach(([x, z, w, h, d]) => box(w, h, d, mat.plant, g, x, FH + 0.9 + h / 2, z));
      [[-7, 6], [7, 7], [-7, 0], [7, 0]].forEach(([x, z]) => {
        const t = new THREE.Mesh(smallCanopy, mat.canopy); t.position.set(x, FH + 2.4, z); t.castShadow = true; g.add(t);
      });
    }
    floors.push(g);
  }

  // Airflow arrowheads: instanced cones moving along every stream
  const ARROWS_PER = 4;
  const arrowGeo = new THREE.ConeGeometry(0.75, 2, 10);
  const arrows = new THREE.InstancedMesh(arrowGeo, mat.arrow, streams.length * ARROWS_PER);
  arrows.frustumCulled = false;
  scene.add(arrows);
  const tangent = new THREE.Vector3(), pt = new THREE.Vector3();
  let flow = 0;
  function layoutArrows() {
    let n = 0;
    streams.forEach(s => {
      for (let a = 0; a < ARROWS_PER; a++) {
        const t = (flow + s.phase + a / ARROWS_PER) % 1;
        s.curve.getPointAt(t, pt); s.curve.getTangentAt(t, tangent);
        dummy.position.copy(pt).add(s.group.position);
        dummy.quaternion.setFromUnitVectors(UP, tangent);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        arrows.setMatrixAt(n++, dummy.matrix);
      }
    });
    arrows.instanceMatrix.needsUpdate = true;
  }

  // ---------- Facade: louvres (some planted) and mullions, instanced ----------
  const SIDES = [
    { n: new THREE.Vector3(0, 0, 1), t: new THREE.Vector3(1, 0, 0), yaw: 0 },
    { n: new THREE.Vector3(1, 0, 0), t: new THREE.Vector3(0, 0, -1), yaw: Math.PI / 2 },
    { n: new THREE.Vector3(0, 0, -1), t: new THREE.Vector3(-1, 0, 0), yaw: Math.PI },
    { n: new THREE.Vector3(-1, 0, 0), t: new THREE.Vector3(0, 0, 1), yaw: -Math.PI / 2 },
  ];
  const louvres = new THREE.InstancedMesh(new THREE.BoxGeometry(W / PANELS - 0.15, FH - 0.6, 0.14), mat.panel, FLOORS * SIDES.length * PANELS);
  louvres.castShadow = louvres.receiveShadow = true;
  louvres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(louvres);
  {
    const alu = C("#cfd5da"), fin = C("#5f9a4e"), fin2 = C("#78ad5c");
    let idx = 0;
    for (let f = 0; f < FLOORS; f++) SIDES.forEach((side, si) => {
      for (let p = 0; p < PANELS; p++) {
        const planted = (si === 3 || si === 0) && (p + f) % 3 === 0;   // vegetated fins on two faces
        louvres.setColorAt(idx++, planted ? ((p + f) % 2 ? fin : fin2) : alu);
      }
    });
  }
  const MULL = 10;
  const mullions = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, FH - 0.45, 0.3), mat.mullion, FLOORS * 4 * MULL);
  mullions.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mullions);
  let lastSpread = -1;
  function layoutMullions(spread) {
    if (Math.abs(spread - lastSpread) < 1e-4) return;
    lastSpread = spread;
    let idx = 0;
    for (let f = 0; f < FLOORS; f++) {
      const y = floors[f].position.y + 0.45 + (FH - 0.45) / 2;
      SIDES.forEach(side => {
        for (let m = 0; m < MULL; m++) {
          dummy.position.copy(side.n).multiplyScalar(W / 2 - 0.25).addScaledVector(side.t, -W / 2 + 0.3 + (m / (MULL - 1)) * (W - 0.6));
          dummy.position.y = y;
          dummy.rotation.set(0, side.yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
          mullions.setMatrixAt(idx++, dummy.matrix);
        }
      });
    }
    mullions.instanceMatrix.needsUpdate = true;
  }

  const sunDir = new THREE.Vector3(), flatSun = new THREE.Vector3();
  function layoutFacade(st) {
    let idx = 0;
    for (let f = 0; f < FLOORS; f++) {
      const baseY = floors[f].position.y + 0.45 + (FH - 0.45) / 2;
      const e = smoothstep(st.explode * 1.5 - (1 - f / FLOORS) * 0.5, 0, 1);
      const out = W / 2 + 1.1 + e * 10;
      SIDES.forEach((side, si) => {
        const sunFacing = Math.max(0, side.n.dot(flatSun));
        for (let p = 0; p < PANELS; p++) {
          const along = -W / 2 + (p + 0.5) * (W / PANELS);
          const wave = 0.5 + 0.5 * Math.sin(p * 0.7 + f * 0.45 + si * 1.3 + st.wave);
          const adaptive = (1 - 0.8 * sunFacing) * (0.45 + 0.55 * wave);
          const open = lerp(0.28, adaptive, st.adapt);
          dummy.position.copy(side.n).multiplyScalar(out).addScaledVector(side.t, along);
          dummy.position.y = baseY;
          dummy.rotation.set(0, side.yaw + open * degToRad(80), 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          louvres.setMatrixAt(idx++, dummy.matrix);
        }
      });
    }
    louvres.instanceMatrix.needsUpdate = true;
  }

  // ---------- Solar rays onto the sun-facing glazing ----------
  const RAYS = 30;
  const rayGeo = new THREE.BufferGeometry();
  rayGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RAYS * 6), 3));
  const rays = new THREE.LineSegments(rayGeo, rayMat);
  rays.frustumCulled = false;
  scene.add(rays);
  const raySeeds = Array.from({ length: RAYS }, () => ({ u: rand() - 0.5, f: rand() * (FLOORS - 1), s: rand() }));
  function layoutRays() {
    const ranked = SIDES.map(side => ({ side, d: side.n.dot(flatSun) })).sort((a, b) => b.d - a.d);
    const pos = rayGeo.attributes.position.array;
    raySeeds.forEach((r, i) => {
      const pick = r.s < ranked[0].d / (ranked[0].d + Math.max(0, ranked[1].d) + 1e-6) ? ranked[0] : ranked[1];
      const g = floors[Math.floor(r.f)];
      const end = pick.side.n.clone().multiplyScalar(W / 2 - 0.3).addScaledVector(pick.side.t, r.u * (W - 2));
      end.y = g.position.y + 0.6 + (r.f % 1) * (FH - 1);
      const start = end.clone().addScaledVector(sunDir, 46);
      pos.set([start.x, start.y, start.z, end.x, end.y, end.z], i * 6);
    });
    rayGeo.attributes.position.needsUpdate = true;
  }

  // Soft sun shafts: open cones faded at both ends (additive)
  const shaftGeo = new THREE.CylinderGeometry(0.4, 7, 180, 20, 8, true);
  const sp = shaftGeo.attributes.position, cols = [];
  for (let i = 0; i < sp.count; i++) {
    const t = (sp.getY(i) + 90) / 180, f = Math.pow(Math.sin(Math.PI * t), 2);
    cols.push(1 * f, 0.82 * f, 0.5 * f);
  }
  shaftGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const shaftMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const shafts = Array.from({ length: 7 }, () => {
    const m = new THREE.Mesh(shaftGeo, shaftMat);
    m.userData.aim = new THREE.Vector3((rand() - 0.5) * 40, 10 + rand() * 50, (rand() - 0.5) * 40);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });

  // ---------- Traffic and people ----------
  function rectPath(s, hx, hz) {          // point and heading on a rectangle loop, s in [0, 1)
    const P = 4 * (hx + hz), d = ((s % 1) + 1) % 1 * P;
    if (d < 2 * hx) return [-hx + d, -hz, 0];
    if (d < 2 * hx + 2 * hz) return [hx, -hz + (d - 2 * hx), -Math.PI / 2];
    if (d < 4 * hx + 2 * hz) return [hx - (d - 2 * hx - 2 * hz), hz, Math.PI];
    return [-hx, hz - (d - 4 * hx - 2 * hz), Math.PI / 2];
  }
  const CAR_COLOURS = ["#c8102e", "#c8102e", "#1f8a4c", "#f2f2ee", "#2b2f36", "#f2f2ee", "#3c6fb0", "#e9e1c8"]; // red & green taxis, minibus cream
  // Positions are functions of scroll progress: traffic moves when the page scrolls and waits when it stops.
  const cars = Array.from({ length: 8 }, (_, i) => ({ s0: i / 8 + rand() * 0.05, lane: i % 2 ? 1 : -1, v: 0.12 + rand() * 0.07 }));
  const carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(4.2, 1.1, 1.9), mat.car, cars.length);
  const carCab = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.8, 1.7), mat.car, cars.length);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.3, 1.6), mat.headlight, cars.length);
  carBody.castShadow = true;
  cars.forEach((c, i) => {
    carBody.setColorAt(i, C(CAR_COLOURS[i % CAR_COLOURS.length]));
    carCab.setColorAt(i, C("#1c2430"));
  });
  scene.add(carBody, carCab, lights);
  const people = Array.from({ length: 14 }, (_, i) => {
    const outer = i % 3 === 0;                          // outer pavement beyond the ring road, or the plaza
    return { s0: rand(), v: (0.035 + rand() * 0.035) * (rand() < 0.5 ? 1 : -1), outer, off: (rand() - 0.5) * 1.4 };
  });
  const personGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.8, 6);
  personGeo.translate(0, 0.9, 0);
  const crowd = new THREE.InstancedMesh(personGeo, mat.person, people.length);
  const SHIRTS = ["#f5b83d", "#5aa9e6", "#f5a623", "#eef0f4", "#1c2330", "#7cc46b"];
  people.forEach((p, i) => crowd.setColorAt(i, C(SHIRTS[i % SHIRTS.length])));
  scene.add(crowd);

  function moveTraffic(q, nightAmt) {
    cars.forEach((c, i) => {
      const [x, z, yaw] = rectPath(c.s0 + c.lane * c.v * q, RING + c.lane * 1.8, RING + c.lane * 1.8);
      const dir = c.lane > 0 ? yaw : yaw + Math.PI;
      dummy.position.set(x, 0.75, z); dummy.rotation.set(0, dir, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      carBody.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 1.65; dummy.translateX(-0.3); dummy.updateMatrix();
      carCab.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.85, z); dummy.translateX(2.15); dummy.updateMatrix();
      lights.setMatrixAt(i, dummy.matrix);
    });
    people.forEach((p, i) => {
      const r = (p.outer ? RING + 5.2 : 24.8) + p.off * 0.5;
      const [x, z, yaw] = rectPath(p.s0 + p.v * q, r, r);
      dummy.position.set(x, 0.05, z);
      dummy.rotation.set(0, yaw, 0); dummy.scale.set(1.5, 1.5, 1.5); dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
    });
    carBody.instanceMatrix.needsUpdate = carCab.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = crowd.instanceMatrix.needsUpdate = true;
    mat.headlight.opacity = nightAmt;
  }

  // ---------- Camera path (one keyframe per step) ----------
  // Through the night prologue (q < 0) the camera holds the intro shot; scrolling moves only the
  // traffic, people and the light show.
  const KEYS = [
    { ang: 0.62, rad: 118, h: 16, ty: 27 },
    { ang: 0.95, rad: 112, h: 22, ty: 28 },
    { ang: 1.25, rad: 118, h: 22, ty: 30 },
    { ang: 1.60, rad: 166, h: 38, ty: 48 },
    { ang: 1.90, rad: 144, h: 26, ty: 43 },
    { ang: 2.15, rad: 154, h: 32, ty: 45 },
  ];
  const lookTarget = new THREE.Vector3();
  let distScale = 1;
  function placeCamera(q) {
    const k = clamp(q, 0, KEYS.length - 1);
    const i = Math.min(Math.floor(k), KEYS.length - 2);
    const t = smoothstep(k - i, 0, 1);
    const a = KEYS[i], b = KEYS[i + 1];
    const ang = lerp(a.ang, b.ang, t), rad = lerp(a.rad, b.rad, t) * distScale;
    camera.position.set(Math.cos(ang) * rad, lerp(a.h, b.h, t) * distScale, Math.sin(ang) * rad);
    lookTarget.set(0, lerp(a.ty, b.ty, t), 0);
    camera.lookAt(lookTarget);
  }

  // ---------- Data-driven targets ----------
  const norm = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  function dataTargets(q) {
    const sh = D.shgc.runs[S.runIndex("shgc", q)];
    const vent = q < 2.5 ? D.vent.runs[D.vent.control] : D.vent.runs[S.runIndex("vent", q)];
    const lp = q < 3.5 ? D.lpd.runs[D.lpd.control] : D.lpd.runs[S.runIndex("lpd", q)];
    // Heating points grow as the lighting run cuts lighting power (less lamp heat, more heating).
    const heat = 0.3 + 0.7 * norm(lp.heat, 2.93, 4.42);
    return { shgc: q < 1.5 ? 0.70 : sh.x, cfm: vent.x, lpd: lp.x, heat };
  }
  const live = { shgc: 0.70, cfm: 20, lpd: 0.52, heat: 0 };
  const sunScreen = new THREE.Vector3();
  let flowSpeed = 0.12;

  function update(q, time, dt) {
    const st = {
      adapt: smoothstep(q, 0.25, 1.0), wave: q * 2.2,
      explode: smoothstep(q, 1.2, 2.0), spread: smoothstep(q, 2.2, 3.0),
      // Airflow has the stage to itself in step 3, then fades out as the heating points come in.
      air: smoothstep(q, 2.4, 2.9) * (1 - smoothstep(q, 3.15, 3.4)),
      heat: smoothstep(q, 3.4, 3.65),
      rays: smoothstep(q, 1.25, 1.6) * (1 - smoothstep(q, 2.4, 2.8)),
      lamps: smoothstep(q, 3.25, 3.6), sense: smoothstep(q, 4.35, 4.9),
    };
    const tgt = dataTargets(q);
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 8);
    for (const key in live) live[key] += (tgt[key] - live[key]) * k;

    // Time of day: night → morning (0.3–1.0), daylight through step 4, sunset only in the last step.
    const day = smoothstep(q, 0.3, 1.0), dusk = smoothstep(q, 4.0, 4.85), night = 1 - day;
    const dawn = 4 * day * (1 - day);
    const alt = q < 1.6 ? lerp(4, 46, smoothstep(q, 0.3, 1.6)) : lerp(46, 7, smoothstep(q, 3.7, 4.9));
    const az = lerp(200, 262, smoothstep(q, 0, 4.8));
    sunDir.set(Math.cos(degToRad(alt)) * Math.sin(degToRad(az)), Math.sin(degToRad(alt)), Math.cos(degToRad(alt)) * Math.cos(degToRad(az)));
    flatSun.set(sunDir.x, 0, sunDir.z).normalize();

    const skyTop = blend("skyTop", day, dusk), skyLow = blend("skyLow", day, dusk).clone().lerp(PAL.sunset.skyLow, dawn * 0.45);
    stage.style.setProperty("--sky-a", "#" + skyTop.getHexString());
    stage.style.setProperty("--sky-b", "#" + skyLow.getHexString());
    scene.fog.color.copy(skyLow);
    // Soft light: strong sky fill, gentle sun
    hemi.intensity = lerp(0.42, 0.95, day) * lerp(1, 0.85, dusk);
    hemi.color.copy(blend("light", day, dusk)).lerp(new THREE.Color(0xffffff), 0.5);
    hemi.groundColor.set(day > 0.5 ? 0x5a6b4e : 0x1c2430);
    sunLight.intensity = lerp(0.18, 0.72, day) * lerp(1, 0.75, dusk);
    sunLight.color.copy(blend("light", day, dusk));
    ["concrete", "slab", "ground", "green", "road", "walk", "water", "hill"].forEach(key => {
      const m = key === "hill" ? mat.hill : mat[key];
      m.color.copy(blend(key, day, dusk));
    });
    mat.hedge.color.copy(mat.green.color).multiplyScalar(0.85);
    mat.canopy.color.copy(blend("panelTint", day, dusk)).lerp(new THREE.Color(0xffffff), day * 0.3);
    mat.core.color.copy(mat.concrete.color);
    mat.panel.color.copy(blend("panelTint", day, dusk));
    mat.mullion.color.copy(mat.slab.color).multiplyScalar(0.55);
    mat.plant.color.copy(mat.slab.color).multiplyScalar(0.8);
    mat.car.color.copy(blend("panelTint", day, dusk));
    mat.person.color.copy(mat.car.color);
    const ctx = blend("context", day, dusk);
    // The city keeps its lights on all day; they brighten at night and at sunset.
    const dark = Math.max(night, dusk);
    cityMats.forEach(m => { m.color.copy(ctx); m.emissiveIntensity = lerp(0.4, 0.85, dark); });
    nearMats.forEach(m => { m.color.copy(ctx); m.emissiveIntensity = Math.pow(dark, 1.6) * 0.75; });
    mat.brace.opacity = 0.35 + dark * 0.6;
    // The harbour light show runs at night and ends as the sky starts to brighten.
    layoutShow(q, 0.62 * (1 - smoothstep(q, 0.3, 0.65)), ctx);
    // The tower itself is lit only by its own windows: warm at night, a glow at sunset.
    const glow = Math.max(night, dusk * 0.55);

    sunDisc.visible = day > 0.02;
    sunDisc.scale.setScalar(lerp(0.8, 1.6, dusk));
    mat.sun.color.set(0xffe7a8).lerp(new THREE.Color(0xff8a4a), dusk);
    sunLight.position.copy(sunDir).multiplyScalar(240);
    sunLight.target.position.set(0, 25, 0);
    sunDisc.position.copy(sunDir).multiplyScalar(520);
    shaftMat.opacity = day * (1 - dusk * 0.6) * smoothstep(q, 0.45, 1.0) * 0.11;
    shafts.forEach(m => {
      m.visible = shaftMat.opacity > 0.004;
      if (m.visible) { m.position.copy(m.userData.aim).addScaledVector(sunDir, 90); m.quaternion.setFromUnitVectors(UP, sunDir); }
    });

    floors.forEach((g, i) => { g.position.y = i * (FH + st.spread * GAP); });
    layoutFacade(st);
    layoutMullions(st.spread);

    // Envelope: tint follows SHGC, rays carry the transmitted solar gain.
    const tint = norm(0.70 - live.shgc, 0, 0.40);
    const glassNow = blend("glass", day, dusk);
    mat.glass.color.copy(glassNow).lerp(glassNow.clone().multiplyScalar(0.45), tint);
    mat.glass.emissive.copy(PAL.night.glass).multiplyScalar(glow * 1.1 * (1 - tint * 0.4));
    mat.glass.opacity = Math.max(lerp(0.4, 0.62, tint), night * 0.7);
    rays.visible = st.rays > 0.01;
    if (rays.visible) layoutRays();
    rayMat.opacity = st.rays * lerp(0.15, 0.7, norm(live.shgc, 0.30, 0.70));

    // Air: thicker streams with arrows; density and speed follow outdoor air.
    const airAmt = norm(live.cfm, 10, 30);
    mat.air.opacity = st.air * lerp(0.25, 0.55, airAmt);
    mat.arrow.opacity = st.air;
    risers.forEach(r => { r.visible = st.air > 0.01; });
    streams.forEach(s => { s.tube.visible = st.air > 0.01; });
    arrows.visible = st.air > 0.01;
    flowSpeed = lerp(0.06, 0.22, airAmt);

    // Heating: orange points under the windows, sized by the lighting run's heating load.
    heaterMat.opacity = st.heat;
    heaterMat.size = lerp(7, 13, live.heat);
    heaters.forEach(h => { h.visible = st.heat > 0.01; });

    mat.lamp.opacity = Math.max(st.lamps * lerp(0.15, 0.95, norm(live.lpd, 0.39, 0.78)), night * 0.85);

    const pulse = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 0.004);
    mat.sensor.opacity = st.sense;
    sensors.forEach((s, i) => { s.scale.setScalar(Math.max(0.001, st.sense * pulse * (i % 4 === 0 ? 1.15 : 1))); });

    moveTraffic(q, Math.max(night, dusk * 0.7));

    placeCamera(q);
    camera.updateMatrixWorld();
    sunScreen.copy(sunDisc.position).project(camera);
    const onScreen = sunScreen.z < 1;
    stage.style.setProperty("--day", (onScreen ? day * lerp(0.7, 0.9, dusk) : 0).toFixed(3));
    stage.style.setProperty("--end", smoothstep(S.tail(), 0.35, 1).toFixed(3));   // fades over the tail after the last card
    stage.style.setProperty("--sx", clamp((sunScreen.x + 1) * 50, 4, 96).toFixed(1) + "%");
    stage.style.setProperty("--sy", clamp((1 - sunScreen.y) * 50, -10, 80).toFixed(1) + "%");
  }

  // ---------- Size and framing ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (backRenderer) backRenderer.setSize(w, h, false);
    camera.aspect = w / h;
    distScale = camera.aspect < 1 ? 2.1 : 1;
    scene.fog.near = 300 * distScale;
    scene.fog.far = 950 * distScale;
    stage.style.setProperty("--focus-blur", (w > 720 ? 3 : 2) + "px");
    if (w > 720) camera.setViewOffset(w * 1.5, h, 0, 0, w, h);
    else camera.setViewOffset(w, h * 1.1, 0, h * 0.1, w, h);
    camera.updateProjectionMatrix();
  }

  // ---------- Loop ----------
  // Two passes: the backdrop (layer 1) into the blurred canvas, then the tower and streets (layer 0).
  function render() {
    if (backRenderer) {
      camera.layers.set(BACK);
      backRenderer.render(scene, camera);
      camera.layers.set(0);
    } else {
      camera.layers.enable(BACK);
    }
    renderer.render(scene, camera);
  }
  let current = S.progress(), running = false, last = performance.now();
  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const target = S.progress();
    current = reduceMotion ? target : current + (target - current) * (1 - Math.exp(-dt * 6));
    if (Math.abs(target - current) < 0.0005) current = target;
    update(current, now, dt);
    if (!reduceMotion) flow = (flow + dt * flowSpeed) % 1;
    if (arrows.visible) layoutArrows();
    render();
    requestAnimationFrame(tick);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !document.hidden) start();
    else running = false;
  }).observe(story);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else if (story.getBoundingClientRect().bottom > 0) start();
  });
  new ResizeObserver(resize).observe(canvas);

  applyTheme();
  resize();
  Object.assign(live, dataTargets(current));
  update(current, performance.now(), 0);
  layoutArrows();
  render();
  start();
})();
