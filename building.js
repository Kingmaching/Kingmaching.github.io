// Scroll-driven 3D building for the hero.
// A tower on a green-roofed podium, wrapped in an adaptive louvre façade.
// Scroll progress q (0 → 5, one unit per story step, from story.js) drives:
//   0 → 1  louvres adapt to the sun
//   1 → 2  façade pulls away; glazing tint and solar rays follow the SHGC run
//   2 → 3  floors separate; airflow density follows the outdoor-air run
//   3 → 4  ceiling lights follow the lighting-power run
//   4 → 5  sensors switch on
// The core glows with the heating load of whichever run is on screen.
// The sky runs night → dawn → day (sun shafts for shading and envelope) → dusk → night,
// when the surrounding Hong Kong towers light up for the lighting step.
// The tower is illustrative; the numbers belong to the ME 572 models. Units are metres.

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

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { clamp, lerp, smoothstep, degToRad } = THREE.MathUtils;
  const D = S.DATA;

  const FLOORS = 14, FH = 3.6, W = 20;              // tower: 14 storeys, 20 m square
  const PODIUM_H = 8, PANELS = 9;                   // 9 louvres per side per floor
  const GAP = 2.4;                                  // extra space per floor when exploded

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xeef3f4, 170, 420);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 1000);

  // ---------- Materials (colours from CSS tokens) ----------
  const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05, ...o });
  const mat = {
    concrete: std(),
    core: std(),
    slab: std(),
    panel: std({ roughness: 0.45, metalness: 0.35 }),
    glass: std({ roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.38, depthWrite: false }),
    ground: std({ roughness: 1 }),
    context: std(),
    green: std({ roughness: 0.9 }),
    air: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    sensor: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    lamp: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    sun: new THREE.MeshBasicMaterial(),
  };
  const lineMat = new THREE.LineDashedMaterial({ dashSize: 1.6, gapSize: 1.1, transparent: true, opacity: 0 });
  const rayMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0 });
  const glassBase = new THREE.Color(), glassTint = new THREE.Color(), heatColor = new THREE.Color();
  const glassNow = new THREE.Color(), skyTop = new THREE.Color(), skyLow = new THREE.Color(), ctxColor = new THREE.Color();
  const sunScreen = new THREE.Vector3();
  const stage = canvas.parentElement;

  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  // Night colours come from CSS tokens; day colours are fixed here. update() blends them.
  const NIGHT = {}, DAY = {
    concrete: new THREE.Color("#959fa7"), slab: new THREE.Color("#c9ced2"), panel: new THREE.Color("#dfe2e0"),
    glass: new THREE.Color("#7fb0cc"), ground: new THREE.Color("#8d989b"), context: new THREE.Color("#a9b4bc"),
    green: new THREE.Color("#6f9e5c"),
  };
  const SKY = {
    nightTop: new THREE.Color("#05070b"), nightLow: new THREE.Color("#121b28"),
    dayTop: new THREE.Color("#2f78c9"), dayLow: new THREE.Color("#bfdcf0"), dusk: new THREE.Color("#f2995a"),
  };
  function applyTheme() {
    NIGHT.concrete = new THREE.Color(cssColor("--b-concrete", "#3b4552"));
    NIGHT.slab = new THREE.Color(cssColor("--b-slab", "#5b6776"));
    NIGHT.panel = new THREE.Color(cssColor("--b-panel", "#a3adb8"));
    NIGHT.glass = new THREE.Color(cssColor("--b-glass", "#ffcf86"));
    NIGHT.ground = new THREE.Color(cssColor("--b-ground", "#0c1118"));
    NIGHT.context = new THREE.Color(cssColor("--b-context", "#19222d"));
    NIGHT.green = new THREE.Color(cssColor("--b-green", "#2f5a3c"));
    glassBase.copy(NIGHT.glass);
    mat.air.color.set(cssColor("--c-cool", "#00869e"));
    lineMat.color.set(cssColor("--c-cool", "#00869e"));
    heatColor.set(cssColor("--c-heat", "#c96a0e"));
    rayMat.color.set(cssColor("--heat", "#d9822b"));
    mat.sensor.color.set(cssColor("--heat", "#d9822b"));
    mat.sun.color.set("#ffe7a8");
    mat.lamp.color.set(cssColor("--b-lamp", "#fff1c9"));
  }

  // Lit-window texture for the surrounding towers (mostly warm, a few cool and neon).
  function makeWindowTexture() {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, 64, 128);
    const tones = ["#ffd9a0", "#ffe9bf", "#fff4d6", "#ffd9a0", "#bfe8ff", "#ff7aa0"];
    for (let r = 0; r < 16; r++) for (let col = 0; col < 4; col++) {
      if (Math.random() < 0.52) { g.fillStyle = tones[Math.floor(Math.random() * tones.length)]; g.fillRect(4 + col * 15, 3 + r * 8, 10, 4); }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function box(w, h, d, material, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb4c0c6, 1.05);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xfff6e8, 1.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -80, right: 80, top: 110, bottom: -40, near: 20, far: 400 });
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight, sunLight.target);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), mat.sun);
  sunDisc.material.fog = false;
  scene.add(sunDisc);

  // ---------- Ground, context, podium ----------
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), mat.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Surrounding blocks, placed deterministically so the skyline never changes.
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const windowTex = makeWindowTexture();
  const cityMats = [], signs = [];
  const SIGN_COLOURS = ["#ff3d6e", "#2a9fd6", "#f5a623", "#ff3d6e", "#7cf0c8"];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + rand() * 0.12;
    const r = 55 + rand() * 125;
    const h = 14 + rand() * (r > 110 ? 85 : 45);
    const w = 9 + rand() * 10, d = 9 + rand() * 10;
    // Keep the camera's side of the site clear so nothing blocks the tower.
    if (a > 0.1 && a < 2.7) continue;
    const tex = windowTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 9)));
    const m = std({ emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    cityMats.push(m);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    box(w, h, d, m, scene, x, h / 2, z);
    if (rand() < 0.4) {                 // vertical neon sign facing the tower
      const sm = new THREE.MeshBasicMaterial({ color: SIGN_COLOURS[i % SIGN_COLOURS.length], transparent: true, opacity: 0 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7 + rand() * 5, 0.4), sm);
      const n = new THREE.Vector3(-x, 0, -z).normalize();
      sign.position.set(x + n.x * (Math.max(w, d) / 2 + 0.6), Math.min(h - 4, 10 + rand() * 12), z + n.z * (Math.max(w, d) / 2 + 0.6));
      sign.lookAt(0, sign.position.y, 0);
      scene.add(sign);
      signs.push(sm);
    }
  }

  // Sun shafts: open cones from the sun towards the tower, faded at both ends (additive blend).
  const shaftGeo = new THREE.CylinderGeometry(0.3, 6, 170, 20, 8, true);
  const sp = shaftGeo.attributes.position, cols = [];
  for (let i = 0; i < sp.count; i++) {
    const t = (sp.getY(i) + 85) / 170, f = Math.pow(Math.sin(Math.PI * t), 1.6);
    cols.push(1 * f, 0.8 * f, 0.45 * f);
  }
  shaftGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const shaftMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const shafts = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(shaftGeo, shaftMat);
    m.userData.aim = new THREE.Vector3((rand() - 0.5) * 34, 12 + rand() * 50, (rand() - 0.5) * 34);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  const UP = new THREE.Vector3(0, 1, 0);
  function layoutShafts() {
    shafts.forEach(m => {
      m.position.copy(m.userData.aim).addScaledVector(sunDir, 85);
      m.quaternion.setFromUnitVectors(UP, sunDir);
    });
  }

  box(36, PODIUM_H, 32, mat.concrete, scene, 0, PODIUM_H / 2, 0);
  box(36.4, 0.6, 32.4, mat.green, scene, 0, PODIUM_H + 0.3, 0);    // green roof
  const treeGeo = new THREE.SphereGeometry(1.6, 12, 10);
  [[-14, -11], [-9, 12], [13, -12], [15, 10], [-15, 4], [6, 13]].forEach(([x, z]) => {
    const t = new THREE.Mesh(treeGeo, mat.green);
    t.position.set(x, PODIUM_H + 1.9, z);
    t.castShadow = true;
    scene.add(t);
  });

  // ---------- Floors ----------
  const floors = [], airLines = [], risers = [], sensors = [];
  const sensorGeo = new THREE.SphereGeometry(0.45, 12, 10);
  const lampGeo = new THREE.PlaneGeometry(W - 2, W - 2);

  for (let i = 0; i < FLOORS; i++) {
    const g = new THREE.Group();
    scene.add(g);
    box(W + 0.8, 0.4, W + 0.8, mat.slab, g, 0, 0.2, 0);
    const glazing = box(W - 0.6, FH - 0.4, W - 0.6, mat.glass, g, 0, 0.4 + (FH - 0.4) / 2, 0);
    glazing.castShadow = false;
    box(6, FH - 0.4, 6, mat.core, g, 0, 0.4 + (FH - 0.4) / 2, 0);

    const lamp = new THREE.Mesh(lampGeo, mat.lamp);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.y = FH - 0.05;
    g.add(lamp);

    const riser = box(1.3, FH, 1.3, mat.air, g, 3.8, FH / 2, 3.8);
    riser.castShadow = false;
    risers.push(riser);

    [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]].forEach(([x, z]) => {
      const s = new THREE.Mesh(sensorGeo, mat.sensor);
      s.position.set(x, 1.6, z);
      s.scale.setScalar(0.001);
      g.add(s);
      sensors.push(s);
    });

    // Cross-ventilation streamlines on every third floor, windward (−x) to leeward (+x).
    if (i % 3 === 1) {
      [-5, 0, 5].forEach((z, k) => {
        const pts = [];
        for (let s = 0; s <= 24; s++) {
          const x = -30 + s * 2.5;
          pts.push(new THREE.Vector3(x, 1.9 + Math.sin(s * 0.5 + k) * 0.35, z + Math.sin(s * 0.3 + k * 2) * 1.6));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
        line.computeLineDistances();
        g.add(line);
        airLines.push(line);
      });
    }
    floors.push(g);
  }

  // ---------- Adaptive façade: one InstancedMesh of louvres ----------
  const SIDES = [
    { n: new THREE.Vector3(0, 0, 1), t: new THREE.Vector3(1, 0, 0), yaw: 0 },
    { n: new THREE.Vector3(1, 0, 0), t: new THREE.Vector3(0, 0, -1), yaw: Math.PI / 2 },
    { n: new THREE.Vector3(0, 0, -1), t: new THREE.Vector3(-1, 0, 0), yaw: Math.PI },
    { n: new THREE.Vector3(-1, 0, 0), t: new THREE.Vector3(0, 0, 1), yaw: -Math.PI / 2 },
  ];
  const louvres = new THREE.InstancedMesh(
    new THREE.BoxGeometry(W / PANELS - 0.15, FH - 0.6, 0.14),
    mat.panel,
    FLOORS * SIDES.length * PANELS
  );
  louvres.castShadow = louvres.receiveShadow = true;
  louvres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(louvres);

  const dummy = new THREE.Object3D();
  const sunDir = new THREE.Vector3();
  const flatSun = new THREE.Vector3();

  function layoutFacade(st) {
    let idx = 0;
    for (let f = 0; f < FLOORS; f++) {
      const baseY = floors[f].position.y + 0.4 + (FH - 0.4) / 2;
      // Floors peel off from the top down, a frame apart.
      const e = smoothstep(st.explode * 1.5 - (1 - f / FLOORS) * 0.5, 0, 1);
      const out = W / 2 + 0.9 + e * 10;
      SIDES.forEach((side, si) => {
        const sunFacing = Math.max(0, side.n.dot(flatSun));       // 1 = facing the sun
        for (let p = 0; p < PANELS; p++) {
          const along = -W / 2 + (p + 0.5) * (W / PANELS);
          const wave = 0.5 + 0.5 * Math.sin(p * 0.7 + f * 0.45 + si * 1.3 + st.wave);
          // Sunny sides close to shade; shaded sides open for air and view.
          const adaptive = (1 - 0.8 * sunFacing) * (0.45 + 0.55 * wave);
          const open = lerp(0.28, adaptive, st.adapt);
          dummy.position.copy(side.n).multiplyScalar(out).addScaledVector(side.t, along);
          dummy.position.y = baseY;
          dummy.rotation.set(0, side.yaw + open * degToRad(80), 0);
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

  // ---------- Camera path (one keyframe per step) ----------
  const KEYS = [
    { ang: 0.62, rad: 124, h: 22, ty: 30 },
    { ang: 0.95, rad: 116, h: 34, ty: 32 },
    { ang: 1.25, rad: 124, h: 30, ty: 34 },
    { ang: 1.60, rad: 172, h: 46, ty: 54 },
    { ang: 1.90, rad: 150, h: 34, ty: 50 },
    { ang: 2.15, rad: 160, h: 44, ty: 52 },
  ];
  const lookTarget = new THREE.Vector3();
  let distScale = 1;                                // pulled back on tall, narrow screens
  function placeCamera(q) {
    const i = Math.min(Math.floor(q), KEYS.length - 2);
    const t = smoothstep(q - i, 0, 1);
    const a = KEYS[i], b = KEYS[i + 1];
    const ang = lerp(a.ang, b.ang, t), rad = lerp(a.rad, b.rad, t) * distScale;
    camera.position.set(Math.cos(ang) * rad, lerp(a.h, b.h, t) * distScale, Math.sin(ang) * rad);
    lookTarget.set(0, lerp(a.ty, b.ty, t), 0);
    camera.lookAt(lookTarget);
  }

  // ---------- Data-driven targets for the current scroll position ----------
  const norm = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  function dataTargets(q) {
    const sh = D.shgc.runs[S.runIndex("shgc", q)];
    const vent = q < 2.5 ? D.vent.runs[D.vent.control] : D.vent.runs[S.runIndex("vent", q)];
    const lp = q < 3.5 ? D.lpd.runs[D.lpd.control] : D.lpd.runs[S.runIndex("lpd", q)];
    let heat = 0.25;
    if (q >= 1.5 && q < 2.5) heat = 0.15 + 0.75 * norm(sh.gas, 2902, 3393);
    else if (q >= 2.5 && q < 3.5) heat = 0.1 + 0.8 * norm(vent.heat, 183.2, 209.6);
    else if (q >= 3.5 && q < 4.5) heat = 0.1 + 0.8 * norm(lp.heat, 2.93, 4.42);
    return {
      shgc: q < 1.5 ? 0.70 : sh.x,
      cfm: vent.x,
      lpd: lp.x,
      heat: heat * smoothstep(q, 1.3, 1.6),
    };
  }

  // Smoothed versions of the stepped data values, so changes ease in over a few frames.
  const live = { shgc: 0.70, cfm: 20, lpd: 0.52, heat: 0 };

  function update(q, time, dt) {
    const st = {
      adapt: smoothstep(q, 0.25, 1.0),
      wave: q * 2.2,
      explode: smoothstep(q, 1.2, 2.0),
      spread: smoothstep(q, 2.2, 3.0),
      air: smoothstep(q, 2.4, 2.9),
      rays: smoothstep(q, 1.25, 1.6) * (1 - smoothstep(q, 2.4, 2.8)),
      lamps: smoothstep(q, 3.25, 3.6),
      sense: smoothstep(q, 4.35, 4.9),
    };
    const tgt = dataTargets(q);
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 8);
    for (const key in live) live[key] += (tgt[key] - live[key]) * k;

    // Sun climbs from low afternoon sun towards midday as the façade adapts.
    const alt = lerp(18, 48, smoothstep(q, 0, 1.6));
    const az = lerp(215, 250, smoothstep(q, 0, 1.6));
    sunDir.set(
      Math.cos(degToRad(alt)) * Math.sin(degToRad(az)),
      Math.sin(degToRad(alt)),
      Math.cos(degToRad(alt)) * Math.cos(degToRad(az))
    );
    flatSun.set(sunDir.x, 0, sunDir.z).normalize();

    // Daylight: dawn during step 0→1, full day for shading and envelope, dusk into the lighting step.
    const day = smoothstep(q, 0.3, 1.0) * (1 - smoothstep(q, 2.5, 3.35));
    const night = 1 - day, warm = 4 * day * (1 - day);
    skyTop.copy(SKY.nightTop).lerp(SKY.dayTop, day);
    skyLow.copy(SKY.nightLow).lerp(SKY.dayLow, day).lerp(SKY.dusk, warm * 0.75);
    stage.style.setProperty("--sky-a", "#" + skyTop.getHexString());
    stage.style.setProperty("--sky-b", "#" + skyLow.getHexString());
    scene.fog.color.copy(skyLow);
    hemi.intensity = lerp(0.5, 0.95, day);
    hemi.groundColor.set(day > 0.5 ? 0xb4c0c6 : 0x2a3344);
    sunLight.intensity = lerp(0.22, 1.1, day);
    sunLight.color.set(0x8fa3c8).lerp(new THREE.Color(0xfff1d8), day);
    ["concrete", "slab", "panel", "ground", "green"].forEach(k => mat[k].color.copy(NIGHT[k]).lerp(DAY[k], day));
    mat.core.color.copy(mat.concrete.color);
    ctxColor.copy(NIGHT.context).lerp(DAY.context, day);
    cityMats.forEach(m => { m.color.copy(ctxColor); m.emissiveIntensity = Math.pow(night, 1.5) * 1.15; });
    signs.forEach(m => { m.opacity = smoothstep(night, 0.6, 1); });
    sunDisc.visible = day > 0.02;
    sunDisc.scale.setScalar(0.6 + day);
    shaftMat.opacity = day * smoothstep(q, 0.45, 1.0) * (1 - smoothstep(q, 2.3, 2.8)) * 0.55;
    if (shaftMat.opacity > 0.005) layoutShafts();
    shafts.forEach(m => { m.visible = shaftMat.opacity > 0.005; });
    sunLight.position.copy(sunDir).multiplyScalar(220);
    sunLight.target.position.set(0, 25, 0);
    sunDisc.position.copy(sunDir).multiplyScalar(330);

    floors.forEach((g, i) => { g.position.y = PODIUM_H + i * (FH + st.spread * GAP); });
    layoutFacade(st);

    // Envelope: tint follows SHGC, rays carry the transmitted solar gain.
    const tint = norm(0.70 - live.shgc, 0, 0.40);
    glassNow.copy(DAY.glass).lerp(glassBase, night);
    glassTint.copy(glassNow).multiplyScalar(0.45);
    mat.glass.color.copy(glassNow).lerp(glassTint, tint);
    mat.glass.emissive.copy(glassBase).multiplyScalar(night * 0.35 * (1 - tint * 0.5));
    mat.glass.opacity = lerp(0.36, 0.6, tint);
    rays.visible = st.rays > 0.01;
    if (rays.visible) layoutRays();
    rayMat.opacity = st.rays * lerp(0.2, 0.95, norm(live.shgc, 0.30, 0.70));

    // Heating load glows in the core.
    mat.core.emissive.copy(heatColor).multiplyScalar(live.heat * 0.9);

    // Air: streamline density and speed follow outdoor air.
    const airAmt = norm(live.cfm, 10, 30);
    mat.air.opacity = st.air * 0.85;
    lineMat.opacity = st.air * lerp(0.3, 1, airAmt);
    risers.forEach(r => { r.visible = st.air > 0.01; });
    airLines.forEach(l => { l.visible = st.air > 0.01; });
    flowSpeed = lerp(2.5, 9, airAmt);

    // Lighting: ceiling panels brighten with lighting power density.
    mat.lamp.opacity = st.lamps * lerp(0.15, 0.95, norm(live.lpd, 0.39, 0.78));

    const pulse = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 0.004);
    mat.sensor.opacity = st.sense;
    sensors.forEach((s, i) => { s.scale.setScalar(Math.max(0.001, st.sense * pulse * (i % 4 === 0 ? 1.15 : 1))); });

    placeCamera(q);

    // Glare follows the sun on screen.
    camera.updateMatrixWorld();
    sunScreen.copy(sunDisc.position).project(camera);
    const onScreen = sunScreen.z < 1;
    stage.style.setProperty("--day", (onScreen ? day : 0).toFixed(3));
    stage.style.setProperty("--sx", clamp((sunScreen.x + 1) * 50, 4, 96).toFixed(1) + "%");
    stage.style.setProperty("--sy", clamp((1 - sunScreen.y) * 50, -10, 70).toFixed(1) + "%");
  }

  // ---------- Size and framing ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    distScale = camera.aspect < 1 ? 2.1 : 1;
    scene.fog.near = 170 * distScale;
    scene.fog.far = 420 * distScale;
    // Push the building right of the captions on wide screens; centre it on phones.
    if (w > 720) camera.setViewOffset(w * 1.5, h, 0, 0, w, h);
    else camera.setViewOffset(w, h * 1.1, 0, h * 0.1, w, h);
    camera.updateProjectionMatrix();
  }

  // ---------- Loop ----------
  let current = S.progress(), running = false, last = performance.now(), flowOffset = 0, flowSpeed = 6;

  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const target = S.progress();
    current = reduceMotion ? target : current + (target - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - current) < 0.0005) current = target;

    update(current, now, dt);
    // Slide the dashed streamlines by less than one dash period so the air appears to flow.
    if (!reduceMotion) flowOffset += dt * flowSpeed;
    const shift = (flowOffset % 2.7) - 1.35;
    airLines.forEach(l => { l.position.x = shift; });
    renderer.render(scene, camera);
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
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // First frame, drawn immediately at the current scroll position.
  applyTheme();
  resize();
  Object.assign(live, dataTargets(current));
  update(current, performance.now(), 0);
  renderer.render(scene, camera);
  start();
})();
