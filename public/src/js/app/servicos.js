/* NEXORA — serviços automáticos e gratuitos usados na Roteirização, no cadastro de clientes e nas calculadoras.
 *   Clima ............ Open-Meteo (sem cadastro) — previsão diária até 16 dias
 *   CEP ............... ViaCEP (reserva: BrasilAPI)
 *   Feriados .......... nacionais pela BrasilAPI (via servidor, com cache) + estaduais fixos (lista do NEXORA)
 *   IPCA .............. Banco Central (SGS 433), via servidor com cache; sem servidor, direto no BCB
 *   Pedágio ........... praças das rodovias federais concedidas (ANTT, dados abertos) — precisa do servidor
 */
const SV = (function () {
  'use strict';
  const mem = {};
  const once = (k, fn) => mem[k] || (mem[k] = fn().catch(e => { delete mem[k]; throw e; }));
  async function getJ(url, t = 15000) { const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout ? AbortSignal.timeout(t) : undefined }); if (!r.ok) throw new Error('HTTP ' + r.status); const ct = r.headers.get('content-type') || ''; if (!ct.includes('json')) throw Object.assign(new Error('sem servidor'), { semServidor: true }); return r.json(); }
  const iso = d => d.toISOString().slice(0, 10);
  const hoje = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };

  /* ---------- clima (Open-Meteo) ---------- */
  const WMO = c => c == null ? ['❔', 'sem dado'] : c === 0 ? ['☀️', 'céu limpo'] : c <= 2 ? ['🌤️', 'poucas nuvens'] : c === 3 ? ['☁️', 'nublado'] : c <= 48 ? ['🌫️', 'neblina'] : c <= 57 ? ['🌦️', 'garoa'] : c <= 67 ? ['🌧️', 'chuva'] : c <= 77 ? ['🌨️', 'neve'] : c <= 82 ? ['🌧️', 'pancadas de chuva'] : ['⛈️', 'tempestade'];
  async function clima(lat, lon, data) {
    if (lat == null || !data) return null;
    const dias = (Date.parse(data + 'T00:00:00Z') - hoje()) / 864e5; if (dias < 0 || dias > 15) return { foraDoPrazo: true };
    const k = `cl:${(+lat).toFixed(2)},${(+lon).toFixed(2)},${data}`;
    return once(k, async () => {
      const j = await getJ(`https://api.open-meteo.com/v1/forecast?latitude=${(+lat).toFixed(3)}&longitude=${(+lon).toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=America%2FSao_Paulo&start_date=${data}&end_date=${data}`);
      const d = j.daily || {}, g = n => (d[n] || [])[0];
      const r = { codigo: g('weather_code'), tmax: g('temperature_2m_max'), tmin: g('temperature_2m_min'), chuva: g('precipitation_sum'), prob: g('precipitation_probability_max'), vento: g('wind_speed_10m_max') };
      const [ic, tx] = WMO(r.codigo); r.icone = ic; r.texto = tx;
      r.alertas = [];
      if (r.chuva >= 20 || r.codigo >= 95) r.alertas.push('chuva forte: proteja a carga (lona) e conte com atraso');
      if (r.vento >= 50) r.alertas.push('vento forte: reforce a amarração e cuidado com carga alta');
      if (r.tmax >= 35) r.alertas.push('calor: atenção a cargas sensíveis à temperatura');
      return r;
    });
  }

  /* ---------- CEP ---------- */
  async function cep(c) {
    const d = String(c || '').replace(/\D/g, ''); if (d.length !== 8) return null;
    return once('cep:' + d, async () => {
      try { const j = await getJ(`https://viacep.com.br/ws/${d}/json/`, 8000); if (j.erro) return { naoEncontrado: true }; return { cep: d, logradouro: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '' }; }
      catch (e) { const j = await getJ(`https://brasilapi.com.br/api/cep/v1/${d}`, 8000); return { cep: d, logradouro: j.street || '', bairro: j.neighborhood || '', cidade: j.city || '', uf: j.state || '' }; }
    });
  }

  /* ---------- feriados ---------- */
  /* estaduais de data fixa (principais; feriados municipais e móveis estaduais não entram) */
  const EST = { AC: { '01-23': 'Dia do Evangélico', '06-15': 'Aniversário do Acre', '09-05': 'Dia da Amazônia', '11-17': 'Tratado de Petrópolis' }, AL: { '09-16': 'Emancipação de Alagoas' }, AM: { '09-05': 'Elevação do Amazonas a província' }, AP: { '03-19': 'Dia de São José', '10-05': 'Criação do Amapá' }, BA: { '07-02': 'Independência da Bahia' }, CE: { '03-25': 'Data Magna do Ceará' }, MA: { '07-28': 'Adesão do Maranhão à Independência' }, MS: { '10-11': 'Criação de Mato Grosso do Sul' }, PA: { '08-15': 'Adesão do Pará à Independência' }, PB: { '08-05': 'Fundação da Paraíba' }, PE: { '03-06': 'Revolução Pernambucana' }, PI: { '10-19': 'Dia do Piauí' }, PR: { '12-19': 'Emancipação do Paraná' }, RJ: { '04-23': 'Dia de São Jorge' }, RN: { '10-03': 'Mártires de Cunhaú e Uruaçu' }, RO: { '01-04': 'Criação de Rondônia' }, RR: { '10-05': 'Criação de Roraima' }, RS: { '09-20': 'Revolução Farroupilha' }, SE: { '07-08': 'Emancipação de Sergipe' }, SP: { '07-09': 'Revolução Constitucionalista' }, TO: { '10-05': 'Criação do Tocantins' } };
  /* nacionais de reserva (fixos), se a BrasilAPI não responder */
  const NAC = { '01-01': 'Confraternização Universal', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '09-07': 'Independência', '10-12': 'Nossa Senhora Aparecida', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal' };
  async function nacionais(ano) {
    return once('fer:' + ano, async () => {
      let l; try { l = await getJ(`/api/servicos/feriados/${ano}`); } catch (e) { try { l = (await getJ(`https://brasilapi.com.br/api/feriados/v1/${ano}`)).map(f => ({ data: f.date, nome: f.name })); } catch (e2) { l = Object.entries(NAC).map(([md, nome]) => ({ data: `${ano}-${md}`, nome, reserva: true })); } }
      return Object.fromEntries(l.map(f => [f.data, f.nome]));
    });
  }
  async function feriado(data, uf) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return null;
    const n = await nacionais(data.slice(0, 4)), md = data.slice(5);
    if (n[data]) return { nome: n[data], tipo: 'nacional' };
    if (uf && EST[uf] && EST[uf][md]) return { nome: EST[uf][md], tipo: 'estadual (' + uf + ')' };
    const dw = new Date(data + 'T12:00:00Z').getUTCDay(); if (dw === 0) return { nome: 'Domingo', tipo: 'fim de semana' };
    return null;
  }

  /* ---------- IPCA ---------- */
  async function ipca() {
    return once('ipca', async () => {
      try { return await getJ('/api/servicos/ipca'); }
      catch (e) { const l = await getJ('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/01/2000'); return { fonte: 'Banco Central — SGS 433', serie: l.map(x => { const [d, m, a] = x.data.split('/'); return { m: `${a}-${m}`, v: +String(x.valor).replace(',', '.') }; }) }; }
    });
  }
  /* corrige um valor do mês de origem até o último mês publicado (ou mesFim): acumula os meses seguintes ao de origem */
  async function corrigir(valor, mesIni, mesFim) {
    const s = (await ipca()).serie, ult = s[s.length - 1].m, fim = mesFim && mesFim < ult ? mesFim : ult;
    let f = 1, n = 0; for (const x of s) if (x.m > mesIni && x.m <= fim) { f *= 1 + x.v / 100; n++; }
    return { valor: valor * f, fator: f, pct: (f - 1) * 100, meses: n, ate: fim, ultimo: ult };
  }

  /* ---------- pedágio: praças da ANTT perto do traçado ---------- */
  async function pracas() { return once('pracas', () => getJ('/api/servicos/pedagio', 60000)); }
  function distSeg(p, a, b) { /* km, projeção equiretangular local */
    const k = Math.cos(p[0] * Math.PI / 180) * 111.32, X = q => [(q[1] - p[1]) * k, (q[0] - p[0]) * 110.57], A = X(a), B = X(b), dx = B[0] - A[0], dy = B[1] - A[1], L = dx * dx + dy * dy;
    let t = L ? -(A[0] * dx + A[1] * dy) / L : 0; t = Math.max(0, Math.min(1, t)); const x = A[0] + t * dx, y = A[1] + t * dy; return Math.sqrt(x * x + y * y);
  }
  async function pedagioNaRota(geom, raioKm = 0.8) {
    if (!geom || geom.length < 2) return null;
    const P = await pracas(); let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180; for (const g of geom) { minLa = Math.min(minLa, g[0]); maxLa = Math.max(maxLa, g[0]); minLo = Math.min(minLo, g[1]); maxLo = Math.max(maxLo, g[1]); }
    const cand = P.pracas.filter(p => p.lat >= minLa - .05 && p.lat <= maxLa + .05 && p.lon >= minLo - .05 && p.lon <= maxLo + .05), achou = [], vistos = new Set();
    for (const p of cand) { const pt = [p.lat, p.lon]; let d = 1e9; for (let i = 1; i < geom.length && d > raioKm; i++) d = Math.min(d, distSeg(pt, geom[i - 1], geom[i])); if (d <= raioKm) { const k = p.conc + '|' + p.nome; if (!vistos.has(k)) { vistos.add(k); achou.push(p); } } }
    return { fonte: P.fonte, atualizado: P.atualizado, pracas: achou };
  }

  return { clima, cep, feriado, nacionais, ipca, corrigir, pracas, pedagioNaRota, EST };
})();
