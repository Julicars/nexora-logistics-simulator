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
    if (path === '/pessoa') return pessoaDireta(JSON.parse(opt.body));
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
    let lei = null; try { const j = await getJ(`https://api.gleif.org/api/v1/lei-records?filter[entity.registeredAs]=${m[2]}&page[size]=1`); lei = j ? (E.lei(j) || { nenhum: true }) : null; } catch (e) { /* segue */ }
    const fontes = await extrasDiretos(d);
    return { empresa: d, alertas: E.alertas(d), extra, sancoes: { semChave: true }, lei, links: E.linksOficiais(m[2]), fontes, risco: E.risco(d, fontes) };
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
  /* uso pela web (sem servidor): ANTT e IBAMA pelos portais de dados abertos; lista suja guardada no navegador */
  async function ckan(host, pacote, doc, campos) {
    const p = await getJ(`https://${host}/api/3/action/package_show?id=${pacote}`); const rs = p && p.result ? p.result.resources.filter(x => x.datastore_active).sort((a, b) => String(b.created).localeCompare(String(a.created))) : [];
    if (!rs.length) return null; const alvo = E.dig(doc);
    for (const t of [...campos.map(c => 'filters=' + encodeURIComponent(JSON.stringify({ [c]: alvo }))), 'q=' + alvo]) { const r = await getJ(`https://${host}/api/3/action/datastore_search?resource_id=${rs[0].id}&limit=50&${t}`); const l = r && r.result ? r.result.records.filter(x => Object.values(x).some(v => E.dig(v) === alvo)) : []; if (l.length) return l; }
    return [];
  }
  async function extrasDiretos(d) {
    const out = { setor: E.setor(d), antt: null, ibama: null, internacional: null, internacionalAviso: 'As listas de sanções internacionais (EUA e ONU) são arquivos grandes: só são conferidas com o NEXORA rodando no computador (npm start).' };
    try { const l = await ckan('dados.antt.gov.br', 'rntrc', d.cnpj, ['cpfcnpjtransportador']); if (l) { const x = l[0]; out.antt = x ? { numero: x.numero_rntrc, situacao: x.situacao_rntrc, desde: x.data_primeiro_cadastro, categoria: x.categoria_transportador, municipio: x.municipio, uf: x.uf } : { naoEncontrado: true }; } } catch (e) { out.antt = { erro: 'A ANTT bloqueou o acesso direto pelo navegador. Use o link “Transportador no RNTRC” abaixo ou rode com npm start.' }; }
    try { const l = await ckan('dadosabertos.ibama.gov.br', 'fiscalizacao-termo-de-embargo', d.cnpj, ['CPF_CNPJ_INFRATOR']); if (l) out.ibama = { lista: l.slice(0, 20).map(x => ({ numero: x.NUM_TAD, data: x.DAT_EMBARGO, municipio: x.MUNICIPIO, uf: x.UF, motivo: x.DES_INFRACAO })) }; } catch (e) { out.ibama = { erro: 'O IBAMA bloqueou o acesso direto pelo navegador. Use a consulta oficial de embargos.' }; }
    const ls = LS.get('listaSuja', null); if (ls) { out.listaSuja = E.naLista(ls.lista, d); out.listaSujaData = ls.t; }
    return out;
  }
  /* uso pela web (sem servidor): pessoa — com CPF pela minhareceita; só com nome pela Casa dos Dados */
  async function pessoaDireta(b) {
    const nome = String(b.nome || '').trim(), mask = b.doc ? E.mascaraCpf(b.doc) : null;
    if (E.normNome(nome).split(' ').length < 2) throw Object.assign(new Error('Digite o nome completo da pessoa (nome e sobrenome).'), { status: 400 });
    const k = 'empPes:' + E.normNome(nome) + ':' + (mask || '') + ':' + (b.uf || ''), c = cacheGet(k); if (c) return c;
    let emps = [], avisos = [];
    try {
      if (mask) { const r = await fetch(`https://minhareceita.org/?cnpf=${encodeURIComponent(mask)}${b.uf ? '&uf=' + b.uf : ''}&limit=200`); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); emps = (j.data || []).map(x => E.normalizar(x, 'minhareceita.org')); }
      else {
        const r = await fetch('https://api.casadosdados.com.br/v5/public/cnpj/pesquisa', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ busca_textual: [{ texto: [nome], tipo_busca: 'exata', razao_social: false, nome_fantasia: false, nome_socio: true }], ...(b.uf ? { uf: [b.uf] } : {}), limite: 20, pagina: 1 }) });
        if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json();
        const arr = (function f(o, d) { if (d > 3 || !o || typeof o !== 'object') return null; if (Array.isArray(o) && o.length && o[0] && typeof o[0] === 'object' && 'cnpj' in o[0]) return o; for (const v of Object.values(o)) { const x = f(v, d + 1); if (x) return x; } return null; })(j, 0) || [];
        for (const c of [...new Set(arr.map(x => E.dig(x.cnpj)))].slice(0, 12)) { try { const x = await getJ(`https://brasilapi.com.br/api/cnpj/v1/${c}`); if (x) emps.push(E.normalizar(x, 'BrasilAPI')); } catch (e) { /* segue */ } }
        if (arr.length > 12) avisos.push('Abrimos as 12 primeiras empresas encontradas. Informe o CPF ou o estado para refinar.');
      }
    } catch (e) { throw Object.assign(new Error(previaClaude() ? 'Você está na prévia do Claude, que bloqueia sites externos: a busca de pessoas não funciona aqui. Abra o NEXORA publicado num site ou rode com npm start.' : 'A fonte bloqueou a busca de pessoas pelo navegador (' + e.message + '). Informe o CPF, ou rode o NEXORA no computador (npm start).'), { status: 503 }); }
    return cacheSet(k, { nome, pessoas: E.agruparPessoa(nome, emps, mask), avisos, fonte: 'Quadro societário da base aberta da Receita Federal.' });
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
      <p class="ecnpj"><b>${E.fmtCnpj(e.cnpj)}</b> <button type="button" class="btn sm" data-copy="${E.fmtCnpj(e.cnpj)}" aria-label="Copiar CNPJ">Copiar</button> <span class="epill ${sitCls(e.situacao)}">${esc(e.situacao || 'situação desconhecida')}</span>${e.matriz ? ` <span class="epill mut">${esc(e.matriz)}</span>` : ''} <span class="epill mut">${E.setor(e).icone} ${esc(E.setor(e).nome)}</span></p></div>
      <div class="eacts">${modo === 'simples' ? `<button type="button" class="btn pri" data-cnpj="${e.cnpj}" data-modo="completa">🧾 Ver consulta completa</button>` : `<button type="button" class="btn sm" id="eJson">Baixar JSON</button><button type="button" class="btn sm" id="ePrint">Imprimir</button>`}</div></div>`;
  }
  function alertasHtml(a) { return a.length ? `<ul class="ealert">${a.map(([c, t]) => `<li class="${c}">${c === 'bad' ? '⛔' : c === 'warn' ? '⚠' : c === 'ok' ? '✔' : 'ℹ'} ${esc(t)}</li>`).join('')}</ul>` : ''; }
  function basico(e) {
    return `<div class="egrid">${kv('Abertura', dt(e.abertura))}${kv('Situação desde', dt(e.dataSituacao) + (e.motivoSituacao && !/SEM MOTIVO/i.test(e.motivoSituacao) ? ' · ' + esc(e.motivoSituacao) : ''))}${kv('Natureza jurídica', esc(e.natureza))}${kv('Porte', esc(e.porte))}
      ${kv('Atividade principal', e.cnaePrincipal ? `${esc(e.cnaePrincipal.cod)} · ${esc(e.cnaePrincipal.desc || '')}` : '—')}${kv('Endereço', endereco(e.endereco))}
      ${kv('Telefone', e.telefones.map(E.fmtTel).map(esc).join('<br>'))}${kv('E-mail', esc(e.email ? e.email.toLowerCase() : ''))}
      ${kv('Simples Nacional', yes(e.simples.optante) + (e.simples.desde ? ' desde ' + dt(e.simples.desde) : ''))}${kv('MEI', yes(e.simples.mei))}</div>`;
  }

  /* ---------- risco, transporte, ambiental, trabalho e sanções internacionais ---------- */
  const CAT = { ETC: 'Empresa de transporte (ETC)', TAC: 'Autônomo (TAC)', CTC: 'Cooperativa de transporte (CTC)' };
  function riscoHtml(r) {
    if (!r.risco) return '';
    const k = r.risco, cor = k.nivel === 'alto' ? 'bad' : k.nivel === 'medio' ? 'warn' : 'ok';
    return `<div class="erisco ${cor}" role="group" aria-label="Nota de risco"><div class="erisco-n"><b>${k.nota}</b><small>/100</small></div><div><b>Risco ${k.nivel === 'alto' ? 'ALTO' : k.nivel === 'medio' ? 'MÉDIO' : 'BAIXO'}</b> <small class="mut">(quanto maior, mais atenção)</small>
      ${k.motivos.length ? `<ul>${k.motivos.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p class="mut" style="margin:2px 0 0">Nada de negativo nas fontes consultadas.</p>'}</div></div>`;
  }
  function docsTransp(cnpj) {
    const d = LS.get('trDoc:' + cnpj, {}), venc = d.validade && new Date(d.validade + 'T23:59') < new Date();
    return `<form class="etrdoc" data-trdoc="${cnpj}"><p class="mut" style="margin:0 0 6px;font-size:13px">O seguro obrigatório da carga (RCTR-C) e o de desvio de carga (RC-DC) <b>não ficam em base pública</b>: peça a apólice à transportadora e anote aqui. O NEXORA avisa quando vencer.</p>
      <div class="taragrid"><label class="f">Seguradora<input name="seg" value="${esc(d.seg || '')}"></label><label class="f">Apólice RCTR-C<input name="rctrc" value="${esc(d.rctrc || '')}"></label><label class="f">Apólice RC-DC<input name="rcdc" value="${esc(d.rcdc || '')}"></label><label class="f">Válida até<input type="date" name="validade" value="${esc(d.validade || '')}"></label><label class="f">Gerenciadora de risco<input name="gr" value="${esc(d.gr || '')}"></label></div>
      <label class="f">Observações<input name="obs" value="${esc(d.obs || '')}" placeholder="Ex.: rastreador, PGR, contato do seguro"></label>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px"><button class="btn sm pri" type="submit">Salvar documentos</button>${venc ? '<span class="bad">⛔ Seguro vencido</span>' : d.validade ? `<span class="ok">✔ Seguro válido até ${dt(d.validade)}</span>` : ''}</div></form>`;
  }
  function fontesHtml(r) {
    const f = r.fontes; if (!f) return '';
    const e = r.empresa, st = f.setor || E.setor(e), a = f.antt;
    let h = '';
    if (st.transp || (a && !a.naoEncontrado && !a.erro)) {
      h += `<h3>🚚 Transporte (ANTT)</h3><div class="egrid">${!a ? kv('RNTRC', '<small class="mut">Não consultado.</small>') : a.erro ? kv('RNTRC', `<small class="mut">${esc(a.erro)}</small>`) : a.naoEncontrado ? kv('RNTRC', '<span class="bad">Não encontrado no registro da ANTT</span> <small class="mut">(sem RNTRC ativo não pode fazer transporte remunerado de cargas)</small>')
        : kv('RNTRC', `<b>${esc(a.numero)}</b> · <span class="${/ATIV/i.test(a.situacao || '') ? 'ok' : 'bad'}">${esc(a.situacao || '—')}</span>`) + kv('Categoria', esc(CAT[a.categoria] || a.categoria || '—') + (a.equiparado && /S/i.test(a.equiparado) ? ' · equiparado a ETC' : '')) + kv('Registrado desde', dt(a.desde)) + kv('Frota cadastrada', a.frota != null ? `${a.frota} veículo(s)` + (a.veiculos && a.veiculos.length ? `<br><small class="mut">${esc(Object.entries(a.veiculos.reduce((o, v) => { const t = v.tipo || 'outro'; o[t] = (o[t] || 0) + 1; return o; }, {})).map(([t, n]) => `${n} ${String(t).toLowerCase()}`).join(' · '))}</small>` : '') : '—') + kv('Transporte internacional (TRIC)', a.tric == null ? '—' : yes(a.tric)) + kv('Operador multimodal (OTM)', a.otm == null ? '—' : yes(a.otm))}</div>
        <h3>🛡 Seguros e documentos da transportadora</h3>${docsTransp(e.cnpj)}`;
    }
    const ib = f.ibama, ls = f.listaSuja, int = f.internacional;
    h += `<h3>🌳 Ambiental, trabalho e sanções internacionais</h3><div class="egrid">
      ${kv('Embargos ambientais (IBAMA)', !ib ? '<small class="mut">Não consultado.</small>' : ib.erro ? `<small class="mut">${esc(ib.erro)}</small>` : ib.lista.length ? `<span class="bad">${ib.lista.map(x => `Embargo ${esc(x.numero || '')} · ${esc([x.municipio, x.uf].filter(Boolean).join('/'))} · ${dt(x.data)}${x.motivo ? '<br><small>' + esc(String(x.motivo).slice(0, 140)) + '</small>' : ''}`).join('<br>')}</span>` : '<span class="ok">Nenhum embargo encontrado</span>')}
      ${kv('Lista suja do trabalho escravo (MTE)', ls == null ? '<small class="mut">Lista não carregada — use “Listas oficiais” no fim da página.</small>' : ls.length ? `<span class="bad">${ls.map(x => `⛔ ${esc(x.nome)} — ${esc(x.por)}`).join('<br>')}</span>` : `<span class="ok">Não consta</span> <small class="mut">(lista de ${dt(new Date(f.listaSujaData).toISOString())})</small>`)}
      ${kv('Sanções internacionais (EUA/OFAC e ONU)', int == null ? `<small class="mut">${esc(f.internacionalAviso || 'Não consultado.')}</small>` : int.length ? `<span class="bad">${int.map(x => `${esc(x.nome)} · ${esc(x.fonte)} — ${esc(x.por)}`).join('<br>')}</span>` : '<span class="ok">Nada encontrado</span>')}</div>`;
    return h;
  }
  function completo(r) {
    const e = r.empresa, s = r.sancoes || {};
    const qsa = e.qsa.length ? `<div class="tbl-wrap"><table class="tbl eqsa"><thead><tr><th>Nome</th><th>Tipo</th><th>Qualificação</th><th>Documento</th><th>Desde</th><th>Faixa etária</th></tr></thead><tbody>${e.qsa.map(x => `<tr><td><b>${esc(x.nome)}</b>${x.representante ? `<br><small class="mut">Representante: ${esc(x.representante)}</small>` : ''}</td><td>${x.tipo === 'PJ' ? 'Empresa' : x.tipo === 'EST' ? 'Estrangeiro' : 'Pessoa física'}</td><td>${esc(x.qualificacao || '—')}</td><td>${x.tipo === 'PJ' && E.dig(x.doc).length === 14 ? `<button type="button" class="lnk" data-cnpj="${E.dig(x.doc)}" data-modo="completa">${E.fmtCnpj(x.doc)}</button>` : esc(x.doc || '—')}</td><td>${dt(x.entrada)}</td><td>${esc(x.faixaEtaria || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">Quadro de sócios não informado na base pública.</p>';
    return `<div class="egrid">${kv('Capital social', e.capital != null ? brl(e.capital) : '—')}${kv('Regime tributário (últimos anos)', e.regime.length ? e.regime.slice(-4).map(x => `${esc(x.ano)}: ${esc(x.forma)}`).join('<br>') : '—')}
      ${kv('Inscrição estadual', e.inscricoes.length ? e.inscricoes.map(x => `${esc(x.uf)} ${esc(x.numero)} ${x.ativa === false ? '<i class="bad">(inativa)</i>' : ''}`).join('<br>') : (r.extra && r.extra.aviso ? `<small class="mut">${esc(r.extra.aviso)}</small>` : 'Nenhuma informada'))}
      ${kv('Sanções (CEIS, CNEP, CEPIM) e leniência', s.semChave ? '<small class="mut">Não consultado: configure a chave gratuita do Portal da Transparência no servidor (NEXORA_TRANSPARENCIA_CHAVE).</small>' : (() => { const t = [...(s.ceis || []), ...(s.cnep || []), ...(s.cepim || []), ...(s.leniencia || [])]; return (s.erro ? `<small class="mut">${esc(s.erro)}</small><br>` : '') + (t.length ? `<span class="bad">${t.map(x => `${esc(x.tipo)} — ${esc(x.orgao || '')} (${dt(x.inicio)} a ${dt(x.fim)})`).join('<br>')}</span>` : '<span class="ok">Nenhum registro encontrado</span>'); })())}
      ${kv('Contratos com o governo federal', s.semChave ? '<small class="mut">Precisa da mesma chave do Portal da Transparência.</small>' : !s.contratos ? '—' : s.contratos.qtd ? `${s.contratos.qtd}${s.contratos.mais ? '+' : ''} contrato(s)` : 'Nenhum encontrado')}
      ${kv('Registro global LEI (GLEIF)', !r.lei ? '<small class="mut">Não consultado.</small>' : r.lei.nenhum ? 'Não possui LEI <small class="mut">(comum: só empresas do mercado financeiro/comércio exterior têm)</small>' : `<a href="${esc(r.lei.url)}" target="_blank" rel="noopener">${esc(r.lei.lei)}</a> · ${esc(r.lei.status || '')}${r.lei.renovacao ? ' · renova em ' + dt(r.lei.renovacao) : ''}${r.lei.controladoraFinal ? `<br>Controladora final: <b>${esc(r.lei.controladoraFinal.nome)}</b>` : r.lei.controladora ? `<br>Controladora: <b>${esc(r.lei.controladora.nome)}</b>` : ''}`)}</div>
      ${s.contratos && s.contratos.lista && s.contratos.lista.length ? `<details class="edet"><summary>Contratos federais (${s.contratos.lista.length}${s.contratos.mais ? '+' : ''})</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Órgão</th><th>Objeto</th><th>Valor</th><th>Vigência</th></tr></thead><tbody>${s.contratos.lista.map(c => `<tr><td>${esc(c.orgao || '—')}</td><td>${esc((c.objeto || '').slice(0, 160))}</td><td>${c.valor != null ? brl(c.valor) : '—'}</td><td>${dt(c.inicio)} a ${dt(c.fim)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      <h3>Conferir na fonte oficial</h3><ul class="elinks">${(r.links || E.linksOficiais(e.cnpj)).map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a></li>`).join('')}</ul>
      ${fontesHtml(r)}
      <h3>Atividades secundárias (${e.cnaes.length})</h3>${e.cnaes.length ? `<ul class="ecnae">${e.cnaes.map(c => `<li><b>${esc(c.cod)}</b> ${esc(c.desc || '')}</li>`).join('')}</ul>` : '<p class="mut">Nenhuma.</p>'}
      <h3>Quadro de sócios e administradores (${e.qsa.length})</h3>${qsa}
      <h3>Rede de vínculos</h3><div class="erede-ctl"><label class="f">Procurar empresas dos sócios em<select id="eRedeUf"><option value="">mesmo estado da empresa (${esc(e.endereco.uf || '—')})</option><option value="todas">todo o Brasil (mais lento)</option></select></label><button type="button" class="btn sm" id="eRedeGo">Atualizar diagrama</button><button type="button" class="btn sm" id="eSvg" disabled>Baixar diagrama (SVG)</button></div><p class="mut" style="font-size:12px;margin:0 0 6px">Arraste para mover, use a roda do mouse (ou dois dedos) para aproximar, toque num nó para ver detalhes e dê duplo clique para expandir os vínculos dele.</p>
      <div id="eRede" class="erede" aria-live="polite"><p class="mut">Montando o diagrama…</p></div>
      <p class="mut" style="font-size:12px">Fonte do cadastro: ${esc(e.fonte)}${r.extra && r.extra.fonte ? ' + ' + esc(r.extra.fonte) : ''}.</p>`;
  }

  /* ---------- diagrama interativo (app/grafo.js) ---------- */
  let grafo = null;
  const grafoPessoa = (r, p) => {
    const pid = E.chaveSocio({ tipo: 'PF', doc: p.doc, nome: p.nome });
    return { nodes: [{ id: pid, tipo: 'PF', label: p.nome, doc: p.doc, faixaEtaria: p.faixaEtaria, expandido: true }, ...p.empresas.map(x => ({ id: 'E' + x.cnpj, tipo: 'empresa', label: x.fantasia || x.razao, razao: x.razao, cnpj: x.cnpj, situacao: x.situacao, uf: x.uf, municipio: x.municipio }))],
      edges: p.empresas.map(x => ({ de: pid, para: 'E' + x.cnpj, rotulo: x.qualificacao || 'Sócio' })) };
  };
  const opGrafo = () => ({
    abrirEmpresa: cnpj => { q('#eQ').value = E.fmtCnpj(cnpj); tipoBusca('emp'); consultar(cnpj, 'completa'); },
    abrirPessoa: n => { tipoBusca('pes'); q('#eQ').value = n.label; buscarPessoa(n.label, String(n.doc || '').replace(/[^0-9*]/g, '')); },
    expandir: async n => {
      if (n.cnpj && (n.tipo === 'empresa' || n.tipo === 'PJ')) return api(`/rede/${n.cnpj}${q('#eRedeUf') && q('#eRedeUf').value ? '?uf=' + q('#eRedeUf').value : ''}`);
      const doc = String(n.doc || '').replace(/[^0-9*]/g, '');
      const r = await api('/pessoa', { method: 'POST', body: JSON.stringify({ nome: n.label, doc, uf: q('#eRedeUf') && q('#eRedeUf').value === 'todas' ? '' : (n.uf || '') }) });
      const p = r.pessoas[0]; if (!p) return { nodes: [], edges: [] }; const g = grafoPessoa(r, p); g.nodes[0].id = n.id; g.edges.forEach(e => { e.de = n.id; }); return g;
    }
  });
  function diagrama(g, alvo = '#eRede', titulo) {
    const box = q(alvo); if (!g || !g.nodes.length) { box.innerHTML = '<p class="mut">Sem dados para o diagrama.</p>'; return; }
    box.innerHTML = `<div class="eleg"><span><i style="border-color:#f7a334"></i>${titulo || 'Empresa consultada'}</span><span><i style="border-color:#4ade80"></i>Empresa ativa</span><span><i style="border-color:#f87171"></i>Baixada / inapta</span><span><i class="pf"></i>Pessoa (sócio)</span><span><i class="pf" style="background:#f7a334;border-color:#f7a334"></i>Já expandido</span></div><div class="egraf"></div>`
      + (g.avisos && g.avisos.length ? `<ul class="ealert">${[...new Set(g.avisos)].slice(0, 8).map(a => `<li class="info">ℹ ${esc(a)}</li>`).join('')}</ul>` : '')
      + `<div class="eligadas"></div>`;
    const lista = d => { const raiz = d.nodes.find(n => n.raiz) || d.nodes[0], lig = d.nodes.filter(n => n.tipo === 'empresa' && n !== raiz && n.cnpj);
      box.querySelector('.eligadas').innerHTML = `<p class="mut" style="font-size:12.5px;margin:8px 0">${lig.length ? `<b>${lig.length}</b> empresa(s) no diagrama${g.ufBusca && g.ufBusca !== 'todas' ? ' (busca em ' + esc(g.ufBusca) + ')' : ''}.` : 'Nenhuma outra empresa encontrada' + (g.ufBusca && g.ufBusca !== 'todas' ? ' em ' + esc(g.ufBusca) + ' (tente “todo o Brasil”).' : '.')} ${esc(g.fonte || '')}</p>`
        + (lig.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Situação</th><th>Cidade</th><th>Ligação</th></tr></thead><tbody>${lig.map(n => `<tr><td><b>${esc(n.razao || n.label)}</b></td><td><button type="button" class="lnk" data-cnpj="${n.cnpj}" data-modo="completa">${E.fmtCnpj(n.cnpj)}</button></td><td class="${sitCls(n.situacao)}">${esc(n.situacao || '—')}</td><td>${esc([n.municipio, n.uf].filter(Boolean).join(' / '))}</td><td>${d.edges.filter(e => e.para === n.id || e.de === n.id).map(e => esc((d.nodes.find(x => x.id === (e.para === n.id ? e.de : e.para)) || {}).label || '')).join(', ')}</td></tr>`).join('')}</tbody></table></div>` : ''); };
    grafo = GRAFO.montar(box.querySelector('.egraf'), g, { ...opGrafo(), mudou: lista }); lista(grafo.dados());
    const b = q('#eSvg'); if (b) { b.disabled = false; b.onclick = () => { const blob = new Blob([grafo.svgTexto()], { type: 'image/svg+xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vinculos-${(g.nodes[0] && g.nodes[0].cnpj) || 'diagrama'}.svg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }; }
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
      out.innerHTML = `<article class="card eres">${cabecalho(r.empresa, modo)}${modo === 'completa' ? riscoHtml(r) : ''}${alertasHtml(r.alertas)}${basico(r.empresa)}${modo === 'completa' ? completo(r) : ''}</article>`;
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
  /* ---------- pessoa ---------- */
  function tipoBusca(t) {
    const pes = t === 'pes'; const r = document.querySelector(`input[name=eTipo][value=${pes ? 'pes' : 'emp'}]`); if (r) r.checked = true;
    q('#eQLbl').textContent = pes ? 'Nome completo da pessoa' : 'CNPJ ou nome da empresa'; q('#eQ').placeholder = pes ? 'Ex.: Maria da Silva Souza' : '00.000.000/0000-00 ou parte do nome';
    q('.ecpf').hidden = !pes; q('#eSimples').hidden = pes; q('#eCompleta').hidden = pes; q('#ePessoa').hidden = !pes;
    q('#eHint').textContent = pes ? 'Mostra em quais empresas a pessoa aparece como sócia ou administradora (dados públicos da Receita, CPF mascarado). Com o CPF, separa pessoas de mesmo nome.' : 'Simples: o básico do cadastro. Completa: tudo + sócios, CNAEs, Simples/MEI, inscrição estadual, sanções, LEI e o diagrama interativo de vínculos.';
  }
  async function buscarPessoa(nome, doc) {
    const out = q('#eOut'), list = q('#eList'); list.innerHTML = ''; q('#eErr').textContent = '';
    out.innerHTML = '<div class="card"><p class="mut">⏳ Procurando as empresas desta pessoa… (pode levar até 1 minuto)</p></div>';
    try {
      const r = await api('/pessoa', { method: 'POST', body: JSON.stringify({ nome, doc, uf: q('#eUf').value }) });
      if (!r.pessoas.length) { out.innerHTML = `<div class="card"><p>Nenhum vínculo societário encontrado para “${esc(nome)}”${q('#eUf').value ? ' em ' + q('#eUf').value : ''}. Confira o nome completo (como no documento) ou tire o filtro de estado.</p>${(r.avisos || []).map(a => `<p class="mut">ℹ ${esc(a)}</p>`).join('')}</div>`; return; }
      out.innerHTML = `<article class="card eres"><div class="ehead"><div><h2>👤 ${esc(r.nome.toUpperCase())}</h2><p class="mut">${r.pessoas.length > 1 ? `${r.pessoas.length} pessoas diferentes com este nome (separadas pelo CPF mascarado).` : 'Vínculos societários públicos.'}</p></div></div>
        ${(r.avisos || []).length ? `<ul class="ealert">${r.avisos.map(a => `<li class="info">ℹ ${esc(a)}</li>`).join('')}</ul>` : ''}
        ${r.pessoas.map((p, i) => `<section class="epes"><h3>${r.pessoas.length > 1 ? `Pessoa ${i + 1} · ` : ''}CPF ${esc(p.doc)}${p.faixaEtaria ? ' · ' + esc(p.faixaEtaria) : ''}</h3>
          <div class="egrid">${kv('Empresas', p.empresas.length)}${kv('Ativas', p.ativas)}${kv('Administra / dirige', p.administra)}${kv('Primeira entrada', dt(p.empresas.map(x => x.entrada).filter(Boolean).sort()[0]))}</div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Cargo</th><th>Desde</th><th>Situação</th><th>Cidade</th><th>Atividade</th></tr></thead><tbody>${p.empresas.map(x => `<tr><td><b>${esc(x.razao || '')}</b>${x.fantasia ? `<br><small class="mut">${esc(x.fantasia)}</small>` : ''}</td><td><button type="button" class="lnk" data-cnpj="${x.cnpj}" data-modo="completa">${E.fmtCnpj(x.cnpj)}</button></td><td>${esc(x.qualificacao || '—')}</td><td>${dt(x.entrada)}</td><td class="${sitCls(x.situacao)}">${esc(x.situacao || '—')}</td><td>${esc([x.municipio, x.uf].filter(Boolean).join(' / '))}</td><td><small>${esc(x.cnae || '—')}</small></td></tr>`).join('')}</tbody></table></div>
          <div class="erede" id="ePesG${i}"></div></section>`).join('')}
        <p class="mut" style="font-size:12px">${esc(r.fonte || '')} Só dados societários públicos: o NEXORA não busca endereço, telefone ou outros dados pessoais (LGPD).</p></article>`;
      r.pessoas.forEach((p, i) => { const g = grafoPessoa(r, p); g.nodes[0].raiz = true; diagrama(g, '#ePesG' + i, 'Pessoa consultada'); });
      out.querySelector('h2').setAttribute('tabindex', '-1'); out.querySelector('h2').focus({ preventScroll: true }); out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { out.innerHTML = `<div class="card"><p class="bad" role="alert">${esc(e.message)}</p></div>`; }
  }
  function enviar(modo) {
    if ((document.querySelector('input[name=eTipo]:checked') || {}).value === 'pes') {
      const v = q('#eQ').value.trim(), c = q('#eCpf').value.trim(); q('#eErr').textContent = '';
      if (E.normNome(v).split(' ').length < 2) { q('#eErr').textContent = 'Digite o nome completo (nome e sobrenome).'; q('#eQ').focus(); return; }
      if (c && !(E.cpfOk(c) || /^\*{3}\d{6}\*{2}$/.test(c.replace(/[^0-9*]/g, '')))) { q('#eErr').textContent = 'CPF inválido: confira os 11 números (ou deixe em branco).'; q('#eCpf').focus(); return; }
      return buscarPessoa(v, c);
    }
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
  document.getElementById('v-empresas').addEventListener('submit', ev => { const f = ev.target.closest('[data-trdoc]'); if (!f) return; ev.preventDefault(); LS.set('trDoc:' + f.dataset.trdoc, Object.fromEntries(new FormData(f))); toast('Documentos da transportadora salvos neste aparelho.'); });
  async function statusListas() { const el = q('#eListaSt'); if (!el) return; let t = null, n = 0; try { const r = await fetch('/api/empresas/listas'); if (r.ok && (r.headers.get('content-type') || '').includes('json')) { const j = await r.json(); if (j.listaSuja) { t = j.listaSuja.t; n = j.listaSuja.qtd; } } } catch (e) { /* sem servidor */ } const l = LS.get('listaSuja', null); if (!t && l) { t = l.t; n = l.lista.length; } el.innerHTML = t ? `<span class="ok">✔ Lista suja carregada: ${n} empregadores (${new Date(t).toLocaleDateString('pt-BR')})</span>` : '<span class="mut">Lista suja ainda não carregada.</span>'; }
  q('#eListaArq').addEventListener('change', async ev => { const f = ev.target.files[0]; if (!f) return; const texto = await f.text(); const lista = E.lerLista(texto);
    if (lista.length < 5) { toast('Não achei CPF/CNPJ nesse arquivo. Abra a planilha oficial e salve como CSV.'); return; }
    let ok = false; try { const r = await fetch('/api/empresas/listas/lista-suja', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, arquivo: f.name }) }); ok = r.ok && (r.headers.get('content-type') || '').includes('json'); } catch (e) { /* sem servidor */ }
    if (!ok) LS.set('listaSuja', { t: Date.now(), lista }); toast(`Lista suja carregada: ${lista.length} empregadores.`); ev.target.value = ''; statusListas(); });
  document.querySelectorAll('input[name=eTipo]').forEach(r => r.addEventListener('change', () => tipoBusca(r.value)));
  q('#eCpf').addEventListener('input', e => { const d = E.dig(e.target.value).slice(0, 11); if (!/\*/.test(e.target.value)) e.target.value = d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/, '$1.$2.$3-$4'); });
  q('#eQ').addEventListener('input', e => { const d = E.dig(e.target.value); if (d.length === 14 && /^[\d\s./-]+$/.test(e.target.value)) e.target.value = E.fmtCnpj(d); });
  document.getElementById('v-empresas').addEventListener('click', e => {
    const b = e.target.closest('[data-cnpj]'); if (b) { e.preventDefault(); tipoBusca('emp'); q('#eQ').value = E.fmtCnpj(b.dataset.cnpj); consultar(b.dataset.cnpj, b.dataset.modo || 'simples'); return; }
    const c = e.target.closest('[data-copy]'); if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.copy).then(() => toast('CNPJ copiado.')); }
  });
    return { open: () => { renderHist(); statusListas(); setTimeout(() => q('#eQ').focus(), 50); }, consultar };
})();
