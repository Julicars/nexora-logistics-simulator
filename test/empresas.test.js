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
