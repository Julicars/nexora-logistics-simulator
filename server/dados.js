/* NEXORA — dados no servidor (sincronizados entre aparelhos), chave de acesso e backup.
 * Coleções (produtos, frota, planos, clientes, regras, preferências…) ficam em data/dados/colecoes.json.
 * Cada coleção guarda {v: valor, em: carimbo de tempo}; vale a versão mais recente (último que salvou).
 * Chave de acesso: NEXORA_CHAVE, ou gerada uma vez e guardada em data/chave.txt (aparece no terminal).
 * Acessos do próprio computador (localhost, sem proxy na frente) não precisam da chave.
 * Backup: 1 arquivo JSON por dia em data/backups (mantém 30) + download/restauração pela tela.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const COLECOES = ['products', 'vehicles', 'plans', 'clientes', 'regras', 'modelos', 'origPad', 'pedTarifa', 'fatorCub', 'prefs', 'fav', 'corEntrega', 'contatos', 'amarraCfg', 'autoExtra', 'operador', 'consumo'];

function createDados(dataDir, opts = {}) {
  const dir = path.join(dataDir, 'dados'), FILE = path.join(dir, 'colecoes.json'), BK = path.join(dataDir, 'backups'), CH = path.join(dataDir, 'chave.txt');
  const lerJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const grava = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); };
  let db = lerJ(FILE, {});

  /* ---------- chave de acesso ---------- */
  let chave = opts.chave || process.env.NEXORA_CHAVE || '', gerada = false;
  if (!chave) { try { chave = fs.readFileSync(CH, 'utf8').trim(); } catch (e) { /* gera */ } }
  if (!chave) { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.randomBytes(8); chave = 'NX-' + [...r].map((b, i) => a[b % a.length] + (i === 3 ? '-' : '')).join(''); try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(CH, chave, { mode: 0o600 }); } catch (e) { /* só em memória */ } gerada = true; }
  /* NEXORA_EXIGIR_CHAVE=1 desliga a exceção do localhost (use se a hospedagem não informar o IP real pelo X-Forwarded-For) */
  const local = req => { if (process.env.NEXORA_EXIGIR_CHAVE === '1' || opts.exigirChave) return false; const ip = req.socket && req.socket.remoteAddress || ''; return /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(ip) && !req.headers['x-forwarded-for'] && !req.headers['x-real-ip']; };
  const igual = (a, b) => { const A = Buffer.from(String(a || '')), B = Buffer.from(String(b)); return A.length === B.length && crypto.timingSafeEqual(A, B); };
  /* contra tentativa e erro: 10 chaves erradas em 15 min bloqueiam o endereço por 15 min */
  const erros = new Map();
  const ipDe = req => String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '').split(',')[0].trim();
  function autorizado(req) {
    if (opts.semChave || local(req)) return true;
    const dada = req.headers['x-nexora-chave'] || new URL(req.url, 'http://x').searchParams.get('chave'); if (!dada) return false;
    const ip = ipDe(req), agora = Date.now(), e = erros.get(ip);
    if (e && e.n >= 10 && agora - e.t < 15 * 6e4) return false;
    if (igual(dada, chave)) { erros.delete(ip); return true; }
    erros.set(ip, { n: e && agora - e.t < 15 * 6e4 ? e.n + 1 : 1, t: agora }); if (erros.size > 5000) erros.clear();
    return false;
  }

  /* ---------- backup ---------- */
  const extras = () => Object.fromEntries(['fretes.json', 'transportes.json', path.join('combustivel', 'petrobras.json')].map(f => [f, lerJ(path.join(dataDir, f), null)]).filter(([, v]) => v));
  const pacote = () => ({ nexora: 'backup', versao: 1, criado: new Date().toISOString(), colecoes: db, arquivos: extras() });
  function backupDiario(forcar) {
    const hoje = new Date().toISOString().slice(0, 10), f = path.join(BK, `nexora-${hoje}.json`);
    if (!forcar && fs.existsSync(f)) return null;
    grava(f, pacote());
    try { fs.readdirSync(BK).filter(n => /^nexora-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().slice(0, -30).forEach(n => fs.unlinkSync(path.join(BK, n))); } catch (e) { /* ok */ }
    return f;
  }
  function restaurar(b) {
    if (!b || b.nexora !== 'backup' || typeof b.colecoes !== 'object') throw Object.assign(new Error('Arquivo de backup inválido.'), { status: 400 });
    backupDiario(true); /* guarda o estado atual antes de restaurar */
    db = {}; for (const [k, x] of Object.entries(b.colecoes)) if (COLECOES.includes(k) && x && 'v' in x) db[k] = { v: x.v, em: Date.now() };
    grava(FILE, db);
    for (const [f, v] of Object.entries(b.arquivos || {})) if (['fretes.json', 'transportes.json', path.join('combustivel', 'petrobras.json'), 'combustivel/petrobras.json'].includes(f)) grava(path.join(dataDir, f), v);
    return Object.keys(db).length;
  }
  const infoBackups = () => { try { return fs.readdirSync(BK).filter(n => n.endsWith('.json')).sort().reverse().slice(0, 30).map(n => ({ nome: n, kb: Math.round(fs.statSync(path.join(BK, n)).size / 1024) })); } catch (e) { return []; } };

  const json = (res, SEC, code, o, h = {}) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...h }); res.end(JSON.stringify(o)); };
  const corpo = (req, max) => new Promise((ok, no) => { const p = []; let n = 0; req.on('data', d => { n += d.length; if (n > max) { no(Object.assign(new Error('Dados grandes demais.'), { status: 413 })); req.destroy(); } else p.push(d); }); req.on('end', () => { try { ok(p.length ? JSON.parse(Buffer.concat(p).toString('utf8')) : {}); } catch (e) { no(Object.assign(new Error('JSON inválido.'), { status: 400 })); } }); req.on('error', no); });

  async function handle(req, res, p, SEC) {
    const rota = p.replace(/^\/api\/dados\/?/, ''), m = req.method;
    if (!autorizado(req)) return json(res, SEC, 401, { erro: 'Chave de acesso necessária.', chave: true });
    try {
      if (m === 'GET' && rota === '') return json(res, SEC, 200, { colecoes: db, servidor: new Date().toISOString() });
      if (m === 'PUT' && COLECOES.includes(rota)) {
        const b = await corpo(req, 25 * 1024 * 1024), em = +b.em || Date.now();
        if (!('v' in b)) throw Object.assign(new Error('Faltou o valor.'), { status: 400 });
        const at = db[rota]; if (at && at.em > em) return json(res, SEC, 409, { erro: 'Existe uma versão mais nova no servidor.', atual: at });
        db[rota] = { v: b.v, em }; grava(FILE, db); return json(res, SEC, 200, { ok: true, em });
      }
      if (m === 'GET' && rota === 'backup') { const nome = `nexora-backup-${new Date().toISOString().slice(0, 10)}.json`; return json(res, SEC, 200, pacote(), { 'Content-Disposition': `attachment; filename="${nome}"` }); }
      if (m === 'GET' && rota === 'backups') return json(res, SEC, 200, infoBackups());
      if (m === 'POST' && rota === 'restaurar') return json(res, SEC, 200, { ok: true, colecoes: restaurar(await corpo(req, 60 * 1024 * 1024)) });
      return json(res, SEC, 404, { erro: 'Rota não encontrada.' });
    } catch (e) { return json(res, SEC, e.status || 400, { erro: e.message }); }
  }
  return { handle, autorizado, chave: () => chave, gerada, backupDiario, infoBackups, COLECOES, resumo: () => Object.fromEntries(Object.entries(db).map(([k, x]) => [k, x.em])) };
}
module.exports = { createDados, COLECOES };
