/* NEXORA — Diesel & Abastecimento: tela que consome /api/combustivel (dados semanais oficiais da ANP).
 * Cards Brasil, gráfico de evolução, ranking por estado e cidade, lista/mapa de postos, mudanças de preço,
 * calculadora de custo de diesel da viagem e exportação para Excel.
 */
const COMB = (function () {
  'use strict';
  const q = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (n, d = 2) => n == null || isNaN(n) ? '—' : 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const nf = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const dt = d => d ? d.split('-').reverse().join('/') : '—';
  const pn = v => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const cap = s => String(s || '').toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, w => w.toLowerCase());
  const PRODS = ['s10', 's500', 'gas', 'gasad', 'etanol', 'gnv'];
  const PN = { s10: 'Diesel S-10', s500: 'Diesel S-500', gas: 'Gasolina comum', gasad: 'Gasolina aditivada', etanol: 'Etanol', gnv: 'GNV' };
  const PS = { s10: 'S-10', s500: 'S-500', gas: 'Gasolina', gasad: 'Aditivada', etanol: 'Etanol', gnv: 'GNV' };
  const GRUPOS = { diesel: ['s10', 's500'], gasolina: ['gas', 'gasad'], etanol: ['etanol'], gnv: ['gnv'] };
  let grupo = (window.LS && LS.get('combGrupo', 'diesel')) || 'diesel'; if (!GRUPOS[grupo]) grupo = 'diesel';
  const GP = () => GRUPOS[grupo];
  const UN = k => k === 'gnv' ? 'm³' : 'L';
  let R = null, iniciado = false, lista = [], mapa = null, camada = null, tiles = null, temServidor = null, poll = null;

  async function api(p, o) {
    const r = await fetch('/api/combustivel/' + p, o); const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) { const e = new Error('sem servidor'); e.semServidor = true; throw e; }
    const b = await r.json(); if (!r.ok) { const e = new Error(b.erro || 'Erro ' + r.status); e.status = r.status; e.body = b; throw e; } return b;
  }
  const varTx = (a, b) => { if (a == null || b == null) return ''; const d = a - b, p = d / b * 100; if (Math.abs(d) < 0.0005) return '<span class="mut">estável</span>'; return `<span class="${d > 0 ? 'bad' : 'ok'}">${d > 0 ? '▲' : '▼'} ${brl(Math.abs(d), 2)} (${nf(Math.abs(p), 1)}%)</span>`; };

  async function status() {
    const el = q('#cbStatus');
    try {
      const s = await api('status'); temServidor = true;
      const fresco = s.verificadoEm ? new Date(s.verificadoEm).toLocaleString('pt-BR') : 'nunca';
      el.innerHTML = `<span class="cbdot ${s.erro ? 'bad' : s.ultima ? 'ok' : 'mut'}" aria-hidden="true"></span><span><b>${s.ultima ? `Semana de ${dt(s.ultima.inicio)} a ${dt(s.ultima.fim)}` : 'Sem dados'}</b> · ${s.semanas} semana(s) no histórico · última verificação na ANP: ${fresco}${s.atualizando ? ' · <b>baixando…</b>' : ''}${s.erro ? `<br><span class="bad">Falha na última verificação: ${esc(s.erro)}</span> <span class="mut">— o servidor tenta de novo em 6 h; você pode importar a planilha manualmente.</span>` : ''}${s.erroSemana ? `<br><span class="warn">${esc(s.erroSemana)}</span>` : ''}</span><span class="cbtag">Atualização semanal · ANP</span>`;
      if (s.atualizando && !poll) poll = setTimeout(() => { poll = null; status(); carregar(); }, 5000);
      return s;
    } catch (e) {
      temServidor = !e.semServidor;
      el.innerHTML = e.semServidor ? '<span class="cbdot bad" aria-hidden="true"></span><span><b>Precisa do servidor do NEXORA.</b> Os preços da ANP são baixados pelo servidor (o site da ANP não permite o acesso direto pelo navegador). Rode no computador com <code>npm start</code> e abra http://localhost:3000.</span>' : `<span class="cbdot bad"></span><span>${esc(e.message)}</span>`;
      return null;
    }
  }
  async function carregar() {
    try { R = await api('resumo'); q('#cbVazio').hidden = true; q('#cbConteudo').hidden = false; desenhar(); }
    catch (e) {
      q('#cbConteudo').hidden = true;
      if (e.semServidor) { q('#cbVazio').hidden = true; return; }
      q('#cbVazio').hidden = false;
      q('#cbVazioTx').textContent = e.status === 404 ? 'O servidor ainda não baixou nenhuma semana. Ele busca sozinho ao iniciar; se a ANP estiver fora do ar ou bloqueada na sua rede, importe a planilha.' : e.message;
    }
  }

  function card(t, k) {
    const s = R.br[k], a = R.brAnterior && R.brAnterior[k];
    if (!s) return `<div class="card cbcard"><span class="mut">${t}</span><b>—</b><small class="mut">sem preços nesta semana</small></div>`;
    return `<div class="card cbcard"><span class="mut">${t} · média Brasil</span><b>${brl(s.media, 2)}<small>/${UN(k)}</small></b><small>${varTx(s.media, a && a.media)} <span class="mut">vs. semana anterior</span></small><small class="mut">mín. ${brl(s.min)} · máx. ${brl(s.max)} · ${nf(s.n)} postos</small></div>`;
  }
  function desenhar() {
    const g = R.br.gas, e = R.br.etanol, rz = g && e ? e.media / g.media : null;
    q('#cbCards').innerHTML = GP().map(k => card(PN[k], k)).join('') + (grupo !== 'gasolina' && grupo !== 'etanol' ? '' :
      `<div class="card cbcard"><span class="mut">Etanol ou gasolina?</span><b>${rz ? nf(rz * 100, 1) + '%' : '—'}</b><small>${rz ? (rz <= 0.7 ? '<span class="ok">Etanol compensa</span>' : '<span class="bad">Gasolina compensa</span>') : ''} <span class="mut">regra dos 70% (média Brasil)</span></small><small class="mut">etanol ÷ gasolina; abaixo de 70% vale o etanol</small></div>`) +
      `<div class="card cbcard"><span class="mut">Cobertura da semana</span><b>${nf(R.postos)}<small> postos</small></b><small class="mut">${nf(R.municipios)} municípios · coleta ${dt(R.semana.coleta[0])} a ${dt(R.semana.coleta[1])}</small><small class="mut">baixado em ${new Date(R.semana.baixadoEm).toLocaleString('pt-BR')}</small></div>` +
      '';
    hist(); ufs(); cidades(); mudancas(); calc(); if (M) { composicao(); grafMercado(); }
    if (!q('#cbMun').options.length || q('#cbMun').dataset.uf !== q('#cbUf').value) muns(); else postos();
  }
  function hist() {
    const uf = q('#cbHistUf').value, H = R.historico.map(h => ({ d: h.fim, ...Object.fromEntries(PRODS.map(k => [k, uf ? (h.uf[uf] || {})[k] ?? null : h[k]])) })).filter(h => PRODS.some(k => h[k] != null)), ks = GP().filter(k => H.some(h => h[k] != null));
    const el = q('#cbHist');
    if (H.length < 2) { el.innerHTML = `<p class="mut">O gráfico aparece a partir de 2 semanas no histórico (agora: ${H.length}). O servidor guarda uma semana nova toda vez que a ANP publica.</p>${H.length ? `<p>${uf || 'Brasil'}: ${ks.map(k => PS[k] + ' ' + brl(H[0][k])).join(' · ')}</p>` : ''}`; return; }
    const W = 640, Hh = 220, P = { l: 52, r: 14, t: 14, b: 30 }, vals = H.flatMap(h => ks.map(k => h[k])).filter(v => v != null);
    let mn = Math.min(...vals), mx = Math.max(...vals); const pad = Math.max((mx - mn) * 0.15, 0.05); mn -= pad; mx += pad;
    const X = i => P.l + i * (W - P.l - P.r) / (H.length - 1), Y = v => P.t + (1 - (v - mn) / (mx - mn)) * (Hh - P.t - P.b);
    const linha = k => { const pts = H.map((h, i) => h[k] == null ? null : [X(i), Y(h[k])]).filter(Boolean); return pts.length ? `<path d="M${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join('L')}" class="cbl ${k}"/>${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" class="cbp ${k}"><title>${PS[k]}: ${brl(H[i][k])}</title></circle>`).join('')}` : ''; };
    const ticks = [0, 1, 2, 3].map(i => mn + (mx - mn) * i / 3), passo = Math.ceil(H.length / 7);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Preço médio semanal ${uf || 'Brasil'}, última semana: ${ks.map(k => PS[k] + ' ' + brl(H[H.length - 1][k])).join('; ')}">
      ${ticks.map(t => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}" class="cbgl"/><text x="${P.l - 6}" y="${Y(t) + 4}" text-anchor="end" class="cbtx">${nf(t, 2)}</text>`).join('')}
      ${H.map((h, i) => i % passo && i !== H.length - 1 ? '' : `<text x="${X(i)}" y="${Hh - 8}" text-anchor="middle" class="cbtx">${dt(h.d).slice(0, 5)}</text>`).join('')}
      ${ks.map(linha).join('')}</svg><div class="cbleg">${ks.map(k => `<span><i class="${k}"></i>${PS[k]}</span>`).join('')}<span class="mut">semana terminada em (R$/L; GNV R$/m³)</span></div>`;
  }
  function ufs() {
    const k = q('#cbUfProd').value, l = Object.entries(R.uf).map(([u, v]) => ({ u, s: v[k], a: R.ufAnterior && R.ufAnterior[u] && R.ufAnterior[u][k] })).filter(x => x.s).sort((a, b) => a.s.media - b.s.media);
    if (!l.length) { q('#cbUfs').innerHTML = '<p class="mut">Sem dados.</p>'; return; }
    const mn = l[0].s.media, mx = l[l.length - 1].s.media;
    q('#cbUfs').innerHTML = l.map(x => `<button type="button" class="cbuf" data-uf="${x.u}" title="Ver postos de ${x.u}"><b>${x.u}</b><span class="cbbar"><i style="width:${mx > mn ? 12 + 88 * (x.s.media - mn) / (mx - mn) : 50}%"></i></span><span>${brl(x.s.media)}</span><small>${varTx(x.s.media, x.a && x.a.media) || '<span class="mut">—</span>'}</small></button>`).join('');
  }
  function cidades() {
    const k = q('#cbProd').value, c = R.cidades[k];
    q('#cbCidProdTx').textContent = '(' + PN[k] + ', média dos postos pesquisados)'; q('#cbCarasTx').textContent = '(' + PN[k] + ')';
    const li = (l) => l.length ? `<ol class="cbrank">${l.map(x => `<li><button type="button" class="lnk" data-cid="${esc(x.u + '|' + x.m)}">${esc(cap(x.m))}&nbsp;<span class="mut">${x.u}</span></button><b>${brl(x.media)}</b><small class="mut">${x.n} posto(s) · ${brl(x.min)}–${brl(x.max)}</small></li>`).join('')}</ol>` : '<p class="mut">Sem dados.</p>';
    q('#cbBaratas').innerHTML = li(c.baratas); q('#cbCaras').innerHTML = li(c.caras);
  }
  function mudancas() {
    const m = R.mudancas;
    q('#cbMudTx').textContent = m.comparados ? `${nf(GP().reduce((t, k) => t + (((m.porProd || {})[k] || {}).total || 0), 0))} mudança(s) de ${GP().map(k => PS[k]).join(' e ')} entre ${nf(m.comparados)} postos pesquisados nas duas últimas semanas.` : 'A comparação aparece quando houver duas semanas no histórico.';
    const row = x => `<tr><td data-l="Posto">${esc(x.n || x.c)}<br><small class="mut">${esc(cap(x.m))}/${x.u} · ${esc(x.b)}</small></td><td data-l="Combustível">${PS[x.prod]}</td><td data-l="Preço">${brl(x.de)} → <b>${brl(x.para)}</b></td><td data-l="Var." class="${x.pct > 0 ? 'bad' : 'ok'}">${x.pct > 0 ? '+' : ''}${nf(x.pct, 1)}%</td></tr>`;
    const mg = GP().flatMap(k => (m.porProd || {})[k] ? [m.porProd[k]] : []), al = mg.flatMap(x => x.altas).sort((a, b) => b.pct - a.pct), qu = mg.flatMap(x => x.quedas).sort((a, b) => a.pct - b.pct);
    q('#cbMud').innerHTML = al.length + qu.length ? `<div class="tbl-wrap"><table class="tbl cbcardtab"><thead><tr><th>Posto</th><th>Diesel</th><th>Preço</th><th>Var.</th></tr></thead><tbody>${al.slice(0, 8).map(row).join('')}${qu.slice(0, 8).map(row).join('')}</tbody></table></div>` : '';
  }

  async function muns() {
    const uf = q('#cbUf').value, sel = q('#cbMun'), atual = sel.value; sel.dataset.uf = uf;
    try { const l = await api('municipios?uf=' + uf); sel.innerHTML = '<option value="">Todas</option>' + l.map(m => `<option value="${esc(m)}">${esc(cap(m))}</option>`).join(''); if (l.includes(atual)) sel.value = atual; } catch (e) { /* mantém */ }
    postos();
  }
  let tBusca = null;
  async function postos(e) {
    const k = q('#cbProd').value, ps = new URLSearchParams({ produto: k, uf: q('#cbUf').value, municipio: q('#cbMun').value, ordem: q('#cbOrdem').value, busca: q('#cbBusca').value.trim(), limite: 3000 });
    if (e !== undefined) postos.lim = 30;
    let r; try { r = await api('postos?' + ps); } catch (e) { q('#cbPostos').innerHTML = `<p class="bad">${esc(e.message)}</p>`; return; }
    lista = r.postos; cidades();
    q('#cbPostosTx').textContent = r.total ? `${nf(r.total)} posto(s) · média ${brl(r.stats.media)} · ${brl(r.stats.min)} a ${brl(r.stats.max)}` : '';
    const lim = matchMedia('(max-width:640px)').matches ? (postos.lim || 30) : 200, vis = lista.slice(0, lim);
    q('#cbPostos').innerHTML = !lista.length ? '<p class="mut">Nenhum posto com esse filtro nesta semana. A ANP pesquisa só parte dos municípios — tente a UF inteira.</p>' :
      `<div class="tbl-wrap"><table class="tbl cbtab cbcardtab"><thead><tr><th>Posto</th><th class="hm">Bandeira</th><th>Cidade</th><th>${PS[k]}</th><th class="hm">Outros combustíveis</th><th>Semana</th></tr></thead><tbody>${vis.map(p => `<tr><td data-l="Posto"><b>${esc(p.n || p.r)}</b><br><small class="mut">${esc(p.e)} · CNPJ ${p.c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</small></td><td class="hm" data-l="Bandeira">${esc(p.b)}</td><td data-l="Cidade">${esc(cap(p.m))}/${p.u}</td><td data-l="${PS[k]}" class="cbpreco"><b>${brl(p[k], 2)}</b><br><small class="mut">coleta ${dt(p.d)}</small></td><td class="hm" data-l="Outros"><small>${PRODS.filter(o => o !== k && p[o]).map(o => PS[o] + ' <b>' + brl(p[o]) + '</b>').join('<br>') || '—'}</small></td><td data-l="Semana">${p.var == null ? '<span class="mut">novo</span>' : p.var === 0 ? '<span class="mut">=</span>' : `<span class="${p.var > 0 ? 'bad' : 'ok'}">${p.var > 0 ? '▲' : '▼'} ${brl(Math.abs(p.var), 2)}</span>`}</td></tr>`).join('')}</tbody></table></div>${lista.length > lim ? `<p class="mut" style="font-size:12px">Mostrando ${lim} de ${nf(lista.length)} — filtre por UF/cidade ou exporte para Excel.${lim < 200 ? ' <button type="button" class="btn sm" id="cbMais">Mostrar mais</button>' : ''}</p>` : ''}`;
    const mais = q('#cbMais'); if (mais) mais.onclick = () => { postos.lim = Math.min((postos.lim || 30) + 30, 200); postos(); };
    if (!q('#cbMapa').hidden) desenhaMapa();
  }

  /* mapa: coordenadas da API Revendedores; sem ela, centro da cidade (IBGE) com leve dispersão */
  let MUN = null;
  function centro(m, u) {
    if (!MUN) { MUN = {}; (Array.isArray(window.NX_MUN) ? window.NX_MUN : String(window.NX_MUN || '').split('\n')).forEach(l => { const [n, uf, la, lo] = l.split('|'); if (n) MUN[n.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() + '|' + uf] = [+la, +lo]; }); }
    return MUN[m + '|' + u];
  }
  const tileUrl = () => `https://{s}.basemaps.cartocdn.com/${document.body.classList.contains('light') ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`;
  async function desenhaMapa() {
    if (typeof L === 'undefined') { q('#cbMapa').textContent = 'Mapa indisponível (Leaflet não carregou).'; return; }
    if (!mapa) { mapa = L.map(q('#cbMapa')); tiles = L.tileLayer(tileUrl(), { maxZoom: 18, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO · ANP' }).addTo(mapa); mapa.attributionControl.setPrefix(false); camada = L.layerGroup().addTo(mapa); }
    setTimeout(() => mapa.invalidateSize(), 50);
    camada.clearLayers(); const k = q('#cbProd').value, vis = lista.slice(0, 1500);
    const geo = {}; for (const u of [...new Set(vis.map(p => p.u))].slice(0, 4)) { try { Object.assign(geo, await api('geo?uf=' + u)); } catch (e) { /* usa centro da cidade */ } }
    const vals = vis.map(p => p[k]), mn = Math.min(...vals), mx = Math.max(...vals), b = [];
    vis.forEach((p, i) => {
      let ll = geo[p.c], aprox = false; if (!ll) { const c = centro(p.m, p.u); if (!c) return; aprox = true; const a = i * 2.39996, r = 0.004 * Math.sqrt(i % 40 + 1); ll = [c[0] + r * Math.sin(a), c[1] + r * Math.cos(a)]; }
      const t = mx > mn ? (p[k] - mn) / (mx - mn) : 0.5, cor = `hsl(${Math.round(130 - 130 * t)},70%,45%)`;
      L.circleMarker(ll, { radius: 7, color: '#0006', weight: 1, fillColor: cor, fillOpacity: 0.9 }).bindPopup(`<b>${esc(p.n || p.r)}</b><br>${esc(p.b)}<br>${esc(p.e)}<br>${esc(cap(p.m))}/${p.u}<br><b>${PN[k]}: ${brl(p[k])}</b>${PRODS.filter(o => o !== k && p[o]).map(o => '<br>' + PS[o] + ': ' + brl(p[o])).join('')}${aprox ? '<br><small>posição aproximada (centro da cidade)</small>' : ''}`).addTo(camada); b.push(ll);
    });
    if (b.length) mapa.fitBounds(b, { padding: [20, 20], maxZoom: 14 }); else mapa.setView([-14.5, -51], 4);
  }
  window.temaMapaComb = () => { if (tiles) tiles.setUrl(tileUrl()); };

  function calc() {
    const ref = q('#ccRef').value, pr = q('#ccPreco');
    if (ref !== 'man' && R) { const cp = q('#ccProd').value, s = ref === 'br' ? R.br[cp] : R.uf[ref] && R.uf[ref][cp]; pr.value = s ? nf(s.media, 2) : ''; pr.readOnly = true; } else pr.readOnly = false;
    const km = pn(q('#ccKm').value) * (+q('#ccIv').value), cons = pn(q('#ccCons').value), preco = pn(pr.value), arla = /^s(10|500)$/.test(q('#ccProd').value) ? pn(q('#ccArla').value) / 100 : 0, arlaP = pn(q('#ccArlaP').value);
    if (!(km > 0 && cons > 0 && preco > 0)) { q('#ccOut').innerHTML = '<p class="mut">Preencha distância, consumo e preço.</p>'; return; }
    const lt = km / cons, cd = lt * preco, la = lt * arla, ca = la * arlaP;
    q('#ccOut').innerHTML = `<div class="kv"><span>${PN[q('#ccProd').value]}</span><b>${nf(lt, 0)} ${UN(q('#ccProd').value)} · ${brl(cd)}</b></div>${arla ? `<div class="kv"><span>ARLA 32</span><b>${nf(la, 0)} L · ${brl(ca)}</b></div>` : ''}<div class="kv cbtot"><span>Total</span><b>${brl(cd + ca)}</b></div><div class="kv"><span>Custo por km</span><b>${brl((cd + ca) / km, 3)}</b></div><small class="mut">${nf(km, 0)} km${ref !== 'man' ? ' · ' + PN[q('#ccProd').value] + ', preço médio ' + (ref === 'br' ? 'Brasil' : ref) + ' na semana de ' + dt(R.semana.inicio) : ''}</small>`;
  }


  /* ---------- mercado: dólar, Brent e Petrobras ---------- */
  let M = null;
  async function mercado(forcar) {
    try { M = await api(forcar ? 'mercado/atualizar' : 'mercado', forcar ? { method: 'POST' } : undefined); q('#cbMerc').hidden = false; desenhaMercado(); }
    catch (e) { if (e.semServidor) q('#cbMerc').hidden = true; }
  }
  const pct = v => v == null ? '' : `<span class="${v > 0 ? 'bad' : v < 0 ? 'ok' : 'mut'}">${v > 0 ? '▲' : v < 0 ? '▼' : ''} ${nf(Math.abs(v), 1)}%</span>`;
  function petroEm(d) { let r = null; for (const x of M.petrobras) { if (x.data > d) break; r = x; } return r; }
  function desenhaMercado() {
    const d = M.dolar, b = M.brent, pb = M.petrobras[M.petrobras.length - 1], pbAnt = M.petrobras[M.petrobras.length - 2];
    q('#cbMercEm').textContent = M.em ? 'atualizado ' + new Date(M.em).toLocaleString('pt-BR') : 'ainda não atualizado';
    q('#cbAlertas').innerHTML = M.alertas.map(a => `<div class="cbalerta ${a.tipo}">${a.tipo === 'alta' ? '⚠️' : 'ℹ️'} ${esc(a.tx)}</div>`).join('') + Object.values(M.erros || {}).map(e => `<div class="cbalerta alta">Fonte indisponível agora — ${esc(e)}. O servidor tenta de novo em 6 h.</div>`).join('');
    q('#cbMercCards').innerHTML =
      `<div class="card cbcard"><span class="mut">Dólar (PTAX venda)</span><b>${d.atual ? brl(d.atual.v, 4) : '—'}</b><small>${pct(d.var7)} <span class="mut">7 dias</span> · ${pct(d.var30)} <span class="mut">30 dias</span></small><small class="mut">${d.atual ? 'Banco Central · ' + dt(d.atual.d) : ''}</small></div>` +
      `<div class="card cbcard"><span class="mut">Petróleo Brent</span><b>${b.atual ? 'US$ ' + nf(b.atual.v, 2) : '—'}<small>/barril</small></b><small>${pct(b.var7)} <span class="mut">7 dias</span> · ${pct(b.var30)} <span class="mut">30 dias</span></small><small class="mut">${b.atual ? 'EIA/FRED · ' + dt(b.atual.d) : ''}</small></div>` +
      `<div class="card cbcard"><span class="mut">Brent em reais</span><b>${b.emReais ? brl(b.emReais) : '—'}<small>/barril</small></b><small class="mut">${b.porLitroRs ? '= ' + brl(b.porLitroRs) + ' por litro de petróleo cru' : ''}</small><small class="mut">dólar do mesmo dia</small></div>` +
      `<div class="card cbcard"><span class="mut">Petrobras · diesel A às distribuidoras</span><b>${pb ? brl(pb.preco) : '—'}<small>/L</small></b><small>${pb && pbAnt ? varTx(pb.preco, pbAnt.preco) + ' <span class="mut">no último anúncio</span>' : ''}</small><small class="mut">${pb ? 'desde ' + dt(pb.data) + ' · sem impostos' : 'cadastre o preço abaixo'}</small><small class="mut">${pb ? (pb.origem === 'manual' ? '✍️ cadastro manual' : '🤖 comunicado oficial') : ''}${M.petroAuto && M.petroAuto.ppi ? ` · defasagem PPI <b class="${M.petroAuto.ppi.defasagem > 0 ? 'bad' : 'ok'}">${M.petroAuto.ppi.defasagem > 0 ? '+' : ''}${nf(M.petroAuto.ppi.defasagem, 1)}%</b>` : ''}</small><button type="button" class="cbauto cbmanualbt" id="cbPetroIr">${M.petroAuto && M.petroAuto.pendentes.length ? '⚠️ ' + M.petroAuto.pendentes.length + ' para confirmar' : '🤖 Automático — detalhes'}</button></div>`;
    composicao(); grafMercado(); listaPetro(); petroAuto();
    q('#cbPetroIr').onclick = () => { const d = q('#cbPetroBox'); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => q('#cbPetroD').focus(), 400); };
  }
  function composicao() {
    const pb = M.petrobras[M.petrobras.length - 1], bomba = R && R.br.s10 && R.br.s10.media;
    if (!pb || !bomba) { q('#cbComp').innerHTML = '<p class="mut">Precisa do preço da Petrobras e da média semanal da ANP.</p>'; return; }
    const parte = pb.preco * 0.85, resto = bomba - parte, p1 = parte / bomba * 100;
    q('#cbComp').innerHTML = `<div class="cbcomp" role="img" aria-label="Petrobras ${nf(p1, 0)}% do preço na bomba"><span class="pb" style="width:${p1}%">Petrobras ${nf(p1, 0)}%</span><span class="resto" style="width:${100 - p1}%">Resto ${nf(100 - p1, 0)}%</span></div>
      <div class="kv"><span>Preço médio na bomba (ANP, semana de ${dt(R.semana.inicio)})</span><b>${brl(bomba)}</b></div>
      <div class="kv"><span>Parcela da Petrobras <small class="mut">(diesel A ≈ 85% do diesel B)</small></span><b>${brl(parte)}</b></div>
      <div class="kv"><span>Resto: biodiesel, impostos, frete, margens da distribuidora e do posto</span><b>${brl(resto)}</b></div>
      <small class="mut">Estimativa. O percentual de diesel A segue a mistura obrigatória de biodiesel (a Petrobras informou parcela de R$ 3,10 para diesel A de R$ 3,65 em março/2026).</small>`;
  }
  function grafMercado() {
    const dias = +q('#cbMercPer').value, fim = [M.dolar.atual && M.dolar.atual.d, M.brent.atual && M.brent.atual.d, R && R.semana.fim].filter(Boolean).sort().pop();
    const el = q('#cbMercGraf'); if (!fim) { el.innerHTML = '<p class="mut">Sem dados de mercado ainda.</p>'; return; }
    const ini = new Date(Date.parse(fim) - dias * 864e5).toISOString().slice(0, 10), t = d => Date.parse(d);
    const corta = l => l.filter(x => x.d >= ini && x.d <= fim);
    const pbS = M.petrobras.length ? [{ d: ini, v: (petroEm(ini) || M.petrobras[0]).preco }, ...M.petrobras.filter(x => x.data > ini && x.data <= fim).flatMap(x => { const a = petroEm(new Date(Date.parse(x.data) - 864e5).toISOString().slice(0, 10)); return [...(a ? [{ d: x.data, v: a.preco }] : []), { d: x.data, v: x.preco }]; }), { d: fim, v: (petroEm(fim) || M.petrobras[0]).preco }] : [];
    const series = [['dol', 'Dólar', corta(M.dolar.serie)], ['brr', 'Brent em R$', corta(M.brent.serieRs)], ['pb', 'Petrobras diesel A', pbS.filter(x => x.d >= ini)], ['s10', 'Bomba S-10 (ANP)', R ? R.historico.map(h => ({ d: h.fim, v: h.s10 })).filter(x => x.v && x.d >= ini) : []]]
      .map(([k, n, l]) => [k, n, l.length ? l.map(x => ({ d: x.d, v: x.v / l[0].v * 100 })) : []]).filter(s => s[2].length >= 2);
    if (!series.length) { el.innerHTML = '<p class="mut">Ainda não há pontos suficientes neste período.</p>'; return; }
    const W = 640, H = 220, P = { l: 40, r: 12, t: 12, b: 28 }, all = series.flatMap(s => s[2].map(x => x.v));
    let mn = Math.min(...all), mx = Math.max(...all); const pad = Math.max((mx - mn) * 0.1, 1); mn -= pad; mx += pad;
    const X = d => P.l + (t(d) - t(ini)) / (t(fim) - t(ini)) * (W - P.l - P.r), Y = v => P.t + (1 - (v - mn) / (mx - mn)) * (H - P.t - P.b);
    const ticks = [0, 1, 2, 3].map(i => mn + (mx - mn) * i / 3), meses = []; for (let i = 0; i <= 4; i++) meses.push(new Date(t(ini) + (t(fim) - t(ini)) * i / 4).toISOString().slice(0, 10));
    const ult = s => s[2][s[2].length - 1].v;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Variação no período: ${series.map(s => s[1] + ' ' + nf(ult(s) - 100, 1) + '%').join('; ')}">
      ${ticks.map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="cbgl"/><text x="${P.l - 5}" y="${Y(v) + 4}" text-anchor="end" class="cbtx">${nf(v, 0)}</text>`).join('')}
      <line x1="${P.l}" x2="${W - P.r}" y1="${Y(100)}" y2="${Y(100)}" class="cbgl" stroke-dasharray="4 3"/>
      ${meses.map(m => `<text x="${X(m)}" y="${H - 8}" text-anchor="middle" class="cbtx">${dt(m).slice(0, 5)}</text>`).join('')}
      ${series.map(([k, n, l]) => `<path d="M${l.map(x => X(x.d).toFixed(1) + ',' + Y(x.v).toFixed(1)).join('L')}" class="cbl ${k}"${k === 'pb' ? ' stroke-linejoin="miter"' : ''}><title>${n}: ${nf(ult([k, n, l]) - 100, 1)}% no período</title></path>`).join('')}</svg>
      <div class="cbleg">${series.map(s => `<span><i class="${s[0]}"></i>${s[1]} <b class="${ult(s) > 100 ? 'bad' : 'ok'}">${ult(s) >= 100 ? '+' : ''}${nf(ult(s) - 100, 1)}%</b></span>`).join('')}</div>`;
  }
  function petroAuto() {
    const A = M.petroAuto || { fontes: {}, pendentes: [] }, F = A.fontes || {};
    const lin = (n, f, ex) => `<li><span class="cbdot ${!f ? 'mut' : f.ok ? 'ok' : 'bad'}"></span><b>${n}</b> — ${!f ? 'ainda não verificado' : f.ok ? 'ok em ' + new Date(f.em).toLocaleString('pt-BR') + (f.info ? ' · ' + esc(f.info) : '') : '<span class="bad">falhou: ' + esc(f.erro) + '</span>' + (f.em ? ' <span class="mut">(último sucesso ' + new Date(f.em).toLocaleString('pt-BR') + ')</span>' : '')}${ex || ''}</li>`;
    q('#cbFontes').innerHTML = `<ul class="cbfontl">${lin('Comunicados Petrobras (diário)', F.agencia)}${lin('Síntese ANP (semanal)', F.sintese, A.sintese && A.sintese.realizacao ? ` · refinarias <b>${brl(A.sintese.realizacao.preco)}</b>${A.ppi ? ' · PPI <b>' + brl(A.ppi.ppi) + '</b>' : ''} ${A.sintese.url ? `<a href="${esc(A.sintese.url)}" target="_blank" rel="noopener">PDF</a>` : ''}` : '')}</ul>`;
    q('#cbPetroPend').innerHTML = A.pendentes.map(p => `<div class="cbalerta alta"><b>⚠️ Novo preço da Petrobras para confirmar:</b> ${brl(p.preco)} a partir de ${dt(p.data)} — <a href="${esc(p.link)}" target="_blank" rel="noopener">ver comunicado</a><br><small>Por que não entrou sozinho: ${p.motivos.map(esc).join('; ')}.</small>${p.trecho ? `<br><small class="mut">“…${esc(p.trecho.slice(0, 220))}…”</small>` : ''}<div class="cbacoes" style="margin-top:6px"><button class="btn sm pri" type="button" data-pend="${p.id}" data-ok="1">✔ Confirmar</button><button class="btn sm" type="button" data-pend="${p.id}" data-ok="0">✖ Descartar</button></div></div>`).join('');
  }
  function listaPetro() {
    q('#cbPetroL').innerHTML = M.petrobras.length ? `<div class="tbl-wrap"><table class="tbl cbcardtab"><thead><tr><th>Desde</th><th>Diesel A</th><th>Origem</th><th></th></tr></thead><tbody>${M.petrobras.slice().reverse().map(x => `<tr><td data-l="Desde">${dt(x.data)}</td><td data-l="Diesel A"><b>${brl(x.preco)}</b></td><td class="mut" data-l="Origem">${x.origem === 'manual' ? '✍️' : '🤖'} ${esc(x.obs)}${x.link ? ` <a href="${esc(x.link)}" target="_blank" rel="noopener">fonte</a>` : ''}</td><td><button class="btn sm" type="button" data-pdel="${x.data}" aria-label="Excluir preço de ${dt(x.data)}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : '';
  }
  function excel() {
    if (!lista.length || typeof NXLSX !== 'object') return;
    const k = q('#cbProd').value;
    NXLSX.download(`combustivel-${PS[k]}-${q('#cbUf').value || 'BR'}-${R.semana.inicio}.xlsx`, 'Postos ' + PS[k], [{ titulo: 'Posto', largura: 32 }, { titulo: 'Razão social', largura: 34 }, { titulo: 'CNPJ', largura: 16 }, { titulo: 'Bandeira', largura: 14 }, { titulo: 'Endereço', largura: 40 }, { titulo: 'Cidade', largura: 20 }, { titulo: 'UF', largura: 5 }, ...PRODS.map(o => ({ titulo: PN[o], largura: 12, tipo: 'moeda' })), { titulo: 'Variação semana (' + PS[k] + ')', largura: 14, tipo: 'moeda' }, { titulo: 'Data da coleta', largura: 13 }],
      lista.map(p => [p.n, p.r, p.c, p.b, p.e, cap(p.m), p.u, ...PRODS.map(o => p[o] ?? ''), p.var ?? '', dt(p.d)]));
  }
  async function atualizar(bt) {
    bt.disabled = true; const t = bt.textContent; bt.textContent = 'Consultando a ANP…';
    try { const s = await api('atualizar', { method: 'POST' }); (window.toast || alert)(s.erro ? 'ANP: ' + s.erro : s.novas && s.novas.length ? `${s.novas.length} semana(s) nova(s) baixada(s).` : 'Já está com a semana mais recente da ANP.', !!s.erro); }
    catch (e) { (window.toast || alert)(e.message, true); }
    bt.disabled = false; bt.textContent = t; await status(); await carregar();
  }
  async function importar(inp) {
    const f = inp.files[0]; inp.value = ''; if (!f) return;
    try { const r = await api('importar?nome=' + encodeURIComponent(f.name), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: f }); (window.toast || alert)(`Importado: semana ${dt(r.inicio)} a ${dt(r.fim)}, ${r.postos} postos com diesel.`); }
    catch (e) { (window.toast || alert)(e.message, true); }
    await status(); await carregar();
  }

  function aplicaGrupo() {
    document.querySelectorAll('.cbabas [data-grupo]').forEach(b => { const on = b.dataset.grupo === grupo; b.setAttribute('aria-selected', on); b.classList.toggle('on', on); b.tabIndex = on ? 0 : -1; });
    for (const id of ['#cbUfProd', '#cbProd', '#ccProd']) { const sel = q(id), v = sel.value; sel.innerHTML = GP().map(k => `<option value="${k}">${PN[k]}</option>`).join(''); if (GP().includes(v)) sel.value = v; sel.closest('label') && (sel.closest('label').style.display = GP().length < 2 ? 'none' : ''); }
    q('#cbUfProd').style.display = GP().length < 2 ? 'none' : '';
    q('#cbMerc').classList.toggle('cbfora', grupo !== 'diesel');
    document.querySelectorAll('#v-combustivel .cbarla').forEach(l => l.style.display = grupo !== 'diesel' ? 'none' : '');
    q('#ccCons').closest('label').firstChild.textContent = grupo === 'gnv' ? 'Consumo (km/m³)' : 'Consumo (km/L)';
    if (grupo !== 'diesel' && q('#ccCons').value === '2,8') q('#ccCons').value = grupo === 'gnv' ? '13' : grupo === 'etanol' ? '8' : '11';
    if (grupo === 'diesel' && /^(13|8|11)$/.test(q('#ccCons').value)) q('#ccCons').value = '2,8';
    if (R) desenhar();
  }
  function ligar() {
    q('.cbabas').onclick = e => { const b = e.target.closest('[data-grupo]'); if (!b) return; grupo = b.dataset.grupo; if (window.LS) LS.set('combGrupo', grupo); aplicaGrupo(); };
    q('.cbabas').onkeydown = e => { if (!/Arrow(Left|Right)/.test(e.key)) return; const bs = [...document.querySelectorAll('.cbabas [data-grupo]')], i = bs.findIndex(b => b.dataset.grupo === grupo), n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click(); };
    q('#cbAtualizar').onclick = e => atualizar(e.currentTarget); q('#cbAtualizar2').onclick = e => atualizar(e.currentTarget);
    q('#cbArq').onchange = e => importar(e.target); q('#cbArq2').onchange = e => importar(e.target);
    q('#cbHistUf').onchange = hist; q('#cbUfProd').onchange = ufs;
    q('#cbUf').onchange = muns; ['#cbMun', '#cbOrdem'].forEach(s => q(s).onchange = postos); q('#cbProd').onchange = () => { postos(); };
    q('#cbBusca').oninput = () => { clearTimeout(tBusca); tBusca = setTimeout(postos, 300); };
    q('#cbFiltro').onsubmit = e => { e.preventDefault(); postos(); };
    q('#cbMapaBt').onclick = e => { const m = q('#cbMapa'); m.hidden = !m.hidden; e.currentTarget.setAttribute('aria-pressed', !m.hidden); if (!m.hidden) desenhaMapa(); };
    q('#cbExcel').onclick = excel;
    q('#cbMercAt').onclick = async e => { const bt = e.currentTarget; bt.disabled = true; await mercado(true); bt.disabled = false; };
    q('#cbMercPer').onchange = () => M && grafMercado();
    q('#cbPetroF').onsubmit = async e => { e.preventDefault(); try { M = await api('petrobras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: q('#cbPetroD').value, preco: q('#cbPetroP').value, obs: q('#cbPetroO').value }) }); desenhaMercado(); e.target.reset(); toast('Preço da Petrobras salvo.'); } catch (er) { toast(er.message, true); } };
    q('#cbPetroVer').onclick = async e => { const bt = e.currentTarget; bt.disabled = true; bt.textContent = 'Verificando…'; try { M = await api('petrobras/verificar', { method: 'POST' }); desenhaMercado(); toast('Comunicados e síntese verificados.'); } catch (er) { toast(er.message, true); } bt.disabled = false; bt.textContent = '🔎 Verificar comunicados agora'; };
    q('#cbPetroPend').onclick = async e => { const b = e.target.closest('[data-pend]'); if (!b) return; try { M = await api('petrobras/pendente/' + b.dataset.pend, { method: b.dataset.ok === '1' ? 'POST' : 'DELETE' }); desenhaMercado(); toast(b.dataset.ok === '1' ? 'Preço confirmado.' : 'Descartado.'); } catch (er) { toast(er.message, true); } };
    q('#cbPetroL').onclick = async e => { const b = e.target.closest('[data-pdel]'); if (!b) return; if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Confirmar'; return; } M = await api('petrobras/' + b.dataset.pdel, { method: 'DELETE' }); desenhaMercado(); };
    q('#cbUfs').onclick = e => { const b = e.target.closest('[data-uf]'); if (!b) return; q('#cbUf').value = b.dataset.uf; q('#cbHistUf').value = b.dataset.uf; hist(); muns(); q('#cbFiltro').scrollIntoView({ behavior: 'smooth' }); };
    document.addEventListener('click', e => { const b = e.target.closest('#v-combustivel [data-cid]'); if (!b) return; const [u, m] = b.dataset.cid.split('|'); q('#cbUf').value = u; muns().then(() => { q('#cbMun').value = m; postos(); q('#cbFiltro').scrollIntoView({ behavior: 'smooth' }); }); });
    q('#cbCalc').oninput = calc; q('#cbCalc').onchange = calc; q('#cbCalc').onsubmit = e => e.preventDefault();
    q('#ccRota').onclick = () => { const km = typeof RT === 'object' && RT.km ? RT.km() : null; if (km) { q('#ccKm').value = nf(km, 0).replace(/\./g, ''); calc(); } else (window.toast || alert)('Nenhuma rota calculada ainda — monte uma em Roteirização.', true); };
  }
  async function open() {
    if (!iniciado) { iniciado = true; ligar(); aplicaGrupo(); }
    const s = await status(); if (temServidor !== false) { await carregar(); await mercado(); } else q('#cbMerc').hidden = true;
    if (s && !s.ultima && s.atualizando === false && !s.verificadoEm) atualizar(q('#cbAtualizar2'));
  }
  return { open };
})();
/* aberto direto pelo link (#combustivel) antes deste script carregar */
if (document.querySelector('#v-combustivel.on')) COMB.open();
