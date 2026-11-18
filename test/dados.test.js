/* Testes — dados no servidor: chave de acesso, sincronização, backup/restauração, cron e link do motorista.
 * Rodar: npm test (usa só o node:test, sem dependências; nada acessa a internet: as fontes externas são simuladas). */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { createServer } = require('../server/index');
const JPG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]).toString('base64');
test('dados sincronizados, chave de acesso, backup, cron e viagens do motorista', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxd-'));
  const srv = createServer({ dataDir: dir, chave: 'NX-TESTE', fetch: async () => ({ ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) }) }); await new Promise(ok => srv.listen(0, ok)); const base = 'http://127.0.0.1:' + srv.address().port;
  const R = { 'X-Forwarded-For': '200.1.2.3' }, K = { ...R, 'X-Nexora-Chave': 'NX-TESTE', 'Content-Type': 'application/json' };
  const f = (p, o = {}) => fetch(base + p, o), J = async (p, o) => (await f(p, o)).json();
  try {
    /* remoto sem chave: bloqueado; local: liberado */
    assert.equal((await f('/api/dados', { headers: R })).status, 401);
    assert.equal((await f('/api/fretes', { headers: R })).status, 401);
    assert.equal((await f('/api/combustivel/atualizar', { method: 'POST', headers: R })).status, 401);
    assert.equal((await f('/api/combustivel/status', { headers: R })).status, 200, 'leitura pública');
    assert.equal((await f('/api/dados')).status, 200);
    /* sincronização: versão mais nova vence */
    assert.equal((await f('/api/dados/clientes', { method: 'PUT', headers: K, body: JSON.stringify({ v: [{ nome: 'A' }], em: 2000 }) })).status, 200);
    assert.equal((await f('/api/dados/clientes', { method: 'PUT', headers: K, body: JSON.stringify({ v: [], em: 1000 }) })).status, 409);
    assert.equal((await f('/api/dados/naoexiste', { method: 'PUT', headers: K, body: '{"v":1}' })).status, 404);
    assert.deepEqual((await J('/api/dados', { headers: K })).colecoes.clientes.v, [{ nome: 'A' }]);
    /* backup e restauração */
    const bk = await J('/api/dados/backup', { headers: K }); assert.equal(bk.nexora, 'backup');
    await f('/api/dados/clientes', { method: 'PUT', headers: K, body: JSON.stringify({ v: [{ nome: 'B' }], em: 9e12 }) });
    assert.equal((await J('/api/dados/restaurar', { method: 'POST', headers: K, body: JSON.stringify(bk) })).ok, true);
    assert.equal((await J('/api/dados', { headers: K })).colecoes.clientes.v[0].nome, 'A');
    assert.equal((await f('/api/dados/restaurar', { method: 'POST', headers: K, body: '{"x":1}' })).status, 400);
    /* cron + saúde */
    assert.equal((await f('/api/cron', { headers: R })).status, 401);
    const c = await J('/api/cron?chave=NX-TESTE', { headers: R }); assert.equal(c.ok, true); assert.ok(c.resultado.backup);
    const s = await J('/api/saude', { headers: R }); assert.equal(s.autorizado, false); assert.ok(s.backups.length >= 1);
    /* viagem com link do motorista */
    const v = await J('/api/viagens', { method: 'POST', headers: K, body: JSON.stringify({ nome: 'Rota 1', motorista: 'João', paradas: [{ nome: 'Mercado', cidade: 'Campinas - SP', volumes: 3 }, { nome: 'Loja', cidade: 'Sorocaba - SP' }] }) });
    assert.ok(v.token); assert.equal(v.paradas.length, 2);
    assert.equal((await f(`/api/viagens/${v.id}`, { headers: R })).status, 403);
    const vm = await J(`/api/viagens/${v.id}?t=${v.token}`, { headers: R }); assert.equal(vm.token, undefined); assert.equal(vm.paradas[0].status, 'pendente');
    const ok = await J(`/api/viagens/${v.id}/parada/1?t=${v.token}`, { method: 'POST', headers: { ...R, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'entregue', recebedor: 'Maria', foto: JPG, gps: { lat: -22.9, lon: -47.06 } }) });
    assert.equal(ok.paradas[0].status, 'entregue'); assert.equal(ok.paradas[0].foto, true);
    assert.equal((await f(`/api/viagens/${v.id}/parada/1?t=${v.token}`, { method: 'POST', headers: R, body: JSON.stringify({ status: 'entregue', foto: 'data:image/png;base64,AAAA' }) })).status, 400);
    assert.equal((await f(`/api/viagens/${v.id}/parada/1/foto?t=${v.token}`, { headers: R })).headers.get('content-type'), 'image/jpeg');
    const l = await J('/api/viagens', { headers: K }); assert.equal(l[0].feitas, 1);
    assert.equal((await f(`/api/viagens/${v.id}/parada/9?t=${v.token}`, { method: 'POST', headers: R, body: '{"status":"entregue"}' })).status, 404);
  } finally { srv.close(); }
});
test('segurança: CSRF, arquivos ocultos, força bruta da chave e exigir chave no localhost', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxsec-'));
  const srv = createServer({ dataDir: dir, chave: 'NX-CERTA', exigirChave: true, fetch: async () => ({ ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) }) }); await new Promise(ok => srv.listen(0, ok)); const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    assert.equal((await fetch(base + '/api/dados')).status, 401, 'localhost também precisa de chave');
    assert.equal((await fetch(base + '/api/dados/clientes', { method: 'PUT', headers: { Origin: 'https://site-malicioso.com', 'X-Nexora-Chave': 'NX-CERTA' }, body: '{"v":[]}' })).status, 403, 'CSRF bloqueado');
    assert.equal((await fetch(base + '/api/dados/clientes', { method: 'PUT', headers: { Origin: base, 'X-Nexora-Chave': 'NX-CERTA' }, body: '{"v":[1],"em":5}' })).status, 200, 'mesma origem ok');
    assert.equal((await fetch(base + '/.env')).status, 403); assert.notEqual((await fetch(base + '/src/%2e%2e/%2e%2e/package.json')).status, 200);
    for (let i = 0; i < 10; i++) await fetch(base + '/api/dados', { headers: { 'X-Nexora-Chave': 'errada' + i, 'X-Forwarded-For': '9.9.9.9' } });
    assert.equal((await fetch(base + '/api/dados', { headers: { 'X-Nexora-Chave': 'NX-CERTA', 'X-Forwarded-For': '9.9.9.9' } })).status, 401, 'bloqueado após 10 erros');
    assert.equal((await fetch(base + '/api/dados', { headers: { 'X-Nexora-Chave': 'NX-CERTA', 'X-Forwarded-For': '8.8.8.8' } })).status, 200, 'outro IP segue normal');
    const h = (await fetch(base + '/')).headers; assert.match(h.get('content-security-policy'), /object-src 'none'/); assert.ok(h.get('permissions-policy'));
  } finally { srv.close(); }
});
