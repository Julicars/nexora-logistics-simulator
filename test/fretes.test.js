'use strict';
const test = require('node:test'), assert = require('node:assert'), os = require('os'), fs = require('fs'), path = require('path');
const { createServer } = require('../server/index.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxr-'));
let srv, base;
test.before(() => new Promise(ok => { srv = createServer({ dataDir: dir }).listen(0, () => { base = 'http://127.0.0.1:' + srv.address().port; ok(); }); }));
test.after(() => srv.close());
const j = (u, o = {}) => fetch(base + u, { ...o, headers: { 'Content-Type': 'application/json' } }).then(async r => ({ s: r.status, b: await r.json() }));
test('cria, lista, altera e apaga registro de frete; grava em JSON', async () => {
  const c = await j('/api/fretes', { method: 'POST', body: JSON.stringify({ transportadora: 'Transp X', valor: 5000, nfe: ['123'], adicionais: [{ desc: 'Chapa', valor: 200, quando: 'depois' }], '__proto__x': 1, ruim: { a: 1 } }) });
  assert.equal(c.s, 201); assert.equal(c.b.valor, 5000); assert.equal(c.b.ruim, undefined);
  assert.equal((await j('/api/fretes')).b.fretes.length, 1);
  const u = await j('/api/fretes/' + c.b.id, { method: 'PUT', body: JSON.stringify({ transportadora: 'Transp Y', valor: 5100 }) }); assert.equal(u.b.transportadora, 'Transp Y'); assert.ok(u.b.alterado);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'fretes.json'), 'utf8')).fretes[0].valor, 5100);
  assert.equal((await j('/api/fretes/' + c.b.id, { method: 'DELETE' })).s, 200);
});

test('registro do transportador é separado do registro do empregador', async () => {
  const a = await j('/api/transportes', { method: 'POST', body: JSON.stringify({ cliente: 'Embarcador', valorNfe: 100000, foto: 'javascript:alert(1)' }) });
  assert.equal(a.s, 201); assert.equal(a.b.foto, '');
  assert.equal((await j('/api/transportes')).b.fretes.length, 1);
  assert.equal((await j('/api/fretes')).b.fretes.length, 0);
  assert.ok(fs.existsSync(path.join(dir, 'transportes.json')));
});
