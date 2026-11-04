/* Seleção, dica (tooltip), arrastar/girar/deitar e física de apoio. Depende de nucleo.js, cena.js, camera.js. */
'use strict';

/* ---------- Dica ao passar o mouse sobre um volume ---------- */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $('#tooltip');
let pendenteRay = null;
vp.addEventListener('pointermove', (ev) => { pendenteRay = ev; });
vp.addEventListener('pointerleave', () => { pendenteRay = null; tip.hidden = true; st.hover = -1; vp.classList.remove('sobre-item'); });
const linhaTip = (a, b) => `<div class="t-l"><span>${a}</span><span>${b}</span></div>`;
setInterval(() => {
  if (!pendenteRay || !malha || !st.res) return;
  const ev = pendenteRay; pendenteRay = null;
  if (ev.buttons) { tip.hidden = true; return; }
  if (drag) return;
  const r = vp.getBoundingClientRect();
  mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(malha, false)[0];
  st.hover = hit && hit.instanceId != null ? hit.instanceId : -1;
  vp.classList.toggle('sobre-item', st.editar && st.hover >= 0 && st.hover === st.sel);
  if (st.hover < 0) { tip.hidden = true; return; }
  const c = st.res.colocados[hit.instanceId], p = st.pedidos[c.pi];
  const emCima = c.limite === 0 ? T('empty.doesntStack')
    : isFinite(c.limite) ? `${ni(c.carga)} ${T('of')} ${ni(c.limite)} kg` : c.carga > 0 ? `${ni(c.carga)} kg` : T('tip.nothing');
  tip.innerHTML =
    `<b style="color:${cor(c.pi)}">${esc(p.nome)}</b>` +
    linhaTip(T('tip.order'), esc(p.codigo)) +
    linhaTip(T(c.palete ? 'tip.pallet' : 'tip.volume'), `nº ${ni(c.seq + 1)}${st.res.veiculo.vagoes > 1 ? ' · ' + T('det.wagon', { n: c.vagao + 1 }).toLowerCase() : ''}`) +
    (c.palete ? linhaTip(T('tip.pieces'), `${ni(c.pecas)} × ${nf(c.peso / c.pecas, 2)} kg`) : '') +
    linhaTip(T('tip.weight'), `${nf(c.peso, c.peso >= 100 ? 0 : 1)} kg`) +
    linhaTip(T('tip.weightOnTop'), emCima) +
    linhaTip(T('tip.distanceFromFront'), `${nf(c.x)} m`) +
    linhaTip(T('tip.dimensions'), `${nf(c.dx)} × ${nf(c.dy)} × ${nf(c.dz)} m`);
  tip.hidden = false;
  const pw = vp.parentElement.getBoundingClientRect();
  let x = ev.clientX - pw.left + 14, y = ev.clientY - pw.top + 14;
  if (x + 250 > pw.width) x -= 270;
  if (y + 200 > pw.height) y -= 210;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}, 60);

/* ================= Mover paletes (mouse destravado) ================= */
const EPS = 1e-6;
const dicaEl = $('#dica');
const planoDrag = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const contornoGeo = new THREE.BufferGeometry();
contornoGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
const contorno = new THREE.LineLoop(contornoGeo, new THREE.LineBasicMaterial({ color: 0xf5a033, depthTest: false, transparent: true }));
contorno.renderOrder = 20; contorno.frustumCulled = false; contorno.visible = false;
scene.add(contorno);
let drag = null, clique = null, tmrDica = null;

/* ---------- Dica na parte de baixo do palco ---------- */
function mostrarDica(msg, erroFlag, ms) {
  clearTimeout(tmrDica);
  dicaEl.textContent = msg;
  dicaEl.className = 'dica' + (erroFlag ? ' erro' : '');
  dicaEl.hidden = false;
  if (ms) tmrDica = setTimeout(restaurarDica, ms);
}
function restaurarDica() {
  clearTimeout(tmrDica);
  dicaEl.className = 'dica';
  dicaEl.textContent = st.editar ? T('edit.hint') : '';
  dicaEl.hidden = !st.editar;
}

/* ---------- Trava do mouse ---------- */
function atualizarTrava() {
  const b = $('#btnTrava'), t = T(st.editar ? 'lock.lock' : 'lock.unlock');
  b.setAttribute('aria-pressed', String(st.editar));
  b.title = t; b.setAttribute('aria-label', t);
  if (!dicaEl.hidden && !dicaEl.classList.contains('erro')) restaurarDica();
}
function definirEdicao(on) {
  st.editar = on;
  vp.classList.toggle('editando', on);
  if (!on) { drag = null; vp.classList.remove('arrastando', 'sobre-item'); selecionar(-1); }
  atualizarTrava();
  restaurarDica();
  atualizarFerramentas();
}

/* ---------- Seleção ---------- */
function selecionar(i) {
  if (st.sel === i) return;
  st.sel = i;
  colorirVolumes();
  atualizarFerramentas();
}
function atualizarFerramentas() {
  $('#ferramentas').hidden = !(st.editar && st.sel >= 0);
}
function pegar(ev) {
  if (!malha || !st.res) return -1;
  const r = vp.getBoundingClientRect();
  mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(malha, false)[0];
  return hit && hit.instanceId != null ? hit.instanceId : -1;
}

/* ---------- Física simples: apoio, colisão e peso sobre cada volume ---------- */
const caixaDe = (c, o) => Object.assign({ vagao: c.vagao, x: c.x, y: c.y, z: c.z, dx: c.dx, dy: c.dy, dz: c.dz, peso: c.peso, limite: c.limite }, o || {});
const sobreposto = (a, b) => {
  const ox = Math.min(a.x + a.dx, b.x + b.dx) - Math.max(a.x, b.x), oy = Math.min(a.y + a.dy, b.y + b.dy) - Math.max(a.y, b.y);
  return ox > EPS && oy > EPS ? ox * oy : 0;
};

// O peso desce de cima para baixo, repartido pela área de contato (igual ao empacotador)
function recalcularCargas(arr) {
  arr.forEach((b) => { b.carga = 0; b.sup = []; });
  for (const b of arr) {
    if (b.z <= EPS) continue;
    let tot = 0;
    for (const o of arr) {
      if (o === b || o.vagao !== b.vagao || Math.abs(o.z + o.dz - b.z) > 1e-4) continue;
      const a = sobreposto(b, o);
      if (a > 0) { b.sup.push({ o, a }); tot += a; }
    }
    b.sup.forEach((s) => { s.f = s.a / tot; });
  }
  arr.slice().sort((p, q) => q.z - p.z).forEach((b) => { const w = b.peso + b.carga; b.sup.forEach((s) => { s.o.carga += w * s.f; }); });
}

// Tem algum volume apoiado em cima deste?
function bloqueado(i) {
  const c = st.res.colocados[i], topo = c.z + c.dz, a = caixaDe(c);
  return st.res.colocados.some((o, j) => j !== i && o.vagao === c.vagao && Math.abs(o.z - topo) < 1e-4 && sobreposto(a, caixaDe(o)) > 0);
}

// Testa uma posição (canto gx, y): encaixa nas paredes e nos vizinhos, empurra para fora de colisões,
// empilha sobre o que estiver embaixo e confere altura, apoio, peso e carga máxima do vagão.
function avaliar(i, gxC, yC, dim) {
  const r = st.res, v = r.veiculo, c = r.colocados[i], passo = v.c + v.gap, d = dim || c;
  const k = Math.max(0, Math.min(v.vagoes - 1, Math.floor((gxC + d.dx / 2 + v.gap / 2) / passo)));
  const limX = v.c - d.dx, limY = v.l - d.dy;
  let x = Math.min(Math.max(gxC - k * passo, 0), limX), y = Math.min(Math.max(yC, 0), limY), z = 0;
  const outros = r.colocados.filter((o, j) => j !== i && o.vagao === k);
  const SNAP = 0.1;
  const perto = (val, alvos) => { let m = val, d = SNAP; for (const t of alvos) if (Math.abs(t - val) < d) { d = Math.abs(t - val); m = t; } return m; };
  const ax = [0, limX], ay = [0, limY];
  for (const o of outros) if (o.y - d.dy - 0.05 < y && y < o.y + o.dy + 0.05) ax.push(o.x + o.dx, o.x - d.dx, o.x, o.x + o.dx - d.dx);
  x = Math.min(Math.max(perto(x, ax), 0), limX);
  for (const o of outros) if (o.x - d.dx - 0.05 < x && x < o.x + o.dx + 0.05) ay.push(o.y + o.dy, o.y - d.dy, o.y, o.y + o.dy - d.dy);
  y = Math.min(Math.max(perto(y, ay), 0), limY);

  // com mais da metade em cima de outro volume, empilha; com menos, é empurrado para o lado
  let info = [], livre = false;
  for (let t = 0; t < 8 && !livre; t++) {
    info = [];
    for (const o of outros) {
      const ox = Math.min(x + d.dx, o.x + o.dx) - Math.max(x, o.x), oy = Math.min(y + d.dy, o.y + o.dy) - Math.max(y, o.y);
      if (ox > EPS && oy > EPS) info.push({ o, ox, oy, f: (ox * oy) / (d.dx * d.dy) });
    }
    z = 0;
    info.forEach((q) => { if (q.f >= 0.5) z = Math.max(z, q.o.z + q.o.dz); });
    const bate = info.find((q) => q.f < 0.5 && q.o.z < z + d.dz - 1e-4 && q.o.z + q.o.dz > z + 1e-4);
    if (!bate) { livre = true; break; }
    if (bate.ox <= bate.oy) x = Math.min(Math.max(x + (x + d.dx / 2 < bate.o.x + bate.o.dx / 2 ? -bate.ox : bate.ox), 0), limX);
    else y = Math.min(Math.max(y + (y + d.dy / 2 < bate.o.y + bate.o.dy / 2 ? -bate.oy : bate.oy), 0), limY);
  }
  const res = (ok, motivo) => ({ ok, motivo, k, x, y, z, gx: k * passo + x });
  if (!livre) return res(false, 'space');
  if (z + d.dz > v.h + 1e-4) return res(false, 'height');
  if (z > EPS) {
    let area = 0;
    for (const q of info) if (Math.abs(q.o.z + q.o.dz - z) < 1e-4) {
      if (!(q.o.limite > EPS)) return res(false, 'load');
      area += q.ox * q.oy;
    }
    if (area < st.apoioMin * d.dx * d.dy - 1e-9) return res(false, 'support');
  }
  const arr = r.colocados.map((o, j) => caixaDe(o, j === i ? { vagao: k, x, y, z, dx: d.dx, dy: d.dy, dz: d.dz } : null));
  recalcularCargas(arr);
  if (arr.some((b) => b.carga > b.limite + 1e-6)) return res(false, 'load');
  if (v.cargaKg && k !== c.vagao) {
    const kg = outros.reduce((s2, o) => s2 + o.peso, 0) + c.peso;
    if (kg > v.cargaKg / v.vagoes + 1e-6) return res(false, 'cap');
  }
  return res(true);
}

// Move só um volume na cena (matrizes, arestas e linhas do palete), sem refazer tudo
function atualizarVolume(i, p) {
  const c = st.res.colocados[i], t = { palete: c.palete, dx: c.dx, dy: c.dy, dz: c.dz, y: p.y, z: p.z, gx: p.gx };
  matrizesDe(t, p.gx, p.z, 1);
  matrizesBase[i] = mTmp.clone(); matrizesEstrado[i] = mEst.clone();
  malha.setMatrixAt(i, mTmp); malhaEstrado.setMatrixAt(i, mEst);
  malha.instanceMatrix.needsUpdate = malhaEstrado.instanceMatrix.needsUpdate = true;
  const z0 = c.palete ? p.z + Math.min(BASE_PALETE, c.dz * 0.4) : p.z, h = p.z + c.dz - z0, pa = arestas.geometry.attributes.position;
  ARESTAS_CUBO.forEach((a, k) => {
    const p1 = P(p.gx + a[0] * c.dx, p.y + a[1] * c.dy, z0 + a[2] * h), p2 = P(p.gx + a[3] * c.dx, p.y + a[4] * c.dy, z0 + a[5] * h);
    pa.array.set([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z], (i * 24 + k * 2) * 3);
  });
  pa.needsUpdate = true;
  if (c.palete) {
    const out = [], pd = detalhes.geometry.attributes.position;
    linhasPalete(t, out);
    pd.array.set(out, inicioDetalhe[i] * 3);
    pd.needsUpdate = true;
  }
}

function recalcularStats() {
  const r = st.res, s = r.stats, v = r.veiculo;
  r.porVagao.forEach((p) => { p.volumes = 0; p.kg = 0; p.vol = 0; });
  let kg = 0, mx = 0, my = 0, piso = 0, alt = 0;
  for (const c of r.colocados) {
    const pv = r.porVagao[c.vagao];
    pv.volumes++; pv.kg += c.peso; pv.vol += c.dx * c.dy * c.dz;
    kg += c.peso; mx += c.peso * (c.gx + c.dx / 2); my += c.peso * (c.y + c.dy / 2);
    if (c.z < EPS) piso += c.dx * c.dy;
    alt = Math.max(alt, c.z + c.dz);
  }
  r.porVagao.forEach((p) => { p.ocupacao = p.vol / (v.c * v.l * v.h); });
  s.cgX = kg > 0 ? mx / kg : 0;
  s.cgY = kg > 0 ? my / kg : v.l / 2;
  s.alturaMax = alt;
  s.pisoOcupado = piso / (v.vagoes * v.c * v.l);
}

function confirmarMovimento(i, p) {
  const c = st.res.colocados[i];
  Object.assign(c, { vagao: p.k, x: p.x, y: p.y, z: p.z, gx: p.gx });
  atualizarVolume(i, c);
  const arr = st.res.colocados.map((o) => caixaDe(o));
  recalcularCargas(arr);
  arr.forEach((b, j) => { st.res.colocados[j].carga = b.carga; });
  recalcularStats();
  calcularEixos();
}


/* ---------- Girar e deitar o volume selecionado ---------- */
// girar: troca comprimento e largura (90° em torno do eixo vertical); deitar: tomba o volume de lado (troca largura e altura)
function transformar(tipo) {
  if (!st.editar || st.sel < 0 || !st.res || drag) return;
  const i = st.sel, c = st.res.colocados[i];
  if (bloqueado(i)) { mostrarDica(T('edit.blocked'), true, 2600); return; }
  const nd = tipo === 'girar' ? { dx: c.dy, dy: c.dx, dz: c.dz } : { dx: c.dx, dy: c.dz, dz: c.dy };
  // mantém o centro do volume no mesmo lugar
  const cand = avaliar(i, c.gx + (c.dx - nd.dx) / 2, c.y + (c.dy - nd.dy) / 2, nd);
  if (!cand.ok) { mostrarDica(T('edit.invalid.' + cand.motivo), true, 2600); return; }
  Object.assign(c, nd, { vagao: cand.k, x: cand.x, y: cand.y, z: cand.z, gx: cand.gx });
  const arr = st.res.colocados.map((o) => caixaDe(o));
  recalcularCargas(arr);
  arr.forEach((b, j) => { st.res.colocados[j].carga = b.carga; });
  recalcularStats();
  construirVolumes(st.res);   // o desenho do volume muda de forma: refaz as malhas
  calcularEixos();
  restaurarDica();
}
$('#btnGirar').addEventListener('click', () => transformar('girar'));
$('#btnDeitar').addEventListener('click', () => transformar('deitar'));
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
  if (e.key === 'r' || e.key === 'R') transformar('girar');
  else if (e.key === 'd' || e.key === 'D') transformar('deitar');
  else if (e.key === 'Escape' && st.editar && st.sel >= 0 && !modalAberto) selecionar(-1);
  // acessibilidade: com um item selecionado, setas também movem (nudge) sem precisar do mouse
  else if (st.editar && st.sel >= 0 && !drag && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    if (bloqueado(st.sel)) { mostrarDica(T('edit.blocked'), true, 2600); return; }
    e.preventDefault();
    const c = st.res.colocados[st.sel], passo = e.shiftKey ? 0.5 : 0.1;
    const dgx = e.key === 'ArrowLeft' ? -passo : e.key === 'ArrowRight' ? passo : 0;
    const dy = e.key === 'ArrowUp' ? -passo : e.key === 'ArrowDown' ? passo : 0;
    const cand = avaliar(st.sel, c.gx + dgx, c.y + dy);
    if (cand.ok) { confirmarMovimento(st.sel, cand); colorirVolumes(); restaurarDica(); }
    else mostrarDica(T('edit.invalid.' + cand.motivo), true, 1800);
  }
});

/* ---------- Mouse: arrastar com o mouse destravado, clicar para selecionar ---------- */
const tmpPt = new THREE.Vector3();
vp.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0 || !st.res) return;
  if (ev.target.closest && ev.target.closest('#ferramentas')) return;   // botões de girar/deitar
  const i = pegar(ev);
  if (!st.editar) return;   // travado: o mouse só mostra as informações, não seleciona
  if (drag) return;
  clique = { x: ev.clientX, y: ev.clientY, i };
  // só o item já selecionado é arrastado; em qualquer outro lugar o arraste gira a câmera
  if (i < 0 || i !== st.sel) return;
  if (bloqueado(i)) { mostrarDica(T('edit.blocked'), true, 2600); return; }   // deixa a câmera girar
  const total = st.res.colocados.length;
  if (st.tocando || st.mostrados < total) { tocar(false); st.mostrados = st.base = total; aplicarMostrados(); }
  const c = st.res.colocados[i];
  planoDrag.constant = -(DECK + c.z + c.dz / 2);
  if (!ray.ray.intersectPlane(planoDrag, tmpPt)) return;
  ev.stopPropagation(); ev.preventDefault();
  drag = { i, offX: tmpPt.x + cx0 - (c.gx + c.dx / 2), offY: tmpPt.z + largW / 2 - (c.y + c.dy / 2), movido: false, ini: { x: ev.clientX, y: ev.clientY }, cand: null, valido: true };
  vp.setPointerCapture(ev.pointerId);
  vp.classList.add('arrastando');
  clique = null;
}, true);

vp.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (!drag.movido && Math.hypot(ev.clientX - drag.ini.x, ev.clientY - drag.ini.y) < 4) return;
  drag.movido = true;
  const r = vp.getBoundingClientRect();
  mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  if (!ray.ray.intersectPlane(planoDrag, tmpPt)) return;
  const c = st.res.colocados[drag.i];
  const cand = avaliar(drag.i, tmpPt.x + cx0 - drag.offX - c.dx / 2, tmpPt.z + largW / 2 - drag.offY - c.dy / 2);
  drag.cand = cand;
  atualizarVolume(drag.i, cand);
  if (cand.ok !== drag.valido) { drag.valido = cand.ok; colorirVolumes(); }
  if (cand.ok) restaurarDica(); else mostrarDica(T('edit.invalid.' + cand.motivo), true);
});

function fimPointer(ev) {
  if (drag) {
    const d = drag, c = st.res.colocados[d.i];
    drag = null;
    vp.classList.remove('arrastando');
    try { vp.releasePointerCapture(ev.pointerId); } catch (e) { /* já liberado */ }
    if (d.movido && d.cand) {
      if (d.cand.ok && ev.type === 'pointerup') confirmarMovimento(d.i, d.cand);
      else {
        atualizarVolume(d.i, c);
        if (ev.type === 'pointerup') { mostrarDica(T('edit.invalid.' + d.cand.motivo), true, 2600); clique = null; colorirVolumes(); return; }
      }
      colorirVolumes();
    }
    restaurarDica();
    clique = null;
    return;
  }
  if (clique && ev.type === 'pointerup' && Math.hypot(ev.clientX - clique.x, ev.clientY - clique.y) < 5) selecionar(clique.i);
  clique = null;
}
vp.addEventListener('pointerup', fimPointer);
vp.addEventListener('pointercancel', fimPointer);

/* ---------- Medidas sobre o volume: contorno + comprimento e largura ---------- */
const COR_CONTORNO = new THREE.Color(0xf5a033), COR_CONTORNO_SEL = new THREE.Color(0xffffff);
// Medidas do volume: contorno sobre o topo + faixa fixa no alto da cena (não cobre o palete)
const infoEl = $('#infoItem'), infoPos = infoEl.querySelector('.info-pos'), infoDims = infoEl.querySelector('.info-dims');
function atualizarCotas() {
  const i = drag ? drag.i : st.hover >= 0 ? st.hover : st.sel;
  const c = st.res && i >= 0 ? st.res.colocados[i] : null;
  if (!c || (st.tocando && i >= st.mostrados - emVoo())) { contorno.visible = false; infoEl.hidden = true; return; }
  const o = drag && drag.cand ? drag.cand : c, topo = o.z + c.dz + 0.004;
  const pos = contornoGeo.attributes.position;
  [[o.gx, o.y], [o.gx + c.dx, o.y], [o.gx + c.dx, o.y + c.dy], [o.gx, o.y + c.dy]].forEach(([a, b], k) => {
    const q = P(a, b, topo);
    pos.setXYZ(k, q.x, q.y, q.z);
  });
  pos.needsUpdate = true;
  contorno.material.color.copy(i === st.sel ? COR_CONTORNO_SEL : COR_CONTORNO);
  contorno.visible = true;
  const p = st.pedidos[c.pi], emPe = !p || Math.abs(c.dz - p.h) < 1e-3;
  const compEmX = c.dx >= c.dy;
  // qual medida do produto fica no sentido do comprimento do baú (dx)
  const eixo = p ? (Math.abs(c.dx - p.c) < 1e-3 ? 'c' : Math.abs(c.dx - p.l) < 1e-3 ? 'l' : 'h') : (compEmX ? 'c' : 'l');
  const txt = `${T('info.pos')}: ${T(emPe ? 'info.standing' : 'info.lying')} · ${T('info.along.' + eixo)}`;
  const dims = `${T('dim.length')} ${nf(compEmX ? c.dx : c.dy)} m · ${T('dim.width')} ${nf(compEmX ? c.dy : c.dx)} m · ${T('dim.height')} ${nf(c.dz)} m`;
  if (infoPos.textContent !== txt) infoPos.textContent = txt;
  if (infoDims.textContent !== dims) infoDims.textContent = dims;
  infoEl.hidden = false;
}
