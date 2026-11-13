/*
 * NEXORA Logistics Intelligence — servidor web (Node.js, sem dependências).
 * Entrega os arquivos da pasta public/, o fórum (/api/forum → data/forum.json)
 * e os registros de fretes: empregador (/api/fretes → data/fretes.json) e transportador
 * (/api/transportes → data/transportes.json) e a consulta de empresas por CNPJ (/api/empresas, APIs públicas).
 * Sem banco de dados: produtos, frota e montagens ficam salvos no navegador de quem usa.
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = +process.env.PORT || 3000, ROOT = path.join(__dirname, '..', 'public');
const { createForum } = require('./forum');
const { createFretes } = require('./fretes');
const { createEmpresas } = require('./empresas');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json; charset=utf-8', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp' };
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org; connect-src 'self' https://router.project-osrm.org https://publica.cnpj.ws https://api.casadosdados.com.br https://minhareceita.org https://brasilapi.com.br https://api.opencnpj.org https://open.cnpja.com https://api.gleif.org"
};
function createServer(opts = {}) {
  const dataDir = opts.dataDir || process.env.NEXORA_DADOS || path.join(__dirname, '..', 'data');
  const forum = createForum(dataDir), fretes = createFretes(dataDir, 'fretes'), transportes = createFretes(dataDir, 'transportes'), empresas = createEmpresas(dataDir, opts);
  const srv = http.createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400, SEC); return res.end('URL inválida'); }
    if (p.startsWith('/api/empresas/')) return empresas.handle(req, res, p, SEC);
    if (p.startsWith('/api/forum')) return forum.handle(req, res, p, SEC);
    if (p === '/api/fretes' || p.startsWith('/api/fretes/')) return fretes.handle(req, res, p, SEC);
    if (p === '/api/transportes' || p.startsWith('/api/transportes/')) return transportes.handle(req, res, p, SEC);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SEC); return res.end('Método não permitido'); }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403, SEC); return res.end('Acesso negado'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { ...SEC, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
      res.writeHead(200, { ...SEC, 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
  srv.forum = forum; return srv;
}
if (require.main === module) { const s = createServer(); s.listen(PORT, () => { console.log(`NEXORA rodando em http://localhost:${PORT}`); console.log(s.forum.generated ? `Fórum — senha de administrador gerada nesta execução: ${s.forum.senha}\n(defina NEXORA_ADMIN_SENHA para usar uma senha fixa)` : 'Fórum — senha de administrador definida por NEXORA_ADMIN_SENHA.'); }); }
module.exports = { createServer };
