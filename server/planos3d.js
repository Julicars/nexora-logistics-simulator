/* NEXORA — links de visualização do plano 3D (só leitura).
 * O escritório (com a chave do sistema) guarda o plano; quem tem o link ver.html?p=ID&t=TOKEN só consegue LER.
 * Guardado em data/planos3d/ID.json; apagado depois de 60 dias. Sem dados pessoais: só medidas, posições e nomes de produto.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

function createPlanos3d(dataDir, autorizado) {
  const dir = path.join(dataDir, 'planos3d'), DIAS = 60;
  const json = (res, SEC, code, o) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  const corpo = req => new Promise((ok, no) => { const p = []; let n = 0; req.on('data', d => { n += d.length; if (n > 2e6) { no(Object.assign(new Error('Plano grande demais.'), { status: 413 })); req.destroy(); } else p.push(d); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(p).toString('utf8') || '{}')); } catch (e) { no(Object.assign(new Error('JSON inválido.'), { status: 400 })); } }); req.on('error', no); });
  const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001F\u007F<>]/g, ' ').trim().slice(0, n);
  const nr = (x, max = 1e6) => { const v = +x; return Number.isFinite(v) ? Math.max(-max, Math.min(max, Math.round(v * 1000) / 1000)) : 0; };
  const cor = c => /^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : '#f39a2b';
  /* valida e reduz ao formato esperado (nada além de números e textos curtos) */
  function limpo(b) {
    const ps = (Array.isArray(b.ps) ? b.ps : []).slice(0, 2000).map(p => [txt(p[0], 80), txt(p[1], 40), cor(p[2]), nr(p[3]), txt(p[4], 60), p[5] === 'b' ? 'b' : '']);
    const vs = (Array.isArray(b.vs) ? b.vs : []).slice(0, 5).map(v => ({ nm: txt(v.nm, 60), cat: txt(v.cat, 20), L: nr(v.L, 30), W: nr(v.W, 5), H: nr(v.H, 5), Hm: nr(v.Hm, 5), wag: Math.max(1, Math.min(3, Math.round(+v.wag || 1))), esp: txt(v.esp, 10), b: txt(v.b, 12),
      it: (Array.isArray(v.it) ? v.it : []).slice(0, 3000).map(i => [nr(i[0], 30), nr(i[1], 5), nr(i[2], 5), nr(i[3], 30), nr(i[4], 5), nr(i[5], 5), Math.max(0, Math.min(2, Math.round(+i[6] || 0))), Math.round(+i[7] || 0), Math.max(0, Math.min(ps.length - 1, Math.round(+i[8] || 0)))]) }));
    if (!vs.length || !vs.some(v => v.it.length)) throw Object.assign(new Error('Plano vazio.'), { status: 400 });
    return { v: 1, nome: txt(b.nome, 80), data: new Date().toISOString(), vs, ps };
  }
  function limpar() { try { const lim = Date.now() - DIAS * 864e5; for (const f of fs.readdirSync(dir)) { const fp = path.join(dir, f); if (fs.statSync(fp).mtimeMs < lim) fs.rmSync(fp, { force: true }); } } catch (e) { /* pasta ainda não existe */ } }
  async function handle(req, res, p, SEC) {
    const u = new URL(req.url, 'http://x'), id = p.replace(/^\/api\/planos3d\/?/, '');
    try {
      if (!id && req.method === 'POST') {
        if (!autorizado(req)) return json(res, SEC, 401, { erro: 'Chave de acesso necessária.', chave: true });
        const o = limpo(await corpo(req)), nid = crypto.randomBytes(6).toString('hex'), token = crypto.randomBytes(12).toString('base64url');
        fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, nid + '.json'), JSON.stringify({ token, ...o })); limpar();
        return json(res, SEC, 201, { id: nid, token, expira: new Date(Date.now() + DIAS * 864e5).toISOString() });
      }
      if (/^[0-9a-f]{12}$/.test(id) && req.method === 'GET') {
        let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8')); } catch (e) { return json(res, SEC, 404, { erro: 'Plano não encontrado (pode ter expirado).' }); }
        const t = String(u.searchParams.get('t') || ''), A = Buffer.from(t), B = Buffer.from(d.token);
        if (!(A.length === B.length && crypto.timingSafeEqual(A, B))) return json(res, SEC, 403, { erro: 'Link inválido.' });
        const { token, ...pub } = d; return json(res, SEC, 200, pub);
      }
      return json(res, SEC, 404, { erro: 'Rota não encontrada.' });
    } catch (e) { return json(res, SEC, e.status || 400, { erro: e.message }); }
  }
  return { handle, limpar };
}
module.exports = { createPlanos3d };
