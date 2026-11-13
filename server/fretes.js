/*
 * NEXORA — Registro de fretes contratados (lado do servidor). Sem banco de dados: data/fretes.json.
 * Qualquer pessoa com acesso ao servidor lê e grava (o sistema não tem login). Use em rede interna.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const MAX = 5000, TXT = 300;
function createFretes(dir, nome = 'fretes') {
  const FILE = path.join(dir, nome + '.json'), BASE = '/api/' + nome;
  let db = { fretes: [] };
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (!Array.isArray(db.fretes)) db = { fretes: [] }; } catch (e) { db = { fretes: [] }; }
  const save = () => { fs.mkdirSync(dir, { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 1)); fs.renameSync(t, FILE); };
  /* limpa o registro: só campos simples, textos curtos, números finitos, listas pequenas */
  function clean(o) {
    const out = {};
    for (const [k, v] of Object.entries(o || {})) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,30}$/.test(k)) continue;
      if (typeof v === 'number') { if (Number.isFinite(v)) out[k] = v; }
      else if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'string') out[k] = k === 'foto' ? (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 300000 ? v : '') : v.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, TXT);
      else if (Array.isArray(v)) out[k] = v.slice(0, 50).map(x => typeof x === 'object' && x ? clean(x) : typeof x === 'string' ? x.slice(0, TXT) : Number.isFinite(x) ? x : null).filter(x => x !== null);
    }
    return out;
  }
  const send = (res, code, obj, SEC) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const body = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 400000) { no(new Error('grande')); req.destroy(); } }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); });
  async function handle(req, res, p, SEC) {
    const m = req.method;
    try {
      if (p === BASE && m === 'GET') return send(res, 200, { fretes: db.fretes }, SEC);
      if (p === BASE && m === 'POST') {
        if (db.fretes.length >= MAX) return send(res, 507, { erro: 'Limite de registros atingido. Exporte e limpe os antigos.' }, SEC);
        const f = { ...clean(await body(req)), id: crypto.randomBytes(6).toString('hex'), criado: new Date().toISOString() };
        db.fretes.unshift(f); save(); return send(res, 201, f, SEC);
      }
      const mt = p.slice(BASE.length).match(/^\/([a-f0-9]{12})$/);
      if (mt) {
        const i = db.fretes.findIndex(x => x.id === mt[1]); if (i < 0) return send(res, 404, { erro: 'Registro não encontrado.' }, SEC);
        if (m === 'PUT') { const f = { ...clean(await body(req)), id: db.fretes[i].id, criado: db.fretes[i].criado, alterado: new Date().toISOString() }; db.fretes[i] = f; save(); return send(res, 200, f, SEC); }
        if (m === 'DELETE') { db.fretes.splice(i, 1); save(); return send(res, 200, { ok: true }, SEC); }
      }
      return send(res, 404, { erro: 'Rota não encontrada.' }, SEC);
    } catch (e) { return send(res, 400, { erro: 'Requisição inválida.' }, SEC); }
  }
  return { handle };
}
module.exports = { createFretes };
