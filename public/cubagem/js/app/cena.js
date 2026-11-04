/* Cena 3D: veículo e volumes (Three.js). Depende de nucleo.js. */
'use strict';

const vp = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
vp.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#10141a');
const camera = new THREE.PerspectiveCamera(38, 1.6, 0.1, 600);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;

scene.add(new THREE.HemisphereLight(0xdde6ff, 0x20242c, 0.95));
const sol = new THREE.DirectionalLight(0xffffff, 0.8);
sol.position.set(-12, 22, 14);
scene.add(sol);
const contra = new THREE.DirectionalLight(0x9fb4ff, 0.3);
contra.position.set(14, 8, -10);
scene.add(contra);

function discoGradiente(raio, paradas, ordem) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  paradas.forEach(([p, c]) => gr.addColorStop(p, c));
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(raio, raio, 1);
  m.renderOrder = ordem;
  scene.add(m);
  return m;
}
// chão iluminado no centro e sombra suave sob o veículo
discoGradiente(70, [[0, 'rgba(30,37,47,1)'], [0.4, 'rgba(21,26,33,0.9)'], [1, 'rgba(16,20,26,0)']], -3);
const sombra = discoGradiente(1, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0)']], -2);
sombra.position.y = 0.002;

// Lateral do estrado de madeira: tábuas e vãos para o garfo da empilhadeira
const texturaEstrado = (function () {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#b88a57';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(70,45,20,0.25)';
  for (let i = 0; i < 9; i++) g.fillRect(0, 4 + i * 7, 256, 1);
  g.fillStyle = '#2e2216';
  [[0.13, 0.42], [0.58, 0.87]].forEach(([a, b]) => g.fillRect(a * 256, 20, (b - a) * 256, 32));
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, 18, 256, 2);
  g.fillRect(0, 52, 256, 2);
  const t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  return t;
})();

let grupoVeiculo = null, spec = null;
let matLona = [], matTexto = [], portas = [];
let malha = null, malhaEstrado = null, arestas = null, detalhes = null;
let matrizesBase = [], matrizesEstrado = [], inicioDetalhe = [];
let cx0 = 0, largW = 2.5, DECK = 1.25, portaAtual = 0;

// coordenadas da carga (X comprimento, Y largura, Z altura) -> Three.js (y para cima)
const P = (x, y, z) => new THREE.Vector3(x - cx0, DECK + z, y - largW / 2);

function construirVeiculo(v) {
  if (grupoVeiculo) {
    scene.remove(grupoVeiculo);
    grupoVeiculo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
  spec = Veiculo3D.especificar(v);
  DECK = spec.deck;
  largW = spec.W;
  cx0 = (spec.xFrente + spec.xTras) / 2;
  const r = Veiculo3D.construir(spec, P, { cor: COR_LONA, texto: TEXTO_LONA });
  grupoVeiculo = r.grupo;
  matLona = r.lonas;
  matTexto = r.textos;
  portas = r.portas;
  scene.add(grupoVeiculo);
  sombra.scale.set(spec.comprimento + 5, spec.W * 3.4, 1);
  aplicarAtraves();
  aplicarPorta();
  irPara(st.vista, true);
  if (st.res) construirVolumes(st.res);
}

function aplicarAtraves() {
  matLona.forEach((m) => { m.opacity = st.atraves ? 0.16 : 1; m.depthWrite = !st.atraves; m.needsUpdate = true; });
  matTexto.forEach((m) => { m.opacity = st.atraves ? 0.85 : 1; m.needsUpdate = true; });
  const b = $('#btnAtraves');
  b.setAttribute('aria-pressed', String(st.atraves));
  const t = T(st.atraves ? 'through.hide' : 'through.show');
  b.title = t; b.setAttribute('aria-label', t);
}

/* ---------- Porta traseira ---------- */
function aplicarPorta() {
  const a = suave(portaAtual) * Veiculo3D.ABERTURA_PORTA;
  portas.forEach((p) => { p.pivo.rotation.y = p.sinal * a; });
}
function definirPorta(aberta) {
  st.portaAlvo = aberta ? 1 : 0;
  const b = $('#btnPorta'), t = T(aberta ? 'door.close' : 'door.open');
  b.setAttribute('aria-pressed', String(aberta));
  b.title = t; b.setAttribute('aria-label', t);
}

/* ---------- Volumes: caixas, paletes (carga + estrado) e linhas ---------- */
const ARESTAS_CUBO = [
  [0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1],
];
const mTmp = new THREE.Matrix4(), mEst = new THREE.Matrix4(), vTmp = new THREE.Vector3(), qId = new THREE.Quaternion(), sTmp = new THREE.Vector3();
const ZERO = new THREE.Vector3(0, 0, 0);

// Matrizes da carga (mTmp) e do estrado (mEst) de um volume na posição x, z, com escala e
function matrizesDe(c, x, z, e) {
  if (c.palete) {
    const hb = Math.min(BASE_PALETE, c.dz * 0.4), ins = 0.015;
    vTmp.copy(P(x + c.dx / 2, c.y + c.dy / 2, z + hb + (c.dz - hb) / 2));
    sTmp.set((c.dx - 2 * ins) * e, (c.dz - hb - FOLGA) * e, (c.dy - 2 * ins) * e);
    mTmp.compose(vTmp, qId, sTmp);
    vTmp.copy(P(x + c.dx / 2, c.y + c.dy / 2, z + hb / 2));
    sTmp.set((c.dx - FOLGA) * e, hb * e, (c.dy - FOLGA) * e);
    mEst.compose(vTmp, qId, sTmp);
  } else {
    vTmp.copy(P(x + c.dx / 2, c.y + c.dy / 2, z + c.dz / 2));
    sTmp.set((c.dx - FOLGA) * e, (c.dz - FOLGA) * e, (c.dy - FOLGA) * e);
    mTmp.compose(vTmp, qId, sTmp);
    mEst.compose(vTmp, qId, ZERO);
  }
}

// Linhas de camadas e colunas sobre a carga do palete (aparência de caixas empilhadas e filmadas)
function linhasPalete(c, out) {
  const hb = Math.min(BASE_PALETE, c.dz * 0.4), ins = 0.015, o = 0.004;
  const x0 = c.gx + ins - o, x1 = c.gx + c.dx - ins + o, y0 = c.y + ins - o, y1 = c.y + c.dy - ins + o;
  const z0 = c.z + hb, z1 = c.z + c.dz;
  const seg = (a, b) => { const p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]); out.push(p.x, p.y, p.z, q.x, q.y, q.z); };
  const nz = Math.max(2, Math.round((z1 - z0) / 0.3));
  for (let k = 1; k < nz; k++) {
    const z = z0 + ((z1 - z0) * k) / nz;
    seg([x0, y0, z], [x1, y0, z]); seg([x0, y1, z], [x1, y1, z]);
    seg([x0, y0, z], [x0, y1, z]); seg([x1, y0, z], [x1, y1, z]);
  }
  const nx = Math.max(2, Math.round((x1 - x0) / 0.4)), ny = Math.max(2, Math.round((y1 - y0) / 0.4));
  for (let k = 1; k < nx; k++) { const x = x0 + ((x1 - x0) * k) / nx; seg([x, y0, z0], [x, y0, z1]); seg([x, y1, z0], [x, y1, z1]); }
  for (let k = 1; k < ny; k++) { const y = y0 + ((y1 - y0) * k) / ny; seg([x0, y, z0], [x0, y, z1]); seg([x1, y, z0], [x1, y, z1]); }
}

function construirVolumes(res) {
  [malha, malhaEstrado, arestas, detalhes].forEach((m) => {
    if (!m) return;
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  const n = res.colocados.length, cap = Math.max(1, n);
  malha = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.04 }), cap);
  malhaEstrado = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: texturaEstrado, roughness: 0.9 }), cap);
  [malha, malhaEstrado].forEach((m) => m.instanceMatrix.setUsage(THREE.DynamicDrawUsage));
  matrizesBase = []; matrizesEstrado = []; inicioDetalhe = [];
  const posArestas = new Float32Array(n * 24 * 3), det = [];
  res.colocados.forEach((c, i) => {
    matrizesDe(c, c.gx, c.z, 1);
    matrizesBase.push(mTmp.clone());
    matrizesEstrado.push(mEst.clone());
    malha.setMatrixAt(i, mTmp);
    malhaEstrado.setMatrixAt(i, mEst);
    const z0 = c.palete ? c.z + Math.min(BASE_PALETE, c.dz * 0.4) : c.z, h = c.z + c.dz - z0;
    ARESTAS_CUBO.forEach((a, k) => {
      const p1 = P(c.gx + a[0] * c.dx, c.y + a[1] * c.dy, z0 + a[2] * h);
      const p2 = P(c.gx + a[3] * c.dx, c.y + a[4] * c.dy, z0 + a[5] * h);
      posArestas.set([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z], (i * 24 + k * 2) * 3);
    });
    inicioDetalhe.push(det.length / 3);
    if (c.palete) linhasPalete(c, det);
  });
  inicioDetalhe.push(det.length / 3);
  colorirVolumes();
  malha.count = malhaEstrado.count = 0;
  scene.add(malha, malhaEstrado);
  const ga = new THREE.BufferGeometry();
  ga.setAttribute('position', new THREE.BufferAttribute(posArestas, 3));
  arestas = new THREE.LineSegments(ga, new THREE.LineBasicMaterial({ color: 0x0a0d12, transparent: true, opacity: 0.45 }));
  ga.setDrawRange(0, 0);
  const gd = new THREE.BufferGeometry();
  gd.setAttribute('position', new THREE.Float32BufferAttribute(det, 3));
  detalhes = new THREE.LineSegments(gd, new THREE.LineBasicMaterial({ color: 0x0a0d12, transparent: true, opacity: 0.3 }));
  gd.setDrawRange(0, 0);
  scene.add(arestas, detalhes);
  voando = [];
  ultimoN = -1;
}

function colorirVolumes() {
  if (!malha || !st.res) return;
  const c = new THREE.Color(), cinza = new THREE.Color('#2b323c').convertSRGBToLinear();
  st.res.colocados.forEach((p, i) => {
    c.set(cor(p.pi)).convertSRGBToLinear();
    c.offsetHSL(0, 0, ((((i * 2654435761) % 1000) / 1000) - 0.5) * 0.06); // textura de papelão
    if (st.destaque >= 0 && p.pi !== st.destaque) c.lerp(cinza, 0.82);
    if (i === st.sel) c.set(drag && drag.i === i && !drag.valido ? COR_INVALIDA : COR_SELECAO).convertSRGBToLinear();
    malha.setColorAt(i, c);
  });
  if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
}
