/* Recursos de produtividade: desfazer (Ctrl+Z), filtro de pedidos, etiqueta 3D do volume selecionado
 * e veículos extras automáticos quando a carga não cabe em um só veículo.
 * Depende de nucleo.js, cena.js, camera.js, edicao.js, resultados.js, modais.js e exportar.js. */
'use strict';

/* ================= Textos (4 idiomas) ================= */
(function () {
  const D = {
    'pt-BR': {
      'extra.clickEdit': 'clique para editar', 'extra.editing': 'Editando: {v}', 'extra.edit': 'Editar', 'extra.active': 'Em edição', 'extra.mainShort': 'P',
      'undo.title': 'Desfazer (Ctrl+Z)', 'undo.done': 'Movimento desfeito · restam {n}', 'undo.empty': 'Nada para desfazer',
      'filter.ph': 'Filtrar por nome ou código', 'filter.none': 'Nenhum pedido corresponde ao filtro', 'filter.count': '{n} de {t}',
      'filter.clear': 'Limpar filtro',
      'extra.title': 'Veículos adicionais', 'extra.need': 'Não coube tudo neste veículo. Para entregar o pedido completo, use também:',
      'extra.vols': '{n} volumes · {kg} kg · {o}% ocupado', 'extra.show': 'Mostrar na cena 3D', 'extra.hide': 'Ocultar da cena 3D',
      'extra.left': '{n} volumes ainda ficariam de fora (maiores que qualquer veículo da frota ou acima do limite de peso).',
      'extra.none': 'Nenhum veículo da frota comporta os volumes restantes.', 'extra.tag': 'Extra {n}', 'extra.main': 'Principal',
      'extra.use': 'Usar como principal', 'extra.print': 'Veículos adicionais necessários',
      'edit.toWagon': 'Vagão {n}', 'label.seq': 'nº {n}', 'label.wagon': 'vagão {n}',
    },
    en: {
      'extra.clickEdit': 'click to edit', 'extra.editing': 'Editing: {v}', 'extra.edit': 'Edit', 'extra.active': 'Editing', 'extra.mainShort': 'M',
      'undo.title': 'Undo (Ctrl+Z)', 'undo.done': 'Move undone · {n} left', 'undo.empty': 'Nothing to undo',
      'filter.ph': 'Filter by name or code', 'filter.none': 'No order matches the filter', 'filter.count': '{n} of {t}',
      'filter.clear': 'Clear filter',
      'extra.title': 'Additional vehicles', 'extra.need': 'Not everything fits in this vehicle. To deliver the full order, also use:',
      'extra.vols': '{n} volumes · {kg} kg · {o}% full', 'extra.show': 'Show in 3D scene', 'extra.hide': 'Hide from 3D scene',
      'extra.left': '{n} volumes would still be left out (larger than any fleet vehicle or over the weight limit).',
      'extra.none': 'No fleet vehicle can carry the remaining volumes.', 'extra.tag': 'Extra {n}', 'extra.main': 'Main',
      'extra.use': 'Use as main', 'extra.print': 'Additional vehicles required',
      'edit.toWagon': 'Section {n}', 'label.seq': 'no. {n}', 'label.wagon': 'section {n}',
    },
    es: {
      'extra.clickEdit': 'clic para editar', 'extra.editing': 'Editando: {v}', 'extra.edit': 'Editar', 'extra.active': 'En edición', 'extra.mainShort': 'P',
      'undo.title': 'Deshacer (Ctrl+Z)', 'undo.done': 'Movimiento deshecho · quedan {n}', 'undo.empty': 'Nada que deshacer',
      'filter.ph': 'Filtrar por nombre o código', 'filter.none': 'Ningún pedido coincide con el filtro', 'filter.count': '{n} de {t}',
      'filter.clear': 'Limpiar filtro',
      'extra.title': 'Vehículos adicionales', 'extra.need': 'No cupo todo en este vehículo. Para entregar el pedido completo, use también:',
      'extra.vols': '{n} volúmenes · {kg} kg · {o}% ocupado', 'extra.show': 'Mostrar en la escena 3D', 'extra.hide': 'Ocultar de la escena 3D',
      'extra.left': 'Aún quedarían fuera {n} volúmenes (más grandes que cualquier vehículo o por encima del límite de peso).',
      'extra.none': 'Ningún vehículo de la flota admite los volúmenes restantes.', 'extra.tag': 'Extra {n}', 'extra.main': 'Principal',
      'extra.use': 'Usar como principal', 'extra.print': 'Vehículos adicionales necesarios',
      'edit.toWagon': 'Vagón {n}', 'label.seq': 'n.º {n}', 'label.wagon': 'vagón {n}',
    },
    fr: {
      'extra.clickEdit': 'cliquez pour modifier', 'extra.editing': 'Modification : {v}', 'extra.edit': 'Modifier', 'extra.active': 'En cours', 'extra.mainShort': 'P',
      'undo.title': 'Annuler (Ctrl+Z)', 'undo.done': 'Déplacement annulé · reste {n}', 'undo.empty': 'Rien à annuler',
      'filter.ph': 'Filtrer par nom ou code', 'filter.none': 'Aucune commande ne correspond au filtre', 'filter.count': '{n} sur {t}',
      'filter.clear': 'Effacer le filtre',
      'extra.title': 'Véhicules supplémentaires', 'extra.need': 'Tout ne rentre pas dans ce véhicule. Pour livrer la commande complète, utilisez aussi :',
      'extra.vols': '{n} colis · {kg} kg · {o} % occupé', 'extra.show': 'Afficher dans la scène 3D', 'extra.hide': 'Masquer de la scène 3D',
      'extra.left': '{n} colis resteraient encore dehors (plus grands que tout véhicule ou au-delà de la limite de poids).',
      'extra.none': 'Aucun véhicule de la flotte ne peut prendre les colis restants.', 'extra.tag': 'Extra {n}', 'extra.main': 'Principal',
      'extra.use': 'Utiliser comme principal', 'extra.print': 'Véhicules supplémentaires nécessaires',
      'edit.toWagon': 'Section {n}', 'label.seq': 'n° {n}', 'label.wagon': 'section {n}',
    },
  };
  Object.keys(D).forEach((l) => I18N.extend(l, D[l]));
})();

/* ================= Desfazer (histórico de 10 posições) ================= */
const LIMITE_HISTORICO = 10;
let historico = [];
const fotoPosicoes = () => st.res ? st.res.colocados.map((c) => ({ vagao: c.vagao, x: c.x, y: c.y, z: c.z, gx: c.gx, dx: c.dx, dy: c.dy, dz: c.dz })) : [];
const mesmaFoto = (a, b) => a.length === b.length && a.every((p, i) => {
  const q = b[i];
  return p.vagao === q.vagao && p.x === q.x && p.y === q.y && p.z === q.z && p.dx === q.dx && p.dy === q.dy && p.dz === q.dz;
});
function guardarHistorico(foto) {
  historico.push(foto);
  if (historico.length > LIMITE_HISTORICO) historico.shift();
  atualizarBtnDesfazer();
}
function atualizarBtnDesfazer() {
  const b = $('#btnDesfazer');
  if (!b) return;
  b.disabled = !historico.length;
  const t = T('undo.title') + (historico.length ? ` · ${historico.length}` : '');
  b.title = t; b.setAttribute('aria-label', t);
}
function desfazer() {
  if (!st.res || drag) return;
  if (!historico.length) { mostrarDica(T('undo.empty'), true, 1600); return; }
  const foto = historico.pop();
  if (foto.length !== st.res.colocados.length) { historico = []; atualizarBtnDesfazer(); return; }
  foto.forEach((p, i) => Object.assign(st.res.colocados[i], p));
  const arr = st.res.colocados.map((o) => caixaDe(o));
  recalcularCargas(arr);
  arr.forEach((b, j) => { st.res.colocados[j].carga = b.carga; });
  recalcularStats();
  const total = st.res.colocados.length;
  if (st.tocando) tocar(false);
  st.mostrados = st.base = total;
  construirVolumes(st.res);
  calcularEixos();
  colorirVolumes();
  atualizarBtnDesfazer();
  mostrarDica(T('undo.done', { n: historico.length }), false, 1800);
}

// envolve as operações que alteram posições para guardar o estado anterior
(function () {
  const mover = confirmarMovimento;
  confirmarMovimento = function (i, p) {
    const antes = fotoPosicoes();
    mover(i, p);
    if (!mesmaFoto(antes, fotoPosicoes())) guardarHistorico(antes);
  };
  const transf = transformar;
  transformar = function (tipo) {
    const antes = fotoPosicoes();
    transf(tipo);
    if (!mesmaFoto(antes, fotoPosicoes())) guardarHistorico(antes);
  };
})();

document.addEventListener('keydown', (e) => {
  const tag = (e.target || {}).tagName || '';
  if (/INPUT|SELECT|TEXTAREA/.test(tag) || modalAberto) return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); desfazer(); }
  else if (e.key === 'Escape' && !st.editar && st.sel >= 0) selecionar(-1);
});

/* ================= Filtro rápido na lista de pedidos ================= */
const normTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const filtroEl = $('#filtroPedidos');
function aplicarFiltroPedidos() {
  const ul = $('#listaPedidos'), q = normTxt(filtroEl.value.trim());
  let vis = 0;
  Array.from(ul.children).forEach((li, i) => {
    const p = st.pedidos[i];
    const ok = !q || (p && (normTxt(p.nome).includes(q) || normTxt(p.codigo).includes(q)));
    li.hidden = !ok;
    if (ok) vis++;
  });
  $('#filtroVazio').hidden = !(q && vis === 0);
  $('#filtroLimpar').hidden = !q;
  $('#nLinhas').textContent = q ? T('filter.count', { n: ni(vis), t: plural(st.pedidos.length, 'line', 'lines') }) : plural(st.pedidos.length, 'line', 'lines');
}
filtroEl.addEventListener('input', aplicarFiltroPedidos);
filtroEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && filtroEl.value) { e.stopPropagation(); filtroEl.value = ''; aplicarFiltroPedidos(); } });
$('#filtroLimpar').addEventListener('click', () => { filtroEl.value = ''; aplicarFiltroPedidos(); filtroEl.focus(); });

// mesmo filtro na tabela de edição de pedidos
const filtroTabEl = $('#filtroTabela');
function aplicarFiltroTabela() {
  const q = normTxt(filtroTabEl.value.trim());
  Array.from($('#corpoTabela').children).forEach((tr, i) => {
    const p = rascunho[i];
    const cod = tr.querySelector(`#p${i}-codigo`), nm = tr.querySelector(`#p${i}-nome`);
    const txt = normTxt((cod ? cod.value : p && p.codigo) + ' ' + (nm ? nm.value : p && p.nome));
    tr.hidden = !!q && !txt.includes(q);
  });
}
filtroTabEl.addEventListener('input', aplicarFiltroTabela);
filtroTabEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && filtroTabEl.value) { e.stopPropagation(); filtroTabEl.value = ''; aplicarFiltroTabela(); } });

(function () {
  const rp = renderPedidos;
  renderPedidos = function () { rp(); aplicarFiltroPedidos(); };
  const ab = abrirPedidos;
  abrirPedidos = function () { filtroTabEl.value = ''; ab(); };
  const rt = renderTabela;
  renderTabela = function () { rt(); aplicarFiltroTabela(); };
  // ao adicionar linha, limpa o filtro para a linha nova aparecer
  $('#btnAddLinha').addEventListener('click', () => { if (filtroTabEl.value) { filtroTabEl.value = ''; aplicarFiltroTabela(); } }, true);
})();

/* ================= Etiqueta 3D flutuante sobre o volume selecionado ================= */
function texturaEtiqueta(linhas, corBorda) {
  const esc2 = 2, w = 520, lh = [46, 34, 34, 34];
  const h = 24 + linhas.reduce((s, _, k) => s + (lh[k] || 34), 0) + 18;
  const cv = document.createElement('canvas');
  cv.width = w * esc2; cv.height = (h + 22) * esc2;
  const g = cv.getContext('2d');
  g.scale(esc2, esc2);
  const r = 16;
  g.fillStyle = 'rgba(8,18,40,0.95)';
  g.strokeStyle = corBorda; g.lineWidth = 4;
  g.beginPath();
  g.moveTo(r, 2); g.lineTo(w - r, 2); g.quadraticCurveTo(w - 2, 2, w - 2, r); g.lineTo(w - 2, h - r);
  g.quadraticCurveTo(w - 2, h, w - r, h); g.lineTo(w / 2 + 16, h); g.lineTo(w / 2, h + 20); g.lineTo(w / 2 - 16, h);
  g.lineTo(r, h); g.quadraticCurveTo(2, h, 2, h - r); g.lineTo(2, r); g.quadraticCurveTo(2, 2, r, 2); g.closePath();
  g.fill(); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let y = 22;
  linhas.forEach((t, k) => {
    const alt = lh[k] || 34;
    g.font = k === 0 ? '700 36px "Barlow Condensed", "Arial Narrow", sans-serif' : '600 26px Barlow, "Segoe UI", sans-serif';
    g.fillStyle = k === 0 ? corBorda : k === 1 ? '#eef3fb' : '#b6c3d9';
    let s = String(t);
    while (s.length > 4 && g.measureText(s).width > w - 36) s = s.slice(0, -2);
    if (s !== String(t)) s = s.slice(0, -1) + '…';
    g.fillText(s, w / 2, y + alt / 2);
    y += alt;
  });
  const tx = new THREE.CanvasTexture(cv);
  tx.encoding = THREE.sRGBEncoding;
  tx.anisotropy = 4;
  return { tx, aspecto: cv.width / cv.height };
}
function novaEtiqueta() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
  s.center.set(0.5, 0);
  s.renderOrder = 40;
  s.visible = false;
  scene.add(s);
  return s;
}
function definirTextoEtiqueta(sprite, linhas, corBorda, altura) {
  const { tx, aspecto } = texturaEtiqueta(linhas, corBorda);
  if (sprite.material.map) sprite.material.map.dispose();
  sprite.material.map = tx;
  sprite.material.needsUpdate = true;
  sprite.userData.aspecto = aspecto;
  sprite.userData.altura = altura;
}
function escalarEtiqueta(sprite) {
  const d = camera.position.distanceTo(sprite.position);
  const hMundo = Math.min(6, Math.max(0.8, d * 0.075)) * (sprite.userData.altura || 1);
  sprite.scale.set(hMundo * sprite.userData.aspecto, hMundo, 1);
}

const etiqueta = novaEtiqueta();
let chaveEtiqueta = '';
function atualizarEtiqueta() {
  const i = st.sel;
  const c = st.res && i >= 0 ? st.res.colocados[i] : null;
  if (!c || i >= Math.ceil(st.mostrados - 1e-9) || (st.tocando && i >= st.mostrados - emVoo())) { etiqueta.visible = false; return; }
  const p = st.pedidos[c.pi] || {};
  const v = st.res.veiculo;
  const linhas = [
    (typeof cbNumeros !== 'undefined' && cbNumeros ? `${c.pi + 1} · ` : '') + (p.nome || ''),
    `${p.codigo || ''} · ${T('label.seq', { n: ni(c.seq + 1) })}${v.vagoes > 1 ? ' · ' + T('label.wagon', { n: c.vagao + 1 }) : ''}`,
    `${nf(c.dx)} × ${nf(c.dy)} × ${nf(c.dz)} m`,
    `${nf(c.peso, c.peso >= 100 ? 0 : 1)} kg${c.palete ? ` · ${ni(c.pecas)} ${T('pieces')}` : ''}`,
  ];
  const k = linhas.join('|') + I18N.lang + cor(c.pi);
  if (k !== chaveEtiqueta) { chaveEtiqueta = k; definirTextoEtiqueta(etiqueta, linhas, cor(c.pi), 1); }
  const o = drag && drag.i === i && drag.cand ? drag.cand : c;
  etiqueta.position.copy(P(o.gx + c.dx / 2, o.y + c.dy / 2, o.z + c.dz + 0.12));
  escalarEtiqueta(etiqueta);
  etiqueta.visible = true;
}

/* ================= Veículos extras: o que não coube vai para outro(s) veículo(s) ================= */
const MAX_EXTRAS = 4, GAP_LADO = 1.8;
// conjunto: todos os veículos da entrega (0 = principal); ativo = o que está editável na cena
let conjunto = [], ativo = 0, assinaturaAtiva = '';
let planoExtras = null, mostrarExtras = true, grupoExtras = null, lonasExtras = [], textosExtras = [], etiquetasExtras = [];

const capVol = (v) => (+v.c) * (+v.l) * (+v.h) * Math.max(1, +v.vagoes | 0);
function planejarExtras() {
  const r = st.res;
  if (!r || !r.pendentes) return null;
  let resto = st.pedidos.map((p, i) => Object.assign({}, p, { qtd: (r.porProduto[i] || {}).pendentes || 0 }));
  const qtdDe = (l) => l.reduce((s, p) => s + p.qtd, 0);
  const volDe = (l) => l.reduce((s, p) => s + p.qtd * p.c * p.l * p.h, 0);
  const kgDe = (l) => l.reduce((s, p) => s + p.qtd * (+p.peso || 0), 0);
  const cands = frota.map((v) => clone(v)).sort((a, b) => capVol(a) - capVol(b) || (a.cargaKg || 1e9) - (b.cargaKg || 1e9));
  const opt = { estrategia: st.estrategia, apoioMin: st.apoioMin };
  const lista = [];
  const t0 = performance.now();
  for (let n = 0; n < MAX_EXTRAS && qtdDe(resto) > 0; n++) {
    const vol = volDe(resto), kg = kgDe(resto);
    let pick = null;
    // o menor veículo que leva todo o restante
    for (const v of cands) {
      if (capVol(v) + 1e-9 < vol || (v.cargaKg > 0 && v.cargaKg + 1e-6 < kg)) continue;
      if (performance.now() - t0 > 4000) break;
      const res = Packer.empacotar(v, resto, opt);
      if (res.pendentes === 0) { pick = { v, res }; break; }
    }
    // nenhum leva tudo: o que carregar mais (testa os maiores)
    if (!pick) {
      for (const v of cands.slice(-3).reverse()) {
        const res = Packer.empacotar(v, resto, opt);
        if (res.colocados.length && (!pick || res.colocados.length > pick.res.colocados.length)) pick = { v, res };
      }
    }
    if (!pick || !pick.res.colocados.length) break;
    lista.push(pick);
    resto = resto.map((p, i) => Object.assign({}, p, { qtd: (pick.res.porProduto[i] || {}).pendentes || 0 }));
  }
  return { lista, restantes: qtdDe(resto) };
}

function limparExtras3D() {
  if (grupoExtras) {
    scene.remove(grupoExtras);
    grupoExtras.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map && o.material.map !== texturaEstrado) o.material.map.dispose(); o.material.dispose(); }
    });
  }
  grupoExtras = null; lonasExtras = []; textosExtras = []; etiquetasExtras = [];
}

// posição lateral (eixo Z da cena) de cada veículo extra, ao lado do principal
function layoutExtras() {
  const out = [];
  if (conjunto.length < 2 || !mostrarExtras) return out;
  let zc = -(largW / 2) - GAP_LADO;
  conjunto.forEach((e, k) => {
    if (k === ativo) return;
    const s = Veiculo3D.especificar(e.v);
    const zCentro = zc - s.W / 2;
    out.push({ e, s, zCentro, k });
    zc = zCentro - s.W / 2 - GAP_LADO;
  });
  return out;
}
function enquadreExtras() {
  const lay = layoutExtras();
  if (!lay.length) return { z: 0, larg: 0 };
  const ult = lay[lay.length - 1], min = ult.zCentro - ult.s.W / 2, max = largW / 2;
  return { z: (min + max) / 2, larg: max - min - largW };
}

function construirExtras3D() {
  limparExtras3D();
  const lay = layoutExtras();
  if (!lay.length) return;
  grupoExtras = new THREE.Group();
  const qId2 = new THREE.Quaternion(), pos = new THREE.Vector3(), esc3 = new THREE.Vector3(), m = new THREE.Matrix4(), col = new THREE.Color();
  lay.forEach(({ e, s, zCentro, k }, n) => {
    const cx = (s.xFrente + s.xTras) / 2;
    const Pi = (x, y, z) => new THREE.Vector3(x - cx, s.deck + z, y - s.W / 2 + zCentro);
    const r = Veiculo3D.construir(s, Pi, { cor: COR_LONA, texto: TEXTO_LONA });
    r.grupo.userData.veiculo = k;
    grupoExtras.add(r.grupo);
    lonasExtras.push(...r.lonas); textosExtras.push(...r.textos);
    r.portas.forEach((pt) => { pt.pivo.rotation.y = 0; });
    const cs = e.res.colocados, nn = Math.max(1, cs.length);
    const caixas = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.04 }), nn);
    const estr = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: texturaEstrado, roughness: 0.9 }), nn);
    cs.forEach((c, i) => {
      if (c.palete) {
        const hb = Math.min(BASE_PALETE, c.dz * 0.4), ins = 0.015;
        pos.copy(Pi(c.gx + c.dx / 2, c.y + c.dy / 2, c.z + hb + (c.dz - hb) / 2));
        esc3.set(c.dx - 2 * ins, c.dz - hb - FOLGA, c.dy - 2 * ins);
        caixas.setMatrixAt(i, m.compose(pos, qId2, esc3));
        pos.copy(Pi(c.gx + c.dx / 2, c.y + c.dy / 2, c.z + hb / 2));
        esc3.set(c.dx - FOLGA, hb, c.dy - FOLGA);
        estr.setMatrixAt(i, m.compose(pos, qId2, esc3));
      } else {
        pos.copy(Pi(c.gx + c.dx / 2, c.y + c.dy / 2, c.z + c.dz / 2));
        esc3.set(c.dx - FOLGA, c.dz - FOLGA, c.dy - FOLGA);
        caixas.setMatrixAt(i, m.compose(pos, qId2, esc3));
        estr.setMatrixAt(i, m.compose(pos, qId2, esc3.set(0, 0, 0)));
      }
      col.set(cor(c.pi)).convertSRGBToLinear();
      col.offsetHSL(0, 0, ((((i * 2654435761) % 1000) / 1000) - 0.5) * 0.06);
      caixas.setColorAt(i, col);
    });
    caixas.count = estr.count = cs.length;
    caixas.userData.veiculo = estr.userData.veiculo = k;
    grupoExtras.add(caixas, estr);
    // etiqueta com o nome do veículo extra
    const et = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
    et.center.set(0.5, 0); et.renderOrder = 39;
    et.userData.veiculo = k;
    definirTextoEtiqueta(et, linhasVeiculo(e, k), k === 0 ? '#f5a033' : '#2b7ad9', 1.1);
    et.position.copy(Pi(n % 2 ? s.xTras - 2.5 : s.xFrente + 3.5, s.W / 2, s.H + 0.5));
    grupoExtras.add(et);
    etiquetasExtras.push(et);
  });
  scene.add(grupoExtras);
  aplicarAtravesExtras();
}
const nomeVeiculoCena = (k) => (k === 0 ? T('extra.main') : T('extra.tag', { n: k }));
function linhasVeiculo(e, k) {
  return [`${nomeVeiculoCena(k)} · ${T('extra.clickEdit')}`, e.v.nome || '',
    T('extra.vols', { n: ni(e.res.colocados.length), kg: ni(e.res.stats.kg), o: nf(e.res.stats.ocupacao * 100, 0) })];
}
function aplicarAtravesExtras() {
  lonasExtras.forEach((m) => { m.opacity = st.atraves ? 0.16 : 1; m.depthWrite = !st.atraves; m.needsUpdate = true; });
  textosExtras.forEach((m) => { m.opacity = st.atraves ? 0.85 : 1; m.needsUpdate = true; });
}

function renderExtrasPainel() {
  const bloco = $('#blocoExtras');
  if (!planoExtras) { bloco.hidden = true; return; }
  bloco.hidden = false;
  const lista = planoExtras.lista;
  let html = `<p class="nota">${lista.length ? T('extra.need') : T('extra.none')}</p>`;
  if (lista.length) {
    html += '<ol class="lista-extras">' + conjunto.map((e, k) =>
      `<li class="${k === ativo ? 'ativo' : ''}${k === 0 ? ' principal' : ''}"><span class="ext-n">${k === 0 ? T('extra.mainShort') : k}</span><div><b>${esc(nomeVeiculoCena(k))} · ${esc(e.v.nome || '')}</b>` +
      `<span>${esc(nomeCat(e.v.categoria || 'outros'))} · ${nf(e.v.c)} × ${nf(e.v.l)} × ${nf(e.v.h)} m${(e.v.vagoes || 1) > 1 ? ' · ' + T('resumo.wagonsOf', { n: e.v.vagoes }) : ''}</span>` +
      `<span>${T('extra.vols', { n: ni(e.res.colocados.length), kg: ni(e.res.stats.kg), o: nf(e.res.stats.ocupacao * 100, 0) })}</span></div>` +
      (k === ativo ? `<span class="ext-tag">${T('extra.active')}</span>` : `<button type="button" class="btn peq" data-ativar="${k}">${T('extra.edit')}</button>`) + `</li>`).join('') + '</ol>';
  }
  if (planoExtras.restantes > 0 && lista.length) html += `<p class="erro">${T('extra.left', { n: ni(planoExtras.restantes) })}</p>`;
  $('#corpoExtras').innerHTML = html;
  const b = $('#btnMostrarExtras');
  b.hidden = !lista.length;
  b.textContent = T(mostrarExtras ? 'extra.hide' : 'extra.show');
  b.setAttribute('aria-pressed', String(mostrarExtras));
}
$('#corpoExtras').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ativar]');
  if (b) ativarVeiculo(+b.dataset.ativar);
});

/* ---------- Trocar o veículo editável (principal ou extra) ---------- */
const assinar = (v) => JSON.stringify([v.nome, v.c, v.l, v.h, v.vagoes, v.cargaKg]);
const indiceFrota = (v) => { const i = frota.findIndex((f) => f.nome === v.nome && f.c === v.c && f.l === v.l && f.h === v.h && (f.vagoes || 1) === (v.vagoes || 1)); return i >= 0 ? i : 'custom'; };
function ativarVeiculo(k) {
  if (k === ativo || !conjunto[k] || drag) return;
  if (st.tocando) tocar(false);
  const atual = conjunto[ativo];
  Object.assign(atual, { v: st.veiculo, res: st.res, hist: historico, eixosCfg: st.eixosCfg, idx: st.idx });
  ativo = k;
  const e = conjunto[k];
  st.veiculo = e.v; st.res = e.res; st.eixosCfg = e.eixosCfg; st.idx = e.idx; historico = e.hist;
  assinaturaAtiva = assinar(st.veiculo);
  st.sel = st.hover = -1;
  atualizarFerramentas();
  sel.value = String(st.idx);
  atualizarResumoVeiculo();
  const total = st.res.colocados.length;
  $('#rngPasso').max = total;
  st.mostrados = st.base = total;
  definirPorta(false);
  construirVeiculo(st.veiculo);
  calcularEixos();
  renderPedidos();
  atualizarBtnDesfazer();
  irPara(st.vista);
  sucesso(T('extra.editing', { v: `${nomeVeiculoCena(k)} · ${st.veiculo.nome || ''}` }));
}
// clique num veículo ao lado (na cena) torna ele o editável
let cliqueVeic = null;
vp.addEventListener('pointerdown', (ev) => { cliqueVeic = ev.button === 0 ? { x: ev.clientX, y: ev.clientY } : null; });
vp.addEventListener('pointerup', (ev) => {
  const c = cliqueVeic; cliqueVeic = null;
  if (!c || !grupoExtras || drag || Math.hypot(ev.clientX - c.x, ev.clientY - c.y) > 5) return;
  if (ev.target.closest && ev.target.closest('#ferramentas')) return;
  if (pegar(ev) >= 0) return;   // clicou num volume do veículo ativo
  const hits = ray.intersectObject(grupoExtras, true);
  for (const h of hits) {
    let o = h.object;
    while (o && o.userData.veiculo === undefined) o = o.parent;
    if (o) { ativarVeiculo(o.userData.veiculo); return; }
  }
});

$('#btnMostrarExtras').addEventListener('click', () => {
  mostrarExtras = !mostrarExtras;
  construirExtras3D();
  renderExtrasPainel();
  irPara(st.vista);
});

/* ================= Ligações com o restante do app ================= */
(function () {
  const sim = simular;
  simular = function (opcoes) {
    // com um extra em edição, "Simular" volta a partir do veículo principal (se o veículo não foi trocado)
    if (ativo !== 0 && conjunto[0]) {
      const mesmo = st.veiculo === conjunto[ativo].v && assinar(st.veiculo) === assinaturaAtiva;
      const p0 = conjunto[0];
      ativo = 0; conjunto = [];
      if (mesmo) {
        st.veiculo = p0.v; st.eixosCfg = p0.eixosCfg; st.idx = p0.idx;
        sel.value = String(st.idx);
        atualizarResumoVeiculo();
        construirVeiculo(st.veiculo);
      }
    }
    ativo = 0; conjunto = [];
    sim(opcoes);
    historico = [];
    atualizarBtnDesfazer();
    planoExtras = planejarExtras();
    conjunto = [{ v: st.veiculo, res: st.res, hist: historico, eixosCfg: st.eixosCfg, idx: st.idx }];
    if (planoExtras) planoExtras.lista.forEach((e) => conjunto.push({ v: e.v, res: e.res, hist: [], eixosCfg: { tara: {}, limite: {} }, idx: indiceFrota(e.v) }));
    construirExtras3D();
    renderExtrasPainel();
    irPara(st.vista, !!(opcoes && opcoes.inicio));
  };
  const cv = construirVeiculo;
  construirVeiculo = function (v) {
    cv(v);
    if (conjunto.length > 1) { construirExtras3D(); irPara(st.vista, true); }
  };
  const at = aplicarAtraves;
  aplicarAtraves = function () { at(); aplicarAtravesExtras(); };
  const rr = renderResultados;
  renderResultados = function () {
    rr();
    if (typeof planoExtras !== 'undefined' && $('#blocoExtras')) {
      renderExtrasPainel();
      if (planoExtras && grupoExtras && etiquetasExtras.length) {
        // atualiza os textos das etiquetas (troca de idioma)
        layoutExtras().forEach(({ e, k }, n) => {
          const et = etiquetasExtras[n];
          if (et) definirTextoEtiqueta(et, linhasVeiculo(e, k), k === 0 ? '#f5a033' : '#2b7ad9', 1.1);
        });
      }
    }
    atualizarBtnDesfazer();
  };
  const ac = atualizarCotas;
  atualizarCotas = function () {
    ac();
    atualizarEtiqueta();
    etiquetasExtras.forEach(escalarEtiqueta);
    // ao arrastar entre vagões, mostra para qual vagão o volume vai
    if (drag && drag.movido && drag.cand && drag.cand.ok && st.res.veiculo.vagoes > 1) {
      const txt = T('edit.toWagon', { n: drag.cand.k + 1 });
      if (dicaEl.textContent !== txt) mostrarDica(txt);
    }
  };
  const mi = montarAreaImpressao;
  montarAreaImpressao = function () {
    mi();
    if (!planoExtras || !planoExtras.lista.length) return;
    const area = $('#areaImpressao');
    area.insertAdjacentHTML('beforeend', `<h3>${T('extra.print')}</h3><table><thead><tr><th>#</th><th>${T('label.vehicle')}</th><th>${T('th.qty')}</th><th>kg</th></tr></thead><tbody>` +
      conjunto.slice(1).map((e, n) => `<tr><td>${n + 1}</td><td>${esc(e.v.nome || '')} — ${nf(e.v.c)} × ${nf(e.v.l)} × ${nf(e.v.h)} m</td><td>${ni(e.res.colocados.length)}</td><td>${ni(e.res.stats.kg)}</td></tr>`).join('') +
      '</tbody></table>' + (planoExtras.restantes ? `<p>${T('extra.left', { n: ni(planoExtras.restantes) })}</p>` : ''));
  };
})();

$('#btnDesfazer').addEventListener('click', desfazer);

/* ================= Orientação: escolher a posição do volume selecionado ================= */
(function () {
  const D = {
    'pt-BR': { 'ori.btn': 'Orientação', 'ori.title': 'Escolher orientação do volume (O)', 'ori.standing': 'Em pé', 'ori.lying': 'Deitado',
      'ori.alongC': 'comprimento no sentido do baú', 'ori.alongL': 'largura no sentido do baú', 'ori.alongH': 'altura no sentido do baú', 'ori.onSide': 'De lado', 'ori.current': 'atual' },
    en: { 'ori.btn': 'Orientation', 'ori.title': 'Choose volume orientation (O)', 'ori.standing': 'Standing', 'ori.lying': 'Lying down',
      'ori.alongC': 'length along the bay', 'ori.alongL': 'width along the bay', 'ori.alongH': 'height along the bay', 'ori.onSide': 'On its side', 'ori.current': 'current' },
    es: { 'ori.btn': 'Orientación', 'ori.title': 'Elegir orientación del volumen (O)', 'ori.standing': 'De pie', 'ori.lying': 'Acostado',
      'ori.alongC': 'largo en el sentido del furgón', 'ori.alongL': 'ancho en el sentido del furgón', 'ori.alongH': 'alto en el sentido del furgón', 'ori.onSide': 'De lado', 'ori.current': 'actual' },
    fr: { 'ori.btn': 'Orientation', 'ori.title': 'Choisir l’orientation du colis (O)', 'ori.standing': 'Debout', 'ori.lying': 'Couché',
      'ori.alongC': 'longueur dans le sens de la caisse', 'ori.alongL': 'largeur dans le sens de la caisse', 'ori.alongH': 'hauteur dans le sens de la caisse', 'ori.onSide': 'Sur le côté', 'ori.current': 'actuelle' },
  };
  Object.keys(D).forEach((l) => I18N.extend(l, D[l]));
})();

const menuOri = $('#menuOrientacao'), btnOri = $('#btnOrientacao');
const quase = (a, b) => Math.abs(a - b) < 1e-6;

// Posições possíveis: palete = em pé (comprimento/largura) e deitado (2 sentidos); caixa = as 6 rotações
function orientacoesDe(c) {
  const p = st.pedidos[c.pi];
  const C = p ? +p.c : c.dx, L = p ? +p.l : c.dy, H = p ? +p.h : c.dz;
  const ds = { c: C, l: L, h: H };
  const lista = [];
  const add = (x, y, z) => {
    const o = { dx: ds[x], dy: ds[y], dz: ds[z], ax: x, az: z };
    if (!lista.some((q) => quase(q.dx, o.dx) && quase(q.dy, o.dy) && quase(q.dz, o.dz))) lista.push(o);
  };
  if (c.palete) { add('c', 'l', 'h'); add('l', 'c', 'h'); add('c', 'h', 'l'); add('h', 'c', 'l'); }
  else { add('c', 'l', 'h'); add('l', 'c', 'h'); add('c', 'h', 'l'); add('h', 'c', 'l'); add('l', 'h', 'c'); add('h', 'l', 'c'); }
  return lista;
}
function iconeOri(o) {
  // retângulo proporcional (vista lateral: comprimento do baú × altura)
  const m = Math.max(o.dx, o.dz), w = 22 * o.dx / m, h = 22 * o.dz / m;
  return `<svg viewBox="0 0 30 30" aria-hidden="true"><rect x="${15 - w / 2}" y="${27 - h}" width="${w}" height="${h}" rx="1.5" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.5"/><path d="M3 27.5h24" stroke="currentColor" stroke-width="1.2" opacity="0.6"/></svg>`;
}
function rotuloOri(o) {
  const pos = o.az === 'h' ? T('ori.standing') : o.az === 'l' ? T('ori.lying') : T('ori.onSide');
  return `${pos} · ${T(o.ax === 'c' ? 'ori.alongC' : o.ax === 'l' ? 'ori.alongL' : 'ori.alongH')}`;
}
function fecharMenuOri() { menuOri.hidden = true; btnOri.setAttribute('aria-expanded', 'false'); }
function abrirMenuOri() {
  if (!st.res || st.sel < 0 || !st.editar) return;
  const c = st.res.colocados[st.sel];
  const travado = bloqueado(st.sel);
  menuOri.innerHTML = orientacoesDe(c).map((o, k) => {
    const atual = quase(o.dx, c.dx) && quase(o.dy, c.dy) && quase(o.dz, c.dz);
    return `<button type="button" role="menuitemradio" data-k="${k}" aria-checked="${atual}"${travado && !atual ? ' disabled' : ''}>${iconeOri(o)}` +
      `<b>${rotuloOri(o)}${atual ? ' · ' + T('ori.current') : ''}</b><small>${nf(o.dx)} × ${nf(o.dy)} × ${nf(o.dz)} m</small></button>`;
  }).join('');
  menuOri.hidden = false;
  btnOri.setAttribute('aria-expanded', 'true');
  if (travado) mostrarDica(T('edit.blocked'), true, 2600);
  const f = menuOri.querySelector('button:not(:disabled)'); if (f) f.focus();
}
function aplicarOrientacao(o) {
  if (!st.editar || st.sel < 0 || !st.res || drag) return;
  const i = st.sel, c = st.res.colocados[i];
  if (quase(o.dx, c.dx) && quase(o.dy, c.dy) && quase(o.dz, c.dz)) return;
  if (bloqueado(i)) { mostrarDica(T('edit.blocked'), true, 2600); return; }
  const nd = { dx: o.dx, dy: o.dy, dz: o.dz };
  const cand = avaliar(i, c.gx + (c.dx - nd.dx) / 2, c.y + (c.dy - nd.dy) / 2, nd);
  if (!cand.ok) { mostrarDica(T('edit.invalid.' + cand.motivo), true, 2600); return; }
  const antes = fotoPosicoes();
  Object.assign(c, nd, { vagao: cand.k, x: cand.x, y: cand.y, z: cand.z, gx: cand.gx });
  const arr = st.res.colocados.map((q) => caixaDe(q));
  recalcularCargas(arr);
  arr.forEach((b, j) => { st.res.colocados[j].carga = b.carga; });
  recalcularStats();
  construirVolumes(st.res);
  calcularEixos();
  guardarHistorico(antes);
  restaurarDica();
}
btnOri.addEventListener('click', (e) => { e.stopPropagation(); menuOri.hidden ? abrirMenuOri() : fecharMenuOri(); });
menuOri.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-k]');
  if (!b || b.disabled || st.sel < 0) return;
  const o = orientacoesDe(st.res.colocados[st.sel])[+b.dataset.k];
  fecharMenuOri();
  if (o) aplicarOrientacao(o);
});
menuOri.addEventListener('keydown', (e) => {
  const bs = [...menuOri.querySelectorAll('button:not(:disabled)')], k = bs.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const n = bs[(k + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]; if (n) n.focus(); }
  else if (e.key === 'Escape') { e.stopPropagation(); fecharMenuOri(); btnOri.focus(); }
});
document.addEventListener('pointerdown', (e) => { if (!menuOri.hidden && !e.target.closest('#menuOrientacao, #btnOrientacao')) fecharMenuOri(); });
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '') || modalAberto) return;
  if ((e.key === 'o' || e.key === 'O') && st.editar && st.sel >= 0) { e.preventDefault(); menuOri.hidden ? abrirMenuOri() : fecharMenuOri(); }
});
// fecha o menu quando a seleção muda ou some
(function () {
  const sel = selecionar;
  selecionar = function (i) { if (i !== st.sel) fecharMenuOri(); sel(i); };
  const ft = atualizarFerramentas;
  atualizarFerramentas = function () { ft(); if ($('#ferramentas').hidden) fecharMenuOri(); };
})();
