/* NEXORA — Diesel & Abastecimento: preços de diesel S-10 e S-500 da ANP (Levantamento de Preços de Combustíveis).
 * Fonte oficial e gratuita: planilha semanal "Preços por posto revendedor" (revendas_lpc_*.xlsx) publicada pela ANP.
 * - Verifica a página da ANP ao iniciar e a cada 6 h; baixa só semanas novas (até 8 de uma vez, para montar histórico).
 * - Guarda cada semana em data/combustivel/semanas/*.json e o resumo semanal (Brasil/UF) em historico.json.
 * - Calcula médias, mín./máx., ranking de cidades e a variação de cada posto em relação à semana anterior.
 * - Coordenadas dos postos: API Revendedores da ANP (cadastro oficial), em cache por 30 dias.
 * Dados SEMANAIS (amostra de ~400 municípios), não em tempo real. Licença: dados abertos — "Fonte: ANP".
 */
'use strict';
const fs = require('fs'), path = require('path');
const { lerXlsx } = require('./xlsxler');
const PB = require('./petrobras');

const PAGINA = 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas';
const API_REV = 'https://revendedoresapi.anp.gov.br/v1/combustivel';
const UF_NOME = { ACRE: 'AC', ALAGOAS: 'AL', AMAPA: 'AP', AMAZONAS: 'AM', BAHIA: 'BA', CEARA: 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPIRITO SANTO': 'ES', GOIAS: 'GO', MARANHAO: 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS', 'MINAS GERAIS': 'MG', PARA: 'PA', PARAIBA: 'PB', PARANA: 'PR', PERNAMBUCO: 'PE', PIAUI: 'PI', 'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS', RONDONIA: 'RO', RORAIMA: 'RR', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP', SERGIPE: 'SE', TOCANTINS: 'TO' };
const UFS = new Set(Object.values(UF_NOME));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const r3 = n => Math.round(n * 1000) / 1000;
const num = v => { if (typeof v === 'number') return v; const s = String(v ?? '').replace(/[^\d,.-]/g, ''); if (!s) return NaN; return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); };
const dataIso = v => {
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const s = String(v ?? ''); let m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[0] : '';
};
const PRODUTOS = ['s10', 's500', 'gas', 'gasad', 'etanol', 'gnv'];
const produtoTipo = p => { const n = norm(p); if (n.includes('DIESEL')) return /S\s*-?\s*10\b/.test(n) ? 's10' : 's500'; if (n.includes('GASOLINA')) return n.includes('ADITIV') ? 'gasad' : 'gas'; if (n.includes('ETANOL') || n.includes('ALCOOL')) return 'etanol'; if (n.includes('GNV')) return 'gnv'; return null; };
const produtoDiesel = p => { const t = produtoTipo(p); return t === 's10' || t === 's500' ? t : null; };
const prodOk = v => PRODUTOS.includes(v) ? v : 's10';
const porProd = f => Object.fromEntries(PRODUTOS.map(k => [k, f(k)]));

/* ---------- leitura da planilha "preços por posto" ---------- */
function mapearCabecalho(l) {
  const h = l.map(norm), ach = (...fs) => h.findIndex(c => c && fs.some(f => typeof f === 'string' ? c.includes(f) : f.test(c)));
  return {
    cnpj: ach('CNPJ'), razao: ach('RAZAO'), fantasia: ach('FANTASIA'), endereco: ach('ENDERECO', 'NOME DA RUA', /^RUA$/), numero: ach(/^NUMERO( RUA)?$/, /^N[º°O]?$/), bairro: ach('BAIRRO'), cep: ach(/^CEP$/),
    municipio: ach('MUNICIPIO'), uf: ach(/^ESTADO( - SIGLA)?$/, /^UF$/, /SIGLA/), bandeira: ach('BANDEIRA'), produto: ach('PRODUTO'),
    preco: ach(/PRECO.*REVENDA/, /VALOR DE VENDA/, /^PRECO/), data: ach(/DATA/)
  };
}
function lerSemana(buf) {
  const folhas = lerXlsx(buf);
  for (const f of folhas) {
    const hi = f.linhas.findIndex(l => l && l.some(c => norm(c).includes('CNPJ')) && l.some(c => norm(c).includes('PRODUTO')));
    if (hi < 0) continue;
    const c = mapearCabecalho(f.linhas[hi]);
    if (c.cnpj < 0 || c.produto < 0 || c.preco < 0 || c.municipio < 0 || c.uf < 0) throw new Error('A planilha da ANP mudou de formato: colunas obrigatórias (CNPJ, município, estado, produto, preço) não encontradas.');
    const postos = new Map(); let datas = [];
    for (const l of f.linhas.slice(hi + 1)) {
      if (!l) continue; const tipo = produtoTipo(l[c.produto]); if (!tipo) continue;
      const preco = num(l[c.preco]); if (!(preco > 1 && preco < 30)) continue;
      const cnpj = String(l[c.cnpj] ?? '').replace(/\D/g, '').padStart(14, '0'); if (/^0+$/.test(cnpj)) continue;
      let uf = norm(l[c.uf]); uf = UF_NOME[uf] || uf; if (!UFS.has(uf)) continue;
      const d = c.data >= 0 ? dataIso(l[c.data]) : ''; if (d) datas.push(d);
      let p = postos.get(cnpj);
      if (!p) postos.set(cnpj, p = { c: cnpj, n: String(l[c.fantasia] || l[c.razao] || '').trim(), r: c.razao >= 0 ? String(l[c.razao] || '').trim() : '', b: c.bandeira >= 0 ? String(l[c.bandeira] || '').trim() : '',
        e: [l[c.endereco], l[c.numero], l[c.bairro]].filter(x => x != null && String(x).trim()).join(', '), cep: c.cep >= 0 ? String(l[c.cep] || '') : '', m: norm(l[c.municipio]), u: uf, d });
      p[tipo] = r3(preco); if (d && d > (p.d || '')) p.d = d;
    }
    if (!postos.size) throw new Error('Nenhum preço de combustível encontrado na planilha.');
    datas.sort();
    return { postos: [...postos.values()], dataMin: datas[0] || '', dataMax: datas[datas.length - 1] || '' };
  }
  throw new Error('Planilha sem a tabela de preços por posto (cabeçalho com CNPJ e PRODUTO não encontrado).');
}

/* ---------- estatística ---------- */
function stats(lista, k) { const v = lista.map(p => p[k]).filter(x => x > 0).sort((a, b) => a - b); if (!v.length) return null; const s = v.reduce((a, b) => a + b, 0); return { media: r3(s / v.length), min: v[0], max: v[v.length - 1], mediana: v[v.length >> 1], n: v.length }; }
function agrupa(postos, chave) { const g = {}; for (const p of postos) (g[chave(p)] ||= []).push(p); return g; }
function resumir(sem) {
  const ufs = agrupa(sem.postos, p => p.u), mun = agrupa(sem.postos, p => p.u + '|' + p.m);
  return { inicio: sem.inicio, fim: sem.fim, br: porProd(k => stats(sem.postos, k)), postos: sem.postos.length, municipios: Object.keys(mun).length,
    uf: Object.fromEntries(Object.entries(ufs).map(([u, l]) => [u, porProd(k => stats(l, k))])) };
}

function linksSemanais(html, base) {
  const vistos = new Map();
  html.replace(/href="([^"]*revendas_lpc[^"]*?\.xlsx)[^"]*"/gi, (m, href) => {
    const d = [...href.matchAll(/(\d{4})[-_](\d{2})[-_](\d{2})/g)].map(x => `${x[1]}-${x[2]}-${x[3]}`);
    if (d.length >= 2) { const u = new URL(href.replace(/&amp;/g, '&'), base).href; if (!vistos.has(d[0])) vistos.set(d[0], { inicio: d[0], fim: d[1], url: u }); }
  });
  return [...vistos.values()].sort((a, b) => b.inicio.localeCompare(a.inicio));
}
/* ---------- serviço ---------- */
function createCombustivel(dataDir, opts = {}) {
  const dir = path.join(dataDir, 'combustivel'), semDir = path.join(dir, 'semanas'), HIST = path.join(dir, 'historico.json'), EST = path.join(dir, 'estado.json');
  const pagina = opts.anpPagina || process.env.NEXORA_ANP_PAGINA || PAGINA, apiRev = opts.anpRevendedores || process.env.NEXORA_ANP_REVENDEDORES || API_REV;
  const timeout = opts.timeout || 90000;
  const lerJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const grava = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); };
  let estado = lerJ(EST, { verificadoEm: null, erro: null, ultimaFonte: null }), hist = lerJ(HIST, []), cache = { chave: null, atual: null, anterior: null }, rodando = null;
  const semanaArq = s => path.join(semDir, `${s.inicio}_${s.fim}.json`);
  const semanas = () => hist.slice().sort((a, b) => b.inicio.localeCompare(a.inicio));
  function carregar() {
    const ss = semanas(), k = ss.map(s => s.inicio).join();
    if (cache.chave !== k) cache = { chave: k, atual: ss[0] ? lerJ(semanaArq(ss[0]), null) : null, anterior: ss[1] ? lerJ(semanaArq(ss[1]), null) : null };
    return cache;
  }
  function guardarSemana(sem) {
    grava(semanaArq(sem), sem);
    hist = hist.filter(h => h.inicio !== sem.inicio); hist.push(resumir(sem)); hist.sort((a, b) => a.inicio.localeCompare(b.inicio)); if (hist.length > 156) hist = hist.slice(-156);
    grava(HIST, hist); cache.chave = null;
  }
  async function baixar(url, tipo) {
    const r = await (opts.fetch || fetch)(url, { headers: { 'User-Agent': 'NEXORA/3 (preços públicos ANP)', Accept: tipo || '*/*' }, signal: AbortSignal.timeout(timeout) });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${new URL(url).host}`);
    return Buffer.from(await r.arrayBuffer());
  }
  async function atualizar(motivo = 'agendado') {
    if (rodando) return rodando;
    rodando = (async () => {
      const novas = [];
      try {
        const html = (await baixar(pagina, 'text/html')).toString('utf8');
        const links = linksSemanais(html, pagina);
        if (!links.length) throw new Error('Página da ANP sem links de "preços por posto revendedor" — o site pode ter mudado.');
        const tem = new Set(hist.map(h => h.inicio));
        for (const l of links.filter(l => !tem.has(l.inicio)).slice(0, 8)) {
          try { const s = lerSemana(await baixar(l.url)); guardarSemana({ inicio: l.inicio, fim: l.fim, fonte: l.url, baixadoEm: new Date().toISOString(), ...s }); novas.push(l.inicio); }
          catch (e) { estado.erroSemana = `${l.inicio}: ${e.message}`; }
        }
        estado = { ...estado, verificadoEm: new Date().toISOString(), erro: null, motivo, novas, ultimaFonte: links[0].url };
      } catch (e) { estado = { ...estado, verificadoEm: new Date().toISOString(), erro: e.message, motivo, novas }; }
      grava(EST, estado); return { ...estado };
    })().finally(() => { rodando = null; });
    return rodando;
  }
  function importar(buf, nomeArq) {
    const s = lerSemana(buf); let d = [...String(nomeArq || '').matchAll(/(\d{4})[-_](\d{2})[-_](\d{2})/g)].map(x => `${x[1]}-${x[2]}-${x[3]}`);
    if (d.length < 2) { const ini = new Date((s.dataMin || s.dataMax || new Date().toISOString().slice(0, 10)) + 'T12:00:00Z'); ini.setUTCDate(ini.getUTCDate() - ini.getUTCDay()); const fim = new Date(ini); fim.setUTCDate(fim.getUTCDate() + 6); d = [ini.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)]; }
    const sem = { inicio: d[0], fim: d[1], fonte: 'importado: ' + (nomeArq || 'planilha'), baixadoEm: new Date().toISOString(), ...s };
    guardarSemana(sem); return { inicio: sem.inicio, fim: sem.fim, postos: s.postos.length };
  }

  /* coordenadas pela API Revendedores (cadastro ANP) */
  const geoMem = {};
  async function geo(uf) {
    const f = path.join(dir, `geo_${uf}.json`), c = geoMem[uf] || lerJ(f, null);
    if (c && Date.now() - c.em < 30 * 864e5) return (geoMem[uf] = c).mapa;
    const mapa = {}; let pag = 1, total = 1;
    const achaLista = o => Array.isArray(o) ? o : o && typeof o === 'object' ? Object.values(o).map(achaLista).find(Boolean) : null;
    while (pag <= total && pag <= 12) {
      const j = JSON.parse((await baixar(`${apiRev}?uf=${uf}&numeropagina=${pag}`, 'application/json')).toString('utf8'));
      const tp = j && Object.entries(j).find(([k, v]) => /pagina/i.test(k) && /total|quant/i.test(k) && typeof v === 'number'); if (tp) total = tp[1];
      const lista = achaLista(j) || []; if (!lista.length) break;
      for (const o of lista) {
        const ks = Object.keys(o), cn = ks.find(k => /cnpj/i.test(k)), la = ks.find(k => /^latitude$/i.test(k)) || ks.find(k => /lat/i.test(k)), lo = ks.find(k => /^longitude$/i.test(k)) || ks.find(k => /lon|lng/i.test(k));
        const lat = num(o[la]), lon = num(o[lo]);
        if (cn && lat && lon && Math.abs(lat) <= 34 && lon < -28 && lon > -75) mapa[String(o[cn]).replace(/\D/g, '').padStart(14, '0')] = [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5];
      }
      pag++;
    }
    geoMem[uf] = { em: Date.now(), mapa }; grava(f, geoMem[uf]); return mapa;
  }

  /* ---------- mercado: dólar (PTAX/BCB), Brent (FRED/EIA) e preço Petrobras (anúncios, cadastro manual) ---------- */
  const MERC = path.join(dir, 'mercado.json'), PETRO = path.join(dir, 'petrobras.json');
  const bcb = opts.bcbPtax || process.env.NEXORA_BCB_PTAX || 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo';
  const fred = opts.fredCsv || process.env.NEXORA_FRED_CSV || 'https://fred.stlouisfed.org/graph/fredgraph.csv';
  /* valores confirmados em comunicados oficiais da Petrobras (preço médio do diesel A às distribuidoras, R$/L, sem tributos) */
  const PETRO_INI = [{ data: '2026-03-14', preco: 3.65, obs: 'Reajuste de R$ 0,38/L (comunicado Petrobras 13/03/2026)', origem: 'comunicado' }, { data: '2026-06-01', preco: 3.30, obs: 'Desconto de R$ 0,3515/L — subvenção federal (comunicado 31/05/2026)', origem: 'comunicado', link: 'https://agencia.petrobras.com.br/w/negocio/petrobras-informa-sobre-desconto-nos-pre%C3%A7os-de-diesel' }];
  let merc = lerJ(MERC, { dolar: [], brent: [], em: null, erros: {} }), petro = lerJ(PETRO, null) || PETRO_INI.slice(), mercRodando = null;
  const PAUTO = path.join(dir, 'petrobras-auto.json');
  let pauto = lerJ(PAUTO, { vistos: [], pendentes: [], fontes: {}, sintese: null, em: null }), petroRodando = null;
  const agenciaLista = opts.agenciaLista || process.env.NEXORA_AGENCIA_LISTA || 'https://agencia.petrobras.com.br/listar-editoria?delta=40';
  const sinteseBase = opts.sinteseBase || process.env.NEXORA_SINTESE_BASE || 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arq-sintese-semanal';
  const petroOrd = () => petro.slice().sort((a, b) => a.data.localeCompare(b.data));
  const vigenteEm = d => { let r = null; for (const x of petroOrd()) { if (x.data > d) break; r = x; } return r; };
  async function atualizarPetro(motivo = 'agendado') {
    if (petroRodando) return petroRodando;
    petroRodando = (async () => {
      const agora = new Date().toISOString(), novos = [];
      /* 2) síntese ANP primeiro (serve de referência para validar o comunicado) */
      try {
        const hoje = new Date(); let achou = null, tent = [];
        for (let k = 0; k < 5 && !achou; k++) {
          const nn = String(PB.semanaAno(new Date(hoje - k * 7 * 864e5))).padStart(2, '0'), u = `${sinteseBase}/${hoje.getUTCFullYear()}/sintese-precos-${nn}.pdf`; tent.push(nn);
          try { const r = PB.extrairSintese(PB.textoPdf(await baixar(u, 'application/pdf'))); if (r) achou = { ...r, url: u, em: agora }; } catch (e) { /* próxima semana */ }
        }
        if (!achou) throw new Error(`não foi possível ler a síntese (edições tentadas: ${tent.join(', ')})`);
        pauto.sintese = achou; pauto.fontes.sintese = { ok: true, em: agora, info: `semana de ${achou.realizacao ? achou.realizacao.semana : achou.ppi.semana}` };
      } catch (e) { pauto.fontes.sintese = { ...(pauto.fontes.sintese || {}), ok: false, erroEm: agora, erro: e.message }; }
      /* 1) comunicados da Agência Petrobras */
      try {
        const lista = PB.linksAgencia((await baixar(agenciaLista, 'text/html')).toString('utf8'), agenciaLista);
        const vistos = new Set(pauto.vistos), alvo = lista.filter(u => !vistos.has(u)).slice(0, 8);
        for (const u of alvo) {
          let txt; try { txt = PB.textoHtml((await baixar(u, 'text/html')).toString('utf8')); } catch (e) { continue; }
          pauto.vistos.push(u);
          const pub = PB.dataPublicacao(txt), r = PB.extrairComunicado(txt, pub); if (!r) continue;
          const ult = vigenteEm(new Date(Date.parse(r.vigencia + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10)) || petroOrd().pop();
          const preco = r.preco || (ult && r.delta != null ? r3(ult.preco + r.delta) : null); if (!preco) continue;
          if (petro.some(x => x.data === r.vigencia && Math.abs(x.preco - preco) < 0.011)) continue;
          const novo = { preco: r3(preco), anterior: r.anterior, vigencia: r.vigencia, confianca: r.confianca };
          const motivos = PB.validar(novo, ult, pauto.sintese && pauto.sintese.realizacao);
          const reg = { data: r.vigencia, preco: novo.preco, obs: `Detectado no comunicado da Petrobras${pub ? ' de ' + pub.split('-').reverse().join('/') : ''}`, origem: 'comunicado', link: u, trecho: r.trecho };
          if (!motivos.length) { petro = petro.filter(x => x.data !== reg.data); petro.push(reg); novos.push(reg); }
          else if (!pauto.pendentes.some(x => x.link === u)) pauto.pendentes.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...reg, motivos, em: agora });
        }
        pauto.vistos = pauto.vistos.slice(-300);
        pauto.fontes.agencia = { ok: true, em: agora, info: `${lista.length} notícia(s) de preço na lista, ${alvo.length} nova(s) lida(s)` };
      } catch (e) { pauto.fontes.agencia = { ...(pauto.fontes.agencia || {}), ok: false, erroEm: agora, erro: e.message }; }
      if (novos.length) grava(PETRO, petro);
      pauto.em = agora; pauto.motivo = motivo; grava(PAUTO, pauto); return { novos, pendentes: pauto.pendentes.length };
    })().finally(() => { petroRodando = null; });
    return petroRodando;
  }
  function decidirPendente(id, aprovar) {
    const p = pauto.pendentes.find(x => x.id === id); if (!p) throw Object.assign(new Error('Pendência não encontrada.'), { status: 404 });
    pauto.pendentes = pauto.pendentes.filter(x => x.id !== id);
    if (aprovar) { petro = petro.filter(x => x.data !== p.data); petro.push({ data: p.data, preco: p.preco, obs: p.obs + ' (confirmado por você)', origem: 'comunicado', link: p.link }); grava(PETRO, petro); }
    grava(PAUTO, pauto);
  }
  const mdy = d => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
  async function atualizarMercado() {
    if (mercRodando) return mercRodando;
    mercRodando = (async () => {
      const erros = {}, ini = new Date(Date.now() - 400 * 864e5), fim = new Date();
      try {
        const u = `${bcb}(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${mdy(ini)}'&@dataFinalCotacao='${mdy(fim)}'&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;
        const j = JSON.parse((await baixar(u, 'application/json')).toString('utf8'));
        const l = (j.value || []).map(v => ({ d: String(v.dataHoraCotacao).slice(0, 10), v: r3(+v.cotacaoVenda * 10) / 10 })).filter(x => x.v > 0);
        if (!l.length) throw new Error('resposta sem cotações'); merc.dolar = l;
      } catch (e) { erros.dolar = 'Banco Central (PTAX): ' + e.message; }
      try {
        const t = (await baixar(`${fred}?id=DCOILBRENTEU&cosd=${ini.toISOString().slice(0, 10)}`, 'text/csv')).toString('utf8');
        const l = t.trim().split(/\r?\n/).slice(1).map(x => x.split(',')).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x[0]) && +x[1] > 0).map(x => ({ d: x[0], v: +x[1] }));
        if (!l.length) throw new Error('arquivo sem cotações'); merc.brent = l;
      } catch (e) { erros.brent = 'Brent (FRED/EIA): ' + e.message; }
      merc = { ...merc, em: new Date().toISOString(), erros }; grava(MERC, merc); return merc;
    })().finally(() => { mercRodando = null; });
    return mercRodando;
  }
  const naData = (l, d) => { let r = null; for (const x of l) { if (x.d > d) break; r = x; } return r; };
  const varPct = (l, dias) => { if (l.length < 2) return null; const u = l[l.length - 1], ref = naData(l, new Date(Date.parse(u.d) - dias * 864e5).toISOString().slice(0, 10)); return ref ? r3((u.v / ref.v - 1) * 100) : null; };
  function mercado() {
    const pts = petro.slice().sort((a, b) => a.data.localeCompare(b.data)), d = merc.dolar, b = merc.brent;
    const dU = d[d.length - 1] || null, bU = b[b.length - 1] || null, dB = bU ? naData(d, bU.d) || dU : null;
    const brentRs = b.map(x => { const c = naData(d, x.d); return c ? { d: x.d, v: r3(x.v * c.v) } : null; }).filter(Boolean);
    const alertas = [], bR7 = varPct(brentRs, 7), bR30 = varPct(brentRs, 30), d7 = varPct(d, 7);
    if (bR7 != null && Math.abs(bR7) >= 5) alertas.push({ tipo: bR7 > 0 ? 'alta' : 'queda', tx: `Petróleo em reais ${bR7 > 0 ? 'subiu' : 'caiu'} ${Math.abs(bR7).toFixed(1).replace('.', ',')}% em 7 dias — reajustes da Petrobras e da bomba costumam vir nas semanas seguintes.` });
    else if (bR30 != null && Math.abs(bR30) >= 10) alertas.push({ tipo: bR30 > 0 ? 'alta' : 'queda', tx: `Petróleo em reais ${bR30 > 0 ? 'subiu' : 'caiu'} ${Math.abs(bR30).toFixed(1).replace('.', ',')}% em 30 dias — pressão de ${bR30 > 0 ? 'alta' : 'baixa'} no diesel.` });
    if (d7 != null && Math.abs(d7) >= 3) alertas.push({ tipo: d7 > 0 ? 'alta' : 'queda', tx: `Dólar ${d7 > 0 ? 'subiu' : 'caiu'} ${Math.abs(d7).toFixed(1).replace('.', ',')}% em 7 dias.` });
    /* 4) dedução: bomba subiu/caiu forte sem reajuste detectado */
    const hs = hist.slice(-2);
    if (hs.length === 2 && hs[0].br.s10 && hs[1].br.s10) {
      const dif = hs[1].br.s10.media - hs[0].br.s10.media, recente = pts.some(x => x.data > new Date(Date.parse(hs[1].fim) - 21 * 864e5).toISOString().slice(0, 10));
      if (Math.abs(dif) >= 0.15 && !recente) alertas.push({ tipo: dif > 0 ? 'alta' : 'queda', tx: `O diesel S-10 na bomba ${dif > 0 ? 'subiu' : 'caiu'} R$ ${Math.abs(dif).toFixed(2).replace('.', ',')} na última semana e nenhum reajuste da Petrobras foi registrado — pode haver um anúncio não capturado. Confira a Agência Petrobras.` });
    }
    const sint = pauto.sintese, ppi = sint && sint.ppi ? { ...sint.ppi, defasagem: r3((sint.ppi.ppi / sint.ppi.realizacao - 1) * 100) } : null;
    if (ppi && Math.abs(ppi.defasagem) >= 10) alertas.push({ tipo: ppi.defasagem > 0 ? 'alta' : 'queda', tx: `Preço de importação (PPI) ${ppi.defasagem > 0 ? 'acima' : 'abaixo'} do preço das refinarias em ${Math.abs(ppi.defasagem).toFixed(1).replace('.', ',')}% (ANP, semana de ${ppi.semana.split('-').reverse().join('/')}) — pressão por ${ppi.defasagem > 0 ? 'aumento' : 'redução'} da Petrobras.` });
    return { petroAuto: { em: pauto.em, fontes: pauto.fontes, pendentes: pauto.pendentes, sintese: sint ? { realizacao: sint.realizacao || null, url: sint.url } : null, ppi }, em: merc.em, erros: merc.erros, dolar: { atual: dU, var7: d7, var30: varPct(d, 30), serie: d.slice(-260) }, brent: { atual: bU, dolarDoDia: dB, emReais: bU && dB ? r3(bU.v * dB.v) : null, porLitroRs: bU && dB ? r3(bU.v * dB.v / 158.987) : null, var7: varPct(b, 7), var30: varPct(b, 30), serie: b.slice(-260), serieRs: brentRs.slice(-260) }, petrobras: pts, alertas };
  }
  function salvarPetro(o) {
    const data = String(o.data || '').slice(0, 10), preco = num(o.preco);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.'); if (!(preco > 0.5 && preco < 20)) throw new Error('Preço inválido (R$ por litro, ex.: 3,30).');
    petro = petro.filter(x => x.data !== data); petro.push({ data, preco: r3(preco), obs: String(o.obs || '').slice(0, 200), origem: 'manual' }); grava(PETRO, petro);
  }

  /* agenda: verifica ao iniciar e a cada 6 h (só baixa se houver semana nova) */
  if (opts.agendar !== false && process.env.NEXORA_COMBUSTIVEL !== 'off' && !process.env.NODE_TEST_CONTEXT) {
    const t0 = setTimeout(() => { const v = estado.verificadoEm ? Date.parse(estado.verificadoEm) : 0; if (Date.now() - v > 6 * 36e5 || !hist.length) atualizar('inicio'); if (!merc.em || Date.now() - Date.parse(merc.em) > 6 * 36e5) atualizarMercado(); if (!pauto.em || Date.now() - Date.parse(pauto.em) > 20 * 36e5) atualizarPetro('inicio'); }, 4000);
    const t1 = setInterval(() => { atualizar('agendado'); atualizarMercado(); }, 6 * 36e5);
    /* Petrobras: 1x por dia; de hora em hora quando petróleo/dólar se movem forte (reajuste provável) */
    const t2 = setInterval(() => { let forte = false; try { forte = mercado().alertas.length > 0; } catch (e) { /* segue */ } if (forte || !pauto.em || Date.now() - Date.parse(pauto.em) > 20 * 36e5) atualizarPetro(forte ? 'alerta' : 'diario'); }, 36e5);
    t0.unref(); t1.unref(); t2.unref();
  }

  function postosFiltrados(q) {
    const { atual, anterior } = carregar(); if (!atual) return [];
    const ant = new Map((anterior?.postos || []).map(p => [p.c, p])), uf = (q.get('uf') || '').toUpperCase(), mun = norm(q.get('municipio')), prod = prodOk(q.get('produto')), b = norm(q.get('busca'));
    return atual.postos.filter(p => p[prod] && (!uf || p.u === uf) && (!mun || p.m === mun) && (!b || norm(p.n + ' ' + p.r + ' ' + p.b + ' ' + p.e).includes(b)))
      .map(p => { const a = ant.get(p.c); return { ...p, var: a && a[prod] ? r3(p[prod] - a[prod]) : null }; });
  }
  function resumo() {
    const { atual, anterior } = carregar(); if (!atual) return null;
    const h = hist.find(x => x.inicio === atual.inicio) || resumir(atual), mun = agrupa(atual.postos, p => p.u + '|' + p.m);
    const cidades = k => Object.entries(mun).map(([key, l]) => { const s = stats(l, k); const [u, m] = key.split('|'); return s && { u, m, ...s }; }).filter(Boolean).sort((a, b) => a.media - b.media);
    const ant = new Map((anterior?.postos || []).map(p => [p.c, p]));
    const mud = []; for (const p of atual.postos) { const a = ant.get(p.c); if (!a) continue; for (const k of PRODUTOS) if (p[k] && a[k] && p[k] !== a[k]) mud.push({ c: p.c, n: p.n, m: p.m, u: p.u, b: p.b, prod: k, de: a[k], para: p[k], var: r3(p[k] - a[k]), pct: r3((p[k] / a[k] - 1) * 100) }); }
    mud.sort((a, b) => b.pct - a.pct);
    const prev = anterior ? hist.find(x => x.inicio === anterior.inicio) : null;
    return { semana: { inicio: atual.inicio, fim: atual.fim, coleta: [atual.dataMin, atual.dataMax], fonte: atual.fonte, baixadoEm: atual.baixadoEm }, br: h.br, brAnterior: prev ? prev.br : null, uf: h.uf, ufAnterior: prev ? prev.uf : null,
      postos: h.postos, municipios: h.municipios, cidades: porProd(k => { const c = cidades(k); return { baratas: c.slice(0, 10), caras: c.slice(-10).reverse() }; }),
      mudancas: { altas: mud.filter(x => x.pct > 0).slice(0, 15), quedas: mud.filter(x => x.pct < 0).slice(-15).reverse(), porProd: porProd(k => { const m = mud.filter(x => x.prod === k); return { altas: m.filter(x => x.pct > 0).slice(0, 15), quedas: m.filter(x => x.pct < 0).slice(-15).reverse(), total: m.length }; }), total: mud.length, comparados: anterior ? atual.postos.filter(p => ant.has(p.c)).length : 0 },
      historico: hist.map(x => ({ inicio: x.inicio, fim: x.fim, ...porProd(k => x.br[k]?.media ?? null), uf: Object.fromEntries(Object.entries(x.uf).map(([u, v]) => [u, porProd(k => v[k]?.media ?? null)])) })) };
  }

  const json = (res, SEC, code, o) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  function corpo(req, max) { return new Promise((ok, no) => { const parts = []; let n = 0; req.on('data', d => { n += d.length; if (n > max) { no(Object.assign(new Error('Arquivo grande demais (máx. 40 MB).'), { status: 413 })); req.destroy(); } else parts.push(d); }); req.on('end', () => ok(Buffer.concat(parts))); req.on('error', no); }); }
  async function handle(req, res, p, SEC) {
    const u = new URL(req.url, 'http://x'), q = u.searchParams, rota = p.replace(/^\/api\/combustivel\/?/, '');
    try {
      if (req.method === 'GET' && rota === 'status') return json(res, SEC, 200, { ...estado, semanas: hist.length, ultima: hist.length ? { inicio: hist[hist.length - 1].inicio, fim: hist[hist.length - 1].fim } : null, atualizando: !!rodando, fonte: pagina });
      if (req.method === 'GET' && rota === 'resumo') { const r = resumo(); return r ? json(res, SEC, 200, r) : json(res, SEC, 404, { erro: 'Ainda não há dados. Clique em "Atualizar agora" ou importe a planilha semanal da ANP.', estado }); }
      if (req.method === 'GET' && rota === 'postos') {
        const l = postosFiltrados(q), prod = prodOk(q.get('produto')), ord = q.get('ordem');
        l.sort(ord === 'caro' ? (a, b) => b[prod] - a[prod] : ord === 'var' ? (a, b) => (b.var ?? -99) - (a.var ?? -99) : ord === 'nome' ? (a, b) => a.n.localeCompare(b.n) : (a, b) => a[prod] - b[prod]);
        const lim = Math.min(Math.max(+q.get('limite') || 300, 1), 3000);
        return json(res, SEC, 200, { total: l.length, stats: stats(l, prod), postos: l.slice(0, lim) });
      }
      if (req.method === 'GET' && rota === 'municipios') { const { atual } = carregar(); const uf = (q.get('uf') || '').toUpperCase(); const s = new Set((atual?.postos || []).filter(p => !uf || p.u === uf).map(p => p.m)); return json(res, SEC, 200, [...s].sort()); }
      if (req.method === 'GET' && rota === 'geo') { const uf = (q.get('uf') || '').toUpperCase(); if (!UFS.has(uf)) return json(res, SEC, 400, { erro: 'Informe a UF.' }); try { return json(res, SEC, 200, await geo(uf)); } catch (e) { return json(res, SEC, 502, { erro: 'API Revendedores da ANP indisponível: ' + e.message }); } }
      if (req.method === 'POST' && rota === 'atualizar') return json(res, SEC, 200, await atualizar('manual'));
      if (req.method === 'GET' && rota === 'mercado') return json(res, SEC, 200, mercado());
      if (req.method === 'POST' && rota === 'mercado/atualizar') { await atualizarMercado(); return json(res, SEC, 200, mercado()); }
      if (req.method === 'POST' && rota === 'petrobras/verificar') { await atualizarPetro('manual'); return json(res, SEC, 200, mercado()); }
      if (/^petrobras\/pendente\/[\w]+$/.test(rota) && (req.method === 'POST' || req.method === 'DELETE')) { decidirPendente(rota.split('/')[2], req.method === 'POST'); return json(res, SEC, 200, mercado()); }
      if (req.method === 'POST' && rota === 'petrobras') { const b = await corpo(req, 10000); let o; try { o = JSON.parse(b.toString('utf8')); } catch (e) { throw new Error('JSON inválido.'); } salvarPetro(o); return json(res, SEC, 200, mercado()); }
      if (req.method === 'DELETE' && /^petrobras\/\d{4}-\d{2}-\d{2}$/.test(rota)) { const d = rota.slice(10); petro = petro.filter(x => x.data !== d); grava(PETRO, petro); return json(res, SEC, 200, mercado()); }
      if (req.method === 'POST' && rota === 'importar') { const b = await corpo(req, 40 * 1024 * 1024); return json(res, SEC, 200, importar(b, q.get('nome'))); }
      return json(res, SEC, 404, { erro: 'Rota não encontrada.' });
    } catch (e) { return json(res, SEC, e.status || 400, { erro: e.message }); }
  }
  return { handle, atualizar, atualizarMercado, atualizarPetro, mercado, importar, resumo, lerSemana };
}
module.exports = { createCombustivel, lerSemana, linksSemanais, produtoDiesel, produtoTipo, PRODUTOS, dataIso, num };
