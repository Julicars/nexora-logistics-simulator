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
const { createCombustivel } = require('./combustivel');
const { createServicos } = require('./servicos');
const { createDados } = require('./dados');
const { createViagens } = require('./viagens');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json; charset=utf-8', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp' };
/* Cabeçalhos de segurança enviados em todas as respostas:
 * - nosniff / SAMEORIGIN / same-origin: o navegador não "adivinha" tipos, a página não abre dentro de sites de terceiros
 *   e o endereço (com o token do motorista) não vaza para Google Maps e outros links externos;
 * - Permissions-Policy: só localização e câmera (página do motorista); microfone, pagamento etc. bloqueados;
 * - CSP: scripts só do próprio site e do three.js (CDN); conexões só para as APIs públicas usadas; sem plugins (object-src). */
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(self), microphone=(), payment=(), usb=()', 'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org; connect-src 'self' https://api.open-meteo.com https://viacep.com.br https://api.bcb.gov.br https://router.project-osrm.org https://publica.cnpj.ws https://api.casadosdados.com.br https://minhareceita.org https://brasilapi.com.br https://api.opencnpj.org https://open.cnpja.com https://api.gleif.org"
};
function createServer(opts = {}) {
  const dataDir = opts.dataDir || process.env.NEXORA_DADOS || path.join(__dirname, '..', 'data');
  const forum = createForum(dataDir), fretes = createFretes(dataDir, 'fretes'), transportes = createFretes(dataDir, 'transportes'), empresas = createEmpresas(dataDir, opts), combustivel = createCombustivel(dataDir, opts), servicos = createServicos(dataDir, opts), dados = createDados(dataDir, opts), viagens = createViagens(dataDir, dados.autorizado);
  const negado = res => { res.writeHead(401, { ...SEC, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ erro: 'Chave de acesso necessária.', chave: true })); };
  /* tarefas automáticas (também chamadas pelo /api/cron em hospedagens que "dormem") */
  async function tarefas(forcar) { const r = {}, t = async (k, f) => { try { r[k] = await f(); } catch (e) { r[k] = { erro: e.message }; } };
    await t('anp', () => combustivel.atualizar(forcar ? 'manual' : 'cron')); await t('mercado', () => combustivel.atualizarMercado().then(m => ({ erros: m.erros }))); await t('petrobras', () => combustivel.atualizarPetro(forcar ? 'manual' : 'cron'));
    await t('servicos', () => forcar ? servicos.testar() : Promise.all([servicos.pracas(), servicos.ipca(), servicos.feriados(new Date().getFullYear())]).then(() => 'ok')); await t('backup', () => ({ arquivo: dados.backupDiario() ? 'criado' : 'já existe hoje' })); viagens.limpar(); return r; }
  function saude() { return { agora: new Date().toISOString(), versao: require('../package.json').version, anp: combustivel.status(), mercado: combustivel.mercadoEstado(), petrobras: combustivel.petroEstado(), servicos: servicos.estado(), backups: dados.infoBackups().slice(0, 5), dados: dados.resumo(), viagens: viagens.total(), chaveConfigurada: !!process.env.NEXORA_CHAVE }; }
  if (opts.agendar !== false && !process.env.NODE_TEST_CONTEXT) { const tb = setTimeout(() => { try { dados.backupDiario(); } catch (e) { /* segue */ } }, 8000); tb.unref(); const ti = setInterval(() => { try { dados.backupDiario(); viagens.limpar(); } catch (e) { /* segue */ } }, 6 * 36e5); ti.unref(); }
  const srv = http.createServer((req, res) => {
    /* HTTPS atrás de proxy (Nginx/hospedagem): força o navegador a usar sempre HTTPS (HSTS) */
    if (req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400, SEC); return res.end('URL inválida'); }
    /* contra CSRF: alterações na API só podem vir de páginas do próprio NEXORA (outro site não consegue
       mandar o navegador apagar ou trocar dados, nem com o servidor rodando no seu computador) */
    if (p.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const o = req.headers.origin; let ok = true; try { if (o && o !== 'null') ok = new URL(o).host === req.headers.host; else if (o === 'null') ok = false; } catch (e) { ok = false; }
      if (!ok) { res.writeHead(403, { ...SEC, 'Content-Type': 'application/json; charset=utf-8' }); return res.end(JSON.stringify({ erro: 'Origem não permitida.' })); }
    }
    if (p.startsWith('/api/empresas/')) return empresas.handle(req, res, p, SEC);
    if (p.startsWith('/api/combustivel/')) { if (req.method !== 'GET' && !dados.autorizado(req)) return negado(res); return combustivel.handle(req, res, p, SEC); }
    if (p === '/api/dados' || p.startsWith('/api/dados/')) return dados.handle(req, res, p, SEC);
    if (p === '/api/viagens' || p.startsWith('/api/viagens/')) return viagens.handle(req, res, p, SEC);
    if (p === '/api/saude') { res.writeHead(200, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ ...saude(), autorizado: dados.autorizado(req) })); }
    if (p === '/api/saude/testar' || p === '/api/cron') { if (!dados.autorizado(req)) return negado(res); return tarefas(p === '/api/saude/testar').then(r => { res.writeHead(200, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ ok: true, resultado: r, saude: saude() })); }); }
    if (p.startsWith('/api/servicos/')) return servicos.handle(req, res, p, SEC);
    if (p.startsWith('/api/forum')) return forum.handle(req, res, p, SEC);
    if (p === '/api/fretes' || p.startsWith('/api/fretes/')) { if (!dados.autorizado(req)) return negado(res); return fretes.handle(req, res, p, SEC); }
    if (p === '/api/transportes' || p.startsWith('/api/transportes/')) { if (!dados.autorizado(req)) return negado(res); return transportes.handle(req, res, p, SEC); }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SEC); return res.end('Método não permitido'); }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(ROOT, p));
    /* bloqueia saída da pasta public (../) e arquivos ocultos (.env, .git…) */
    if (!file.startsWith(ROOT + path.sep) || /[\\/]\./.test(file.slice(ROOT.length))) { res.writeHead(403, SEC); return res.end('Acesso negado'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { ...SEC, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
      res.writeHead(200, { ...SEC, 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
  srv.forum = forum; srv.dados = dados; return srv;
}
if (require.main === module) { const s = createServer(); s.listen(PORT, () => { console.log(`NEXORA rodando em http://localhost:${PORT}`); console.log(`Chave de acesso para outros aparelhos: ${s.dados.chave()}${process.env.NEXORA_CHAVE ? ' (NEXORA_CHAVE)' : ' (guardada em data/chave.txt — defina NEXORA_CHAVE para escolher a sua)'}`); console.log(s.forum.generated ? `Fórum — senha de administrador gerada nesta execução: ${s.forum.senha}\n(defina NEXORA_ADMIN_SENHA para usar uma senha fixa)` : 'Fórum — senha de administrador definida por NEXORA_ADMIN_SENHA.'); }); }
module.exports = { createServer };
