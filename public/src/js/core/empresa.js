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
  const API = { dig, cnpjOk, fmtCnpj, fmtTel, normalizar, alertas, chaveSocio };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.NX_EMP = API;
})(typeof self !== 'undefined' ? self : this);
