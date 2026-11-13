'use strict';
/* Consulta de empresas: servidor com as APIs públicas simuladas (sem internet nos testes). */
const test = require('node:test'), assert = require('node:assert'), os = require('os'), fs = require('fs'), path = require('path');
const E = require('../public/src/js/core/empresa.js');
const { createServer } = require('../server/index.js');

const A = '11222333000181', B = '44555666000110', C = '19131243000197';
const mr = (cnpj, razao, uf, qsa) => ({ cnpj, razao_social: razao, nome_fantasia: '', descricao_situacao_cadastral: 'ATIVA', data_inicio_atividade: '2015-03-02', natureza_juridica: 'Sociedade Empresária Limitada', porte: 'MICRO EMPRESA', capital_social: 50000,
  descricao_identificador_matriz_filial: 'MATRIZ', cnae_fiscal: 4930202, cnae_fiscal_descricao: 'Transporte rodoviário de carga, intermunicipal', cnaes_secundarios: [{ codigo: 5211701, descricao: 'Armazéns gerais' }],
  descricao_tipo_de_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '10', bairro: 'CENTRO', municipio: 'CAMPINAS', uf, cep: '13010000', ddd_telefone_1: '1932320000', email: 'contato@ex.com.br', opcao_pelo_simples: true, opcao_pelo_mei: false, qsa });
const JOAO = { nome_socio: 'JOAO DA SILVA', cnpj_cpf_do_socio: '***123456**', qualificacao_socio: 'Sócio-Administrador', identificador_de_socio: 2, faixa_etaria: 'Entre 41 a 50 anos' };
const HOLD = { nome_socio: 'HOLDING X LTDA', cnpj_cpf_do_socio: C, qualificacao_socio: 'Sócio', identificador_de_socio: 1 };
const DB = { [A]: mr(A, 'TRANSPORTES A LTDA', 'SP', [JOAO, HOLD]), [B]: mr(B, 'LOGISTICA B LTDA', 'SP', [JOAO]), [C]: mr(C, 'HOLDING X LTDA', 'SP', [{ nome_socio: 'MARIA SOUZA', cnpj_cpf_do_socio: '***654321**', qualificacao_socio: 'Administrador', identificador_de_socio: 2 }]) };
const calls = [];
async function fakeFetch(url, opt) {
  calls.push(url); const u = new URL(url); const ok = j => ({ status: 200, text: async () => JSON.stringify(j) });
  if (u.hostname === 'minhareceita.org' && u.pathname === '/' ) { const d = u.searchParams.get('cnpf'); return ok({ data: Object.values(DB).filter(x => x.qsa.some(q => q.cnpj_cpf_do_socio === d)) }); }
  if (u.hostname === 'minhareceita.org') { const c = u.pathname.slice(1); return DB[c] ? ok(DB[c]) : { status: 404, text: async () => '{}' }; }
  if (u.hostname === 'open.cnpja.com') return ok({ taxId: A, company: { name: 'TRANSPORTES A LTDA', simples: { optant: true, since: '2015-03-02' }, simei: { optant: false } }, registrations: [{ state: 'SP', number: '123456789110', enabled: true, type: { text: 'IE Normal' } }], address: {} });
  if (u.hostname === 'dados.antt.gov.br' || u.hostname === 'dadosabertos.ibama.gov.br') {
    if (u.pathname.endsWith('package_show')) { const id = u.searchParams.get('id'); return ok({ result: { resources: [{ id: 'R-' + id, name: id + ' Out26', datastore_active: true, created: '2026-11-01' }, { id: 'OLD', name: 'velho', datastore_active: true, created: '2020-01-01' }] } }); }
    if (u.pathname.endsWith('datastore_search')) { const rid = u.searchParams.get('resource_id'); assert.equal(rid.startsWith('R-'), true);
      if (rid === 'R-rntrc') return ok({ result: { records: [{ numero_rntrc: 123456, situacao_rntrc: 'ATIVO', cpfcnpjtransportador: A, categoria_transportador: 'ETC', municipio: 'CAMPINAS', uf: 'SP', data_primeiro_cadastro: '2016-01-10' }] } });
      if (rid === 'R-rntrc-dados-de-veiculos') return ok({ result: { records: [{ cpfcnpjtransportador: A, tipo_veiculo: 'CAMINHAO TRATOR', ano_fabricacao: 2020 }, { cpfcnpjtransportador: A, tipo_veiculo: 'SEMIRREBOQUE', ano_fabricacao: 2019 }] } });
      if (rid === 'R-fiscalizacao-termo-de-embargo') return ok({ result: { records: u.searchParams.get('q') === C || (u.searchParams.get('filters') || '').includes(C) ? [{ NUM_TAD: '999', CPF_CNPJ_INFRATOR: C, MUNICIPIO: 'SINOP', UF: 'MT', DES_INFRACAO: 'Desmatamento' }] : [] } });
      return ok({ result: { records: [] } }); }
  }
  if (u.hostname === 'www.treasury.gov') return { status: 200, text: async () => '1,"HOLDING X LTDA","-0- ","SDGT"\n2,"SILVA, JOAO DA","individual","SDGT"' };
  if (u.hostname === 'scsanctions.un.org') return { status: 200, text: async () => '<CONSOLIDATED_LIST><ENTITY><FIRST_NAME>EMPRESA FANTASMA</FIRST_NAME></ENTITY></CONSOLIDATED_LIST>' };
  if (u.hostname === 'api.gleif.org') { if (u.pathname.endsWith('ultimate-parent')) return ok({ data: { id: '5493PAI0000000000001', attributes: { entity: { legalName: { name: 'GRUPO X SA' }, status: 'ACTIVE' }, registration: { status: 'ISSUED' } } } }); if (u.pathname.endsWith('parent')) return { status: 404, text: async () => '{}' };
    return ok({ data: u.searchParams.get('filter[entity.registeredAs]') === A ? [{ id: '5493000ABCDEF0000012', attributes: { entity: { legalName: { name: 'TRANSPORTES A LTDA' }, status: 'ACTIVE' }, registration: { status: 'ISSUED', nextRenewalDate: '2027-01-01T00:00:00Z' } } }] : [] }); }
  if (u.hostname === 'api.casadosdados.com.br' && JSON.parse(opt.body).busca_textual[0].nome_socio) { const b = JSON.parse(opt.body); assert.equal(b.busca_textual[0].texto[0], 'João da Silva'); return ok({ total: 2, cnpjs: [{ cnpj: A }, { cnpj: B }] }); }
  if (u.hostname === 'api.casadosdados.com.br') { const b = JSON.parse(opt.body); assert.equal(b.busca_textual[0].texto[0], 'TRANSPORTES A'); return ok({ total: 1, cnpjs: [{ cnpj: A, razao_social: 'TRANSPORTES A LTDA', situacao_cadastral: { situacao_atual: 'ATIVA' }, endereco: { municipio: 'CAMPINAS', uf: 'SP' } }] }); }
  return { status: 500, text: async () => '' };
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxe-'));
let srv, base;
test.before(() => new Promise(ok => { srv = createServer({ dataDir: dir, fetch: fakeFetch }).listen(0, () => { base = 'http://127.0.0.1:' + srv.address().port; ok(); }); }));
test.after(() => srv.close());
const j = (u, o = {}) => fetch(base + u, { ...o, headers: { 'Content-Type': 'application/json' } }).then(async r => ({ s: r.status, b: await r.json() }));

test('valida CNPJ pelos dígitos verificadores', () => {
  assert.ok(E.cnpjOk('00.000.000/0001-91')); assert.ok(E.cnpjOk(A)); assert.ok(!E.cnpjOk('11222333000180')); assert.ok(!E.cnpjOk('11111111111111'));
});
test('consulta simples: normaliza, alerta e usa cache', async () => {
  const r = await j('/api/empresas/cnpj/11.222.333/0001-81'); assert.equal(r.s, 200);
  assert.equal(r.b.empresa.razao, 'TRANSPORTES A LTDA'); assert.equal(r.b.empresa.cnaePrincipal.cod, '4930202'); assert.equal(r.b.empresa.qsa[0].tipo, 'PF');
  assert.ok(r.b.alertas.some(a => a[0] === 'ok' && /transporte rodoviário/.test(a[1])));
  const n = calls.length; await j('/api/empresas/cnpj/' + A); assert.equal(calls.length, n, 'segunda consulta vem do cache');
  assert.equal((await j('/api/empresas/cnpj/11222333000180')).s, 400);
  assert.equal((await j('/api/empresas/cnpj/00000000000191')).s, 404);
});
test('consulta completa: junta Simples e inscrição estadual da CNPJá', async () => {
  const r = await j('/api/empresas/completa/' + A); assert.equal(r.s, 200);
  assert.equal(r.b.empresa.inscricoes[0].numero, '123456789110'); assert.equal(r.b.sancoes.semChave, true);
});
test('rede: liga empresas pelo mesmo sócio (nome + CPF mascarado) e pelo sócio PJ', async () => {
  const r = await j('/api/empresas/rede/' + A); assert.equal(r.s, 200);
  const ids = r.b.nodes.map(n => n.id);
  assert.ok(ids.includes('E' + B), 'empresa B ligada pelo JOAO'); assert.ok(r.b.nodes.some(n => n.label === 'MARIA SOUZA'), 'sócia da holding');
  assert.ok(r.b.edges.some(e => e.para === 'E' + B));
});
test('busca por nome', async () => {
  const r = await j('/api/empresas/busca', { method: 'POST', body: JSON.stringify({ nome: 'TRANSPORTES A', uf: 'sp' }) }); assert.equal(r.s, 200);
  assert.equal(r.b.lista[0].cnpj, A); assert.equal(r.b.lista[0].situacao, 'ATIVA');
  assert.equal((await j('/api/empresas/busca', { method: 'POST', body: JSON.stringify({ nome: 'ab' }) })).s, 400);
});

test('pessoa por nome: junta as empresas em que ela é sócia (sem dados pessoais)', async () => {
  const r = await fetch(base + '/api/empresas/pessoa', { method: 'POST', body: JSON.stringify({ nome: 'João da Silva' }) }); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.pessoas.length, 1); const p = j.pessoas[0];
  assert.equal(p.doc, '***123456**'); assert.equal(p.empresas.length, 2); assert.equal(p.administra, 2); assert.ok(!('endereco' in p));
});
test('pessoa por CPF: mascara antes de consultar e nunca envia o CPF completo', async () => {
  calls.length = 0;
  const r = await fetch(base + '/api/empresas/pessoa', { method: 'POST', body: JSON.stringify({ nome: 'JOAO DA SILVA', doc: '001.123.456-79' }) }); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.pessoas[0].empresas.length, 2);
  assert.ok(calls.every(c => !c.includes('00112345679'))); assert.ok(calls.some(c => c.includes(encodeURIComponent('***123456**'))));
});
test('pessoa: exige nome completo', async () => {
  const r = await fetch(base + '/api/empresas/pessoa', { method: 'POST', body: JSON.stringify({ nome: 'Joao' }) }); assert.equal(r.status, 400);
});
test('completa traz LEI (GLEIF) com controladora final e links oficiais', async () => {
  const j = await (await fetch(base + '/api/empresas/completa/' + A)).json();
  assert.equal(j.lei.lei, '5493000ABCDEF0000012'); assert.equal(j.lei.controladoraFinal.nome, 'GRUPO X SA'); assert.ok(j.links.length >= 5);
});

test('completa: ANTT (RNTRC + frota), IBAMA, sanções internacionais e nota de risco', async () => {
  const j = await (await fetch(base + '/api/empresas/completa/' + A)).json();
  assert.equal(j.fontes.setor.id, 'transporte'); assert.equal(j.fontes.antt.situacao, 'ATIVO'); assert.equal(j.fontes.antt.numero, 123456); assert.equal(j.fontes.antt.frota, 2);
  assert.equal(j.fontes.ibama.lista.length, 0);
  assert.ok(j.fontes.internacional.some(x => /sócio/.test(x.por)), 'sócio JOAO DA SILVA com nome idêntico na OFAC');
  assert.ok(j.risco.nota >= 15 && j.risco.motivos.length);
  const b = await (await fetch(base + '/api/empresas/completa/' + C)).json();
  assert.equal(b.fontes.ibama.lista.length, 1); assert.ok(b.fontes.internacional.some(x => /nome idêntico ao da empresa/.test(x.por)));
});
test('lista suja: carrega a planilha e marca a empresa', async () => {
  const csv = 'Ano;Empregador;CNPJ/CPF;UF\n' + ['2026;FAZENDA UM;11.111.111/0001-11;MT', '2026;FAZENDA DOIS;22.222.222/0001-22;PA', '2026;CARVOARIA;33.333.333/0001-33;MA', '2026;OBRA X;44.444.444/0001-44;SP', '2026;LOGISTICA B LTDA;' + C + ';SP'].join('\n');
  const r = await fetch(base + '/api/empresas/listas/lista-suja', { method: 'POST', body: JSON.stringify({ texto: csv, arquivo: 'cadastro.csv' }) }); assert.equal((await r.json()).qtd, 5);
  const fs2 = require('fs'); for (const f of fs2.readdirSync(dir)) if (f === 'empresas-cache.json') fs2.rmSync(path.join(dir, f));
  const b = await (await fetch(base + '/api/empresas/completa/' + C)).json();
  assert.ok(b.fontes.listaSuja.length >= 1); assert.equal(b.risco.nivel, 'alto');
});
