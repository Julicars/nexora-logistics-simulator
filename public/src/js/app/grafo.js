/* NEXORA — Diagrama de vínculos interativo (SVG puro, sem bibliotecas).
 * Arrastar o fundo move a vista · roda do mouse / pinça aproxima · arrastar um nó muda a posição dele
 * Toque num nó: detalhes e ações · duplo clique: expandir os vínculos dele · teclado: setas, + / −, 0, Esc.
 */
const GRAFO = (function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const ehEmp = n => n.tipo === 'empresa' || n.tipo === 'PJ';
  const cor = n => ehEmp(n) && n.cnpj ? (/ATIVA/i.test(n.situacao || '') ? '#4ade80' : n.situacao ? '#f87171' : '#94a3b8') : n.tipo === 'EST' ? '#c084fc' : '#7aa2ff';
  const tam = n => ehEmp(n) ? { w: n.raiz ? 220 : 176, h: n.raiz ? 48 : 40 } : { w: 150, h: 64 };

  function montar(box, g, op = {}) {
    const E = window.NX_EMP;
    const N = new Map(), A = []; let sel = null, foco = null, k = 1, tx = 0, ty = 0;
    box.innerHTML = `<div class="gwrap" tabindex="-1">
      <div class="gbar" role="toolbar" aria-label="Controles do diagrama">
        <button type="button" class="btn sm" data-g="mais" aria-label="Aproximar">＋</button><button type="button" class="btn sm" data-g="menos" aria-label="Afastar">－</button>
        <button type="button" class="btn sm" data-g="fit">⤢ Ajustar</button><button type="button" class="btn sm" data-g="org">✳ Organizar</button>
        <button type="button" class="btn sm" data-g="full" aria-pressed="false">⛶ Tela cheia</button>
        <label class="gbusca"><span class="sr">Procurar no diagrama</span><input type="search" placeholder="Procurar no diagrama…" data-g="busca"></label>
        <span class="gcont mut" aria-live="polite"></span>
      </div>
      <div class="gtela"><svg class="gsvg" xmlns="${NS}" role="application" aria-roledescription="diagrama interativo" aria-label="Diagrama de vínculos. Arraste para mover, use a roda ou os botões para aproximar. Tab passa pelos nós; Enter mostra detalhes." tabindex="0">
        <defs><marker id="gSeta" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#4c6aa8"/></marker></defs>
        <g class="gvp"><g class="garestas"></g><g class="gnos"></g></g></svg>
        <p class="gdica">Arraste o fundo para mover · roda/pinça para zoom · arraste um nó para reposicionar · duplo clique para expandir</p>
      </div>
      <div class="gpainel" aria-live="polite"></div></div>`;
    const W = box.querySelector('.gwrap'), svg = box.querySelector('.gsvg'), vp = box.querySelector('.gvp'), gA = box.querySelector('.garestas'), gN = box.querySelector('.gnos'), painel = box.querySelector('.gpainel');

    /* ---------- dados ---------- */
    function juntar(g2, perto) {
      const novos = [];
      for (const n of g2.nodes || []) {
        if (N.has(n.id)) { Object.assign(N.get(n.id), Object.fromEntries(Object.entries(n).filter(([kk, v]) => v != null && kk !== 'raiz' && kk !== 'x' && kk !== 'y'))); continue; }
        const x = { ...n, raiz: N.size === 0 ? true : false }; if (n.raiz && !N.size) x.raiz = true;
        if (perto) { const a = Math.random() * Math.PI * 2, r = 180 + Math.random() * 120; x.x = perto.x + r * Math.cos(a); x.y = perto.y + r * Math.sin(a); }
        N.set(n.id, x); novos.push(x);
      }
      for (const e of g2.edges || []) if (N.has(e.de) && N.has(e.para) && !A.some(a => a.de === e.de && a.para === e.para)) A.push({ ...e });
      return novos;
    }
    /* posição inicial radial: raiz no centro, sócios em volta, empresas ligadas por fora */
    function radial() {
      const nos = [...N.values()], raiz = nos.find(n => n.raiz) || nos[0]; raiz.x = 0; raiz.y = 0; raiz.fixo = true;
      const viz = id => A.filter(e => e.de === id || e.para === id).map(e => N.get(e.de === id ? e.para : e.de));
      const nivel1 = viz(raiz.id), r1 = Math.max(260, 120 + nivel1.length * 26);
      nivel1.forEach((n, i) => { n.a = (nivel1.length <= 2 ? 0 : -Math.PI / 2) + i * 2 * Math.PI / Math.max(1, nivel1.length); n.x = r1 * Math.cos(n.a); n.y = r1 * Math.sin(n.a); });
      const resto = nos.filter(n => n.x == null), grupos = new Map();
      for (const n of resto) { const p = viz(n.id).find(v => v.a != null); const key = p ? p.id : '_'; (grupos.get(key) || grupos.set(key, []).get(key)).push(n); }
      for (const [key, lst] of grupos) { const p = N.get(key), a0 = p ? p.a : 0, sp = Math.min(Math.PI * 2 / Math.max(1, nivel1.length) * 0.9, 0.3 * lst.length);
        lst.forEach((n, i) => { const a = a0 + (lst.length > 1 ? -sp / 2 + sp * i / (lst.length - 1) : 0), r = r1 + 230 + (i % 2) * 90; n.x = r * Math.cos(a); n.y = r * Math.sin(a); n.a = a; }); }
    }
    /* relaxa as posições: repulsão entre nós + molas nas ligações (evita sobreposição) */
    function relaxar(iter = 160) {
      const nos = [...N.values()];
      for (let it = 0; it < iter; it++) {
        const t = 1 - it / iter, F = new Map(nos.map(n => [n, { x: 0, y: 0 }]));
        for (let i = 0; i < nos.length; i++) for (let j = i + 1; j < nos.length; j++) {
          const a = nos[i], b = nos[j]; let dx = b.x - a.x, dy = b.y - a.y; let d2 = dx * dx + dy * dy; if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const d = Math.sqrt(d2), ta = tam(a), tb = tam(b), min = (ta.w + tb.w) / 2 + 24, f = d < min ? (min - d) * 0.5 : 9000 / d2;
          F.get(a).x -= dx / d * f; F.get(a).y -= dy / d * f; F.get(b).x += dx / d * f; F.get(b).y += dy / d * f;
        }
        for (const e of A) { const a = N.get(e.de), b = N.get(e.para), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 230) * 0.04; F.get(a).x += dx / d * f; F.get(a).y += dy / d * f; F.get(b).x -= dx / d * f; F.get(b).y -= dy / d * f; }
        for (const n of nos) { if (n.fixo) continue; const f = F.get(n), m = 40 * t + 2; n.x += Math.max(-m, Math.min(m, f.x - n.x * 0.002)); n.y += Math.max(-m, Math.min(m, f.y - n.y * 0.002)); }
      }
    }

    /* ---------- desenho ---------- */
    const el = (t, at, pai) => { const e = document.createElementNS(NS, t); for (const kk in at) e.setAttribute(kk, at[kk]); if (pai) pai.appendChild(e); return e; };
    function dica(n) { return [n.razao || n.label, n.cnpj ? E.fmtCnpj(n.cnpj) : null, n.situacao, n.uf ? (n.municipio ? n.municipio + '/' : '') + n.uf : null, n.qualificacao, n.faixaEtaria].filter(Boolean).join(' · '); }
    function desenhar() {
      gA.textContent = ''; gN.textContent = '';
      for (const e of A) { e.el = el('line', { stroke: '#3b5287', 'stroke-width': 1.5, 'marker-end': 'url(#gSeta)' }, gA); el('title', {}, e.el).textContent = `${(N.get(e.de) || {}).label} → ${(N.get(e.para) || {}).label}: ${e.rotulo || ''}`; }
      for (const n of N.values()) {
        const t = tam(n), g = el('g', { class: 'gno' + (n.raiz ? ' raiz' : ''), tabindex: 0, role: 'button', 'aria-label': dica(n) + '. Enter para detalhes.' }, gN); g.dataset.id = n.id; n.el = g;
        el('title', {}, g).textContent = dica(n);
        if (ehEmp(n)) {
          el('rect', { x: -t.w / 2, y: -t.h / 2, width: t.w, height: t.h, rx: n.tipo === 'PJ' && !n.cnpj ? 3 : 10, fill: n.raiz ? '#2a1d06' : '#0f1d3d', stroke: n.raiz ? '#f7a334' : cor(n), 'stroke-width': n.raiz ? 3 : 2 }, g);
          el('text', { y: n.cnpj ? -3 : 4, 'text-anchor': 'middle', class: 'gt' }, g).textContent = cut(n.label, n.raiz ? 28 : 22);
          if (n.cnpj) el('text', { y: 13, 'text-anchor': 'middle', class: 'gr' }, g).textContent = E.fmtCnpj(n.cnpj) + (n.uf ? ' · ' + n.uf : '');
          if (n.expandido) el('circle', { cx: t.w / 2 - 6, cy: -t.h / 2 + 6, r: 4, fill: '#f7a334' }, g);
        } else {
          el('circle', { r: 19, fill: '#13254d', stroke: cor(n), 'stroke-width': 2 }, g); el('circle', { cy: -6, r: 5.5, fill: cor(n) }, g); el('path', { d: 'M-10 11 q10 -13 20 0', fill: cor(n) }, g);
          el('text', { y: 34, 'text-anchor': 'middle', class: 'gt' }, g).textContent = cut(n.label, 24);
          if (n.qualificacao) el('text', { y: 47, 'text-anchor': 'middle', class: 'gr' }, g).textContent = cut(n.qualificacao, 28);
          if (n.expandido) el('circle', { cx: 15, cy: -15, r: 4, fill: '#f7a334' }, g);
        }
      }
      posicionar(); destacar(); contar();
    }
    function borda(a, b) { /* ponto na borda do nó b, na direção de a (para a seta não ficar escondida) */
      const t = tam(b), dx = a.x - b.x, dy = a.y - b.y; if (!dx && !dy) return { x: b.x, y: b.y };
      if (!ehEmp(b)) { const d = Math.hypot(dx, dy); return { x: b.x + dx / d * 22, y: b.y + dy / d * 22 }; }
      const s = Math.min(Math.abs((t.w / 2) / (dx || 1e-9)), Math.abs((t.h / 2) / (dy || 1e-9))); return { x: b.x + dx * s, y: b.y + dy * s };
    }
    function posicionar() {
      for (const n of N.values()) n.el && n.el.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`);
      for (const e of A) { const a = N.get(e.de), b = N.get(e.para); if (!e.el) continue; const p = borda(a, b); e.el.setAttribute('x1', a.x); e.el.setAttribute('y1', a.y); e.el.setAttribute('x2', p.x); e.el.setAttribute('y2', p.y); }
    }
    const aplicar = () => vp.setAttribute('transform', `translate(${tx},${ty}) scale(${k})`);
    function caixa() { const nos = [...N.values()]; if (!nos.length) return { x: 0, y: 0, w: 1, h: 1 }; const xs = nos.map(n => [n.x - tam(n).w / 2, n.x + tam(n).w / 2]), ys = nos.map(n => [n.y - tam(n).h / 2, n.y + tam(n).h / 2 + 16]);
      const x0 = Math.min(...xs.map(v => v[0])), x1 = Math.max(...xs.map(v => v[1])), y0 = Math.min(...ys.map(v => v[0])), y1 = Math.max(...ys.map(v => v[1])); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    function ajustar() { const r = svg.getBoundingClientRect(), b = caixa(); k = Math.max(0.15, Math.min(1.6, Math.min(r.width / (b.w + 60), r.height / (b.h + 60)))); tx = r.width / 2 - (b.x + b.w / 2) * k; ty = r.height / 2 - (b.y + b.h / 2) * k; aplicar(); }
    function zoom(f, cx, cy) { const r = svg.getBoundingClientRect(); if (cx == null) { cx = r.width / 2; cy = r.height / 2; } const nk = Math.max(0.15, Math.min(4, k * f)); tx = cx - (cx - tx) * nk / k; ty = cy - (cy - ty) * nk / k; k = nk; aplicar(); }
    function contar() { const nos = [...N.values()], emp = nos.filter(n => ehEmp(n)).length; box.querySelector('.gcont').textContent = `${emp} empresa(s) · ${nos.length - emp} pessoa(s) · ${A.length} ligação(ões)`; }
    const vizinhos = id => new Set([id, ...A.filter(e => e.de === id || e.para === id).map(e => e.de === id ? e.para : e.de)]);
    function destacar() {
      const termo = E.normNome(box.querySelector('[data-g=busca]').value), alvo = foco || sel, V = alvo ? vizinhos(alvo) : null;
      for (const n of N.values()) { if (!n.el) continue; const achou = termo && (E.normNome(n.label + ' ' + (n.razao || '')).includes(termo) || (n.cnpj || '').includes(termo.replace(/\D/g, '') || '§'));
        n.el.classList.toggle('apaga', !!(V && !V.has(n.id)) || !!(termo && !achou)); n.el.classList.toggle('sel', n.id === sel); n.el.classList.toggle('achou', !!achou); }
      for (const e of A) e.el && e.el.classList.toggle('apaga', !!(V && !(e.de === alvo || e.para === alvo)));
    }

    /* ---------- painel do nó selecionado ---------- */
    function mostrar(id) {
      sel = id; destacar(); const n = N.get(id); if (!n) { painel.innerHTML = ''; return; }
      const lig = A.filter(e => e.de === id || e.para === id).map(e => { const o = N.get(e.de === id ? e.para : e.de); return `<li><button type="button" class="lnk" data-gfoco="${esc(o.id)}">${esc(o.label)}</button> <small class="mut">${esc(e.rotulo || '')}</small></li>`; });
      const pode = ehEmp(n) ? !!n.cnpj : /^\*{3}\d{6}\*{2}$/.test(String(n.doc || '').replace(/[^0-9*]/g, ''));
      painel.innerHTML = `<div class="gdet"><div><b>${ehEmp(n) ? '🏢' : '👤'} ${esc(n.razao || n.label)}</b><br><small class="mut">${esc(dica(n))}</small></div>
        <div class="gdet-b">${n.cnpj && op.abrirEmpresa ? `<button type="button" class="btn sm pri" data-gacao="abrir">Consultar empresa</button>` : ''}
        ${pode && op.expandir && !n.expandido ? `<button type="button" class="btn sm" data-gacao="exp">➕ Expandir vínculos</button>` : ''}
        ${!ehEmp(n) && op.abrirPessoa ? `<button type="button" class="btn sm" data-gacao="pes">👤 Ver empresas desta pessoa</button>` : ''}
        <button type="button" class="btn sm" data-gacao="fix" aria-pressed="${!!n.fixo}">${n.fixo ? '📌 Solto' : '📌 Fixar aqui'}</button><button type="button" class="btn sm" data-gacao="limpa">✕</button></div>
        ${lig.length ? `<details><summary>${lig.length} ligação(ões)</summary><ul class="glig">${lig.join('')}</ul></details>` : ''}</div>`;
      /* pessoa: ao tocar, já busca as empresas dela e traz para o diagrama */
      if (!ehEmp(n) && pode && op.expandir && op.autoPessoa !== false && !n.expandido && !n._buscando) { n._buscando = true; expandir(n); }
    }
    painel.addEventListener('click', async ev => {
      const f = ev.target.closest('[data-gfoco]'); if (f) { centralizar(f.dataset.gfoco); mostrar(f.dataset.gfoco); return; }
      const b = ev.target.closest('[data-gacao]'); if (!b) return; const n = N.get(sel); if (!n) return;
      if (b.dataset.gacao === 'abrir') op.abrirEmpresa(n.cnpj);
      else if (b.dataset.gacao === 'pes') op.abrirPessoa(n);
      else if (b.dataset.gacao === 'fix') { n.fixo = !n.fixo; mostrar(sel); }
      else if (b.dataset.gacao === 'limpa') { sel = null; painel.innerHTML = ''; destacar(); }
      else if (b.dataset.gacao === 'exp') expandir(n);
    });
    async function expandir(n) {
      if (!op.expandir || n.expandido) return; const bx = painel.querySelector('[data-gacao=exp]'); if (bx) { bx.textContent = '⏳ Buscando as empresas…'; bx.disabled = true; }
      try { const g2 = await op.expandir(n); n.expandido = true; const novos = juntar(g2, n); const antes = new Map([...N.values()].map(x => [x, x.fixo])); [...N.values()].forEach(x => { if (!novos.includes(x)) x.fixo = true; }); relaxar(90); antes.forEach((v, x) => { x.fixo = v; }); novos.forEach(x => { x.fixo = false; });
        desenhar(); if (novos.length) ajustar(); mostrar(n.id); if (op.mudou) op.mudou(dados()); toast && toast(novos.length ? `${novos.length} novo(s) vínculo(s) no diagrama.` : 'Nenhum vínculo novo encontrado.'); }
      catch (e) { n._buscando = false; const b2 = painel.querySelector('[data-gacao=exp]'); if (b2) { b2.textContent = '➕ Tentar de novo'; b2.disabled = false; } painel.insertAdjacentHTML('beforeend', `<p class="bad" role="alert">${esc(e.message)}</p>`); }
    }
    function centralizar(id) { const n = N.get(id), r = svg.getBoundingClientRect(); if (!n) return; tx = r.width / 2 - n.x * k; ty = r.height / 2 - n.y * k; aplicar(); n.el && n.el.focus({ preventScroll: true }); }

    /* ---------- ponteiro: arrastar, pinça, roda ---------- */
    const P = new Map(); let modo = null, alvoNo = null, ini = null, mov = false, pinca = null, ultClique = { id: null, t: 0 };
    const local = ev => { const r = svg.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    svg.addEventListener('pointerdown', ev => {
      if (ev.button > 0) return; svg.setPointerCapture(ev.pointerId); P.set(ev.pointerId, local(ev));
      if (P.size === 2) { const [a, b] = [...P.values()]; pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), k }; modo = 'pinca'; return; }
      const g = ev.target.closest('.gno'); ini = local(ev); mov = false;
      if (g) { modo = 'no'; alvoNo = N.get(g.dataset.id); alvoNo._ox = alvoNo.x; alvoNo._oy = alvoNo.y; } else { modo = 'pan'; ini.tx = tx; ini.ty = ty; }
    });
    svg.addEventListener('pointermove', ev => {
      if (!P.has(ev.pointerId)) { const g = ev.target.closest('.gno'); const id = g ? g.dataset.id : null; if (id !== foco && !sel) { foco = id; destacar(); } return; }
      const p = local(ev); P.set(ev.pointerId, p);
      if (modo === 'pinca' && P.size === 2) { const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y); zoom(pinca.k * d / pinca.d / k, (a.x + b.x) / 2, (a.y + b.y) / 2); return; }
      if (!ini) return; const dx = p.x - ini.x, dy = p.y - ini.y; if (!mov && Math.hypot(dx, dy) < 4) return; mov = true; svg.classList.add('arrasta');
      if (modo === 'pan') { tx = ini.tx + dx; ty = ini.ty + dy; aplicar(); }
      else if (modo === 'no' && alvoNo) { alvoNo.x = alvoNo._ox + dx / k; alvoNo.y = alvoNo._oy + dy / k; alvoNo.fixo = true; posicionar(); }
    });
    const solta = ev => {
      P.delete(ev.pointerId); svg.classList.remove('arrasta'); if (P.size) return;
      if (modo === 'no' && alvoNo && !mov) { const agora = Date.now(); if (ultClique.id === alvoNo.id && agora - ultClique.t < 350) expandir(alvoNo); else mostrar(alvoNo.id); ultClique = { id: alvoNo.id, t: agora }; }
      if (modo === 'pan' && !mov && sel) { sel = null; painel.innerHTML = ''; destacar(); }
      modo = null; alvoNo = null; ini = null; pinca = null;
    };
    svg.addEventListener('pointerup', solta); svg.addEventListener('pointercancel', solta);
    svg.addEventListener('pointerleave', () => { if (!P.size && foco) { foco = null; destacar(); } });
    svg.addEventListener('wheel', ev => { ev.preventDefault(); const p = local(ev); zoom(Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.0015)), p.x, p.y); }, { passive: false });

    /* ---------- teclado ---------- */
    svg.addEventListener('keydown', ev => {
      const g = ev.target.closest && ev.target.closest('.gno');
      if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); mostrar(g.dataset.id); return; }
      const passo = 60, m = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] }[ev.key];
      if (m) { ev.preventDefault(); if (g && ev.shiftKey) { const n = N.get(g.dataset.id); n.x -= m[0] / k; n.y -= m[1] / k; n.fixo = true; posicionar(); } else { tx += m[0]; ty += m[1]; aplicar(); } return; }
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); zoom(1.25); } else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); zoom(0.8); } else if (ev.key === '0') { ev.preventDefault(); ajustar(); }
      else if (ev.key === 'Escape') { if (W.classList.contains('gfull')) tela(false); else { sel = null; painel.innerHTML = ''; destacar(); } }
    });
    svg.addEventListener('focusin', ev => { const g = ev.target.closest('.gno'); if (g) { foco = g.dataset.id; destacar(); } });
    svg.addEventListener('focusout', () => { foco = null; destacar(); });

    /* ---------- barra ---------- */
    function tela(on) {
      W.classList.toggle('gfull', on); document.documentElement.classList.toggle('gtrava', on);
      const b = box.querySelector('[data-g=full]'); b.setAttribute('aria-pressed', on); b.textContent = on ? '✕ Sair da tela cheia' : '⛶ Tela cheia';
      try { if (on && W.requestFullscreen) W.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* prévia bloqueia: fica o modo em sobreposição */ }
      setTimeout(ajustar, 80);
    }
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && W.classList.contains('gfull')) tela(false); });
    box.querySelector('.gbar').addEventListener('click', ev => { const b = ev.target.closest('button[data-g]'); if (!b) return; const a = b.dataset.g;
      if (a === 'mais') zoom(1.25); else if (a === 'menos') zoom(0.8); else if (a === 'fit') ajustar(); else if (a === 'full') tela(!W.classList.contains('gfull'));
      else if (a === 'org') { for (const n of N.values()) { if (!n.raiz) n.fixo = false; n.x = n.y = null; n.a = null; } radial(); relaxar(); posicionar(); ajustar(); } });
    box.querySelector('[data-g=busca]').addEventListener('input', ev => { destacar(); const t = E.normNome(ev.target.value); if (t.length >= 3) { const n = [...N.values()].find(x => E.normNome(x.label + ' ' + (x.razao || '')).includes(t)); if (n) centralizar(n.id); } });
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (box.isConnected) ajustar(); }, 200); });

    /* ---------- exportar ---------- */
    function svgTexto() {
      const b = caixa(), c = svg.cloneNode(true); c.removeAttribute('tabindex'); c.removeAttribute('role'); c.setAttribute('viewBox', `${b.x - 30} ${b.y - 30} ${b.w + 60} ${b.h + 60}`); c.setAttribute('width', Math.round(b.w + 60)); c.setAttribute('height', Math.round(b.h + 60));
      c.querySelector('.gvp').removeAttribute('transform'); c.querySelectorAll('.apaga').forEach(x => x.classList.remove('apaga'));
      c.insertAdjacentHTML('afterbegin', '<style>.gt{font:600 12px Barlow,Arial,sans-serif;fill:#e6ecff}.gr{font:10px Barlow,Arial,sans-serif;fill:#9fb0d0}</style><rect x="' + (b.x - 30) + '" y="' + (b.y - 30) + '" width="' + (b.w + 60) + '" height="' + (b.h + 60) + '" fill="#0a1226"/>');
      return c.outerHTML;
    }
    function dados() { return { nodes: [...N.values()].map(({ el: _e, a: _a, _ox, _oy, ...n }) => n), edges: A.map(({ el: _e, ...e }) => e) }; }

    juntar(g); radial(); relaxar(); desenhar(); requestAnimationFrame(ajustar);
    return { svgTexto, dados, ajustar, adicionar: (g2, perto) => { juntar(g2, perto); relaxar(80); desenhar(); }, no: id => N.get(id) };
  }
  return { montar };
})();
