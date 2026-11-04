// Servidor do NEXORA Logistics Intelligence — sem dependências externas, endurecido.
// Uso: node server.js  (ou npm start)  ->  http://localhost:3000
// Segurança: somente leitura (GET/HEAD) nas páginas, cabeçalhos CSP/HSTS etc., proteção contra
// path traversal, validação estrita do corpo da API, limite de tamanho/taxa/tempo.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { empacotar } = require('./public/cubagem/js/packer.js');

const PORT = process.env.PORT || 3000;
const PUBLICO = fs.realpathSync(path.join(__dirname, 'public'));
const LIMITE_CORPO = 256 * 1024;          // 256 KB
const MAX_PRODUTOS = 200;
const MAX_ITENS = 3000;                   // soma das quantidades (evita DoS de CPU)
const JANELA_MS = 60 * 1000;
const MAX_REQ_JANELA = Number(process.env.RATE_LIMIT) || 600;       // requisições gerais / min / IP
const MAX_API_JANELA = Number(process.env.RATE_LIMIT_API) || 20;    // chamadas à API / min / IP

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

function cabecalhos(req, extra) {
  const h = Object.assign({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
  }, extra);
  if (req.headers['x-forwarded-proto'] === 'https') h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

function responder(req, res, status, corpo, tipo, extra) {
  res.writeHead(status, cabecalhos(req, Object.assign({ 'Content-Type': tipo || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, extra)));
  res.end(req.method === 'HEAD' ? undefined : corpo);
}
const json = (req, res, status, obj, extra) => responder(req, res, status, JSON.stringify(obj), MIME['.json'], extra);

// ---- limitação de taxa (memória, por IP) ----
const contadores = new Map();
function estourou(chave, max) {
  const agora = Date.now();
  let c = contadores.get(chave);
  if (!c || agora - c.ini > JANELA_MS) { c = { ini: agora, n: 0 }; contadores.set(chave, c); }
  c.n++;
  return c.n > max;
}
setInterval(() => { const a = Date.now(); for (const [k, c] of contadores) if (a - c.ini > JANELA_MS) contadores.delete(k); }, JANELA_MS).unref();

// ---- validação estrita do corpo da API ----
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const txt = (v, max) => typeof v === 'string' && v.length <= max;
function validar(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'Corpo deve ser um objeto JSON.';
  const v = d.veiculo;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return '"veiculo" inválido.';
  for (const k of ['c', 'l', 'h']) if (!num(v[k], 0.05, 40)) return `veiculo.${k} fora do intervalo (0.05–40 m).`;
  if (v.cargaKg !== undefined && !num(v.cargaKg, 0, 1e6)) return 'veiculo.cargaKg inválido.';
  if (v.vagoes !== undefined && !(Number.isInteger(v.vagoes) && v.vagoes >= 1 && v.vagoes <= 4)) return 'veiculo.vagoes inválido (1–4).';
  if (v.nome !== undefined && !txt(v.nome, 80)) return 'veiculo.nome inválido.';
  if (!Array.isArray(d.pedidos) || d.pedidos.length > MAX_PRODUTOS) return `"pedidos" deve ser lista de até ${MAX_PRODUTOS}.`;
  let total = 0;
  for (const p of d.pedidos) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Produto inválido.';
    for (const k of ['c', 'l', 'h']) if (!num(p[k], 0.001, 40)) return `produto.${k} fora do intervalo.`;
    if (!(Number.isInteger(p.qtd) && p.qtd >= 0 && p.qtd <= MAX_ITENS)) return 'produto.qtd inválido.';
    if (p.peso !== undefined && !num(p.peso, 0, 1e5)) return 'produto.peso inválido.';
    if (p.pecas !== undefined && !num(p.pecas, 0, 1e6)) return 'produto.pecas inválido.';
    if (p.maxEmCima !== undefined && p.maxEmCima !== null && !num(p.maxEmCima, 0, 1e6)) return 'produto.maxEmCima inválido.';
    if (p.codigo !== undefined && !txt(p.codigo, 80)) return 'produto.codigo inválido.';
    if (p.nome !== undefined && !txt(p.nome, 120)) return 'produto.nome inválido.';
    if (p.tipo !== undefined && !['palete', 'caixa'].includes(p.tipo)) return 'produto.tipo inválido.';
    if (p.orientacao !== undefined && !['auto', 'livre', 'comprimento', 'largura', 'deitado', 'vertical', 'fixa'].includes(p.orientacao)) return 'produto.orientacao inválida.';
    total += p.qtd;
  }
  if (total > MAX_ITENS) return `Total de itens acima de ${MAX_ITENS}.`;
  if (d.opcoes !== undefined) {
    const o = d.opcoes;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return '"opcoes" inválido.';
    if (o.estrategia !== undefined && !['blocos', 'pedido', 'peso', 'volume', 'base'].includes(o.estrategia)) return 'opcoes.estrategia inválida.';
    if (o.apoioMin !== undefined && !num(o.apoioMin, 0, 1)) return 'opcoes.apoioMin inválido.';
  }
  return null;
}

// Copia só campos conhecidos (impede prototype pollution e campos inesperados no packer)
function limpar(d) {
  const pick = (o, ks) => { const r = Object.create(null); for (const k of ks) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return Object.assign({}, r); };
  return {
    veiculo: pick(d.veiculo, ['nome', 'c', 'l', 'h', 'cargaKg', 'vagoes', 'tipo']),
    pedidos: d.pedidos.map((p) => pick(p, ['codigo', 'nome', 'tipo', 'c', 'l', 'h', 'qtd', 'pecas', 'peso', 'orientacao', 'maxEmCima', 'cor'])),
    opcoes: d.opcoes ? pick(d.opcoes, ['estrategia', 'apoioMin']) : undefined,
  };
}

function tratarApi(req, res, ip) {
  if (req.method !== 'POST') return json(req, res, 405, { erro: 'Use POST.' }, { Allow: 'POST' });
  if (estourou('api:' + ip, MAX_API_JANELA)) return json(req, res, 429, { erro: 'Muitas requisições. Tente novamente em instantes.' }, { 'Retry-After': '60' });
  if (!/^application\/json(\s*;|$)/i.test(req.headers['content-type'] || '')) return json(req, res, 415, { erro: 'Content-Type deve ser application/json.' });
  // Proteção CSRF/cross-site: se houver Origin, deve ser o próprio host
  const origem = req.headers.origin;
  if (origem) {
    let ok = false;
    try { ok = new URL(origem).host === req.headers.host; } catch (e) { ok = false; }
    if (!ok) return json(req, res, 403, { erro: 'Origem não permitida.' });
  }
  const cl = Number(req.headers['content-length']);
  if (cl > LIMITE_CORPO) return json(req, res, 413, { erro: 'Corpo muito grande.' }, { Connection: 'close' });
  let tam = 0; const partes = []; let abortado = false;
  req.on('data', (ch) => {
    tam += ch.length;
    if (tam > LIMITE_CORPO) { abortado = true; json(req, res, 413, { erro: 'Corpo muito grande.' }, { Connection: 'close' }); req.destroy(); return; }
    partes.push(ch);
  });
  req.on('end', () => {
    if (abortado) return;
    let d;
    try { d = JSON.parse(Buffer.concat(partes).toString('utf8')); } catch (e) { return json(req, res, 400, { erro: 'JSON inválido.' }); }
    const erro = validar(d);
    if (erro) return json(req, res, 400, { erro });
    try {
      const l = limpar(d);
      json(req, res, 200, empacotar(l.veiculo, l.pedidos, l.opcoes));
    } catch (e) {
      console.error('Falha ao simular:', e && e.message);
      json(req, res, 500, { erro: 'Erro interno.' });
    }
  });
  req.on('error', () => { /* conexão derrubada */ });
}

function tratarEstatico(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return responder(req, res, 405, 'Método não permitido', null, { Allow: 'GET, HEAD' });
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { return responder(req, res, 400, 'Requisição inválida'); }
  if (rel.includes('\0') || rel.includes('\\')) return responder(req, res, 400, 'Requisição inválida');
  // nenhum segmento oculto (.git, .env, ...) nem ".."
  if (rel.split('/').some((s) => s === '..' || (s.startsWith('.') && s.length > 0))) return responder(req, res, 404, 'Não encontrado');
  if (rel.endsWith('/')) rel += 'index.html';
  const alvo = path.join(PUBLICO, rel);
  fs.realpath(alvo, (e1, real) => {
    if (e1) return responder(req, res, 404, 'Não encontrado');
    if (real !== PUBLICO && !real.startsWith(PUBLICO + path.sep)) return responder(req, res, 404, 'Não encontrado');
    fs.stat(real, (e2, st) => {
      if (e2) return responder(req, res, 404, 'Não encontrado');
      if (st.isDirectory()) return responder(req, res, 301, '', null, { Location: url.pathname.replace(/\/*$/, '/') });
      const tipo = MIME[path.extname(real).toLowerCase()];
      if (!tipo) return responder(req, res, 404, 'Não encontrado');   // lista branca de extensões
      // shared/vendor/ tem o número da versão no nome do arquivo: pode cachear para sempre sem risco de servir versão velha
      const cache = rel.startsWith('/shared/vendor/') ? 'public, max-age=31536000, immutable' : 'no-cache';
      fs.readFile(real, (e3, dados) => {
        if (e3) return responder(req, res, 404, 'Não encontrado');
        res.writeHead(200, cabecalhos(req, { 'Content-Type': tipo, 'Cache-Control': cache, 'Content-Length': dados.length }));
        res.end(req.method === 'HEAD' ? undefined : dados);
      });
    });
  });
}

const servidor = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress || '?';
  if (estourou('geral:' + ip, MAX_REQ_JANELA)) return json(req, res, 429, { erro: 'Muitas requisições.' }, { 'Retry-After': '60' });
  if ((req.url || '').length > 2048) return responder(req, res, 414, 'URL muito longa');
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return responder(req, res, 400, 'Requisição inválida'); }
  try {
    if (url.pathname === '/api/simular') return tratarApi(req, res, ip);
    if (url.pathname.startsWith('/api/')) return json(req, res, 404, { erro: 'Não encontrado.' });
    tratarEstatico(req, res, url);
  } catch (e) {
    console.error('Erro:', e && e.message);
    if (!res.headersSent) responder(req, res, 500, 'Erro interno');
  }
});

servidor.headersTimeout = 10000;
servidor.requestTimeout = 15000;
servidor.keepAliveTimeout = 5000;
servidor.maxHeadersCount = 50;
servidor.on('clientError', (err, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });

if (require.main === module) {
  servidor.listen(PORT, () => console.log(`NEXORA rodando em http://localhost:${PORT}`));
}
module.exports = servidor;
