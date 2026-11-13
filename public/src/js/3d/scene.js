/* NEXORA — simulador 3D (Three.js r128): veículos, volumes, animações, seleção e edição manual */
'use strict';
let renderer, scene, camera, controls, meshes = new Map(), vehGroups = [], doorObjs = [], wallMats = [], voidGroup = null, brand = [];
let doorsOpen = false, sel = null, anim = null, wallMode = 'trans', showVoid = false, paused = false, last = performance.now();
let hist = [], redo = [];
const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
raycaster.params.Line.threshold = 0.001; raycaster.params.Points.threshold = 0.001; /* só superfícies sólidas contam no clique */
const GAPW = 0.9; /* folga entre vagões do rodotrem */
const floorOf = v => ({ 'Van': 0.55, 'Iveco baú': 0.95, '3/4': 1.05, 'Truck': 1.2, 'Container': 1.42 }[v.cat] || 1.25);
const wheelR = v => ({ 'Van': 0.34, 'Iveco baú': 0.38, '3/4': 0.45 }[v.cat] || 0.5);
const wagonX = (v, g) => g * (v.L + GAPW);
const MAT = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .6, metalness: .1, ...o })); };
function boxM(w, h, d, m) { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.castShadow = x.receiveShadow = true; return x; }

function initThree() {
  const el = $('#cv');
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  el.appendChild(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x172548); scene.fog = new THREE.Fog(0x172548, 70, 170);
  camera = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
  controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.addEventListener('change', () => invalidate(false)); controls.maxPolarAngle = Math.PI * 0.495;
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a2440, 0.75));
  const d = new THREE.DirectionalLight(0xffffff, 0.85); d.position.set(15, 30, 20); d.castShadow = true; d.shadow.mapSize.set(1024, 1024);
  Object.assign(d.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 120 }); scene.add(d);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x1a2a52, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  const grid = new THREE.GridHelper(200, 100, 0x223a6e, 0x1d3060); grid.position.y = 0.01; scene.add(grid);
  camera.position.set(-14, 10, 16); controls.target.set(6, 1.5, 0);
  new ResizeObserver(resize).observe(el); resize(); bindPointer(); loop();
}
function resize() { if (!renderer) return; const el = $('#cv'); const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

/* ---------------- texturas ---------------- */
const TEX = {};
function canvasTex(key, draw, size = 256) {
  if (TEX[key]) return TEX[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return (TEX[key] = t);
}
const noise = (x, n, a) => { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * a})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } };
const carton = () => canvasTex('carton', x => {
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); noise(x, 900, .05);
  x.strokeStyle = 'rgba(60,30,0,.28)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
  for (let r = 0; r < 4; r++) for (let i = 0; i <= 3; i++) { const o = (r % 2) * 42; x.beginPath(); x.moveTo(o + i * 85, r * 64); x.lineTo(o + i * 85, r * 64 + 64); x.stroke(); }
});
const boxTex = () => canvasTex('box', x => { x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); noise(x, 600, .05); x.fillStyle = 'rgba(120,80,30,.35)'; x.fillRect(112, 0, 32, 256); x.strokeStyle = 'rgba(60,30,0,.4)'; x.lineWidth = 4; x.strokeRect(2, 2, 252, 252); });
const fabric = () => canvasTex('fabric', x => { x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 256; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); } x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, 118, 256, 20); });
const crate = () => canvasTex('crate', x => { x.fillStyle = '#c99a5b'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#b98a4b' : '#d4a768'; x.fillRect(0, i * 64 + 4, 256, 56); } noise(x, 1200, .08); x.fillStyle = '#7a5a2e'; x.fillRect(0, 0, 18, 256); x.fillRect(238, 0, 18, 256); x.fillRect(0, 0, 256, 14); x.fillRect(0, 242, 256, 14); });
const ribs = () => canvasTex('ribs', x => { const g = x.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, '#dfe6ef'); g.addColorStop(.5, '#ffffff'); g.addColorStop(1, '#c7d0dc'); for (let i = 0; i < 256; i += 32) { x.fillStyle = g; x.save(); x.translate(i, 0); x.fillRect(0, 0, 32, 256); x.restore(); } });
const corrug = () => canvasTex('corr', x => { for (let i = 0; i < 256; i += 16) { x.fillStyle = '#fff'; x.fillRect(i, 0, 8, 256); x.fillStyle = '#bdbdbd'; x.fillRect(i + 8, 0, 8, 256); } });

/* ---------------- peças do veículo ---------------- */
/* ---------- peças realistas ---------- */
const TIRE = () => mat(0x16181d, { roughness: .92 }), RIM = () => mat(0xdfe4ea, { metalness: .75, roughness: .25 }), CHR = () => mat(0xc9d0d8, { metalness: .9, roughness: .18 });
const PAINT = () => mat(0xf5f7fa, { roughness: .28, metalness: .2 }), DARK = () => mat(0x1b2029, { roughness: .65 }), GLASS = () => mat(0x0b1424, { roughness: .05, metalness: .85 });
function tire(r, wdt) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.03, r - 0.03, wdt, 28), TIRE()); body.rotation.x = Math.PI / 2; body.castShadow = true; g.add(body);
  for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r - 0.07, 0.07, 10, 28), TIRE()); t.position.z = s * (wdt / 2 - 0.05); g.add(t); }
  return g;
}
function wheel(x, z, r = 0.5, dual = false) {
  const g = new THREE.Group(), w = r > 0.4 ? 0.3 : 0.24, out = z >= 0 ? 1 : -1;
  const t1 = tire(r, w); g.add(t1);
  if (dual) { const t2 = tire(r, w); t2.position.z = -out * (w + 0.03); g.add(t2); }
  const rimD = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, 0.04, 24), RIM()); rimD.rotation.x = Math.PI / 2; rimD.position.z = out * (w / 2 + 0.005); g.add(rimD);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.5, 0.02, 6, 24), CHR()); ring.position.z = out * (w / 2 + 0.03); g.add(ring);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.17, r * 0.2, 0.12, 12), CHR()); hub.rotation.x = Math.PI / 2; hub.position.z = out * (w / 2 + 0.05); g.add(hub);
  g.position.set(x, r, z); return g;
}
/* perfil lateral extrudado na largura: pts = [[x,y],...] (frente em -x) */
function profile(pts, width, m, curves) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) sh.quadraticCurveTo(p[2], p[3], p[0], p[1]); else sh.lineTo(p[0], p[1]); }
  sh.closePath();
  const bev = Math.min(0.08, width * 0.04);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: width - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 12 });
  geo.translate(0, 0, -(width - 2 * bev) / 2); const me = new THREE.Mesh(geo, m); me.castShadow = me.receiveShadow = true; return me;
}
/* vidro inclinado entre dois pontos do perfil */
function slantGlass(a, b, width, off = 0.03) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const g = boxM(0.03, len * 0.92, width, GLASS()); g.position.set((a[0] + b[0]) / 2 - off, (a[1] + b[1]) / 2, 0); g.rotation.z = Math.atan2(dx, dy) * -1; return g;
}
function fender(x, r, z, wdt) { const f = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.08, r + 0.08, wdt, 20, 1, true, 0, Math.PI), DARK()); f.rotation.x = Math.PI / 2; f.rotation.y = Math.PI / 2; f.position.set(x, r, z); f.material.side = THREE.DoubleSide; return f; }
function mirrors(c, x, y, W) { for (const s of [-1, 1]) { const arm = boxM(0.04, 0.04, 0.28, DARK()); arm.position.set(x, y + 0.25, s * (W / 2 + 0.12)); c.add(arm); const mr = boxM(0.07, 0.42, 0.16, DARK()); mr.position.set(x + 0.02, y, s * (W / 2 + 0.27)); c.add(mr); const gl = boxM(0.01, 0.36, 0.12, CHR()); gl.position.set(x + 0.06, y, s * (W / 2 + 0.27)); c.add(gl); } }
function lights(c, x, y, W, inset = 0.3) {
  for (const s of [-1, 1]) {
    const hl = boxM(0.05, 0.16, 0.34, mat(0xfffbe6, { emissive: 0xfff3c0, emissiveIntensity: .8 })); hl.position.set(x, y, s * (W / 2 - inset)); c.add(hl);
    const tn = boxM(0.05, 0.08, 0.14, mat(0xffa21a, { emissive: 0xff8a00, emissiveIntensity: .6 })); tn.position.set(x, y, s * (W / 2 - inset + 0.26 * (s > 0 ? 1 : -1) * 0 + 0.24 * s)); c.add(tn);
  }
}
/* cabine avançada (cab-over) — truck, 3/4 e cavalo. x = traseira da cabine */
function cab(gp, x, W, size) {
  const c = new THREE.Group(), big = size === 'big' || size === 'tractor', small = size === 'small', tr = size === 'tractor';
  const L = tr ? 2.55 : big ? 2.3 : small ? 1.75 : 2.05, y0 = small ? 0.62 : big ? 0.95 : 0.8, Hc = tr ? 2.15 : big ? 1.95 : small ? 1.55 : 1.75, Wc = Math.min(W, 2.45);
  const top = y0 + Hc, wsT = [-L + 0.12, top - 0.22], wsB = [-L - 0.02, y0 + Hc * 0.5];
  c.add(profile([[0, y0], [0, top], [-L + 0.45, top], [wsT[0], wsT[1], -L + 0.12, top], [wsB[0], wsB[1]], [-L - 0.05, y0 + 0.18], [-L + 0.1, y0, -L - 0.05, y0]], Wc, PAINT()));
  c.add(slantGlass(wsT, wsB, Wc * 0.86));
  const stripe = boxM(L * 0.92, 0.07, Wc + 0.012, mat(0xf39a2b, { roughness: .4 })); stripe.position.set(-L / 2 + 0.05, y0 + Hc * 0.36, 0); c.add(stripe);
  const stripe2 = boxM(L * 0.8, 0.035, Wc + 0.014, mat(0x2f8cf2, { roughness: .4 })); stripe2.position.set(-L / 2 + 0.1, y0 + Hc * 0.36 - 0.07, 0); c.add(stripe2);
  for (const s of [-1, 1]) {
    const sw = boxM(L * 0.34, Hc * 0.3, 0.02, GLASS()); sw.position.set(-L + L * 0.3, y0 + Hc * 0.69, s * (Wc / 2 + 0.006)); c.add(sw);
    const dl = boxM(0.015, Hc * 0.8, 0.012, DARK()); dl.position.set(-L + L * 0.52, y0 + Hc * 0.45, s * (Wc / 2 + 0.008)); c.add(dl);
    const hd = boxM(0.12, 0.025, 0.03, CHR()); hd.position.set(-L + L * 0.47, y0 + Hc * 0.5, s * (Wc / 2 + 0.02)); c.add(hd);
    for (let k = 0; k < 2; k++) { const st = boxM(0.32, 0.04, 0.22, DARK()); st.position.set(-L + L * 0.35, y0 - 0.12 - k * 0.24, s * (Wc / 2 - 0.08)); c.add(st); }
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), mat(0xffa21a, { emissive: 0xff8a00, emissiveIntensity: .5 })); fl.rotation.x = Math.PI / 2; fl.position.set(-L + 0.4, y0 + 0.5, s * (Wc / 2 + 0.01)); c.add(fl);
  }
  /* grade, para-choque, faróis, para-sol */
  const gr = boxM(0.04, Hc * 0.32, Wc * 0.62, DARK()); gr.position.set(-L - 0.03, y0 + Hc * 0.27, 0); c.add(gr);
  for (let i = 0; i < 6; i++) { const b = boxM(0.05, 0.025, Wc * 0.6, CHR()); b.position.set(-L - 0.05, y0 + Hc * 0.14 + i * Hc * 0.045, 0); c.add(b); }
  const logo = boxM(0.02, 0.12, 0.45, mat(0x2f8cf2, { emissive: 0x0b3b7a, emissiveIntensity: .4 })); logo.position.set(-L - 0.06, y0 + Hc * 0.43, 0); c.add(logo);
  const bump = boxM(0.32, 0.36, Wc + 0.06, mat(0x2a303b, { roughness: .5 })); bump.position.set(-L - 0.04, y0 - 0.1, 0); c.add(bump);
  lights(c, -L - 0.2, y0 - 0.02, Wc, 0.32);
  const visor = boxM(0.35, 0.05, Wc * 0.9, DARK()); visor.position.set(-L + 0.05, top - 0.06, 0); visor.rotation.z = -0.15; c.add(visor);
  mirrors(c, -L + 0.05, y0 + Hc * 0.62, Wc);
  if (tr) { /* escapamento (sem defletor, como no desenho de referência) */
    for (const s of [-1, 1]) { const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 12), CHR()); ex.position.set(0.12, top - 0.2, s * (Wc / 2 - 0.15)); c.add(ex); }
  }
  if (!small) for (const s of [-1, 1]) { const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 22), CHR()); tk.rotation.z = Math.PI / 2; tk.position.set(0.55, 0.78, s * (W / 2 - 0.42)); tk.castShadow = true; c.add(tk); const bd = boxM(0.06, 0.64, 0.64, DARK()); bd.position.set(0.1, 0.78, s * (W / 2 - 0.42)); c.add(bd); }
  c.position.x = x; gp.add(c); return { L, y0 };
}
/* cabine semicapô (Iveco Daily / van) — x = traseira da cabine */
function cabHood(gp, x, W, roofY, base, glassOnly) {
  const c = new THREE.Group(), Wc = W, top = roofY;
  const pts = [[0, base], [0, top], [-0.55, top], [-0.78, top - 0.18, -0.74, top], [-1.4, base + 0.98], [-1.95, base + 0.72, -1.7, base + 0.9], [-2.02, base + 0.42, -2.02, base + 0.62], [-1.95, base, -2.04, base]];
  c.add(profile(pts, Wc, PAINT()));
  c.add(slantGlass([-0.78, top - 0.2], [-1.38, base + 1.0], Wc * 0.86, 0.035));
  for (const s of [-1, 1]) {
    const sw = boxM(0.62, (top - base) * 0.3, 0.02, GLASS()); sw.position.set(-0.55, base + (top - base) * 0.68, s * (Wc / 2 + 0.006)); c.add(sw);
    const dl = boxM(0.015, (top - base) * 0.75, 0.012, DARK()); dl.position.set(-0.05, base + (top - base) * 0.45, s * (Wc / 2 + 0.008)); c.add(dl);
    const stp = boxM(1.6, 0.05, Wc + 0.02, mat(0xf39a2b)); stp.position.set(-0.85, base + 0.62, 0); c.add(stp);
  }
  const gr = boxM(0.04, 0.3, Wc * 0.55, DARK()); gr.position.set(-2.03, base + 0.5, 0); c.add(gr);
  for (let i = 0; i < 4; i++) { const b = boxM(0.04, 0.02, Wc * 0.52, CHR()); b.position.set(-2.05, base + 0.4 + i * 0.07, 0); c.add(b); }
  const bump = boxM(0.22, 0.28, Wc + 0.06, mat(0x2a303b)); bump.position.set(-2.0, base + 0.1, 0); c.add(bump);
  lights(c, -1.97, base + 0.7, Wc, 0.28);
  mirrors(c, -0.8, base + (top - base) * 0.62, Wc);
  c.position.x = x; gp.add(c); return c;
}
function tractor(gp, W, kind) {
  cab(gp, -0.9, W, 'tractor');
  const fr = boxM(5.4, 0.3, 0.92, DARK()); fr.position.set(-0.85, 0.85, 0); gp.add(fr);
  const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 24), mat(0x2a303b, { metalness: .5 })); fw.position.set(0.8, 1.06, 0); gp.add(fw);
  for (const s of [-1, 1]) {
    gp.add(fender(-2.75, 0.5, s * (W / 2 - 0.22), 0.42));
    for (const ax of (kind === 'toco' ? [0.65] : [0.0, 1.3])) { gp.add(wheel(ax, s * (W / 2 - 0.2), 0.5, true)); }
    const mg = boxM(2.3, 0.07, 0.62, DARK()); mg.position.set(0.65, 1.12, s * (W / 2 - 0.35)); gp.add(mg);
    const flap = boxM(0.03, 0.5, 0.55, DARK()); flap.position.set(1.95, 0.45, s * (W / 2 - 0.35)); gp.add(flap);
    gp.add(wheel(-2.75, s * (W / 2 - 0.2), 0.5, false));
    const air = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 14), mat(0x3a414d, { metalness: .4 })); air.rotation.z = Math.PI / 2; air.position.set(-0.3, 0.55, s * 0.35); gp.add(air);
  }
}
function rearDoors(gp, X, v, F, color, opacity, bars) {
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(X + v.L + 0.03, F, s * (v.W / 2 + 0.03));
    const m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, metalness: .3, roughness: .5, map: bars ? corrug() : null });
    const d = boxM(0.05, v.H, v.W / 2 + 0.03, m); d.position.set(0, v.H / 2, -s * (v.W / 4 + 0.015)); piv.add(d); wallMats.push({ m, base: opacity });
    if (bars) for (const k of [0.25, 0.75]) { const b = boxM(0.05, v.H * 0.96, 0.04, mat(0x8a8f99, { metalness: .7 })); b.position.set(0.04, v.H / 2, -s * (v.W / 2) * k); piv.add(b); }
    piv.userData.s = s; gp.add(piv); doorObjs.push(piv);
  }
}
/* paredes do compartimento: externas às medidas internas (as medidas de cálculo ficam exatas) */
const curtain = () => canvasTex('curtain', x => { x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); noise(x, 500, .04); x.fillStyle = 'rgba(20,40,80,.35)'; for (let i = 0; i < 256; i += 64) x.fillRect(i + 28, 0, 8, 256); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, 0, 256, 6); x.fillRect(0, 250, 256, 6); });
const planks = () => canvasTex('planks', x => { x.fillStyle = '#b8875a'; x.fillRect(0, 0, 256, 256); noise(x, 900, .08); x.strokeStyle = 'rgba(60,30,10,.55)'; x.lineWidth = 3; for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); } });
/* carroceria aberta (grade): laterais baixas de madeira, cabeceira alta, sem teto; o limite de altura do cálculo fica tracejado */
function openBody(gp, X, v, F) {
  const W = v.W, t = 0.05, hb = Math.min(0.7, v.H * 0.35); v = { ...v, H: NX.effH(v) };
  const mk = rep => { const tx = planks().clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(rep, 1); const m = new THREE.MeshStandardMaterial({ map: tx, roughness: .85, transparent: true, opacity: .95 }); wallMats.push({ m, base: .95 }); return m; };
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(v.L, hb, t), mk(v.L / 1.2)); p.position.set(X + v.L / 2, F + hb / 2, s * (W / 2 + t / 2)); p.castShadow = true; gp.add(p);
    for (let k = 0; k <= 6; k++) { const st = boxM(0.06, hb + 0.06, 0.07, mat(0x2a303b, { metalness: .4 })); st.position.set(X + k / 6 * v.L, F + hb / 2, s * (W / 2 + t)); gp.add(st); } }
  const head = new THREE.Mesh(new THREE.BoxGeometry(t * 2, v.H, W + 2 * t), mat(0x2a303b, { metalness: .5, roughness: .5 })); head.position.set(X - t, F + v.H / 2, 0); gp.add(head);
  for (let k = 1; k < 5; k++) { const bar = boxM(0.04, 0.05, W, mat(0x8a93a3, { metalness: .6 })); bar.position.set(X - 0.1, F + k * v.H / 5, 0); gp.add(bar); }
  const gate = new THREE.Mesh(new THREE.BoxGeometry(t, hb, W), mk(W / 1.2)); gate.position.set(X + v.L + t / 2, F + hb / 2, 0); gp.add(gate);
  const lim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(v.L, v.H, W)), new THREE.LineDashedMaterial({ color: 0xffd27a, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: .55 })); lim.computeLineDistances(); lim.position.set(X + v.L / 2, F + v.H / 2, 0); gp.add(lim);
}
function bodyShell(gp, X, v, F, kind) {
  if (kind === 'aberta') return openBody(gp, X, v, F);
  const W = v.W, t = 0.05;
  const col = kind === 'container' ? 0x2f6fb5 : kind === 'sider' ? 0x6f93c7 : 0xf4f6fa; if (kind === 'van') kind = 'vanb';
  const base = kind === 'sider' ? 0.4 : 0.34;
  const mk = (mapF, rep) => { const tx = mapF ? mapF().clone() : null; if (tx) { tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(rep, 1); } const m = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: base, side: THREE.DoubleSide, depthWrite: false, map: tx, metalness: kind === 'container' ? .35 : .15, roughness: .55 }); wallMats.push({ m, base }); return m; };
  const texF = kind === 'container' ? corrug : kind === 'bau' ? ribs : kind === 'sider' ? curtain : null;
  const side = mk(texF, kind === 'sider' ? v.L / 1.6 : v.L / 0.6), front = mk(kind === 'sider' ? ribs : texF, W / 0.6), roof = mk(null, 1);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(v.L, v.H, t), side); p.position.set(X + v.L / 2, F + v.H / 2, s * (W / 2 + t / 2)); gp.add(p); }
  const fw = new THREE.Mesh(new THREE.BoxGeometry(t, v.H, W + 2 * t), front); fw.position.set(X - t / 2, F + v.H / 2, 0); gp.add(fw);
  const rf = new THREE.Mesh(new THREE.BoxGeometry(v.L + t, t, W + 2 * t), roof); rf.position.set(X + v.L / 2, F + v.H + t / 2, 0); gp.add(rf);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(v.L, v.H, W)), new THREE.LineBasicMaterial({ color: kind === 'container' ? 0x9cc3f0 : 0xe8eef8 })); e.position.set(X + v.L / 2, F + v.H / 2, 0); gp.add(e);
  if (kind === 'container') { /* cantoneiras ISO */
    for (const cx of [X - t, X + v.L + t]) for (const cy of [F, F + v.H]) for (const cz of [-W / 2 - t, W / 2 + t]) { const k = boxM(0.18, 0.12, 0.16, mat(0x1d4f88, { metalness: .5 })); k.position.set(cx, cy, cz); gp.add(k); }
  }
  if (kind === 'sider') { for (const s of [-1, 1]) { const rail = boxM(v.L + 0.1, 0.1, 0.07, mat(0xc8d0dc, { metalness: .6 })); rail.position.set(X + v.L / 2, F + v.H + 0.03, s * (W / 2 + 0.03)); gp.add(rail); } } if (kind === 'sider') for (let k = 0; k <= 4; k++) { const post = boxM(0.06, v.H, 0.06, mat(0xc8d0dc, { metalness: .5 })); for (const s of [-1, 1]) { const pp = post.clone(); pp.position.set(X + k / 4 * v.L, F + v.H / 2, s * W / 2); gp.add(pp); } }
}
function floorDeck(gp, X, v, F, chassisW) {
  const fl = boxM(v.L + 0.1, 0.12, v.W + 0.1, mat(0x8d96a6, { metalness: .4 })); fl.position.set(X + v.L / 2, F - 0.06, 0); gp.add(fl);
  const ch = boxM(v.L, 0.26, chassisW || 0.9, mat(0x1d2433)); ch.position.set(X + v.L / 2, F - 0.25, 0); gp.add(ch);
  for (const s of [-1, 1]) { const tl = boxM(0.05, 0.12, 0.22, mat(0xff2a2a, { emissive: 0xaa0000, emissiveIntensity: .8 })); tl.position.set(X + v.L + 0.08, F - 0.3, s * (v.W / 2 - 0.3)); gp.add(tl); }
  const bb = boxM(0.12, 0.12, v.W * 0.9, mat(0xc8ced8)); bb.position.set(X + v.L + 0.05, Math.max(0.35, F - 0.6), 0); gp.add(bb);
}
function buildVehicle(v, offZ) {
  const gp = new THREE.Group(); gp.position.z = offZ; const W = v.W, m = axleModel(v), F = floorOf(v), r = wheelR(v);
  const cat = v.cat;
  for (let g = 0; g < v.wag; g++) {
    const X = wagonX(v, g);
    if (cat === 'Container') {
      const sk = boxM(v.L + 0.4, 0.22, 1.0, mat(0x2a303b)); sk.position.set(X + v.L / 2, 1.08, 0); gp.add(sk);
      for (const s of [-1, 1]) { const rl = boxM(v.L + 0.4, 0.12, 0.08, mat(0x2a303b)); rl.position.set(X + v.L / 2, 1.2, s * (W / 2 - 0.1)); gp.add(rl); }
      const fl = boxM(v.L, 0.12, W, mat(0x6b4a2b, { roughness: .9 })); fl.position.set(X + v.L / 2, F - 0.06, 0); gp.add(fl);
      bodyShell(gp, X, v, F, 'container'); rearDoors(gp, X, v, F, 0x2f6fb5, 0.3, true);
      for (const s of [-1, 1]) { const tl = boxM(0.05, 0.12, 0.22, mat(0xff2a2a, { emissive: 0xaa0000, emissiveIntensity: .8 })); tl.position.set(X + v.L + 0.25, 1.0, s * (W / 2 - 0.3)); gp.add(tl); }
    } else if ((cat === 'Carreta' || cat === 'Rodotrem') && m.type !== 'rj') {
      floorDeck(gp, X, v, F); { const bk = NX.bodyOf(v); bodyShell(gp, X, v, F, bk); if (bk !== 'aberta') rearDoors(gp, X, v, F, bk === 'sider' ? 0xc8d6ea : 0xf4f6fa, 0.35, false); }
      for (const s of [-1, 1]) { const rail = boxM(v.L + 0.1, 0.2, 0.06, mat(0xdfe5ee, { metalness: .4 })); rail.position.set(X + v.L / 2, F - 0.1, s * (W / 2 + 0.05)); gp.add(rail); const leg = boxM(0.1, F - 0.25, 0.1, mat(0x2a303b)); leg.position.set(X + 2.6, (F - 0.25) / 2 + 0.1, s * 0.7); gp.add(leg); const ft = boxM(0.3, 0.06, 0.3, mat(0x2a303b)); ft.position.set(X + 2.6, 0.15, s * 0.7); gp.add(ft); const ug = boxM(v.L * 0.4, 0.07, 0.04, mat(0xcfd6e2, { metalness: .5 })); ug.position.set(X + v.L * 0.45, 0.62, s * (W / 2 - 0.02)); gp.add(ug); for (let k = 0; k < 5; k++) { const ml = boxM(0.08, 0.05, 0.02, mat(0xffa21a, { emissive: 0xff8a00, emissiveIntensity: .6 })); ml.position.set(X + (k + 0.5) * v.L / 5, F - 0.1, s * (W / 2 + 0.09)); gp.add(ml); } }
    } else if (cat === 'Van') {
      const fl = boxM(v.L, 0.1, W, mat(0x3b4252)); fl.position.set(X + v.L / 2, F - 0.05, 0); gp.add(fl);
      const sk = boxM(v.L + 0.2, 0.14, W + 0.1, PAINT()); sk.position.set(X + v.L / 2, F - 0.08, 0); gp.add(sk);
      const bp = boxM(0.18, 0.24, W + 0.1, mat(0x2a303b)); bp.position.set(X + v.L + 0.1, F - 0.25, 0); gp.add(bp);
      bodyShell(gp, X, v, F, 'van'); rearDoors(gp, X, v, F, 0xf4f6fa, 0.35, false);
      cabHood(gp, X, W + 0.1, F + v.H + 0.05, 0.6);
      for (const s2 of [-1, 1]) { const tl = boxM(0.04, 0.5, 0.12, mat(0xff2a2a, { emissive: 0xaa0000, emissiveIntensity: .7 })); tl.position.set(X + v.L + 0.06, F + 0.35, s2 * (W / 2 - 0.02)); gp.add(tl); }
    } else { /* Truck, 3/4, Iveco baú: baú fechado */
      floorDeck(gp, X, v, F); { const bk = NX.bodyOf(v); bodyShell(gp, X, v, F, bk); if (bk !== 'aberta') rearDoors(gp, X, v, F, bk === 'sider' ? 0xc8d6ea : 0xf4f6fa, 0.35, false); }
      for (const s2 of [-1, 1]) { const ug = boxM(v.L * 0.45, 0.06, 0.04, mat(0xcfd6e2, { metalness: .5 })); ug.position.set(X + v.L * 0.4, Math.max(0.45, F - 0.5), s2 * (W / 2 - 0.05)); gp.add(ug);
        for (let k = 0; k < 3; k++) { const ml = boxM(0.08, 0.05, 0.02, mat(0xffa21a, { emissive: 0xff8a00, emissiveIntensity: .6 })); ml.position.set(X + (k + 0.5) * v.L / 3, F + 0.12, s2 * (W / 2 + 0.06)); gp.add(ml); } }
    }
    /* eixos traseiros */
    let axs; const rn = m.rear || 1;
    if (m.type === 'rigid') axs = Array.from({ length: rn }, (_, k) => X + m.s2 + (k - (rn - 1) / 2) * 1.3);
    else if (m.type === 'semi') axs = m.trailerX.flatMap((x, i) => { const n = m.tgN[i]; return Array.from({ length: n }, (_, k) => X + x + (k - (n - 1) / 2) * 1.3); });
    else if (m.type === 'bitrem') { const n = m.k === 'bitrem9' ? 3 : 2; axs = Array.from({ length: n }, (_, k) => X + m.s2 + (k - (n - 1) / 2) * 1.3); }
    else if (m.type === 'rj') axs = g === 0 ? [X + m.s2 - 0.65, X + m.s2 + 0.65] : [X + m.p1, X + m.p2];
    else axs = [-0.65, 0.65].map(k => X + m.s2 + k);
    const dual = cat !== 'Van'; for (const ax of axs) { for (const s of [-1, 1]) { gp.add(wheel(ax, s * (W / 2 - (cat === 'Van' ? 0.12 : 0.2)), r, dual)); } }
    if (cat === 'Van') for (const s of [-1, 1]) gp.add(fender(X + m.s2, r, s * (W / 2 + 0.02), 0.2));
    if (m.type === 'rj' && g === 1) { const bar = boxM(GAPW + 1.2, 0.1, 0.1, DARK()); bar.position.set(X - GAPW / 2 + 0.3, 0.75, 0); gp.add(bar); for (const s of [-1, 1]) { const tb = boxM(1.0, 0.08, 0.08, DARK()); tb.position.set(X + 0.5, 0.78, s * 0.45); tb.rotation.y = s * 0.35; gp.add(tb); } }
    if (m.type === 'rodo' && g === 1) { for (let k = 0; k < 2; k++) for (const s of [-1, 1]) gp.add(wheel(X - 0.45 + k * 1.3, s * (W / 2 - 0.2), 0.5, true)); const db = boxM(0.3, 0.2, 0.3, mat(0x2a303b)); db.position.set(X - GAPW / 2, 0.9, 0); gp.add(db); }
  }
  if (m.type === 'rigid' || m.type === 'rj') {
    let fx = m.s1;
    if (cat === 'Iveco baú') { cabHood(gp, -0.12, Math.min(W, 2.0), 2.55, 0.68); fx = -1.45; const fr = boxM(2.2, 0.2, 0.8, DARK()); fr.position.set(-1.1, r + 0.2, 0); gp.add(fr); }
    else if (cat === 'Van') fx = -1.45;
    else { const k = cab(gp, -0.15, W, (cat === 'Truck' || m.type === 'rj') ? 'big' : 'mid'); const fr = boxM(k.L + 0.3, 0.24, 0.85, DARK()); fr.position.set(-0.15 - k.L / 2, r + 0.22, 0); gp.add(fr); fx = -0.15 - k.L * 0.55; }
    if (m.k === 'bitruck') for (const s of [-1, 1]) gp.add(wheel(fx + 1.35, s * (W / 2 - 0.2), r));
    for (const s of [-1, 1]) { gp.add(wheel(fx, s * (W / 2 - (cat === 'Van' ? 0.12 : 0.2)), r)); if (cat !== 'Van') gp.add(fender(fx, r, s * (W / 2 - 0.2), 0.36)); else gp.add(fender(fx, r, s * (W / 2 + 0.02), 0.2)); }
  } else tractor(gp, W, m.tractor);
  scene.add(gp); return gp;
}

/* ---------------- volumes ---------------- */
const NUMM = {};
function numMat(n) { if (NUMM[n]) return NUMM[n]; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#ffffffe6'; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill(); x.fillStyle = '#0a1122'; x.font = 'bold 26px Barlow, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n).padStart(2, '0'), 32, 34); return (NUMM[n] = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: true })); }
/* materiais e geometrias reaproveitados entre volumes */
const IMAT = {}, IGEO = {};
const imat = (col, map, extra = {}) => { const k = col.getHexString() + (map ? map.uuid : '') + JSON.stringify(extra); return IMAT[k] || (IMAT[k] = new THREE.MeshStandardMaterial({ color: col, map, roughness: .75, ...extra })); };
const igeo = (l, h, w) => { const k = l.toFixed(3) + 'x' + h.toFixed(3) + 'x' + w.toFixed(3); return IGEO[k] || (IGEO[k] = new THREE.BoxGeometry(l, h, w)); };
const iedge = (l, h, w) => { const k = 'e' + l.toFixed(3) + 'x' + h.toFixed(3) + 'x' + w.toFixed(3); return IGEO[k] || (IGEO[k] = new THREE.EdgesGeometry(igeo(l, h, w))); };
const EDGE_M = new THREE.LineBasicMaterial({ color: 0x3a1e00, transparent: true, opacity: .45 });
function itemMesh(it) {
  const p = it.p, col = new THREE.Color(colorOf(p)); const g = new THREE.Group(); let body;
  if (p.tipo === 'bobina') {
    const d = it.ax === 'v' ? it.l : it.ax === 'x' ? it.w : it.l; const R = d / 2;
    const len = it.ax === 'v' ? it.h : it.ax === 'x' ? it.l : it.w;
    const mm = new THREE.MeshStandardMaterial({ color: col, metalness: .75, roughness: .32 });
    body = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.99, R * 0.99, len * 0.99, 40, 1, true), mm); body.castShadow = true;
    const capM = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.85), metalness: .6, roughness: .45, side: THREE.DoubleSide });
    const ring = new THREE.RingGeometry(R * 0.32, R * 0.99, 40);
    const c1 = new THREE.Mesh(ring, capM), c2 = new THREE.Mesh(ring, capM); c1.position.y = len / 2 * 0.99; c2.position.y = -len / 2 * 0.99; c1.rotation.x = -Math.PI / 2; c2.rotation.x = Math.PI / 2;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.32, R * 0.32, len * 0.985, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x20242c, side: THREE.BackSide }));
    const cg = new THREE.Group(); cg.add(body, c1, c2, hole);
    if (it.ax === 'v') cg.position.y = it.h / 2; else { cg.position.y = it.h / 2; if (it.ax === 'x') cg.rotation.z = Math.PI / 2; else cg.rotation.x = Math.PI / 2;
      /* calços */
      const wm = mat(0x7a5a2e, { roughness: .9 });
      for (const s of [-1, 1]) { const ch = boxM(it.ax === 'x' ? it.l * 0.9 : 0.18, 0.14, it.ax === 'x' ? 0.18 : it.w * 0.9, wm); if (it.ax === 'x') ch.position.set(0, 0.07, s * (R * 0.78)); else ch.position.set(s * (R * 0.78), 0.07, 0); g.add(ch); } }
    g.add(cg);
  } else if (p.tipo === 'bigbag') {
    body = boxM(it.l * 0.96, it.h * 0.9, it.w * 0.96, new THREE.MeshStandardMaterial({ color: col, roughness: .95, map: fabric() })); body.position.y = it.h * 0.45; g.add(body);
    const top = boxM(it.l * 0.86, it.h * 0.06, it.w * 0.86, new THREE.MeshStandardMaterial({ color: col, roughness: .95, map: fabric() })); top.position.y = it.h * 0.93; g.add(top);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, it.h * 0.06, 16), mat(0xd9cfb6)); sp.position.y = it.h * 0.97; g.add(sp);
    for (const a of [-1, 1]) for (const c of [-1, 1]) { const lp = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI), mat(0x2f8cf2)); lp.position.set(a * it.l * 0.42, it.h * 0.9, c * it.w * 0.42); lp.rotation.y = Math.PI / 4 * a * c; g.add(lp); }
  } else {
    const isPal = p.tipo === 'palete', ph = isPal ? 0.14 : 0;
    if (isPal) {
      const plastic = /pl[aá]stic/i.test(p.emb || ''); const pm = plastic ? mat(0x2c6fb8, { roughness: .6 }) : mat(0xb08a5a, { roughness: .9 });
      const top = new THREE.Mesh(igeo(it.l, 0.035, it.w), pm); top.position.y = ph - 0.0175; top.receiveShadow = true; g.add(top);
      for (const c of [-1, 0, 1]) { const bl = new THREE.Mesh(igeo(it.l, ph - 0.035, 0.1), pm); bl.position.set(0, (ph - 0.035) / 2, c * (it.w / 2 - 0.06)); g.add(bl); }
    }
    const map = isPal ? carton() : p.tipo === 'outro' ? crate() : boxTex();
    body = new THREE.Mesh(igeo(it.l * 0.985, it.h - ph, it.w * 0.985), imat(p.tipo === 'outro' ? new THREE.Color(0xffffff) : col, map)); body.castShadow = body.receiveShadow = true; body.position.y = ph + (it.h - ph) / 2; g.add(body);
    const e = new THREE.LineSegments(iedge(it.l * 0.985, it.h - ph, it.w * 0.985), EDGE_M); e.position.copy(body.position); g.add(e);
  }

  if (window.SHOW_NUMS !== false) { const sp = new THREE.Sprite(numMat(it.n)); const s = Math.min(0.45, Math.min(it.l, it.w, it.h) * 0.6); sp.scale.set(s, s, 1); sp.position.set(0, it.h + 0.01 - s / 2 - 0.02, 0); sp.renderOrder = 2; g.add(sp); }
  g.userData.it = it; g.userData.body = body; g.userData.dims = it.l + '|' + it.w + '|' + it.h;
  return g;
}
function brandTex() { return canvasTex('brand2', x => { x.font = '800 60px "Barlow Condensed", Barlow, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const tw = x.measureText('NEXORA').width; if (tw > 236) x.font = '800 ' + Math.floor(60 * 236 / tw) + 'px "Barlow Condensed", Barlow, Arial, sans-serif'; x.fillStyle = 'rgba(0,0,0,.3)'; x.fillText('NEXORA', 130, 124); x.fillStyle = '#fff'; x.fillText('NEXORA', 128, 121); x.fillStyle = '#2f8cf2'; x.fillRect(58, 152, 140, 5); }, 256); }
function updateBrand() {
  for (const b of brand) scene.remove(b); brand = []; if (!plan) return; const tex = brandTex();
  plan.vehs.forEach((V, vi) => {
    for (let g = 0; g < V.v.wag; g++) {
      const its = V.items.filter(i => i.wg === g); if (its.length < 4) continue;
      const x0 = Math.min(...its.map(i => i.x)), x1 = Math.max(...its.map(i => i.x + i.l)), hz = Math.max(...its.map(i => i.z + i.h));
      const w = Math.min(2.4, (x1 - x0) * 0.4), F = floorOf(V.v); if (w < 0.8 || hz < 0.6) continue;
      for (const side of [1, -1]) {
        const yy = side > 0 ? Math.max(...its.map(i => i.y + i.w)) : Math.min(...its.map(i => i.y));
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
        pl.position.set(wagonX(V.v, g) + (x0 + x1) / 2, F + hz * 0.55, vehGroups[vi].position.z - V.v.W / 2 + yy + side * 0.012); if (side < 0) pl.rotation.y = Math.PI; pl.renderOrder = 3; scene.add(pl); brand.push(pl);
      }
    }
  });
  setBrandVis();
}
function setBrandVis() { for (const b of brand) b.visible = !anim; }
function worldPos(vi, it) { const V = plan.vehs[vi]; return new THREE.Vector3(wagonX(V.v, it.wg) + it.x + it.l / 2, floorOf(V.v) + it.z, vehGroups[vi].position.z - V.v.W / 2 + it.y + it.w / 2); }
function placeMesh(it) {
  const m = meshes.get(it); if (!m) return; const vi = plan.vehs.findIndex(V => V.items.includes(it));
  if (m.userData.dims !== it.l + '|' + it.w + '|' + it.h || m.userData.ax !== it.ax) { scene.remove(m); const n = itemMesh(it); n.userData.ax = it.ax; meshes.set(it, n); scene.add(n); n.position.copy(worldPos(vi, it)); return; }
  m.position.copy(worldPos(vi, it));
}
function clearScene() { for (const g of vehGroups) scene.remove(g); for (const [, m] of meshes) scene.remove(m); vehGroups = []; meshes.clear(); doorObjs = []; wallMats = []; if (voidGroup) { scene.remove(voidGroup); voidGroup = null; } }
function buildScene() {
  if (!scene) return; clearScene(); for (const b of brand) scene.remove(b); brand = []; if (!plan) return;
  let z = 0; plan.vehs.forEach((V, i) => { const nx = plan.vehs[i + 1]; vehGroups.push(buildVehicle(V.v, z)); z -= (V.v.W + (nx ? nx.v.W : 0)) / 2 + 4.5; });
  plan.vehs.forEach((V, i) => V.items.forEach(it => { const m = itemMesh(it); m.userData.ax = it.ax; m.position.copy(worldPos(i, it)); meshes.set(it, m); scene.add(m); }));
  updateBrand(); setWalls(wallMode); setDoors(doorsOpen, true); updateVoids(); setView(curView, true);
}
function setDoors(open, inst) { doorsOpen = open; $('#bDoors').textContent = open ? 'Fechar portas' : 'Abrir portas'; for (const d of doorObjs) d.userData.target = open ? -d.userData.s * Math.PI * 0.9 : 0; if (inst) for (const d of doorObjs) d.rotation.y = d.userData.target; }
function setWalls(mode) {
  wallMode = mode; const lbl = { trans: 'transparentes', solid: 'sólidas', hidden: 'ocultas' }[mode]; $('#bWalls').textContent = 'Paredes: ' + lbl;
  for (const w of wallMats) { w.m.visible = mode !== 'hidden'; w.m.opacity = mode === 'solid' ? 1 : w.base; w.m.depthWrite = mode === 'solid'; w.m.needsUpdate = true; }
}
/* espaços vazios: fundo livre de cada compartimento + coluna livre acima de cada volume sem nada em cima */
function updateVoids() {
  if (voidGroup) { scene.remove(voidGroup); voidGroup = null; } if (!showVoid || !plan) return;
  voidGroup = new THREE.Group(); const vm = new THREE.MeshBasicMaterial({ color: 0x32c48d, transparent: true, opacity: .16, depthWrite: false }), em = new THREE.LineBasicMaterial({ color: 0x32c48d, transparent: true, opacity: .6 });
  const add = (V, vi, g, x, y, z, l, w, h) => { if (l < 0.05 || w < 0.05 || h < 0.05) return; const F = floorOf(V.v); const b = new THREE.Mesh(new THREE.BoxGeometry(l, h, w), vm); b.position.set(wagonX(V.v, g) + x + l / 2, F + z + h / 2, vehGroups[vi].position.z - V.v.W / 2 + y + w / 2); voidGroup.add(b); const e = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), em); e.position.copy(b.position); voidGroup.add(e); };
  plan.vehs.forEach((V, vi) => {
    for (let g = 0; g < V.v.wag; g++) { const its = V.items.filter(i => i.wg === g); const end = its.length ? Math.max(...its.map(i => i.x + i.l)) : 0; add(V, vi, g, end, 0, 0, V.v.L - end, V.v.W, V.v.H); }
    for (const it of V.items) if (!V.items.some(o => o !== it && (o.sup || []).some(s => s.o === it))) add(V, vi, it.wg, it.x, it.y, it.z + it.h, it.l, it.w, V.v.H - it.z - it.h);
  });
  scene.add(voidGroup);
}
let curView = '3d', camTween = null;
function setView(v, inst) {
  curView = v; $$('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  if (!plan || !vehGroups[active]) { camera.position.set(-14, 10, 16); controls.target.set(6, 1.5, 0); return; }
  const V = plan.vehs[active]; const len = wagonX(V.v, V.v.wag - 1) + V.v.L; const cz = vehGroups[active].position.z, F = floorOf(V.v);
  const t = new THREE.Vector3(len / 2 - 1.5, F + V.v.H / 2, cz); const R = Math.max(len + 2.5, 9) * Math.max(1.1, 1.5 / camera.aspect);
  const pos = { '3d': [t.x - R * 0.55, t.y + R * 0.55, cz + R * 0.75], top: [t.x, t.y + R * 1.15, cz + 0.01], side: [t.x, t.y + 0.6, cz + R * 1.05], rear: [len + R * 0.75, t.y + 0.8, cz], front: [-R * 0.85, t.y + 1, cz], inside: [len + 1.4, F + V.v.H + 1.1, cz] }[v];
  const tgt = v === 'rear' || v === 'front' ? new THREE.Vector3(len / 2, t.y, cz) : v === 'inside' ? new THREE.Vector3(len * 0.35, F + V.v.H * 0.2, cz) : t;
  if (v === 'inside') { setDoors(true); if (wallMode === 'solid') setWalls('trans'); }
  const target = { pos: new THREE.Vector3(...pos), tgt };
  if (inst) { camera.position.copy(target.pos); controls.target.copy(target.tgt); } else camTween = { from: camera.position.clone(), ft: controls.target.clone(), ...target, t: 0 };
}
/* animações: dir 'in' = carregamento (sequência real), 'out' = descarregamento (ordem inversa, pela traseira) */
function startAnim(dir = 'in') {
  if (!plan) return; const V = plan.vehs[active]; setDoors(true); stopAnim(true);
  const seq = [...V.items].sort((a, b) => dir === 'in' ? a.seq - b.seq : unloadKey(V, b) - unloadKey(V, a));
  if (dir === 'in') for (const it of seq) meshes.get(it).visible = false;
  anim = { seq, i: 0, t: 0, vi: active, dir }; paused = false; setBrandVis(); updPlayBtns();
}
const unloadKey = (V, i) => i.wg * 1000 + (i.x + i.l) * 10 + i.z * 0.1; /* maior = sai primeiro */
function stopAnim(silent) { if (!anim) return; for (const it of anim.seq) { const m = meshes.get(it); if (m) { m.visible = true; placeMesh(it); } } anim = null; setBrandVis(); updPlayBtns(); }
function updPlayBtns() { $('#bPlay').textContent = anim && anim.dir === 'in' ? (paused ? '▶ Continuar' : '⏸ Pausar') : '▶ Carregar'; $('#bUnload').textContent = anim && anim.dir === 'out' ? (paused ? '▶ Continuar' : '⏸ Pausar') : '⏏ Descarregar'; }
/* ---------- desenho sob demanda: só redesenha quando algo muda ---------- */
let dirty = true;
function invalidate(shadows = true) { dirty = true; if (shadows && renderer) renderer.shadowMap.needsUpdate = true; }
function loop(now = performance.now()) {
  requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let moving = false; for (const d of doorObjs) { const tg = d.userData.target || 0, df = tg - d.rotation.y; if (Math.abs(df) > 0.002) { d.rotation.y += df * Math.min(1, dt * 5); moving = true; } }
  if (moving) invalidate();
  if (drag && drag.edge) { edgeOrbit(dt); }
  if (camTween) { camTween.t = Math.min(1, camTween.t + dt * 2); const k = 1 - Math.pow(1 - camTween.t, 3); camera.position.lerpVectors(camTween.from, camTween.pos, k); controls.target.lerpVectors(camTween.ft, camTween.tgt, k); if (camTween.t >= 1) camTween = null; }
  if (anim && !paused) {
    const sp = +$('#speed').value; const it = anim.seq[anim.i];
    if (!it) { const d = anim.dir; if (d === 'out') for (const x of anim.seq) { meshes.get(x).visible = true; placeMesh(x); } anim = null; setBrandVis(); updPlayBtns(); toast(d === 'in' ? 'Carregamento concluído.' : 'Descarregamento concluído — volumes de volta às posições do plano.'); }
    else {
      const m = meshes.get(it); m.visible = true; anim.t += dt * sp * 1.6; const k = Math.min(1, anim.t);
      const end = worldPos(anim.vi, it); const V = plan.vehs[anim.vi]; const outX = wagonX(V.v, V.v.wag - 1) + V.v.L + 2.5, F = floorOf(V.v); const lift = Math.max(0, end.y - F);
      const path = kk => { if (kk < 0.75) { const q = easeIO(kk / 0.75); return [outX + (end.x - outX) * q, F + lift + 0.05 + Math.sin(q * Math.PI) * 0.25]; } const q = easeIO((kk - 0.75) / 0.25); return [end.x, end.y + 0.05 * (1 - q)]; };
      const [px, py] = path(anim.dir === 'in' ? k : 1 - k); m.position.set(px, py, end.z);
      if (k >= 1) { if (anim.dir === 'in') m.position.copy(end); else m.visible = false; anim.i++; anim.t = 0; }
    }
  }
  if (controls.update()) dirty = true;
  if (anim || camTween) dirty = true;
  if (!dirty) return;
  if (anim) renderer.shadowMap.needsUpdate = true;
  dirty = false; renderer.render(scene, camera); updTag();
}
const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/* ---------------- etiqueta do volume ---------------- */
function tagHTML(it, vi) {
  const p = it.p, V = plan.vehs[vi];
  return `<b>Volume ${String(it.n).padStart(2, '0')}</b> · ${esc(p.nome)}<br>Cód. ${esc(p.cod)} · ${esc(NX.TIPOS[p.tipo].nome)}${p.emb ? ' (' + esc(p.emb) + ')' : ''}<br>`
    + `Ocupa C ${fmt(it.l, 2)} × L ${fmt(it.w, 2)} × A ${fmt(it.h, 2)} m<br>${esc(it.ok || '')}<br>`
    + `${fmt(it.kg, 1)} kg · ${it.pcs} peça(s)<br>Posição: x ${fmt(it.x, 2)} · y ${fmt(it.y, 2)} · z ${fmt(it.z, 2)} m<br>`
    + `Veículo ${vi + 1}: ${esc(V.v.name)} (${esc(NX.BODIES[NX.bodyOf(V.v)] || 'Container')})${V.v.wag > 1 ? ' · vagão ' + (it.wg + 1) : ''}`
    + ((p.cats || []).length ? '<br>' + p.cats.map(k => NX.PCATS[k] ? NX.PCATS[k].ic + ' ' + NX.PCATS[k].nome : '').join(' · ') : '')
    + (mode === 'route' && typeof RT === 'object' ? RT.tagInfo(p.stop) : '');
}
function updTag() {
  const t = $('#tag'); if (!sel || !plan || anim) { t.style.display = 'none'; return; }
  const m = meshes.get(sel); if (!m) { t.style.display = 'none'; return; }
  const vi = plan.vehs.findIndex(V => V.items.includes(sel)); if (t.dataset.k !== sel.n + '|' + sel.x + '|' + sel.y + '|' + sel.z + '|' + sel.l + '|' + sel.w) { t.innerHTML = tagHTML(sel, vi); t.dataset.k = sel.n + '|' + sel.x + '|' + sel.y + '|' + sel.z + '|' + sel.l + '|' + sel.w; }
  const p = m.position.clone(); p.y += sel.h + 0.15; p.project(camera);
  if (p.z > 1) { t.style.display = 'none'; return; }
  const el = $('#cv'); t.style.display = 'block'; t.style.left = ((p.x + 1) / 2 * el.clientWidth) + 'px'; t.style.top = ((1 - p.y) / 2 * el.clientHeight - 8) + 'px';
}
const SEL_M = new THREE.LineBasicMaterial({ color: 0xffb020, depthTest: false, transparent: true }); let selBox = null;
function highlight() {
  if (selBox && selBox.parent) selBox.parent.remove(selBox); selBox = null;
  if (!sel) return; const m = meshes.get(sel); if (!m) return;
  selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sel.l + 0.04, sel.h + 0.04, sel.w + 0.04)), SEL_M); selBox.position.y = sel.h / 2; selBox.renderOrder = 5; m.add(selBox);
}

/* ---------------- seleção, arraste e edição ---------------- */
let drag = null;
function pick(e) { const r = renderer.domElement.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); raycaster.setFromCamera(mouse, camera); }
/* gira a câmera quando o volume arrastado chega perto da borda da tela */
function edgeOrbit(dt) {
  const off = camera.position.clone().sub(controls.target), sph = new THREE.Spherical().setFromVector3(off);
  sph.theta -= drag.edge * dt * 1.1; sph.phi = Math.min(Math.PI * 0.49, Math.max(0.15, sph.phi + (drag.edgeY || 0) * dt * 0.6));
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph)); camera.lookAt(controls.target); invalidate(false);
  if (drag.ev) drag.el.dispatchEvent(new PointerEvent('pointermove', { clientX: drag.ev.clientX, clientY: drag.ev.clientY, pointerId: drag.ev.pointerId, bubbles: true }));
}
function bindPointer() {
  const c = renderer.domElement;
  c.addEventListener('pointerdown', e => {
    if (!plan || anim) return; pick(e);
    const hits = raycaster.intersectObjects([...meshes.values()], true).filter(h => h.object.isMesh && !h.object.isSprite); if (!hits.length) return;
    let o = hits[0].object; while (o && !o.userData.it) o = o.parent; if (!o) return;
    const it = o.userData.it; const vi = plan.vehs.findIndex(V => V.items.includes(it));
    if (vi !== active) { setActive(vi); selectItem(it); return; }
    selectItem(it);
    if (onTop(it).length) return;
    controls.enableRotate = false; controls.enablePan = false; c.setPointerCapture(e.pointerId);
    const F = floorOf(plan.vehs[active].v); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(F + it.z)); const pt = new THREE.Vector3(); raycaster.ray.intersectPlane(plane, pt);
    drag = { it, el: c, start: snap(it), plane, off: pt.sub(meshes.get(it).position), moved: false, edge: 0, sx: e.clientX, sy: e.clientY, live: false };
  });
  c.addEventListener('pointermove', e => {
    if (!drag) return; if (!drag.live) { if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return; drag.live = true; }
    const rc = c.getBoundingClientRect(), mx = e.clientX - rc.left, my = e.clientY - rc.top, M = 56;
    drag.edge = mx < M ? -1 : mx > rc.width - M ? 1 : 0; drag.edgeY = my < M ? -1 : my > rc.height - M ? 1 : 0; drag.ev = e;
    pick(e); const pt = new THREE.Vector3(); if (!raycaster.ray.intersectPlane(drag.plane, pt)) return; pt.sub(drag.off);
    const V = plan.vehs[active], it = drag.it; const lx = pt.x - it.l / 2, ly = pt.z - vehGroups[active].position.z + V.v.W / 2 - it.w / 2;
    let wg = it.wg; for (let g = 0; g < V.v.wag; g++) { const X = wagonX(V.v, g); if (pt.x >= X - GAPW / 2 && pt.x <= X + V.v.L + GAPW / 2) wg = g; }
    const nx = Math.round((lx - wagonX(V.v, wg)) / 0.05) * 0.05, ny = Math.round(ly / 0.05) * 0.05;
    if (tryMove(it, { x: clamp(nx, 0, V.v.L - it.l), y: clamp(ny, 0, V.v.W - it.w), wg }, true)) drag.moved = true; else drag.lastErr = lastMoveErr;
  });
  const up = () => {
    if (!drag) return; controls.enableRotate = true; controls.enablePan = true; const d = drag; drag = null;
    if (d.moved && (d.start.x !== d.it.x || d.start.y !== d.it.y || d.start.wg !== d.it.wg)) { pushHist(d.it, d.start); afterEdit(); }
    else if (d.lastErr) toast('Movimento bloqueado: ' + d.lastErr, true);
  };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('wheel', e => { if (sel && e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); rot90(); } }, { capture: true, passive: false });
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'click', 'wheel']) document.addEventListener(ev, () => invalidate(false), { passive: true });
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const snap = it => ({ x: it.x, y: it.y, z: it.z, l: it.l, w: it.w, h: it.h, wg: it.wg, ax: it.ax, ok: it.ok });
function pushHist(it, s) { hist.push({ vi: active, it, s }); if (hist.length > 10) hist.shift(); redo = []; }
function restore(h, stackTo) {
  const V = plan.vehs[h.vi]; stackTo.push({ vi: h.vi, it: h.it, s: snap(h.it) }); if (stackTo.length > 10) stackTo.shift();
  Object.assign(h.it, h.s); rebuildLoads(V.items);
  if (h.vi !== active) { active = h.vi; buildScene(); } else placeMesh(h.it);
  sel = h.it; afterEdit();
}
function undo() { const h = hist.pop(); if (!h) return toast('Nada para desfazer.'); restore(h, redo); toast('Ação desfeita.'); }
function redoAct() { const h = redo.pop(); if (!h) return toast('Nada para refazer.'); const r = redo; restore(h, hist); redo = r; toast('Ação refeita.'); }
function onTop(it) { const V = plan.vehs[active]; return V.items.filter(o => o !== it && o.sup && o.sup.some(q => q.o === it)); }
function settleZ(V, it, cand) { let z = 0; for (const o of V.items) { if (o === it || o.wg !== cand.wg) continue; if (o.z + o.h > it.z + 1e-6) continue; if (NX.areaOv(o, cand) > 0) z = Math.max(z, o.z + o.h); } return z; }
let lastMoveErr = '';
function tryMove(it, cand, silent) {
  const V = plan.vehs[active];
  if (onTop(it).length) { lastMoveErr = 'há volumes em cima deste; mova-os primeiro'; if (!silent) toast('Não é possível: ' + lastMoveErr + '.', true); return false; }
  const b = { ...it, ...cand }; b.c = { L: V.v.L, W: V.v.W, H: NX.effH(V.v) }; b.z = settleZ(V, it, b);
  const others = V.items.filter(o => o !== it);
  const r = checkPlace(b.c, others, b, null);
  if (!r.ok) { lastMoveErr = r.msg; if (!silent) toast('Não é possível: ' + r.msg + '.', true); return false; }
  const kg = others.reduce((s, o) => s + o.kg, 0) + b.kg; if (kg > vehMaxCargo(V.v) + 1) { lastMoveErr = 'excesso de peso no veículo'; if (!silent) toast('Não é possível: ' + lastMoveErr + '.', true); return false; }
  const al = axleLoads(V.v, [...others, b]); const bad = al.find(a => a.tot > NX.axLim(a) + 1);
  if (bad && !NX.opcoes().manual) { lastMoveErr = 'excede o limite do eixo ' + bad.n; if (!silent) toast('Não é possível: ' + lastMoveErr + '.', true); return false; }
  if (bad && !silent) { const was = axleLoads(V.v, V.items).some(a => a.tot > a.lim + 1); if (!was) toast('Atenção: ' + bad.n + ' passou do limite legal.', true); }
  Object.assign(it, { x: b.x, y: b.y, z: b.z, wg: b.wg, l: b.l, w: b.w, h: b.h, ax: b.ax, ok: b.ok }); rebuildLoads(V.items); placeMesh(it); highlight(); if (typeof axHud === 'function') axHud(); return true;
}
function moveSel(dx, dy) {
  if (!sel) return toast('Selecione um volume (clique nele ou na lista).');
  const V = plan.vehs[active]; let x = sel.x + dx, wg = sel.wg;
  if (x + sel.l > V.v.L + 1e-6 && wg < V.v.wag - 1) { wg++; x = 0; } else if (x < -1e-6 && wg > 0) { wg--; x = V.v.L - sel.l; }
  const s = snap(sel);
  if (tryMove(sel, { x: clamp(x, 0, V.v.L - sel.l), y: clamp(sel.y + dy, 0, V.v.W - sel.w), wg })) { pushHist(sel, s); afterEdit(); $('#live').textContent = (typeof describeItem === 'function') ? 'Movido. ' + describeItem(sel) : `Volume ${sel.n} em x ${fmt(sel.x, 2)} m`; }
}
const same = (o, it) => Math.abs(o.l - it.l) < 1e-6 && Math.abs(o.w - it.w) < 1e-6 && Math.abs(o.h - it.h) < 1e-6 && (!o.ax || !it.ax || o.ax === it.ax || (o.ax !== 'v' && it.ax !== 'v' && it.p.tipo !== 'bobina'));
function applyOri(o, label) { const s = snap(sel); if (tryMove(sel, { l: o.l, w: o.w, h: o.h, ax: o.ax, ok: o.k, x: clamp(sel.x, 0, plan.vehs[active].v.L - o.l), y: clamp(sel.y, 0, plan.vehs[active].v.W - o.w), wg: sel.wg })) { pushHist(sel, s); afterEdit(); toast(label + ` — ocupa C ${fmt(sel.l, 2)} × L ${fmt(sel.w, 2)} m`); return true; } return false; }
function cycleOri() {
  if (!sel) return toast('Selecione um volume.', true); const os = orientations(sel.p); const i = os.findIndex(o => same(o, sel));
  for (let k = 1; k < os.length + (i < 0 ? 1 : 0); k++) { const o = os[(Math.max(i, 0) + k) % os.length]; const s = snap(sel); if (tryMove(sel, { l: o.l, w: o.w, h: o.h, ax: o.ax, ok: o.k, x: sel.x, y: sel.y, wg: sel.wg }, true)) { pushHist(sel, s); afterEdit(); toast('Orientação: ' + o.k); return; } }
  toast(os.length < 2 ? 'Este produto só tem uma orientação permitida.' : 'Nenhuma outra orientação permitida cabe nesta posição.', true);
}
function rot90() {
  if (!sel) return toast('Selecione um volume.', true);
  const o = orientations(sel.p).find(q => Math.abs(q.l - sel.w) < 1e-6 && Math.abs(q.w - sel.l) < 1e-6 && Math.abs(q.h - sel.h) < 1e-6);
  if (!o) return toast('Girar 90° não é permitido pelas orientações cadastradas deste produto.', true);
  if (!applyOri(o, 'Girado 90°')) toast('Não é possível girar: ' + lastMoveErr + '.', true);
}
function layDown() {
  if (!sel) return toast('Selecione um volume.', true);
  const lay = orientations(sel.p).filter(q => q.h < sel.h - 1e-6 || (sel.p.tipo === 'bobina' && q.ax !== 'v' && sel.ax === 'v'));
  if (!lay.length) return toast(sel.p.tipo === 'bigbag' ? 'Big bag não pode ser deitado.' : 'Deitar não é permitido pelas orientações cadastradas deste produto.', true);
  for (const o of lay) if (applyOri(o, 'Volume deitado')) return;
  toast('Não é possível deitar aqui: ' + lastMoveErr + '.', true);
}

/* centraliza a câmera no volume selecionado */
function focusSel() { if (!sel) return; const m = meshes.get(sel); if (!m) return; const tg = m.position.clone(); tg.y += sel.h / 2; const off = camera.position.clone().sub(controls.target).setLength(Math.max(4, sel.l * 4)); camTween = { from: camera.position.clone(), ft: controls.target.clone(), pos: tg.clone().add(off), tgt: tg, t: 0 }; }
/* qualquer mudança na cena pede um novo desenho */
for (const f of ['buildScene', 'placeMesh', 'highlight', 'setWalls', 'setDoors', 'updateVoids', 'updateBrand', 'resize', 'setView', 'tryMove', 'startAnim', 'stopAnim', 'restore']) {
  const o = window[f]; if (typeof o === 'function') window[f] = function () { const r = o.apply(this, arguments); invalidate(); return r; };
}
