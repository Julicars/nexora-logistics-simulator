/* NEXORA — Montagem com Roteirização
 * Remetente (origem) + entregas em sequência. O sistema sugere a ordem de menor distância e você reordena.
 * A carga é montada pelo inverso da entrega: a última entrega vai na frente (perto da cabine) e a
 * primeira fica perto das portas.
 * Distâncias: rota real pelo OSRM (OpenStreetMap) quando há internet; sem internet, estimativa
 * (linha reta × 1,25), sempre identificada como estimativa.
 * Piso mínimo: Tabela A da ANTT (src/config/antt.js). Pedágios não são calculados.
 */
const RT = (function () {
  'use strict';
  const q = s => document.querySelector(s);
  const ROAD = 1.25; /* fator estrada/linha reta usado só na estimativa offline */
  const R = () => S.route;
  const ANTT = window.NX_ANTT;

  /* ---------- municípios (IBGE) ---------- */
  let MUN = null;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function mun() {
    if (!MUN) MUN = (window.NX_MUN || []).map(l => { const [nome, uf, la, lo, cap] = l.split('|'); return { nome, uf, lat: +la, lon: +lo, cap: cap === '1', k: norm(nome) }; });
    return MUN;
  }
  const label = c => c ? (c.city !== undefined ? c.city : c.nome) + ' - ' + c.uf : '';
  function find(txt) {
    const t = norm(txt); if (!t) return null;
    const m = t.match(/^(.*?)\s*[-\/,]\s*([a-z]{2})$/);
    const name = m ? m[1].trim() : t, uf = m ? m[2].toUpperCase() : null;
    const hits = mun().filter(c => c.k === name && (!uf || c.uf === uf));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return hits.find(c => c.cap) || null; /* nome repetido: precisa da UF */
    return null;
  }
  function suggest(txt) {
    const m = norm(txt).match(/^(.*?)\s*(?:[-\/,]\s*([a-z]{0,2}))?$/); const t = (m[1] || '').trim(), uf = (m[2] || '').toUpperCase(); if (t.length < 2) return [];
    const e = [], a = [], b = [];
    for (const c of mun()) { if (uf && !c.uf.startsWith(uf)) continue; if (c.k === t) e.push(c); else if (c.k.startsWith(t)) a.push(c); else if (c.k.includes(t)) b.push(c); }
    return e.concat(a, b).slice(0, 40);
  }

  /* ---------- distâncias ---------- */
  const hav = (a, b) => { const r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(h)); };
  const est = (a, b) => hav(a, b) * ROAD;
  const pts = () => [R().orig, ...R().stops].filter(p => p && p.lat != null);
  const ready = () => !!R().orig && R().stops.length > 0 && R().stops.every(s => s.lat != null);

  /* ordem sugerida: vizinho mais próximo a partir da origem + melhoria 2-opt (rota aberta, sem retorno) */
  function optimize() {
    const o = R().orig, st = R().stops.filter(s => s.lat != null), rest = R().stops.filter(s => s.lat == null);
    if (!o || st.length < 2) return false;
    const left = [...st], path = []; let cur = o;
    while (left.length) { let bi = 0; left.forEach((s, i) => { if (hav(cur, s) < hav(cur, left[bi])) bi = i; }); cur = left.splice(bi, 1)[0]; path.push(cur); }
    const len = p => p.reduce((s, x, i) => s + hav(i ? p[i - 1] : o, x), 0);
    let best = path, bl = len(path), imp = true;
    while (imp) { imp = false; for (let i = 0; i < best.length - 1; i++) for (let j = i + 1; j < best.length; j++) { const c = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1)); const cl = len(c); if (cl < bl - 1e-6) { best = c; bl = cl; imp = true; } } }
    const before = R().stops.map(s => s.id).join();
    R().stops = best.concat(rest);
    return before !== R().stops.map(s => s.id).join();
  }

  /* rota real (OSRM) quando há internet; cache por sequência de pontos */
  const cache = {}; let routeInfo = null, pending = '';
  function keyOf() { return pts().map(p => p.lat.toFixed(3) + ',' + p.lon.toFixed(3)).join(';'); }
  function estimate() { const p = pts(); const legs = p.slice(1).map((x, i) => est(p[i], x)); return { src: 'est', legs, km: legs.reduce((a, b) => a + b, 0), h: legs.reduce((a, b) => a + b, 0) / 65, geom: p.map(x => [x.lat, x.lon]) }; }
  function fetchRoute() {
    if (!ready()) { routeInfo = null; return; }
    const k = keyOf(); if (cache[k]) { routeInfo = cache[k]; return; }
    routeInfo = estimate();
    if (!navigator.onLine || pending === k || typeof fetch !== 'function') return;
    pending = k; const ctl = typeof AbortController === 'function' ? new AbortController() : null; const to = setTimeout(() => ctl && ctl.abort(), 7000);
    const coords = pts().map(p => p.lon + ',' + p.lat).join(';');
    fetch('https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=simplified&geometries=geojson', ctl ? { signal: ctl.signal } : {})
      .then(r => r.ok ? r.json() : Promise.reject()).then(j => {
        const rt = j.routes && j.routes[0]; if (!rt) throw 0;
        cache[k] = { src: 'osrm', legs: rt.legs.map(l => l.distance / 1000), km: rt.distance / 1000, h: rt.duration / 3600, geom: rt.geometry.coordinates.map(c => [c[1], c[0]]) };
        if (keyOf() === k) { routeInfo = cache[k]; drawSum(); drawMap(); renderAntt(); }
      }).catch(() => {}).finally(() => { clearTimeout(to); if (pending === k) pending = ''; });
  }

  /* ---------- mapa: OpenStreetMap (Leaflet) com internet; mapa próprio do Brasil sem internet ---------- */
  let lmap = null, llayer = null, tilesOk = null;
  function probeTiles() {
    if (tilesOk !== null || !window.L) return;
    tilesOk = false; const img = new Image(); let done = false;
    const fin = ok => { if (done) return; done = true; tilesOk = ok; if (ok) drawMap(); };
    img.onload = () => fin(true); img.onerror = () => fin(false); setTimeout(() => fin(false), 6000);
    img.referrerPolicy = 'no-referrer'; img.src = 'https://tile.openstreetmap.org/4/5/8.png';
  }
  function drawMap() {
    const box = q('#rMap'); if (!box) return;
    const p = pts(); const ri = routeInfo;
    if (tilesOk && window.L) {
      if (!lmap) { box.innerHTML = ''; lmap = L.map(box, { zoomControl: true, attributionControl: true }); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(lmap); llayer = L.layerGroup().addTo(lmap); }
      llayer.clearLayers();
      if (!p.length) { lmap.setView([-15, -52], 4); return; }
      if (ri) L.polyline(ri.geom, { color: '#f7a334', weight: 4, opacity: .9 }).addTo(llayer);
      p.forEach((x, i) => L.marker([x.lat, x.lon], { icon: L.divIcon({ className: 'rpin' + (i ? '' : ' o'), html: i ? String(i) : 'R', iconSize: [26, 26] }), title: i ? 'Entrega ' + i + ': ' + label(x) : 'Remetente: ' + label(x) }).addTo(llayer));
      const b = L.latLngBounds(p.map(x => [x.lat, x.lon])); if (ri) ri.geom.forEach(g => b.extend(g));
      lmap.fitBounds(b.pad(0.15), { maxZoom: 11 }); setTimeout(() => lmap.invalidateSize(), 60);
      q('#rMapNote').textContent = 'Mapa © colaboradores do OpenStreetMap.';
      return;
    }
    if (lmap) { lmap.remove(); lmap = null; }
    /* mapa próprio (offline): estados do Brasil + pontos + traçado */
    let x0 = -74, x1 = -34, y0 = 5.5, y1 = 34; /* x = lon, y = -lat */
    if (p.length) { const xs = p.map(a => a.lon), ys = p.map(a => -a.lat); const pad = Math.max(2.5, (Math.max(...xs) - Math.min(...xs)) * .25, (Math.max(...ys) - Math.min(...ys)) * .25); x0 = Math.min(...xs) - pad; x1 = Math.max(...xs) + pad; y0 = Math.min(...ys) - pad; y1 = Math.max(...ys) + pad; }
    const w = x1 - x0, h = y1 - y0, u = Math.max(w, h) / 60;
    const line = ri ? ri.geom.map(g => `${g[1].toFixed(3)},${(-g[0]).toFixed(3)}`).join(' ') : '';
    box.innerHTML = `<svg viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#0b1a33"/>
      ${(window.NX_BR || []).map(([uf, d]) => `<path d="${d}" fill="#14284a" stroke="#2c4a7a" stroke-width="${u * .12}"><title>${uf}</title></path>`).join('')}
      ${line ? `<polyline points="${line}" fill="none" stroke="#f7a334" stroke-width="${u * .35}" stroke-linejoin="round" stroke-linecap="round" ${ri.src === 'est' ? `stroke-dasharray="${u} ${u * .6}"` : ''}/>` : ''}
      ${p.map((a, i) => `<g><circle cx="${a.lon}" cy="${-a.lat}" r="${u * .95}" fill="${i ? '#2f8cf2' : '#f7a334'}" stroke="#fff" stroke-width="${u * .15}"/><text x="${a.lon}" y="${-a.lat + u * .38}" font-size="${u * 1.05}" text-anchor="middle" fill="${i ? '#fff' : '#1b1200'}" font-weight="800" font-family="sans-serif">${i || 'R'}</text></g>`).join('')}
    </svg>`;
    q('#rMapNote').textContent = p.length ? (ri && ri.src === 'osrm' ? 'Traçado real da rota (OSRM / OpenStreetMap).' : 'Sem acesso ao OpenStreetMap neste ambiente: mapa simplificado e traçado aproximado (linha tracejada).') : 'Informe a cidade de origem e as entregas para ver a rota.';
  }

  /* ---------- painel ---------- */
  const uid = () => 's' + Math.random().toString(36).slice(2, 8);
  function rank(id) { if (!id) return null; const i = R().stops.findIndex(s => s.id === id); return i < 0 ? null : i + 1; }
  function stopName(id) { const s = R().stops.find(x => x.id === id); return s ? (s.nome ? s.nome + ' — ' : '') + (s.city ? label(s) : 'cidade não informada') : ''; }
  const ambig = t => { const h = suggest(t).filter(c => c.k === norm(t).replace(/\s*-.*$/, '')); return h.length > 1 ? `Existe ${h.length} cidades com esse nome (${h.map(c => c.uf).join(', ')}). Escolha na lista ou digite com a UF.` : 'Cidade não encontrada. Escolha uma da lista (ex.: Campinas - SP).'; };
  const stopOptions = sel => R().stops.map((s, i) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>E${i + 1} · ${esc(s.city ? s.nome || s.city : 'Entrega ' + (i + 1))}${s.city ? ' (' + esc(s.uf) + ')' : ''}</option>`).join('');
  const lastStop = () => { const s = R().stops; return s.length ? s[s.length - 1].id : ''; };

  function renderStops() {
    const st = R().stops;
    q('#rStops').innerHTML = st.map((s, i) => `<li data-sid="${s.id}">
      <span class="rnum" aria-hidden="true">${i + 1}</span>
      <div class="rfields">
        <input data-rk="nome" value="${esc(s.nome || '')}" maxlength="120" placeholder="Destinatário" aria-label="Destinatário da entrega ${i + 1}">
        <input data-rk="city" value="${esc(s.city ? label(s) : s.txt || '')}" class="cityac" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" placeholder="Digite a cidade" aria-label="Cidade da entrega ${i + 1}" ${s.txt && s.lat == null ? 'aria-invalid="true"' : ''}>
        ${s.txt && s.lat == null ? `<small class="bad">${ambig(s.txt)}</small>` : ''}
        ${routeInfo && routeInfo.legs[i] != null ? `<small class="mut">${i ? 'da entrega ' + i : 'da origem'}: ${fmt(routeInfo.legs[i], 0)} km${routeInfo.src === 'est' ? ' (estimado)' : ''}</small>` : ''}
      </div>
      <div class="rbtns">
        <button class="btn sm" data-ra="up" ${i ? '' : 'disabled'} aria-label="Subir entrega ${i + 1}">↑</button>
        <button class="btn sm" data-ra="down" ${i < st.length - 1 ? '' : 'disabled'} aria-label="Descer entrega ${i + 1}">↓</button>
        <button class="btn sm" data-ra="del" aria-label="Remover entrega ${i + 1}">×</button>
      </div></li>`).join('') || '<li class="mut" style="list-style:none">Nenhuma entrega. Clique em “+ Adicionar entrega”.</li>';
  }
  function drawSum() {
    const ri = routeInfo, el = q('#rSum');
    if (!ri) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="kpis rkpis"><div class="kpi"><b>${fmt(ri.km, 0)} km</b><span>${ri.src === 'osrm' ? 'distância pela estrada' : 'distância estimada'}</span></div><div class="kpi"><b>${Math.floor(ri.h)}h${String(Math.round((ri.h % 1) * 60)).padStart(2, '0')}</b><span>tempo ${ri.src === 'osrm' ? 'de direção' : 'estimado'}</span></div><div class="kpi"><b>${R().stops.length}</b><span>entrega(s)</span></div></div>
      <small class="mut">${ri.src === 'osrm' ? 'Rota calculada pelo OSRM sobre o OpenStreetMap, da origem até a última entrega (sem retorno).' : 'Estimativa: distância em linha reta × 1,25. Confira a quilometragem real antes de fechar o frete.'} Pedágios não são calculados.</small>`;
    renderStopsKm();
  }
  function renderStopsKm() { if (!document.activeElement || !q('#rStops').contains(document.activeElement)) renderStops(); }

  function axlesOf(v) { try { return NX.axleModel(v).ax.reduce((s, a) => s + (/triplo/i.test(a.n) ? 3 : /tandem duplo/i.test(a.n) ? 2 : 1), 0); } catch (e) { return 2; } }
  function renderAntt() {
    if (!ANTT) return;
    const r = R(), v = curVeh(), m = NX.axleModel(v), small = m.pbt <= 3500, ex = axlesOf(v);
    q('#rTipo').innerHTML = Object.entries(ANTT.T).map(([k, t]) => `<option value="${k}" ${k === r.tipo ? 'selected' : ''}>${t.nome}</option>`).join('');
    /* eixos vêm do veículo escolhido no Pedido (configuração de eixos da frota) — não se escolhe aqui */
    const n = ANTT.EIXOS.includes(ex) ? ex : (ANTT.coef(r.tipo, ex) || {}).eixos;
    q('#rEixos').innerHTML = small
      ? `<div class="axfix small"><div><b>${esc(v.name)}</b><small>Veículo de carga de pequeno porte (PBT até 3,5 t). Não usa a tabela por eixos.</small></div></div>`
      : `<div class="axfix">${axSvg(AXL[n] ? n : 2)}<div><b>${ex} eixos${n !== ex ? ' (tabela de ' + n + ')' : ''}</b><small>${esc(v.name)} · ${esc(m.cfg.replace(/\s*\(.*\)\s*$/, ''))}</small></div><button type="button" class="btn sm" id="rAxChange">Trocar no Pedido</button></div>`;
    const el = q('#rAntt'); pisoTot = 0;
    if (!routeInfo) { el.innerHTML = '<span class="mut">Informe origem e entregas para calcular o piso.</span>'; renderExtras(); return; }
    const nVeh = plan && mode === 'route' ? plan.vehs.length : 1;
    const vs = (plan && mode === 'route' && plan.vehs[0].v.id === v.id ? plan.vehs.map(V => V.v) : [v]); const smallV = vs.filter(vv => NX.axleModel(vv).pbt <= 3500);
    const rows = vs.filter(vv => !smallV.includes(vv)).map(vv => ({ vv, p: ANTT.piso(routeInfo.km, r.tipo, axlesOf(vv)) })).filter(x => x.p);
    if (!rows.length) { el.innerHTML = `<p style="margin:0"><b>Piso ANTT não se aplica a este cálculo.</b></p><p class="mut" style="font-size:12px;margin:6px 0 0">${smallV.map(x => esc(x.name)).join(', ')}: veículo de carga de pequeno porte (Lei 15.485/2026, PBT até 3,5 t). A tabela da ANTT em vigor só tem coeficientes por eixos de caminhão (2 a 9 eixos). Informe o frete combinado na Cotação; os valores adicionais abaixo continuam somando.</p>`; renderExtras(); return; }
    const tot = rows.reduce((s, x) => s + x.p.valor, 0); pisoTot = tot;
    el.innerHTML = rows.map((x, xi) => (smallV.length && !xi ? `<p class="mut" style="font-size:12px;margin:0 0 6px">${smallV.map(x => esc(x.name)).join(', ')}: pequeno porte, fora da tabela por eixos.</p>` : '') + `<div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(x.vv.name)} · ${x.p.eixos} eixos<br><small class="mut">${fmt(routeInfo.km, 0)} km × ${brl(x.p.ccd).replace('R$', 'R$ ')}/km + ${brl(x.p.cc)} (carga e descarga)</small></span><b>${brl(x.p.valor)}</b></div>`).join('<hr style="border-color:var(--line)">')
      + (nVeh > 1 ? `<div style="display:flex;justify-content:space-between;margin-top:6px"><span>Total (${nVeh} veículos)</span><b>${brl(tot)}</b></div>` : '')
      + `<p class="mut" style="margin:6px 0 0;font-size:12px">${esc(ANTT.fonte)}. ${routeInfo.src === 'est' ? 'Com distância estimada, o piso também é estimado.' : ''} Valor mínimo sem retorno vazio e sem pedágio.</p>`;
    renderExtras();
  }

  /* ---------- desenho dos eixos ---------- */
  const AXNAME = { 2: 'Toco / 3/4', 3: 'Truck', 4: 'Bitruck ou carreta 2 eixos', 5: 'Carreta 3 eixos (cavalo toco)', 6: 'Carreta 3 eixos (cavalo trucado)', 7: 'Bitrem', 9: 'Rodotrem' };
  /* posições das rodas (x de 0 a 100) por configuração; t = onde termina o caminhão e começa a carreta */
  const AXL = { 2: { cab: 1, w: [14, 70] }, 3: { cab: 1, w: [14, 62, 74] }, 4: { cab: 1, w: [12, 22, 64, 76] }, 5: { w: [8, 24, 66, 76, 86] }, 6: { w: [8, 20, 28, 66, 76, 86] }, 7: { w: [6, 16, 23, 46, 54, 80, 88] }, 9: { w: [5, 13, 19, 34, 41, 58, 65, 84, 91] } };
  function axSvg(n) {
    const c = AXL[n], wh = c.w.map(x => `<circle cx="${x}" cy="27" r="4.2" fill="#0b1430" stroke="currentColor" stroke-width="1.6"/>`).join('');
    const body = c.cab ? `<rect x="2" y="9" width="17" height="14" rx="2" fill="currentColor" opacity=".9"/><rect x="21" y="5" width="77" height="18" rx="1.5" fill="currentColor" opacity=".45"/>`
      : n === 7 ? `<rect x="2" y="9" width="14" height="14" rx="2" fill="currentColor" opacity=".9"/><rect x="18" y="5" width="40" height="18" rx="1.5" fill="currentColor" opacity=".45"/><rect x="60" y="5" width="38" height="18" rx="1.5" fill="currentColor" opacity=".45"/>`
      : n === 9 ? `<rect x="2" y="9" width="13" height="14" rx="2" fill="currentColor" opacity=".9"/><rect x="17" y="5" width="30" height="18" rx="1.5" fill="currentColor" opacity=".45"/><rect x="51" y="5" width="47" height="18" rx="1.5" fill="currentColor" opacity=".45"/>`
      : `<rect x="2" y="9" width="17" height="14" rx="2" fill="currentColor" opacity=".9"/><rect x="22" y="5" width="76" height="18" rx="1.5" fill="currentColor" opacity=".45"/>`;
    return `<svg viewBox="0 0 100 33" aria-hidden="true">${body}${wh}</svg>`;
  }

  /* ---------- valores adicionais ---------- */
  let pisoTot = 0;
  const XPRE = ['Chapa (carga)', 'Chapa (descarga)', 'Ajudante', 'Pernoite / estadia', 'Descarga paletizada', 'Agendamento', 'Seguro adicional', 'Escolta'];
  const extras = () => R().extras || (R().extras = []);
  function renderExtras() {
    const ex = extras(), box = q('#rExtras'); if (!box) return;
    q('#rXPre').innerHTML = XPRE.map(n => `<button type="button" class="btn sm" data-xp="${esc(n)}">+ ${esc(n)}</button>`).join('') + '<button type="button" class="btn sm" data-xp="">+ Outro</button>';
    if (!box.contains(document.activeElement)) box.innerHTML = ex.map((x, i) => `<div class="xrow" data-xi="${i}">
      <input data-xk="desc" value="${esc(x.desc)}" maxlength="80" placeholder="Descrição" aria-label="Descrição do valor adicional ${i + 1}">
      <select data-xk="stop" aria-label="Aplicar em"><option value="">Geral</option>${R().stops.map((st, k) => `<option value="${st.id}" ${st.id === x.stop ? 'selected' : ''}>E${k + 1} · ${esc(st.nome || st.city || 'Entrega ' + (k + 1))}</option>`).join('')}</select>
      <input data-xk="valor" type="number" min="0" step="0.01" value="${x.valor ?? ''}" placeholder="R$" aria-label="Valor em reais" ${x.valor == null || x.valor === '' ? 'aria-invalid="true"' : ''}>
      <button type="button" class="btn sm" data-xdel="${i}" aria-label="Remover ${esc(x.desc || 'valor')}">×</button></div>`).join('');
    renderTotal();
  }
  function renderTotal() {
    const el = q('#rTotal'); if (!el) return; const ex = extras().filter(x => +x.valor > 0);
    const add = ex.reduce((a, x) => a + (+x.valor), 0), tot = pisoTot + add;
    const qt = R().quote || {}; const fr = (qt.fretes || []).reduce((a, x) => a + (+x || 0), 0) + (+qt.outros || 0);
    const stopLbl = id => { const k = rank(id); return k ? 'E' + k : 'Geral'; };
    el.innerHTML = `<div class="trow"><span>Frete mínimo (piso ANTT)</span><b>${pisoTot ? brl(pisoTot) : '—'}</b></div>`
      + ex.map(x => `<div class="trow"><span>+ ${esc(x.desc || 'Adicional')} <small class="mut">${stopLbl(x.stop)}</small></span><b>${brl(x.valor)}</b></div>`).join('')
      + `<div class="trow tsum"><span>Total mínimo da viagem</span><b>${brl(tot)}</b></div>`
      + (fr > 0 ? `<p style="margin:6px 0 0" class="${fr + 0.005 >= tot ? 'ok' : 'bad'}">${fr + 0.005 >= tot ? '✔' : '⚠'} Cotação: ${brl(fr)} — ${fr + 0.005 >= tot ? 'cobre o total mínimo.' : 'abaixo em ' + brl(tot - fr) + '.'}</p>` : '')
      + (pisoTot ? `<button type="button" class="btn sm" id="rToQuote" style="margin-top:8px;width:100%">Levar para a Cotação</button>` : '');
  }


  /* qual entrega fica bloqueada por carga de entrega posterior (mais perto das portas) */
  function blocked(V) {
    const its = V.items, n = it => rank(it.p.stop) || 0; let c = 0;
    for (const a of its) { const ra = n(a); if (its.some(b => b.wg === a.wg && n(b) > ra && b.x >= a.x + a.l - 0.01 && b.y < a.y + a.w - 0.01 && b.y + b.w > a.y + 0.01)) c++; }
    return c;
  }
  function renderUnload() {
    const el = q('#rUnload'); if (!el) return; if (mode === 'route' && typeof stepTabs === 'function') stepTabs();
    if (mode !== 'route' || !plan) { el.innerHTML = '<p class="mut" style="font-size:12px">Depois de montar a carga, aqui aparece o que sai em cada entrega.</p>'; return; }
    const st = R().stops;
    el.innerHTML = st.map((s, i) => {
      const rows = plan.vehs.map(V => { const its = V.items.filter(it => it.p.stop === s.id); return its.length ? `${esc(V.v.name)}: <b>${its.length}</b> vol · ${fmt(its.reduce((a, b) => a + b.kg, 0), 0)} kg` : ''; }).filter(Boolean);
      return `<div class="rul"><span class="stopb">E${i + 1}</span> <b>${esc(s.nome || 'Entrega ' + (i + 1))}</b> <small class="mut">${esc(label(s))}</small><br><small>${rows.join(' · ') || '<span class="mut">sem volumes</span>'}</small></div>`;
    }).join('') + plan.vehs.map(V => { const b = blocked(V); return `<p style="margin:6px 0 0;font-size:12px" class="${b ? 'warn' : 'ok'}">${esc(V.v.name)}: ${b ? '⚠ ' + b + ' volume(s) ficaram atrás de carga de entrega posterior — confira a descarga.' : '✔ descarga na sequência: cada entrega sai sem mexer nas seguintes.'}</p>`; }).join('')
      + (plan.left.length ? `<p class="bad" style="font-size:12px">${plan.left.length} volume(s) fora do carregamento.</p>` : '');
  }

  function render() {
    const on = mode === 'route', tab = q('#tabRota'); tab.hidden = !on; if (!on) stepTabs();
    if (!on && tab.classList.contains('on')) q('[data-tab=pedido]').click();
    if (!on) return;
    const r = R();
    if (document.activeElement !== q('#rSender')) q('#rSender').value = r.sender || '';
    if (document.activeElement !== q('#rOrig')) q('#rOrig').value = r.orig ? label(r.orig) : (r.origTxt || '');
    q('#rOrigMsg').textContent = r.origTxt && !r.orig ? 'Cidade não encontrada. Escolha uma da lista (ex.: Campinas - SP).' : '';
    q('#rOrig').toggleAttribute('aria-invalid', !!(r.origTxt && !r.orig));
    fetchRoute(); renderStops(); drawSum(); probeTiles(); drawMap(); renderAntt(); renderUnload(); stepTabs();
    const qt = r.quote || (r.quote = {});
    if (!qt.origem && r.orig) qt.origem = (r.sender ? r.sender + ' — ' : '') + label(r.orig);
    const lastS = r.stops[r.stops.length - 1]; if (!qt.destino && lastS && lastS.city) qt.destino = r.stops.filter(s => s.city).map(s => label(s)).join(' → ');
  }
  const changed = (rerender = true) => { saveWork(); routeInfo = null; if (rerender) render(); if (typeof renderOrder === 'function') renderOrder(); };

  /* ---------- eventos ---------- */
  q('#rSender').addEventListener('input', e => { R().sender = e.target.value; saveWork(); });
  q('#rStops').addEventListener('input', e => { const k = e.target.dataset.rk; if (!k) return; const s = R().stops.find(x => x.id === e.target.closest('li').dataset.sid); if (k === 'nome') { s.nome = e.target.value; saveWork(); } });
  /* ---------- busca de cidade (lista própria, no lugar da lista do navegador) ---------- */
  const ac = document.createElement('div'); ac.id = 'acBox'; ac.className = 'acbox'; ac.setAttribute('role', 'listbox'); ac.hidden = true; document.body.appendChild(ac);
  let acIn = null, acHits = [], acI = -1;
  const hl = (txt, t) => { const k = norm(t).replace(/\s*-\s*[a-z]{0,2}$/, ''); const i = norm(txt).indexOf(k); return i < 0 || !k ? esc(txt) : esc(txt.slice(0, i)) + '<mark>' + esc(txt.slice(i, i + k.length)) + '</mark>' + esc(txt.slice(i + k.length)); };
  function acShow(inp) {
    acIn = inp; acHits = suggest(inp.value).slice(0, 8); acI = acHits.length ? 0 : -1;
    if (!acHits.length) { acHide(); if (norm(inp.value).length >= 2) { ac.innerHTML = '<div class="acempty">Nenhuma cidade encontrada</div>'; place(); ac.hidden = false; } return; }
    ac.innerHTML = acHits.map((c, i) => `<div role="option" id="ac${i}" class="acopt${i === acI ? ' on' : ''}" data-ai="${i}" aria-selected="${i === acI}"><span>${hl(c.nome, inp.value)}</span><em>${c.uf}${c.cap ? ' · capital' : ''}</em></div>`).join('');
    place(); ac.hidden = false; inp.setAttribute('aria-expanded', 'true'); inp.setAttribute('aria-controls', 'acBox'); inp.setAttribute('aria-activedescendant', 'ac' + acI);
  }
  function place() { const r = acIn.getBoundingClientRect(); const below = innerHeight - r.bottom; ac.style.left = r.left + 'px'; ac.style.width = Math.max(r.width, 220) + 'px'; if (below < 230 && r.top > below) { ac.style.top = ''; ac.style.bottom = (innerHeight - r.top + 4) + 'px'; } else { ac.style.bottom = ''; ac.style.top = (r.bottom + 4) + 'px'; } }
  function acHide() { ac.hidden = true; if (acIn) { acIn.setAttribute('aria-expanded', 'false'); acIn.removeAttribute('aria-activedescendant'); } }
  function acMove(d) { if (!acHits.length) return; acI = (acI + d + acHits.length) % acHits.length; [...ac.children].forEach((o, i) => { o.classList.toggle('on', i === acI); o.setAttribute('aria-selected', i === acI); }); acIn.setAttribute('aria-activedescendant', 'ac' + acI); ac.children[acI].scrollIntoView({ block: 'nearest' }); }
  /* grava a cidade escolhida (ou tenta reconhecer o texto digitado) */
  function commitCity(inp, c) {
    if (!c) { c = find(inp.value); if (!c) { const h = suggest(inp.value); if (h.length === 1 || (h[0] && norm(h[0].nome) === norm(inp.value).replace(/\s*-\s*[a-z]{2}$/, '') && h.filter(x => x.k === h[0].k).length === 1)) c = h[0]; } }
    const txt = inp.value; if (c) inp.value = label(c);
    if (inp.id === 'rOrig') { R().orig = c ? { nome: c.nome, uf: c.uf, lat: c.lat, lon: c.lon } : null; R().origTxt = txt; R().quote.origem = ''; }
    else { const s = R().stops.find(x => x.id === inp.closest('li').dataset.sid); if (!s) return; s.txt = txt; if (c) Object.assign(s, { city: c.nome, uf: c.uf, lat: c.lat, lon: c.lon }); else Object.assign(s, { city: '', uf: '', lat: null, lon: null }); R().quote.destino = ''; }
    setTimeout(changed, 0);
  }
  const tabEl = q('#t-rota');
  tabEl.addEventListener('input', e => { if (e.target.classList.contains('cityac')) acShow(e.target); });
  tabEl.addEventListener('focusin', e => { if (e.target.classList.contains('cityac') && e.target.value && !find(e.target.value)) acShow(e.target); });
  tabEl.addEventListener('keydown', e => {
    if (!e.target.classList.contains('cityac')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); ac.hidden ? acShow(e.target) : acMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); acMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = !ac.hidden && acHits[acI]; acHide(); commitCity(e.target, c || null); }
    else if (e.key === 'Escape' && !ac.hidden) { e.preventDefault(); e.stopPropagation(); acHide(); }
  });
  tabEl.addEventListener('focusout', e => { if (!e.target.classList.contains('cityac')) return; const inp = e.target; setTimeout(() => { if (inp.dataset.picked) { delete inp.dataset.picked; return; } acHide(); const cur = inp.id === 'rOrig' ? (R().orig ? label(R().orig) : '') : (() => { const s = R().stops.find(x => x.id === inp.closest('li').dataset.sid); return s && s.city ? label(s) : ''; })(); if (inp.value !== cur) commitCity(inp, null); }, 120); });
  ac.addEventListener('mousedown', e => { const o = e.target.closest('[data-ai]'); if (!o) return; e.preventDefault(); const c = acHits[+o.dataset.ai]; if (acIn) { acIn.dataset.picked = '1'; acHide(); commitCity(acIn, c); } });
  q('#side').addEventListener('scroll', () => { if (!ac.hidden && acIn) place(); }, true);
  window.addEventListener('resize', acHide);

  /* eixos: escolha por cartões com desenho */
  q('#rEixos').addEventListener('click', e => { if (e.target.id === 'rAxChange') { q('[data-tab=pedido]').click(); setTimeout(() => { const b = q('#bAxPick'); b ? b.focus() : q('#selVeh').focus(); }, 60); } });
  q('#rEixosHelp').onclick = e => { const p = q('#rEixosInfo'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', !p.hidden); };
  /* valores adicionais */
  q('#rXPre').addEventListener('click', e => { const b = e.target.closest('[data-xp]'); if (!b) return; extras().push({ desc: b.dataset.xp, valor: null, stop: '' }); saveWork(); renderExtras(); const r = q('#rExtras').lastElementChild; r && r.querySelector(b.dataset.xp ? '[data-xk=valor]' : '[data-xk=desc]').focus(); });
  q('#rExtras').addEventListener('input', e => { const k = e.target.dataset.xk; if (!k) return; const x = extras()[+e.target.closest('[data-xi]').dataset.xi]; x[k] = k === 'valor' ? (e.target.value === '' ? null : Math.max(0, +e.target.value)) : e.target.value; if (k === 'valor') e.target.toggleAttribute('aria-invalid', x.valor == null); saveWork(); renderTotal(); });
  q('#rExtras').addEventListener('change', e => { if (e.target.dataset.xk === 'stop') { extras()[+e.target.closest('[data-xi]').dataset.xi].stop = e.target.value; saveWork(); renderTotal(); } });
  q('#rExtras').addEventListener('click', e => { const b = e.target.closest('[data-xdel]'); if (!b) return; extras().splice(+b.dataset.xdel, 1); saveWork(); q('#rXPre button').focus(); renderExtras(); });
  q('#rTotal').addEventListener('click', e => { if (e.target.id !== 'rToQuote') return; const qt = R().quote; const add = extras().reduce((a, x) => a + (+x.valor || 0), 0); qt.fretes = [+pisoTot.toFixed(2)]; qt.outros = +add.toFixed(2); saveWork(); if (typeof renderQuote === 'function') renderQuote(); renderTotal(); toast('Piso e adicionais levados para a Cotação (frete + outros custos).'); });
  q('#rStops').addEventListener('click', e => {
    const b = e.target.closest('[data-ra]'); if (!b) return; const st = R().stops, i = st.findIndex(x => x.id === b.closest('li').dataset.sid);
    if (b.dataset.ra === 'up' && i > 0) [st[i - 1], st[i]] = [st[i], st[i - 1]];
    if (b.dataset.ra === 'down' && i < st.length - 1) [st[i + 1], st[i]] = [st[i], st[i + 1]];
    if (b.dataset.ra === 'del') { if (S.route.lines.some(l => l.stop === st[i].id) && b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirmar'; toast('Esta entrega tem carga. Clique em Confirmar para remover (a carga fica sem destino).', true); return; } st.splice(i, 1); }
    R().quote.destino = ''; changed();
    const lis = [...q('#rStops').children], ni = b.dataset.ra === 'up' ? i - 1 : b.dataset.ra === 'down' ? i + 1 : Math.min(i, lis.length - 1);
    const nb = lis[ni] && lis[ni].querySelector(`[data-ra=${b.dataset.ra === 'del' ? 'del' : b.dataset.ra}]:not([disabled])`); (nb || q('#rAdd')).focus();
    $('#live').textContent = b.dataset.ra === 'del' ? 'Entrega removida.' : 'Entrega movida para a posição ' + (ni + 1) + '.';
  });
  q('#rAdd').onclick = () => { R().stops.push({ id: uid(), nome: '', city: '', uf: '', lat: null, lon: null }); changed(); const ins = q('#rStops').querySelectorAll('[data-rk=nome]'); ins[ins.length - 1].focus(); };
  q('#rOpt').onclick = () => {
    if (!R().orig) return toast('Informe a cidade de origem primeiro.', true);
    if (R().stops.filter(s => s.lat != null).length < 2) return toast('São necessárias pelo menos 2 entregas com cidade.', true);
    const ch = optimize(); R().quote.destino = ''; changed();
    toast(ch ? 'Ordem sugerida pela menor distância. Ajuste com ↑ ↓ se precisar.' : 'A ordem atual já é a de menor distância.');
  };
  q('#rTipo').onchange = e => { R().tipo = e.target.value; saveWork(); renderAntt(); };
  /* ---------- passo a passo: 1 Rota → 2 Carga → 3 Frete → 4 Concluir ---------- */
  const STEPS = [['rota', 'Rota'], ['pedido', 'Carga'], ['frete', 'Frete'], ['fim', 'Concluir']];
  q('#t-pedido').insertAdjacentHTML('beforeend', '<div class="wiznav ronly-b"><button class="btn" data-wiz="rota">← Rota</button><button class="btn pri" data-wiz="frete">Próximo: Frete →</button></div>');
  ['calc', 'desc', 'cot', 'exp2'].forEach(t => q('#t-' + t).insertAdjacentHTML('afterbegin', '<button class="btn sm ronly-b backfim" data-wiz="fim">← Voltar ao resumo</button>'));
  function routeOk() { return R().orig && R().stops.length && R().stops.every(s => s.lat != null); }
  function goStep(t) {
    if (t === 'pedido' && !routeOk()) { toast(!R().orig ? 'Passo 1: informe a cidade de origem.' : !R().stops.length ? 'Passo 1: adicione pelo menos uma entrega.' : 'Passo 1: há entrega sem cidade válida.', true); return; }
    if ((t === 'frete' || t === 'fim') && !plan) {
      if (!S.route.lines.length) { toast('Passo 2: adicione os itens da carga.', true); q('[data-tab=pedido]').click(); return; }
      calculate(); if (!plan) return;
    }
    const b = q(`.tabs [data-tab="${t}"]`); b.click(); q('#side').scrollTop = 0;
    const h = q('#t-' + t + ' h3, #t-' + t + ' .step'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  q('#side').addEventListener('click', e => {
    const w = e.target.closest('[data-wiz]'); if (w) { goStep(w.dataset.wiz); return; }
    const g = e.target.closest('[data-goto]'); if (g) { q(`.tabs [data-tab="${g.dataset.goto}"]`).click(); q('#side').scrollTop = 0; }
  });
  function stepTabs() {
    const on = mode === 'route'; document.body.classList.toggle('route-on', on);
    document.body.classList.toggle('quick-on', mode === 'quick'); if (mode === 'quick' && q('.tabs [data-tab=cot]').classList.contains('on')) q('[data-tab=pedido]').click();
    q('[data-tab=pedido]').textContent = on ? '2 Carga' : 'Carga';
    document.querySelectorAll('.tabs .ronly').forEach(b => b.hidden = !on);
    if (!on) { if (['frete', 'fim'].some(t => q(`.tabs [data-tab="${t}"]`).classList.contains('on'))) q('[data-tab=pedido]').click(); return; }
    const done = { rota: !!routeOk(), pedido: !!plan, frete: !!plan, fim: false };
    STEPS.forEach(([t, n], i) => { const b = q(`.tabs [data-tab="${t}"]`); b.innerHTML = `<span class="wn${done[t] ? ' ok' : ''}" aria-hidden="true">${done[t] ? '✓' : i + 1}</span>${n}`; b.setAttribute('aria-label', `Passo ${i + 1}: ${n}${done[t] ? ' (concluído)' : ''}`); });
    const r = R(), ri = routeInfo, its = plan ? plan.vehs.flatMap(V => V.items) : [];
    const fs = q('#rFimSum'); if (fs) fs.innerHTML = `<div class="trow"><span>Remetente</span><b>${esc((r.sender ? r.sender + ' · ' : '') + (r.orig ? label(r.orig) : '—'))}</b></div>
      <div class="trow"><span>Entregas</span><b>${r.stops.length}${r.stops.length ? ' · última: ' + esc(label(r.stops[r.stops.length - 1])) : ''}</b></div>
      <div class="trow"><span>Distância</span><b>${ri ? fmt(ri.km, 0) + ' km' + (ri.src === 'est' ? ' (estimada)' : '') : '—'}</b></div>
      <div class="trow"><span>Veículo(s)</span><b>${plan ? plan.vehs.map(V => esc(V.v.name)).join(' + ') : esc(curVeh().name)}</b></div>
      <div class="trow"><span>Volumes</span><b>${plan ? its.length + ' · ' + fmt(its.reduce((a, b) => a + b.kg, 0), 0) + ' kg' : 'carga não montada'}</b></div>
      <div class="trow tsum"><span>Total mínimo da viagem</span><b>${brl(pisoTot + extras().reduce((a, x) => a + (+x.valor || 0), 0))}</b></div>`;
  }
  q('#t-cot').addEventListener('input', () => { if (mode === 'route') renderAntt(); });
  window.addEventListener('online', () => { if (mode === 'route') render(); });

  return {
    tagInfo(id) { const r = R(), k = rank(id), s = r.stops.find(x => x.id === id); return `<br><span class="tagroute">Remetente: ${esc((r.sender ? r.sender + ' · ' : '') + (r.orig ? label(r.orig) : '—'))}<br>Destino: ${k ? 'E' + k + ' · ' + esc((s.nome ? s.nome + ' · ' : '') + (s.city ? label(s) : 'cidade não informada')) : 'sem entrega definida'}</span>`; },
    renderAntt, rank, stopName, stopOptions, lastStop, render, renderUnload, find, optimize, est, hav, axlesOf,
    showTab(first) { q('#tabRota').hidden = false; q('#tabRota').click(); if (first && !R().orig) setTimeout(() => q('#rOrig').focus(), 60); },
    check(lines) {
      if (!R().stops.length) return 'Adicione pelo menos uma entrega (destino) na aba Rota.';
      for (const s of R().stops) if (s.lat == null && (s.txt || s.city)) { const c = find(s.txt || label(s)); if (c) Object.assign(s, { city: c.nome, uf: c.uf, lat: c.lat, lon: c.lon }); }
      if (!R().orig && R().origTxt) { const c = find(R().origTxt); if (c) R().orig = { nome: c.nome, uf: c.uf, lat: c.lat, lon: c.lon }; }
      if (!R().orig) return 'Informe a cidade de origem (remetente) na aba Rota.';
      const bad = R().stops.findIndex(s => s.lat == null); if (bad >= 0) return `Entrega ${bad + 1}: informe uma cidade válida na aba Rota.`;
      const ns = lines.find(l => rank(l.stop) == null); if (ns) return `A carga "${ns.nome}" está sem entrega definida. Abra Editar carga e escolha o destino.`;
      return null;
    },
    /* carregamento pelo inverso da entrega: última entrega primeiro (vai para a frente do baú) */
    orderLines: lines => [...lines].sort((a, b) => rank(b.stop) - rank(a.stop)),
    snapshot: () => JSON.parse(JSON.stringify({ sender: R().sender, orig: R().orig, stops: R().stops, tipo: R().tipo, eixos: R().eixos, extras: R().extras || [] }))
  };
})();
