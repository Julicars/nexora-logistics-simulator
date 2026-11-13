/* NEXORA — Calços e amarração: sugere onde usar barra de travamento, calço e cinta, a partir dos
 * espaços vazios e do tipo de carga, e desenha as sugestões no 3D.
 * Base: Resolução CONTRAN 945/2022 (amarração de cargas: cintas, correntes ou cabos com capacidade
 * de, no mínimo, 2× o peso da carga; cordas proibidas para amarrar carga; dispositivos adicionais como
 * barras de contenção, calços, mantas de atrito e bloqueadores) e Res. CONTRAN 701/2017 (siderúrgicos).
 * É uma sugestão de apoio: a amarração final é responsabilidade de quem carrega e do motorista.
 */
const SEC = (function () {
  'use strict';
  const q = s => document.querySelector(s);
  const GAP = 0.05;          /* folga mínima considerada (m) */
  const LC = 2000;           /* capacidade de trabalho de referência de uma cinta com catraca (daN ≈ kgf) */
  let show = false, group = null;
  const bodyOf = v => v.cat === 'Container' ? 'bau' : NX.bodyOf(v);
  const isCat = (it, k) => (it.p.cats || []).includes(k);

  function analyze(V) {
    const v = V.v, out = [], body = bodyOf(v), H = NX.effH(v);
    for (let g = 0; g < v.wag; g++) {
      const its = V.items.filter(i => i.wg === g); if (!its.length) continue;
      const tag = v.wag > 1 ? ` (compartimento ${g + 1})` : '';
      /* fileiras ao longo do comprimento */
      const rows = []; for (const it of [...its].sort((a, b) => a.x - b.x)) { let r = rows.find(r => it.x < r.x1 - GAP && it.x + it.l > r.x0 + GAP); if (!r) rows.push(r = { x0: it.x, x1: it.x + it.l, its: [] }); r.x0 = Math.min(r.x0, it.x); r.x1 = Math.max(r.x1, it.x + it.l); r.its.push(it); }
      rows.sort((a, b) => a.x0 - b.x0);
      /* frente */
      if (rows[0].x0 > GAP) out.push({ tipo: 'calco', g, x: 0, l: rows[0].x0, y: 0, w: v.W, z: 0, h: Math.min(1, H), txt: `Espaço de ${fmt(rows[0].x0, 2)} m junto à cabine${tag}: preencha com calço ou espaçador para a carga não avançar na frenagem.` });
      /* entre fileiras */
      for (let i = 1; i < rows.length; i++) { const gp = rows[i].x0 - rows[i - 1].x1; if (gp > GAP) out.push({ tipo: gp > 0.4 ? 'barra' : 'calco', g, x: rows[i - 1].x1, l: gp, y: 0, w: v.W, z: 0, h: Math.min(1.2, H), txt: `Vão de ${fmt(gp, 2)} m entre a fileira ${i} e a ${i + 1}${tag}: ${gp > 0.4 ? 'barra de contenção ou bloqueador' : 'calço de madeira ou travesseiro de ar (airbag)'}.` }); }
      /* traseira (portas) */
      const end = rows[rows.length - 1].x1, rear = v.L - end;
      if (rear > GAP && body !== 'aberta') out.push({ tipo: 'barra', g, x: end, l: Math.min(0.08, rear), y: 0, w: v.W, z: 0, h: Math.min(1.6, H), txt: `Sobram ${fmt(rear, 2)} m até as portas${tag}: barra de travamento logo atrás da última fileira, para a carga não correr para trás.` });
      /* laterais, por fileira */
      rows.forEach((r, i) => {
        const y0 = Math.min(...r.its.map(it => it.y)), y1 = Math.max(...r.its.map(it => it.y + it.w)), gl = y0, gr = v.W - y1, gt = gl + gr;
        if (gt > GAP) {
          const big = gt >= 0.6, side = gl > gr ? 'esquerdo' : 'direito', yy = gl > gr ? 0 : y1, ww = gl > gr ? gl : gr;
          out.push({ tipo: big ? 'barra' : 'calco', g, x: r.x0, l: r.x1 - r.x0, y: yy, w: Math.max(ww, 0.04), z: 0, h: Math.min(1, H), txt: `Fileira ${i + 1}${tag}: folga lateral de ${fmt(gt, 2)} m (mais do lado ${side}). ${big ? 'Bloqueio lateral ou barra de contenção.' : 'Calço lateral ou airbag para a carga não deslizar nas curvas.'}` });
        }
        /* cintas: carroceria aberta e sider sempre; baú quando a pilha é alta e estreita */
        const kg = r.its.reduce((a, it) => a + it.kg, 0), tall = r.its.some(it => it.h > 1.6 * Math.min(it.l, it.w) || it.lv >= 3);
        const need = body === 'aberta' || body === 'sider' || tall || r.its.some(it => isCat(it, 'pesado') || it.p.tipo === 'bobina');
        if (need) {
          const n = Math.max(2, Math.ceil(2 * kg / LC));
          const why = body === 'aberta' ? 'carroceria aberta' : body === 'sider' ? 'sider (a lona não segura carga)' : r.its.some(it => it.p.tipo === 'bobina') ? 'bobina' : tall ? 'pilha alta e estreita' : 'carga pesada';
          const hh = Math.max(...r.its.map(it => it.z + it.h));
          out.push({ tipo: 'cinta', g, x: r.x0, l: r.x1 - r.x0, y: y0, w: y1 - y0, z: hh, h: 0.03, n, kg, txt: `Fileira ${i + 1}${tag} (${why}): ${n} cinta(s) com catraca. A soma da capacidade precisa ser de pelo menos 2× o peso da fileira (${fmt(kg, 0)} kg → ${fmt(2 * kg, 0)} daN; ex.: ${n} × ${fmt(LC, 0)} daN). Nunca use corda para amarrar carga.` });
        }
      });
      /* tipos especiais */
      for (const it of its) {
        if (it.p.tipo === 'bobina') out.push({ tipo: 'calco', g, x: it.x - 0.05, l: 0.05, y: it.y, w: it.w, z: 0, h: 0.15, txt: `Volume ${String(it.n).padStart(2, '0')} (bobina): berço ou calços de madeira dos dois lados e amarração de topo e direta (Res. CONTRAN 701/2017).` });
        else if (isCat(it, 'fragil') && it.z < 0.01) { /* frágil: nada em cima, só protetores */ }
      }
    }
    /* uma linha por produto frágil */
    const fr = [...new Set(V.items.filter(it => isCat(it, 'fragil')).map(it => it.nome))];
    if (fr.length) out.push({ tipo: 'protetor', txt: `Frágil (${fr.join(', ')}): cantoneiras ou protetores sob as cintas e manta de atrito no piso.` });
    if (body === 'bau' && !out.some(o => o.tipo === 'cinta')) out.push({ tipo: 'info', txt: 'Baú: a parede segura a carga lateralmente; use barras e calços onde houver folga. Para cargas soltas ou altas, use cintas internas.' });
    return out;
  }

  const ICON = { barra: '🟥', calco: '🟨', cinta: '🟦', protetor: '🟩', info: 'ℹ️' };
  const NOME = { barra: 'Barra de travamento', calco: 'Calço', cinta: 'Cintas', protetor: 'Proteção', info: 'Observação' };
  function render() {
    const el = q('#secOut'); if (!el) return;
    if (!plan) { el.innerHTML = ''; return; }
    el.innerHTML = `<h3 style="margin:14px 0 4px">Calços e amarração</h3><p class="mut" style="font-size:12px;margin:0 0 6px">Sugestões a partir dos espaços vazios e do tipo de carga. Base: Res. CONTRAN 945/2022 — cintas, correntes ou cabos com capacidade de no mínimo 2× o peso da carga; cordas são proibidas para amarrar carga. Confira sempre no carregamento.</p>`
      + plan.vehs.map((V, vi) => { const a = analyze(V); const cint = a.filter(o => o.tipo === 'cinta').reduce((s, o) => s + o.n, 0), bar = a.filter(o => o.tipo === 'barra').length, cal = a.filter(o => o.tipo === 'calco').length;
        return `<div class="secv"><b>Veículo ${vi + 1}: ${esc(V.v.name)}</b> <small class="mut">${esc(NX.BODIES[bodyOf(V.v)] || 'Baú')}</small><p class="secsum">${cint ? `🟦 ${cint} cinta(s)` : ''} ${bar ? `🟥 ${bar} barra(s)/bloqueio(s)` : ''} ${cal ? `🟨 ${cal} ponto(s) de calço` : ''}${!cint && !bar && !cal ? '✔ Carga justa, sem folgas relevantes.' : ''}</p><ul class="seclist">${a.map(o => `<li><span aria-hidden="true">${ICON[o.tipo]}</span> <b>${NOME[o.tipo]}:</b> ${esc(o.txt)}</li>`).join('')}</ul></div>`; }).join('');
  }
  /* desenho no 3D */
  const COL = { barra: 0xff4d4d, calco: 0xf5c518, cinta: 0x2f8cf2 };
  function draw() {
    if (typeof scene === 'undefined') return;
    if (group) { scene.remove(group); group = null; }
    if (show && plan) {
      group = new THREE.Group();
      plan.vehs.forEach((V, vi) => { if (!vehGroups[vi]) return; const F = floorOf(V.v);
        for (const o of analyze(V)) { if (!COL[o.tipo] || o.l == null) continue;
          const m = new THREE.MeshBasicMaterial({ color: COL[o.tipo], transparent: true, opacity: o.tipo === 'calco' ? 0.55 : 0.8, depthWrite: false });
          const z0 = vehGroups[vi].position.z - V.v.W / 2;
          if (o.tipo === 'cinta') { /* laço transversal: cima + dois lados, um por cinta distribuído na fileira */
            for (let k = 0; k < o.n; k++) { const xx = wagonX(V.v, o.g) + o.x + o.l * (k + 0.5) / o.n;
              const top = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, o.w + 0.04), m); top.position.set(xx, F + o.z + 0.01, z0 + o.y + o.w / 2); group.add(top);
              for (const s of [0, 1]) { const sd = new THREE.Mesh(new THREE.BoxGeometry(0.05, o.z, 0.02), m); sd.position.set(xx, F + o.z / 2, z0 + o.y + (s ? o.w + 0.02 : -0.02)); group.add(sd); } }
          } else { const b = new THREE.Mesh(new THREE.BoxGeometry(Math.max(o.l, 0.04), o.h, Math.max(o.w, 0.04)), m); b.position.set(wagonX(V.v, o.g) + o.x + Math.max(o.l, 0.04) / 2, F + o.h / 2, z0 + o.y + Math.max(o.w, 0.04) / 2); group.add(b); }
        } });
      scene.add(group);
    }
    if (typeof invalidate === 'function') invalidate();
  }
  const btn = q('#bSec');
  if (btn) btn.onclick = () => { show = !show; btn.classList.toggle('on', show); btn.setAttribute('aria-pressed', show); draw(); if (show) toast('Amarração no 3D: vermelho = barra, amarelo = calço, azul = cinta.'); };
  return { analyze, render, draw, refresh() { render(); if (show) draw(); } };
})();
