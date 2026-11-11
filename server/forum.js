/*
 * NEXORA — Fórum (lado do servidor). Sem banco de dados: tudo fica em data/forum.json.
 * Regras: só o administrador cria e apaga tópicos; qualquer pessoa responde (apenas com um nome/apelido).
 * Senha do administrador: variável de ambiente NEXORA_ADMIN_SENHA. Se não existir, é gerada uma
 * senha aleatória e mostrada no terminal ao iniciar o servidor.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const CATS = [
  { id: 'antt', nome: 'ANTT', ic: '🏛️', desc: 'Resoluções, regulamentações, fiscalizações, atualizações e obrigações.' },
  { id: 'ciot', nome: 'CIOT', ic: '🧾', desc: 'Emissão, obrigatoriedade, procedimentos e mudanças na legislação.' },
  { id: 'frete', nome: 'Frete Mínimo', ic: '💲', desc: 'Tabela de fretes, cálculos, reajustes e atualizações.' },
  { id: 'pedagio', nome: 'Vale-Pedágio', ic: '🛣️', desc: 'Regras, obrigatoriedade, procedimentos e legislação.' },
  { id: 'legis', nome: 'Legislação', ic: '⚖️', desc: 'Leis, normas, portarias e atualizações do setor de transporte.' },
  { id: 'logistica', nome: 'Transporte e Logística', ic: '🚚', desc: 'Notícias, informações e novidades do mercado.' },
  { id: 'avisos', nome: 'Comunicados', ic: '📢', desc: 'Avisos importantes e comunicados gerais.' }
];
const LIM = { nome: 40, titulo: 140, texto: 5000 };

function createForum(dir) {
  const FILE = path.join(dir, 'forum.json');
  const SENHA = process.env.NEXORA_ADMIN_SENHA || crypto.randomBytes(6).toString('base64url');
  const generated = !process.env.NEXORA_ADMIN_SENHA;
  const sessions = new Map(); /* token -> expira em (ms) */
  let db = { topics: [] };
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (!Array.isArray(db.topics)) db = { topics: [] }; } catch (e) {
    db = { topics: [{ id: id(), cat: 'avisos', titulo: 'Bem-vindo ao fórum NEXORA', texto: 'Este é o espaço para trocar informações sobre ANTT, CIOT, frete mínimo, vale-pedágio e legislação do transporte.\n\nOs tópicos são abertos pela administração; qualquer pessoa pode responder informando um nome ou apelido. Seja respeitoso e cite a fonte (resolução, portaria, lei) sempre que possível.', autor: 'Administração', admin: true, data: new Date().toISOString(), fixo: true, respostas: [] }] };
    save();
  }
  function id() { return crypto.randomBytes(6).toString('hex'); }
  function save() { fs.mkdirSync(dir, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 1)); fs.renameSync(tmp, FILE); }
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, n);
  const isAdmin = req => { const t = req.headers['x-admin-token']; const e = t && sessions.get(t); if (!e) return false; if (e < Date.now()) { sessions.delete(t); return false; } return true; };
  /* limite simples contra abuso: 20 escritas por minuto por IP; 5 tentativas de senha por minuto */
  const hits = new Map();
  const rate = (key, max) => { const now = Date.now(), a = (hits.get(key) || []).filter(t => now - t < 60000); a.push(now); hits.set(key, a); return a.length <= max; };
  const pub = t => ({ ...t, respostas: t.respostas || [] });

  function send(res, code, obj, SEC) { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
  function body(req) { return new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 20000) { no(new Error('grande')); req.destroy(); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); }); }

  async function handle(req, res, p, SEC) {
    const ip = req.socket.remoteAddress || '?', m = req.method;
    try {
      if (p === '/api/forum' && m === 'GET') return send(res, 200, { cats: CATS, topics: db.topics.map(pub), admin: isAdmin(req) }, SEC);
      if (p === '/api/forum/login' && m === 'POST') {
        if (!rate('login' + ip, 5)) return send(res, 429, { erro: 'Muitas tentativas. Aguarde um minuto.' }, SEC);
        const b = await body(req); const a = Buffer.from(String(b.senha || '')), s = Buffer.from(SENHA);
        if (a.length !== s.length || !crypto.timingSafeEqual(a, s)) return send(res, 401, { erro: 'Senha incorreta.' }, SEC);
        const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, Date.now() + 8 * 3600e3); return send(res, 200, { token: t }, SEC);
      }
      if (p === '/api/forum/logout' && m === 'POST') { sessions.delete(req.headers['x-admin-token']); return send(res, 200, { ok: true }, SEC); }
      if (m !== 'GET' && !rate('w' + ip, 20)) return send(res, 429, { erro: 'Muitas mensagens seguidas. Aguarde um minuto.' }, SEC);
      if (p === '/api/forum/topics' && m === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { erro: 'Só o administrador cria tópicos.' }, SEC);
        const b = await body(req); const cat = CATS.find(c => c.id === b.cat), titulo = clean(b.titulo, LIM.titulo), texto = clean(b.texto, LIM.texto);
        if (!cat || !titulo || !texto) return send(res, 422, { erro: 'Informe categoria, título e texto.' }, SEC);
        const t = { id: id(), cat: cat.id, titulo, texto, autor: clean(b.autor, LIM.nome) || 'Administração', admin: true, data: new Date().toISOString(), fixo: !!b.fixo, respostas: [] };
        db.topics.unshift(t); save(); return send(res, 201, pub(t), SEC);
      }
      let mt = p.match(/^\/api\/forum\/topics\/([a-f0-9]{12})(\/replies(?:\/([a-f0-9]{12}))?)?$/);
      if (mt) {
        const t = db.topics.find(x => x.id === mt[1]); if (!t) return send(res, 404, { erro: 'Tópico não encontrado.' }, SEC);
        if (!mt[2] && m === 'DELETE') { if (!isAdmin(req)) return send(res, 403, { erro: 'Só o administrador apaga tópicos.' }, SEC); db.topics = db.topics.filter(x => x !== t); save(); return send(res, 200, { ok: true }, SEC); }
        if (mt[2] && !mt[3] && m === 'POST') {
          const b = await body(req); const autor = clean(b.autor, LIM.nome), texto = clean(b.texto, LIM.texto);
          if (!autor || !texto) return send(res, 422, { erro: 'Informe seu nome e a mensagem.' }, SEC);
          if (t.fechado && !isAdmin(req)) return send(res, 403, { erro: 'Este tópico está fechado para respostas.' }, SEC);
          const r = { id: id(), autor, texto, admin: isAdmin(req), data: new Date().toISOString() }; (t.respostas = t.respostas || []).push(r); save(); return send(res, 201, r, SEC);
        }
        if (mt[3] && m === 'DELETE') { if (!isAdmin(req)) return send(res, 403, { erro: 'Só o administrador apaga respostas.' }, SEC); t.respostas = (t.respostas || []).filter(r => r.id !== mt[3]); save(); return send(res, 200, { ok: true }, SEC); }
      }
      return send(res, 404, { erro: 'Rota não encontrada.' }, SEC);
    } catch (e) { return send(res, 400, { erro: 'Requisição inválida.' }, SEC); }
  }
  return { handle, CATS, senha: SENHA, generated, _db: () => db };
}
module.exports = { createForum, CATS };
