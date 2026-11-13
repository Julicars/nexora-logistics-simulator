/* NEXORA — Consulta de empresas: busca por CNPJ ou nome, ficha simples/completa e diagrama de vínculos por sócios.
 * Com o servidor (npm start) as consultas passam por /api/empresas (cache e limites de uso).
 * Sem o servidor, o navegador consulta as APIs públicas direto (CNPJ); busca por nome e rede completa precisam do servidor.
 */
const EMPRESAS = (function () {
  'use strict';
  const E = window.NX_EMP, q = s => document.querySelector(s);
  let server = null, ultimo = null;
  const dt = d => { if (!d) return '—'; const x = new Date(String(d).slice(0, 10) + 'T12:00:00'); return isNaN(x) ? esc(d) : x.toLocaleDateString('pt-BR'); };
  const yes = v => v === true ? 'Sim' : v === false ? 'Não' : '—';
  const sitCls = s => /ATIVA/i.test(s || '') ? 'ok' : s ? 'bad' : 'mut';

  /* ---------- acesso às APIs ---------- */
  async function api(path, opt) {
    if (server !== false) {
      try { const r = await fetch('/api/empresas' + path, { ...opt, headers: { 'Content-Type': 'application/json' } }); const ct = r.headers.get('content-type') || '';
        if (ct.includes('json')) { server = true; const b = await r.json(); if (!r.ok) { const e = new Error(b.erro || 'Erro ' + r.status); e.status = r.status; throw e; } return b; }
        server = false; } catch (e) { if (server === true || e.status) throw e; server = false; }
    }
    return direto(path, opt);
  }
  const previaClaude = () => { try { return window.top !== window && /claude|anthropic/i.test(document.referrer + location.hostname + (document.location.ancestorOrigins ? [...document.location.ancestorOrigins].join() : '')); } catch (e) { return true; } };
  async function getJ(url) { const r = await fetch(url, { headers: { Accept: 'application/json' } }); if (r.status === 404 || r.status === 400) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  async function direto(path, opt) {
    q('#eMode').hidden = false; q('#eMode').textContent = 'Usando pela web: o navegador consulta direto as APIs públicas. Se alguma fonte bloquear o acesso pelo navegador, a tela avisa — aí use o CNPJ ou rode o NEXORA no computador (npm start).';
    if (path === '/busca') return buscaDireta(JSON.parse(opt.body));
    const m = path.match(/^\/(cnpj|completa|rede)\/(\d{14})(?:\?uf=(\w+))?/);
    if (!m) { const e = new Error('Consulta não disponível.'); e.status = 400; throw e; }
    let d = null, falhas = [];
    for (const [n, u] of [['BrasilAPI', `https://brasilapi.com.br/api/cnpj/v1/${m[2]}`], ['minhareceita.org', `https://minhareceita.org/${m[2]}`], ['OpenCNPJ', `https://api.opencnpj.org/${m[2]}`], ['CNPJ.ws', `https://publica.cnpj.ws/cnpj/${m[2]}`]]) {
      try { const j = await getJ(u); if (j) { d = E.normalizar(j, n); break; } } catch (e) { falhas.push(n); }
    }
    if (!d) { const e = new Error(falhas.length === 4 ? (previaClaude() ? 'Você está na prévia do Claude, que bloqueia o acesso a sites externos: nenhuma API de CNPJ funciona aqui. Para consultar empresas, abra o NEXORA publicado num site (GitHub Pages, Netlify ou Vercel — veja “Publicar na web” no README) ou rode no computador com npm start.' : 'Não foi possível acessar as APIs públicas agora. Confira a internet e tente de novo em instantes.') : 'CNPJ não encontrado na base da Receita.'); e.status = falhas.length === 4 ? 502 : 404; throw e; }
    if (m[1] === 'cnpj') return { empresa: d, alertas: E.alertas(d) };
    if (m[1] === 'rede') return redeDireta(d, m[3]);
    let extra = { aviso: 'Fontes extras indisponíveis agora.' };
    try { const w = await getJ(`https://publica.cnpj.ws/cnpj/${m[2]}`); if (w) { const n = E.normalizar(w, 'CNPJ.ws'); d.inscricoes = n.inscricoes; if (d.simples.optante == null) d.simples = n.simples; extra = { fonte: 'CNPJ.ws' }; } } catch (e) { /* segue */ }
    try { const x = await getJ(`https://open.cnpja.com/office/${m[2]}`); if (x) { const n = E.normalizar(x, 'CNPJá'); d.simples = { ...d.simples, ...Object.fromEntries(Object.entries(n.simples).filter(([, v]) => v != null)) }; if (!d.inscricoes.length) d.inscricoes = n.inscricoes; extra = { fonte: extra.fonte ? extra.fonte + ' + CNPJá' : 'CNPJá' }; } } catch (e) { /* segue sem */ }
    return { empresa: d, alertas: E.alertas(d), extra, sancoes: { semChave: true } };
  }
  /* uso pela web (sem servidor): busca por nome direto na Casa dos Dados */
  async function buscaDireta(b) {
    const nome = String(b.nome || '').trim(); if (nome.length < 3) throw Object.assign(new Error('Digite pelo menos 3 letras do nome.'), { status: 400 });
    const k = 'empBusca:' + nome.toUpperCase() + ':' + (b.uf || ''), c = cacheGet(k); if (c) return c;
    let r;
    try { r = await fetch('https://api.casadosdados.com.br/v5/public/cnpj/pesquisa', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ busca_textual: [{ texto: [nome], tipo_busca: 'radical', razao_social: true, nome_fantasia: true, nome_socio: false }], ...(b.uf ? { uf: [b.uf] } : {}), limite: 20, pagina: 1 }) }); }
    catch (e) { throw Object.assign(new Error('A busca por nome não está liberada para uso direto pelo navegador (a fonte bloqueia). Use o CNPJ, ou rode o NEXORA no computador (npm start) para buscar por nome.'), { status: 503 }); }
    if (!r.ok) throw Object.assign(new Error('Busca por nome indisponível agora (HTTP ' + r.status + '). Use o CNPJ.'), { status: 502 });
    const j = await r.json(); const arr = (function f(o, d) { if (d > 3 || !o || typeof o !== 'object') return null; if (Array.isArray(o) && o.length && o[0] && typeof o[0] === 'object' && 'cnpj' in o[0]) return o; for (const v of Object.values(o)) { const x = f(v, d + 1); if (x) return x; } return null; })(j, 0) || [];
    return cacheSet(k, { total: j.total || arr.length, lista: arr.slice(0, 20).map(x => ({ cnpj: E.dig(x.cnpj), razao: x.razao_social, fantasia: x.nome_fantasia || null, situacao: (x.situacao_cadastral && (x.situacao_cadastral.situacao_atual || x.situacao_cadastral)) || null, municipio: x.endereco && x.endereco.municipio, uf: x.endereco && x.endereco.uf })).filter(x => x.cnpj.length === 14), fonte: 'Casa dos Dados (base aberta da Receita)' });
  }
  /* uso pela web (sem servidor): rede direto na minhareceita.org; se bloquear, mostra só os sócios */
  async function redeDireta(d, ufSel) {
    const g = redeLocal(d), uf = ufSel === 'todas' ? '' : (d.endereco.uf || ''); g.avisos = []; g.ufBusca = uf || 'todas';
    const raiz = g.nodes[0].id; let bloqueado = false;
    for (const s of d.qsa.slice(0, 12)) {
      const doc = String(s.doc || '').replace(/[^0-9*]/g, ''); if (!/^\*{3}\d{6}\*{2}$/.test(doc) && !/^\d{14}$/.test(doc)) continue;
      const k = 'empSoc:' + doc + ':' + uf + ':' + s.nome; let lista = cacheGet(k);
      if (!lista) {
        try { const r = await fetch(`https://minhareceita.org/?cnpf=${encodeURIComponent(doc)}${uf ? '&uf=' + uf : ''}&limit=200`); if (!r.ok) { g.avisos.push(`${s.nome}: busca de vínculos indisponível (HTTP ${r.status}).`); continue; }
          const j = await r.json(), alvo = E.chaveSocio(s); lista = cacheSet(k, (j.data || []).map(x => E.normalizar(x, 'minhareceita.org')).filter(x => x && x.qsa.some(q => E.chaveSocio(q) === alvo)).map(x => ({ cnpj: x.cnpj, razao: x.razao, fantasia: x.fantasia, situacao: x.situacao, uf: x.endereco.uf, municipio: x.endereco.municipio, q: (x.qsa.find(q => E.chaveSocio(q) === alvo) || {}).qualificacao })));
        } catch (e) { bloqueado = true; break; }
      }
      const sid = E.chaveSocio(s);
      for (const x of lista.slice(0, 40)) { if (x.cnpj === d.cnpj) continue; const id = 'E' + x.cnpj; if (!g.nodes.some(n => n.id === id)) g.nodes.push({ id, tipo: 'empresa', label: x.fantasia || x.razao, razao: x.razao, cnpj: x.cnpj, situacao: x.situacao, uf: x.uf, municipio: x.municipio }); g.edges.push({ de: sid, para: id, rotulo: x.q || 'Sócio' }); }
    }
    if (bloqueado) g.avisos.push('Usando pela web: a fonte da rede de sócios bloqueou o acesso direto pelo navegador. Mostrando só os sócios. Para ver as outras empresas de cada sócio, rode o NEXORA no computador (npm start).');
    g.fonte = 'Quadro societário da base aberta da Receita Federal (minhareceita.org). Ligação por nome + CPF mascarado.'; void raiz; return g;
  }
  /* cache no navegador (uso pela web): 1 dia */
  function cacheGet(k) { try { const c = JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k) || 'null'); return c && Date.now() - c.t < 864e5 ? c.v : null; } catch (e) { return null; } }
  function cacheSet(k, v) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* cheio: segue sem cache */ } return v; }
  /* sem servidor: só o 1º nível (empresa + sócios) */
  function redeLocal(d) {
    const nodes = [{ id: 'E' + d.cnpj, tipo: 'empresa', label: d.fantasia || d.razao, razao: d.razao, cnpj: d.cnpj, situacao: d.situacao, uf: d.endereco.uf, raiz: true }], edges = [];
    for (const s of d.qsa.slice(0, 12)) { const id = E.chaveSocio(s); nodes.push({ id, tipo: s.tipo, label: s.nome, qualificacao: s.qualificacao, doc: s.doc, cnpj: s.tipo === 'PJ' ? E.dig(s.doc) : undefined }); edges.push({ de: id, para: nodes[0].id, rotulo: s.qualificacao || 'Sócio' }); }
    return { nodes, edges, avisos: ['Sem o servidor NEXORA: mostrando só os sócios. Para ver as outras empresas de cada sócio, rode o sistema com npm start.'], fonte: 'Quadro societário (base aberta da Receita Federal).' };
  }

  /* ---------- histórico ---------- */
  const hist = () => LS.get('empHist', []);
  function addHist(e) { const h = hist().filter(x => x.cnpj !== e.cnpj); h.unshift({ cnpj: e.cnpj, razao: e.razao, situacao: e.situacao, t: Date.now() }); LS.set('empHist', h.slice(0, 12)); renderHist(); }
  function renderHist() {
    const h = hist(); q('#eHistBox').hidden = !h.length;
    q('#eHist').innerHTML = h.map(x => `<button type="button" class="echip" data-cnpj="${x.cnpj}" data-modo="simples"><b>${esc(x.razao || '')}</b><span>${E.fmtCnpj(x.cnpj)} · <i class="${sitCls(x.situacao)}">${esc(x.situacao || '')}</i></span></button>`).join('') + (h.length ? '<button type="button" class="btn sm" id="eHistClr">Limpar</button>' : '');
    const c = q('#eHistClr'); if (c) c.onclick = () => { LS.set('empHist', []); renderHist(); };
  }

  /* ---------- fichas ---------- */
  const kv = (k, v) => `<div class="ekv"><span>${k}</span><b>${v == null || v === '' ? '—' : v}</b></div>`;
  function endereco(a) { return esc([a.logradouro, a.numero, a.complemento].filter(Boolean).join(', ') + (a.bairro ? ' — ' + a.bairro : '')) + '<br>' + esc([a.municipio, a.uf].filter(Boolean).join(' - ')) + (a.cep ? ' · CEP ' + a.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : ''); }
  function cabecalho(e, modo) {
    return `<div class="ehead"><div><h2>${esc(e.razao || '—')}</h2>${e.fantasia ? `<p class="mut">${esc(e.fantasia)}</p>` : ''}
      <p class="ecnpj"><b>${E.fmtCnpj(e.cnpj)}</b> <button type="button" class="btn sm" data-copy="${E.fmtCnpj(e.cnpj)}" aria-label="Copiar CNPJ">Copiar</button> <span class="epill ${sitCls(e.situacao)}">${esc(e.situacao || 'situação desconhecida')}</span>${e.matriz ? ` <span class="epill mut">${esc(e.matriz)}</span>` : ''}</p></div>
      <div class="eacts">${modo === 'simples' ? `<button type="button" class="btn pri" data-cnpj="${e.cnpj}" data-modo="completa">🧾 Ver consulta completa</button>` : `<button type="button" class="btn sm" id="eJson">Baixar JSON</button><button type="button" class="btn sm" id="ePrint">Imprimir</button>`}</div></div>`;
  }
  function alertasHtml(a) { return a.length ? `<ul class="ealert">${a.map(([c, t]) => `<li class="${c}">${c === 'bad' ? '⛔' : c === 'warn' ? '⚠' : c === 'ok' ? '✔' : 'ℹ'} ${esc(t)}</li>`).join('')}</ul>` : ''; }
  function basico(e) {
    return `<div class="egrid">${kv('Abertura', dt(e.abertura))}${kv('Situação desde', dt(e.dataSituacao) + (e.motivoSituacao && !/SEM MOTIVO/i.test(e.motivoSituacao) ? ' · ' + esc(e.motivoSituacao) : ''))}${kv('Natureza jurídica', esc(e.natureza))}${kv('Porte', esc(e.porte))}
      ${kv('Atividade principal', e.cnaePrincipal ? `${esc(e.cnaePrincipal.cod)} · ${esc(e.cnaePrincipal.desc || '')}` : '—')}${kv('Endereço', endereco(e.endereco))}
      ${kv('Telefone', e.telefones.map(E.fmtTel).map(esc).join('<br>'))}${kv('E-mail', esc(e.email ? e.email.toLowerCase() : ''))}
      ${kv('Simples Nacional', yes(e.simples.optante) + (e.simples.desde ? ' desde ' + dt(e.simples.desde) : ''))}${kv('MEI', yes(e.simples.mei))}</div>`;
  }
  function completo(r) {
    const e = r.empresa, s = r.sancoes || {};
    const qsa = e.qsa.length ? `<div class="tbl-wrap"><table class="tbl eqsa"><thead><tr><th>Nome</th><th>Tipo</th><th>Qualificação</th><th>Documento</th><th>Desde</th><th>Faixa etária</th></tr></thead><tbody>${e.qsa.map(x => `<tr><td><b>${esc(x.nome)}</b>${x.representante ? `<br><small class="mut">Representante: ${esc(x.representante)}</small>` : ''}</td><td>${x.tipo === 'PJ' ? 'Empresa' : x.tipo === 'EST' ? 'Estrangeiro' : 'Pessoa física'}</td><td>${esc(x.qualificacao || '—')}</td><td>${x.tipo === 'PJ' && E.dig(x.doc).length === 14 ? `<button type="button" class="lnk" data-cnpj="${E.dig(x.doc)}" data-modo="completa">${E.fmtCnpj(x.doc)}</button>` : esc(x.doc || '—')}</td><td>${dt(x.entrada)}</td><td>${esc(x.faixaEtaria || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">Quadro de sócios não informado na base pública.</p>';
    return `<div class="egrid">${kv('Capital social', e.capital != null ? brl(e.capital) : '—')}${kv('Regime tributário (últimos anos)', e.regime.length ? e.regime.slice(-4).map(x => `${esc(x.ano)}: ${esc(x.forma)}`).join('<br>') : '—')}
      ${kv('Inscrição estadual', e.inscricoes.length ? e.inscricoes.map(x => `${esc(x.uf)} ${esc(x.numero)} ${x.ativa === false ? '<i class="bad">(inativa)</i>' : ''}`).join('<br>') : (r.extra && r.extra.aviso ? `<small class="mut">${esc(r.extra.aviso)}</small>` : 'Nenhuma informada'))}
      ${kv('Sanções (CEIS/CNEP)', s.semChave ? '<small class="mut">Não consultado: configure a chave gratuita do Portal da Transparência no servidor (NEXORA_TRANSPARENCIA_CHAVE).</small>' : s.erro ? `<small class="mut">${esc(s.erro)}</small>` : (s.ceis.length + s.cnep.length) ? `<span class="bad">${[...s.ceis, ...s.cnep].map(x => `${esc(x.tipo)} — ${esc(x.orgao || '')} (${dt(x.inicio)} a ${dt(x.fim)})`).join('<br>')}</span>` : '<span class="ok">Nenhuma sanção encontrada</span>')}</div>
      <h3>Atividades secundárias (${e.cnaes.length})</h3>${e.cnaes.length ? `<ul class="ecnae">${e.cnaes.map(c => `<li><b>${esc(c.cod)}</b> ${esc(c.desc || '')}</li>`).join('')}</ul>` : '<p class="mut">Nenhuma.</p>'}
      <h3>Quadro de sócios e administradores (${e.qsa.length})</h3>${qsa}
      <h3>Rede de vínculos</h3><div class="erede-ctl"><label class="f">Procurar empresas dos sócios em<select id="eRedeUf"><option value="">mesmo estado da empresa (${esc(e.endereco.uf || '—')})</option><option value="todas">todo o Brasil (mais lento)</option></select></label><button type="button" class="btn sm" id="eRedeGo">Atualizar diagrama</button><button type="button" class="btn sm" id="eSvg" disabled>Baixar diagrama (SVG)</button></div>
      <div id="eRede" class="erede" aria-live="polite"><p class="mut">Montando o diagrama…</p></div>
      <p class="mut" style="font-size:12px">Fonte do cadastro: ${esc(e.fonte)}${r.extra && r.extra.fonte ? ' + ' + esc(r.extra.fonte) : ''}.</p>`;
  }

  /* ---------- diagrama (SVG radial, sem bibliotecas) ---------- */
  function diagrama(g) {
    const box = q('#eRede'); if (!g || !g.nodes.length) { box.innerHTML = '<p class="mut">Sem dados para o diagrama.</p>'; return; }
    const W = 1000, H = 760, cx = W / 2, cy = H / 2, N = new Map(g.nodes.map(n => [n.id, { ...n }]));
    const root = g.nodes.find(n => n.raiz) || g.nodes[0], R = N.get(root.id); R.x = cx; R.y = cy;
    const soc = g.edges.filter(e => e.para === root.id).map(e => N.get(e.de)).filter(Boolean);
    const r1 = Math.max(270, Math.min(340, 150 + soc.length * 18));
    const a0 = soc.length <= 2 ? 0 : -Math.PI / 2;
    soc.forEach((s, i) => { s.a = a0 + i * 2 * Math.PI / Math.max(1, soc.length); s.x = cx + r1 * Math.cos(s.a); s.y = cy + r1 * Math.sin(s.a); });
    const fora = [...N.values()].filter(n => n.x == null);
    const pais = n => g.edges.filter(e => e.para === n.id || e.de === n.id).map(e => N.get(e.para === n.id ? e.de : e.para)).filter(p => p && p.a != null);
    const porSoc = new Map(); for (const n of fora) { const p = pais(n); const a = p.length ? Math.atan2(p.reduce((t, x) => t + Math.sin(x.a), 0), p.reduce((t, x) => t + Math.cos(x.a), 0)) : 0; n.a = a; const k = p.length === 1 ? p[0].id : 'multi' + a.toFixed(2); (porSoc.get(k) || porSoc.set(k, []).get(k)).push(n); }
    const setor = 2 * Math.PI / Math.max(1, soc.length);
    for (const grupo of porSoc.values()) grupo.forEach((n, i) => { const sp = Math.min(setor * 0.85, 0.22 * grupo.length), a = n.a + (grupo.length > 1 ? -sp / 2 + sp * i / (grupo.length - 1) : 0), r2 = r1 + 210 + (i % 2) * 80; n.x = cx + r2 * Math.cos(a); n.y = cy + r2 * Math.sin(a); });
    const all = [...N.values()]; let minX = Math.min(...all.map(n => n.x)) - 120, maxX = Math.max(...all.map(n => n.x)) + 120, minY = Math.min(...all.map(n => n.y)) - 60, maxY = Math.max(...all.map(n => n.y)) + 60;
    /* tamanho mínimo, para poucos nós não ficarem gigantes */
    if (maxX - minX < 760) { const c = (minX + maxX) / 2; minX = c - 380; maxX = c + 380; } if (maxY - minY < 460) { const c = (minY + maxY) / 2; minY = c - 230; maxY = c + 230; }
    const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const cor = n => n.tipo === 'empresa' || (n.tipo === 'PJ' && n.cnpj) ? (/ATIVA/i.test(n.situacao || '') ? '#4ade80' : n.situacao ? '#f87171' : '#94a3b8') : '#7aa2ff';
    let o = `<svg id="eSvgEl" xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" role="group" aria-label="Diagrama de vínculos: ${esc(root.label)} e empresas ligadas pelos sócios"><style>text{font:12px Barlow,Arial,sans-serif;fill:#e6ecff}.r{font-size:10px;fill:#9fb0d0}</style>`;
    for (const e of g.edges) { const a = N.get(e.de), b = N.get(e.para); if (!a || !b) continue; o += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#3b5287" stroke-width="1.4"><title>${esc(a.label)} → ${esc(b.label)}: ${esc(e.rotulo)}</title></line>`; }
    for (const n of all) {
      const emp = n.tipo === 'empresa' || n.tipo === 'PJ', w = n.raiz ? 210 : 170, h = n.raiz ? 46 : 38, click = n.cnpj && !n.raiz ? ` data-cnpj="${n.cnpj}" data-modo="completa" tabindex="0" role="button" style="cursor:pointer"` : '';
      const tip = `${n.razao || n.label}${n.cnpj ? ' · ' + E.fmtCnpj(n.cnpj) : ''}${n.situacao ? ' · ' + n.situacao : ''}${n.uf ? ' · ' + (n.municipio ? n.municipio + '/' : '') + n.uf : ''}${n.qualificacao ? ' · ' + n.qualificacao : ''}${n.faixaEtaria ? ' · ' + n.faixaEtaria : ''}${click ? ' — clique para consultar' : ''}`;
      if (emp) o += `<g${click}><title>${esc(tip)}</title><rect x="${n.x - w / 2}" y="${n.y - h / 2}" width="${w}" height="${h}" rx="${n.tipo === 'PJ' ? 3 : 9}" fill="${n.raiz ? '#2a1d06' : '#0f1d3d'}" stroke="${n.raiz ? '#f7a334' : cor(n)}" stroke-width="${n.raiz ? 3 : 2}"/><text x="${n.x}" y="${n.y - (n.cnpj ? 3 : -4)}" text-anchor="middle" font-weight="700">${esc(cut(n.label, n.raiz ? 28 : 22))}</text>${n.cnpj ? `<text class="r" x="${n.x}" y="${n.y + 12}" text-anchor="middle">${E.fmtCnpj(n.cnpj)}${n.uf ? ' · ' + esc(n.uf) : ''}</text>` : ''}</g>`;
      else o += `<g><title>${esc(tip)}</title><circle cx="${n.x}" cy="${n.y}" r="17" fill="#13254d" stroke="#7aa2ff" stroke-width="2"/><circle cx="${n.x}" cy="${n.y - 5}" r="5" fill="#7aa2ff"/><path d="M${n.x - 9} ${n.y + 10} q9 -12 18 0" fill="#7aa2ff"/><text x="${n.x}" y="${n.y + 31}" text-anchor="middle" font-weight="600">${esc(cut(n.label, 26))}</text>${n.qualificacao ? `<text class="r" x="${n.x}" y="${n.y + 44}" text-anchor="middle">${esc(cut(n.qualificacao, 30))}</text>` : ''}</g>`;
    }
    o += '</svg>';
    const ligadas = all.filter(n => n.tipo === 'empresa' && !n.raiz);
    box.innerHTML = `<div class="eleg"><span><i style="border-color:#f7a334"></i>Empresa consultada</span><span><i style="border-color:#4ade80"></i>Empresa ativa</span><span><i style="border-color:#f87171"></i>Baixada / inapta</span><span><i class="pf"></i>Pessoa (sócio)</span><span class="mut">Toque numa empresa para consultá-la.</span></div><div class="esvg">${o}</div>`
      + (g.avisos && g.avisos.length ? `<ul class="ealert">${[...new Set(g.avisos)].slice(0, 8).map(a => `<li class="info">ℹ ${esc(a)}</li>`).join('')}</ul>` : '')
      + `<p class="mut" style="font-size:12.5px;margin:8px 0">${ligadas.length ? `<b>${ligadas.length}</b> empresa(s) ligada(s) pelos mesmos sócios${g.ufBusca && g.ufBusca !== 'todas' ? ' em ' + esc(g.ufBusca) : ''}.` : 'Nenhuma outra empresa encontrada para estes sócios' + (g.ufBusca && g.ufBusca !== 'todas' ? ' em ' + esc(g.ufBusca) + ' (tente “todo o Brasil”).' : '.')} ${esc(g.fonte || '')}</p>`
      + (ligadas.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Empresa ligada</th><th>CNPJ</th><th>Situação</th><th>Cidade</th><th>Ligação</th></tr></thead><tbody>${ligadas.map(n => `<tr><td><b>${esc(n.razao || n.label)}</b></td><td><button type="button" class="lnk" data-cnpj="${n.cnpj}" data-modo="completa">${E.fmtCnpj(n.cnpj)}</button></td><td class="${sitCls(n.situacao)}">${esc(n.situacao || '—')}</td><td>${esc([n.municipio, n.uf].filter(Boolean).join(' / '))}</td><td>${g.edges.filter(e => e.para === n.id).map(e => esc((N.get(e.de) || {}).label || '')).join(', ')}</td></tr>`).join('')}</tbody></table></div>` : '');
    const sv = box.querySelector('.esvg'); sv.scrollLeft = (sv.scrollWidth - sv.clientWidth) / 2; sv.scrollTop = (sv.scrollHeight - sv.clientHeight) / 2;
    const b = q('#eSvg'); b.disabled = false; b.onclick = () => { const blob = new Blob([q('#eSvgEl').outerHTML], { type: 'image/svg+xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vinculos-${root.cnpj || 'empresa'}.svg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  }
  async function carregaRede(cnpj) {
    const box = q('#eRede'); if (!box) return; const uf = q('#eRedeUf').value;
    box.innerHTML = `<p class="mut">⏳ Procurando empresas dos sócios${uf === 'todas' ? ' em todo o Brasil (pode levar até 1 minuto)' : ''}…</p>`;
    try { diagrama(await api(`/rede/${cnpj}${uf ? '?uf=' + uf : ''}`)); } catch (e) { box.innerHTML = `<p class="bad">${esc(e.message)}</p>`; }
  }

  /* ---------- fluxo ---------- */
  async function consultar(cnpj, modo) {
    const out = q('#eOut'); q('#eList').innerHTML = ''; q('#eErr').textContent = '';
    out.innerHTML = `<div class="card"><p class="mut">⏳ ${modo === 'completa' ? 'Consulta completa' : 'Consultando'} ${E.fmtCnpj(cnpj)}…</p></div>`;
    try {
      const r = await api(`/${modo === 'completa' ? 'completa' : 'cnpj'}/${cnpj}`); ultimo = r; addHist(r.empresa);
      out.innerHTML = `<article class="card eres">${cabecalho(r.empresa, modo)}${alertasHtml(r.alertas)}${basico(r.empresa)}${modo === 'completa' ? completo(r) : ''}</article>`;
      if (modo === 'completa') { q('#eRedeGo').onclick = () => carregaRede(cnpj); q('#eRedeUf').onchange = () => carregaRede(cnpj); carregaRede(cnpj);
        q('#eJson').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(ultimo, null, 1)], { type: 'application/json' })); a.download = `empresa-${cnpj}.json`; a.click(); };
        q('#ePrint').onclick = () => window.print(); }
      out.querySelector('h2').setAttribute('tabindex', '-1'); out.querySelector('h2').focus({ preventScroll: true }); out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { out.innerHTML = `<div class="card"><p class="bad" role="alert">${esc(e.message)}</p></div>`; }
  }
  async function buscarNome(nome, modo) {
    const list = q('#eList'); q('#eOut').innerHTML = ''; list.innerHTML = '<div class="card"><p class="mut">⏳ Buscando pelo nome…</p></div>';
    try {
      const r = await api('/busca', { method: 'POST', body: JSON.stringify({ nome, uf: q('#eUf').value }) });
      if (!r.lista.length) { list.innerHTML = `<div class="card"><p>Nenhuma empresa encontrada para “${esc(nome)}”${q('#eUf').value ? ' em ' + q('#eUf').value : ''}. Tente outra parte do nome ou outro estado.</p></div>`; return; }
      list.innerHTML = `<div class="card"><h2 style="margin:0 0 8px;font-size:16px">${r.lista.length} resultado(s)${r.total > r.lista.length ? ` de ${Number(r.total).toLocaleString('pt-BR')} — refine com o estado ou mais palavras` : ''}</h2><div class="elist">${r.lista.map(x => `<div class="eitem"><div><b>${esc(x.razao || '')}</b>${x.fantasia ? ` <span class="mut">(${esc(x.fantasia)})</span>` : ''}<br><small>${E.fmtCnpj(x.cnpj)} · ${esc([x.municipio, x.uf].filter(Boolean).join(' - '))} · <i class="${sitCls(x.situacao)}">${esc(x.situacao || '')}</i></small></div><div class="eitem-b"><button type="button" class="btn sm" data-cnpj="${x.cnpj}" data-modo="simples">Simples</button><button type="button" class="btn sm pri" data-cnpj="${x.cnpj}" data-modo="completa">Completa</button></div></div>`).join('')}</div><p class="mut" style="font-size:12px;margin:8px 0 0">${esc(r.fonte || '')}</p></div>`;
    } catch (e) { list.innerHTML = `<div class="card"><p class="bad" role="alert">${esc(e.message)}</p></div>`; }
  }
  function enviar(modo) {
    const v = q('#eQ').value.trim(), d = E.dig(v); q('#eErr').textContent = ''; q('#eQ').removeAttribute('aria-invalid');
    if (d.length >= 11 && d.length === v.replace(/[\s./-]/g, '').length) {
      if (!E.cnpjOk(d)) { q('#eErr').textContent = d.length === 11 ? 'Isso parece um CPF. Esta consulta é de empresas (CNPJ com 14 dígitos).' : 'CNPJ inválido: confira os números.'; q('#eQ').setAttribute('aria-invalid', 'true'); q('#eQ').focus(); return; }
      return consultar(d, modo);
    }
    if (v.length < 3) { q('#eErr').textContent = 'Digite o CNPJ ou pelo menos 3 letras do nome.'; q('#eQ').setAttribute('aria-invalid', 'true'); q('#eQ').focus(); return; }
    buscarNome(v, modo);
  }
  q('#eForm').addEventListener('submit', e => { e.preventDefault(); enviar('simples'); });
  q('#eCompleta').onclick = () => enviar('completa');
  q('#eQ').addEventListener('input', e => { const d = E.dig(e.target.value); if (d.length === 14 && /^[\d\s./-]+$/.test(e.target.value)) e.target.value = E.fmtCnpj(d); });
  document.getElementById('v-empresas').addEventListener('click', e => {
    const b = e.target.closest('[data-cnpj]'); if (b) { e.preventDefault(); q('#eQ').value = E.fmtCnpj(b.dataset.cnpj); consultar(b.dataset.cnpj, b.dataset.modo || 'simples'); return; }
    const c = e.target.closest('[data-copy]'); if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy).then(() => toast('CNPJ copiado.')); }
  });
  document.getElementById('v-empresas').addEventListener('keydown', e => { const b = e.target.closest('g[data-cnpj]'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  return { open: () => { renderHist(); setTimeout(() => q('#eQ').focus(), 50); }, consultar };
})();
