// Scroll-driven 3D building for the hero.
// A street-level tower wrapped in an adaptive louvre facade with planted fins, set in a
// park-filled Hong Kong neighbourhood across the harbour from a stylised skyline.
// Scroll progress q (−2 → 7, one unit per story step, from story.js) drives:
//  −2 → −1 sunrise (intro, background): the camera holds a shot with the tower to the right of the name and
//          the sun already up between them; scrolling moves the traffic and people and lifts the sun
//  −1 → 0  the camera swings round until the tower stands in the middle of the screen, cards either side;
//          full day by the Project 2.1 introduction
//   0 → 1  louvres adapt to the sun; sun rays with arrowheads show where it strikes (gone before 1 → 2)
//   1 → 2  facade pulls away; glazing tint follows the SHGC run
//   2 → 3  floors separate; airflow arrows follow the outdoor-air run
//   3 → 4  airflow gives way to heating points; ceiling lights follow the lighting-power run
//   4 → 5  sensors switch on as the light turns golden
//   5 → 6  the tower closes back up (every run side by side)
//   6 → 7  night falls (street lamps, car lights and coloured city light on wet roads come on), the roof
//          lifts off and the camera rises to look almost straight down into the top floor, laid out as
//          the office of Project 2.2; the layout buttons move its luminaires
// The skyline is drawn by a second renderer onto #backdrop-canvas, which CSS blurs, so the tower stays
// the one thing in focus. The tower is illustrative; the numbers belong to the ME 572 models. Units are
// metres; the landmarks are scaled down to fit the frame.

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
    air: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    arrow: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    sensor: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    lamp: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    headlight: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, color: 0xfff2c8 }),
    brace: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5, color: 0xffffff }),
    sun: new THREE.MeshBasicMaterial({ color: 0xffe7a8, fog: false }),
  };
  const rayMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0 });
  const rayHeadMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const UP = new THREE.Vector3(0, 1, 0);
  const dummy = new THREE.Object3D();                 // scratch transform for instanced meshes

  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // Palettes: early morning (start, still called night), day, golden hour, and real night for Project 3.2.
  // update() blends between them; `nightfall` (0 → 1) is set at the top of each update.
  const PAL = {
    night: { concrete: C("#c3ced2"), slab: C("#e4eaeb"), panelTint: C("#eef4f4"), glass: C("#bfe0ec"), ground: C("#9cc47e"),
      road: C("#8b9497"), walk: C("#e3e6dc"), water: C("#82c3d8"), green: C("#7fbf5e"), context: C("#d3e2e8"), hill: C("#8dbf74"),
      skyTop: C("#8fcbe6"), skyLow: C("#e6f6f3"), light: C("#f4fbff") },
    day: { concrete: C("#b8c3c6"), slab: C("#e2e7e7"), panelTint: C("#ffffff"), glass: C("#9ccbe2"), ground: C("#8fc06a"),
      road: C("#6e777b"), walk: C("#dcdccf"), water: C("#4b97c0"), green: C("#6fb34e"), context: C("#c4d4dc"), hill: C("#6aa85a"),
      skyTop: C("#4b97c0"), skyLow: C("#d8f0f4"), light: C("#fff8ea") },
    sunset: { concrete: C("#c8bfb6"), slab: C("#e8ddd2"), panelTint: C("#fbe9da"), glass: C("#f5c49a"), ground: C("#9cb877"),
      road: C("#6d6a6c"), walk: C("#ddd0c2"), water: C("#8fb6cf"), green: C("#78a85a"), context: C("#c8c4cc"), hill: C("#7ea067"),
      skyTop: C("#6fa3cf"), skyLow: C("#ffd9a8"), light: C("#ffd2a0") },
    dark: { concrete: C("#2c3540"), slab: C("#3a4552"), panelTint: C("#5b6672"), glass: C("#1d2a38"), ground: C("#142019"),
      road: C("#10151b"), walk: C("#252b31"), water: C("#0b1826"), green: C("#1d3324"), context: C("#18212b"), hill: C("#13201a"),
      skyTop: C("#050a14"), skyLow: C("#142235"), light: C("#8fa3c8") },
  };
  const WARM = C("#ffcf86");                         // window glow
  const tmp = {};
  let nightfall = 0;
  function blend(key, day, dusk) {
    const c = tmp[key] || (tmp[key] = new THREE.Color());
    return c.copy(PAL.night[key]).lerp(PAL.day[key], day).lerp(PAL.sunset[key], dusk).lerp(PAL.dark[key], nightfall);
  }

  function applyTheme() {
    mat.air.color.set(cssColor("--c-cool", "#2a9fd6"));
    mat.arrow.color.set(cssColor("--c-cool", "#2a9fd6"));
    rayMat.color.set("#ffc46b");
    rayHeadMat.color.set("#ffb347");
    mat.sensor.color.set("#f4f8ff");                 // sensors are white so they never read as heat
    mat.lamp.color.set(cssColor("--b-lamp", "#ffd88a"));
  }

  // Lit-window texture for the surrounding towers (mostly warm, a few cool and pink).
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
  function makeSoftTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.4, "rgba(255, 255, 255, 0.45)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const softTex = makeSoftTexture();
  const glowMat = (color, extra = {}) => new THREE.MeshBasicMaterial({ map: softTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, ...extra });
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
  // Pavement on the far side of the ring road, so people outside it walk on paving, not grass
  [[0, RING + 6.25, 2 * (RING + 8.5), 4.5], [0, -RING - 6.25, 2 * (RING + 8.5), 4.5], [RING + 6.25, 0, 4.5, 2 * (RING + 8.5)], [-RING - 6.25, 0, 4.5, 2 * (RING + 8.5)]]
    .forEach(([x, z, w, d]) => flat(w, d, mat.walk, x, z, 0.032));
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
  function place(obj, angle, r) {
    r *= 1.45;                             // across the harbour, hazed by distance
    obj.scale.setScalar(0.6);
    obj.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    skyline.add(obj);
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
  place(boc, 4.55, 215);
  // Central Plaza: triangular tower, pyramid top and mast
  const cp = new THREE.Group();
  const cpBody = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 128, 3), cityMaterial(26, 128));
  cpBody.position.y = 64; cp.add(cpBody);
  const cpTop = new THREE.Mesh(new THREE.ConeGeometry(15, 22, 3), cityMaterial(20, 20));
  cpTop.position.y = 139; cp.add(cpTop);
  box(0.8, 30, 0.8, mat.mullion, cp, 0, 165, 0, false);
  place(cp, 5.35, 190);
  // The Center: square tower
  const center = stack([[22, 118], [18, 12]]);
  place(center, 3.75, 198);
  // Supporting towers to fill the skyline
  for (let i = 0; i < 40; i++) {
    const a = HARBOUR[0] + 0.05 + rand() * (HARBOUR[1] - HARBOUR[0] - 0.1), r = 182 + rand() * 95;
    const w = 12 + rand() * 12, h = 36 + rand() * 90;
    place(stack([[w, h]]), a, r);
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

  // Low-rise neighbours on this side of the harbour, away from the camera's path
  // The three closest to the tower are left out so it has room around it.
  const neighbours = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.15;
    if (a > 0.05 && a < 2.75) continue;
    neighbours.push({ a, r: 52 + rand() * 32, h: 10 + rand() * 26, w: 9 + rand() * 7 });
  }
  const near = neighbours.sort((p, q) => p.r - q.r).slice(3);
  near.forEach(({ a, r, h, w }) => {
    const b = box(w, h, w, cityMaterial(w, h, nearMats), scene, Math.cos(a) * r, h / 2, Math.sin(a) * r);
    box(w * 0.9, 0.6, w * 0.9, mat.green, scene, b.position.x, h + 0.3, b.position.z, false);   // green roofs
  });
  const NEON = ["#ff4fa3", "#3fd0ff", "#ffb347", "#9b6bff", "#4dffb0", "#ff6b5a"];   // Hong Kong's coloured night light

  // ---------- Street lamps: posts on both kerbs of the ring road, a warm pool of light under each ----------
  const lampSpots = [];
  for (let s = -RING + 3; s <= RING - 3; s += 13) [RING + 5.2, RING - 5.2].forEach((o, k) => {
    const toRoad = k ? 1 : -1;                                                  // which way the head leans
    lampSpots.push([s, -o, 0, toRoad], [s, o, 0, -toRoad], [-o, s, toRoad, 0], [o, s, -toRoad, 0]);
  });
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 6, 6), mat.mullion, lampSpots.length);
  const LAMP_OFF = C("#9aa3a8"), LAMP_ON = C("#ffe2a8");
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: LAMP_OFF });
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.22, 0.55), lampHeadMat, lampSpots.length);
  const poolGeo = new THREE.PlaneGeometry(12, 12); poolGeo.rotateX(-Math.PI / 2);
  const poolMat = glowMat(0xffc977);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampSpots.length);
  lampSpots.forEach(([x, z, dx, dz], i) => {
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.position.set(x, 3, z); dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x + dx * 0.7, 6, z + dz * 0.7); dummy.rotation.set(0, dx ? 0 : Math.PI / 2, 0); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    dummy.rotation.set(0, 0, 0); dummy.position.set(x + dx * 2.6, 0.12, z + dz * 2.6); dummy.updateMatrix(); pools.setMatrixAt(i, dummy.matrix);
  });
  pools.renderOrder = 2;
  scene.add(posts, heads, pools);

  // Hong Kong's coloured night light, spilling onto the streets and the tower (roads turn wet-looking at night).
  const neonLights = [[RING + 9, RING + 9], [-RING - 9, RING + 9], [RING + 9, -RING - 9], [-RING - 9, -RING - 9], [0, RING + 14], [RING + 14, 0]]
    .map(([x, z], i) => { const l = new THREE.PointLight(NEON[i % NEON.length], 0, 70, 1.2); l.position.set(x, 5, z); scene.add(l); return l; });

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
  const leaf = new THREE.Color();
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
  let top;                                          // the top floor's parts, filled in below
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
    const core = box(6, FH - 0.45, 6, mat.core, g, 0, 0.45 + (FH - 0.45) / 2, 0);
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

    // Roof: green roof, rooftop plant (AHUs) and trees, in one group so it can lift off for Project 3.2
    if (i === FLOORS - 1) {
      const roof = new THREE.Group();
      g.add(roof);
      box(W + 1.6, 0.5, W + 1.6, mat.slab, roof, 0, FH + 0.25, 0);
      box(W - 1, 0.4, W - 1, mat.green, roof, 0, FH + 0.7, 0, false);
      [[-5, -5, 5, 2.4, 3], [4, -5, 4, 2, 4], [0, 5, 7, 2.6, 3.5]].forEach(([x, z, w, h, d]) => box(w, h, d, mat.plant, roof, x, FH + 0.9 + h / 2, z));
      [[-7, 6], [7, 7], [-7, 0], [7, 0]].forEach(([x, z]) => {
        const t = new THREE.Mesh(smallCanopy, mat.canopy); t.position.set(x, FH + 2.4, z); t.castShadow = true; roof.add(t);
      });
      top = { g, roof, inside: [glazing, core, lamp] };   // hidden while we look into the room
    }
    floors.push(g);
  }

  // ---------- Project 3.2: the top floor as the 48 × 34 ft office, seen from above at night ----------
  // When the roof lifts off, the whole floor becomes the ME572 office, drawn to one scale so its 48 ft
  // run spans the floor. 2 × 4 ft luminaires hang 6.5 ft above the work plane and the floor carries
  // their light, recomputed from the layout (point sources, E = I·h / d³) and scaled so the average over
  // the office matches the report: 42 fc for 4 × 4, 52 fc for 5 × 4. The layout buttons
  // (sections.js, "lighting-layout") slide the luminaires to their new places.
  const RW = 48, RD = 34, MOUNT = 6.5, Y0 = 0.47;    // feet; lamps 6.5 ft above the desks
  const PLATE = W - 0.6, SC = PLATE / RW, Z0 = (RD - RW) / 2;   // metres per foot; the square floor runs 7 ft past the office each side
  const room = new THREE.Group();
  room.visible = false;
  top.g.add(room);
  const LW = 160, LD = 160;
  const lightCanvas = document.createElement("canvas");
  lightCanvas.width = LW; lightCanvas.height = LD;
  const lightCtx = lightCanvas.getContext("2d"), lightImg = lightCtx.createImageData(LW, LD);
  const lightTex = new THREE.CanvasTexture(lightCanvas);
  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(PLATE, PLATE), new THREE.MeshBasicMaterial({ map: lightTex }));
  roomFloor.rotation.x = -Math.PI / 2;
  roomFloor.position.y = Y0;
  room.add(roomFloor);
  const lumMat = new THREE.MeshBasicMaterial({ color: cssColor("--b-lamp", "#fff1c9") });
  const lums = new THREE.InstancedMesh(new THREE.BoxGeometry(2 * SC, 0.08, 4 * SC), lumMat, 20);
  room.add(lums);

  // 20 luminaires in a 5 × 4 grid; the 4 × 4 layout parks the fifth column on the fourth, hidden.
  const layoutOf = o => Array.from({ length: 20 }, (_, k) => {
    const r = Math.floor(k / 5), c = k % 5, col = Math.min(c, o.cols - 1);
    return { x: ((col + 0.5) * RW) / o.cols, z: ((r + 0.5) * RD) / o.rows, s: c < o.cols ? 1 : 0 };
  });
  let lamps = layoutOf({ cols: 5, rows: 4 }), from = lamps, to = lamps, fcFrom = 52, fcTo = 52, fcNow = 52, t0 = -1e9;
  const raw = new Float32Array(LW * LD);
  function paintLight() {
    let sum = 0, cells = 0;
    for (let j = 0; j < LD; j++) {
      const z = Z0 + ((j + 0.5) / LD) * RW;
      for (let i = 0; i < LW; i++) {
        const x = ((i + 0.5) / LW) * RW;
        let e = 0;
        for (const l of lamps) {
          if (l.s < 0.01) continue;
          const d2 = (x - l.x) ** 2 + (z - l.z) ** 2 + MOUNT * MOUNT;
          e += (l.s * MOUNT) / (d2 * Math.sqrt(d2));
        }
        raw[j * LW + i] = e;
        if (z >= 0 && z <= RD) { sum += e; cells++; }   // the report's average is over the office itself
      }
    }
    const k = fcNow / (sum / cells), px = lightImg.data;
    for (let n = 0; n < raw.length; n++) {
      const v = clamp((raw[n] * k - 12) / 60, 0, 1);     // 12 fc and below is dark floor, 72 fc is full light
      px[n * 4] = lerp(18, 255, v); px[n * 4 + 1] = lerp(26, 242, v); px[n * 4 + 2] = lerp(34, 196, v); px[n * 4 + 3] = 255;
    }
    lightCtx.putImageData(lightImg, 0, 0);
    lightTex.needsUpdate = true;
  }
  function placeLums() {
    lamps.forEach((l, k) => {
      dummy.position.set((l.x - RW / 2) * SC, Y0 + 2.9, (l.z - RD / 2) * SC);
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(Math.max(0.001, l.s)); dummy.updateMatrix();
      lums.setMatrixAt(k, dummy.matrix);
    });
    lums.instanceMatrix.needsUpdate = true;
  }
  let roomDirty = true;
  function setLayout(o) {
    if (!o) return;
    from = lamps; to = layoutOf(o); fcFrom = fcNow; fcTo = o.fc; t0 = performance.now(); roomDirty = true;
  }
  function stepRoom(time) {
    if (!roomDirty) return;
    const k = clamp((time - t0) / 700, 0, 1), e = k * k * (3 - 2 * k);
    lamps = to.map((b, i) => ({ x: lerp(from[i].x, b.x, e), z: lerp(from[i].z, b.z, e), s: lerp(from[i].s, b.s, e) }));
    fcNow = lerp(fcFrom, fcTo, e);
    placeLums(); paintLight();
    if (k >= 1) roomDirty = false;
  }
  window.addEventListener("lighting-layout", e => { setLayout(e.detail); if (!running) { update(current, performance.now(), 0); render(); } });
  setLayout(window.lightingLayout);

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
  let lastKey = "";
  function layoutMullions(spread, roof) {
    const key = spread.toFixed(4) + roof.toFixed(3);
    if (key === lastKey) return;
    lastKey = key;
    let idx = 0;
    for (let f = 0; f < FLOORS; f++) {
      const y = floors[f].position.y + 0.45 + (FH - 0.45) / 2;
      SIDES.forEach(side => {
        for (let m = 0; m < MULL; m++) {
          dummy.position.copy(side.n).multiplyScalar(W / 2 - 0.25).addScaledVector(side.t, -W / 2 + 0.3 + (m / (MULL - 1)) * (W - 0.6));
          dummy.position.y = y;
          dummy.rotation.set(0, side.yaw, 0); dummy.scale.set(1, f === FLOORS - 1 ? Math.max(0.001, 1 - roof) : 1, 1); dummy.updateMatrix();
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
      const keep = f === FLOORS - 1 ? Math.max(0.001, 1 - st.roof) : 1;   // the top floor's louvres fold away with the roof
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
          dummy.scale.set(1, keep, 1);
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
  const rayHeads = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 2.6, 8), rayHeadMat, RAYS);
  rayHeads.frustumCulled = false;
  scene.add(rayHeads);
  const inbound = new THREE.Vector3();
  const raySeeds = Array.from({ length: RAYS }, () => ({ u: rand() - 0.5, f: rand() * (FLOORS - 1), s: rand() }));
  // The sun mostly lights the faces turned away from the camera, so the rays land on whichever sunlit face
  // the camera sees best, and stop just short of it so the arrowheads stand clear of the louvres.
  const toCam = new THREE.Vector3();
  function layoutRays() {
    toCam.set(camera.position.x, 0, camera.position.z).normalize();
    const lit = SIDES.filter(side => side.n.dot(flatSun) > 0.1);
    const side = (lit.length ? lit : SIDES).reduce((a, b) => (b.n.dot(toCam) > a.n.dot(toCam) ? b : a));
    const pos = rayGeo.attributes.position.array;
    raySeeds.forEach((r, i) => {
      const g = floors[Math.floor(r.f)];
      const end = side.n.clone().multiplyScalar(W / 2 + 8).addScaledVector(side.t, r.u * (W - 2));
      end.y = g.position.y + 0.6 + (r.f % 1) * (FH - 1);
      const start = end.clone().addScaledVector(sunDir, 46);
      pos.set([start.x, start.y, start.z, end.x, end.y, end.z], i * 6);
      inbound.copy(sunDir).negate();
      dummy.position.copy(end).addScaledVector(sunDir, 1.3);   // cone centre, so the tip lands on the ray's end
      dummy.quaternion.setFromUnitVectors(UP, inbound);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      rayHeads.setMatrixAt(i, dummy.matrix);
    });
    rayGeo.attributes.position.needsUpdate = true;
    rayHeads.instanceMatrix.needsUpdate = true;
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
  // Some cars and people leave before Project 2.1: at qLeave they reach the waterfront avenue (−z) and head
  // off down it, away from the camera. Their start point is set so they are at that junction exactly then.
  const EXIT_S = 1 / 8;                             // rectPath: middle of the −z side, heading +x
  const loopOrLeave = (s0, rate, q, h, qLeave, exitX) => (qLeave === undefined || q < qLeave
    ? rectPath(s0 + rate * q, h, h)
    : [exitX, -h - (q - qLeave) * rate * 8 * h, Math.PI / 2]);   // same speed, now along −z
  const cars = Array.from({ length: 6 }, (_, i) => {
    const c = { s0: i / 6 + rand() * 0.05, lane: i % 2 ? 1 : -1, v: 0.12 + rand() * 0.07 };
    if (i === 1 || i === 3) { c.qLeave = i === 1 ? -1.4 : -0.5; c.s0 = EXIT_S - c.v * c.qLeave; }
    return c;
  });
  const carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(4.2, 1.1, 1.9), mat.car, cars.length);
  const carCab = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.8, 1.7), mat.car, cars.length);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.3, 1.6), mat.headlight, cars.length);
  carBody.castShadow = true;
  cars.forEach((c, i) => {
    carBody.setColorAt(i, C(CAR_COLOURS[i % CAR_COLOURS.length]));
    carCab.setColorAt(i, C("#1c2430"));
  });
  const beamGeo = new THREE.PlaneGeometry(9, 3.4); beamGeo.rotateX(-Math.PI / 2);
  const beamMat = glowMat(0xfff1cc), tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0 });
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, cars.length), tails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.28, 1.5), tailMat, cars.length);
  beams.renderOrder = 2;
  scene.add(carBody, carCab, lights, beams, tails);
  // People: one simple figure (head, body, legs) for everyone, walking, sitting or walking the dog.
  const skin = std({ color: 0xd9a77c });
  function makeActor(shirt, legs) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.8, 8), std({ color: shirt }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1, 0.3), std({ color: legs }));
    body.castShadow = head.castShadow = lower.castShadow = true;
    g.add(body, head, lower);
    scene.add(g);
    return { g, body, head, lower };
  }
  // sit 0 = standing (legs straight down), 1 = seated (legs forward along the seat); bob is the walking step
  function pose(a, sit, bob = 0) {
    a.body.position.set(0, lerp(1.35, 1.0, sit) + bob, lerp(0, -0.12, sit));
    a.head.position.set(0, lerp(1.98, 1.6, sit) + bob, lerp(0, -0.1, sit));
    a.lower.position.set(0, lerp(0.48, 0.66, sit) + bob * 0.5, lerp(0, 0.2, sit));
    a.lower.scale.set(1, lerp(0.95, 0.14, sit), lerp(1, 1.8, sit));
  }
  const SHIRTS = ["#f5b83d", "#5aa9e6", "#e0703a", "#eef0f4", "#46953d", "#8a5bd6"], LEGS = ["#2d3a40", "#3a4a5a", "#2b2f36"];
  const people = Array.from({ length: 8 }, (_, i) => {
    const outer = i % 2 === 0;                          // outer pavement beyond the ring road, or the plaza
    const p = { s0: rand(), v: (0.035 + rand() * 0.035) * (rand() < 0.5 ? 1 : -1), outer, off: (rand() - 0.5) * 1.4,
      a: makeActor(SHIRTS[i % SHIRTS.length], LEGS[i % LEGS.length]) };
    if (i === 0 || i === 4) { p.v = Math.abs(p.v); p.qLeave = i ? -0.3 : -1.2; p.s0 = EXIT_S - p.v * p.qLeave; }
    pose(p.a, 0);
    return p;
  });

  function moveTraffic(q, nightAmt) {
    cars.forEach((c, i) => {
      const [x, z, yaw] = loopOrLeave(c.s0, c.lane * c.v, q, RING + c.lane * 1.8, c.qLeave, 1.8);
      const dir = c.lane > 0 ? yaw : yaw + Math.PI;
      dummy.position.set(x, 0.75, z); dummy.rotation.set(0, dir, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      carBody.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 1.65; dummy.translateX(-0.3); dummy.updateMatrix();
      carCab.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.85, z); dummy.translateX(2.15); dummy.updateMatrix();
      lights.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.85, z); dummy.translateX(-2.15); dummy.updateMatrix();
      tails.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.13, z); dummy.translateX(6.6); dummy.updateMatrix();
      beams.setMatrixAt(i, dummy.matrix);
    });
    beams.instanceMatrix.needsUpdate = tails.instanceMatrix.needsUpdate = true;
    people.forEach(p => {
      const r = (p.outer ? RING + 5.2 : 24.8) + p.off * 0.5;
      const [x, z, yaw] = loopOrLeave(p.s0, p.v, q, r, p.qLeave, 5.6);
      p.a.g.position.set(x, 0.05, z);
      p.a.g.rotation.y = yaw;
    });
    carBody.instanceMatrix.needsUpdate = carCab.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true;
    mat.headlight.opacity = nightAmt;
    beamMat.opacity = 0.45 * nightAmt;
    tailMat.opacity = nightAmt;
  }

  // ---------- Street life: crossings, traffic lights, bins, benches with people, a dog, a plane ----------
  // Fixed scenery, plus things that move with the scroll (people, dog, plane) or on their own (traffic
  // lights cycle, the dog wags, the plane's beacon blinks) in livenStreet(), called every frame.
  const white = new THREE.MeshBasicMaterial({ color: 0xf2f2ea, transparent: true, opacity: 0.85 });
  // Zebra crossings where the four avenues meet the ring road
  [[0, RING + 6.5, 0], [RING + 6.5, 0, 1], [0, -RING - 6.5, 0], [-RING - 6.5, 0, 1]].forEach(([cx, cz, across]) => {
    for (let k = -2; k <= 2; k++) {
      const m = flat(across ? 3 : 0.7, across ? 0.7 : 3, white, cx + (across ? 0 : k * 1.45), cz + (across ? k * 1.45 : 0), 0.08);
      m.receiveShadow = false;
    }
  });
  // Traffic lights on the corner of each crossing, cycling green → amber → red
  const signalSets = [];
  [[5.2, RING + 5.2, 0], [RING + 5.2, -5.2, Math.PI / 2], [-5.2, -RING - 5.2, Math.PI], [-RING - 5.2, 5.2, -Math.PI / 2]].forEach(([x, z, yaw], i) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = yaw;
    box(0.22, 4.6, 0.22, mat.mullion, g, 0, 2.3, 0);
    box(0.6, 1.7, 0.5, std({ color: 0x1d2420 }), g, 0, 4.4, 0.1);
    const lamps = ["#ff4a3d", "#ffb52e", "#3ddc84"].map((c, k) => {
      const m = new THREE.MeshBasicMaterial({ color: c });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), m);
      b.position.set(0, 4.95 - k * 0.52, 0.37);
      g.add(b);
      return { m, on: C(c), off: C(c).multiplyScalar(0.18) };
    });
    scene.add(g);
    signalSets.push({ lamps, offset: i % 2 ? 6 : 0 });
  });
  // Bins along the outer pavements
  const binGeo = new THREE.CylinderGeometry(0.38, 0.32, 1, 10), binMat = std({ color: 0x2f6b3f });
  [[-18, RING + 7.6], [9, RING + 7.6], [24, RING + 7.6], [RING + 7.6, -16], [RING + 7.6, 12], [RING + 7.6, 26], [-RING - 7.6, 10], [14, -RING - 7.6]]
    .forEach(([x, z]) => { const b = new THREE.Mesh(binGeo, binMat); b.position.set(x, 0.5, z); b.castShadow = true; scene.add(b); });
  // Benches on the plaza lawn. As the page scrolls, one person walks over and sits down on an empty bench
  // while another gets up and leaves; a third stays sitting the whole time (one to three people at once).
  const benchWood = std({ color: 0x9a6b43 });
  const benches = [[18, 3, Math.PI / 2], [3, 18, 0], [-13, 18, 0], [18, -11, Math.PI / 2]].map(([x, z, yaw]) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = yaw;
    box(2.6, 0.14, 0.75, benchWood, g, 0, 0.55, 0);
    box(2.6, 0.6, 0.12, benchWood, g, 0, 0.95, -0.36);
    [-1.1, 1.1].forEach(dx => box(0.12, 0.55, 0.6, mat.mullion, g, dx, 0.27, 0));
    scene.add(g);
    g.updateMatrixWorld();
    return g;
  });
  const seatAt = (b, dx, fwd = 0) => new THREE.Vector3(dx, 0, fwd).applyMatrix4(b.matrixWorld);
  const seated = makeActor("#2b77a1", "#2d3a40");                 // stays the whole time
  seated.g.position.copy(seatAt(benches[0], -0.5)); seated.g.rotation.y = benches[0].rotation.y; pose(seated, 1);
  const arriving = makeActor("#f2c14e", "#3a4a5a"), leaving = makeActor("#e0703a", "#2b2f36");
  // Walk along waypoints by scroll progress; at the end turn to the bench and sit (or the reverse).
  const ARRIVE = [new THREE.Vector3(-RING - 6, 0, 22), new THREE.Vector3(-RING + 2, 0, 22), new THREE.Vector3(-13, 0, 22.2), seatAt(benches[2], 0.4, 1.1)];
  const LEAVE = [seatAt(benches[1], 0.3, 1.1), new THREE.Vector3(3, 0, 24.6), new THREE.Vector3(RING + 6, 0, 24.6), new THREE.Vector3(RING + 6, 0, RING + 20)];
  const seatArrive = seatAt(benches[2], 0.4), seatLeave = seatAt(benches[1], 0.3);
  const along = (pts, t) => {                       // point and heading at fraction t of a polyline
    const seg = pts.slice(1).map((p, i) => p.distanceTo(pts[i])), total = seg.reduce((x, y) => x + y, 0);
    let d = clamp(t, 0, 1) * total, i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const a = pts[i], b = pts[i + 1], k = seg[i] ? d / seg[i] : 0;
    return { p: a.clone().lerp(b, k), yaw: Math.atan2(b.x - a.x, b.z - a.z), dist: clamp(t, 0, 1) * total };
  }
  function moveActors(q) {
    // Arriving: walks in over q −1.8 → 0.8, then sits down by q = 1.2
    const w = smoothstep(q, -1.8, 0.8), s1 = smoothstep(q, 0.8, 1.2);
    const A = along(ARRIVE, w);
    arriving.g.position.copy(A.p).lerp(seatArrive, s1);
    arriving.g.rotation.y = s1 > 0 ? benches[2].rotation.y : A.yaw;
    pose(arriving, s1, w > 0 && w < 1 ? Math.abs(Math.sin(A.dist * 1.6)) * 0.08 : 0);
    // Leaving: gets up over q 1.6 → 2.0, then walks off over 2.0 → 4.2 and disappears round the corner
    const s2 = 1 - smoothstep(q, 1.6, 2.0), w2 = smoothstep(q, 2.0, 4.2);
    const L = along(LEAVE, w2);
    leaving.g.position.copy(seatLeave).lerp(L.p, 1 - s2);
    leaving.g.rotation.y = s2 > 0 ? benches[1].rotation.y : L.yaw;
    pose(leaving, s2, w2 > 0 && w2 < 1 ? Math.abs(Math.sin(L.dist * 1.6)) * 0.08 : 0);
    leaving.g.visible = w2 < 1;
  }
  // A dog out for a walk with its owner on the pavement round the plaza
  const dog = new THREE.Group(), fur = std({ color: 0xc58b4f }), furDark = std({ color: 0x7a5232 });
  box(1.05, 0.42, 0.42, fur, dog, 0, 0.62, 0);
  box(0.42, 0.38, 0.36, fur, dog, 0.62, 0.92, 0);
  box(0.2, 0.18, 0.22, furDark, dog, 0.88, 0.86, 0, false);
  [[-0.36, 0.15], [-0.36, -0.15], [0.36, 0.15], [0.36, -0.15]].forEach(([lx, lz]) => box(0.12, 0.42, 0.12, fur, dog, lx, 0.21, lz, false));
  const tail = new THREE.Group(); tail.position.set(-0.52, 0.8, 0); dog.add(tail);
  box(0.4, 0.09, 0.09, furDark, tail, -0.18, 0.08, 0, false);
  dog.scale.setScalar(1.3);
  const ownerA = makeActor("#2b77a1", "#2b2f36"), owner = ownerA.g;
  pose(ownerA, 0);
  scene.add(dog);
  // A plane crossing the distant sky as the page scrolls, leaving a faint contrail. It sits in a group that
  // turns about the vertical axis, so the plane and its trail ride one arc of radius 560 m.
  const flight = new THREE.Group(), plane = new THREE.Group(), planeMat = new THREE.MeshBasicMaterial({ color: 0xe9eef2, fog: false });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 12, 10), planeMat);
  fuselage.rotation.z = Math.PI / 2; plane.add(fuselage);
  plane.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 13), planeMat));
  const fin = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 0.25), planeMat); fin.position.set(-5.2, 1.4, 0); plane.add(fin);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b, fog: false }));
  beacon.position.set(0, -0.9, 0); plane.add(beacon);
  const FLY_R = 560, FLY_H = 150, TRAIL = 0.32;                      // trail length in radians of the arc
  plane.position.set(FLY_R, FLY_H, 0); plane.rotation.y = -Math.PI / 2;   // nose along +z, the way the arc runs
  const trailCurve = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => {
    const f = -TRAIL + (i / 12) * TRAIL;
    return new THREE.Vector3(Math.cos(f) * FLY_R, FLY_H, Math.sin(f) * FLY_R - 6);
  }));
  const trailMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.5 } },
    vertexShader: "varying float vU; void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float uOpacity; varying float vU; void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, uOpacity * pow(vU, 1.6)); }",
    transparent: true, depthWrite: false,
  });
  flight.add(plane, new THREE.Mesh(new THREE.TubeGeometry(trailCurve, 60, 0.7, 6, false), trailMat));
  scene.add(flight);
  const SKY_NIGHT = C("#1c2633");

  function livenStreet(q, time, nightAmt) {
    const t = time / 1000;
    signalSets.forEach(({ lamps, offset }) => {
      const p = (t + offset) % 12, state = p < 5 ? 2 : p < 6.5 ? 1 : 0;   // 0 red, 1 amber, 2 green
      lamps.forEach((l, k) => l.m.color.copy(k === state ? l.on : l.off));
    });
    const [ox, oz, yaw] = rectPath(0.12 + 0.03 * q, 26.4, 26.4);
    owner.position.set(ox, 0.05, oz); owner.rotation.y = yaw;
    const [dx, dz, dyaw] = rectPath(0.12 + 0.03 * q + 0.012, 27.4, 27.4);
    dog.position.set(dx, 0, dz); dog.rotation.y = dyaw;
    tail.rotation.y = Math.sin(t * 9) * 0.6;
    moveActors(q);
    flight.rotation.y = -(3.4 + clamp((q + 2) / 3, 0, 1) * 1.2);     // the plane crosses the sky as you scroll
    const away = smoothstep(q, -0.8, 0.3);                           // ...and flies off into the distance by Project 2.1
    plane.scale.setScalar(Math.max(0.001, 1 - away));
    plane.position.y = FLY_H + away * 40;
    flight.visible = away < 1;
    beacon.visible = (t % 1.2) < 0.15;
    planeMat.color.set(0xe9eef2).lerp(SKY_NIGHT, nightAmt);
    trailMat.uniforms.uOpacity.value = 0.5 * (1 - nightAmt * 0.7) * (1 - away);
  }

  // ---------- Camera path (keyframes at given q) ----------
  // Before q = −1 the camera holds the intro shot. `side` slides the aim sideways so the tower sits to
  // one side of the screen (positive: tower to the right); from q = 0 it stands in the middle. On phones
  // `side` is ignored and `drop` shifts the view the other way, lifting the subject above the card. Keys marked
  // `room` look down on a point, so on tall screens they back away along the view line instead of rising.
  const KEYS = [
    { q: -1, ang: 0.62, rad: 150, h: 18, ty: 30, side: 26 },     // the whole tower in frame beside the name
    { q: 0, ang: 0.62, rad: 128, h: 18, ty: 28 },
    { q: 1, ang: 0.95, rad: 140, h: 26, ty: 30 },        // pulled back while the facade is out, so the cards keep their room
    { q: 2, ang: 1.25, rad: 152, h: 28, ty: 32 },
    { q: 3, ang: 1.60, rad: 205, h: 46, ty: 48 },
    { q: 4, ang: 1.90, rad: 184, h: 32, ty: 43 },
    { q: 5, ang: 2.15, rad: 190, h: 38, ty: 45 },
    { q: 6, ang: 2.25, rad: 138, h: 30, ty: 28 },                       // closed back up
    { q: 7, ang: Math.PI / 2, rad: 7, h: 104, ty: 47.5, side: -11, drop: 9, room: true },   // ~85° bird's eye, the tower's top left of the card
  ];
  const lookTarget = new THREE.Vector3();
  let distScale = 1;
  const keyY = key => (key.room ? key.ty + (key.h - key.ty) * distScale : key.h * distScale);
  function placeCamera(q) {
    const k = clamp(q, KEYS[0].q, KEYS[KEYS.length - 1].q);
    let i = 0;
    while (i < KEYS.length - 2 && k > KEYS[i + 1].q) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = smoothstep(k, a.q, b.q);
    const ang = lerp(a.ang, b.ang, t), rad = lerp(a.rad, b.rad, t) * distScale;
    camera.position.set(Math.cos(ang) * rad, lerp(keyY(a), keyY(b), t), Math.sin(ang) * rad);
    const wide = camera.aspect > 1 ? 1 : 0;
    const side = lerp(a.side || 0, b.side || 0, t) * wide, drop = lerp(a.drop || 0, b.drop || 0, t) * (1 - wide) * distScale;
    const sx = -Math.sin(ang) * side + Math.cos(ang) * drop, sz = Math.cos(ang) * side + Math.sin(ang) * drop;
    lookTarget.set(sx, lerp(a.ty, b.ty, t), sz);
    // Orbit keys turn the camera to aim off-centre; looking down, the whole camera slides instead,
    // so the plan stays square to the screen.
    const slide = lerp(a.room ? 1 : 0, b.room ? 1 : 0, t);
    camera.position.x += sx * slide; camera.position.z += sz * slide;
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
  const sunScreen = new THREE.Vector3(), focusPt = new THREE.Vector3(), focusEdge = new THREE.Vector3();
  let flowSpeed = 0.12;

  function update(q, time, dt) {
    const whole = 1 - smoothstep(q, 5.15, 5.85);     // after the measurement step the tower closes back up
    const st = {
      adapt: smoothstep(q, 0.25, 1.0), wave: q * 2.2,
      explode: smoothstep(q, 1.2, 2.0) * whole, spread: smoothstep(q, 2.2, 3.0) * whole,
      // Airflow has the stage to itself in step 3, then fades out as the heating points come in.
      air: smoothstep(q, 2.4, 2.9) * (1 - smoothstep(q, 3.15, 3.4)),
      heat: smoothstep(q, 3.4, 3.65) * whole,
      rays: smoothstep(q, 0.45, 0.85) * (1 - smoothstep(q, 1.1, 1.35)),   // the facade step only; gone before the facade pulls away
      lamps: smoothstep(q, 3.25, 3.6) * whole, sense: smoothstep(q, 4.35, 4.9) * whole,
      roof: smoothstep(q, 6.0, 6.6),
    };
    const tgt = dataTargets(q);
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 8);
    for (const key in live) live[key] += (tgt[key] - live[key]) * k;

    // Time of day: sunrise from the first screen (the sun is already up on the intro and climbs as you scroll),
    // full day by the Project 2.1 introduction, golden hour from the measurement step.
    const day = lerp(0.35, 1, smoothstep(q, -2, 0)), dusk = smoothstep(q, 4.0, 4.85);
    nightfall = smoothstep(q, 6.0, 6.7);              // night for Project 2.2, so its lighting reads
    const dawn = 4 * day * (1 - day);
    const alt = q < 1.6 ? lerp(14, 46, smoothstep(q, -2, 1.6)) : lerp(46, 7, smoothstep(q, 3.7, 4.9));
    const az = lerp(245, 262, smoothstep(q, -1, 4.8));   // on the intro the sun sits between the name and the tower
    sunDir.set(Math.cos(degToRad(alt)) * Math.sin(degToRad(az)), Math.sin(degToRad(alt)), Math.cos(degToRad(alt)) * Math.cos(degToRad(az)));
    flatSun.set(sunDir.x, 0, sunDir.z).normalize();

    const skyTop = blend("skyTop", day, dusk), skyLow = blend("skyLow", day, dusk).clone().lerp(PAL.sunset.skyLow, dawn * 0.45);
    stage.style.setProperty("--sky-a", "#" + skyTop.getHexString());
    stage.style.setProperty("--sky-b", "#" + skyLow.getHexString());
    scene.fog.color.copy(skyLow);
    // Soft light: strong sky fill, gentle sun
    hemi.intensity = lerp(0.85, 0.95, day) * lerp(1, 0.85, dusk) * lerp(1, 0.5, nightfall);
    hemi.color.copy(blend("light", day, dusk)).lerp(new THREE.Color(0xffffff), 0.5);
    hemi.groundColor.set(0x5a6b4e);
    sunLight.intensity = lerp(0.5, 0.72, day) * lerp(1, 0.75, dusk) * (1 - nightfall * 0.85);
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
    const ctx = blend("context", day, dusk);
    // The city keeps a few lights on all day; they brighten in the golden hour and come fully on at night.
    const lit = Math.max(dusk * 0.6, nightfall);
    cityMats.forEach(m => { m.color.copy(ctx); m.emissiveIntensity = lerp(0.25, 0.85, lit); });
    nearMats.forEach(m => { m.color.copy(ctx); m.emissiveIntensity = Math.pow(lit, 1.6) * 0.75; });
    mat.brace.opacity = 0.35 + lit * 0.5;
    // The tower's windows glow a little in the golden hour and warmly at night.
    const glow = Math.max(dusk * 0.55, nightfall);

    sunDisc.visible = nightfall < 0.5;
    sunDisc.scale.setScalar(lerp(0.8, 1.6, dusk));
    mat.sun.color.set(0xffe7a8).lerp(new THREE.Color(0xff8a4a), dusk);
    sunLight.position.copy(sunDir).multiplyScalar(240);
    sunLight.target.position.set(0, 25, 0);
    sunDisc.position.copy(sunDir).multiplyScalar(520);
    shaftMat.opacity = day * (1 - dusk * 0.6) * (1 - nightfall) * smoothstep(day, 0.4, 0.9) * 0.11;
    shafts.forEach(m => {
      m.visible = shaftMat.opacity > 0.004;
      if (m.visible) { m.position.copy(m.userData.aim).addScaledVector(sunDir, 90); m.quaternion.setFromUnitVectors(UP, sunDir); }
    });

    floors.forEach((g, i) => { g.position.y = i * (FH + st.spread * GAP); });
    layoutFacade(st);
    layoutMullions(st.spread, st.roof);

    // Envelope: tint follows SHGC; rays show the sun striking the facade.
    const tint = norm(0.70 - live.shgc, 0, 0.40);
    const glassNow = blend("glass", day, dusk);
    mat.glass.color.copy(glassNow).lerp(glassNow.clone().multiplyScalar(0.45), tint);
    mat.glass.emissive.copy(WARM).multiplyScalar(glow * 1.1 * (1 - tint * 0.4));
    mat.glass.opacity = lerp(0.4, 0.62, tint);
    rays.visible = rayHeads.visible = st.rays > 0.01;
    if (rays.visible) layoutRays();
    rayMat.opacity = st.rays * lerp(0.15, 0.7, norm(live.shgc, 0.30, 0.70));
    rayHeadMat.opacity = Math.min(1, rayMat.opacity * 1.4);

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

    mat.lamp.opacity = Math.max(st.lamps * lerp(0.15, 0.95, norm(live.lpd, 0.39, 0.78)), nightfall * 0.7);   // offices lit at night

    const pulse = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 0.004);
    mat.sensor.opacity = st.sense;
    sensors.forEach((s, i) => { s.scale.setScalar(Math.max(0.001, st.sense * pulse * (i % 4 === 0 ? 1.15 : 1))); });

    moveTraffic(q, Math.max(dusk * 0.7, nightfall));
    livenStreet(q, time, nightfall);
    // Night life: lamps, the city's coloured light on the street, wet roads
    const lampsOn = Math.max(dusk * 0.5, nightfall);
    lampHeadMat.color.copy(LAMP_OFF).lerp(LAMP_ON, lampsOn);
    poolMat.opacity = 0.5 * lampsOn;
    neonLights.forEach(l => { l.intensity = 3.2 * nightfall; });
    mat.road.roughness = lerp(0.95, 0.4, nightfall); mat.road.metalness = lerp(0, 0.3, nightfall);

    // Project 3.2: the roof lifts away and the top floor shows the office
    top.roof.position.y = st.roof * 40;
    top.roof.visible = st.roof < 0.98;
    const inside = q > 6.02;
    top.inside.forEach(m => { m.visible = !inside; });
    room.visible = inside;
    if (inside) stepRoom(time);
    // Soft focus outside the lit room: centre and radius of the top floor on screen
    focusPt.set(0, top.g.position.y + Y0, 0).project(camera);
    focusEdge.set(W / 2 + 2, top.g.position.y + Y0, W / 2 + 2).project(camera);
    stage.style.setProperty("--focus", (smoothstep(q, 6.4, 6.9)).toFixed(3));
    stage.style.setProperty("--fx", ((focusPt.x + 1) * 50).toFixed(1) + "%");
    stage.style.setProperty("--fy", ((1 - focusPt.y) * 50).toFixed(1) + "%");
    stage.style.setProperty("--fr", Math.round(Math.hypot(focusEdge.x - focusPt.x, (focusEdge.y - focusPt.y) / camera.aspect) * canvas.clientWidth * 0.62) + "px");

    placeCamera(q);
    camera.updateMatrixWorld();
    sunScreen.copy(sunDisc.position).project(camera);
    const onScreen = sunScreen.z < 1;
    stage.style.setProperty("--day", (onScreen ? lerp(0.45, 0.8, day) * lerp(1, 0.9, dusk) * (1 - nightfall) : 0).toFixed(3));
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
    if (w > 720) camera.clearViewOffset();
    else camera.setViewOffset(w, h * 1.1, 0, h * 0.1, w, h);
    camera.updateProjectionMatrix();
    measureTower(w);
  }
  // How far the tower reaches either side of the screen centre through Project 3.1, at its widest
  // (facade pulled out, floors apart). The cards size themselves to the space left (--tower-half).
  const probe = new THREE.Vector3();
  function measureTower(w) {
    if (w <= 720) return;
    let m = 0;
    for (let q = 0; q <= 6; q += 0.25) {
      placeCamera(q);
      camera.updateMatrixWorld();
      const whole = 1 - smoothstep(q, 5.15, 5.85);
      const out = W / 2 + 1.5 + 10 * smoothstep(q, 1.2, 2.0) * whole, h = FLOORS * (FH + GAP * smoothstep(q, 2.2, 3.0) * whole) + 4;
      [[out, W / 2], [W / 2, out]].forEach(([a, b]) => [[a, b], [a, -b], [-a, b], [-a, -b]].forEach(([x, z]) =>
        [0, h / 2, h].forEach(y => { probe.set(x, y, z).project(camera); if (probe.z < 1) m = Math.max(m, Math.abs(probe.x)); })));
    }
    document.documentElement.style.setProperty("--tower-half", Math.round((m * w) / 2) + "px");
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
    current = reduceMotion ? target : current + (target - current) * (1 - Math.exp(-dt * 10));   // the scene keeps up closely with the scroll
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
