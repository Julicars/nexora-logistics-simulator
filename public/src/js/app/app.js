/* NEXORA — interface: navegação, cadastro, Mostrar Catálogo, Montagem Rápida, resultados, cotação e relatórios */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const fmt = (n, d = 1) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vn2 = n => String(n).padStart(2, '0');
function toast(m, err) { const d = document.createElement('div'); d.textContent = m; if (err) d.className = 'err'; $('#toast').appendChild(d); $('#live').textContent = m; setTimeout(() => d.remove(), 4200); }
const tipoNome = t => (NX.TIPOS[t] || {}).nome || t;
const dimTxt = p => p.tipo === 'bobina' ? `Ø ${fmt(p.l, 2)} × ${fmt(p.h, 2)} m` : `${fmt(p.l, 2)} × ${fmt(p.w, 2)} × ${fmt(p.h, 2)} m`;
const stackTxt = p => p.stackable === false ? 'Não empilha' : [p.maxLevels ? p.maxLevels + ' níveis' : 'níveis livres', p.stack === null || p.stack === undefined || p.stack === '' ? 'peso livre' : fmt(p.stack, 0) + ' kg em cima'].join(' · ');

/* ---------------- estado ---------------- */
let prods = [], fleet = [];
NX.opcoes({ cabine: true, manual: LS.get('manual', false) });
const QUICK0 = [{ id: 'q1', cod: 'PED-001', nome: 'PALLETS', tipo: 'palete', l: 1.2, w: 1.1, h: 1.9, q: 20, pcs: 42, kgp: 9, kg: 378, pos: 'pe', stack: 0, maxLevels: null, cor: '#f39a2b' }];
/* Dois estados independentes: o que acontece num modo não altera o outro */
const S = LS.get('work', null) || { cat: { veh: 'v0', lines: [], quote: {} }, quick: { veh: 'v0', lines: [], quote: {} } };
/* Montagem Rápida sempre começa vazia: nada pré-definido ao abrir o sistema */
S.quick = { veh: (S.quick && S.quick.veh) || 'v0', lines: [], quote: {} };
/* Montagem com Roteirização: sessão própria (remetente, entregas e carga por destino) */
S.route = Object.assign({ veh: 'v0', lines: [], quote: {}, sender: '', orig: null, stops: [], tipo: 'geral', eixos: null, extras: [] }, S.route || {});
const QM = () => mode === 'route' ? 'route' : 'quick';
let mode = 'quick', plan = null, active = 0;
const saveWork = () => LS.set('work', { cat: { veh: S.cat.veh, lines: S.cat.lines, quote: S.cat.quote }, quick: { veh: S.quick.veh, lines: S.quick.lines, quote: S.quick.quote }, route: { veh: S.route.veh, lines: S.route.lines, quote: S.route.quote, sender: S.route.sender, orig: S.route.orig, stops: S.route.stops, tipo: S.route.tipo, eixos: S.route.eixos, extras: S.route.extras, tab: S.route.tab, ret: S.route.ret, retKm: S.route.retKm } });
const PAL = { deut: ['#0072B2', '#E69F00', '#56B4E9', '#F0E442', '#CC79A7', '#D55E00', '#009E73', '#999999'], trit: ['#D81B60', '#1E88E5', '#004D40', '#FFC107', '#8E24AA', '#E64A19', '#43A047', '#757575'], hc: ['#FFFFFF', '#FFD400', '#00E5FF', '#FF3BFF', '#00FF6A', '#FF7A00', '#9AA0FF', '#FF3B3B'] };
let cbMode = LS.get('cb', 'normal');
function curLines() {
  if (mode === 'cat') return S.cat.lines.map(l => { const p = prods.find(x => x.id === l.pid); return p ? NX.normalize({ ...p, q: l.q }) : null; }).filter(Boolean);
  return S[QM()].lines.map(l => NX.normalize(l));
}
function colorOf(p) { if (cbMode === 'normal') return p.cor || '#f39a2b'; let i = curLines().findIndex(x => x.id === p.id); if (i < 0) i = prods.findIndex(x => x.id === p.id); return PAL[cbMode][Math.max(0, i) % 8]; }
const pnum = pid => { const i = curLines().findIndex(p => p.id === pid); return i >= 0 ? i + 1 : prods.findIndex(p => p.id === pid) + 1; };
const curVeh = () => fleet.find(v => v.id === S[mode].veh) || fleet[0];

function setMode(m) {
  if (m === mode) return; stopAnim(true);
  S[mode].plan = plan; S[mode].hist = hist; S[mode].redo = redo; S[mode].active = active;
  mode = m; plan = S[m].plan || null; hist = S[m].hist || []; redo = S[m].redo || []; active = S[m].active || 0; sel = null;
  buildScene(); renderExp();
}

/* ---------------- cálculo ---------------- */
function calculate() {
  /* novo cálculo: descarta pergunta de veículo extra pendente do cálculo anterior */
  calcSeq++; xSug = null; if ($('#mExtra').classList.contains('on')) $('#mExtra').classList.remove('on');
  const lines = curLines();
  if (mode === 'cat' && lines.length < S.cat.lines.length) toast('Algum produto do pedido foi excluído do cadastro e ficou de fora.', true);
  if (!lines.length) { toast('Faltou a carga: adicione pelo menos um produto (ou cole a lista do pedido).', true); if (mode !== 'cat') openOrder(); else go('catalogo'); return; }
  let ordered = lines;
  if (mode === 'route') { const chk = RT.check(lines); if (chk) { toast(chk, true); if (/entrega|carga/i.test(chk) && !/remetente|destino/i.test(chk)) openOrder(); else RT.showTab(); return; } ordered = RT.orderLines(lines); }
  const v0 = curVeh(); stopAnim(true);
  const r = NX.planLoad(fleet, v0.id, ordered, { extras: false });
  plan = r; active = 0; hist = []; redo = []; sel = null;
  buildScene(); renderAll(); renderQuote();
  if (r.left.length) askExtra(); else finishCalc();
}
function finishCalc() {
  if (NX.opcoes().manual) { const bad = plan.vehs.flatMap(V => NX.stats(V.v, V.items).al.filter(a => a.tot > a.lim + 1).map(a => V.v.name + ': ' + a.n)); if (bad.length) setTimeout(() => toast('Atenção: acima do limite legal — ' + bad.join('; ') + '. Arrume a carga.', true), 600); }
  const loaded = plan.vehs.reduce((s, V) => s + V.items.length, 0);
  toast(plan.left.length ? `${plan.left.length} volume(s) ficaram fora do carregamento.` : plan.vehs.length > 1 ? `${loaded} volumes distribuídos em ${plan.vehs.length} veículos.` : `Todos os ${loaded} volumes couberam no ${plan.vehs[0].v.name}.`, plan.left.length > 0);
  if (!document.body.classList.contains('rm')) startAnim('in');
}
/* pergunta antes de cada veículo extra */
let xSug = null, calcSeq = 0;
function askExtra() {
  if (plan.vehs.length >= 5) { toast('Limite de 4 veículos extras atingido.', true); return finishCalc(); }
  xSug = NX.suggestExtra(fleet, plan.left); if (xSug) xSug.plan = plan;
  if (!xSug) { toast('Nenhum veículo rodoviário da frota leva os volumes restantes.', true); return finishCalc(); }
  const kg = plan.left.reduce((s, u) => s + u.kg, 0), last = plan.vehs[plan.vehs.length - 1].v;
  const why = new Set(); for (const V of plan.vehs) { const vc = new Set(V.items.flatMap(i => i.p.cats || [])); for (const u of plan.left) { const r = NX.blockReason(V.v, u.p, vc); if (r) why.add(r); } }
  $('#mxMsg').innerHTML = `A carga não coube toda no <b>${esc(last.name)}</b>: sobraram <b>${plan.left.length} volume(s)</b> (${fmt(kg, 0)} kg). Deseja adicionar ${plan.vehs.length > 1 ? 'mais um' : 'um'} veículo extra?` + (why.size ? `<br><small class="warn">Motivo: ${[...why].map(esc).join('; ')}.</small>` : '');
  $('#mxVeh').innerHTML = fleet.filter(v => v.cat !== 'Container').sort((a, b) => NX.vol(a) - NX.vol(b)).map(v => `<option value="${v.id}" ${v.id === xSug.v.id ? 'selected' : ''}>${esc(v.name)}${v.id === xSug.v.id ? ' — sugerido' : ''}</option>`).join('');
  mxFit(); $('#mExtra').classList.add('on'); setTimeout(() => $('#mxYes').focus(), 30);
}
function mxFit() {
  const id = $('#mxVeh').value; xSug = NX.suggestExtra(fleet, plan.left, id); if (xSug) xSug.plan = plan;
  $('#mxFit').innerHTML = xSug ? (xSug.all ? `<span class="ok">✔ Leva todos os ${plan.left.length} volumes restantes.</span>` : `<span class="warn">Leva ${xSug.r.items.length} de ${plan.left.length} volumes — vou perguntar de novo para o restante.</span>`) : '<span class="bad">Este veículo não leva nenhum dos volumes restantes.</span>';
  $('#mxYes').disabled = !xSug;
}
$('#mxVeh').onchange = mxFit;
$('#mxYes').onclick = () => { if (!xSug || xSug.plan !== plan || !plan.left.length) { $('#mExtra').classList.remove('on'); xSug = null; return; } $('#mExtra').classList.remove('on'); plan.vehs.push({ v: xSug.v, items: xSug.r.items }); plan.left = xSug.r.left; buildScene(); renderAll(); renderQuote(); toast(`${xSug.v.name} adicionado como veículo extra.`); if (plan.left.length) { const seq = calcSeq, pl = plan; setTimeout(() => { if (seq === calcSeq && pl === plan) askExtra(); }, 250); } else finishCalc(); };
$('#mxNo').onclick = () => { $('#mExtra').classList.remove('on'); finishCalc(); };
$('#mExtra').addEventListener('keydown', e => { if (e.key === 'Escape') $('#mxNo').click(); });

/* ---------------- EXPEDIÇÃO: painel ---------------- */
function encChip(p, v) {
  const g = NX.grid(v, p); if (!g) return '<span class="enc no">não cabe</span>'; const over = p.q > g.tot;
  return `<span class="enc ${over ? 'over' : ''}" title="${esc(g.o.k)} · ${g.nl} no comprimento × ${g.nw} na largura × ${g.nh} camada(s)${v.wag > 1 ? ' × ' + v.wag + ' vagões' : ''} = ${g.tot} por veículo${over ? ' — excede, usará veículo extra' : ''}">${g.nl} × ${g.nw} × ${g.nh}${v.wag > 1 ? ' ×' + v.wag : ''} = ${g.tot}</span>`;
}
/* ---------- desenho das configurações de eixos (estilo tabela "peso por eixo") ---------- */
const AXD = {
  'toco': { cab: [8, 30], boxes: [[40, 170]], g: [[[26], '6t'], [[176], '10t']] },
  'trucado': { cab: [8, 30], boxes: [[40, 170]], g: [[[26], '6t'], [[160, 178], '17t']] },
  'cav-toco-ls': { cab: [8, 30], boxes: [[44, 186]], g: [[[24], '6t'], [[54], '10t'], [[184, 200, 216], '25,5t']] },
  'cav-truc-ls': { cab: [8, 30], boxes: [[50, 180]], g: [[[22], '6t'], [[44, 60], '17t'], [[184, 200, 216], '25,5t']] },
  'cav-toco-vand': { cab: [8, 30], boxes: [[44, 186]], g: [[[24], '6t'], [[54], '10t'], [[132], '10t'], [[178], '10t'], [[212], '10t']] },
  'romeu-julieta': { cab: [8, 30], boxes: [[40, 86], [134, 96]], g: [[[24], '6t'], [[98, 114], '17t'], [[152], '10t'], [[214], '10t']] },
  'rodotrem9': { cab: [8, 30], boxes: [[46, 88], [140, 90]], g: [[[22], '6t'], [[42, 56], '17t'], [[110, 124], '17t'], [[142, 156], '17t'], [[206, 220], '17t']] },
  'bitruck': { cab: [8, 30], boxes: [[40, 170]], g: [[[22, 38], '6+6t'], [[160, 178], '17t']] },
  'truck-tt': { cab: [8, 30], boxes: [[40, 170]], g: [[[26], '6t'], [[156, 172, 188], '25,5t']] },
  'cav-toco-1': { cab: [8, 30], boxes: [[44, 186]], g: [[[24], '6t'], [[54], '10t'], [[210], '10t']] },
  'cav-toco-2': { cab: [8, 30], boxes: [[44, 186]], g: [[[24], '6t'], [[54], '10t'], [[194, 210], '17t']] },
  'cav-toco-2d': { cab: [8, 30], boxes: [[44, 186]], g: [[[24], '6t'], [[54], '10t'], [[176], '10t'], [[212], '10t']] },
  'cav-truc-1': { cab: [8, 30], boxes: [[50, 180]], g: [[[22], '6t'], [[44, 60], '17t'], [[210], '10t']] },
  'cav-truc-2': { cab: [8, 30], boxes: [[50, 180]], g: [[[22], '6t'], [[44, 60], '17t'], [[194, 210], '17t']] },
  'cav-truc-2d': { cab: [8, 30], boxes: [[50, 180]], g: [[[22], '6t'], [[44, 60], '17t'], [[176], '10t'], [[212], '10t']] },
  'cav-truc-ls-c': { cab: [8, 30], boxes: [[50, 160]], g: [[[22], '6t'], [[44, 60], '17t'], [[166, 180, 194], '25,5t']] },
  'cav-truc-vs': { cab: [8, 30], boxes: [[50, 180]], g: [[[22], '6t'], [[44, 60], '17t'], [[158], '10t'], [[198, 214], '17t']] },
  'cav-truc-vand': { cab: [8, 30], boxes: [[50, 180]], g: [[[22], '6t'], [[44, 60], '17t'], [[136], '10t'], [[180], '10t'], [[214], '10t']] },
  'cav-truc-4e': { cab: [8, 30], boxes: [[50, 180]], g: [[[22], '6t'], [[44, 60], '17t'], [[156], '10t'], [[186, 200, 214], '25,5t']] },
  'rj-3c3': { cab: [8, 30], boxes: [[40, 86], [134, 96]], g: [[[24], '6t'], [[98, 114], '17t'], [[152], '10t'], [[206, 222], '17t']] },
  'rj-2c2': { cab: [8, 30], boxes: [[40, 86], [134, 96]], g: [[[24], '6t'], [[110], '10t'], [[152], '10t'], [[214], '10t']] },
  'bitrem7': { cab: [8, 30], boxes: [[50, 96], [130, 104]], g: [[[22], '6t'], [[44, 60], '17t'], [[118, 134], '17t'], [[204, 220], '17t']] },
  'bitrem9': { cab: [8, 30], boxes: [[50, 96], [130, 104]], g: [[[22], '6t'], [[44, 60], '17t'], [[106, 120, 134], '25,5t'], [[192, 206, 220], '25,5t']] },
  'fab': { cab: [8, 30], boxes: [[40, 120]], g: [[[26], ''], [[134], '']] }
};
function axSvg(v, k, h = 64) {
  const d = AXD[k] || AXD.fab, m = NX.axleModel({ ...v, axcfg: k }), y0 = 10, bh = 30, gy = 58;
  const t = k === 'fab' ? m.ax.map(a => fmt(a.lim / 1000, a.lim % 1000 ? 2 : 0) + 't') : null;
  let o = `<svg viewBox="0 0 240 78" height="${h}" role="img" aria-label="${esc(m.cfg)}" class="axsvg">`;
  o += `<line x1="2" y1="${gy}" x2="238" y2="${gy}" class="gr"/>`;
  for (const [x, w] of d.boxes) o += `<rect x="${x}" y="${y0}" width="${w}" height="${bh}" rx="2" class="bx"/>`;
  const [cx, cw] = d.cab; o += `<path d="M${cx} ${gy - 8} V${y0 + 12} q0 -6 6 -8 h${cw - 10} q4 0 4 4 V${gy - 8} Z" class="cb"/><rect x="${cx + 4}" y="${y0 + 8}" width="${cw - 16}" height="9" rx="1.5" class="wi"/>`;
  o += `<line x1="${cx}" y1="${gy - 8}" x2="${d.boxes[d.boxes.length - 1][0] + d.boxes[d.boxes.length - 1][1]}" y2="${gy - 8}" class="ch"/>`;
  d.g.forEach(([xs, lab], i) => { for (const x of xs) o += `<circle cx="${x}" cy="${gy - 6}" r="6" class="wh"/><circle cx="${x}" cy="${gy - 6}" r="2" class="hb"/>`;
    const mid = (xs[0] + xs[xs.length - 1]) / 2; const L = t ? (t[i] || '') : lab;
    if (xs.length > 1) o += `<line x1="${xs[0]}" y1="${gy + 6}" x2="${xs[xs.length - 1]}" y2="${gy + 6}" class="br"/>`;
    o += `<line x1="${mid}" y1="${gy + 2}" x2="${mid}" y2="${gy + 9}" class="br"/><text x="${mid}" y="${gy + 18}" class="lb">${L}</text>`; });
  return o + '</svg>';
}
const OBS_BAL = `<details class="obsbal"><summary>Observações da balança (Res. CONTRAN 882/2021)</summary><ul><li><b>Até 50 t</b> (toco, truck, LS e carretas até 50 t): na balança só o <b>peso total (PBT)</b> é conferido, com tolerância de 5% (art. 50 §1º). Se passar dela, os eixos também são conferidos e as multas se somam.</li><li><b>Acima de 50 t</b> (vanderléia trucada, LS quarto eixo, bitrem, rodotrem): conferem o PBT (5%) e cada eixo (12,5%).</li><li>Mesmo sem ser pesado na balança, o transportador deve respeitar o limite de cada eixo (art. 51). Eixo sobrecarregado gasta pneu, força a suspensão e piora a frenagem.</li><li>A tolerância é só da fiscalização: não pode ser usada para planejar a carga (art. 50 §3º) e <b>não vale</b> para o peso declarado na NF-e, CT-e ou MDF-e.</li><li>O peso de cada eixo mostrado aqui é uma <b>estimativa</b>: o real depende da posição da quinta roda e do peso vazio de cada veículo. Confira na plaqueta do fabricante, que pode ter limite menor que o legal.</li><li>Multa por excesso (CTB art. 231, V): R$ 130,16 uma vez + acréscimo por 200 kg ou fração, sobre o que passa da tolerância. Há retenção do veículo e remanejamento ou transbordo.</li></ul></details>`;
const dispB = k => { const d = NX.axDisp(k); return `<span class="disp ${d.k}" title="${d.txt}">${d.k === 'facil' ? '● Fácil de achar' : d.k === 'medio' ? '● Com alguma procura' : '● Difícil de achar'}</span>`; };
const DISP_LEG = `<div class="displeg" aria-label="Legenda"><span class="disp facil">● Fácil de achar</span><span class="disp medio">● Com alguma procura</span><span class="disp dificil">● Difícil de achar</span><span class="mut">estimativa pela frota que mais aparece em fretes e emplacamentos</span></div>`;
/* quadro de peso por eixo no 3D (sempre visível com carga calculada) */
function axHud() {
  let el = $('#axHud'); if (!el) { el = document.createElement('div'); el.id = 'axHud'; el.className = 'axhud'; el.setAttribute('aria-live', 'polite'); $('#stage').appendChild(el); el.addEventListener('click', e => { if (e.target.closest('b:first-child')) el.classList.toggle('open'); }); }
  if (!plan || !plan.vehs[active]) { el.hidden = true; return; }
  const V = plan.vehs[active], st = NX.stats(V.v, V.items); el.hidden = false;
  /* status como na balança: OK até o limite legal; Alerta dentro da tolerância (12,5% eixo, 5% PBT); Excesso acima dela */
  const stt = (v, lim, tol) => v <= lim + 1 ? ['ok', 'OK'] : v <= tol + 1 ? ['warn', 'Alerta'] : ['bad', 'Excesso'];
  const B = NX.balanca(st), pbtTol = B.pbtTol, nAl = st.al.filter(a => a.tot > a.lim + 1).length, multa = B.multa;
  const cgx = st.cg && isFinite(st.cg.x) ? st.cg.x : null;
  el.innerHTML = `<b>Peso por eixo${NX.opcoes().manual ? ' · você arruma' : ''}</b>` + st.al.map(a => { const r = a.tot / a.lim; let [c, t] = stt(a.tot, a.lim, a.tolLim); if (c === 'bad' && !B.retido) [c, t] = ['warn', 'Acima do limite'];
    return `<div class="axh ${c}"><span>${esc(a.n.replace(/\s*\(.*\)/, ''))} · <small>${t}</small></span><i style="width:${Math.min(100, r * 100)}%"></i><em>${fmt(a.tot / 1000, 2)} / ${fmt(a.lim / 1000, a.lim % 1000 ? 1 : 0)} t</em></div>`; }).join('')
    + (() => { const [c, t] = stt(st.pbt, st.pbtLim, pbtTol); return `<div class="axh ${c}"><span>PBT · <small>${t}</small></span><i style="width:${Math.min(100, st.pbt / st.pbtLim * 100)}%"></i><em>${fmt(st.pbt / 1000, 1)} / ${fmt(st.pbtLim / 1000, 1)} t</em></div>`; })()
    + (cgx != null ? `<p class="axcg">Centro de gravidade da carga: ${fmt(cgx, 2)} m da cabine</p>` : '')
    + (nAl && !B.retido ? `<p class="warn">${nAl} eixo(s) acima do limite legal. ${B.soPbt ? 'Na balança, veículo de até 50 t é fiscalizado só pelo PBT (Res. 882, art. 50 §1º), mas a carga deve ser planejada dentro do limite de cada eixo.' : 'Dentro da tolerância de 12,5% a balança não multa, mas a tolerância não pode ser usada no planejamento.'}</p>` : '')
    + (B.retido ? `<p class="bad">⚠ Passa da tolerância da balança${B.excP ? ` (PBT: +${fmt(B.excP, 0)} kg)` : ''}${B.excE ? ` (eixos: +${fmt(B.excE, 0)} kg)` : ''}. Multa estimada: R$ ${fmt(multa, 2)}, com retenção do veículo e ${B.excP ? 'transbordo' : 'remanejamento ou transbordo'}.${NX.opcoes().manual ? ' Arrume os volumes.' : ''}</p>` : '');
}
function renderAxRef() {
  const el = $('#axRef'); if (!el) return;
  const LEN = { Truck: 10.4, Carreta: 15.4, Rodotrem: 12.5 };
  const PB = k => NX.AXCFG[k].pbt || 0;
  const ROWS = NX.axOptions('Truck').concat(NX.axOptions('Carreta'), NX.axOptions('Rodotrem')).sort((a, b) => PB(a[0]) - PB(b[0])).map(([k, n]) => { const cat = NX.axOptions('Truck').some(o => o[0] === k) ? 'Truck' : NX.axOptions('Carreta').some(o => o[0] === k) ? 'Carreta' : 'Rodotrem'; return [k, n.replace(/\s*\(.*\)$/, ''), cat, LEN[cat]]; });
  el.innerHTML = '<caption style="caption-side:top;text-align:left">' + DISP_LEG + '</caption><thead><tr><th>Configuração</th><th>Desenho</th><th>Limites</th></tr></thead><tbody>' + ROWS.map(([k, nome, cat, L]) => { const v = { id: 'ref', name: nome, cat, L, W: 2.5, H: 2.7, wag: cat === 'Rodotrem' ? 2 : 1, axcfg: k }; const m = NX.axleModel(v);
    return `<tr><td><b>${nome}</b><br>${dispB(k)}</td><td>${axSvg(v, k, 58)}</td><td>${m.ax.map(a => fmt(a.lim / 1000, a.lim % 1000 ? 1 : 0) + 't').join(' + ')}${Math.abs(m.ax.reduce((t, a) => t + a.lim, 0) - m.pbt) > 1 ? ' · PBT máximo' : ' ='} <b>${fmt(m.pbt / 1000, 1)} toneladas</b></td></tr>`; }).join('') + '</tbody>';
}
function renderAxCard() { setTimeout(() => { if (mode === 'route' && RT.renderAntt) RT.renderAntt(); }, 0);
  const v = curVeh(), k = NX.axcfgOf(v), m = NX.axleModel(v), opts = NX.axOptions(v.cat);
  $('#axCfgInfo').innerHTML = `<div class="axcard">${axSvg(v, k, 52)}<div class="axtx"><b>${esc(m.cfg.replace(/\s*\(.*\)\s*$/, '') || m.cfg)}</b>${opts.length > 1 ? dispB(k) : ''}<span>${m.ax.map(a => fmt(a.lim / 1000, a.lim % 1000 ? 1 : 0)).join(' + ')} = <b>${fmt(m.pbt / 1000, 1)} t</b> · carga útil ${fmt(NX.vehMaxCargo(v) / 1000, 1)} t</span></div>${opts.length > 1 ? '<button class="btn sm" id="bAxPick">Trocar eixos</button>' : '<span class="mut" style="font-size:11px">limite do fabricante</span>'}</div>`;
  const bo = NX.bodyOptions(v.cat), cb = NX.bodyOf(v);
  const man = NX.opcoes().manual;
  $('#axCfgInfo').insertAdjacentHTML('beforeend', `<div class="arrseg" role="radiogroup" aria-label="Quem arruma a carga"><button type="button" role="radio" data-arr="sis" class="${man ? '' : 'on'}" aria-checked="${!man}">🤖 Sistema arruma a carga</button><button type="button" role="radio" data-arr="usr" class="${man ? 'on' : ''}" aria-checked="${man}">✋ Usuário arruma a carga</button></div><p class="mut arrtxt">${man ? 'Coloca tudo encostado a partir da cabine, sem mexer por causa do peso por eixo. Só avisa se passar da carga permitida. Depois arrume os volumes como quiser (arrastar, setas, girar) e acompanhe o peso de cada eixo no quadro do 3D.' : 'O sistema coloca a carga junta a partir da cabine, sem espaço entre as fileiras, e confere o peso como a balança: em veículo de até 50 t (toco, truck, LS) vale o peso total (PBT); acima de 50 t, também cada eixo, com a tolerância de 12,5%. Se não couber, deixa volumes de fora e pergunta pelo veículo extra.'}</p>` + OBS_BAL);
  $$('#axCfgInfo [data-arr]').forEach(b => b.onclick = () => { const m = b.dataset.arr === 'usr'; if (m === NX.opcoes().manual) return; NX.opcoes({ manual: m, cabine: true }); LS.set('manual', m); renderAxCard(); if (curLines().length) calculate(); toast(m ? 'Usuário arruma a carga: o sistema não mexe por causa dos eixos, só avisa.' : 'Sistema arruma a carga respeitando o peso por eixo.'); });
  if (bo.length) $('#axCfgInfo').insertAdjacentHTML('beforeend', `<div class="bodyseg" role="radiogroup" aria-label="Carroceria"><span>Carroceria</span>${bo.map(b => `<button role="radio" aria-checked="${b === cb}" class="${b === cb ? 'on' : ''}" data-body="${b}">${b === 'bau' ? '▣' : b === 'sider' ? '▥' : '▭'} ${NX.BODIES[b].replace(' (grade)', '')}</button>`).join('')}</div>`);
  $$('#axCfgInfo [data-body]').forEach(x => x.onclick = async () => { const vv = curVeh(); vv.body = x.dataset.body; try { fleet = await DB.saveVehicles(fleet); } catch (er) { toast(er.message, true); } renderVehSel(); toast('Carroceria: ' + NX.BODIES[NX.bodyOf(curVeh())]); if (plan) calculate(); else if (scene) buildScene(); });
  if (['Truck', 'Carreta', 'Rodotrem', 'Container'].includes(v.cat)) {
    $('#axCfgInfo').insertAdjacentHTML('beforeend', `<label class="altfuel"><input type="checkbox" id="cAltF" ${v.combAlt ? 'checked' : ''}> ⚡ Elétrico, híbrido ou a gás (GNV/biometano): eixo dianteiro de 7 t <small class="mut">Res. CONTRAN 1015/2024</small></label>`);
    $('#cAltF').onchange = async e => { const vv = curVeh(); vv.combAlt = e.target.checked || undefined; try { fleet = await DB.saveVehicles(fleet); } catch (er) { toast(er.message, true); } renderAxCard(); toast(e.target.checked ? 'Eixo dianteiro com limite de 7 t (veículo elétrico ou a gás).' : 'Eixo dianteiro com limite de 6 t.'); if (plan) calculate(); };
  }
  if (typeof REC === 'object') $('#axCfgInfo').insertAdjacentHTML('beforeend', REC.taraHTML(v));
  const b = $('#bAxPick'); if (b) b.onclick = openAxPicker;
}
function openAxPicker() {
  const v = curVeh(), cur = NX.axcfgOf(v);
  $('#maxT').textContent = 'Configuração de eixos — ' + v.name;
  $('#maxGrid').innerHTML = DISP_LEG + NX.axOptions(v.cat).map(([k]) => { const vv = { ...v, axcfg: k }, m = NX.axleModel(vv);
    return `<button class="axopt ${k === cur ? 'on' : ''}" data-ax="${k}" aria-pressed="${k === cur}">${axSvg(v, k, 70)}<b>${esc(m.cfg.replace(/\s*\(.*\)\s*$/, ''))}</b>${dispB(k)}<span>${m.ax.map(a => fmt(a.lim / 1000, a.lim % 1000 ? 1 : 0)).join(' + ')} = <b>${fmt(m.pbt / 1000, 1)} t</b></span><span class="mut">Carga útil máx. ${fmt(NX.vehMaxCargo(vv), 0)} kg · ${m.ax.length} grupos de eixos</span></button>`; }).join('');
  $('#mAx').classList.add('on'); setTimeout(() => { const b = $('#maxGrid .axopt.on'); b && b.focus(); }, 30);
}
$('#maxGrid').addEventListener('click', async e => { const b = e.target.closest('[data-ax]'); if (!b) return; const v = curVeh(); v.axcfg = b.dataset.ax;
  try { fleet = await DB.saveVehicles(fleet); } catch (er) { toast(er.message, true); }
  $('#mAx').classList.remove('on'); renderVehSel(); renderOrder(); toast('Eixos: ' + NX.axleModel(curVeh()).cfg);
  if (plan) calculate(); });
$('#maxX').onclick = () => $('#mAx').classList.remove('on');
$('#mAx').addEventListener('keydown', e => { if (e.key === 'Escape') $('#mAx').classList.remove('on'); });
function renderVehSel() {
  const opts = fleet.map(v => `<option value="${v.id}">${esc(v.name)} — ${fmt(NX.vol(v))} m³</option>`).join('');
  $('#selVeh').innerHTML = opts; $('#selVeh').value = curVeh().id;
  renderAxCard();
  $('#ctVeh').innerHTML = opts; $('#ctVeh').value = (fleet.find(v => v.id === S.cat.veh) || fleet[0]).id;
}
function renderOrder() {
  const v = curVeh(), lines = curLines();
  $('#orderTools').innerHTML = mode === 'cat'
    ? '<button class="btn" data-go="catalogo" style="flex:1">← Voltar ao catálogo</button>'
    : (curLines().length ? '<button class="btn" id="bEditOrder" style="flex:1">✎ Adicionar ou editar itens</button>' : '<button class="btn pri" id="bEditOrder" style="flex:1">+ Adicionar o primeiro item</button>');
  if (mode !== 'cat') $('#bEditOrder').onclick = openOrder;
  $('#tOrder tbody').innerHTML = lines.map((p, i) => `<tr><td><span class="sw" style="background:${colorOf(p)}"></span><span class="num">${i + 1}</span>${esc(p.nome)}${mode === 'route' && RT.rank(p.stop) != null ? ` <span class="stopb" title="${esc(RT.stopName(p.stop))}">E${RT.rank(p.stop)}</span>` : ''}<br><small class="mut">${esc(p.cod)} · ${tipoNome(p.tipo)} · ${dimTxt(p)} · ${fmt(p.kg, 0)} kg</small></td>
    <td>${mode === 'cat' ? `<input type="number" min="1" max="5000" value="${p.q}" data-cq="${esc(p.id)}" aria-label="Quantidade de ${esc(p.nome)}" style="width:66px">` : `<b>${p.q}</b>`}</td><td>${encChip(p, v)}</td></tr>`).join('')
    || `<tr><td colspan="3" class="mut">${mode === 'cat' ? 'Nenhum produto selecionado — volte ao catálogo.' : 'Nenhum item ainda. Toque em “+ Adicionar o primeiro item”.'}</td></tr>`;
}
const MODE_NAME = { cat: 'Mostrar Catálogo', quick: 'Montagem Rápida', route: 'Montagem com Roteirização' };
const stopN = it => mode === 'route' && it.p ? RT.rank(it.p.stop) : null;
function renderTabs() {
  $('#modeTag').textContent = MODE_NAME[mode]; $('#modeTag').className = 'mode-tag' + (mode === 'cat' ? ' cat' : mode === 'route' ? ' rota' : '');
  if (!plan) { $('#vehTabs').innerHTML = '<span class="mut" style="font-size:12px;padding:4px">Calcule uma carga</span>'; return; }
  $('#vehTabs').innerHTML = plan.vehs.map((V, i) => `<button class="btn sm ${i === active ? 'on' : ''}" data-veh="${i}">${i ? 'Extra ' + i + ': ' : ''}${esc(V.v.name)} (${V.items.length})</button>`).join('');
}
/* descrição em texto de um volume (usada pela lista acessível e pelos avisos falados) */
function describeItem(it, V) {
  V = V || plan.vehs[active]; const same = V.items.filter(o => o.wg === it.wg);
  const rows = [...new Set(same.map(o => o.x.toFixed(3)))].sort((a, b) => a - b); const row = rows.indexOf(it.x.toFixed(3)) + 1;
  const cy = it.y + it.w / 2, W = V.v.W, lado = cy < W / 3 ? 'lado esquerdo' : cy > 2 * W / 3 ? 'lado direito' : 'centro';
  const cam = it.z < 0.01 ? 'no piso' : 'camada ' + (1 + same.filter(o => o.z < it.z - 0.01 && Math.abs(o.x - it.x) < it.l && Math.abs(o.y - it.y) < it.w).length);
  const cats = (it.p.cats || []).map(k => NX.PCATS[k] ? NX.PCATS[k].nome : '').filter(Boolean);
  return `Volume ${vn2(it.n)}, ${it.nome}, ${tipoNome(it.p.tipo).toLowerCase()} ${fmt(it.l, 2)} por ${fmt(it.w, 2)} por ${fmt(it.h, 2)} metros, ${fmt(it.kg, 0)} quilos. ${V.v.wag > 1 ? 'Vagão ' + (it.wg + 1) + ', ' : ''}fileira ${row} (de ${fmt(it.x, 2)} a ${fmt(it.x + it.l, 2)} m da frente), ${lado}, ${cam}.${cats.length ? ' Atenção: ' + cats.join(', ') + '.' : ''}${stopN(it) != null ? ' Entrega ' + stopN(it) + ', ' + RT.stopName(it.p.stop) + '.' : ''}`;
}
function renderList() {
  const os = $('#oStop'); if (os && mode === 'route') { const v0 = os.value; os.innerHTML = '<option value="">Todas as entregas</option>' + RT.stopOptions(v0); os.value = v0; }
  const el = $('#itemList'); const vn = $('#volsN'); if (vn) vn.textContent = plan ? '(' + plan.vehs[active].items.length + ')' : ''; if (!plan) { el.innerHTML = '<p class="mut">—</p>'; return; }
  const f = $('#oFilter').value.toLowerCase().trim(); const V = plan.vehs[active];
  const fs = mode === 'route' && $('#oStop') ? $('#oStop').value : ''; const list = [...V.items].sort((a, b) => a.n - b.n).filter(it => (!f || (it.nome + ' ' + it.cod + ' ' + vn2(it.n)).toLowerCase().includes(f)) && (!fs || it.p.stop === fs));
  const cur = list.includes(sel) ? sel : list[0];
  el.setAttribute('role', 'listbox'); el.setAttribute('aria-label', 'Volumes do veículo ativo. Setas para cima e para baixo percorrem; Enter seleciona e leva o teclado para a cena 3D.');
  el.innerHTML = list.map(it => `<div role="option" id="opt-${it.n}" tabindex="${it === cur ? 0 : -1}" data-it="${it.n}" class="${it === sel ? 'sel' : ''}" aria-selected="${it === sel}" aria-label="${esc(describeItem(it, V))}"><span class="sw" style="background:${colorOf(it.p)}" aria-hidden="true"></span><span class="num" aria-hidden="true">${vn2(it.n)}</span><span aria-hidden="true">${esc(it.nome)}</span>${stopN(it) != null ? `<span class="stopb" aria-hidden="true">E${stopN(it)}</span>` : ''}<span class="mut" style="margin-left:auto" aria-hidden="true">${V.v.wag > 1 ? 'V' + (it.wg + 1) + ' · ' : ''}${fmt(it.kg, 0)} kg</span></div>`).join('') || '<p class="mut">Nenhum volume neste veículo.</p>';
}
function selectItem(it) { sel = it; const vb = $('#volsBox'); if (vb && !vb.open && window.innerWidth > 700) vb.open = true; highlight(); renderList(); updBtns(); const el = $(`#itemList [data-it="${it.n}"]`), side = $('#side');
  /* rola só a lista dentro do painel; nunca a página (no celular a lista fica abaixo do 3D) */
  if (el && side && side.scrollHeight > side.clientHeight + 2) { const top = el.offsetTop - side.offsetTop, h = el.offsetHeight; if (top < side.scrollTop + 60) side.scrollTop = top - 60; else if (top + h > side.scrollTop + side.clientHeight - 10) side.scrollTop = top + h - side.clientHeight + 10; } }
const bar = r => `<div class="bar"><i class="${r > 1 ? 'b' : r > .9 ? 'w' : ''}" style="width:${Math.min(100, r * 100)}%"></i></div>`;
function calcHTML(V, vi) {
  const v = V.v, s = NX.stats(v, V.items);
  return `<h3 style="margin:6px 0">${vi ? 'Extra ' + vi + ': ' : 'Veículo 1: '}${esc(v.name)}</h3>
  <div class="kv"><span>Volumes carregados</span><b>${V.items.length}</b></div>
  <div class="kv"><span>Volume ocupado</span><b>${fmt(s.cub, 2)} / ${fmt(s.vol, 1)} m³ (${fmt(s.occ * 100, 0)}%)</b></div>${bar(s.occ)}
  <div class="kv"><span>Espaço restante</span><b>${fmt(s.free, 2)} m³</b></div>
  <div class="kv"><span>Peso da carga</span><b>${fmt(s.kg, 0)} / ${fmt(s.maxKg, 0)} kg (${fmt(s.kgOcc * 100, 0)}%)</b></div>${bar(s.kgOcc)}
  <div class="kv"><span>Peso bruto total (PBT)</span><b class="${s.pbt > s.pbtLim ? 'bad' : 'ok'}">${fmt(s.pbt, 0)} / ${fmt(s.pbtLim, 0)} kg</b></div>
  ${s.wagons.map(w => `<div class="kv"><span>${v.wag > 1 ? 'Compartimento ' + (w.g + 1) : 'Compartimento'}</span><b>${w.n} vol. · ${fmt(w.kg, 0)} kg · livre no fundo ${fmt(w.freeLen, 2)} m</b></div>`).join('')}
  ${s.cg ? `<div class="kv"><span>Centro de gravidade</span><b>${fmt(s.cg.x, 2)} m da frente · ${s.cg.lat >= 0 ? '+' : ''}${fmt(s.cg.lat * 100, 0)} cm lateral · ${fmt(s.cg.z, 2)} m de altura</b></div>` : ''}
  <h4 style="margin:12px 0 2px">Peso por eixo (carga + tara)</h4><p class="mut" style="font-size:12px;margin:0 0 6px">${esc(NX.axleModel(v).cfg)} · fonte: ${esc(NX.axleModel(v).src)}</p>
  ${s.al.map(a => `<div class="kv"><span>${a.n}<br><small class="mut">carga ${fmt(a.cargo / 1000, 2)} t + tara ${fmt(a.tare / 1000, 2)} t · folga ${fmt(Math.max(0, a.lim - a.tot) / 1000, 2)} t</small></span><b class="${a.tot > a.tolLim ? 'bad' : a.tot > a.lim ? 'warn' : a.tot > a.lim * .9 ? 'warn' : 'ok'}">${fmt(a.tot / 1000, 2)} / ${fmt(a.lim / 1000, 2)} t ${a.tot > a.tolLim ? '✖' : a.tot > a.lim ? '⚠ na tolerância' : '✔'}</b></div>${bar(a.tot / a.lim)}`).join('')}
  <p class="mut" style="font-size:11px">${NX.opcoes().cabine ? 'A carga fica junta a partir da cabine. Cada eixo pode chegar até a tolerância de 12,5% (Lei 14.229/2021); o PBT continua no limite legal. Acima do limite legal aparece “⚠ na tolerância”.' : 'A carga sempre começa na cabine; se um eixo passaria do limite legal, o sistema abre espaço entre as fileiras para distribuir o peso. A tolerância de balança (12,5% por eixo / 5% no PBT, Lei 14.229/2021) não entra no planejamento.'}</p>`;
}
function renderCalc() {
  const el = $('#calcOut'); if (!plan) { el.innerHTML = '<p class="mut">Toque em “▶ Ver como a carga fica” para ver aqui.</p>'; return; }
  const loaded = plan.vehs.reduce((s, V) => s + V.items.length, 0), kg = plan.vehs.reduce((s, V) => s + V.items.reduce((a, i) => a + i.kg, 0), 0);
  const cub = plan.vehs.reduce((s, V) => s + V.items.reduce((a, i) => a + i.l * i.w * i.h, 0), 0), vt = plan.vehs.reduce((s, V) => s + NX.vol(V.v), 0);
  const v0 = plan.vehs[0].v, lines = curLines();
  let h = `<div class="kpi"><div><b>${plan.vehs.length}</b><span>veículo(s) necessário(s)</span></div><div><b>${loaded}<small class="mut">/${plan.total}</small></b><span>volumes carregados</span></div>
   <div><b class="${plan.left.length ? 'bad' : 'ok'}">${plan.left.length}</b><span>volumes restantes</span></div><div><b>${fmt(kg / 1000, 2)} t</b><span>peso total</span></div>
   <div><b>${fmt(cub, 1)} m³</b><span>volume ocupado</span></div><div><b>${fmt(cub / vt * 100, 0)}%</b><span>ocupação média</span></div></div>`;
  h += `<h4 style="margin:6px 0">Capacidade máxima estimada no ${esc(v0.name)}</h4><p class="mut" style="font-size:12px;margin:0 0 4px">Encaixe físico por produto (comprimento × largura × camadas), já limitado por empilhamento, níveis e peso.</p>`;
  for (const p of lines) { const g = NX.grid(v0, p); const byKg = Math.floor(NX.vehMaxCargo(v0) / p.kg); h += `<div class="kv"><span><span class="num">${pnum(p.id)}</span>${esc(p.nome)}</span><span>${encChip(p, v0)}${g && byKg < g.tot ? ` <span class="warn" title="limitado pelo peso">peso: ${byKg}</span>` : ''}</span></div>`; }
  el.innerHTML = h + plan.vehs.map(calcHTML).join('<hr style="border-color:var(--line)">') + '<p class="mut" style="font-size:12px">Limites de referência: Res. CONTRAN 882/2021. Taras estimadas.</p>';
}
function renderPlanTab() {
  const el = $('#loadOut'); if (!plan) { el.innerHTML = '<p class="mut">Toque em “▶ Ver como a carga fica” para ver aqui.</p>'; $('#descOut').innerHTML = ''; return; }
  el.innerHTML = '<h3 style="margin:4px 0">Como carregar</h3><p class="mut" style="font-size:12px">Fileiras da frente (junto à cabine) para a traseira. Em cada fileira: camada de baixo primeiro, da esquerda para a direita.</p>' + plan.vehs.map((V, vi) => {
    let h = `<h4 style="margin:10px 0 4px">Veículo ${vi + 1}: ${esc(V.v.name)}</h4>`;
    for (let g = 0; g < V.v.wag; g++) {
      const its = V.items.filter(i => i.wg === g); if (!its.length) continue; if (V.v.wag > 1) h += `<b style="font-size:13px">Compartimento ${g + 1}</b>`;
      const xs = [...new Set(its.map(i => i.x.toFixed(3)))].sort((a, b) => a - b);
      xs.forEach((xk, ri) => { const row = its.filter(i => i.x.toFixed(3) === xk).sort((a, b) => a.z - b.z || b.y - a.y); const f = row[0]; const lv = new Set(row.map(i => i.z.toFixed(2))).size;
        h += `<div class="plan-row"><b>Fileira ${ri + 1}</b> <span class="mut">· ${fmt(+xk, 2)}–${fmt(+xk + f.l, 2)} m da frente · ${row.length} vol. (${lv} camada${lv > 1 ? 's' : ''})</span><br>${row.map(i => `<span class="num" title="${esc(i.nome)}" style="background:${colorOf(i.p)};color:#111">${vn2(i.n)}</span>`).join('')} <span class="mut">${esc(f.ok || '')} · ${fmt(f.l, 2)} m no comprimento</span></div>`; });
      h += `<p class="mut" style="font-size:12px">Espaço livre no fundo: ${fmt(V.v.L - Math.max(...its.map(i => i.x + i.l)), 2)} m</p>`;
    }
    return h;
  }).join('') + '<h3 style="margin:16px 0 4px">Ordem de descarga</h3><p class="mut" style="font-size:13px">Por compartimento, portas traseiras primeiro.</p>';
  $('#descOut').innerHTML = plan.vehs.map((V, vi) => { let h = `<h4 style="margin:10px 0 4px">Veículo ${vi + 1}: ${esc(V.v.name)}</h4>`;
    for (let g = V.v.wag - 1; g >= 0; g--) { const its = V.items.filter(i => i.wg === g).sort((a, b) => (b.x + b.l) - (a.x + a.l) || b.z - a.z);
      h += (V.v.wag > 1 ? `<b style="font-size:13px">Compartimento ${g + 1}</b>` : '') + '<ol class="list" style="padding-left:20px">' + its.map(it => `<li><span class="sw" style="background:${colorOf(it.p)}"></span><span class="num">${vn2(it.n)}</span>${esc(it.nome)} <span class="mut">${esc(it.cod)}</span></li>`).join('') + '</ol>'; }
    return h; }).join('');
}
function updBtns() {
  $('#bUndo').disabled = !hist.length; $('#bRedo').disabled = !redo.length; ['#bOri', '#bRot', '#bLay', '#bFocus', '#bDesel'].forEach(s => $(s).disabled = !sel);
  const si = $('#selInfo'); if (si) { si.textContent = sel ? `Volume ${String(sel.n).padStart(2, '0')} · ${sel.nome}` : 'Clique em um volume'; si.classList.toggle('on', !!sel); si.title = si.textContent; }
}
function renderAll() { axHud(); if (plan && !anim) updateBrand(); renderTabs(); renderList(); renderCalc(); renderPlanTab(); updBtns(); highlight(); RT.renderUnload(); if (typeof SEC === 'object') SEC.refresh(); if (typeof PERIG === 'object') PERIG.render(); }
function afterEdit() { updateVoids(); renderAll(); }
function renderExp() { renderVehSel(); renderOrder(); renderAll(); renderQuote(); $('#cenName').value = ''; RT.render(); }
function setActive(vi) { if (vi === active) return; stopAnim(true); active = vi; sel = null; setView(curView); renderAll(); }

/* ---------------- COTAÇÃO (valores digitados pelo usuário) ---------------- */
function renderQuote() {
  const q = S[mode].quote || (S[mode].quote = {});
  $('#qCli').value = q.cliente || ''; $('#qOri').value = q.origem || ''; $('#qDes').value = q.destino || ''; $('#qPed').value = q.pedagio ?? ''; $('#qOut').value = q.outros ?? ''; $('#qObs').value = q.obs || '';
  const vs = plan ? plan.vehs : []; q.fretes = (q.fretes || []).slice(0, vs.length);
  $('#qFretes').innerHTML = vs.map((V, i) => `<label class="f">Frete veículo ${i + 1} — ${esc(V.v.name)} (R$)<input type="number" min="0" step="0.01" data-qf="${i}" value="${q.fretes[i] ?? ''}"></label>`).join('') || '<p class="mut">Calcule a carga para informar o frete de cada veículo.</p>';
  quoteTotal();
}
function quoteTotal() {
  const q = S[mode].quote; const fr = (q.fretes || []).reduce((s, v) => s + (+v || 0), 0); const tot = fr + (+q.pedagio || 0) + (+q.outros || 0);
  const filled = (q.fretes || []).some(v => v !== null && v !== '' && v !== undefined);
  $('#qTot').innerHTML = `<div class="kv"><span>Fretes</span><b>${brl(fr)}</b></div><div class="kv"><span>Pedágio + outros</span><b>${brl((+q.pedagio || 0) + (+q.outros || 0))}</b></div><div class="kv"><span>Total da cotação</span><b style="color:var(--acc)">${brl(tot)}</b></div>${filled ? '' : '<p class="warn" style="font-size:12px;margin:6px 0 0">Informe o valor do frete — o sistema não preenche preços.</p>'}`;
}
['qCli:cliente', 'qOri:origem', 'qDes:destino', 'qPed:pedagio', 'qOut:outros', 'qObs:obs'].forEach(pair => { const [id, k] = pair.split(':'); $('#' + id).addEventListener('input', e => { const q = S[mode].quote; q[k] = e.target.type === 'number' ? (e.target.value === '' ? null : Math.max(0, +e.target.value)) : e.target.value; saveWork(); quoteTotal(); }); });
$('#qFretes').addEventListener('input', e => { const i = e.target.dataset.qf; if (i == null) return; const q = S[mode].quote; q.fretes = q.fretes || []; q.fretes[+i] = e.target.value === '' ? null : Math.max(0, +e.target.value); saveWork(); quoteTotal(); });

/* ---------------- MONTAGEM RÁPIDA: modal de carga manual ---------------- */
let draft = [];
const nid = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const COLS = ['#f39a2b', '#2f8cf2', '#32c48d', '#b36bff', '#ff5d8f', '#e6c229', '#3cc9d6', '#9aa6ff'];
function setEdMode(m) { LS.set('edMode', m); $('#mOrder').classList.toggle('simple', m === 'simple'); $$('[data-ed]').forEach(b => { b.classList.toggle('on', b.dataset.ed === m); b.setAttribute('aria-checked', b.dataset.ed === m); }); $('#edHint').textContent = m === 'simple' ? 'Só o essencial: descrição, tipo, medidas (m), quantidade e peso por volume.' : 'Todos os campos: peças, posição, empilhamento e manuseio.'; }
$$('[data-ed]').forEach(b => b.onclick = () => setEdMode(b.dataset.ed));
function openOrder() { setEdMode(LS.get('edMode', 'simple')); draft = JSON.parse(JSON.stringify(S[QM()].lines)); $$('.moStop').forEach(e => e.hidden = mode !== 'route'); $('#moT').textContent = (mode === 'route' ? 'Roteirização' : 'Montagem Rápida') + ' · carga manual'; renderDraft(); $('#mOrder').classList.add('on'); setTimeout(() => { const i = $('#moRows input'); i && i.focus(); }, 50); }
function closeOrder() { $('#mOrder').classList.remove('on'); const b = $('#bEditOrder'); b && b.focus(); }
const rowErrs = p => NX.validateSpec(NX.normalize(p), true);
function renderDraft() {
  const f = $('#moF').value.toLowerCase(); const v = fleet.find(x => x.id === S[QM()].veh) || fleet[0];
  $('#moRows').innerHTML = draft.map((p, i) => { if (f && !(p.nome + p.cod).toLowerCase().includes(f)) return ''; const bob = p.tipo === 'bobina'; const n = NX.normalize(p);
    return `<tr data-r="${i}">
    <td><input class="t" data-k="cod" value="${esc(p.cod)}" aria-label="Código" style="width:92px" maxlength="40"></td>
    <td><input class="t" data-k="nome" value="${esc(p.nome)}" aria-label="Descrição" style="width:125px" maxlength="120"></td>
    <td><select data-k="tipo" aria-label="Tipo" style="width:92px">${Object.entries(NX.TIPOS).map(([k, t]) => `<option value="${k}" ${p.tipo === k ? 'selected' : ''}>${t.nome}</option>`).join('')}</select></td>
    <td class="grp"><input data-k="l" type="number" step="0.01" min="0.01" value="${p.l ?? ''}" aria-label="${bob ? 'Diâmetro' : 'Comprimento'} (m)" style="width:60px"></td>
    <td><input data-k="w" type="number" step="0.01" min="0.01" value="${bob ? '' : p.w ?? ''}" ${bob ? 'disabled placeholder="Ø"' : ''} aria-label="Largura (m)" style="width:60px"></td>
    <td><input data-k="h" type="number" step="0.01" min="0.01" value="${p.h ?? ''}" aria-label="${bob ? 'Largura da bobina' : 'Altura'} (m)" style="width:60px"></td>
    <td class="grp q"><input data-k="q" type="number" min="1" step="1" value="${p.q ?? ''}" aria-label="Quantidade de volumes" style="width:60px"></td>
    <td class="grp"><input data-k="pcs" type="number" min="1" step="1" value="${p.pcs ?? 1}" aria-label="Peças por volume" style="width:56px"></td>
    <td><input data-k="kgp" type="number" min="0" step="0.01" value="${p.kgp === '' || p.kgp === null || p.kgp === undefined || isNaN(p.kgp) ? '' : +(+p.kgp).toFixed(3)}" aria-label="kg por peça" style="width:64px"></td>
    <td><input data-k="kg" type="number" min="0" step="0.1" value="${isNaN(+p.kg) || p.kg === '' ? '' : +(+p.kg).toFixed(2)}" aria-label="kg por volume" style="width:70px"></td>
    <td class="grp"><select data-k="pos" aria-label="Posição" style="width:170px">${NX.POS[p.tipo].map(([k, t]) => `<option value="${k}" ${n.pos === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><input data-k="maxLevels" type="number" min="1" step="1" value="${p.maxLevels ?? ''}" placeholder="livre" aria-label="Níveis máximos" style="width:54px"></td>
    <td><input data-k="stack" type="number" min="0" step="1" value="${p.stack === null || p.stack === undefined ? '' : p.stack}" placeholder="sem limite" aria-label="Aguenta em cima (kg)" style="width:84px"></td>
    <td><select data-k="cats" aria-label="Categoria de manuseio" style="width:118px"><option value="">Geral</option>${Object.entries(NX.PCATS).map(([k, c]) => `<option value="${k}" ${(p.cats || [])[0] === k ? 'selected' : ''}>${c.ic} ${c.nome}</option>`).join('')}</select></td>
    ${mode === 'route' ? `<td class="grp moStop"><select data-k="stop" aria-label="Entrega (destino)" style="width:150px"><option value="">— escolha —</option>${RT.stopOptions(p.stop)}</select></td>` : ''}
    <td class="grp enc-c">${rowErrs(p).length ? '<span class="enc no">incompleto</span>' : encChip(n, v)}</td>
    <td><button class="btn sm" data-del="${i}" aria-label="Remover linha ${esc(p.cod)}">×</button></td></tr>`; }).join('');
  /* rótulos para o modo cartão (celular): cada célula recebe o nome da coluna */
  const ADV = ['cod', 'pcs', 'kgp', 'pos', 'maxLevels', 'stack', 'cats'];
  const ths = $$('#mOrder thead th').filter(th => !th.hidden);
  const tr0 = $('#moRows tr'); if (tr0) [...tr0.children].forEach((td, i) => { const k = td.querySelector('[data-k]'); if (ths[i]) ths[i].classList.toggle('adv', !!(k && ADV.includes(k.dataset.k))); });
  $$('#moRows td').forEach(td => { const k = td.querySelector('[data-k]'); td.classList.toggle('adv', !!(k && ADV.includes(k.dataset.k))); });
  const hd = $$('#mOrder thead th').filter(th => !th.hidden).map(th => th.lastChild ? th.lastChild.textContent.trim() : th.textContent.trim());
  $$('#moRows tr').forEach(tr => [...tr.children].forEach((td, i) => td.dataset.l = hd[i] || ''));
  draftSummary();
}
function draftSummary() {
  const n = draft.map(NX.normalize); const v = n.reduce((s, p) => s + (+p.q || 0), 0), pc = n.reduce((s, p) => s + (+p.q || 0) * (+p.pcs || 0), 0), kg = n.reduce((s, p) => s + (+p.q || 0) * (+p.kg || 0), 0);
  $('#moTot').innerHTML = `Total: <b>${v.toLocaleString('pt-BR')}</b> volumes · <b>${pc.toLocaleString('pt-BR')}</b> peças · <b>${fmt(kg || 0, 0)} kg</b>`;
  let msg = ''; if (!draft.length) msg = 'Faltou a carga: adicione pelo menos um produto (ou cole a lista do pedido).';
  else { for (const p of draft) { const e = rowErrs(p); if (e.length) { msg = `Linha ${esc(p.cod || '(sem código)')}: ${esc(e.join(' '))}`; break; } }
    if (!msg && mode === 'route') { const ns = draft.find(p => RT.rank(p.stop) == null); if (ns) msg = `Linha ${esc(ns.cod || '(sem código)')}: escolha a entrega (destino).`; }
    if (!msg) { const d = draft.map(p => String(p.cod).trim().toLowerCase()); const dup = d.find((c, i) => d.indexOf(c) !== i); if (dup) msg = 'Código repetido: ' + esc(dup.toUpperCase()) + '.'; } }
  $('#moMsg').innerHTML = msg; $('#moApply').disabled = !!msg;
}
$('#moRows').addEventListener('input', e => {
  const t = e.target, tr = t.closest('tr'); if (!tr || !t.dataset.k) return; const p = draft[+tr.dataset.r], k = t.dataset.k;
  if (k === 'cod' || k === 'nome' || k === 'stop') p[k] = t.value;
  else if (k === 'tipo') { p.tipo = t.value; p.pos = NX.POS[p.tipo][0][0]; if (p.tipo === 'bobina') p.w = p.l; renderDraft(); return; }
  else if (k === 'pos') p.pos = t.value;
  else if (k === 'cats') p.cats = t.value ? [t.value] : [];
  else if (k === 'stack' || k === 'maxLevels') p[k] = t.value === '' ? null : +t.value;
  else {
    const n = t.value === '' ? NaN : +t.value; p[k] = n; if (k === 'l' && p.tipo === 'bobina') p.w = n;
    if (k === 'pcs' && n > 0 && p.kgp >= 0) { p.kg = +(n * p.kgp).toFixed(3); tr.querySelector('[data-k=kg]').value = +p.kg.toFixed(2); }
    if (k === 'kgp' && n >= 0) { p.kg = +(n * (p.pcs || 1)).toFixed(3); tr.querySelector('[data-k=kg]').value = +p.kg.toFixed(2); }
    if (k === 'kg' && n >= 0) { p.kgp = +(n / (p.pcs || 1)).toFixed(4); tr.querySelector('[data-k=kgp]').value = +p.kgp.toFixed(3); }
  }
  const er = rowErrs(p); t.setAttribute('aria-invalid', er.length ? 'true' : 'false');
  tr.querySelector('.enc-c').innerHTML = er.length ? '<span class="enc no">incompleto</span>' : encChip(NX.normalize(p), fleet.find(x => x.id === S[QM()].veh) || fleet[0]); draftSummary();
});
$('#moRows').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; draft.splice(+b.dataset.del, 1); renderDraft(); });
$('#moF').oninput = renderDraft;
$('#moAdd').onclick = () => { draft.push({ id: nid(), cod: 'PED-' + String(draft.length + 1).padStart(3, '0'), nome: '', tipo: 'palete', l: '', w: '', h: '', q: '', pcs: 1, kgp: '', kg: '', pos: 'pe', stack: null, maxLevels: null, cor: COLS[draft.length % COLS.length], stop: mode === 'route' ? RT.lastStop() : undefined }); $('#moF').value = ''; renderDraft(); const rs = $$('#moRows tr'); rs[rs.length - 1].querySelector('[data-k=nome]').focus(); };
$('#moReset').onclick = () => { draft = []; renderDraft(); toast('Carga manual limpa.'); };
$('#moCancel').onclick = closeOrder; $('#moX').onclick = closeOrder;
$('#mOrder').addEventListener('keydown', e => { if (e.key === 'Escape') closeOrder(); });
$('#moApply').onclick = () => { if ($('#moApply').disabled) return; S[QM()].lines = draft.map(p => { const n = NX.normalize(p); return { ...n, cod: n.cod.trim(), nome: n.nome.trim() }; }); saveWork(); closeOrder(); renderOrder(); calculate(); };

/* ---------------- MOSTRAR CATÁLOGO ---------------- */
const catSel = new Map(); /* pid -> quantidade */
function syncCatSel() { catSel.clear(); for (const l of S.cat.lines) if (prods.some(p => p.id === l.pid)) catSel.set(l.pid, l.q); }
function renderCatalog() {
  const f = $('#ctFilter').value.toLowerCase().trim(), t = $('#ctType').value; const v = fleet.find(x => x.id === $('#ctVeh').value) || fleet[0];
  const list = prods.filter(p => (!f || (p.nome + ' ' + p.cod).toLowerCase().includes(f)) && (!t || p.tipo === t));
  $('#ctGrid').innerHTML = list.map(p => { const on = catSel.has(p.id); return `<article class="pcard ${on ? 'on' : ''}" data-pid="${p.id}">
    <div class="ph" style="${p.foto ? `background-image:url('${p.foto}')` : ''}">${p.foto ? '' : 'Sem foto'}<span class="tchip ${p.tipo} tp">${tipoNome(p.tipo)}</span></div>
    <div class="bd"><b>${esc(p.nome)}</b><span class="meta">${esc(p.cod)}${p.cat ? ' · ' + esc(p.cat) : ''}${p.emb ? ' · ' + esc(p.emb) : ''}</span>
     <span class="meta">${dimTxt(p)} · ${p.pcs} pç × ${fmt(p.kgp, 2)} kg = <b style="color:var(--txt)">${fmt(p.kg, 1)} kg</b></span>
     ${(p.cats || []).length ? `<span class="meta">${catChips(p)}</span>` : ''}<span class="meta">${esc(stackTxt(p))}</span>${p.obs ? `<span class="meta warn">⚠ ${esc(p.obs)}</span>` : ''}
     <span>${encChip(NX.normalize({ ...p, q: catSel.get(p.id) || 1 }), v)}</span></div>
    <div class="ft"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-csel="${p.id}" ${on ? 'checked' : ''}> Selecionar</label>
     <input type="number" min="1" max="5000" value="${catSel.get(p.id) || 1}" data-cqty="${p.id}" aria-label="Quantidade de volumes de ${esc(p.nome)}" style="margin-left:auto"><span class="mut" style="font-size:12px">vol.</span></div></article>`; }).join('')
    || `<div class="card"><p>${prods.length ? 'Nenhum produto encontrado com esse filtro.' : 'Nenhum produto cadastrado ainda.'}</p>${prods.length ? '' : '<button class="btn pri" data-go="produtos">Cadastrar produtos</button>'}</div>`;
  const tot = [...catSel].reduce((s, [, q]) => s + q, 0);
  $('#ctSum').textContent = catSel.size ? `${catSel.size} produto(s) selecionado(s) · ${tot} volume(s)` : 'Selecione um ou mais produtos e informe a quantidade de volumes.';
  $('#ctGo').disabled = !catSel.size;
}
$('#ctGrid').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.csel) { if (t.checked) { const q = +$(`[data-cqty="${t.dataset.csel}"]`).value; catSel.set(t.dataset.csel, Math.max(1, Math.round(q) || 1)); } else catSel.delete(t.dataset.csel); renderCatalog(); }
  if (t.dataset.cqty) { const q = Math.round(+t.value); if (!(q >= 1 && q <= 5000)) { toast('Quantidade deve ser de 1 a 5.000.', true); t.value = catSel.get(t.dataset.cqty) || 1; return; } catSel.set(t.dataset.cqty, q); renderCatalog(); }
});
$('#ctFilter').oninput = renderCatalog; $('#ctType').onchange = renderCatalog; $('#ctVeh').onchange = renderCatalog;
$('#ctGo').onclick = () => {
  S.cat.lines = [...catSel].map(([pid, q]) => ({ pid, q })); S.cat.veh = $('#ctVeh').value; saveWork();
  S.cat.plan = null; go('carga-catalogo'); calculate();
};

/* ---------------- CADASTRO DE PRODUTOS ---------------- */
let editId = null, fotoData = '';
const F = () => $('#fProd').elements;
function prodFormTipo() {
  const t = F().tipo.value, bob = t === 'bobina';
  $('#fl-l span').textContent = bob ? 'Diâmetro (m) *' : 'Comprimento (m) *'; $('#fl-h span').textContent = bob ? 'Largura da bobina (m) *' : 'Altura (m) *'; $('#fl-w').hidden = bob;
  $('#embList').innerHTML = NX.TIPOS[t].emb.map(e => `<option value="${esc(e)}">`).join('');
  const cur = F().pos.value; F().pos.innerHTML = NX.POS[t].map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); if (NX.POS[t].some(x => x[0] === cur)) F().pos.value = cur;
  $('#pHint').textContent = { palete: 'Palete: informe as medidas do palete montado. Pode ser de madeira, plástico ou outras dimensões.', caixa: 'Caixa: escolha as orientações permitidas (ex.: "Em pé" para "este lado para cima").', bobina: 'Bobina: deitada fica no assoalho, calçada, sem nada em cima. Em pé pode empilhar até o limite de níveis.', bigbag: 'Big Bag: nunca é deitado, precisa de 90% de apoio e só aceita outro big bag em cima.', outro: 'Outros formatos: o sistema usa a caixa envolvente (C × L × A) com as orientações escolhidas.' }[t];
  calcKg();
}
function calcKg() { const n = NX.normalize({ pcs: F().pcs.value, kgp: F().kgp.value }); F().kg.value = n.kgp >= 0 ? +n.kg.toFixed(3) : ''; }
F().tipo.innerHTML = Object.entries(NX.TIPOS).map(([k, t]) => `<option value="${k}">${t.nome}</option>`).join('');
$('#ctType').innerHTML = '<option value="">Todos os tipos</option>' + Object.entries(NX.TIPOS).map(([k, t]) => `<option value="${k}">${t.nome}</option>`).join('');
F().tipo.onchange = prodFormTipo; F().pcs.oninput = calcKg; F().kgp.oninput = calcKg;
F().stackable.onchange = () => { const no = F().stackable.value === 'nao'; F().maxLevels.disabled = no; F().stack.disabled = no; };
function setFoto(d) { fotoData = d || ''; const el = $('#pFotoPrev'); el.style.backgroundImage = d ? `url('${d}')` : ''; el.textContent = d ? '' : 'Sem foto'; }
$('#pFoto').onchange = e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return toast('Use uma imagem PNG, JPG ou WEBP.', true);
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => { const s = Math.min(1, 480 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); let d = c.toDataURL('image/jpeg', 0.82); if (d.length > 380000) d = c.toDataURL('image/jpeg', 0.6); setFoto(d); };
  img.onerror = () => toast('Não foi possível ler a imagem.', true); img.src = url;
};
$('#pFotoDel').onclick = () => setFoto('');
function resetProdForm() { editId = null; $('#fProd').reset(); setFoto(''); $('#pCancel').hidden = true; $('#pSave').textContent = 'Salvar produto'; $$('#pCats input').forEach(i => i.checked = false); if (typeof PERIG === 'object') PERIG.fill({}); $('#pErr').textContent = ''; F().maxLevels.disabled = F().stack.disabled = false; prodFormTipo(); }
$('#fProd').addEventListener('submit', async e => {
  e.preventDefault(); const o = Object.fromEntries(new FormData(e.target));
  const body = { id: editId || undefined, nome: o.nome.trim(), cod: o.cod.trim(), cat: o.cat.trim(), tipo: o.tipo, emb: o.emb.trim(), l: o.l, w: o.tipo === 'bobina' ? o.l : o.w, h: o.h, d: o.tipo === 'bobina' ? o.l : undefined,
    pcs: o.pcs, kgp: o.kgp, stackable: o.stackable !== 'nao', maxLevels: o.stackable === 'nao' ? null : (o.maxLevels || null), stack: o.stackable === 'nao' ? 0 : (o.stack === '' || o.stack === undefined ? null : o.stack), pos: o.pos, obs: o.obs, cor: o.cor, foto: fotoData, cats: prodCats(), ...PERIG.formData(o) };
  { const pe = PERIG.validate(body); if (pe) { $('#pErr').textContent = pe; return; } }
  const errs = NX.validateSpec(NX.normalize(body), false); if (errs.length) { $('#pErr').textContent = errs.join(' '); return; }
  $('#pSave').disabled = true;
  try { await DB.saveProduct(body); prods = await DB.listProducts(); toast(editId ? 'Produto atualizado.' : 'Produto cadastrado.'); resetProdForm(); renderProds(); renderCatList(); syncCatSel(); }
  catch (er) { $('#pErr').textContent = er.message; }
  finally { $('#pSave').disabled = false; }
});
$('#pCancel').onclick = resetProdForm;
function renderCatList() { $('#catList').innerHTML = [...new Set(prods.map(p => p.cat).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join(''); }
/* ---------- categorias de manuseio ---------- */
const catChips = p => (p.cats || []).map(k => NX.PCATS[k] ? `<span class="pcat" style="--c:${NX.PCATS[k].cor}" title="${esc(NX.PCATS[k].desc)}"><span aria-hidden="true">${NX.PCATS[k].ic}</span> ${NX.PCATS[k].nome}</span>` : '').join('');
$('#pCats').innerHTML = Object.entries(NX.PCATS).map(([k, c]) => `<label class="pcat-ck" style="--c:${c.cor}" title="${esc(c.desc)}"><input type="checkbox" name="pcats" value="${k}" aria-describedby="pcd-${k}"> <span aria-hidden="true">${c.ic}</span> ${c.nome}<span class="sr" id="pcd-${k}">${esc(c.desc)}</span></label>`).join('');
const prodCats = () => $$('#pCats input:checked').map(i => i.value);
function renderProds() {
  const f = $('#pFilter').value.toLowerCase();
  $('#tProd tbody').innerHTML = prods.map((p, i) => (!f || (p.nome + ' ' + p.cod).toLowerCase().includes(f)) ? `<tr><td><span class="sw" style="background:${p.cor}"></span><span class="num">${i + 1}</span></td>
   <td><div class="thumb" style="${p.foto ? `background-image:url('${p.foto}')` : ''}" role="img" aria-label="${p.foto ? 'Foto de ' + esc(p.nome) : 'Sem foto'}"></div></td>
   <td>${esc(p.nome)}${(p.cats || []).length ? '<br>' + catChips(p) : ''}${p.obs ? `<br><small class="warn">⚠ ${esc(p.obs)}</small>` : ''}</td><td>${esc(p.cod)}</td><td>${esc(p.cat || '—')}</td><td><span class="tchip ${p.tipo}">${tipoNome(p.tipo)}</span><br><small class="mut">${esc(p.emb || '')}</small></td>
   <td>${dimTxt(p)}</td><td>${p.pcs}</td><td>${fmt(p.kg, 1)} kg<br><small class="mut">${p.pcs} × ${fmt(p.kgp, 2)}</small></td><td><small>${esc(stackTxt(p))}</small></td>
   <td style="white-space:nowrap"><button class="btn sm" data-pe="${p.id}">Editar</button> <button class="btn sm" data-px="${p.id}" aria-label="Excluir ${esc(p.nome)}">×</button></td></tr>` : '').join('')
   || '<tr><td colspan="11" class="mut">Nenhum produto cadastrado.</td></tr>';
}
$('#tProd').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.px) { const p = prods.find(x => x.id === b.dataset.px); if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar exclusão'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = '×'; }, 3500); return; }
    try { await DB.deleteProduct(p.id); prods = await DB.listProducts(); catSel.delete(p.id); renderProds(); toast('Produto excluído.'); } catch (er) { toast(er.message, true); } }
  if (b.dataset.pe) { const p = prods.find(x => x.id === b.dataset.pe); editId = p.id; const f = F();
    f.tipo.value = p.tipo; prodFormTipo(); for (const k of ['nome', 'cod', 'cat', 'emb', 'l', 'w', 'h', 'pcs', 'obs', 'cor']) f[k].value = p[k] ?? ''; f.kgp.value = +(+p.kgp).toFixed(4); PERIG.fill(p);
    f.stackable.value = p.stackable === false ? 'nao' : 'sim'; f.maxLevels.value = p.maxLevels ?? ''; f.stack.value = p.stack ?? ''; f.pos.value = p.pos; $$('#pCats input').forEach(i => i.checked = (p.cats || []).includes(i.value)); f.stackable.onchange(); calcKg(); setFoto(p.foto);
    $('#pCancel').hidden = false; $('#pSave').textContent = 'Atualizar produto'; f.nome.focus(); window.scrollTo(0, 0); $('#main').scrollTop = 0; }
});
$('#pFilter').oninput = renderProds;

/* ---------------- VEÍCULOS ---------------- */
let fleetDraft = [];
const canEditFleet = () => true;
function renderAxleInfo() {
  const el = $('#axleInfo'); if (!el) return;
  el.innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>Veículo</th><th>Configuração</th><th>Eixos — limite legal (tara estimada)</th><th>PBT / PBTC</th><th>Carga útil máx.</th><th>Fonte</th></tr></thead><tbody>' +
    fleet.map(v => { const m = NX.axleModel(v); const tare = m.ax.reduce((s, a) => s + a.tare, 0);
      return `<tr><td><b>${esc(v.name)}</b></td><td>${esc(m.cfg)}</td><td>${m.ax.map(a => `${esc(a.n)}: <b>${fmt(a.lim / 1000, 2)} t</b> <span class="mut">(tara ${fmt(a.tare / 1000, 2)} t · balança ${fmt(a.lim * 1.125 / 1000, 2)} t)</span>`).join('<br>')}</td><td><b>${fmt(m.pbt / 1000, 1)} t</b>${m.pbtTec ? `<br><span class="mut">técnico ${fmt(m.pbtTec / 1000, 1)} t</span>` : ''}<br><span class="mut">balança ${fmt(m.pbt * 1.05 / 1000, 2)} t</span></td><td>${fmt(NX.vehMaxCargo(v), 0)} kg<br><span class="mut">tara total ${fmt(tare, 0)} kg</span></td><td class="mut">${esc(m.src)}</td></tr>`; }).join('') + '</tbody></table></div>';
}
function renderFleet() { renderAxleInfo();
  const ro = !canEditFleet(); $('#fleetNote').textContent = ro ? 'Somente administradores alteram a frota.' : 'Alterações valem depois de "Salvar veículos".';
  ['#fAdd', '#fReset', '#fSave'].forEach(s => $(s).disabled = ro);
  $('#tFrota tbody').innerHTML = fleetDraft.map((v, i) => `<tr>
   <td><input value="${esc(v.name)}" data-fv="${i}" data-k="name" aria-label="Nome" ${ro ? 'disabled' : ''}></td>
   <td><select data-fv="${i}" data-k="cat" aria-label="Categoria" ${ro ? 'disabled' : ''}>${NX.CATS.map(c => `<option ${c === v.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
   ${['L', 'W', 'H', 'wag'].map(k => `<td><input type="number" step="${k === 'wag' ? 1 : 0.01}" min="${k === 'wag' ? 1 : 0.5}" ${k === 'wag' ? 'max="3"' : ''} value="${v[k]}" data-fv="${i}" data-k="${k}" style="width:72px" aria-label="${k}" ${ro ? 'disabled' : ''}></td>`).join('')}
   <td><select data-fv="${i}" data-k="axcfg" aria-label="Configuração de eixos" ${ro ? 'disabled' : ''} style="max-width:230px">${NX.axOptions(v.cat).map(([k, n]) => `<option value="${k}" ${NX.axcfgOf(v) === k ? 'selected' : ''}>${esc(n)} — ${NX.axDisp(k).txt.toLowerCase()}</option>`).join('')}</select></td>
   <td>${NX.bodyOptions(v.cat).length ? `<select data-fv="${i}" data-k="body" aria-label="Carroceria" ${ro ? 'disabled' : ''}>${NX.bodyOptions(v.cat).map(b => `<option value="${b}" ${NX.bodyOf(v) === b ? 'selected' : ''}>${NX.BODIES[b]}</option>`).join('')}</select>` : `<span class="mut">${v.cat === 'Container' ? 'Container' : 'Baú'}</span>`}</td>
   <td><input type="number" min="0" placeholder="sem limite" value="${v.max ?? ''}" data-fv="${i}" data-k="max" style="width:110px" aria-label="Carga máxima" ${ro ? 'disabled' : ''}></td>
   <td>${fmt(NX.vol(v))} m³</td><td><button class="btn sm" data-fx="${i}" aria-label="Remover ${esc(v.name)}" ${ro ? 'disabled' : ''}>×</button></td></tr>`).join('');
}
$('#tFrota').addEventListener('change', e => { const t = e.target; if (t.dataset.fv == null) return; const v = fleetDraft[+t.dataset.fv], k = t.dataset.k;
  if (k === 'name' || k === 'cat' || k === 'axcfg' || k === 'body') { v[k] = t.value; if (k === 'cat') { delete v.axcfg; delete v.body; } } else if (k === 'max') v.max = t.value ? +t.value : null; else { const n = +t.value; if (!(n > 0)) { toast('Número inválido: digite só os números (ex.: 150 para 1,50 m).', true); t.value = v[k]; return; } v[k] = k === 'wag' ? Math.round(Math.min(3, n)) : n; } renderFleet(); });
$('#tFrota').addEventListener('click', e => { const b = e.target.closest('[data-fx]'); if (!b) return; if (fleetDraft.length < 2) return toast('Mantenha ao menos um veículo.', true); fleetDraft.splice(+b.dataset.fx, 1); renderFleet(); });
$('#fAdd').onclick = () => { fleetDraft.push({ id: 'v' + Date.now().toString(36), name: 'Novo veículo', cat: 'Truck', L: 7, W: 2.4, H: 2.5, wag: 1, max: null }); renderFleet(); };
$('#fReset').onclick = async () => { try { fleet = await DB.officialVehicles(); fleetDraft = JSON.parse(JSON.stringify(fleet)); renderFleet(); afterFleet(); toast('Medidas oficiais restauradas.'); } catch (er) { toast(er.message, true); } };
$('#fSave').onclick = async () => { try { fleet = await DB.saveVehicles(fleetDraft); fleetDraft = JSON.parse(JSON.stringify(fleet)); renderFleet(); afterFleet(); toast('Veículos salvos.'); } catch (er) { toast(er.message, true); } };
function afterFleet() { for (const m of ['cat', 'quick', 'route']) if (!fleet.some(v => v.id === S[m].veh)) S[m].veh = fleet[0].id; renderVehSel(); renderMarq(); }

/* ---------------- MONTAGENS SALVAS ---------------- */
let plansList = [], cmpSel = new Set();
function payload() {
  return { name: $('#cenName').value.trim(), mode, lines: mode === 'cat' ? S.cat.lines.filter(l => prods.some(p => p.id === l.pid)) : S[QM()].lines, route: mode === 'route' ? RT.snapshot() : undefined,
    vehs: plan.vehs.map(V => ({ vehicleId: V.v.id, items: V.items.map(i => ({ n: i.n, pid: i.pid, x: +i.x.toFixed(4), y: +i.y.toFixed(4), z: +i.z.toFixed(4), l: i.l, w: i.w, h: i.h, wg: i.wg, ax: i.ax })) })),
    quote: S[mode].quote, summary: summaryOf(plan) };
}
function summaryOf(pl) { const its = pl.vehs.flatMap(V => V.items); const cub = its.reduce((s, i) => s + i.l * i.w * i.h, 0); return { veh: pl.vehs[0].v.name, nVeh: pl.vehs.length, nVol: its.length, total: pl.total, left: pl.left.length, kg: its.reduce((s, i) => s + i.kg, 0), cub, occ: cub / pl.vehs.reduce((s, V) => s + NX.vol(V.v), 0), axOk: pl.vehs.every(V => { const st = NX.stats(V.v, V.items); return NX.opcoes().cabine ? st.axTol : st.axOk; }) }; }
$('#bSavePlan').onclick = async () => {
  if (!plan) return toast('Monte a carga antes: toque em “▶ Ver como a carga fica”.', true); if (!$('#cenName').value.trim()) { $('#cenName').focus(); return toast('Faltou o nome do plano de carga (ex.: Pedido 4512 – Cliente X).', true); }
  stopAnim(true); const pl = payload();
  try {
    await DB.savePlan(pl, () => { const e = []; plan.vehs.forEach((V, i) => { if (i && V.v.cat === 'Container') e.push('Containers não podem ser extras.'); const er = NX.verifyVehicle(V.v, V.items); if (er) e.push(V.v.name + ': ' + er); }); return e; });
    toast('Plano de carga salvo neste navegador. Para mandar a outra pessoa, use “Compartilhar plano”.'); $('#cenName').value = '';
  } catch (er) { toast('Não foi salvo: ' + er.message, true); }
};
async function renderPlans() {
  $('#mgNote').textContent = 'Planos de carga salvos neste navegador. Cada um é conferido pelo motor de cálculo antes de salvar.';
  try { plansList = await DB.listPlans(); } catch (er) { toast(er.message, true); plansList = []; }
  $('#tPlans tbody').innerHTML = plansList.map(p => { const s = p.summary || {}; return `<tr><td><input type="checkbox" data-cmp="${p.id}" ${cmpSel.has(p.id) ? 'checked' : ''} aria-label="Comparar ${esc(p.name)}"></td><td><b>${esc(p.name)}</b></td>
   <td><span class="mode-tag ${p.mode === 'cat' ? 'cat' : p.mode === 'route' ? 'rota' : ''}" style="font-size:10px">${{ cat: 'Catálogo', route: 'Roteirização' }[p.mode] || 'Rápida'}</span></td><td>${esc(s.veh || '')}</td><td>${p.nVeh}</td><td>${p.nVol}${s.total ? '/' + s.total : ''}</td><td>${s.kg != null ? fmt(s.kg, 0) + ' kg' : '—'}</td><td>${s.occ != null ? fmt(s.occ * 100, 0) + '%' : '—'}</td>
   <td><small>${new Date(p.criado).toLocaleString('pt-BR')}${p.user ? '<br>' + esc(p.user) : ''}</small></td><td style="white-space:nowrap"><button class="btn sm" data-open="${p.id}">Abrir</button> <button class="btn sm" data-del="${p.id}" aria-label="Excluir ${esc(p.name)}">×</button></td></tr>`; }).join('')
   || '<tr><td colspan="10" class="mut">Nenhum plano de carga salvo. Monte a carga e use a aba “Salvar”.</td></tr>';
  renderCmp();
}
function renderCmp() {
  const c = plansList.filter(p => cmpSel.has(p.id) && p.summary); const el = $('#cmpOut');
  if (!c.length) { el.innerHTML = '<p class="mut">Marque planos de carga para comparar lado a lado.</p>'; return; }
  const R = [['Origem', s => ({ cat: 'Catálogo', route: 'Roteirização' }[s.mode] || 'Rápida')], ['Veículo principal', s => esc(s.summary.veh)], ['Veículos usados', s => s.summary.nVeh], ['Volumes', s => s.summary.nVol + '/' + s.summary.total], ['Restantes', s => s.summary.left], ['Peso (kg)', s => fmt(s.summary.kg, 0)], ['Cubagem (m³)', s => fmt(s.summary.cub, 1)], ['Ocupação', s => fmt(s.summary.occ * 100, 0) + '%'], ['Eixos OK', s => s.summary.axOk ? '<span class="ok">Sim</span>' : '<span class="bad">Não</span>']];
  el.innerHTML = `<div class="card tbl-wrap"><table><tr><th></th>${c.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>${R.map(r => `<tr><td class="mut">${r[0]}</td>${c.map(s => `<td>${r[1](s)}</td>`).join('')}</tr>`).join('')}</table></div>`;
}
$('#tPlans').addEventListener('change', e => { const id = e.target.dataset.cmp; if (!id) return; e.target.checked ? cmpSel.add(id) : cmpSel.delete(id); renderCmp(); });
$('#tPlans').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.del) { if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = '×'; }, 3500); return; } try { await DB.deletePlan(b.dataset.del); cmpSel.delete(b.dataset.del); renderPlans(); toast('Plano de carga excluído.'); } catch (er) { toast(er.message, true); } }
  if (b.dataset.open) { try { openPlan(await DB.getPlan(b.dataset.open)); } catch (er) { toast(er.message, true); } }
});
function openPlan(sp) {
  const m = sp.mode === 'cat' ? 'cat' : sp.mode === 'route' ? 'route' : 'quick'; const prevMode = mode;
  if (m === 'cat') S.cat.lines = sp.lines.map(l => ({ pid: l.pid, q: l.q })); else S[m].lines = sp.lines;
  if (m === 'route' && sp.route) Object.assign(S.route, JSON.parse(JSON.stringify(sp.route)));
  S[m].veh = sp.mainVehicleId || (sp.vehs[0] && sp.vehs[0].vehicleId) || S[m].veh; S[m].quote = sp.quote || {}; saveWork();
  mode = m; if (prevMode !== m) { S[prevMode].plan = plan; S[prevMode].hist = hist; S[prevMode].redo = redo; } /* troca explícita */
  const lines = curLines(); const byId = new Map(lines.map(l => [l.id, l])); const miss = [];
  const vehs = sp.vehs.map(V => { const v = fleet.find(x => x.id === V.vehicleId); if (!v) { miss.push('veículo ' + V.vehicleId); return null; }
    const c = { L: v.L, W: v.W, H: v.H };
    const items = V.items.map(i => { const p = byId.get(i.pid); if (!p) { miss.push('produto do volume ' + i.n); return null; } const o = NX.orientations(p, 'auto').concat(NX.orientations(p)).find(q => Math.abs(q.l - i.l) < 1e-6 && Math.abs(q.w - i.w) < 1e-6 && Math.abs(q.h - i.h) < 1e-6) || {};
      return { ...i, p, c, nome: p.nome, cod: p.cod, kg: +p.kg, pcs: p.pcs, stack: NX.stackOf(p), ok: o.k || '', ax: i.ax || o.ax, load: 0, sup: [], lv: 1 }; }).filter(Boolean);
    items.sort((a, b) => a.wg - b.wg || a.x - b.x || a.z - b.z || a.y - b.y).forEach((it, k) => it.seq = k); NX.rebuildLoads(items); return { v, items }; }).filter(Boolean);
  if (!vehs.length) return toast('Não foi possível abrir: ' + miss.join(', ') + '.', true);
  plan = { vehs, left: Array.from({ length: sp.left || 0 }), total: sp.total || vehs.reduce((s, V) => s + V.items.length, 0) }; active = 0; hist = []; redo = []; sel = null;
  go(VIEW_OF[m], true); buildScene(); renderExp(); $('#cenName').value = sp.name;
  if (miss.length) toast('Aberto com pendências: ' + [...new Set(miss)].join(', ') + ' não existem mais.', true); else toast('Montagem "' + sp.name + '" aberta.');
}

/* ---------------- RELATÓRIO, COTAÇÃO, CSV ---------------- */
const LOGO = () => $('.brand img').src;
function reportHTML() {
  stopAnim(true); renderer.render(scene, camera); const img = renderer.domElement.toDataURL('image/png');
  const head = `<div style="display:flex;justify-content:space-between;align-items:center;background:#0a1122;padding:8px;border-radius:6px"><img src="${LOGO()}" style="height:40px"><span style="color:#fff">Plano de carga · ${mode === 'cat' ? 'Mostrar Catálogo' : 'Montagem Rápida'} · ${new Date().toLocaleString('pt-BR')}</span></div>`;
  const sm = summaryOf(plan);
  let h = head + `<img src="${img}" style="width:100%;margin:8px 0;border:1px solid #ccc;border-radius:6px">
  <h3>Resumo</h3><table style="width:100%;border-collapse:collapse"><tr><th>Veículo selecionado</th><th>Veículos necessários</th><th>Volumes</th><th>Restantes</th><th>Peso total</th><th>Cubagem total</th></tr>
  <tr><td>${esc(sm.veh)}</td><td>${sm.nVeh}</td><td>${sm.nVol}/${sm.total}</td><td>${sm.left}</td><td>${fmt(sm.kg, 0)} kg</td><td>${fmt(sm.cub, 2)} m³</td></tr></table>
  <h3>Ocupação por veículo</h3><table style="width:100%;border-collapse:collapse"><tr><th>Veículo</th><th>Volumes</th><th>Peso</th><th>Ocupação</th><th>Espaço restante</th><th>Compartimentos</th><th>Eixos</th></tr>
  ${plan.vehs.map((V, i) => { const s = NX.stats(V.v, V.items); return `<tr><td>${i + 1}. ${esc(V.v.name)}</td><td>${V.items.length}</td><td>${fmt(s.kg, 0)} kg</td><td>${fmt(s.occ * 100, 0)}% (${fmt(s.cub, 2)}/${fmt(s.vol, 1)} m³)</td><td>${fmt(s.free, 2)} m³</td><td>${s.wagons.map(w => `${V.v.wag > 1 ? 'C' + (w.g + 1) + ': ' : ''}${w.n} vol., livre ${fmt(w.freeLen, 2)} m`).join('<br>')}</td><td>${s.al.map(a => esc(a.n) + ': ' + fmt(a.tot / 1000, 1) + '/' + fmt(a.lim / 1000, 1) + ' t').join('<br>')}</td></tr>`; }).join('')}</table>
  <h3>Distribuição dos produtos</h3><table style="width:100%;border-collapse:collapse"><tr><th>Nº</th><th>Produto</th><th>Código</th><th>Tipo</th>${plan.vehs.map((V, i) => `<th>Veíc. ${i + 1}</th>`).join('')}<th>Peças</th><th>Peso</th></tr>
  ${curLines().map(p => { const per = plan.vehs.map(V => V.items.filter(i => i.pid === p.id).length); const n = per.reduce((a, b) => a + b, 0); return `<tr><td>${pnum(p.id)}</td><td>${esc(p.nome)}</td><td>${esc(p.cod)}</td><td>${tipoNome(p.tipo)}</td>${per.map(x => `<td>${x}</td>`).join('')}<td>${n * p.pcs}</td><td>${fmt(n * p.kg, 0)} kg</td></tr>`; }).join('')}</table>
  ${plan.left.length ? `<p style="color:#c00"><b>${plan.left.length} volume(s) não couberam.</b></p>` : ''}
  <div style="break-before:page">${$('#loadOut').innerHTML}</div>
  <h3 style="break-before:page">Identificação dos volumes</h3><table style="width:100%;border-collapse:collapse;font-size:10px"><tr><th>Volume</th><th>Produto</th><th>Código</th><th>Tipo</th><th>Ocupa C×L×A (m)</th><th>Orientação</th><th>Peso</th><th>Peças</th><th>Posição x/y/z (m)</th><th>Veículo</th></tr>
  ${plan.vehs.flatMap((V, vi) => [...V.items].sort((a, b) => a.n - b.n).map(i => `<tr><td>${vn2(i.n)}</td><td>${esc(i.nome)}</td><td>${esc(i.cod)}</td><td>${tipoNome(i.p.tipo)}</td><td>${fmt(i.l, 2)}×${fmt(i.w, 2)}×${fmt(i.h, 2)}</td><td>${esc(i.ok || '')}</td><td>${fmt(i.kg, 1)}</td><td>${i.pcs}</td><td>${fmt(i.x, 2)} / ${fmt(i.y, 2)} / ${fmt(i.z, 2)}</td><td>${vi + 1}${V.v.wag > 1 ? '.' + (i.wg + 1) : ''}</td></tr>`)).join('')}</table>`;
  return h + (mode === 'quick' ? '' : quoteBlock(false));
}
function quoteBlock(full) {
  const q = S[mode].quote || {}; const fr = (q.fretes || []).reduce((s, v) => s + (+v || 0), 0), tot = fr + (+q.pedagio || 0) + (+q.outros || 0);
  if (!full && !tot && !q.cliente) return '';
  return `<h3 ${full ? '' : 'style="break-before:page"'}>Cotação de transporte</h3><table style="width:100%;border-collapse:collapse"><tr><th>Cliente</th><td colspan="3">${esc(q.cliente || '—')}</td></tr><tr><th>Origem</th><td>${esc(q.origem || '—')}</td><th>Destino</th><td>${esc(q.destino || '—')}</td></tr></table>
  <table style="width:100%;border-collapse:collapse;margin-top:6px"><tr><th>Item</th><th>Valor</th></tr>${plan.vehs.map((V, i) => `<tr><td>Frete veículo ${i + 1} — ${esc(V.v.name)}</td><td>${q.fretes && q.fretes[i] != null && q.fretes[i] !== '' ? brl(q.fretes[i]) : '<i>não informado</i>'}</td></tr>`).join('')}
  <tr><td>Pedágio</td><td>${brl(q.pedagio)}</td></tr><tr><td>Outros custos</td><td>${brl(q.outros)}</td></tr><tr><th>Total</th><th>${brl(tot)}</th></tr></table>${q.obs ? `<p><b>Observações:</b> ${esc(q.obs)}</p>` : ''}<p style="font-size:9px;color:#555">Valores informados manualmente pelo usuário.</p>`;
}
function quoteHTML() {
  const sm = summaryOf(plan);
  return `<div style="display:flex;justify-content:space-between;align-items:center;background:#0a1122;padding:8px;border-radius:6px"><img src="${LOGO()}" style="height:40px"><span style="color:#fff">Cotação · ${new Date().toLocaleDateString('pt-BR')}</span></div>
  <h3>Carga</h3><table style="width:100%;border-collapse:collapse"><tr><th>Produto</th><th>Tipo</th><th>Medidas</th><th>Volumes</th><th>Peso</th></tr>${curLines().map(p => `<tr><td>${esc(p.nome)} (${esc(p.cod)})</td><td>${tipoNome(p.tipo)}</td><td>${dimTxt(p)}</td><td>${p.q}</td><td>${fmt(p.q * p.kg, 0)} kg</td></tr>`).join('')}</table>
  <p>Veículos necessários: <b>${sm.nVeh}</b> (${plan.vehs.map(V => esc(V.v.name)).join(', ')}) · ${sm.nVol}/${sm.total} volumes · ${fmt(sm.kg, 0)} kg · ${fmt(sm.cub, 2)} m³</p>` + quoteBlock(true);
}
window.showPrint = showPrint;
function showPrint(h) { $('#printPrev').innerHTML = h; $('#printArea').innerHTML = h; $('#mPrint').classList.add('on'); $('#bDoPrint').focus(); }
$('#bPrint').onclick = () => { if (!plan) return toast('Monte a carga antes: toque em “▶ Ver como a carga fica”.', true); showPrint(reportHTML()); };
$('#bQuotePrint').onclick = () => { if (!plan) return toast('Monte a carga antes: toque em “▶ Ver como a carga fica”.', true); showPrint(quoteHTML()); };
$('#bDoPrint').onclick = () => { try { window.print(); } catch (e) {} setTimeout(() => toast('Se a impressão não abriu, abra o NEXORA pelo arquivo index.html ou pelo npm start.'), 700); };
$('#bClosePrint').onclick = () => $('#mPrint').classList.remove('on');
function csv() {
  const L = [['Veiculo', 'Compartimento', 'Ordem_carga', 'Volume', 'Produto', 'Codigo', 'Tipo', 'Pecas', 'Peso_kg', 'Orientacao', 'X_m', 'Y_m', 'Z_m', 'C_m', 'L_m', 'A_m', 'Ordem_descarga']];
  plan.vehs.forEach((V, vi) => { const ord = [...V.items].sort((a, b) => b.wg - a.wg || (b.x + b.l) - (a.x + a.l) || b.z - a.z); V.items.forEach(it => L.push([(vi + 1) + ' - ' + V.v.name, it.wg + 1, it.seq + 1, vn2(it.n), it.nome, it.cod, tipoNome(it.p.tipo), it.pcs, fmt(it.kg, 1), it.ok || '', fmt(it.x, 2), fmt(it.y, 2), fmt(it.z, 2), fmt(it.l, 2), fmt(it.w, 2), fmt(it.h, 2), ord.indexOf(it) + 1])); });
  return '﻿' + L.map(r => r.map(c => { c = String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';')).join('\r\n');
}
$('#bCsv').onclick = () => { if (!plan) return toast('Monte a carga antes: toque em “▶ Ver como a carga fica”.', true); const c = csv();
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([c], { type: 'text/csv;charset=utf-8' })); a.download = 'nexora-montagem.csv'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
  $('#csvBox').style.display = 'block'; $('#csvBox').value = c.slice(1); $('#bCsvCopy').style.display = 'inline-block'; toast('Planilha gerada. Se o download for bloqueado, use “Copiar CSV”.'); };
$('#bCsvCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#csvBox').value); toast('CSV copiado.'); } catch (e) { $('#csvBox').select(); toast('Selecione e copie manualmente (Ctrl+C).', true); } };

/* ---------------- eventos do simulador ---------------- */
$('#selVeh').onchange = e => { S[mode].veh = e.target.value; saveWork(); renderVehSel(); renderOrder(); if (plan && curLines().length) { calculate(); toast('Veículo trocado: carga montada de novo no ' + curVeh().name + '.'); } else RT.render(); };
$('#tOrder').addEventListener('change', e => { const pid = e.target.dataset.cq; if (!pid) return; const q = Math.round(+e.target.value); const l = S.cat.lines.find(x => x.pid === pid);
  if (!(q >= 1 && q <= 5000)) { toast('Quantidade deve ser de 1 a 5.000.', true); e.target.value = l.q; return; } l.q = q; catSel.set(pid, q); saveWork(); renderOrder(); });
$('#oFilter').oninput = renderList;
$('#bCalc').onclick = calculate;
$('#itemList').addEventListener('click', e => { const d = e.target.closest('[data-it]'); if (!d) return; selectItem(plan.vehs[active].items.find(i => i.n == d.dataset.it)); });
$('#itemList').addEventListener('keydown', e => {
  const opts = $$('#itemList [role=option]'); const i = opts.indexOf(document.activeElement); if (i < 0) return;
  let n = null; if (e.key === 'ArrowDown') n = Math.min(opts.length - 1, i + 1); else if (e.key === 'ArrowUp') n = Math.max(0, i - 1); else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = opts.length - 1;
  if (n !== null) { e.preventDefault(); e.stopPropagation(); opts[i].tabIndex = -1; opts[n].tabIndex = 0; opts[n].focus(); return; }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); opts[i].click(); $('#cv').focus({ preventScroll: true }); $('#live').textContent = 'Selecionado. ' + describeItem(sel) + ' Use as setas para mover, R para girar, D para deitar, O para orientação, Esc para sair.'; }
});
$('#vehTabs').addEventListener('click', e => { const b = e.target.closest('[data-veh]'); if (b) setActive(+b.dataset.veh); });
$$('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#bDoors').onclick = () => setDoors(!doorsOpen);
$('#bWalls').onclick = () => setWalls({ trans: 'solid', solid: 'hidden', hidden: 'trans' }[wallMode]);
$('#bVoid').onclick = () => { showVoid = !showVoid; $('#bVoid').classList.toggle('on', showVoid); $('#bVoid').setAttribute('aria-pressed', showVoid); updateVoids(); };
$('#bPlay').onclick = () => { if (!plan) return calculate(); if (anim && anim.dir === 'in') { paused = !paused; updPlayBtns(); } else startAnim('in'); };
$('#bUnload').onclick = () => { if (!plan) return; if (anim && anim.dir === 'out') { paused = !paused; updPlayBtns(); } else startAnim('out'); };
$('#speed').oninput = e => $('#spv').textContent = e.target.value + '×';
$('#bOri').onclick = cycleOri; $('#bRot').onclick = rot90; $('#bLay').onclick = layDown; $('#bUndo').onclick = undo; $('#bRedo').onclick = redoAct;
$$('.tabs button').forEach(b => { b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', b.classList.contains('on')); }); $$('.tabs button').forEach(b => b.onclick = () => { $$('.tabs button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); $$('.pane').forEach(p => p.classList.toggle('on', p.id === 't-' + b.dataset.tab)); });
document.addEventListener('keydown', e => {
  if (!$('#exp').classList.contains('on') || $('.modal.on')) return; const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redoAct(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
  if (!plan) return;
  /* durante a animação as teclas de edição encerram a animação e passam a valer (antes eram ignoradas) */
  if (anim && /^(arrow(left|right|up|down)|o|r|d)$/.test(k)) stopAnim(true);
  const st = e.shiftKey ? 0.5 : 0.1;
  if (e.key === 'ArrowLeft') { e.preventDefault(); moveSel(-st, 0); } else if (e.key === 'ArrowRight') { e.preventDefault(); moveSel(st, 0); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(0, -st); } else if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(0, st); }
  else if (k === 'o') cycleOri(); else if (k === 'r') rot90(); else if (k === 'd') layDown();
  else if (e.key === 'Escape') { sel = null; renderList(); highlight(); updBtns(); }
});

/* ---------------- NAVEGAÇÃO / SITE ---------------- */
const VIEWS = ['home', 'sobre', 'contato', 'produtos', 'frota', 'catalogo', 'carga-catalogo', 'rapida', 'rota', 'montagens', 'fretes', 'transportes', 'empresas', 'forum', 'config'];
const MODE_OF = { rapida: 'quick', 'carga-catalogo': 'cat', rota: 'route' }, VIEW_OF = { quick: 'rapida', cat: 'carga-catalogo', route: 'rota' };
function go(v, keepPlan) {
  if (!VIEWS.includes(v)) v = 'home';
  const isExp = !!MODE_OF[v];
  document.body.classList.toggle('exp-on', isExp);
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v)); $('#exp').classList.toggle('on', isExp);
  $$('nav [data-go]').forEach(b => { const on = b.dataset.go === v || b.dataset.also === v; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  $('#aside').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false');
  if (location.hash !== '#' + v) try { history.replaceState(null, '', '#' + v); } catch (e) { location.hash = v; }
  if (isExp) { const m = MODE_OF[v]; if (!keepPlan) setMode(m); else if (mode !== m) mode = m; setTimeout(resize, 30); renderExp(); if (m === 'route') RT.showTab(); else if ($('#tabRota').classList.contains('on')) $('[data-tab=pedido]').click();
    if (!plan && !keepPlan) { if (curLines().length) calculate(); else if (m === 'quick') openOrder(); else if (m === 'route') RT.showTab(true); else { toast('Faltou a carga: escolha os produtos no catálogo primeiro.'); go('catalogo'); return; } } }
  if (v === 'produtos') { renderProds(); renderCatList(); }
  if (v === 'frota') { fleetDraft = JSON.parse(JSON.stringify(fleet)); renderFleet(); renderAxRef(); }
  if (v === 'catalogo') { syncCatSel(); renderVehSel(); renderCatalog(); }
  if (v === 'montagens') renderPlans();
  if (v === 'forum' && typeof FORUM === 'object') FORUM.open();
  if (v === 'empresas' && typeof EMPRESAS === 'object') EMPRESAS.open();
  if (v === 'fretes' && typeof FRETES === 'object') FRETES.open();
  if (v === 'transportes' && typeof TRANSP === 'object') TRANSP.open();
  $('#main').scrollTop = 0; revealAll();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
$('#burger').onclick = () => { const o = $('#aside').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); };
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (!h) return; const isExp = !!MODE_OF[h]; const on = isExp ? ($('#exp').classList.contains('on') && mode === MODE_OF[h]) : !!$('#v-' + h + '.on'); if (!on) go(h); });
$('#bFocus').onclick = () => { focusSel(); invalidate(); };
$('#bDesel').onclick = () => { sel = null; highlight(); renderList(); updBtns(); invalidate(); };
/* ---------- preferências (Configurações) ---------- */
const PREF0 = { navMin: false, sideMin: false, fs: '100', rm: false, fc: false, nb: true };
let prefs = { ...PREF0, ...LS.get('prefs', {}) };
function applyPrefs() {
  const B = document.body; B.classList.toggle('nav-min', !!prefs.navMin); B.classList.toggle('side-min', !!prefs.sideMin);
  for (const k of ['112', '125', '140']) B.classList.toggle('fs-' + k, prefs.fs === k);
  B.classList.toggle('rm', !!prefs.rm); B.classList.toggle('fc', !!prefs.fc);
  $('#fsMode').value = prefs.fs; $('#rmMode').checked = !!prefs.rm; $('#fcMode').checked = !!prefs.fc; $('#nbMode').checked = prefs.nb !== false;
  $('#pNavMin').checked = !!prefs.navMin; $('#pSideMin').checked = !!prefs.sideMin;
  $('#bNavMin .ic').textContent = prefs.navMin ? '»' : '«'; $('#bNavMin').setAttribute('aria-expanded', !prefs.navMin); $('#bNavMin').setAttribute('aria-label', prefs.navMin ? 'Abrir menu lateral' : 'Recolher menu lateral');
  $('#bSideMin').textContent = prefs.sideMin ? '«' : '»'; $('#bSideMin').setAttribute('aria-expanded', !prefs.sideMin); $('#bSideMin').setAttribute('aria-label', prefs.sideMin ? 'Abrir painel da expedição' : 'Recolher painel da expedição');
  window.SHOW_NUMS = prefs.nb !== false;
  setTimeout(() => { try { resize(); } catch (e) {} }, 220);
}
function setPref(k, v) { prefs[k] = v; LS.set('prefs', prefs); applyPrefs(); }
$$('nav [data-go]').forEach(b => b.title = b.textContent.trim());
$('#bNavMin').onclick = () => setPref('navMin', !prefs.navMin);
$('#bSideMin').onclick = () => setPref('sideMin', !prefs.sideMin);
$('#pNavMin').onchange = e => setPref('navMin', e.target.checked);
$('#pSideMin').onchange = e => setPref('sideMin', e.target.checked);
$('#fsMode').onchange = e => { setPref('fs', e.target.value); toast('Tamanho do texto: ' + e.target.selectedOptions[0].text); };
$('#rmMode').onchange = e => { setPref('rm', e.target.checked); if (e.target.checked) stopAnim(true); };
$('#fcMode').onchange = e => setPref('fc', e.target.checked);
$('#nbMode').onchange = e => { setPref('nb', e.target.checked); if (plan) { const s = sel; buildScene(); sel = s; renderAll(); } };
$('#bResetPrefs').onclick = () => { prefs = { ...PREF0 }; LS.set('prefs', prefs); cbMode = 'normal'; LS.set('cb', cbMode); $('#cbMode').value = 'normal'; document.body.classList.remove('hc'); applyPrefs(); if (plan) { buildScene(); renderAll(); } toast('Configurações restauradas.'); };
document.addEventListener('keydown', e => { const t = e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.ctrlKey || e.metaKey) return; if (e.key === '[') setPref('navMin', !prefs.navMin); if (e.key === ']') setPref('sideMin', !prefs.sideMin); });
applyPrefs();
$('#cbMode').value = cbMode;
$('#cbMode').onchange = e => { cbMode = e.target.value; LS.set('cb', cbMode); document.body.classList.toggle('hc', cbMode === 'hc'); renderProds(); renderOrder(); renderCatalog(); if (plan) { const s = sel; buildScene(); sel = s; renderAll(); } toast('Modo de cor: ' + e.target.selectedOptions[0].text); };
document.body.classList.toggle('hc', cbMode === 'hc');
let io;
function revealAll() {
  if (!io) io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); const c = en.target.querySelector('[data-count]'); if (c && !c.done) { c.done = 1; const n = +c.dataset.count; let i = 0; const t = setInterval(() => { c.textContent = ++i; if (i >= n) clearInterval(t); }, 70); } io.unobserve(en.target); } }), { threshold: .15 });
  $$('.reveal:not(.in),.counter').forEach(el => io.observe(el));
}
function renderHomeFleet() {
  const el = $('#homeFleet'); if (!el) return;
  const pick = ['Carreta', 'Rodotrem', 'Truck', '3/4', 'Van', 'Container']; const seen = new Set();
  el.innerHTML = fleet.filter(v => { if (!pick.includes(v.cat) || seen.has(v.cat)) return false; seen.add(v.cat); return true; }).map(v => { const m = NX.axleModel(v);
    return `<button class="h-veh reveal" data-hveh="${v.id}">${axSvg(v, NX.axcfgOf(v), 58)}<b>${esc(v.name)}</b><span>${fmt(v.L, 2)} × ${fmt(v.W, 2)} × ${fmt(v.H, 2)} m · ${fmt(NX.vol(v), 1)} m³</span><span>PBT ${fmt(m.pbt / 1000, 1)} t · carga até ${fmt(NX.vehMaxCargo(v) / 1000, 1)} t</span></button>`; }).join('');
}
$('#homeFleet').addEventListener('click', e => { const b = e.target.closest('[data-hveh]'); if (!b) return; S.quick.veh = b.dataset.hveh; saveWork(); go('rapida'); });
function renderMarq() { renderHomeFleet(); $('#marq').innerHTML = (fleet.map(v => `<span><b>${esc(v.name)}</b> · ${fmt(NX.vol(v))} m³</span>`).join('')).repeat(2); }
$('#fContato').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target.elements; const er = [];
  if (!f.nome.value.trim()) er.push('Informe seu nome.'); if (!/^\S+@\S+\.\S+$/.test(f.email.value)) er.push('Informe um e-mail válido.'); if (f.msg.value.trim().length < 5) er.push('Escreva sua mensagem.');
  $('#cErr').textContent = er.join(' '); if (er.length) return;
  try { await DB.contact({ nome: f.nome.value, email: f.email.value, emp: f.emp.value, msg: f.msg.value }); e.target.reset(); toast('Mensagem registrada no servidor. Obrigado!'); }
  catch (x) { $('#cErr').textContent = x.message; }
});

function renderUser() {}
async function loadAll() {
  try { [prods, fleet] = await Promise.all([DB.listProducts(), DB.listVehicles()]); }
  catch (er) { toast(er.message, true); return; }
  for (const m of ['cat', 'quick', 'route']) if (!fleet.some(v => v.id === S[m].veh)) S[m].veh = fleet[0].id;
  syncCatSel(); renderUser(); renderMarq(); renderVehSel(); renderProds(); renderCatList();
  go(location.hash.slice(1) || 'home');
}

/* ---------------- início ---------------- */
(async function init() {
  prodFormTipo();
  try { initThree(); } catch (e) { $('#cv').innerHTML = '<p style="padding:20px">Não foi possível iniciar o 3D neste dispositivo (WebGL indisponível).</p>'; }
  await loadAll();
})();

/* ---------- uso pela web: instalar como app e abrir sem internet ---------- */
(function () {
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const b = $('#bInstall'); if (!b) return; let ev = null;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; if (!standalone) b.hidden = false; });
  window.addEventListener('appinstalled', () => { b.hidden = true; toast('NEXORA instalado. Abra pelo ícone na tela inicial.'); });
  if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) b.hidden = false;
  b.onclick = async () => { if (ev) { ev.prompt(); await ev.userChoice; ev = null; b.hidden = true; } else toast('No iPhone/iPad: toque em Compartilhar (□↑) e depois em “Adicionar à Tela de Início”.'); };
})();

/* ---------- Home: exemplo pronto (mostra o resultado antes de pedir qualquer dado) ---------- */
(function () {
  const b = $('#hDemo'); if (!b) return;
  b.onclick = () => {
    const car = fleet.find(v => v.cat === 'Carreta' && v.L > 15) || fleet.find(v => v.cat === 'Carreta'); if (!car) return go('rapida');
    const antes = S.quick.lines.length ? { veh: S.quick.veh, lines: JSON.parse(JSON.stringify(S.quick.lines)) } : null;
    car.axcfg = car.axcfg || 'cav-truc-ls'; if (!car.body) car.body = 'sider';
    S.quick.veh = car.id;
    S.quick.lines = [{ id: 'ex1', cod: 'EX-BB', nome: 'Big bag (exemplo)', tipo: 'bigbag', l: 1.2, w: 1.1, h: 2, q: 20, pcs: 1, kgp: 1250, kg: 1250, pos: 'pe', stack: 0, maxLevels: null, cor: '#f39a2b' }];
    saveWork(); go('rapida', true); $$('.modal.on').forEach(m => m.classList.remove('on'));
    renderVehSel(); calculate();
    setTimeout(() => { $$('#mExtra.on').forEach(m => m.classList.remove('on')); toast('Exemplo: 20 big bags de 1.250 kg numa carreta LS — juntos da cabine ao fundo, eixos conferidos. Troque a carga para fazer a sua.');
      if (antes) { const box = $('#bCalc'); if (box && !$('#bDemoUndo')) { box.insertAdjacentHTML('beforebegin', '<button type="button" class="btn sm" id="bDemoUndo" style="width:100%;margin-bottom:8px">↩ Voltar para a minha carga</button>'); $('#bDemoUndo').onclick = () => { S.quick.veh = antes.veh; S.quick.lines = antes.lines; saveWork(); renderVehSel(); calculate(); toast('Sua carga voltou.'); }; } } }, 600);
  };
})();
