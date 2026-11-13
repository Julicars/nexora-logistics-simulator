/* NEXORA — dados de empresas (CNPJ) a partir de APIs públicas da base aberta da Receita Federal.
 * Normaliza as respostas de minhareceita.org / BrasilAPI, OpenCNPJ e CNPJá (API pública) num formato único.
 * Usado no navegador (window.NX_EMP) e no servidor Node (require). Sem dependências.
 */
(function (root) {
  'use strict';
  const dig = s => String(s == null ? '' : s).replace(/\D/g, '');
  /* dígitos verificadores do CNPJ */
  function cnpjOk(c) {
    c = dig(c); if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
    const dv = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +c[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === +c[12] && dv(13) === +c[13];
  }
  const fmtCnpj = c => { c = dig(c).padStart(14, '0'); return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`; };
  const pick = (o, ...ks) => { for (const k of ks) { const v = k.split('.').reduce((a, x) => a == null ? a : a[x], o); if (v !== undefined && v !== null && v !== '') return v; } return null; };
  const up = s => s == null ? null : String(s).trim();
  const tel = (d, n) => { const x = dig(String(d || '') + String(n || '')); return x.length >= 10 ? x : null; };
  const fmtTel = t => { t = dig(t); return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t; };
  const SIT = { 1: 'NULA', 2: 'ATIVA', 3: 'SUSPENSA', 4: 'INAPTA', 8: 'BAIXADA' };
  const TIPO_SOCIO = { 1: 'PJ', 2: 'PF', 3: 'EST' };
  function socio(s) {
    const doc = up(pick(s, 'cnpj_cpf_do_socio', 'cnpj_cpf_socio', 'person.taxId', 'documento'));
    let tipo = TIPO_SOCIO[pick(s, 'identificador_de_socio', 'identificador_socio')] || (pick(s, 'person.type') === 'LEGAL' ? 'PJ' : pick(s, 'person.type') === 'NATURAL' ? 'PF' : null);
    if (!tipo) tipo = dig(doc).length === 14 ? 'PJ' : 'PF';
    return {
      nome: up(pick(s, 'nome_socio', 'nome', 'person.name')) || '—', doc, tipo,
      qualificacao: up(pick(s, 'qualificacao_socio', 'qualificacao', 'role.text')),
      entrada: pick(s, 'data_entrada_sociedade', 'since'), faixaEtaria: up(pick(s, 'faixa_etaria', 'person.age')),
      pais: up(pick(s, 'pais', 'country.name')), representante: up(pick(s, 'nome_representante_legal', 'representante_legal')) || null
    };
  }
  /* formato único */
  function normalizar(r, fonte) {
    if (!r || typeof r !== 'object') return null;
    if (r.taxId && r.company) { /* CNPJá */
      const a = r.address || {};
      return {
        cnpj: dig(r.taxId), razao: up(r.company.name), fantasia: up(r.alias), situacao: up(pick(r, 'status.text')), dataSituacao: r.statusDate || null, motivoSituacao: up(pick(r, 'reason.text')),
        abertura: r.founded || null, natureza: up(pick(r, 'company.nature.text')), porte: up(pick(r, 'company.size.text')), capital: pick(r, 'company.equity'),
        matriz: r.head === true ? 'MATRIZ' : r.head === false ? 'FILIAL' : null,
        cnaePrincipal: r.mainActivity ? { cod: String(r.mainActivity.id), desc: r.mainActivity.text } : null,
        cnaes: (r.sideActivities || []).map(x => ({ cod: String(x.id), desc: x.text })),
        endereco: { logradouro: up(a.street), numero: up(a.number), complemento: up(a.details), bairro: up(a.district), municipio: up(a.city), uf: up(a.state), cep: dig(a.zip) || null },
        telefones: (r.phones || []).map(p => tel(p.area, p.number)).filter(Boolean), email: up(pick(r, 'emails.0.address')),
        simples: { optante: pick(r, 'company.simples.optant'), desde: pick(r, 'company.simples.since'), mei: pick(r, 'company.simei.optant'), meiDesde: pick(r, 'company.simei.since') },
        inscricoes: (r.registrations || []).map(x => ({ uf: x.state, numero: x.number, ativa: x.enabled, tipo: pick(x, 'type.text') })),
        qsa: (pick(r, 'company.members') || []).map(socio), regime: [], fonte: fonte || 'CNPJá'
      };
    }
    if (r.estabelecimento && typeof r.estabelecimento === 'object') { /* CNPJ.ws (publica.cnpj.ws) */
      const b = r.estabelecimento, at = a => a ? { cod: dig(a.subclasse || a.id), desc: a.descricao } : null;
      return {
        cnpj: dig(b.cnpj), razao: up(r.razao_social), fantasia: up(b.nome_fantasia), situacao: up(b.situacao_cadastral), dataSituacao: b.data_situacao_cadastral || null, motivoSituacao: up(pick(b, 'motivo_situacao_cadastral.descricao')),
        abertura: b.data_inicio_atividade || null, natureza: up(pick(r, 'natureza_juridica.descricao')), porte: up(pick(r, 'porte.descricao')), capital: r.capital_social != null ? +r.capital_social : null,
        matriz: up(b.tipo), cnaePrincipal: at(b.atividade_principal), cnaes: (b.atividades_secundarias || []).map(at).filter(Boolean),
        endereco: { logradouro: [up(b.tipo_logradouro), up(b.logradouro)].filter(Boolean).join(' ') || null, numero: up(b.numero), complemento: up(b.complemento), bairro: up(b.bairro), municipio: up(pick(b, 'cidade.nome')), uf: up(pick(b, 'estado.sigla')), cep: dig(b.cep) || null },
        telefones: [tel(b.ddd1, b.telefone1), tel(b.ddd2, b.telefone2)].filter(Boolean), email: up(b.email),
        simples: { optante: pick(r, 'simples.simples') == null ? null : /sim/i.test(r.simples.simples), desde: pick(r, 'simples.data_opcao_simples'), excluido: pick(r, 'simples.data_exclusao_simples'), mei: pick(r, 'simples.mei') == null ? null : /sim/i.test(r.simples.mei), meiDesde: pick(r, 'simples.data_opcao_mei') },
        inscricoes: (b.inscricoes_estaduais || []).map(x => ({ uf: pick(x, 'estado.sigla'), numero: x.inscricao_estadual, ativa: x.ativo })),
        qsa: (r.socios || []).map(x => ({ nome: up(x.nome) || '—', doc: up(x.cpf_cnpj_socio), tipo: /jur/i.test(x.tipo || '') ? 'PJ' : /estrang/i.test(x.tipo || '') ? 'EST' : 'PF', qualificacao: up(pick(x, 'qualificacao_socio.descricao')), entrada: x.data_entrada || null, faixaEtaria: up(x.faixa_etaria), pais: up(pick(x, 'pais.nome')), representante: up(x.nome_representante) || null })),
        regime: [], fonte: fonte || 'CNPJ.ws'
      };
    }
    const sitRaw = pick(r, 'descricao_situacao_cadastral', 'situacao_cadastral', 'situacao');
    const ends = { logradouro: [up(pick(r, 'descricao_tipo_de_logradouro', 'tipo_logradouro')), up(pick(r, 'logradouro'))].filter(Boolean).join(' ') || null, numero: up(pick(r, 'numero')), complemento: up(pick(r, 'complemento')), bairro: up(pick(r, 'bairro')), municipio: up(pick(r, 'municipio')), uf: up(pick(r, 'uf')), cep: dig(pick(r, 'cep')) || null };
    const tels = [tel(null, pick(r, 'ddd_telefone_1')), tel(null, pick(r, 'ddd_telefone_2')), ...((r.telefones || []).map(t => tel(t.ddd, t.numero)))].filter(Boolean);
    const cp = pick(r, 'cnae_fiscal', 'cnae_principal.codigo', 'cnae_principal');
    return {
      cnpj: dig(pick(r, 'cnpj')), razao: up(pick(r, 'razao_social', 'nome')), fantasia: up(pick(r, 'nome_fantasia', 'fantasia')),
      situacao: typeof sitRaw === 'number' ? SIT[sitRaw] : up(sitRaw), dataSituacao: pick(r, 'data_situacao_cadastral'), motivoSituacao: up(pick(r, 'descricao_motivo_situacao_cadastral', 'motivo_situacao_cadastral')),
      abertura: pick(r, 'data_inicio_atividade', 'abertura'), natureza: up(pick(r, 'natureza_juridica')), porte: up(pick(r, 'porte', 'porte_empresa', 'descricao_porte')), capital: pick(r, 'capital_social') != null ? +pick(r, 'capital_social') : null,
      matriz: up(pick(r, 'descricao_identificador_matriz_filial', 'matriz_filial')),
      cnaePrincipal: cp ? { cod: String(typeof cp === 'object' ? cp.codigo : cp), desc: up(pick(r, 'cnae_fiscal_descricao', 'cnae_principal.descricao', 'cnae_principal_descricao')) } : null,
      cnaes: (pick(r, 'cnaes_secundarios') || []).map(x => typeof x === 'object' ? { cod: String(x.codigo), desc: x.descricao } : { cod: String(x), desc: null }).filter(x => x.cod && x.cod !== '0'),
      endereco: ends, telefones: [...new Set(tels)], email: up(pick(r, 'email', 'correio_eletronico')),
      simples: { optante: pick(r, 'opcao_pelo_simples', 'opcao_simples'), desde: pick(r, 'data_opcao_pelo_simples', 'data_opcao_simples'), excluido: pick(r, 'data_exclusao_do_simples'), mei: pick(r, 'opcao_pelo_mei', 'opcao_mei'), meiDesde: pick(r, 'data_opcao_pelo_mei') },
      inscricoes: [], qsa: (pick(r, 'qsa', 'QSA', 'socios') || []).map(socio),
      regime: (r.regime_tributario || []).map(x => ({ ano: x.ano, forma: x.forma_de_tributacao })), fonte: fonte || 'Receita Federal (base aberta)'
    };
  }
  /* sinais de atenção para quem vai contratar ou carregar */
  function alertas(e) {
    const a = [], hoje = new Date();
    if (e.situacao && !/ATIVA/i.test(e.situacao)) a.push(['bad', `Situação cadastral: ${e.situacao}${e.motivoSituacao ? ' (' + e.motivoSituacao + ')' : ''}.`]);
    if (e.abertura) { const m = (hoje - new Date(e.abertura)) / 2.63e9; if (m < 6) a.push(['warn', `Empresa aberta há menos de 6 meses (${new Date(e.abertura).toLocaleDateString('pt-BR')}).`]); }
    if (e.capital != null && e.capital < 10000 && !/MEI/i.test(String(e.simples && e.simples.mei)) ) a.push(['warn', `Capital social baixo: R$ ${Number(e.capital).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`]);
    if (e.simples && e.simples.mei === true) a.push(['warn', 'Empresa MEI: limite de faturamento anual e, para transporte de cargas, só como TAC (caminhoneiro autônomo) com RNTRC.']);
    const tr = [e.cnaePrincipal, ...(e.cnaes || [])].filter(Boolean).some(c => /^49(30|11|12)/.test(c.cod));
    if (!tr) a.push(['info', 'Nenhum CNAE de transporte rodoviário de carga (4930-2). Se for transportadora, confira o RNTRC na ANTT.']);
    else a.push(['ok', 'Tem CNAE de transporte rodoviário de carga. Confira o RNTRC ativo na ANTT antes de contratar.']);
    if (!(e.qsa || []).length && !/EMPRES[AÁ]RIO|INDIVIDUAL/i.test(e.natureza || '')) a.push(['info', 'Quadro de sócios vazio na base pública.']);
    return a;
  }
  /* chave para ligar o mesmo sócio entre empresas: nome + CPF mascarado (***123456**) */
  const chaveSocio = s => (s.tipo === 'PJ' ? 'PJ' + dig(s.doc) : 'PF' + String(s.doc || '').replace(/[^0-9*]/g, '') + '|' + String(s.nome || '').toUpperCase().replace(/\s+/g, ' ').trim());

  /* ---------- pessoas (sócios) ---------- */
  const normNome = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  /* CPF completo → formato mascarado da base pública da Receita (***456789**); já mascarado passa direto */
  function mascaraCpf(v) {
    const t = String(v || '').replace(/[^0-9*]/g, '');
    if (/^\*{3}\d{6}\*{2}$/.test(t)) return t;
    const d = dig(v); if (d.length !== 11) return null;
    return '***' + d.slice(3, 9) + '**';
  }
  function cpfOk(c) {
    c = dig(c); if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +c[9] && dv(10) === +c[10];
  }
  /* agrupa as participações de uma pessoa (mesmo nome + mesmo CPF mascarado) em várias empresas */
  function agruparPessoa(nome, empresas, docFiltro) {
    const alvo = normNome(nome), grupos = new Map();
    for (const e of empresas) {
      if (!e || !e.qsa) continue;
      for (const s of e.qsa) {
        if (s.tipo === 'PJ' || normNome(s.nome) !== alvo) continue;
        const doc = String(s.doc || '').replace(/[^0-9*]/g, '') || '?';
        if (docFiltro && doc !== docFiltro) continue;
        const g = grupos.get(doc) || grupos.set(doc, { nome: s.nome, doc, faixaEtaria: s.faixaEtaria || null, empresas: [] }).get(doc);
        if (!g.faixaEtaria && s.faixaEtaria) g.faixaEtaria = s.faixaEtaria;
        if (!g.empresas.some(x => x.cnpj === e.cnpj)) g.empresas.push({ cnpj: e.cnpj, razao: e.razao, fantasia: e.fantasia, situacao: e.situacao, uf: e.endereco && e.endereco.uf, municipio: e.endereco && e.endereco.municipio, qualificacao: s.qualificacao, entrada: s.entrada, abertura: e.abertura, capital: e.capital, cnae: e.cnaePrincipal ? e.cnaePrincipal.desc : null });
      }
    }
    return [...grupos.values()].map(g => ({ ...g, ativas: g.empresas.filter(x => /ATIVA/i.test(x.situacao || '')).length, administra: g.empresas.filter(x => /ADMIN|DIRETOR|PRESIDENTE|TITULAR/i.test(x.qualificacao || '')).length }))
      .sort((a, b) => b.empresas.length - a.empresas.length);
  }
  /* GLEIF (registro global LEI): resposta JSON:API → resumo */
  function lei(j) {
    const r = j && Array.isArray(j.data) ? j.data[0] : j && j.data; if (!r || !r.attributes) return null;
    const a = r.attributes, en = a.entity || {}, rg = a.registration || {};
    return { lei: r.id || a.lei, nome: en.legalName && en.legalName.name, status: en.status, registro: rg.status, emissao: rg.initialRegistrationDate, renovacao: rg.nextRenewalDate, forma: en.legalForm && en.legalForm.id, url: 'https://search.gleif.org/#/record/' + (r.id || a.lei) };
  }
  /* links oficiais para conferir na hora (certidões e cadastros de transporte) */
  function linksOficiais(cnpj) {
    const c = dig(cnpj);
    return [
      ['Comprovante de inscrição (Receita Federal)', 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=' + c],
      ['Certidão de débitos federais (Receita/PGFN)', 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj'],
      ['Regularidade do FGTS (CRF — Caixa)', 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf'],
      ['Débitos trabalhistas (CNDT — TST)', 'https://cndt-certidao.tst.jus.br/inicio.faces'],
      ['Transportador no RNTRC (ANTT)', 'https://consultapublica.antt.gov.br/Site/ConsultaRNTRC.aspx'],
      ['Inscrição estadual (Sintegra)', 'http://www.sintegra.gov.br/'],
      ['Sanções e contratos (Portal da Transparência)', 'https://portaldatransparencia.gov.br/pessoa-juridica/' + c]
    ];
  }

  /* ---------- setor pela atividade principal (CNAE) ---------- */
  function setor(e) {
    const c = dig(e && e.cnaePrincipal && e.cnaePrincipal.cod).slice(0, 2), n = +c, txt = (e && e.cnaePrincipal && e.cnaePrincipal.desc || '').toLowerCase();
    const todos = [e && e.cnaePrincipal, ...((e && e.cnaes) || [])].filter(Boolean).map(x => dig(x.cod).slice(0, 2));
    const transp = todos.some(x => ['49', '50', '51', '52', '53'].includes(x));
    if ([49, 50, 51, 52, 53].includes(n)) return { id: 'transporte', nome: /armaz|dep[oó]sito|log[ií]st/.test(txt) ? 'Logística / armazenagem' : 'Transportadora', icone: '🚚', transp: true };
    if (n >= 1 && n <= 3) return { id: 'agro', nome: 'Agropecuária', icone: '🌾', transp };
    if (n >= 5 && n <= 9) return { id: 'extracao', nome: 'Mineração / extração', icone: '⛏', transp };
    if (n >= 10 && n <= 33) return { id: 'industria', nome: 'Indústria / fábrica', icone: '🏭', transp };
    if (n >= 41 && n <= 43) return { id: 'construcao', nome: 'Construção', icone: '🏗', transp };
    if (n === 45 || n === 46) return { id: 'atacado', nome: 'Comércio atacadista / distribuidor', icone: '📦', transp };
    if (n === 47) return { id: 'varejo', nome: 'Comércio varejista', icone: '🏪', transp };
    if (n) return { id: 'servicos', nome: 'Serviços', icone: '🧰', transp };
    return { id: '?', nome: 'Atividade não informada', icone: '❔', transp };
  }
  /* nome de empresa sem a forma jurídica, para comparar com listas */
  const nomeBase = s => normNome(s).replace(/\b(LTDA|S ?A|S\/A|EIRELI|ME|EPP|MEI|CIA|COMPANHIA|LIMITADA|SOCIEDADE ANONIMA|EM RECUPERACAO JUDICIAL)\b/g, ' ').replace(/\s+/g, ' ').trim();
  /* procura documentos e nomes numa lista oficial já carregada [{doc, nome, ...}] */
  function naLista(lista, e) {
    if (!Array.isArray(lista) || !e) return [];
    const docs = new Set([dig(e.cnpj), ...((e.qsa || []).map(q => dig(q.doc)).filter(d => d.length === 14))]);
    const nomes = new Set([nomeBase(e.razao), nomeBase(e.fantasia)].filter(x => x && x.length > 4));
    const pessoas = new Set((e.qsa || []).filter(q => q.tipo !== 'PJ').map(q => normNome(q.nome)));
    const out = [];
    for (const x of lista) {
      const d = dig(x.doc);
      if (d && d.length === 14 && docs.has(d)) out.push({ ...x, por: d === dig(e.cnpj) ? 'CNPJ da empresa' : 'CNPJ de empresa sócia' });
      else if (d && d.length === 14 && d.slice(0, 8) === dig(e.cnpj).slice(0, 8)) out.push({ ...x, por: 'outro estabelecimento (mesma raiz de CNPJ)' });
      else if (x.nome && nomes.has(nomeBase(x.nome))) out.push({ ...x, por: 'nome idêntico ao da empresa — confira' });
      else if (x.nome && x.tipo !== 'PJ' && pessoas.has(normNome(x.nome))) out.push({ ...x, por: 'nome idêntico ao de um sócio — confira (pode ser homônimo)' });
    }
    return out;
  }
  /* lê uma planilha (CSV) de lista oficial: acha a coluna de CPF/CNPJ e a de nome */
  function lerLista(texto) {
    const linhas = String(texto || '').split(/\r?\n/).filter(l => l.trim()); if (!linhas.length) return [];
    const sep = [';', ',', '\t'].sort((a, b) => linhas[0].split(b).length - linhas[0].split(a).length)[0];
    const cel = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };
    const rows = linhas.map(cel), out = [];
    for (const r of rows) {
      const iDoc = r.findIndex(c => /^[\d.\/-]+$/.test(c) && [11, 14].includes(dig(c).length) || /^\*{3}[\d.]{6,8}[-*]{1,3}\**$/.test(c.replace(/\s/g, '')));
      if (iDoc < 0) continue;
      const nome = r.filter((c, i) => i !== iDoc && /[A-Za-zÀ-ú]{3,}/.test(c) && !/^\d/.test(c)).sort((a, b) => b.length - a.length)[0] || '';
      const d = dig(r[iDoc]); out.push({ doc: d.length === 14 ? d : r[iDoc], nome: nome.slice(0, 120), tipo: d.length === 14 ? 'PJ' : 'PF', uf: (r.find(c => /^[A-Z]{2}$/.test(c)) || null) });
    }
    return out;
  }
  /* nota de risco 0–100 (quanto maior, mais atenção) com os motivos */
  function risco(e, x = {}) {
    const m = []; let p = 0; const add = (v, t) => { p += v; m.push([v, t]); };
    if (!/ATIVA/i.test(e.situacao || '')) add(60, `Situação na Receita: ${e.situacao || 'desconhecida'}`);
    const anos = e.abertura ? (Date.now() - new Date(e.abertura)) / 3.156e10 : null;
    if (anos != null && anos < 1) add(20, 'Empresa com menos de 1 ano'); else if (anos != null && anos < 3) add(8, 'Empresa com menos de 3 anos');
    if (e.capital != null && e.capital < 10000 && !(e.simples && e.simples.mei)) add(6, 'Capital social baixo (menos de R$ 10 mil)');
    const s = x.sancoes || {}; const nS = ['ceis', 'cnep', 'cepim', 'leniencia'].reduce((t, k) => t + ((s[k] || []).length), 0);
    if (nS) add(40, `${nS} registro(s) de sanção no Portal da Transparência`);
    if (x.ibama && x.ibama.lista && x.ibama.lista.length) add(25, `${x.ibama.lista.length} embargo(s) ambiental(is) do IBAMA`);
    if (x.listaSuja && x.listaSuja.length) add(60, 'Aparece na lista suja do trabalho escravo');
    if (x.internacional && x.internacional.some(i => /CNPJ/.test(i.por))) add(80, 'Aparece em lista de sanções internacionais');
    else if (x.internacional && x.internacional.length) add(15, 'Nome parecido em lista de sanções internacionais (confira)');
    if (x.antt && x.setor && x.setor.transp && x.antt.situacao && !/ATIV/i.test(x.antt.situacao)) add(30, `RNTRC ${x.antt.situacao}`);
    if (x.antt && x.setor && x.setor.id === 'transporte' && x.antt.naoEncontrado) add(20, 'Transportadora sem registro no RNTRC (ANTT)');
    p = Math.min(100, p);
    return { nota: p, nivel: p >= 50 ? 'alto' : p >= 20 ? 'medio' : 'baixo', motivos: m.sort((a, b) => b[0] - a[0]).map(v => v[1]) };
  }
  const API = { setor, nomeBase, naLista, lerLista, risco, dig, cnpjOk, cpfOk, fmtCnpj, fmtTel, normalizar, alertas, chaveSocio, normNome, mascaraCpf, agruparPessoa, lei, linksOficiais };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.NX_EMP = API;
})(typeof self !== 'undefined' ? self : this);
