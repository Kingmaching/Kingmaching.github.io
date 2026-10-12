// Interactive 5-DOF robot arm for the hero.
// Units are centimetres, sized to the robotic crane's 51 cm reach:
// upper arm 24 + forearm 20 + wrist and gripper 7.
// The arm solves a two-link inverse kinematics problem each frame so
// the gripper points straight down at the target on the floor.

(function () {
  const canvas = document.getElementById("arm-canvas");
  const cell = document.getElementById("cell");
  if (!canvas || !cell) return;

  function showFallback() {
    canvas.hidden = true;
    cell.querySelector(".cell-fallback").hidden = false;
    cell.querySelector(".cell-hud").hidden = true;
  }

  if (!window.THREE) { showFallback(); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    showFallback();
    return;
  }

  const L1 = 24, L2 = 20, L3 = 7;
  const SHOULDER_Y = 15;
  const REACH = L1 + L2 + L3;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 1, 600);
  camera.position.set(84, 44, 58);
  const lookAt = new THREE.Vector3(-2, 14, 8);
  camera.lookAt(lookAt);

  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(30, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 200 });
  scene.add(sun);

  // Materials (colours come from CSS tokens, see applyTheme)
  const mat = {
    body: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 }),
    joint: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.15 }),
    base: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.2 }),
    line: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 }),
    target: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  };

  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function jointCylinder(radius, width, parent) {
    const m = mesh(new THREE.CylinderGeometry(radius, radius, width, 32), mat.joint, parent);
    m.rotation.z = Math.PI / 2; // axis along X, the pitch axis
    return m;
  }

  // Floor: shadow catcher, grid and reach circle
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.ShadowMaterial({ opacity: 0.16 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  let grid = null;
  function buildGrid(color) {
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
    grid = new THREE.GridHelper(120, 24, color, color);
    grid.position.y = 0.02;
    scene.add(grid);
  }

  const reachRing = new THREE.Mesh(new THREE.RingGeometry(REACH - 0.35, REACH, 160), mat.line);
  reachRing.rotation.x = -Math.PI / 2;
  reachRing.position.y = 0.05;
  scene.add(reachRing);

  const marker = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.4, 40), mat.target);
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.08;
  scene.add(marker);

  // Arm hierarchy
  const pedestal = mesh(new THREE.CylinderGeometry(9, 10, 6, 48), mat.base, scene, 0, 3, 0);
  pedestal.receiveShadow = true;

  const turntable = new THREE.Group();          // J1, yaw
  turntable.position.y = 6;
  scene.add(turntable);
  mesh(new THREE.CylinderGeometry(7, 7, 3, 48), mat.joint, turntable, 0, 1.5, 0);
  mesh(new THREE.BoxGeometry(1.6, 8, 6), mat.base, turntable, -3.4, 7, 0);
  mesh(new THREE.BoxGeometry(1.6, 8, 6), mat.base, turntable, 3.4, 7, 0);

  const shoulder = new THREE.Group();           // J2, pitch
  shoulder.position.y = SHOULDER_Y - 6;
  turntable.add(shoulder);
  jointCylinder(2.8, 5.2, shoulder);
  mesh(new THREE.BoxGeometry(4.2, L1, 4.2), mat.body, shoulder, 0, L1 / 2, 0);

  const elbow = new THREE.Group();              // J3, pitch
  elbow.position.y = L1;
  shoulder.add(elbow);
  jointCylinder(2.5, 5.6, elbow);
  mesh(new THREE.BoxGeometry(3.4, L2, 3.4), mat.body, elbow, 0, L2 / 2, 0);

  const wrist = new THREE.Group();              // J4, pitch
  wrist.position.y = L2;
  elbow.add(wrist);
  jointCylinder(1.9, 4.4, wrist);

  const roll = new THREE.Group();               // J5, roll
  wrist.add(roll);
  mesh(new THREE.CylinderGeometry(1.5, 1.5, 3, 24), mat.base, roll, 0, 1.5, 0);
  mesh(new THREE.BoxGeometry(6, 1, 2.2), mat.joint, roll, 0, 3.5, 0);
  const fingerGeo = new THREE.BoxGeometry(0.8, 3.5, 1.8);
  const fingerL = mesh(fingerGeo, mat.body, roll, -2.4, 5.75, 0);
  const fingerR = mesh(fingerGeo, mat.body, roll, 2.4, 5.75, 0);

  // Theme
  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function applyTheme() {
    mat.body.color.set(cssColor("--arm-body", "#f3f4f6"));
    mat.base.color.set(cssColor("--arm-base", "#2b3546"));
    mat.joint.color.set(cssColor("--signal", "#f2b705"));
    mat.target.color.set(cssColor("--signal", "#f2b705"));
    mat.line.color.set(cssColor("--muted", "#546175"));
    buildGrid(new THREE.Color(cssColor("--arm-grid", "#b7c0cc")));
    needsRender = true;
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Kinematics
  const target = new THREE.Vector3(-14, 0, 30);
  const goal = { j1: 0, a1: 0, a2: 0, a3: 0, j5: 0 };
  const pose = { j1: 0, a1: 0, a2: 0, a3: 0, j5: 0 };
  let phi1 = 0;
  let grip = 0, gripGoal = 0;

  function solve(t) {
    const r = THREE.MathUtils.clamp(Math.hypot(t.x, t.z), 11, 42);
    goal.j1 = Math.atan2(t.x, t.z);

    // Wrist pivot sits L3 above the fingertip, which stops 1 cm off the floor.
    const dx = r, dy = 1 + L3 - SHOULDER_Y;
    let d = Math.hypot(dx, dy);
    d = THREE.MathUtils.clamp(d, 8, L1 + L2 - 0.5);
    const a = Math.atan2(dy, dx);
    const cosB = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    const b = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1));

    const p1 = a + b;                                   // upper arm elevation
    const ex = L1 * Math.cos(p1), ey = L1 * Math.sin(p1);
    const wx = d * Math.cos(a), wy = d * Math.sin(a);
    const p2 = Math.atan2(wy - ey, wx - ex);            // forearm elevation

    const abs1 = Math.PI / 2 - p1;
    const abs2 = Math.PI / 2 - p2;
    goal.a1 = abs1;
    goal.a2 = abs2 - abs1;
    goal.a3 = Math.PI - abs2;                           // gripper points down
    goal.j5 = wrap(-goal.j1);                                 // keep fingers square to the world
    phi1 = p1;
  }

  function approach(cur, next, k) { return cur + (next - cur) * k; }
  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function approachAngle(cur, next, k) {
    return wrap(cur + wrap(next - cur) * k);
  }

  function applyPose() {
    turntable.rotation.y = pose.j1;
    shoulder.rotation.x = pose.a1;
    elbow.rotation.x = pose.a2;
    wrist.rotation.x = pose.a3;
    roll.rotation.y = pose.j5;
    const gap = 2.4 - grip * 1.5;
    fingerL.position.x = -gap;
    fingerR.position.x = gap;
  }

  // HUD
  const hud = [...document.querySelectorAll("#hud dd")];
  function deg(rad) {
    const v = Math.round(THREE.MathUtils.radToDeg(rad));
    return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + "°";
  }
  function updateHud() {
    const shoulderPitch = Math.PI / 2 - pose.a1;
    const vals = [pose.j1, shoulderPitch, pose.a2, pose.a3, pose.j5];
    hud.forEach((el, i) => { el.textContent = deg(vals[i]); });
  }

  // Pointer input: a ray from the camera onto the floor plane.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  let lastInput = -Infinity;

  function aimAt(event) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(floorPlane, hit)) {
      const r = Math.hypot(hit.x, hit.z);
      const clamped = THREE.MathUtils.clamp(r, 11, 42);
      if (r > 0) hit.multiplyScalar(clamped / r);
      target.set(hit.x, 0, hit.z);
      lastInput = performance.now();
      needsRender = true;
    }
  }

  canvas.addEventListener("pointermove", e => { if (e.pointerType === "mouse") aimAt(e); });
  canvas.addEventListener("pointerdown", e => {
    aimAt(e);
    gripGoal = gripGoal ? 0 : 1;
  });

  // Size
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull back on narrow, tall cells so the whole reach circle fits.
    camera.position.set(84, 44, 58).multiplyScalar(camera.aspect < 1.1 ? 1.18 : 1);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  new ResizeObserver(resize).observe(canvas);

  // Loop: only runs while the cell is on screen.
  let visible = true, needsRender = true, last = performance.now(), frame = 0;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { last = performance.now(); requestAnimationFrame(tick); }
  }).observe(cell);

  function idleTarget(t) {
    target.set(30 * Math.sin(t * 0.00037), 0, 22 + 12 * Math.sin(t * 0.00053 + 1));
  }

  function tick(now) {
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (!reduceMotion && now - lastInput > 2500) idleTarget(now);
    solve(target);

    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 5);
    pose.j1 = approachAngle(pose.j1, goal.j1, k);
    pose.a1 = approach(pose.a1, goal.a1, k);
    pose.a2 = approach(pose.a2, goal.a2, k);
    pose.a3 = approach(pose.a3, goal.a3, k);
    pose.j5 = approachAngle(pose.j5, goal.j5, k);
    grip = approach(grip, gripGoal, reduceMotion ? 1 : 1 - Math.exp(-dt * 10));
    applyPose();

    marker.position.x = target.x;
    marker.position.z = target.z;

    if (frame++ % 4 === 0) updateHud();
    renderer.render(scene, camera);
    needsRender = false;
    requestAnimationFrame(tick);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && visible) { last = performance.now(); requestAnimationFrame(tick); }
  });

  // First frame: settle straight into the starting pose.
  applyTheme();
  solve(target);
  Object.assign(pose, goal);
  applyPose();
  updateHud();
  resize();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
})();
