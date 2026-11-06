// Testes de segurança do servidor. Uso: npm run test:seguranca
// Sobe o servidor numa porta livre e dispara ataques comuns; falha (exit 1) se algum passar.
process.env.RATE_LIMIT = '100000';       // limite geral alto; o da API é testado separadamente
process.env.RATE_LIMIT_API = '100000';
const http = require('http');
const servidor = require('../server.js');

let falhas = 0, total = 0, porta;
const ok = (cond, nome, det) => { total++; if (!cond) { falhas++; console.log('  ✗ ' + nome + (det ? ' -> ' + det : '')); } else console.log('  ✓ ' + nome); };

function req(opts, corpo) {
  return new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port: porta, ...opts }, (res) => {
      const b = []; res.on('data', (c) => b.push(c));
      res.on('end', () => resolve({ status: res.statusCode, h: res.headers, corpo: Buffer.concat(b).toString('utf8') }));
    });
    r.on('error', (e) => resolve({ status: 0, erro: e.code, h: {}, corpo: '' }));
    if (corpo) r.write(corpo);
    r.end();
  });
}
const post = (corpo, h) => req({ path: '/api/simular', method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h) }, typeof corpo === 'string' ? corpo : JSON.stringify(corpo));
const VEIC = { nome: 'T', c: 10, l: 2.4, h: 2.6, vagoes: 1 };
const PROD = { codigo: 'A', nome: 'P', tipo: 'palete', c: 1.2, l: 1.1, h: 1.9, qtd: 5, pecas: 10, peso: 300, orientacao: 'auto' };

(async () => {
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r)); porta = servidor.address().port;

  console.log('1. Cabeçalhos de segurança');
  const home = await req({ path: '/home/index.html' });
  ok(home.status === 200, 'página inicial responde 200');
  for (const k of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy'])
    ok(!!home.h[k], 'cabeçalho ' + k);
  ok(/script-src 'self'(;|$)/.test(home.h['content-security-policy']) && !/script-src[^;]*unsafe/.test(home.h['content-security-policy']), 'CSP bloqueia scripts externos/inline');
  ok(/frame-ancestors 'none'/.test(home.h['content-security-policy']), 'CSP impede clickjacking');
  ok(!home.h['x-powered-by'], 'sem X-Powered-By');
  const hs = await req({ path: '/', headers: { 'X-Forwarded-Proto': 'https' } });
  ok(!!hs.h['strict-transport-security'], 'HSTS quando atrás de HTTPS');

  console.log('2. Nenhum script externo nas páginas');
  for (const p of ['/home/index.html', '/home/sobre.html', '/home/contato.html', '/cubagem/index.html']) {
    const r = await req({ path: p });
    ok(!/<script[^>]+src=["']https?:/i.test(r.corpo) && !/<script(?![^>]*src)/i.test(r.corpo), p + ' só carrega scripts locais, sem inline');
    ok(!/\son[a-z]+\s*=/i.test(r.corpo), p + ' sem manipuladores inline (onclick=...)');
  }
  const t3 = await req({ path: '/shared/vendor/three-0.147.0.min.js' });
  ok(t3.status === 200 && /Three\.js Authors/.test(t3.corpo.slice(0, 200)), 'three.js servido localmente');
  ok(t3.h['cache-control'] === 'public, max-age=31536000, immutable', 'vendor versionado com cache imutável');

  console.log('3. Alteração das páginas (métodos de escrita)');
  for (const m of ['PUT', 'POST', 'DELETE', 'PATCH', 'TRACE', 'OPTIONS']) {
    const r = await req({ path: '/home/index.html', method: m }, m === 'POST' || m === 'PUT' ? '<h1>hacked</h1>' : undefined);
    ok(r.status === 405, m + ' em página -> 405', 'status ' + r.status);
  }
  const wr = await req({ path: '/home/index.html', method: 'PUT' }, 'x');
  ok(wr.h.allow === 'GET, HEAD', 'Allow: GET, HEAD');
  const again = await req({ path: '/home/index.html' });
  ok(again.corpo === home.corpo, 'conteúdo da página permanece intacto');

  console.log('4. Path traversal / arquivos sensíveis');
  const trav = ['/../server.js', '/..%2fserver.js', '/%2e%2e/server.js', '/%2e%2e%2fserver.js', '/..%5cserver.js', '/home/../../server.js', '/....//server.js',
    '/%00', '/home/index.html%00.png', '/..%252fserver.js', '/shared/../../package.json', '//etc/passwd', '/%c0%ae%c0%ae/server.js',
    '/.git/config', '/.env', '/home/.hidden', '/server.js', '/package.json', '/test/seguranca.js', '/README.md', '/node_modules/'];
  for (const p of trav) {
    const r = await req({ path: p });
    const vazou = /require\(|"name":\s*"simulador|root:x:/.test(r.corpo);
    ok(r.status !== 200 && !vazou, 'GET ' + p, 'status ' + r.status);
  }
  const dir = await req({ path: '/home' });
  ok(dir.status === 301 && dir.h.location === '/home/', 'diretório sem / redireciona (sem listar)');
  const lst = await req({ path: '/shared/' });
  ok(!/Index of/i.test(lst.corpo), 'sem listagem de diretório');
  const ext = await req({ path: '/shared/img/../../server.js' });
  ok(ext.status !== 200, 'extensão fora da lista branca não é servida');

  console.log('5. Injeção (SQL, NoSQL, comandos, XSS, prototype pollution) na API');
  const payloads = ["' OR '1'='1", "'; DROP TABLE users;--", '" OR ""="', '1; SELECT * FROM users', '{"$ne":null}', '$(rm -rf /)', '`id`', '../../etc/passwd', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '%00', '\u0000'];
  for (const pl of payloads) {
    const r = await post({ veiculo: Object.assign({}, VEIC, { nome: pl }), pedidos: [Object.assign({}, PROD, { nome: pl, codigo: pl })] });
    ok(r.status === 200 || r.status === 400, 'nome/código = ' + JSON.stringify(pl).slice(0, 30), 'status ' + r.status);
    ok(!/Error:|at .*\.js:\d+|node_modules/.test(r.corpo), '   sem vazamento de stack trace');
  }
  for (const campo of ['c', 'l', 'h', 'qtd', 'peso']) {
    for (const pl of ["1 OR 1=1", "'; DROP--", { $gt: 0 }, [1], null, 'NaN', true]) {
      const p = Object.assign({}, PROD); p[campo] = pl;
      const r = await post({ veiculo: VEIC, pedidos: [p] });
      ok(r.status === 400, `produto.${campo} = ${JSON.stringify(pl)} rejeitado`, 'status ' + r.status);
    }
  }
  const pp = await post('{"veiculo":' + JSON.stringify(VEIC) + ',"pedidos":[' + JSON.stringify(PROD) + '],"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
  ok(pp.status === 200 && ({}).polluted === undefined, 'prototype pollution não afeta Object.prototype');
  const pp2 = await post('{"veiculo":{"nome":"x","c":10,"l":2,"h":2,"__proto__":{"polluted":1}},"pedidos":[]}');
  ok(({}).polluted === undefined, 'prototype pollution via veiculo ignorada');
  const lixo = await post({ veiculo: VEIC, pedidos: [Object.assign({}, PROD, { hack: 'x', constructor: 'y' })], extra: 1 });
  ok(lixo.status === 200 && !/hack/.test(lixo.corpo), 'campos desconhecidos descartados');

  console.log('6. Validação de formato, tamanho e DoS');
  ok((await post('{quebrado')).status === 400, 'JSON malformado -> 400');
  ok((await post('[]')).status === 400, 'array no lugar de objeto -> 400');
  ok((await post('null')).status === 400, 'null -> 400');
  ok((await req({ path: '/api/simular', method: 'POST', headers: { 'Content-Type': 'text/plain' } }, '{}')).status === 415, 'Content-Type errado -> 415');
  ok((await req({ path: '/api/simular', method: 'GET' })).status === 405, 'GET na API -> 405');
  const grande = await post(JSON.stringify({ veiculo: VEIC, pedidos: [], lixo: 'A'.repeat(400 * 1024) }));
  ok(grande.status === 413 || grande.status === 0, 'corpo > 256KB -> 413', 'status ' + grande.status);
  ok((await post({ veiculo: VEIC, pedidos: [Object.assign({}, PROD, { qtd: 99999999 })] })).status === 400, 'qtd gigante (DoS de CPU) -> 400');
  ok((await post({ veiculo: VEIC, pedidos: Array(300).fill(PROD) })).status === 400, 'mais de 200 produtos -> 400');
  ok((await post({ veiculo: VEIC, pedidos: Array(5).fill(Object.assign({}, PROD, { qtd: 1000 })) })).status === 400, 'soma de itens acima do limite -> 400');
  ok((await post({ veiculo: Object.assign({}, VEIC, { c: -1 }), pedidos: [PROD] })).status === 400, 'medida negativa -> 400');
  ok((await post({ veiculo: Object.assign({}, VEIC, { c: 1e9 }), pedidos: [PROD] })).status === 400, 'medida gigante -> 400');
  ok((await post({ veiculo: Object.assign({}, VEIC, { vagoes: 99999 }), pedidos: [PROD] })).status === 400, 'vagões absurdos -> 400');
  ok((await req({ path: '/' + 'a'.repeat(5000) })).status === 414, 'URL gigante -> 414');
  const ini = Date.now();
  const norm = await post({ veiculo: VEIC, pedidos: [PROD] });
  ok(norm.status === 200 && JSON.parse(norm.corpo).colocados.length === 5 && Date.now() - ini < 3000, 'requisição legítima continua funcionando');

  console.log('7. CORS / CSRF');
  const o = await post({ veiculo: VEIC, pedidos: [PROD] }, { Origin: 'https://evil.example' });
  ok(o.status === 403, 'Origin externa bloqueada (403)');
  ok(!o.h['access-control-allow-origin'] && !norm.h['access-control-allow-origin'], 'sem Access-Control-Allow-Origin');
  const pre = await req({ path: '/api/simular', method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
  ok(pre.status === 405 && !pre.h['access-control-allow-origin'], 'preflight CORS recusado');
  const mesmo = await post({ veiculo: VEIC, pedidos: [PROD] }, { Origin: `http://127.0.0.1:${porta}` });
  ok(mesmo.status === 200, 'mesma origem permitida');

  console.log('8. Rotas inexistentes e erros');
  const nf = await req({ path: '/api/admin' });
  ok(nf.status === 404 && !/at .*\.js/.test(nf.corpo), '/api/admin -> 404 sem detalhes');
  ok((await req({ path: '/%' })).status === 400, 'URL com % inválido -> 400');
  for (const p of ['/admin', '/login', '/wp-admin/', '/phpmyadmin/', '/.git/HEAD']) ok((await req({ path: p })).status === 404, p + ' -> 404');

  console.log('9. Limite de taxa (força bruta / flood)');
  const { spawn } = require('child_process');
  const filho = spawn(process.execPath, [require('path').join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: '3187', RATE_LIMIT_API: '10', RATE_LIMIT: '1000' }), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const antes = porta; porta = 3187;
  let bloqueou = false, retry = false;
  for (let i = 0; i < 30; i++) { const r = await post({ veiculo: VEIC, pedidos: [] }); if (r.status === 429) { bloqueou = true; retry = !!r.h['retry-after']; break; } }
  ok(bloqueou, 'excesso de chamadas à API -> 429');
  ok(retry, 'resposta 429 traz Retry-After');
  const flood = await Promise.all(Array.from({ length: 60 }, () => req({ path: '/api/simular', method: 'GET' })));
  ok(flood.every((r) => r.status === 405 || r.status === 429), 'flood concorrente não derruba o servidor');
  ok((await req({ path: '/home/index.html' })).status === 200, 'servidor continua respondendo após flood');
  filho.kill(); porta = antes;

  servidor.close();
  console.log(`\n${total - falhas}/${total} verificações passaram`);
  if (falhas) { console.log('FALHAS: ' + falhas); process.exit(1); }
  console.log('Segurança OK');
  process.exit(0);
})();
