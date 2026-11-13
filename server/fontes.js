/*
 * NEXORA — fontes oficiais extras para a consulta completa (todas gratuitas).
 *   ANTT (dados.antt.gov.br, CKAN):  RNTRC do transportador, frota cadastrada, habilitação TRIC (internacional) e OTM (multimodal)
 *   IBAMA (dadosabertos.ibama.gov.br): termos de embargo ambiental
 *   OFAC (Tesouro dos EUA) e Conselho de Segurança da ONU: listas de sanções internacionais (baixadas 1x por dia)
 *   Lista suja do trabalho escravo (MTE): planilha oficial carregada pelo usuário (o arquivo muda de endereço a cada edição)
 * Tudo com cache em disco; se uma fonte cair, a consulta segue e mostra o aviso.
 */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('../public/src/js/core/empresa.js');
const DIA = 864e5;

function createFontes(dataDir, get, getC, setC) {
  const dirL = path.join(dataDir, 'listas');
  const ler = n => { try { return JSON.parse(fs.readFileSync(path.join(dirL, n), 'utf8')); } catch (e) { return null; } };
  const gravar = (n, v) => { fs.mkdirSync(dirL, { recursive: true }); fs.writeFileSync(path.join(dirL, n), JSON.stringify(v)); return v; };

  /* ---------- CKAN (portais de dados abertos do governo) ---------- */
  async function recursos(host, pacote) {
    const k = `ckan:${host}:${pacote}`, c = getC(k, DIA); if (c !== undefined) return c;
    let r = await get(`https://${host}/api/3/action/package_show?id=${encodeURIComponent(pacote)}`, { timeout: 15000 });
    let res = r.status === 200 && r.json && r.json.result ? r.json.result.resources : null;
    if (!res) { /* nome do pacote mudou: procura pelo título */
      r = await get(`https://${host}/api/3/action/package_search?q=${encodeURIComponent(pacote.replace(/-/g, ' '))}&rows=5`, { timeout: 15000 });
      const p = r.status === 200 && r.json && r.json.result && r.json.result.results && r.json.result.results[0]; res = p ? p.resources : null;
    }
    if (!res) return null;
    const lista = res.filter(x => x.datastore_active).sort((a, b) => String(b.created || b.last_modified || '').localeCompare(String(a.created || a.last_modified || ''))).map(x => ({ id: x.id, nome: x.name, data: x.last_modified || x.created }));
    return setC(k, lista);
  }
  /* busca um documento no recurso mais recente; confere os dígitos em qualquer coluna */
  async function procurar(host, pacote, doc, campos) {
    const rs = await recursos(host, pacote); if (!rs || !rs.length) return { erro: 'conjunto de dados não encontrado' };
    const alvo = E.dig(doc), rec = rs[0];
    const tentativas = [...campos.map(c => `filters=${encodeURIComponent(JSON.stringify({ [c]: alvo }))}`), ...campos.map(c => `filters=${encodeURIComponent(JSON.stringify({ [c]: E.fmtCnpj(alvo) }))}`), `q=${alvo}`];
    for (const t of tentativas) {
      const r = await get(`https://${host}/api/3/action/datastore_search?resource_id=${rec.id}&limit=50&${t}`, { timeout: 15000 });
      if (r.status !== 200 || !r.json || !r.json.result) continue;
      const linhas = (r.json.result.records || []).filter(x => Object.values(x).some(v => E.dig(v) === alvo));
      if (linhas.length) return { linhas, base: rec.nome, data: rec.data };
    }
    return { linhas: [], base: rec.nome, data: rec.data };
  }
  const val = (o, ...re) => { for (const r of re) { const k = Object.keys(o).find(x => r.test(x)); if (k && o[k] != null && o[k] !== '') return o[k]; } return null; };

  /* ---------- ANTT ---------- */
  async function antt(cnpj) {
    const k = 'antt:' + cnpj, c = getC(k, DIA); if (c !== undefined) return c;
    const H = 'dados.antt.gov.br', out = {};
    try {
      const r = await procurar(H, 'rntrc', cnpj, ['cpfcnpjtransportador']);
      if (r.erro) out.erro = 'ANTT: ' + r.erro;
      else if (!r.linhas.length) out.naoEncontrado = true;
      else { const x = r.linhas[0]; Object.assign(out, { numero: val(x, /numero_rntrc/i), situacao: val(x, /^situacao_rntrc/i), desde: val(x, /data_primeiro_cadastro/i), dataSituacao: val(x, /data_situacao/i), categoria: val(x, /categoria/i), equiparado: val(x, /equiparado/i), municipio: val(x, /municipio/i), uf: val(x, /^uf$/i) }); }
      out.base = r.base;
    } catch (e) { out.erro = 'ANTT indisponível agora.'; }
    if (!out.naoEncontrado && !out.erro) {
      try { const v = await procurar(H, 'rntrc-dados-de-veiculos', cnpj, ['cpfcnpjtransportador', 'cpf_cnpj_transportador']); if (v.linhas) { out.frota = v.linhas.length; out.veiculos = v.linhas.slice(0, 50).map(x => ({ tipo: val(x, /tipo/i, /especie/i, /carroceria/i), ano: val(x, /ano/i), uf: val(x, /uf/i) })); } } catch (e) { /* opcional */ }
    }
    for (const [campo, pac] of [['tric', 'empresas-habilitadas-ao-transporte-rodoviario-internacional-de-cargas-tric'], ['otm', 'empresas-habilitadas-como-operador-de-transporte-multimodal']]) {
      try { const r = await procurar(H, pac, cnpj, ['cnpj', 'cnpj_empresa']); if (r.linhas) out[campo] = r.linhas.length > 0; } catch (e) { /* opcional */ }
    }
    return setC(k, out);
  }

  /* ---------- IBAMA ---------- */
  async function ibama(cnpj) {
    const k = 'ibama:' + cnpj, c = getC(k, DIA); if (c !== undefined) return c;
    try {
      const r = await procurar('dadosabertos.ibama.gov.br', 'fiscalizacao-termo-de-embargo', cnpj, ['CPF_CNPJ_INFRATOR', 'CPF_CNPJ_EMBARGADO', 'cpf_cnpj_infrator']);
      if (r.erro) return { erro: 'IBAMA: ' + r.erro };
      return setC(k, { lista: r.linhas.slice(0, 20).map(x => ({ numero: val(x, /NUM_TAD|numero/i), data: val(x, /DAT_EMBARGO|DATA_TAD|data/i), municipio: val(x, /MUNICIPIO/i), uf: val(x, /^UF$/i), area: val(x, /QTD_AREA|AREA/i), motivo: val(x, /DES_INFRACAO|DES_TAD|descricao/i), situacao: val(x, /SIT_|situacao/i) })), base: r.base });
    } catch (e) { return { erro: 'IBAMA indisponível agora.' }; }
  }

  /* ---------- sanções internacionais (OFAC + ONU) ---------- */
  async function internacionais() {
    const salvo = ler('internacional.json'); if (salvo && Date.now() - salvo.t < DIA) return salvo;
    const lista = [], avisos = [];
    const sdn = await get('https://www.treasury.gov/ofac/downloads/sdn.csv', { timeout: 30000, texto: true });
    if (sdn.status === 200 && sdn.text) for (const l of sdn.text.split(/\r?\n/)) { const m = l.match(/^(\d+),"([^"]*)","([^"]*)","([^"]*)"/); if (m) lista.push({ nome: m[2].replace(/^(.*), (.*)$/, m[3] === 'individual' ? '$2 $1' : '$1, $2'), tipo: m[3] === 'individual' ? 'PF' : 'PJ', fonte: 'OFAC (EUA)', programa: m[4] }); }
    else avisos.push('OFAC indisponível');
    const un = await get('https://scsanctions.un.org/resources/xml/en/consolidated.xml', { timeout: 30000, texto: true });
    if (un.status === 200 && un.text) for (const [, tag, bloco] of un.text.matchAll(/<(INDIVIDUAL|ENTITY)>([\s\S]*?)<\/\1>/g)) { const n = ['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME'].map(t => (bloco.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1]).filter(Boolean).join(' '); if (n) lista.push({ nome: n, tipo: tag === 'INDIVIDUAL' ? 'PF' : 'PJ', fonte: 'ONU (Conselho de Segurança)' }); }
    else avisos.push('ONU indisponível');
    if (!lista.length) return salvo || { lista: [], avisos, t: 0 };
    return gravar('internacional.json', { t: Date.now(), lista, avisos });
  }

  /* ---------- lista suja (planilha do MTE enviada pelo usuário) ---------- */
  const listaSuja = () => ler('lista-suja.json');
  function salvarListaSuja(texto, nomeArq) {
    const lista = E.lerLista(texto); if (lista.length < 5) { const e = new Error('Não achei CPF/CNPJ nessa planilha. Use o arquivo oficial do Ministério do Trabalho salvo como CSV.'); e.status = 400; throw e; }
    return gravar('lista-suja.json', { t: Date.now(), arquivo: String(nomeArq || '').slice(0, 80), lista });
  }

  /* tudo junto para a consulta completa */
  async function extras(emp) {
    const setor = E.setor(emp);
    const [a, i, int] = await Promise.all([antt(emp.cnpj).catch(() => ({ erro: 'ANTT indisponível' })), ibama(emp.cnpj).catch(() => ({ erro: 'IBAMA indisponível' })), internacionais().catch(() => null)]);
    const ls = listaSuja();
    return { setor, antt: a, ibama: i, listaSuja: ls ? E.naLista(ls.lista, emp) : null, listaSujaData: ls ? ls.t : null, internacional: int ? E.naLista(int.lista, emp) : null, internacionalData: int ? int.t : null };
  }
  return { antt, ibama, internacionais, listaSuja, salvarListaSuja, extras };
}
module.exports = { createFontes };
