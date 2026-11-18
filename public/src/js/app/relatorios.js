/* NEXORA — Relatórios: fretes por mês, R$/km × diesel, destinos, transportadoras/clientes e entregas do motorista */
const RELAT = (function () {
  'use strict';
  const q = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  let regs = [], diesel = [], vg = [], lig = false;
  async function getJ(u) { const r = await fetch(u); if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('x'); return r.json(); }
  async function carregar() {
    const fonte = q('#rlFonte').value;
    try { regs = (await getJ('/api/' + fonte)).fretes; } catch (e) { regs = LS.get(fonte, []); }
    try { const r = await getJ('/api/combustivel/resumo'); diesel = r.historico.map(h => ({ d: h.fim, v: h.s10 })).filter(x => x.v); } catch (e) { diesel = []; }
    try { vg = await getJ('/api/viagens'); } catch (e) { vg = []; }
    desenhar();
  }
  const valor = f => q('#rlFonte').value === 'fretes' ? (typeof empTotals === 'function' ? empTotals(f).total : +f.valor || 0) : (+f.frete || 0) + (+f.pedagio || 0);
  const quem = f => q('#rlFonte').value === 'fretes' ? f.transportadora : f.cliente;
  const destino = f => { const d = String(f.destinos || '').split('→').pop().trim(); return d.replace(/^.*—\s*/, '') || '—'; };
  function filtrados() { const n = +q('#rlPer').value, lim = n ? new Date(new Date().getFullYear(), new Date().getMonth() - n + 1, 1).toISOString().slice(0, 10) : ''; return regs.filter(f => { const d = String(f.data || f.criado || '').slice(0, 10); return d && (!lim || d >= lim); }); }
  function barras(el, itens, fmtV) {
    if (!itens.length) { el.innerHTML = '<p class="mut">Sem registros no período.</p>'; return; }
    const W = 640, H = 200, P = { l: 8, r: 8, t: 16, b: 28 }, mx = Math.max(...itens.map(i => i.v)) || 1, bw = (W - P.l - P.r) / itens.length;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(itens.map(i => i.k + ': ' + fmtV(i.v)).join('; '))}">${itens.map((it, i) => { const h = (H - P.t - P.b) * it.v / mx, x = P.l + i * bw + bw * 0.15; return `<rect x="${x}" y="${H - P.b - h}" width="${bw * 0.7}" height="${h}" rx="3" class="rlbar"><title>${esc(it.k)}: ${fmtV(it.v)}</title></rect><text x="${x + bw * 0.35}" y="${H - 10}" text-anchor="middle" class="cbtx">${esc(it.k)}</text>${itens.length <= 12 ? `<text x="${x + bw * 0.35}" y="${H - P.b - h - 4}" text-anchor="middle" class="cbtx">${fmtV(it.v, true)}</text>` : ''}`; }).join('')}</svg>`;
  }
  function linhas(el, A, B) {
    const pts = [...A, ...B]; if (A.length < 2 && B.length < 2) { el.innerHTML = '<p class="mut">Poucos dados no período (precisa de 2 meses ou mais com km informado).</p>'; return; }
    const ks = [...new Set(pts.map(p => p.k))].sort(), W = 640, H = 200, P = { l: 10, r: 10, t: 12, b: 28 }, X = k => P.l + ks.indexOf(k) * (W - P.l - P.r) / Math.max(1, ks.length - 1);
    const lin = (S, cls) => { if (S.length < 2) return ''; const b0 = S[0].v, ys = S.map(s => s.v / b0 * 100), mn = Math.min(...ys, 90), mxx = Math.max(...ys, 110); return `<path class="cbl ${cls}" d="M${S.map((s, i) => X(s.k).toFixed(1) + ',' + (P.t + (1 - (ys[i] - mn) / (mxx - mn)) * (H - P.t - P.b)).toFixed(1)).join('L')}"/>`; };
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do custo por km e do diesel, base 100 no primeiro mês">${ks.map(k => `<text x="${X(k)}" y="${H - 10}" text-anchor="middle" class="cbtx">${k}</text>`).join('')}${lin(A, 'rlkm')}${lin(B, 's10')}</svg><div class="cbleg"><span><i class="rlkm"></i>R$/km dos fretes</span><span><i class="s10"></i>Diesel S-10 (ANP)</span><span class="mut">índice: primeiro mês = 100</span></div>`;
  }
  const lista = (el, m, rot) => { const l = Object.entries(m).sort((a, b) => b[1].n - a[1].n).slice(0, 8); el.innerHTML = l.length ? `<ol class="cbrank">${l.map(([k, x]) => `<li><span>${esc(k)}</span><b>${x.n}×</b><small class="mut">${brl(x.v)}${x.km ? ' · ' + brl(x.v / x.km).replace('R$', 'R$') + '/km' : ''}</small></li>`).join('')}</ol>` : `<p class="mut">Sem ${rot} no período.</p>`; };
  function desenhar() {
    const F = filtrados(), tot = F.reduce((a, f) => a + valor(f), 0), comKm = F.filter(f => f.km > 0), km = comKm.reduce((a, f) => a + f.km, 0), vKm = comKm.reduce((a, f) => a + valor(f), 0), comPiso = F.filter(f => f.piso > 0), acima = comPiso.filter(f => valor(f) + 0.005 >= f.piso).length, kg = F.filter(f => f.pesoKg > 0);
    q('#rlKpis').innerHTML = `<div class="card cbcard"><span class="mut">Total de frete</span><b>${brl(tot)}</b><small class="mut">${F.length} registro(s)</small></div><div class="card cbcard"><span class="mut">Custo médio por km</span><b>${km ? brl(vKm / km) : '—'}</b><small class="mut">${fmt(km, 0)} km com distância informada</small></div><div class="card cbcard"><span class="mut">Frete por tonelada</span><b>${kg.length ? brl(kg.reduce((a, f) => a + valor(f), 0) / (kg.reduce((a, f) => a + f.pesoKg, 0) / 1000)) : '—'}</b><small class="mut">${kg.length} registro(s) com peso</small></div><div class="card cbcard"><span class="mut">Acima do piso ANTT</span><b class="${comPiso.length && acima < comPiso.length ? 'bad' : 'ok'}">${comPiso.length ? Math.round(acima / comPiso.length * 100) + '%' : '—'}</b><small class="mut">${comPiso.length ? `${comPiso.length - acima} abaixo do piso` : 'sem piso nos registros'}</small></div>`;
    const pm = {}; for (const f of F) { const d = String(f.data || f.criado).slice(0, 7); (pm[d] ||= { v: 0, km: 0, vk: 0 }).v += valor(f); if (f.km > 0) { pm[d].km += f.km; pm[d].vk += valor(f); } }
    const meses = Object.keys(pm).sort(), rot = m => MES[+m.slice(5) - 1] + '/' + m.slice(2, 4);
    barras(q('#rlMes'), meses.map(m => ({ k: rot(m), v: pm[m].v })), (v, curto) => curto ? (v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)) : brl(v));
    const dm = {}; for (const x of diesel) { const k = x.d.slice(0, 7); (dm[k] ||= []).push(x.v); }
    linhas(q('#rlKm'), meses.filter(m => pm[m].km > 0).map(m => ({ k: rot(m), v: pm[m].vk / pm[m].km })), meses.filter(m => dm[m]).map(m => ({ k: rot(m), v: dm[m].reduce((a, b) => a + b, 0) / dm[m].length })));
    const md = {}, mq = {}; for (const f of F) { const d = destino(f), w = quem(f) || '—'; for (const [mm, k] of [[md, d], [mq, w]]) { const x = mm[k] ||= { n: 0, v: 0, km: 0 }; x.n++; x.v += valor(f); if (f.km > 0) x.km += f.km; } }
    q('#rlQuemT').textContent = q('#rlFonte').value === 'fretes' ? 'Transportadoras mais usadas' : 'Clientes que mais contratam';
    lista(q('#rlDest'), md, 'destinos'); lista(q('#rlQuem'), mq, q('#rlFonte').value === 'fretes' ? 'transportadoras' : 'clientes');
    const ps = vg.flatMap(v => v.paradas), ent = ps.filter(p => p.status === 'entregue').length, pb = ps.filter(p => p.status === 'problema').length, ft = ps.filter(p => p.foto).length;
    q('#rlVg').innerHTML = vg.length ? `<div class="cbcards" style="margin:0"><div class="card cbcard"><span class="mut">Viagens</span><b>${vg.length}</b></div><div class="card cbcard"><span class="mut">Entregas concluídas</span><b class="ok">${ent}</b><small class="mut">de ${ps.length}</small></div><div class="card cbcard"><span class="mut">Com problema</span><b class="${pb ? 'bad' : ''}">${pb}</b></div><div class="card cbcard"><span class="mut">Com foto do canhoto</span><b>${ft}</b></div></div>` : '<p class="mut">Nenhuma viagem com link do motorista ainda (Roteirização → Concluir).</p>';
  }
  function excel() {
    const F = filtrados(); if (!F.length || typeof NXLSX !== 'object') return toast('Sem registros no período.', true);
    NXLSX.download(`relatorio-${q('#rlFonte').value}.xlsx`, 'Relatório', [{ titulo: 'Data', largura: 12 }, { titulo: q('#rlFonte').value === 'fretes' ? 'Transportadora' : 'Cliente', largura: 26 }, { titulo: 'Origem', largura: 22 }, { titulo: 'Destino final', largura: 24 }, { titulo: 'Km', largura: 8, tipo: 'numero' }, { titulo: 'Valor', largura: 14, tipo: 'moeda' }, { titulo: 'R$/km', largura: 10, tipo: 'moeda' }, { titulo: 'Piso ANTT', largura: 12, tipo: 'moeda' }],
      F.map(f => [String(f.data || f.criado).slice(0, 10).split('-').reverse().join('/'), quem(f) || '', f.origem || '', destino(f), f.km || '', valor(f), f.km > 0 ? valor(f) / f.km : '', f.piso || '']));
  }
  return { open() { if (!lig) { lig = true; q('#rlFonte').onchange = carregar; q('#rlPer').onchange = desenhar; q('#rlExcel').onclick = excel; } carregar(); } };
})();
if (document.querySelector('#v-relatorios.on')) RELAT.open();
