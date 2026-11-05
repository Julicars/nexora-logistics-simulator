/* Câmera, playback de animação e laço de render. Depende de nucleo.js e cena.js. */
'use strict';

/* ---------- Encaixe animado: cada volume entra pela porta e desliza até o lugar ---------- */
const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let voando = [], ultimoN = -1;

// Quantos volumes ficam em movimento ao mesmo tempo (cada um leva de 0,4 s a 0,9 s)
function emVoo() {
  if (reduzir) return 1e-6;
  const d = 0.9 - 0.42 * Math.min(1, Math.log10(Math.max(1, st.vel)) / 2);
  return Math.max(1, Math.min(160, st.vel * d));
}

function matrizVoo(i, p) {
  const c = st.res.colocados[i], v = st.res.veiculo;
  const porta = c.vagao * (v.c + v.gap) + v.c - c.dx * 0.5; // entra pela porta
  const sobe = c.palete ? 0.12 : Math.min(0.25, Math.max(0, v.h - c.z - c.dz - 0.01));
  const fase = 0.8;
  let x, z;
  if (p < fase) { x = porta + (c.gx - porta) * suave(p / fase); z = c.z + sobe; }
  else { x = c.gx; z = c.z + sobe * (1 - saida((p - fase) / (1 - fase))); }
  matrizesDe(c, x, z, 0.55 + 0.45 * saida(Math.min(1, p / 0.18)));
}

function aplicarMostrados() {
  if (!st.res || !malha) return;
  const total = st.res.colocados.length, m = st.mostrados, k = emVoo();
  const visiveis = Math.min(total, Math.max(0, Math.ceil(m - 1e-9)));
  const assentados = Math.min(visiveis, Math.max(st.base, Math.floor(m - k + 1e-9) + 1));
  const novos = [];
  for (let i = assentados; i < visiveis; i++) {
    matrizVoo(i, Math.min(1, Math.max(0, (m - i) / k)));
    malha.setMatrixAt(i, mTmp);
    malhaEstrado.setMatrixAt(i, mEst);
    novos.push(i);
  }
  for (const i of voando) if (i < assentados || i >= visiveis) { malha.setMatrixAt(i, matrizesBase[i]); malhaEstrado.setMatrixAt(i, matrizesEstrado[i]); }
  if (novos.length || voando.length) { malha.instanceMatrix.needsUpdate = true; malhaEstrado.instanceMatrix.needsUpdate = true; }
  voando = novos;
  malha.count = malhaEstrado.count = visiveis;
  arestas.geometry.setDrawRange(0, assentados * 24);
  detalhes.geometry.setDrawRange(0, inicioDetalhe[assentados] || 0);
  if (visiveis !== ultimoN) {
    ultimoN = visiveis;
    $('#rngPasso').value = visiveis;
    $('#lblPasso').textContent = `${ni(visiveis)} ${T('of')} ${plural(total, 'volume', 'volumes')}`;
  }
}

function tocar(sim) {
  const total = st.res ? st.res.colocados.length : 0;
  st.tocando = sim && total > 0;
  if (st.tocando && st.mostrados >= total) st.mostrados = st.base = 0;
  if (st.tocando) definirPorta(true);
  $('#btnPlay').setAttribute('aria-label', T(st.tocando ? 'player.pause' : 'player.play'));
  $('#icoPlay').innerHTML = st.tocando
    ? '<path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/>'
    : '<path d="M4 2.5v11l9-5.5z" fill="currentColor"/>';
}

/* ---------- Câmera ---------- */
let anim = null;
function irPara(vista, imediato) {
  st.vista = vista;
  document.querySelectorAll('.vista').forEach((b) => b.classList.toggle('ativo', b.dataset.vista === vista));
  if (!spec) return;
  // com veículos extras ao lado (carga que não coube), enquadra o conjunto todo
  const ext = typeof enquadreExtras === 'function' ? enquadreExtras() : { z: 0, larg: 0 };
  const total = Math.max(9, spec.comprimento) + ext.larg * 0.9, h = spec.H;
  const f = Math.max(1, 1.7 / Math.max(0.4, camera.aspect || 1.6));
  const alvo = new THREE.Vector3(0, DECK + h * 0.35, ext.z);
  let pos;
  switch (vista) {
    case 'sup': pos = new THREE.Vector3(0, total * 1.25 * f + 4, 0.01); alvo.y = DECK; break;
    case 'lat': pos = new THREE.Vector3(0, DECK + h * 0.55, total * 1.2 * f + 3); break;
    case 'tras': pos = new THREE.Vector3(total / 2 + 6 + 3 * f, DECK + h * 0.95, 1.2); alvo.set(total * 0.12, DECK + h * 0.45, 0); break;
    case 'front': pos = new THREE.Vector3(-total / 2 - 6 - 3 * f, DECK + h * 1.05, -1.2); break;
    default: pos = new THREE.Vector3(-total * 0.42 * f, DECK + total * 0.4 * f + 2, total * 0.72 * f + 2);
  }
  pos.z += ext.z;
  if (vista === 'tras' || vista === 'front') alvo.z = ext.z;
  if (imediato) { camera.position.copy(pos); controls.target.copy(alvo); controls.update(); anim = null; return; }
  anim = { de: camera.position.clone(), para: pos, alvoDe: controls.target.clone(), alvoPara: alvo, t: 0 };
}

function redimensionar() {
  const w = vp.clientWidth, h = vp.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(() => { const a = camera.aspect; redimensionar(); if (Math.abs(a - camera.aspect) > 0.15) irPara(st.vista, true); }).observe(vp);

let tAnt = performance.now();
function laco(t) {
  const dt = Math.min(0.1, (t - tAnt) / 1000);
  tAnt = t;
  if (st.tocando && st.res) {
    const total = st.res.colocados.length, fim = total + emVoo();
    st.mostrados = Math.min(fim, st.mostrados + st.vel * dt);
    if (st.mostrados >= fim) { st.mostrados = st.base = total; tocar(false); }
  }
  if (portaAtual !== st.portaAlvo) {
    const passo = reduzir ? 1 : dt / 1.1;
    portaAtual = st.portaAlvo > portaAtual ? Math.min(1, portaAtual + passo) : Math.max(0, portaAtual - passo);
    aplicarPorta();
  }
  if (anim) {
    anim.t = Math.min(1, anim.t + dt / (reduzir ? 0.01 : 0.6));
    const e = saida(anim.t);
    camera.position.lerpVectors(anim.de, anim.para, e);
    controls.target.lerpVectors(anim.alvoDe, anim.alvoPara, e);
    if (anim.t >= 1) anim = null;
  }
  aplicarMostrados();
  controls.update();
  atualizarCotas();
  renderer.render(scene, camera);
  requestAnimationFrame(laco);
}
