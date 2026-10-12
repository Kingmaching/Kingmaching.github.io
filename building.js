// Scroll-driven 3D building for the hero.
// A tower on a green-roofed podium, wrapped in an adaptive louvre façade.
// Scroll progress through the story (0 → 4, one unit per step) drives:
//   0 → 1  louvres adapt to the sun
//   1 → 2  façade pulls away from the glazing; glazing tint deepens (SHGC 0.70 → 0.30)
//   2 → 3  floors separate; airflow and HVAC risers appear
//   3 → 4  sensors switch on
// Units are metres.

(function () {
  const canvas = document.getElementById("building-canvas");
  const story = document.getElementById("story");
  if (!canvas || !story) return;
  if (!window.THREE) { canvas.hidden = true; return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    canvas.hidden = true;
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { clamp, lerp, smoothstep, degToRad, radToDeg } = THREE.MathUtils;

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
    slab: std(),
    panel: std({ roughness: 0.45, metalness: 0.35 }),
    glass: std({ roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.38, depthWrite: false }),
    ground: std({ roughness: 1 }),
    context: std(),
    green: std({ roughness: 0.9 }),
    air: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    sensor: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    sun: new THREE.MeshBasicMaterial(),
  };
  const lineMat = new THREE.LineDashedMaterial({ dashSize: 1.6, gapSize: 1.1, transparent: true, opacity: 0 });
  const glassBase = new THREE.Color();
  const glassTint = new THREE.Color();

  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function applyTheme() {
    mat.concrete.color.set(cssColor("--b-concrete", "#c9ced0"));
    mat.slab.color.set(cssColor("--b-slab", "#e9ecec"));
    mat.panel.color.set(cssColor("--b-panel", "#f4f5f2"));
    glassBase.set(cssColor("--b-glass", "#7fb3c4"));
    glassTint.copy(glassBase).multiplyScalar(0.45);
    mat.ground.color.set(cssColor("--b-ground", "#dde6e8"));
    mat.context.color.set(cssColor("--b-context", "#cfd8db"));
    mat.green.color.set(cssColor("--b-green", "#8fb07a"));
    mat.air.color.set(cssColor("--air", "#0e7a80"));
    lineMat.color.set(cssColor("--air", "#0e7a80"));
    mat.sensor.color.set(cssColor("--heat", "#d9822b"));
    mat.sun.color.set(cssColor("--heat", "#d9822b"));
    scene.fog.color.set(cssColor("--sky-low", "#eef3f4"));
    dirty = true;
  }

  function box(w, h, d, material, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb4c0c6, 1.05));
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
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rand() * 0.2;
    const r = 52 + rand() * 60;
    const h = 8 + rand() * 34;
    // Keep the camera's side of the site clear so nothing blocks the tower.
    if (a > 0.1 && a < 2.5) continue;
    box(10 + rand() * 12, h, 10 + rand() * 12, mat.context, scene, Math.cos(a) * r, h / 2, Math.sin(a) * r);
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
  const floors = [];
  const airLines = [];
  const risers = [];
  const sensors = [];
  const sensorGeo = new THREE.SphereGeometry(0.45, 12, 10);

  for (let i = 0; i < FLOORS; i++) {
    const g = new THREE.Group();
    scene.add(g);
    box(W + 0.8, 0.4, W + 0.8, mat.slab, g, 0, 0.2, 0);
    const glazing = box(W - 0.6, FH - 0.4, W - 0.6, mat.glass, g, 0, 0.4 + (FH - 0.4) / 2, 0);
    glazing.castShadow = false;
    box(6, FH - 0.4, 6, mat.concrete, g, 0, 0.4 + (FH - 0.4) / 2, 0);

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
  const panelW = W / PANELS - 0.15;
  const louvres = new THREE.InstancedMesh(
    new THREE.BoxGeometry(panelW, FH - 0.6, 0.14),
    mat.panel,
    FLOORS * SIDES.length * PANELS
  );
  louvres.castShadow = louvres.receiveShadow = true;
  louvres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(louvres);

  const dummy = new THREE.Object3D();
  const sunDir = new THREE.Vector3();
  let avgOpen = 0;

  function layoutFacade(st) {
    let idx = 0, openSum = 0;
    const flatSun = new THREE.Vector3(sunDir.x, 0, sunDir.z).normalize();
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
          openSum += open;
          dummy.position.copy(side.n).multiplyScalar(out).addScaledVector(side.t, along);
          dummy.position.y = baseY;
          dummy.rotation.set(0, side.yaw + open * degToRad(80), 0);
          dummy.updateMatrix();
          louvres.setMatrixAt(idx++, dummy.matrix);
        }
      });
    }
    louvres.instanceMatrix.needsUpdate = true;
    avgOpen = openSum / idx;
  }

  // ---------- Camera path (one keyframe per step) ----------
  const KEYS = [
    { ang: 0.62, rad: 124, h: 22, ty: 30 },
    { ang: 0.95, rad: 116, h: 34, ty: 32 },
    { ang: 1.30, rad: 128, h: 30, ty: 34 },
    { ang: 1.62, rad: 172, h: 46, ty: 54 },
    { ang: 1.95, rad: 150, h: 40, ty: 52 },
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

  // ---------- Scene state from progress ----------
  const roOpen = document.getElementById("ro-open");
  const roSun = document.getElementById("ro-sun");
  const roShgc = document.getElementById("ro-shgc");

  function setText(el, value) { if (el && el.textContent !== value) el.textContent = value; }

  function update(q, time) {
    const st = {
      adapt: smoothstep(q, 0.25, 1.0),
      wave: q * 2.2,
      explode: smoothstep(q, 1.2, 2.1),
      shgc: smoothstep(q, 1.4, 2.1),
      spread: smoothstep(q, 2.2, 3.05),
      air: smoothstep(q, 2.45, 3.05),
      sense: smoothstep(q, 3.25, 3.9),
    };

    // Sun climbs from low afternoon sun to midday-ish as the façade adapts.
    const alt = lerp(18, 48, smoothstep(q, 0, 1.6));
    const az = lerp(215, 250, smoothstep(q, 0, 1.6));
    sunDir.set(
      Math.cos(degToRad(alt)) * Math.sin(degToRad(az)),
      Math.sin(degToRad(alt)),
      Math.cos(degToRad(alt)) * Math.cos(degToRad(az))
    );
    sunLight.position.copy(sunDir).multiplyScalar(220);
    sunLight.target.position.set(0, 25, 0);
    sunDisc.position.copy(sunDir).multiplyScalar(330);

    floors.forEach((g, i) => { g.position.y = PODIUM_H + i * (FH + st.spread * GAP); });
    layoutFacade(st);

    mat.glass.color.copy(glassBase).lerp(glassTint, st.shgc);
    mat.glass.opacity = lerp(0.36, 0.6, st.shgc);

    mat.air.opacity = st.air * 0.85;
    lineMat.opacity = st.air;
    risers.forEach(r => { r.visible = st.air > 0.01; });
    airLines.forEach(l => { l.visible = st.air > 0.01; });

    const pulse = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 0.004);
    mat.sensor.opacity = st.sense;
    sensors.forEach((s, i) => { s.scale.setScalar(Math.max(0.001, st.sense * pulse * (i % 4 === 0 ? 1.15 : 1))); });

    placeCamera(q);

    setText(roOpen, Math.round(avgOpen * 100) + "%");
    setText(roSun, Math.round(alt) + "°");
    setText(roShgc, lerp(0.70, 0.30, st.shgc).toFixed(2));
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
    // Push the building right of the captions on wide screens, up above them on phones.
    if (w > 720) camera.setViewOffset(w * 1.5, h, 0, 0, w, h);
    else camera.setViewOffset(w, h * 1.3, 0, h * 0.3, w, h);
    camera.updateProjectionMatrix();
    dirty = true;
  }

  // ---------- Loop ----------
  let target = 0, current = 0, dirty = true, running = false, last = performance.now(), flowOffset = 0;

  function readScroll() {
    const rect = story.getBoundingClientRect();
    const range = rect.height - window.innerHeight;
    target = range > 0 ? clamp(-rect.top / range, 0, 1) * (KEYS.length - 1) : 0;
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    current = reduceMotion ? target : current + (target - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - current) < 0.0005) current = target;

    update(current, now);
    // Slide the dashed streamlines by less than one dash period so the air appears to flow.
    if (!reduceMotion) flowOffset += dt * 6;
    const shift = (flowOffset % 2.7) - 1.35;
    airLines.forEach(l => { l.position.x = shift; });
    renderer.render(scene, camera);
    dirty = false;
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
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", readScroll);
  new ResizeObserver(resize).observe(canvas);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // First frame, drawn immediately at the current scroll position.
  applyTheme();
  readScroll();
  current = target;
  resize();
  update(current, performance.now());
  renderer.render(scene, camera);
  start();
})();
