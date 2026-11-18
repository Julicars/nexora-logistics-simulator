/* Testes — serviços públicos com cache: praças de pedágio (ANTT), IPCA (BCB) e feriados (BrasilAPI).
 * Rodar: npm test (usa só o node:test, sem dependências; nada acessa a internet: as fontes externas são simuladas). */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { createServer } = require('../server/index');
const PR = [{ concessionaria: 'AUTOBAN', praca_de_pedagio: 'Praça Valinhos', rodovia: 'BR-000', uf: 'SP', km_m: 82, latitude: '-22.95', longitude: '-46.99', situacao: 'Ativa' }, { concessionaria: 'X', praca_de_pedagio: 'Inativa', latitude: -22.9, longitude: -47, situacao: 'Inativa' }, { concessionaria: 'Y', praca_de_pedagio: 'Sem coordenada', latitude: null, longitude: null }];
function fake(u) {
  let j; const p = new URL(u);
  if (/package_show/.test(u)) j = { result: { resources: [{ id: 'velho', datastore_active: true, last_modified: '2025-01-01' }, { id: 'novo', name: 'Praças 2026', datastore_active: true, last_modified: '2026-03-30' }] } };
  else if (/datastore_search/.test(u)) j = { result: { records: p.searchParams.get('resource_id') === 'novo' ? PR : [] } };
  else if (/sgs/.test(u)) j = [{ data: '01/01/2026', valor: '0,50' }, { data: '01/02/2026', valor: '1,00' }];
  else if (/feriados/.test(u)) j = [{ date: '2026-11-20', name: 'Dia da Consciência Negra', type: 'national' }];
  const b = Buffer.from(JSON.stringify(j)); return Promise.resolve({ ok: !!j, status: j ? 200 : 404, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
}
test('serviços: pedágio (ANTT), IPCA (BCB) e feriados (BrasilAPI) com cache', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxs-')); let n = 0;
  const srv = createServer({ dataDir: dir, fetch: u => { n++; return fake(u); }, anttHost: 'https://antt.test', bcbSgs: 'https://bcb.test/sgs', brasilApi: 'https://brasil.test/api' }); await new Promise(ok => srv.listen(0, ok)); const base = 'http://127.0.0.1:' + srv.address().port;
  const J = async p => (await fetch(base + p)).json();
  try {
    const p = await J('/api/servicos/pedagio'); assert.equal(p.pracas.length, 1); assert.equal(p.pracas[0].nome, 'Praça Valinhos'); assert.equal(p.pracas[0].lat, -22.95);
    const c = n; await J('/api/servicos/pedagio'); assert.equal(n, c, 'usa cache');
    const i = await J('/api/servicos/ipca'); assert.deepEqual(i.serie, [{ m: '2026-01', v: 0.5 }, { m: '2026-02', v: 1 }]);
    const f = await J('/api/servicos/feriados/2026'); assert.equal(f[0].data, '2026-11-20');
    assert.equal((await fetch(base + '/api/servicos/feriados/1500')).status, 404);
  } finally { srv.close(); }
});
