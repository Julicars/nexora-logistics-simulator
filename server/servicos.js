/* NEXORA — serviços públicos gratuitos usados pela Roteirização e pelas calculadoras (com cache em disco).
 *   /api/servicos/pedagio         praças de pedágio das rodovias federais concedidas (ANTT, dados abertos, CKAN) — cache 7 dias
 *   /api/servicos/ipca            IPCA mensal (Banco Central, SGS série 433) — cache 1 dia
 *   /api/servicos/feriados/:ano   feriados nacionais (BrasilAPI) — cache 30 dias
 * O navegador também consegue falar direto com o Open-Meteo (clima) e o ViaCEP (CEP); estes não passam por aqui.
 */
'use strict';
const fs = require('fs'), path = require('path');
const DIA = 864e5;

function createServicos(dataDir, opts = {}) {
  const dir = path.join(dataDir, 'servicos');
  const lerJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const grava = (f, o) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); };
  const hosts = { antt: opts.anttHost || process.env.NEXORA_ANTT_HOST || 'https://dados.antt.gov.br', bcb: opts.bcbSgs || process.env.NEXORA_BCB_SGS || 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados', brasil: opts.brasilApi || process.env.NEXORA_BRASILAPI || 'https://brasilapi.com.br/api' };
  async function getJ(url) {
    const r = await (opts.fetch || fetch)(url, { headers: { Accept: 'application/json', 'User-Agent': 'NEXORA/3' }, signal: AbortSignal.timeout(opts.timeout || 30000) });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${new URL(url).host}`);
    return JSON.parse(Buffer.from(await r.arrayBuffer()).toString('utf8'));
  }
  let forcar = false;
  async function cache(nome, idade, fn) {
    const f = path.join(dir, nome + '.json'), c = lerJ(f, null);
    if (c && !forcar && Date.now() - c.em < idade) return c.dados;
    try { const d = await fn(); grava(f, { em: Date.now(), dados: d }); return d; }
    catch (e) { if (c) return c.dados; throw e; } /* fonte fora do ar: usa o último dado bom */
  }
  const num = v => typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));

  /* praças de pedágio: pega o recurso mais recente do pacote "praca-de-pedagio" e baixa via datastore */
  async function pracas() {
    return cache('pracas-pedagio', 7 * DIA, async () => {
      const p = await getJ(`${hosts.antt}/api/3/action/package_show?id=praca-de-pedagio`);
      const rs = ((p.result && p.result.resources) || []).filter(x => x.datastore_active).sort((a, b) => String(b.last_modified || b.created || '').localeCompare(String(a.last_modified || a.created || '')));
      if (!rs.length) throw new Error('conjunto "praca-de-pedagio" sem dados na ANTT');
      const out = [];
      for (let off = 0; off < 5000; off += 1000) {
        const j = await getJ(`${hosts.antt}/api/3/action/datastore_search?resource_id=${rs[0].id}&limit=1000&offset=${off}`);
        const recs = (j.result && j.result.records) || [];
        for (const r of recs) {
          const k = Object.fromEntries(Object.entries(r).map(([a, b]) => [a.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), b]));
          const lat = num(k.latitude), lon = num(k.longitude);
          if (!(lat < 6 && lat > -34 && lon < -28 && lon > -75)) continue;
          if (k.situacao && /inativ|desativ/i.test(k.situacao)) continue;
          out.push({ nome: k.praca_de_pedagio || k.praca || '', conc: k.concessionaria || '', rod: k.rodovia || '', uf: k.uf || '', km: num(k.km_m) || null, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, sentido: k.sentido || '' });
        }
        if (recs.length < 1000) break;
      }
      if (!out.length) throw new Error('nenhuma praça com coordenadas');
      return { fonte: `ANTT — ${rs[0].name || 'Dados das Praças de Pedágio'}`, atualizado: rs[0].last_modified || rs[0].created || null, pracas: out };
    });
  }
  /* IPCA mensal desde 2000 (variação % no mês) */
  async function ipca() {
    return cache('ipca', DIA, async () => {
      const l = await getJ(`${hosts.bcb}?formato=json&dataInicial=01/01/2000`);
      const s = l.map(x => { const [d, m, a] = String(x.data).split('/'); return { m: `${a}-${m}`, v: num(x.valor) }; }).filter(x => !isNaN(x.v));
      if (!s.length) throw new Error('série vazia'); return { fonte: 'Banco Central — SGS 433 (IPCA, variação mensal %)', serie: s };
    });
  }
  async function feriados(ano) {
    return cache('feriados-' + ano, 30 * DIA, async () => (await getJ(`${hosts.brasil}/feriados/v1/${ano}`)).map(f => ({ data: f.date, nome: f.name, tipo: f.type || 'national' })));
  }

  const json = (res, SEC, code, o) => { res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  async function handle(req, res, p, SEC) {
    if (req.method !== 'GET') return json(res, SEC, 405, { erro: 'Método não permitido.' });
    const rota = p.replace(/^\/api\/servicos\/?/, '');
    try {
      if (rota === 'pedagio') return json(res, SEC, 200, await pracas());
      if (rota === 'ipca') return json(res, SEC, 200, await ipca());
      const m = /^feriados\/(\d{4})$/.exec(rota); if (m && +m[1] > 1999 && +m[1] < 2100) return json(res, SEC, 200, await feriados(m[1]));
      return json(res, SEC, 404, { erro: 'Rota não encontrada.' });
    } catch (e) { return json(res, SEC, 502, { erro: 'Fonte indisponível agora: ' + e.message }); }
  }
  const idade = n => { const c = lerJ(path.join(dir, n + '.json'), null); return c ? new Date(c.em).toISOString() : null; };
  const info = (n, f) => { const c = lerJ(path.join(dir, n + '.json'), null); try { return c ? f(c.dados) : ''; } catch (e) { return ''; } };
  async function testar() { forcar = true; const r = {}; try { for (const [k, f] of [['pedagio', pracas], ['ipca', ipca], ['feriados', () => feriados(new Date().getFullYear())]]) { try { await f(); r[k] = { ok: true }; } catch (e) { r[k] = { ok: false, erro: e.message }; } } } finally { forcar = false; } return r; }
  return { handle, pracas, ipca, feriados, testar, estado: () => { const ano = new Date().getFullYear(); return { pedagio: idade('pracas-pedagio'), ipca: idade('ipca'), feriados: idade('feriados-' + ano), info: { pedagio: info('pracas-pedagio', d => `${d.pracas.length} praças com coordenadas`), ipca: info('ipca', d => { const u = d.serie[d.serie.length - 1]; return `último: ${u.m.split('-').reverse().join('/')} (${String(u.v).replace('.', ',')}%)`; }), feriados: info('feriados-' + ano, d => `${d.length} feriados nacionais em ${ano}`) } }; } };
}
module.exports = { createServicos };
