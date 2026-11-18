/* NEXORA — viagens com link para o motorista.
 * O escritório cria a viagem a partir da rota (entregas na ordem). O motorista abre /motorista.html?v=ID&t=TOKEN
 * (sem chave do sistema, só com o token daquela viagem), marca cada entrega como entregue ou com problema,
 * tira a foto do canhoto e o escritório acompanha em tempo quase real.
 * Fotos: JPEG reduzido no celular, guardado em data/viagens/ID/. Viagens com mais de 120 dias são apagadas.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

function createViagens(dataDir, autorizado) {
  const dir = path.join(dataDir, 'viagens'), IDX = path.join(dir, 'viagens.json');
  const lerJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const grava = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o)); fs.renameSync(t, f); };
  let db = lerJ(IDX, { viagens: [] });
  const salva = () => grava(IDX, db);
  const txt = (s, n = 160) => String(s ?? '').replace(/[\u0000-\u001F\u007F<>]/g, ' ').trim().slice(0, n);
  const igual = (a, b) => { const A = Buffer.from(String(a || '')), B = Buffer.from(String(b)); return A.length === B.length && crypto.timingSafeEqual(A, B); };
  function limpar() { const lim = Date.now() - 120 * 864e5, velhas = db.viagens.filter(v => Date.parse(v.criado) < lim); if (!velhas.length) return; for (const v of velhas) fs.rmSync(path.join(dir, v.id), { recursive: true, force: true }); db.viagens = db.viagens.filter(v => !velhas.includes(v)); salva(); }
  const publica = (v, comToken) => ({ id: v.id, ...(comToken ? { token: v.token } : {}), criado: v.criado, nome: v.nome, motorista: v.motorista, placa: v.placa, origem: v.origem, saida: v.saida,
    paradas: v.paradas.map((p, i) => ({ n: i + 1, nome: p.nome, cidade: p.cidade, end: p.end, obs: p.obs, horario: p.horario, telefone: p.telefone, lat: p.lat, lon: p.lon, volumes: p.volumes, kg: p.kg, status: p.status, hora: p.hora, nota: p.nota, recebedor: p.recebedor, foto: !!p.foto, gps: p.gps || null })) });

  const json = (res, SEC, code, o) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  const corpo = (req, max) => new Promise((ok, no) => { const p = []; let n = 0; req.on('data', d => { n += d.length; if (n > max) { no(Object.assign(new Error('Envio grande demais.'), { status: 413 })); req.destroy(); } else p.push(d); }); req.on('end', () => { try { ok(p.length ? JSON.parse(Buffer.concat(p).toString('utf8')) : {}); } catch (e) { no(Object.assign(new Error('JSON inválido.'), { status: 400 })); } }); req.on('error', no); });

  async function handle(req, res, p, SEC) {
    const u = new URL(req.url, 'http://x'), m = req.method, partes = p.replace(/^\/api\/viagens\/?/, '').split('/').filter(Boolean), tok = u.searchParams.get('t') || req.headers['x-viagem-token'];
    try {
      /* escritório (precisa da chave do sistema) */
      if (!partes.length) {
        if (!autorizado(req)) return json(res, SEC, 401, { erro: 'Chave de acesso necessária.', chave: true });
        if (m === 'GET') { limpar(); return json(res, SEC, 200, db.viagens.slice(0, 100).map(v => { const x = publica(v, true); x.feitas = v.paradas.filter(p => p.status === 'entregue').length; x.problemas = v.paradas.filter(p => p.status === 'problema').length; return x; })); }
        if (m === 'POST') {
          const b = await corpo(req, 200000), par = Array.isArray(b.paradas) ? b.paradas.slice(0, 60) : [];
          if (!par.length) throw Object.assign(new Error('A viagem precisa de pelo menos uma entrega.'), { status: 400 });
          const v = { id: crypto.randomBytes(5).toString('hex'), token: crypto.randomBytes(9).toString('base64url'), criado: new Date().toISOString(), nome: txt(b.nome, 80), motorista: txt(b.motorista, 80), placa: txt(b.placa, 10), origem: txt(b.origem), saida: txt(b.saida, 10),
            paradas: par.map(x => ({ nome: txt(x.nome, 120), cidade: txt(x.cidade, 80), end: txt(x.end), obs: txt(x.obs, 300), horario: txt(x.horario, 60), telefone: txt(x.telefone, 20), lat: Number.isFinite(+x.lat) ? +x.lat : null, lon: Number.isFinite(+x.lon) ? +x.lon : null, volumes: Math.max(0, Math.round(+x.volumes || 0)), kg: Math.max(0, +x.kg || 0), status: 'pendente' })) };
          db.viagens.unshift(v); db.viagens = db.viagens.slice(0, 500); salva(); return json(res, SEC, 201, publica(v, true));
        }
      }
      const v = db.viagens.find(x => x.id === partes[0]); if (!v) return json(res, SEC, 404, { erro: 'Viagem não encontrada (pode ter expirado).' });
      const escritorio = autorizado(req), motorista = tok && igual(tok, v.token);
      if (!escritorio && !motorista) return json(res, SEC, 403, { erro: 'Link inválido.' });
      if (partes.length === 1 && m === 'GET') return json(res, SEC, 200, publica(v, escritorio));
      if (partes.length === 1 && m === 'DELETE' && escritorio) { fs.rmSync(path.join(dir, v.id), { recursive: true, force: true }); db.viagens = db.viagens.filter(x => x !== v); salva(); return json(res, SEC, 200, { ok: true }); }
      if (partes[1] === 'parada' && /^\d+$/.test(partes[2] || '')) {
        const i = +partes[2] - 1, pa = v.paradas[i]; if (!pa) return json(res, SEC, 404, { erro: 'Entrega não encontrada.' });
        if (partes[3] === 'foto' && m === 'GET') { const f = path.join(dir, v.id, `${i + 1}.jpg`); if (!pa.foto || !fs.existsSync(f)) return json(res, SEC, 404, { erro: 'Sem foto.' }); res.writeHead(200, { ...SEC, 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=60' }); return res.end(fs.readFileSync(f)); }
        if (m === 'POST' && !partes[3]) {
          const b = await corpo(req, 3 * 1024 * 1024);
          if (!['entregue', 'problema', 'pendente'].includes(b.status)) throw Object.assign(new Error('Status inválido.'), { status: 400 });
          Object.assign(pa, { status: b.status, hora: new Date().toISOString(), nota: txt(b.nota, 300), recebedor: txt(b.recebedor, 80) });
          if (b.gps && Number.isFinite(+b.gps.lat) && Number.isFinite(+b.gps.lon)) pa.gps = { lat: +(+b.gps.lat).toFixed(5), lon: +(+b.gps.lon).toFixed(5) };
          if (typeof b.foto === 'string' && b.foto) {
            const mt = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(b.foto); if (!mt) throw Object.assign(new Error('Foto inválida (envie JPEG).'), { status: 400 });
            const buf = Buffer.from(mt[1], 'base64'); if (buf.length > 2.5 * 1024 * 1024 || buf[0] !== 0xff || buf[1] !== 0xd8) throw Object.assign(new Error('Foto inválida.'), { status: 400 });
            fs.mkdirSync(path.join(dir, v.id), { recursive: true }); fs.writeFileSync(path.join(dir, v.id, `${i + 1}.jpg`), buf); pa.foto = true;
          }
          if (b.status === 'pendente') { delete pa.hora; pa.nota = ''; }
          salva(); return json(res, SEC, 200, publica(v, escritorio));
        }
      }
      return json(res, SEC, 404, { erro: 'Rota não encontrada.' });
    } catch (e) { return json(res, SEC, e.status || 400, { erro: e.message }); }
  }
  return { handle, limpar, total: () => db.viagens.length };
}
module.exports = { createViagens };
