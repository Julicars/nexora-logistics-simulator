/*
 * NEXORA — Consulta de empresas (CNPJ) por APIs públicas da base aberta da Receita Federal.
 *
 *   GET  /api/empresas/cnpj/:cnpj          consulta simples (minhareceita.org → BrasilAPI → OpenCNPJ → CNPJ.ws)
 *   GET  /api/empresas/completa/:cnpj      consulta completa (+ CNPJá e CNPJ.ws: Simples/MEI e inscrições estaduais; + sanções se houver chave)
 *   GET  /api/empresas/rede/:cnpj?uf=SP    rede de vínculos: empresas ligadas pelos mesmos sócios (1 nível)
 *   POST /api/empresas/busca {nome, uf}    busca por razão social / nome fantasia (Casa dos Dados, até 20 resultados)
 *   POST /api/empresas/pessoa {nome, doc?, uf?}  empresas em que a pessoa é sócia/administradora (nome completo; CPF opcional, vira ***456789**)
 *
 * Cache em data/empresas-cache.json (cadastro 7 dias, buscas 1 dia) para não repetir chamadas.
 * Variáveis opcionais: NEXORA_TRANSPARENCIA_CHAVE (Portal da Transparência: CEIS/CNEP),
 *                      NEXORA_CASADOSDADOS_CHAVE (busca por nome sem o limite da API pública).
 * Só dados públicos: o CPF dos sócios já vem mascarado pela Receita (***123456**).
 */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('../public/src/js/core/empresa.js');
const { createFontes } = require('./fontes.js');

const UA = { 'User-Agent': 'NEXORA/3 (+consulta de CNPJ; dados publicos)', Accept: 'application/json' };
const DIA = 864e5;

function createEmpresas(dataDir, opts = {}) {
  const fetchFn = opts.fetch || globalThis.fetch;
  const file = path.join(dataDir, 'empresas-cache.json');
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { cache = {}; }
  let dirty = false, timer = null;
  const persist = () => { dirty = true; if (timer) return; timer = setTimeout(() => { timer = null; if (!dirty) return; dirty = false;
    const ks = Object.keys(cache); if (ks.length > 3000) ks.sort((a, b) => cache[a].t - cache[b].t).slice(0, ks.length - 3000).forEach(k => delete cache[k]);
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(cache)); fs.renameSync(file + '.tmp', file); } catch (e) { /* cache é opcional */ } }, 1500); if (timer.unref) timer.unref(); };
  const getC = (k, ttl) => { const c = cache[k]; return c && Date.now() - c.t < ttl ? c.v : undefined; };
  const setC = (k, v) => { cache[k] = { t: Date.now(), v }; persist(); return v; };

  /* limite da API pública da CNPJá: 5 consultas por minuto */
  const cnpjaT = [];
  const cnpjaLivre = () => { const now = Date.now(); while (cnpjaT.length && now - cnpjaT[0] > 60000) cnpjaT.shift(); return cnpjaT.length < 5; };

  async function get(url, { timeout = 12000, headers = {}, method = 'GET', body } = {}) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
    try {
      const r = await fetchFn(url, { method, headers: { ...UA, ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: ac.signal });
      const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { j = null; }
      return { status: r.status, json: j, text: txt };
    } catch (e) { return { status: 0, erro: e.name === 'AbortError' ? 'tempo esgotado' : e.message }; } finally { clearTimeout(t); }
  }

  /* ---- cadastro básico, com fontes de reserva ---- */
  async function cadastro(cnpj) {
    const k = 'cnpj:' + cnpj, c = getC(k, 7 * DIA); if (c !== undefined) return c;
    const fontes = [
      ['minhareceita.org', `https://minhareceita.org/${cnpj}`],
      ['BrasilAPI', `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`],
      ['OpenCNPJ', `https://api.opencnpj.org/${cnpj}`],
      ['CNPJ.ws', `https://publica.cnpj.ws/cnpj/${cnpj}`]
    ];
    let nao = 0, erros = [];
    for (const [nome, url] of fontes) {
      const r = await get(url);
      if (r.status === 200 && r.json) { const n = E.normalizar(r.json, nome); if (n && n.cnpj) return setC(k, n); }
      if (r.status === 404 || r.status === 400) nao++; else erros.push(`${nome}: ${r.erro || 'HTTP ' + r.status}`);
    }
    if (nao) return null; /* nenhuma fonte achou (empresa muito nova ou CNPJ inexistente) */
    const er = new Error('Não foi possível consultar agora (' + erros.join('; ') + ').'); er.status = 502; throw er;
  }

  async function cnpja(cnpj) {
    const k = 'cnpja:' + cnpj, c = getC(k, 7 * DIA); if (c !== undefined) return c;
    if (!cnpjaLivre()) return { aviso: 'Limite da API pública da CNPJá (5 por minuto). Tente de novo em instantes para ver Simples/MEI e inscrições estaduais.' };
    cnpjaT.push(Date.now());
    const r = await get(`https://open.cnpja.com/office/${cnpj}`);
    if (r.status === 200 && r.json) return setC(k, E.normalizar(r.json, 'CNPJá'));
    return { aviso: 'CNPJá indisponível agora (' + (r.erro || 'HTTP ' + r.status) + ').' };
  }

  /* CNPJ.ws (pública: 3 por minuto): inscrições estaduais de todos os estados */
  const wsT = [];
  async function cnpjws(cnpj) {
    const k = 'cnpjws:' + cnpj, c = getC(k, 7 * DIA); if (c !== undefined) return c;
    const now = Date.now(); while (wsT.length && now - wsT[0] > 60000) wsT.shift(); if (wsT.length >= 3) return null; wsT.push(now);
    const r = await get(`https://publica.cnpj.ws/cnpj/${cnpj}`); return r.status === 200 && r.json ? setC(k, E.normalizar(r.json, 'CNPJ.ws')) : null;
  }
  const F = createFontes(dataDir, (...a) => get(...a), getC, setC);

  /* Portal da Transparência (CGU): CEIS, CNEP, CEPIM, acordos de leniência e contratos federais — precisa da chave gratuita */
  async function sancoes(cnpj) {
    const chave = process.env.NEXORA_TRANSPARENCIA_CHAVE; if (!chave) return { semChave: true };
    const k = 'sanc2:' + cnpj, c = getC(k, DIA); if (c !== undefined) return c;
    const out = { ceis: [], cnep: [], cepim: [], leniencia: [], contratos: null }, H = { headers: { 'chave-api-dados': chave } };
    const base = 'https://api.portaldatransparencia.gov.br/api-de-dados/';
    const tipo = x => (x.tipoSancao && (x.tipoSancao.descricaoResumida || x.tipoSancao.descricaoPortal)) || x.motivo || 'Registro';
    const org = x => (x.orgaoSancionador && x.orgaoSancionador.nome) || (x.orgaoSuperior && x.orgaoSuperior.nome) || x.orgaoResponsavel || null;
    for (const [t, url] of [['ceis', `ceis?codigoSancionado=${cnpj}&pagina=1`], ['cnep', `cnep?codigoSancionado=${cnpj}&pagina=1`], ['cepim', `cepim?cnpjSancionado=${cnpj}&pagina=1`], ['leniencia', `acordos-leniencia?cnpjSancionado=${cnpj}&pagina=1`]]) {
      const r = await get(base + url, H);
      if (r.status === 200 && Array.isArray(r.json)) out[t] = r.json.map(x => ({ tipo: t === 'leniencia' ? 'Acordo de leniência' : tipo(x), orgao: org(x), inicio: x.dataInicioSancao || x.dataInicioAcordo || x.dataReferencia || null, fim: x.dataFimSancao || x.dataFimAcordo || null }));
      else out.erro = 'Portal da Transparência: ' + (r.erro || 'HTTP ' + r.status);
    }
    const r = await get(base + `contratos/cpf-cnpj?cpfCnpj=${cnpj}&pagina=1`, H);
    if (r.status === 200 && Array.isArray(r.json)) out.contratos = { qtd: r.json.length, mais: r.json.length >= 15, lista: r.json.slice(0, 15).map(x => ({ orgao: (x.unidadeGestora && x.unidadeGestora.orgaoVinculado && x.unidadeGestora.orgaoVinculado.nome) || (x.orgao && x.orgao.nome) || null, objeto: x.objeto || null, valor: x.valorInicialCompra != null ? x.valorInicialCompra : x.valorFinalCompra, inicio: x.dataInicioVigencia || null, fim: x.dataFimVigencia || null })) };
    return setC(k, out);
  }

  /* GLEIF — registro global LEI (sem chave): empresas com operação no mercado financeiro/exterior */
  async function gleif(cnpj) {
    const k = 'lei:' + cnpj, c = getC(k, 7 * DIA); if (c !== undefined) return c;
    const r = await get(`https://api.gleif.org/api/v1/lei-records?filter[entity.registeredAs]=${cnpj}&page[size]=1`, { timeout: 10000 });
    if (r.status !== 200 || !r.json) return null;
    const l = E.lei(r.json); if (!l) return setC(k, { nenhum: true });
    for (const [campo, rel] of [['controladora', 'direct-parent'], ['controladoraFinal', 'ultimate-parent']]) {
      const p = await get(`https://api.gleif.org/api/v1/lei-records/${l.lei}/${rel}`, { timeout: 10000 });
      if (p.status === 200 && p.json) { const x = E.lei(p.json); if (x) l[campo] = { nome: x.nome, lei: x.lei, url: x.url }; }
    }
    return setC(k, l);
  }

  /* Pessoa: empresas em que um nome aparece no quadro societário (dados públicos da Receita; CPF sempre mascarado) */
  async function pessoa(nome, doc, uf) {
    nome = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 90);
    if (E.normNome(nome).split(' ').length < 2) { const e = new Error('Digite o nome completo da pessoa (nome e sobrenome).'); e.status = 400; throw e; }
    uf = /^[A-Z]{2}$/.test(String(uf || '').toUpperCase()) ? String(uf).toUpperCase() : '';
    const mask = doc ? E.mascaraCpf(doc) : null;
    if (doc && !mask) { const e = new Error('CPF inválido: use os 11 números (ou o formato ***456789** da base pública).'); e.status = 400; throw e; }
    const k = `pes:${E.normNome(nome)}:${mask || ''}:${uf}`, c = getC(k, DIA); if (c !== undefined) return c;
    let empresas = [], avisos = [], fonte;
    if (mask) {
      const r = await get(`https://minhareceita.org/?cnpf=${encodeURIComponent(mask)}${uf ? '&uf=' + uf : ''}&limit=200`, { timeout: 25000 });
      if (r.status !== 200 || !r.json) { const e = new Error('Busca por CPF indisponível agora (' + (r.erro || 'HTTP ' + r.status) + ').'); e.status = 502; throw e; }
      empresas = (r.json.data || []).map(x => E.normalizar(x, 'minhareceita.org')); if (r.json.cursor) avisos.push('Há mais empresas além das 200 mostradas: filtre pelo estado.');
      fonte = 'Quadro societário da base aberta da Receita Federal (minhareceita.org), por nome + CPF mascarado.';
    } else {
      const chave = process.env.NEXORA_CASADOSDADOS_CHAVE;
      const body = { busca_textual: [{ texto: [nome], tipo_busca: 'exata', razao_social: false, nome_fantasia: false, nome_socio: true }], ...(uf ? { uf: [uf] } : {}), situacao_cadastral: ['ATIVA', 'BAIXADA', 'INAPTA', 'SUSPENSA', 'NULA'], limite: 20, pagina: 1 };
      const url = chave ? 'https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=simples' : 'https://api.casadosdados.com.br/v5/public/cnpj/pesquisa';
      const r = await get(url, { method: 'POST', body, headers: chave ? { 'api-key': chave } : {}, timeout: 15000 });
      if (r.status !== 200 || !r.json) { const e = new Error('Busca de pessoa por nome indisponível agora (' + (r.erro || 'HTTP ' + r.status) + '). Informe também o CPF para buscar pela base da Receita.'); e.status = 502; throw e; }
      const arr = (function find(o, d) { if (d > 3 || !o || typeof o !== 'object') return null; if (Array.isArray(o) && o.length && o[0] && typeof o[0] === 'object' && 'cnpj' in o[0]) return o; for (const v of Object.values(o)) { const f = find(v, d + 1); if (f) return f; } return null; })(r.json, 0) || [];
      const cnpjs = [...new Set(arr.map(x => E.dig(x.cnpj)).filter(x => x.length === 14))].slice(0, 20), ini = Date.now();
      for (const c of cnpjs) { if (Date.now() - ini > 45000) { avisos.push('Tempo limite: nem todas as empresas foram abertas.'); break; } try { const d = await cadastro(c); if (d) empresas.push(d); } catch (e) { /* segue */ } }
      if ((r.json.total || 0) > cnpjs.length) avisos.push(`A busca achou ${r.json.total} empresas com esse nome de sócio; abrimos as ${cnpjs.length} primeiras. Informe o CPF ou o estado para refinar.`);
      fonte = 'Busca de sócio na Casa dos Dados + quadro societário da Receita Federal. Pessoas com o mesmo nome aparecem separadas pelo CPF mascarado.';
    }
    const pessoas = E.agruparPessoa(nome, empresas, mask);
    return setC(k, { nome, pessoas, avisos, fonte });
  }

  /* empresas onde a mesma pessoa aparece no quadro societário (CPF mascarado + nome) */
  async function porSocio(s, uf) {
    const doc = String(s.doc || '').replace(/[^0-9*]/g, ''); if (!/^\*{3}\d{6}\*{2}$/.test(doc) && !/^\d{14}$/.test(doc)) return { lista: [], aviso: `${s.nome}: documento não informado na base pública.` };
    const k = `soc:${doc}:${uf || '*'}:${s.nome}`, c = getC(k, DIA); if (c !== undefined) return c;
    const r = await get(`https://minhareceita.org/?cnpf=${encodeURIComponent(doc)}${uf ? '&uf=' + uf : ''}&limit=200`, { timeout: 25000 });
    if (r.status !== 200 || !r.json) return { lista: [], aviso: `${s.nome}: busca de vínculos indisponível (${r.erro || 'HTTP ' + r.status}).` };
    const alvo = E.chaveSocio(s);
    const lista = (r.json.data || []).map(x => E.normalizar(x, 'minhareceita.org')).filter(x => x && (x.qsa || []).some(q => E.chaveSocio(q) === alvo));
    return setC(k, { lista, mais: !!r.json.cursor });
  }

  async function rede(cnpj, uf) {
    const base = await cadastro(cnpj); if (!base) return null;
    const ufBusca = uf === 'todas' ? '' : (uf || base.endereco.uf || '');
    const nodes = new Map(), edges = [], avisos = [], ini = Date.now();
    const addN = (id, n) => { if (!nodes.has(id)) nodes.set(id, { id, ...n }); return id; };
    const emp = e => addN('E' + e.cnpj, { tipo: 'empresa', label: e.fantasia || e.razao, razao: e.razao, cnpj: e.cnpj, situacao: e.situacao, uf: e.endereco.uf, municipio: e.endereco.municipio });
    const raiz = emp(base); nodes.get(raiz).raiz = true;
    const socios = (base.qsa || []).slice(0, 12);
    if ((base.qsa || []).length > 12) avisos.push(`Mostrando 12 de ${base.qsa.length} sócios.`);
    for (const s of socios) {
      const sid = addN(E.chaveSocio(s), { tipo: s.tipo, label: s.nome, qualificacao: s.qualificacao, doc: s.doc, faixaEtaria: s.faixaEtaria });
      edges.push({ de: sid, para: raiz, rotulo: s.qualificacao || 'Sócio' });
      if (Date.now() - ini > 60000) { avisos.push('Tempo limite: alguns sócios não foram pesquisados.'); continue; }
      if (s.tipo === 'PJ' && E.dig(s.doc).length === 14) {
        try { const pj = await cadastro(E.dig(s.doc)); if (pj) { nodes.get(sid).cnpj = pj.cnpj; nodes.get(sid).situacao = pj.situacao; nodes.get(sid).uf = pj.endereco.uf;
          for (const q of (pj.qsa || []).slice(0, 8)) { const qid = addN(E.chaveSocio(q), { tipo: q.tipo, label: q.nome, qualificacao: q.qualificacao, doc: q.doc }); edges.push({ de: qid, para: sid, rotulo: q.qualificacao || 'Sócio' }); } } } catch (e) { avisos.push(`${s.nome}: ${e.message}`); }
      }
      const r = await porSocio(s, ufBusca); if (r.aviso) avisos.push(r.aviso); if (r.mais) avisos.push(`${s.nome}: há mais empresas além das mostradas.`);
      for (const e of r.lista.slice(0, 40)) { if (e.cnpj === base.cnpj) continue; const eid = emp(e); const q = e.qsa.find(x => E.chaveSocio(x) === E.chaveSocio(s)); edges.push({ de: sid, para: eid, rotulo: (q && q.qualificacao) || 'Sócio' }); }
    }
    return { base: base.cnpj, ufBusca: ufBusca || 'todas', nodes: [...nodes.values()], edges, avisos, fonte: 'Quadro societário da base aberta da Receita Federal (minhareceita.org). Ligação feita por nome + CPF mascarado: pode haver homônimos raros.' };
  }

  async function busca(nome, uf) {
    nome = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 80); if (nome.length < 3) { const e = new Error('Digite pelo menos 3 letras do nome.'); e.status = 400; throw e; }
    uf = /^[A-Z]{2}$/.test(String(uf || '').toUpperCase()) ? String(uf).toUpperCase() : '';
    const k = `busca:${nome.toUpperCase()}:${uf}`, c = getC(k, DIA); if (c !== undefined) return c;
    const chave = process.env.NEXORA_CASADOSDADOS_CHAVE;
    const body = { busca_textual: [{ texto: [nome], tipo_busca: 'radical', razao_social: true, nome_fantasia: true, nome_socio: false }], ...(uf ? { uf: [uf] } : {}), situacao_cadastral: ['ATIVA', 'BAIXADA', 'INAPTA', 'SUSPENSA', 'NULA'], limite: 20, pagina: 1 };
    const url = chave ? 'https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=simples' : 'https://api.casadosdados.com.br/v5/public/cnpj/pesquisa';
    const r = await get(url, { method: 'POST', body, headers: chave ? { 'api-key': chave } : {}, timeout: 15000 });
    if (r.status !== 200 || !r.json) { const e = new Error('Busca por nome indisponível agora (' + (r.erro || 'HTTP ' + r.status) + '). Use o CNPJ.'); e.status = 502; throw e; }
    const arr = (function find(o, d) { if (d > 3 || !o || typeof o !== 'object') return null; if (Array.isArray(o) && o.length && o[0] && typeof o[0] === 'object' && 'cnpj' in o[0]) return o; for (const v of Object.values(o)) { const f = find(v, d + 1); if (f) return f; } return null; })(r.json, 0) || [];
    const out = { total: r.json.total || arr.length, lista: arr.slice(0, 20).map(x => ({
      cnpj: E.dig(x.cnpj), razao: x.razao_social || x.nome, fantasia: x.nome_fantasia || null,
      situacao: (x.situacao_cadastral && (x.situacao_cadastral.situacao_atual || x.situacao_cadastral)) || x.situacao || null,
      municipio: (x.endereco && x.endereco.municipio) || x.municipio || null, uf: (x.endereco && x.endereco.uf) || x.uf || null,
      abertura: x.data_abertura || x.data_inicio_atividade || null })).filter(x => x.cnpj.length === 14), fonte: 'Casa dos Dados (base aberta da Receita)' };
    return setC(k, out);
  }

  function send(res, SEC, code, obj) { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
  function readBody(req, max = 5000) { return new Promise((ok, no) => { let b = ''; req.on('data', d => { b += d; if (b.length > max) { req.destroy(); no(new Error('grande')); } }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { no(e); } }); }); }

  async function handle(req, res, p, SEC) {
    try {
      const u = new URL(req.url, 'http://x');
      if (p === '/api/empresas/busca' && req.method === 'POST') { const b = await readBody(req); return send(res, SEC, 200, await busca(b.nome, b.uf)); }
      if (p === '/api/empresas/listas' && req.method === 'GET') { const l = F.listaSuja(); return send(res, SEC, 200, { listaSuja: l ? { t: l.t, arquivo: l.arquivo, qtd: l.lista.length } : null }); }
      if (p === '/api/empresas/listas/lista-suja' && req.method === 'POST') { const b = await readBody(req, 8e6); const l = F.salvarListaSuja(b.texto, b.arquivo); return send(res, SEC, 200, { ok: true, qtd: l.lista.length, t: l.t }); }
      if (p === '/api/empresas/pessoa' && req.method === 'POST') { const b = await readBody(req); return send(res, SEC, 200, await pessoa(b.nome, b.doc, b.uf)); }
      const m = p.match(/^\/api\/empresas\/(cnpj|completa|rede)\/([\d./-]+)$/);
      if (!m || req.method !== 'GET') return send(res, SEC, 404, { erro: 'Rota não encontrada.' });
      const cnpj = E.dig(m[2]); if (!E.cnpjOk(cnpj)) return send(res, SEC, 400, { erro: 'CNPJ inválido (confira os dígitos).' });
      if (m[1] === 'rede') { const g = await rede(cnpj, u.searchParams.get('uf')); return g ? send(res, SEC, 200, g) : send(res, SEC, 404, { erro: 'CNPJ não encontrado na base da Receita.' }); }
      const d = await cadastro(cnpj); if (!d) return send(res, SEC, 404, { erro: 'CNPJ não encontrado na base da Receita.' });
      if (m[1] === 'cnpj') return send(res, SEC, 200, { empresa: d, alertas: E.alertas(d) });
      const [x, s, w, l, fx] = await Promise.all([cnpja(cnpj), sancoes(cnpj), cnpjws(cnpj), gleif(cnpj).catch(() => null), F.extras(d).catch(() => null)]);
      const full = { ...d };
      if (x && !x.aviso) { full.simples = { ...d.simples, ...Object.fromEntries(Object.entries(x.simples || {}).filter(([, v]) => v != null)) }; full.inscricoes = x.inscricoes; if (!full.email && x.email) full.email = x.email; full.telefones = [...new Set([...(d.telefones || []), ...(x.telefones || [])])]; }
      if (w) { const ie = new Map((full.inscricoes || []).map(i => [i.uf + i.numero, i])); for (const i of w.inscricoes || []) ie.set(i.uf + i.numero, i); full.inscricoes = [...ie.values()]; if (!full.simples || full.simples.optante == null) full.simples = { ...full.simples, ...w.simples }; }
      const fontes = [x && !x.aviso ? 'CNPJá' : null, w ? 'CNPJ.ws' : null].filter(Boolean);
      return send(res, SEC, 200, { empresa: full, alertas: E.alertas(full), extra: fontes.length ? { fonte: fontes.join(' + ') } : { aviso: (x && x.aviso) || 'Fontes extras indisponíveis agora.' }, sancoes: s, lei: l, links: E.linksOficiais(cnpj), fontes: fx, risco: E.risco(full, { ...(fx || {}), sancoes: s }) });
    } catch (e) { return send(res, SEC, e.status || 500, { erro: e.message || 'Erro na consulta.' }); }
  }
  return { handle, cadastro, rede, busca, pessoa, gleif };
}
module.exports = { createEmpresas };
