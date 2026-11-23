/* Testes do link de visualização do plano 3D (servidor): cria com chave, lê com token, recusa sem token. */
'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { createPlanos3d } = require('../server/planos3d');
function chamar(api, metodo, url, corpo, aut = true) {
  return new Promise(ok => {
    const { Readable } = require('stream'); const req = Readable.from(corpo ? [Buffer.from(JSON.stringify(corpo))] : []); req.method = metodo; req.url = url; req.headers = {};
    let code, txt = ''; const res = { writeHead: c => { code = c; }, end: t => ok({ code, b: JSON.parse(t || txt || '{}') }) };
    api.handle(req, res, new URL(url, 'http://x').pathname, {});
  });
}
test('plano 3D: criar, ler com token e recusar link errado', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p3d-')); let aut = true; const api = createPlanos3d(dir, () => aut);
  const pk = { nome: 'Teste <b>', vs: [{ nm: 'Carreta', cat: 'Carreta', L: 15.4, W: 2.5, H: 2.7, Hm: 2.7, wag: 1, it: [[0, 0, 0, 1.2, 1, 1.5, 0, 1, 0]] }], ps: [['Palete', 'P1', 'javascript:x', 300, '']] };
  aut = false; assert.strictEqual((await chamar(api, 'POST', '/api/planos3d', pk)).code, 401);
  aut = true; const c = await chamar(api, 'POST', '/api/planos3d', pk); assert.strictEqual(c.code, 201);
  aut = false;
  const r = await chamar(api, 'GET', `/api/planos3d/${c.b.id}?t=${c.b.token}`); assert.strictEqual(r.code, 200);
  assert.strictEqual(r.b.token, undefined); assert.ok(!r.b.nome.includes('<')); assert.strictEqual(r.b.ps[0][2], '#f39a2b');
  assert.strictEqual((await chamar(api, 'GET', `/api/planos3d/${c.b.id}?t=errado`)).code, 403);
  assert.strictEqual((await chamar(api, 'GET', '/api/planos3d/000000000000?t=x')).code, 404);
  aut = true; assert.strictEqual((await chamar(api, 'POST', '/api/planos3d', { vs: [] })).code, 400);
});
