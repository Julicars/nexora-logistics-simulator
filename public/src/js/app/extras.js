/* NEXORA — facilidades do dia a dia:
 * duplicar plano · cores por entrega · foto do 3D · aviso de carga leve · “quantos mais cabem” · WhatsApp ·
 * favoritos · modelos de carga · nome de quem montou · tema claro · dicas da primeira vez · busca no menu ·
 * botão flutuante “Nova carga” · calculadora de cubagem · conversor de unidades
 */
const EXTRAS = (function () {
  'use strict';
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const abrir = (t, h) => REC.abrir(t, h), fechar = () => REC.fechar();

  /* ---------- favoritos ---------- */
  const fav = () => Object.assign({ p: [], v: [] }, LS.get('fav', {}));
  const isFav = (k, id) => fav()[k].includes(id);
  function toggleFav(k, id) { const f = fav(); f[k] = f[k].includes(id) ? f[k].filter(x => x !== id) : [...f[k], id]; LS.set('fav', f); return f[k].includes(id); }
  const ordFav = (k, list) => [...list].sort((a, b) => (isFav(k, b.id) ? 1 : 0) - (isFav(k, a.id) ? 1 : 0));

  /* ---------- cores por entrega (Roteirização) ---------- */
  const COR_ENT = ['#f39a2b', '#2f8cf2', '#32c48d', '#e5484d', '#a78bfa', '#14b8a6', '#f472b6', '#eab308', '#94a3b8', '#fb7185'];
  const corEntrega = p => { if (mode !== 'route' || !p || !p.stop || !LS.get('corEntrega', true) || typeof RT !== 'object' || !RT.rank) return null; const k = RT.rank(p.stop); return k ? COR_ENT[(k - 1) % COR_ENT.length] : null; };

  /* ---------- foto do 3D ---------- */
  function foto() {
    if (!plan) return toast('Monte a carga antes: toque em “▶ Ver como a carga fica”.', true);
    stopAnim(true); renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png'), nome = `carga-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`;
    abrir('📷 Foto da carga', `<img src="${url}" alt="Imagem da carga montada em 3D" style="width:100%;border-radius:8px;border:1px solid var(--line)">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><a class="btn pri" href="${url}" download="${nome}">⬇ Baixar imagem</a>${navigator.canShare ? '<button type="button" class="btn" id="fxShare">Compartilhar</button>' : ''}</div>
      <p class="mut" style="font-size:12px">Gire a câmera antes para escolher o ângulo. No celular, se o download não abrir, toque e segure na imagem para salvar.</p>`);
    const b = q('#fxShare'); if (b) b.onclick = async () => { try { const blob = await (await fetch(url)).blob(); await navigator.share({ files: [new File([blob], nome, { type: 'image/png' })], title: 'Carga NEXORA' }); } catch (e) { /* cancelado */ } };
  }

  /* ---------- resumo para WhatsApp ---------- */
  function resumoTexto() {
    const sm = summaryOf(plan), op = LS.get('operador', ''), linhas = [`*NEXORA — Plano de carga*`, new Date().toLocaleString('pt-BR') + (op ? ` · ${op}` : '')];
    plan.vehs.forEach((V, i) => { const s = NX.stats(V.v, V.items); linhas.push(`🚚 *${i ? 'Extra ' + i : 'Veículo'}: ${V.v.name}* — ${V.items.length} vol. · ${fmt(s.kg, 0)} kg · ${fmt(s.occ * 100, 0)}% do espaço · PBT ${fmt(s.pbt / 1000, 1)}/${fmt(s.pbtLim / 1000, 1)} t`); });
    const porProd = new Map(); for (const V of plan.vehs) for (const it of V.items) porProd.set(it.nome, (porProd.get(it.nome) || 0) + 1);
    linhas.push('📦 ' + [...porProd].map(([n, k]) => `${k}× ${n}`).join(' · '));
    linhas.push(`Total: ${sm.nVol} volumes · ${fmt(sm.kg / 1000, 2)} t · ${fmt(sm.cub, 1)} m³${plan.left.length ? ` · ⚠ ${plan.left.length} volume(s) de fora` : ''}`);
    if (mode === 'route' && S.route.stops && S.route.stops.length) linhas.push('📍 Entregas: ' + S.route.stops.map((s, i) => `${i + 1}) ${s.nome || ''} — ${s.city || s.nome || ''}${s.uf ? '/' + s.uf : ''}`).join(' · '));
    const qt = S[mode] && S[mode].quote; if (qt && qt.cliente) linhas.push('Cliente: ' + qt.cliente);
    return linhas.join('\n');
  }
  async function whatsapp() {
    if (!plan) return toast('Monte a carga antes: toque em “▶ Ver como a carga fica”.', true);
    const t = resumoTexto();
    abrir('💬 Enviar no WhatsApp', `<label class="f">Mensagem (pode editar)<textarea id="fxWaTxt" rows="9">${esc(t)}</textarea></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><a class="btn pri" id="fxWaGo" target="_blank" rel="noopener">Abrir no WhatsApp</a><button type="button" class="btn" id="fxWaCopy">Copiar texto</button><button type="button" class="btn" id="fxWaFoto">📷 Foto da carga</button></div>
      <p class="mut" style="font-size:12px">O WhatsApp abre com a mensagem pronta para você escolher o contato. Para mandar a imagem junto, baixe a foto e anexe na conversa.</p>`);
    const sync = () => { q('#fxWaGo').href = 'https://wa.me/?text=' + encodeURIComponent(q('#fxWaTxt').value); }; q('#fxWaTxt').oninput = sync; sync();
    q('#fxWaCopy').onclick = async () => { try { await navigator.clipboard.writeText(q('#fxWaTxt').value); toast('Texto copiado.'); } catch (e) { q('#fxWaTxt').select(); toast('Selecione e copie o texto.'); } };
    q('#fxWaFoto').onclick = foto;
  }

  /* ---------- carga leve: sugere um veículo menor ---------- */
  function cargaLeve() {
    if (!plan || plan.vehs.length !== 1 || plan.left.length) return null;
    const V = plan.vehs[0], s = NX.stats(V.v, V.items); if (s.occ >= 0.5 || s.kgOcc >= 0.5) return null;
    const cont = V.v.cat === 'Container'; if (cont) return null;
    const us = V.items.map(it => ({ n: it.n, pid: it.pid, p: it.p, nome: it.nome, cod: it.cod, kg: it.kg, stack: NX.stackOf(it.p), pcs: it.pcs }));
    const menor = fleet.filter(v => v.cat !== 'Container' && v.id !== V.v.id && NX.vol(v) < NX.vol(V.v)).sort((a, b) => NX.vol(a) - NX.vol(b)).find(v => !NX.pack(v, us).left.length);
    return { occ: s.occ, kg: s.kgOcc, menor };
  }
  function avisoLeve() {
    const el = q('#calcOut'); if (!el || !plan) return; const old = q('#fxLeve'); if (old) old.remove();
    const r = plan._leve; if (!r) return;
    el.insertAdjacentHTML('afterbegin', `<div id="fxLeve" class="fxleve" role="status">💡 <b>Carga leve:</b> usa ${fmt(r.occ * 100, 0)}% do espaço e ${fmt(r.kg * 100, 0)}% do peso do ${esc(plan.vehs[0].v.name)}.${r.menor ? ` O <b>${esc(r.menor.name)}</b> leva tudo. <button type="button" class="btn sm" data-fxveh="${r.menor.id}">Usar o ${esc(r.menor.name)}</button>` : ' Não há veículo menor na frota que leve tudo.'}</div>`);
  }

  /* ---------- quantos mais cabem ---------- */
  function quantosMais(pid) {
    if (!plan) return; const V = plan.vehs[active], p = V.items.find(i => i.pid === pid)?.p || curLines().find(l => l.id === pid); if (!p) return;
    const us = V.items.map(it => ({ n: it.n, pid: it.pid, p: it.p, nome: it.nome, cod: it.cod, kg: it.kg, stack: NX.stackOf(it.p), pcs: it.pcs }));
    const extra = k => Array.from({ length: k }, (_, i) => ({ n: 100000 + i, pid: p.id, p, nome: p.nome, cod: p.cod, kg: +p.kg, stack: NX.stackOf(p), pcs: p.pcs }));
    const cabe = k => !NX.pack(V.v, [...us, ...extra(k)]).left.length;
    if (!cabe(0)) return toast('A carga atual já precisa de ajuste antes de somar mais.', true);
    let lo = 0, hi = 1; while (hi < 2000 && cabe(hi)) { lo = hi; hi *= 2; } if (hi >= 2000 && cabe(hi)) lo = hi;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cabe(m)) lo = m; else hi = m; }
    toast(lo ? `Ainda cabem ${lo} volume(s) de “${p.nome}” no ${V.v.name} (espaço, peso e eixos conferidos).` : `Não cabe mais nenhum “${p.nome}” no ${V.v.name}.`);
  }
  function botoesCabe() {
    const el = q('#calcOut'); if (!el || !plan) return;
    const ids = [...new Set(plan.vehs[active].items.map(i => i.pid))]; if (!ids.length || q('#fxCabe')) return;
    el.insertAdjacentHTML('beforeend', `<div id="fxCabe" style="margin:10px 0"><b style="font-size:13px">Quantos mais cabem neste veículo?</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${ids.map(id => { const p = plan.vehs[active].items.find(i => i.pid === id).p; return `<button type="button" class="btn sm" data-fxcabe="${esc(id)}">+ ${esc(p.nome)}</button>`; }).join('')}</div></div>`);
  }

  /* ---------- duplicar plano ---------- */
  function duplicar(id) {
    const l = LS.get('plans', []), p = l.find(x => x.id === id); if (!p) return;
    const c = JSON.parse(JSON.stringify(p)); c.id = 'pl' + Date.now().toString(36); c.name = (p.name || 'Plano') + ' (cópia)'; c.criado = new Date().toISOString();
    l.unshift(c); LS.set('plans', l); renderPlans(); toast('Plano duplicado: “' + c.name + '”.');
  }

  /* ---------- modelos de carga ---------- */
  const modelos = () => LS.get('modelos', []);
  function abrirModelos() {
    const m = QM ? (mode === 'cat' ? 'cat' : QM()) : mode, linhas = mode === 'cat' ? S.cat.lines : S[m].lines;
    const lista = () => modelos().length ? `<ul class="rglist">${modelos().map((x, i) => `<li><span><b>${esc(x.nome)}</b> <small class="mut">${x.lines.length} item(ns) · ${{ cat: 'Catálogo', route: 'Roteirização', quick: 'Rápida' }[x.mode] || ''}</small></span><span style="display:flex;gap:6px"><button type="button" class="btn sm pri" data-mdusar="${i}">Usar</button><button type="button" class="btn sm" data-mddel="${i}" aria-label="Apagar modelo">✕</button></span></li>`).join('')}</ul>` : '<p class="mut">Nenhum modelo salvo ainda.</p>';
    abrir('📑 Modelos de carga', `<p class="mut" style="margin:0 0 8px">Guarde um pedido que se repete (ex.: “Pedido semanal do Cliente X”) e reabra com um toque.</p>
      <form id="fxMdF" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label class="f" style="flex:1 1 220px">Nome do modelo<input name="nome" required maxlength="60" placeholder="Ex.: Pedido semanal — Atacadão"></label><button class="btn pri" type="submit" ${linhas.length ? '' : 'disabled'}>Salvar a carga atual (${linhas.length} item(ns))</button></form>
      <div id="fxMdL" style="margin-top:10px">${lista()}</div>`);
    q('#fxMdF').onsubmit = e => { e.preventDefault(); const nome = e.target.elements.nome.value.trim(); if (!nome || !linhas.length) return; LS.set('modelos', [{ nome, mode: mode, lines: JSON.parse(JSON.stringify(linhas)), veh: S[mode].veh, t: Date.now() }, ...modelos()].slice(0, 50)); q('#fxMdL').innerHTML = lista(); e.target.reset(); toast('Modelo salvo.'); };
    q('#fxMdL').onclick = e => {
      const u = e.target.closest('[data-mdusar]'), d = e.target.closest('[data-mddel]');
      if (d) { const l = modelos(); l.splice(+d.dataset.mddel, 1); LS.set('modelos', l); q('#fxMdL').innerHTML = lista(); return; }
      if (!u) return; const md = modelos()[+u.dataset.mdusar];
      const alvo = md.mode === 'cat' ? 'cat' : md.mode === 'route' ? 'route' : 'quick';
      if (alvo === 'cat') { S.cat.lines = md.lines.filter(l => prods.some(p => p.id === l.pid)); if (S.cat.lines.length < md.lines.length) toast('Alguns produtos do modelo não existem mais no cadastro.', true); if (typeof syncCatSel === 'function') syncCatSel(); }
      else S[alvo].lines = JSON.parse(JSON.stringify(md.lines)).map(l => ({ ...l, id: l.id || ('m' + Math.random().toString(36).slice(2, 8)) }));
      if (md.veh && fleet.some(v => v.id === md.veh)) S[alvo].veh = md.veh;
      saveWork(); fechar(); go(alvo === 'cat' ? 'carga-catalogo' : alvo === 'route' ? 'rota' : 'rapida'); renderOrder(); toast(`Modelo “${md.nome}” aplicado. Toque em “▶ Ver como a carga fica”.`);
    };
  }

  /* ---------- calculadoras ---------- */
  const n = v => +String(v || '').replace(',', '.') || 0;
  function calculadoras() {
    abrir('🧮 Calculadoras rápidas', `<h3 style="margin:0 0 6px;font-size:16px">Cubagem</h3>
      <div class="taragrid" id="fxCub"><label class="f">Comprimento (m)<input inputmode="decimal" name="l" value="0.60"></label><label class="f">Largura (m)<input inputmode="decimal" name="w" value="0.40"></label><label class="f">Altura (m)<input inputmode="decimal" name="h" value="0.50"></label><label class="f">Quantidade<input inputmode="numeric" name="q" value="10"></label><label class="f">Peso de cada (kg)<input inputmode="decimal" name="kg" value="12"></label><label class="f">Fator (kg/m³)<select name="f"><option value="300">300 — lotação</option><option value="250">250 — fracionada</option><option value="200">200</option><option value="167">167 — aéreo</option></select></label></div>
      <div id="fxCubR" class="fxres" aria-live="polite"></div>
      <h3 style="margin:16px 0 6px;font-size:16px">Conversor de unidades</h3>
      <div class="taragrid" id="fxConv"><label class="f">Valor<input inputmode="decimal" name="v" value="1"></label><label class="f">De<select name="u">${Object.keys(UN).map(k => `<option value="${k}">${UN[k][2]}</option>`).join('')}</select></label></div>
      <div id="fxConvR" class="fxres" aria-live="polite"></div>`);
    const cub = () => { const f = Object.fromEntries([...q('#fxCub').querySelectorAll('[name]')].map(e => [e.name, e.value])); const m3u = n(f.l) * n(f.w) * n(f.h), m3 = m3u * Math.max(0, Math.round(n(f.q))), kg = n(f.kg) * Math.round(n(f.q)), cb = m3 * n(f.f);
      q('#fxCubR').innerHTML = `<div class="kv"><span>Volume</span><b>${fmt(m3, 3)} m³ <small class="mut">(${fmt(m3u, 4)} m³ cada)</small></b></div><div class="kv"><span>Peso real</span><b>${fmt(kg, 1)} kg</b></div><div class="kv"><span>Peso cubado</span><b>${fmt(cb, 1)} kg</b></div><div class="kv"><span>Cobrar pelo</span><b class="${cb > kg ? 'warn' : 'ok'}">${cb > kg ? 'peso cubado' : 'peso real'} — ${fmt(Math.max(cb, kg), 1)} kg</b></div><div class="kv"><span>Densidade</span><b>${m3 ? fmt(kg / m3, 0) : '—'} kg/m³</b></div>`; };
    const conv = () => { const v = n(q('#fxConv [name=v]').value), u = UN[q('#fxConv [name=u]').value], base = v * u[0];
      const alvo = Object.entries(UN).filter(([, x]) => x[1] === u[1]); q('#fxConvR').innerHTML = alvo.map(([k, x]) => `<div class="kv"><span>${x[2]}</span><b>${fmt(base / x[0], x[1] === 'm' && x[0] < 0.01 ? 1 : 4)}</b></div>`).join(''); };
    q('#fxCub').oninput = cub; q('#fxCub').onchange = cub; q('#fxConv').oninput = conv; q('#fxConv').onchange = conv; cub(); conv();
  }
  /* fator para a unidade base (m, kg, m³) · grandeza · nome */
  const UN = { m: [1, 'm', 'metro (m)'], cm: [0.01, 'm', 'centímetro (cm)'], mm: [0.001, 'm', 'milímetro (mm)'], pol: [0.0254, 'm', 'polegada (in)'], pe: [0.3048, 'm', 'pé (ft)'],
    kg: [1, 'kg', 'quilo (kg)'], t: [1000, 'kg', 'tonelada (t)'], lb: [0.45359237, 'kg', 'libra (lb)'], g: [0.001, 'kg', 'grama (g)'],
    m3: [1, 'm3', 'metro cúbico (m³)'], l: [0.001, 'm3', 'litro (L)'], ft3: [0.0283168, 'm3', 'pé cúbico (ft³)'] };

  /* ---------- tema claro ---------- */
  /* logo: versão com letras escuras no tema claro (src/img/logo-claro.png) */
  function trocaLogo() { const cl = document.body.classList.contains('light'); qa('img[src*="logo"]').forEach(i => { const s = i.getAttribute('src'); if (!/logo(-claro)?\.png/.test(s)) return; const n = cl ? s.replace(/logo\.png/, 'logo-claro.png') : s.replace(/logo-claro\.png/, 'logo.png'); if (n !== s) i.setAttribute('src', n); }); }
  const aplicaTema = () => { document.body.classList.toggle('light', LS.get('tema', 'escuro') === 'claro'); if (typeof temaCena === 'function') temaCena(); if (window.temaMapa) temaMapa(); trocaLogo(); };

  /* ---------- busca no menu ---------- */
  const PALAVRAS = { home: 'inicio painel', 'carga-catalogo': 'catalogo pedido montar', rapida: 'montagem rapida 3d simular carga', rota: 'rota roteirizacao entrega frete antt piso mapa', produtos: 'produto cadastro item regra', frota: 'veiculo frota caminhao carreta eixo', montagens: 'planos salvos montagem historico', fretes: 'registro empregador frete nfe', transportes: 'registro transportador cte', empresas: 'empresa cnpj socio pessoa consulta risco', forum: 'forum duvida comunidade', config: 'configuracoes backup tema acessibilidade antt tabela', contato: 'contato suporte', sobre: 'sobre' };
  const sem = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function buscaMenu() {
    const nav = q('aside nav'); if (!nav || q('#fxNav')) return;
    nav.insertAdjacentHTML('afterbegin', `<div class="fxnav"><label class="sr" for="fxNav">Procurar no menu</label><input id="fxNav" type="search" placeholder="🔎 Procurar… (ex.: frete)" autocomplete="off"></div>`);
    const inp = q('#fxNav'), filtra = () => { const t = sem(inp.value.trim()); qa('aside nav button[data-go], aside nav button[data-fxgo]').forEach(b => { const k = b.dataset.go || ''; b.hidden = !!t && !sem(b.textContent + ' ' + (PALAVRAS[k] || '')).includes(t); }); qa('aside nav h3').forEach(h => { let e = h.nextElementSibling, vis = false; while (e && e.tagName !== 'H3') { if (e.tagName === 'BUTTON' && !e.hidden) vis = true; e = e.nextElementSibling; } h.hidden = !vis; }); };
    inp.oninput = filtra;
    inp.onkeydown = e => { if (e.key === 'Enter') { const b = qa('aside nav button[data-go], aside nav button[data-fxgo]').find(x => !x.hidden); if (b) { b.click(); inp.value = ''; filtra(); } } else if (e.key === 'Escape') { inp.value = ''; filtra(); } };
    /* item de menu: calculadoras */
    const cfg = q('aside nav button[data-go="config"]'); if (cfg) cfg.insertAdjacentHTML('beforebegin', `<button type="button" data-fxgo="calc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M16 11v6"/></svg>Calculadoras</button>`);
    nav.addEventListener('click', e => { if (e.target.closest('[data-fxgo="calc"]')) calculadoras(); });
  }

  /* ---------- botão flutuante (celular) ---------- */
  function fab() {
    if (q('#fxFab')) return;
    document.body.insertAdjacentHTML('beforeend', `<button type="button" id="fxFab" class="fxfab" aria-label="Nova carga">＋ <span>Nova carga</span></button>`);
    q('#fxFab').onclick = () => { go('rapida'); setTimeout(() => openOrder(), 60); };
  }

  /* ---------- dicas da primeira vez ---------- */
  const PASSOS = [
    ['#bCalc', 'Comece por aqui', 'Informe a carga (ou cole a lista do pedido) e toque em “▶ Ver como a carga fica”.'],
    ['#selVeh', 'Escolha o veículo', 'Troque o veículo e veja na hora o peso de cada eixo.'],
    ['#stage', 'Mexa no 3D', 'Arraste para girar a câmera. Toque num volume para mover, girar ou mandar para outro veículo.'],
    ['#fxBtns', 'Compartilhe', 'Foto da carga, mensagem pronta para o WhatsApp e modelos de carga que se repetem.']
  ];
  let tipFim = null; /* tour aberto: função que fecha */
  const fecharDicas = () => { if (tipFim) tipFim(); };
  function dicas(forcar) {
    if ((!forcar && LS.get('dicasOk', false)) || tipFim) return; let i = 0;
    const box = document.createElement('div'); box.className = 'fxtip'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box);
    const L = PASSOS.filter(x => q(x[0]) && q(x[0]).offsetParent);
    const mostra = () => {
      if (i >= L.length) return fim();
      const [sel, t, txt] = L[i], el = q(sel); try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { el.scrollIntoView(); } const r = el.getBoundingClientRect(); el.classList.add('fxalvo');
      box.innerHTML = `<b>${t}</b><p>${txt}</p><div><small>${i + 1}/${L.length}</small><button type="button" class="btn sm" data-tip="pular">Pular</button><button type="button" class="btn sm pri" data-tip="ok">${i === L.length - 1 ? 'Entendi' : 'Próxima'}</button></div>`;
      const W = Math.min(300, innerWidth - 20); Object.assign(box.style, { width: W + 'px', left: Math.max(10, Math.min(innerWidth - W - 10, r.left)) + 'px', top: '0px' });
      const H = box.offsetHeight, alto = Math.min(r.bottom, innerHeight) + 10, top = alto + H < innerHeight - 10 ? alto : r.top - H - 10 > 10 ? r.top - H - 10 : innerHeight - H - 10; box.style.top = Math.max(10, top) + 'px'; if (!document.activeElement || document.activeElement === document.body) box.querySelector('[data-tip=ok]').focus({ preventScroll: true });
    };
    const limpa = () => qa('.fxalvo').forEach(e => e.classList.remove('fxalvo'));
    const fim = () => { limpa(); box.remove(); LS.set('dicasOk', true); tipFim = null; }; tipFim = fim;
    box.onclick = e => { const b = e.target.closest('[data-tip]'); if (!b) return; limpa(); if (b.dataset.tip === 'pular') return fim(); i++; mostra(); };
    box.onkeydown = e => { if (e.key === 'Escape') fim(); };
    setTimeout(mostra, 400);
  }

  /* ---------- montagem ---------- */
  function botoes() {
    const ref = q('#bShare') || q('#bSavePlan'); if (!ref || q('#fxBtns')) return;
    ref.insertAdjacentHTML('afterend', `<div id="fxBtns" class="recrow" style="margin-top:8px"><button type="button" class="btn sm" id="fxWa">💬 WhatsApp</button><button type="button" class="btn sm" id="fxFoto">📷 Foto do 3D</button><button type="button" class="btn sm" id="fxMod">📑 Modelos de carga</button></div>`);
    q('#fxWa').onclick = whatsapp; q('#fxFoto').onclick = foto; q('#fxMod').onclick = abrirModelos;
    const calc = q('.recrow #bRegras'); if (calc && !q('#fxMod2')) calc.insertAdjacentHTML('afterend', `<button type="button" class="btn sm" id="fxMod2">📑 Modelos</button>`), q('#fxMod2').onclick = abrirModelos;
  }
  function configs() {
    const ae = q('#aeMode'); if (!ae || q('#fxTema')) return;
    ae.closest('label').insertAdjacentHTML('afterend', `<label class="chk"><input type="checkbox" id="fxTema"> Tema claro (bom para usar no sol ou imprimir)</label>
      <label class="chk"><input type="checkbox" id="fxCorEnt"> Na Roteirização, pintar cada volume com a cor da sua entrega</label>
      <label class="f" style="margin-top:8px">Seu nome (sai no relatório, na etiqueta e no WhatsApp)<input id="fxOper" maxlength="60" autocomplete="name"></label>
      <button type="button" class="btn sm" id="fxDicas" style="margin-top:8px">Ver as dicas de novo</button>`);
    q('#fxTema').checked = LS.get('tema', 'escuro') === 'claro'; q('#fxTema').onchange = e => { LS.set('tema', e.target.checked ? 'claro' : 'escuro'); aplicaTema(); };
    q('#fxCorEnt').checked = LS.get('corEntrega', true); q('#fxCorEnt').onchange = e => { LS.set('corEntrega', e.target.checked); if (plan && typeof buildScene === 'function') { buildScene(); renderAll(); } };
    q('#fxOper').value = LS.get('operador', ''); q('#fxOper').onchange = e => { LS.set('operador', e.target.value.trim()); toast('Nome salvo neste aparelho.'); };
    q('#fxDicas').onclick = () => { LS.set('dicasOk', false); go('rapida'); dicas(true); };
  }

  /* eventos gerais */
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-fxveh]'); if (v) { S[mode].veh = v.dataset.fxveh; saveWork(); renderVehSel(); calculate(); return; }
    const c = e.target.closest('[data-fxcabe]'); if (c) return quantosMais(c.dataset.fxcabe);
    const d = e.target.closest('[data-dup]'); if (d) return duplicar(d.dataset.dup);
    const s = e.target.closest('[data-favp]'); if (s) { e.preventDefault(); e.stopPropagation(); const on = toggleFav('p', s.dataset.favp); toast(on ? 'Produto marcado como favorito.' : 'Produto tirado dos favoritos.'); renderCatalog(); return; }
    const fv = e.target.closest('[data-favv]'); if (fv) { const on = toggleFav('v', fv.dataset.favv); toast(on ? 'Veículo marcado como favorito: aparece primeiro na lista.' : 'Veículo tirado dos favoritos.'); renderFleet(); renderVehSel(); }
  }, true);

  aplicaTema(); buscaMenu(); fab(); botoes(); configs();
  return { fecharDicas, isFav, ordFav, corEntrega, cargaLeve, avisoLeve, botoesCabe, foto, whatsapp, abrirModelos, calculadoras, dicas, duplicar, resumoTexto, botoes };
})();
