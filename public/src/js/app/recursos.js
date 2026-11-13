/* NEXORA — recursos inspirados nos melhores sistemas de plano de carga (EasyCargo, Cargo-Planner, Goodloading):
 *  1. Compartilhar o plano de carga por link ou código (quem recebe abre o mesmo 3D, com as mesmas posições)
 *  2. Colar a lista do pedido (texto de e-mail, NF-e, planilha) e virar linhas de carga
 *  3. Passo a passo do carregamento por fileira e camada, com desenho de cada etapa (A4)
 *  4. Qual veículo leva tudo: testa a carga em toda a frota
 *  5. Observações para o carregamento (vão no relatório e no passo a passo)
 *  6. Peso vazio real por eixo (balança) no veículo
 */
const REC = (function () {
  'use strict';
  const q = s => document.querySelector(s);
  /* ---------- janela genérica ---------- */
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="mRec" role="dialog" aria-modal="true" aria-labelledby="mRecT"><div class="card" style="max-width:820px;width:100%">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 id="mRecT" style="font-family:Barlow,system-ui,sans-serif;font-size:18px;font-weight:800;margin:0"></h2><button class="btn sm" id="mRecX" aria-label="Fechar">✕</button></div>
    <div id="mRecB" style="margin-top:10px"></div></div></div>`);
  const M = q('#mRec');
  const abrir = (t, h) => { q('#mRecT').textContent = t; q('#mRecB').innerHTML = h; M.classList.add('on'); setTimeout(() => { const f = M.querySelector('textarea,input,button.pri'); f && f.focus(); }, 40); };
  const fechar = () => M.classList.remove('on');
  q('#mRecX').onclick = fechar; M.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
  M.addEventListener('click', e => { if (e.target === M) fechar(); });
  const copiar = (txt, ok) => { try { navigator.clipboard.writeText(txt).then(() => toast(ok), () => toast('Selecione o texto e copie (Ctrl+C).')); } catch (e) { toast('Selecione o texto e copie (Ctrl+C).'); } };
  const uid = () => 'r' + Math.random().toString(36).slice(2, 10);

  /* ================= 1. COMPARTILHAR ================= */
  const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = t => { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const s = atob(t); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  async function zip(str) {
    const raw = new TextEncoder().encode(str);
    if (typeof CompressionStream !== 'function') return 'J' + b64u(raw);
    const out = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return 'Z' + b64u(new Uint8Array(out));
  }
  async function unzip(code) {
    const c = String(code || '').trim().replace(/^.*[?&#]plano=/, '').replace(/[&#].*$/, '').replace(/\s/g, ''); if (c.length < 10) throw new Error('Código vazio ou incompleto.');
    const bytes = unb64u(c.slice(1));
    if (c[0] === 'J') return new TextDecoder().decode(bytes);
    if (c[0] !== 'Z' || typeof DecompressionStream !== 'function') throw new Error('Código de outra versão ou navegador muito antigo.');
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }
  async function codigoDoPlano() {
    stopAnim(true); const p = payload(), lines = curLines();
    const vehicles = [...new Map(plan.vehs.map(V => [V.v.id, V.v])).values()];
    const sp = { nx: 1, name: p.name || 'Plano de carga ' + new Date().toLocaleDateString('pt-BR'), mode: mode === 'route' ? 'route' : 'quick', lines, route: p.route, vehs: p.vehs, vehicles, quote: p.quote, left: plan.left.length, total: plan.total, obs: obsGet() };
    return zip(JSON.stringify(sp));
  }
  async function compartilhar() {
    if (!plan) return toast('Monte a carga antes: toque em “Ver como a carga fica”.', true);
    let code; try { code = await codigoDoPlano(); } catch (e) { return toast('Não foi possível gerar o código: ' + e.message, true); }
    const web = /^https?:$/.test(location.protocol) && !/claude|anthropic/i.test(location.hostname);
    const link = location.origin + location.pathname + '?plano=' + code + '#rapida';
    abrir('🔗 Compartilhar plano de carga', `<p class="mut" style="margin:0 0 8px">Quem receber abre o mesmo plano em 3D, com as mesmas posições, eixos e observações — em qualquer navegador, sem cadastro.</p>
      ${web ? `<label class="f">Link<input id="shLink" readonly value="${esc(link)}"></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px"><button class="btn pri" id="shCopyL">Copiar link</button><a class="btn" id="shWa" href="https://wa.me/?text=${encodeURIComponent('Plano de carga NEXORA: ' + link)}" target="_blank" rel="noopener">Enviar no WhatsApp</a></div>` : '<p class="warn" style="font-size:13px">Nesta prévia não dá para gerar link. Copie o código abaixo; quem receber cola em <b>Planos salvos → Abrir plano compartilhado</b>.</p>'}
      <label class="f">Código do plano (${Math.ceil(code.length / 1024)} KB)<textarea id="shCode" rows="4" readonly style="font-family:monospace;font-size:11px">${esc(code)}</textarea></label>
      <button class="btn${web ? '' : ' pri'}" id="shCopyC" style="margin-top:8px">Copiar código</button>`);
    const l = q('#shCopyL'); if (l) l.onclick = () => copiar(link, 'Link copiado.');
    q('#shCopyC').onclick = () => copiar(code, 'Código copiado.');
  }
  async function abrirCodigo(code) {
    let sp; try { sp = JSON.parse(await unzip(code)); } catch (e) { throw new Error('Código inválido: ' + e.message); }
    if (!sp || !sp.nx || !Array.isArray(sp.vehs)) throw new Error('Este código não é de um plano do NEXORA.');
    for (const v of sp.vehicles || []) { if (!fleet.some(x => x.id === v.id)) fleet.push({ ...v, name: v.name + (fleet.some(x => x.name === v.name) ? ' (compartilhado)' : '') }); }
    sp.lines = (sp.lines || []).map(l => ({ ...l, id: l.id || uid() }));
    if (sp.obs) obsSet(sp.obs, sp.mode === 'route' ? 'route' : 'quick');
    openPlan(sp); toast('Plano “' + (sp.name || 'compartilhado') + '” aberto.');
  }
  function abrirCompartilhado() {
    abrir('📥 Abrir plano compartilhado', `<label class="f">Cole o link ou o código que você recebeu<textarea id="shIn" rows="5" style="font-family:monospace;font-size:12px" placeholder="https://…?plano=Z… ou Z…"></textarea></label><p id="shErr" class="bad" role="alert"></p><button class="btn pri" id="shGo">Abrir plano</button>`);
    q('#shGo').onclick = async () => { try { await abrirCodigo(q('#shIn').value); fechar(); } catch (e) { q('#shErr').textContent = e.message; } };
  }
  /* link recebido: ?plano=... */
  setTimeout(() => { try { const c = new URLSearchParams(location.search).get('plano'); if (c) abrirCodigo(c).then(() => { try { history.replaceState(null, '', location.pathname + '#rapida'); } catch (e) {} }).catch(e => toast(e.message, true)); } catch (e) {} }, 900);

  /* ================= 2. COLAR LISTA ================= */
  const nb = s => +String(s).replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  function tipoDe(t) { t = t.toLowerCase(); return /big ?bag|bag\b|fibc/.test(t) ? 'bigbag' : /palet|pallet|pbr/.test(t) ? 'palete' : /bobina|rolo|carretel/.test(t) ? 'bobina' : /tambor|bombona|engradado|m[aá]quina/.test(t) ? 'outro' : 'caixa'; }
  /* "20 big bag 1,20 x 1,10 x 2,00 m 1250 kg" · "10 cx 40x30x25 cm 12kg cada" · "5 paletes PBR 1200x1000x1500mm 850 kg" · "SKU123;Caixa;10;0,4;0,3;0,25;12" */
  function lerLinha(raw) {
    let t = raw.replace(/\t/g, ' ; ').trim(); if (!t || /^(qtd|quant|produto|item|descri)/i.test(t)) return null;
    const out = { raw, avisos: [] };
    const dm = t.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m\b)?/i);
    let dims = null, rest = t;
    if (dm) { const u = (dm[6] || dm[4] || dm[2] || '').toLowerCase(); let d = [nb(dm[1]), nb(dm[3]), nb(dm[5])];
      const k = u === 'mm' ? 1000 : u === 'cm' ? 100 : u === 'm' ? 1 : (Math.max(...d) > 300 ? 1000 : Math.max(...d) > 12 ? 100 : 1); dims = d.map(x => +(x / k).toFixed(3)); rest = rest.replace(dm[0], ' '); }
    else { /* colunas separadas por ; com 3 medidas seguidas */ const parts = t.split(/[;|]/).map(s => s.trim()); const nums = parts.map(p => /^\d+(?:[.,]\d+)?$/.test(p) ? nb(p) : null); for (let i = 0; i + 2 < nums.length; i++) if (nums[i] != null && nums[i + 1] != null && nums[i + 2] != null && nums[i] < 30 && nums[i + 1] < 30 && nums[i + 2] < 30 && (i === 0 || nums[i - 1] != null)) { const qtt = i > 0 ? nums[i - 1] : null; dims = [nums[i], nums[i + 1], nums[i + 2]]; if (qtt) out.q = qtt; if (nums[i + 3] != null) out.kg = nums[i + 3]; rest = parts.filter((p, j) => nums[j] == null).join(' '); break; } }
    const wm = rest.match(/(\d+(?:[.,]\d+)?)\s*(kg|quilos?|t\b|ton(?:eladas?)?)\s*(cada|\/un|por unidade|total)?/i);
    if (wm) { let kg = nb(wm[1]) * (/^t/i.test(wm[2]) ? 1000 : 1); out.kgTotal = /total/i.test(wm[3] || ''); out.kg = kg; rest = rest.replace(wm[0], ' '); }
    const qm = rest.match(/^\s*(\d+(?:[.,]\d+)?)\s*(x\b|un\b|und\b|unid\w*|p[çc]s?\b|cx\b|vol\w*|fardos?|sacos?)?/i) || rest.match(/(?:qtd|quant\w*)\s*[:=]?\s*(\d+)/i);
    if (out.q == null && qm) { out.q = Math.round(nb(qm[1])); rest = rest.replace(qm[0], ' '); }
    if (out.q == null) { out.q = 1; out.avisos.push('quantidade não informada: usei 1'); }
    if (out.kg != null && out.kgTotal && out.q > 0) out.kg = +(out.kg / out.q).toFixed(3);
    out.tipo = tipoDe(t);
    out.nome = rest.replace(/[;|]/g, ' ').replace(/\b(cada|de|com|medidas?|peso|dimens\w*|unidades?)\b/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || NX.TIPOS[out.tipo].nome;
    if (!dims) out.avisos.push('faltam as medidas (C x L x A)'); else { [out.l, out.w, out.h] = dims; if (out.tipo === 'bobina') out.d = dims[0]; }
    if (out.kg == null) out.avisos.push('falta o peso');
    out.ok = !!dims && out.kg != null && out.q > 0;
    return out;
  }

  /* ---------- Paletização: montar caixas soltas sobre o palete ---------- */
  function svgCamada(r, pal) {
    const x0 = Math.min(0, ...r.rects.map(t => t.x)), y0 = Math.min(0, ...r.rects.map(t => t.y)), x1 = Math.max(pal.L, ...r.rects.map(t => t.x + t.l)), y1 = Math.max(pal.W, ...r.rects.map(t => t.y + t.w));
    const k = 260 / (x1 - x0), X = v => (v - x0) * k, Y = v => (v - y0) * k;
    return `<svg viewBox="-3 -3 ${(x1 - x0) * k + 6} ${(y1 - y0) * k + 6}" width="100%" style="max-width:280px" role="img" aria-label="Vista de cima: ${r.porCamada} caixas por camada"><rect x="${X(0)}" y="${Y(0)}" width="${pal.L * k}" height="${pal.W * k}" fill="#8a6a43" opacity=".4"/>${r.rects.map(t => `<rect x="${X(t.x)}" y="${Y(t.y)}" width="${t.l * k}" height="${t.w * k}" fill="#f39a2b" stroke="#7a4a10"/>`).join('')}</svg>`;
  }
  function svgLado(r, pal) {
    const H = 150, k = H / Math.max(r.cheio.alt, 0.01), W = r.cheio.L * k, ch = (r.cheio.alt - pal.h) / r.camadas * k;
    let c = `<rect x="0" y="${H - pal.h * k}" width="${pal.L * k}" height="${pal.h * k}" fill="#8a6a43"/>`;
    for (let i = 0; i < r.camadas; i++) c += `<rect x="${(pal.L * k - W) / 2}" y="${H - pal.h * k - (i + 1) * ch}" width="${W}" height="${ch}" fill="#f39a2b" stroke="#7a4a10"/>`;
    return `<svg viewBox="-2 -2 ${Math.max(W, pal.L * k) + 4} ${H + 4}" height="${H}" role="img" aria-label="Vista de lado: ${r.camadas} camadas, ${fmt(r.cheio.alt, 2)} m de altura">${c}</svg>`;
  }
  function paletizar() {
    const m = QM(), cx = (S[m].lines || []).filter(l => l.tipo === 'caixa' || l.tipo === 'outro');
    const P = window.NX_PAL, op = Object.entries(P.PALETES).map(([k, v]) => `<option value="${k}">${esc(v.nome)}</option>`).join('');
    abrir('🧱 Paletizar caixas soltas', `<p class="mut" style="margin:0 0 8px">Calcula quantas caixas cabem por camada e por palete, respeitando altura, peso do palete e quanto a caixa aguenta em cima. Depois troca as caixas soltas por paletes na carga.</p>
      <div class="taragrid"><label class="f">Palete<select id="pzPal">${op}</select></label><label class="f">Altura total máx. (m)<input id="pzAlt" inputmode="decimal" value="1.60"></label><label class="f">Sobra na borda (cm)<input id="pzSob" inputmode="decimal" value="0"></label></div>
      ${cx.length ? '' : `<p class="mut">Não há caixas na carga. Informe uma abaixo:</p>`}
      <div class="taragrid" id="pzNova" ${cx.length ? 'hidden' : ''}><label class="f">C (m)<input id="pzL" inputmode="decimal" value="0.40"></label><label class="f">L (m)<input id="pzW" inputmode="decimal" value="0.30"></label><label class="f">A (m)<input id="pzH" inputmode="decimal" value="0.25"></label><label class="f">Peso un. (kg)<input id="pzKg" inputmode="decimal" value="10"></label><label class="f">Quantidade<input id="pzQ" inputmode="numeric" value="100"></label></div>
      ${cx.length ? `<button type="button" class="btn sm" id="pzAddN">＋ Calcular outra caixa</button>` : ''}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0;font-size:13px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pzDeit"> Pode deitar a caixa</label><label style="display:flex;gap:6px;align-items:center">Aguenta <input id="pzEmp" inputmode="numeric" value="0" style="width:56px" aria-label="Quantas caixas aguenta em cima (0 = sem limite)"> caixas em cima (0 = sem limite)</label></div>
      <div id="pzOut" aria-live="polite"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" id="pzOk" disabled>Trocar caixas pelos paletes</button><label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="pzMant"> Manter as caixas soltas também</label></div>`);
    const num = id => +String(q(id).value).replace(',', '.') || 0;
    let res = [];
    const calc = () => {
      const pal = P.PALETES[q('#pzPal').value], o = { altMax: num('#pzAlt'), sobra: num('#pzSob') / 100 }, ex = { deita: q('#pzDeit').checked, empilha: Math.round(num('#pzEmp')) };
      const fontes = !q('#pzNova').hidden ? [{ id: null, nome: 'Caixa informada', l: num('#pzL'), w: num('#pzW'), h: num('#pzH'), kg: num('#pzKg'), q: Math.round(num('#pzQ')) }] : cx.map(l => ({ id: l.id, nome: l.nome || 'Caixa', l: l.l, w: l.w, h: l.h, kg: l.kgp != null ? l.kgp : l.kg, q: l.q * (l.pcs || 1), cor: l.cor }));
      res = fontes.map(f => ({ f, pal, r: P.paletizar({ ...f, ...ex }, pal, o) }));
      q('#pzOut').innerHTML = res.map(({ f, r }) => r.erro ? `<div class="card" style="padding:10px;margin-top:8px"><b>${esc(f.nome)}</b> — ⚠ ${esc(r.erro)}</div>` : `<div class="card" style="padding:10px;margin-top:8px"><b>${esc(f.nome)}</b> · ${f.q} caixas de ${[f.l, f.w, f.h].map(v => fmt(v, 2)).join(' × ')} m, ${fmt(f.kg, 1)} kg
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-top:6px"><div>${svgCamada(r, pal)}<div class="mut" style="font-size:12px">Vista de cima · ${esc(r.padrao)}</div></div><div>${svgLado(r, pal)}<div class="mut" style="font-size:12px">Vista de lado</div></div></div>
        <div class="tbl-wrap"><table class="tbl"><tbody><tr><th>Caixas por camada</th><td>${r.porCamada}</td></tr><tr><th>Camadas</th><td>${r.camadas}</td></tr><tr><th>Caixas por palete</th><td><b>${r.porPal}</b> (limite: ${esc(r.limite)})</td></tr><tr><th>Paletes</th><td><b>${r.paletes}</b> = ${r.cheios} cheio(s)${r.resto ? ` + 1 com ${r.resto} caixas` : ''}</td></tr><tr><th>Palete cheio</th><td>${fmt(r.cheio.L, 2)} × ${fmt(r.cheio.W, 2)} × ${fmt(r.cheio.alt, 2)} m · ${fmt(r.cheio.kg, 0)} kg</td></tr><tr><th>Aproveitamento da base</th><td>${fmt(r.aprov * 100, 0)}%</td></tr></tbody></table></div></div>`).join('');
      q('#pzOk').disabled = !res.some(x => !x.r.erro);
    };
    q('#mRecB').addEventListener('input', calc); q('#mRecB').addEventListener('change', calc);
    const bN = q('#pzAddN'); if (bN) bN.onclick = () => { q('#pzNova').hidden = !q('#pzNova').hidden; bN.textContent = q('#pzNova').hidden ? '＋ Calcular outra caixa' : '↩ Voltar às caixas da carga'; calc(); };
    calc();
    q('#pzOk').onclick = () => {
      const ok = res.filter(x => !x.r.erro); if (!ok.length) return;
      if (mode === 'cat') go('rapida');
      const mm = QM(), novas = [];
      ok.forEach(({ f, pal, r }) => [[r.cheio, r.cheios, ''], [r.parcial, r.parcial ? 1 : 0, ' (incompleto)']].forEach(([p, n, suf]) => {
        if (!p || !n) return;
        novas.push({ id: uid(), cod: '', nome: `${f.nome} · ${p.caixas} cx/${pal.nome}${suf}`, tipo: 'palete', l: p.L, w: p.W, h: p.alt, d: null, q: n, pcs: 1, kgp: p.kg, kg: p.kg, pos: 'pe', stack: 0, maxLevels: null, cor: f.cor || '#f39a2b' });
      }));
      const tira = new Set(q('#pzMant').checked ? [] : ok.map(x => x.f.id).filter(Boolean));
      S[mm].lines = S[mm].lines.filter(l => !tira.has(l.id)).concat(novas); saveWork(); fechar(); renderOrder(); calculate();
      toast(`${novas.reduce((a, b) => a + b.q, 0)} palete(s) adicionados à carga.`);
    };
  }
  function colarLista() {
    abrir('📋 Colar lista do pedido', `<p class="mut" style="margin:0 0 6px">Cole a lista do e-mail, da NF-e ou da planilha — uma linha por produto, com <b>quantidade</b>, <b>medidas (C x L x A)</b> e <b>peso</b>. Aceita m, cm ou mm e kg ou t.</p>
      <label class="f">Lista<textarea id="plIn" rows="7" placeholder="20 big bag 1,20 x 1,10 x 2,00 m 1250 kg&#10;10 cx 40x30x25 cm 12 kg cada&#10;5 paletes PBR 1200x1000x1500 mm 850 kg"></textarea></label>
      <div id="plOut" style="margin-top:10px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" id="plAdd" disabled>Adicionar à carga</button><label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="plRep"> Substituir a carga atual</label></div>`);
    let lidos = [];
    const ver = () => { lidos = q('#plIn').value.split(/\r?\n/).map(lerLinha).filter(Boolean); const ok = lidos.filter(x => x.ok);
      q('#plOut').innerHTML = lidos.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>C × L × A (m)</th><th>Peso un.</th></tr></thead><tbody>${lidos.map(x => `<tr class="${x.ok ? '' : 'bad'}"><td>${x.ok ? '✔' : '⚠'}</td><td>${esc(x.nome)}${x.avisos.length ? `<br><small>${esc(x.avisos.join('; '))}</small>` : ''}</td><td>${esc(NX.TIPOS[x.tipo].nome)}</td><td>${x.q}</td><td>${x.l != null ? [x.l, x.w, x.h].map(v => fmt(v, 2)).join(' × ') : '—'}</td><td>${x.kg != null ? fmt(x.kg, 1) + ' kg' : '—'}</td></tr>`).join('')}</tbody></table></div><p class="mut" style="font-size:12px">${ok.length} de ${lidos.length} linha(s) prontas. As com ⚠ ficam de fora — corrija o texto e veja de novo.</p>` : '';
      q('#plAdd').disabled = !ok.length; };
    q('#plIn').addEventListener('input', ver);
    q('#plAdd').onclick = () => {
      const ok = lidos.filter(x => x.ok); if (!ok.length) return;
      if (mode === 'cat') { go('rapida'); }
      const m = QM(), L = ok.map(x => ({ id: uid(), cod: '', nome: x.nome, tipo: x.tipo, l: x.l, w: x.w, h: x.h, d: x.d, q: x.q, pcs: 1, kgp: x.kg, kg: x.kg, pos: NX.POS[x.tipo][0][0], stack: 0, maxLevels: null, cor: ['#f39a2b', '#2f8cf2', '#32c48d', '#e5484d', '#a78bfa', '#14b8a6'][Math.floor(Math.random() * 6)] }));
      S[m].lines = q('#plRep').checked ? L : S[m].lines.concat(L); saveWork(); fechar(); renderOrder(); calculate(); toast(`${L.length} produto(s) adicionados da lista.`);
    };
  }

  /* ================= 3. PASSO A PASSO ================= */
  function svgEtapa(V, g, rowsAte, atual) {
    const v = V.v, W = 300, s = W / v.L, H = Math.max(40, v.W * s), its = V.items.filter(i => i.wg === g);
    const cor = it => rowsAte.has(it.x.toFixed(3)) ? (it.x.toFixed(3) === atual ? '#f39a2b' : '#9fb3d9') : 'none';
    const top = `<svg viewBox="-14 -4 ${W + 18} ${H + 8}" width="100%" style="max-width:340px"><rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="#333"/><rect x="-12" y="${H / 2 - 10}" width="10" height="20" fill="#333"/>${its.map(it => cor(it) === 'none' ? '' : `<rect x="${it.x * s}" y="${it.y * s}" width="${it.l * s}" height="${it.w * s}" fill="${cor(it)}" stroke="#222" stroke-width=".6"/>`).join('')}</svg>`;
    const Hh = Math.max(40, (v.H || 2.7) * s * 0.8);
    const side = `<svg viewBox="-14 -4 ${W + 18} ${Hh + 8}" width="100%" style="max-width:340px"><rect x="0" y="0" width="${W}" height="${Hh}" fill="#fff" stroke="#333"/><rect x="-12" y="${Hh - 22}" width="10" height="22" fill="#333"/>${its.filter(i => cor(i) !== 'none').map(it => `<rect x="${it.x * s}" y="${Hh - (it.z + it.h) * s * 0.8}" width="${it.l * s}" height="${it.h * s * 0.8}" fill="${cor(it)}" stroke="#222" stroke-width=".6"/>`).join('')}</svg>`;
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div><small>Vista de cima</small>${top}</div><div><small>Vista de lado</small>${side}</div></div>`;
  }
  function passoAPassoHTML() {
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;background:#0a1122;padding:8px;border-radius:6px"><img src="${LOGO()}" style="height:36px"><span style="color:#fff">Passo a passo do carregamento · ${new Date().toLocaleString('pt-BR')}</span></div>`;
    const obs = obsGet(); if (obs) h += `<div style="border:2px solid #f39a2b;border-radius:6px;padding:8px;margin:8px 0"><b>Observações para o carregamento</b><br>${esc(obs).replace(/\n/g, '<br>')}</div>`;
    plan.vehs.forEach((V, vi) => {
      const st = NX.stats(V.v, V.items);
      h += `<h2 style="margin:14px 0 4px">Veículo ${vi + 1}: ${esc(V.v.name)}</h2><p style="margin:0 0 6px">${V.items.length} volumes · ${fmt(st.kg, 0)} kg · PBT ${fmt(st.pbt / 1000, 1)} de ${fmt(st.pbtLim / 1000, 1)} t · carregue da cabine para as portas.</p>`;
      for (let g = 0; g < V.v.wag; g++) {
        const its = V.items.filter(i => i.wg === g); if (!its.length) continue; if (V.v.wag > 1) h += `<h3>Compartimento ${g + 1}</h3>`;
        const xs = [...new Set(its.map(i => i.x.toFixed(3)))].sort((a, b) => a - b), feitos = new Set();
        xs.forEach((xk, ri) => { feitos.add(xk); const row = its.filter(i => i.x.toFixed(3) === xk).sort((a, b) => a.z - b.z || a.y - b.y); const cam = [...new Set(row.map(i => i.z.toFixed(2)))];
          h += `<div style="page-break-inside:avoid;border:1px solid #ccc;border-radius:6px;padding:8px;margin:8px 0"><b>Passo ${ri + 1} — Fileira ${ri + 1}</b> <span style="color:#555">(${fmt(+xk, 2)} a ${fmt(+xk + row[0].l, 2)} m da cabine · ${row.length} volume(s) · ${cam.length} camada(s))</span>
            <ol style="margin:6px 0">${cam.map((z, ci) => `<li>${cam.length > 1 ? `Camada ${ci + 1} (${+z ? 'em cima, a ' + fmt(+z, 2) + ' m' : 'no piso'}): ` : ''}${row.filter(i => i.z.toFixed(2) === z).map(i => `<b>${String(i.n).padStart(2, '0')}</b> ${esc(i.nome)}`).join(', ')}</li>`).join('')}</ol>${svgEtapa(V, g, feitos, xk)}</div>`; });
      }
      if (typeof SEC === 'object' && SEC.analyze) { const a = SEC.analyze(V); if (a.length) h += `<h3>Amarração e calços</h3><ul>${a.map(x => `<li>${esc(x.txt)}</li>`).join('')}</ul>`; }
      const al = st.al.filter(a => a.tot > a.lim + 1), B = NX.balanca(st); if (al.length) h += `<p style="color:${B.retido ? '#b91c1c' : '#92400e'}"><b>${B.retido ? 'Atenção: passa da tolerância da balança' : 'Eixo acima do limite legal'}:</b> ${al.map(a => `${esc(a.n.replace(/\s*\(.*\)/, ''))} ${fmt(a.tot / 1000, 2)} de ${fmt(a.lim / 1000, 1)} t`).join('; ')}.${!B.retido && B.soPbt ? ' Na balança, veículo de até 50 t é conferido só pelo PBT, mas planeje dentro do limite de cada eixo.' : ''}</p>`;
    });
    return h + `<p style="font-size:11px;color:#666;margin-top:12px">Gerado pelo NEXORA. Laranja = fileira deste passo; azul = já carregado. Confira peso e amarração antes de sair.</p>`;
  }
  function passoAPasso() { if (!plan) return toast('Monte a carga antes: toque em “Ver como a carga fica”.', true); stopAnim(true); showPrint(passoAPassoHTML()); }

  /* ================= 4. QUAL VEÍCULO LEVA TUDO ================= */
  function qualVeiculo() {
    const lines0 = curLines(); if (!lines0.length) return toast('Inclua a carga primeiro.', true);
    const lines = mode === 'route' && RT.orderLines ? RT.orderLines(lines0) : lines0; const tot = lines.reduce((s, l) => s + (+l.q || 0), 0);
    const kgTot = lines.reduce((s, l) => s + (+l.q || 0) * (+l.kg || 0), 0);
    const cont = curVeh().cat === 'Container';
    const res = fleet.filter(v => (v.cat === 'Container') === cont).map(v => { let r; try { r = NX.planLoad(fleet, v.id, lines, { extras: false }); } catch (e) { return null; } const V = r.vehs[0]; if (!V) return null; const st = NX.stats(V.v, V.items);
      return { v, ok: !r.left.length, n: V.items.length, occ: st.occ, util: NX.vehMaxCargo(v), pbt: NX.balanca ? NX.balanca(st).multa === 0 : true, d: NX.axDisp(NX.axcfgOf(v)) }; }).filter(Boolean)
      .sort((a, b) => (b.ok - a.ok) || (a.ok ? a.util - b.util : b.n - a.n));
    abrir('🚚 Qual veículo leva tudo?', `<p class="mut" style="margin:0 0 8px">Testei a carga (${tot} volumes, ${fmt(kgTot / 1000, 2)} t) em cada ${cont ? 'container' : 'veículo'} da frota, sem veículo extra. O primeiro que leva tudo é o menor que serve.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Veículo</th><th>Leva</th><th>Ocupação</th><th>Carga útil</th><th></th></tr></thead><tbody>${res.map((x, i) => `<tr class="${x.ok ? '' : 'mut'}"><td><b>${esc(x.v.name)}</b>${i === 0 && x.ok ? ' <b class="ok">← menor que serve</b>' : ''}<br><span class="disp ${x.d.k}">${x.d.txt}</span>${x.ok && !x.pbt ? ' <small class="bad">passa do peso</small>' : ''}</td><td class="${x.ok ? 'ok' : 'bad'}">${x.ok ? 'tudo' : x.n + ' de ' + tot}</td><td>${fmt(x.occ * 100, 0)}%</td><td>${fmt(x.util / 1000, 1)} t</td><td><button class="btn sm" data-usev="${x.v.id}">Usar</button></td></tr>`).join('')}</tbody></table></div>`);
    q('#mRecB').addEventListener('click', e => { const b = e.target.closest('[data-usev]'); if (!b) return; S[mode].veh = b.dataset.usev; saveWork(); fechar(); renderVehSel(); calculate(); toast('Veículo trocado.'); });
  }

  /* ================= 5. OBSERVAÇÕES ================= */
  const obsKey = m => 'obs_' + (m || mode);
  function obsGet(m) { return LS.get(obsKey(m), '') || ''; }
  function obsSet(t, m) { LS.set(obsKey(m), String(t || '').slice(0, 1000)); const el = q('#recObs'); if (el && (!m || m === mode)) el.value = obsGet(); }

  /* ================= 6. PESO VAZIO REAL POR EIXO ================= */
  function taraHTML(v) {
    const m = NX.axleModel(v); if (!['Truck', 'Carreta', 'Rodotrem', 'Container'].includes(v.cat)) return '';
    const real = Array.isArray(v.taras) && v.taras.some(x => x > 0);
    return `<details class="tarabox"${real ? ' open' : ''}><summary>⚖ Peso vazio real por eixo ${real ? '<b class="ok">(usando o da balança)</b>' : '<span class="mut">(hoje: estimativa média)</span>'}</summary>
      <p class="mut" style="font-size:12px;margin:6px 0">Pese o veículo vazio por eixo (balança ou ticket de pesagem) e digite aqui. Deixe em branco para usar a estimativa.</p>
      <div class="taragrid">${m.ax.map((a, i) => `<label class="f">${esc(a.n.replace(/\s*\(.*\)/, ''))} <small class="mut">estim. ${fmt(a.tare, 0)} kg</small><input type="number" step="1" min="0" data-tara="${i}" value="${real && v.taras[i] > 0 ? v.taras[i] : ''}" aria-label="Peso vazio real, ${esc(a.n)}, em kg"></label>`).join('')}</div>
      <button type="button" class="btn sm" id="taraSave">Salvar peso vazio</button> ${real ? '<button type="button" class="btn sm" id="taraClr">Voltar à estimativa</button>' : ''}</details>`;
  }
  async function taraSalvar(lista) {
    const v = curVeh(); v.taras = lista && lista.some(x => x > 0) ? lista : undefined;
    try { fleet = await DB.saveVehicles(fleet); } catch (er) { return toast(er.message, true); }
    renderAxCard(); if (plan) calculate(); toast(v.taras ? 'Peso vazio real salvo: eixos e carga útil recalculados.' : 'Voltou à estimativa de peso vazio.');
  }
  document.addEventListener('click', e => {
    if (e.target.id === 'taraSave') { const l = [...document.querySelectorAll('[data-tara]')].map(i => +i.value || 0); taraSalvar(l); }
    if (e.target.id === 'taraClr') taraSalvar(null);
  });

  /* ---------- botões nas telas ---------- */
  function montarBotoes() {
    const sv = q('#bSavePlan'); if (sv && !q('#bShare')) {
      sv.insertAdjacentHTML('afterend', `<button class="btn" id="bShare" style="width:100%;margin-top:8px">🔗 Compartilhar plano (link ou código)</button>
        <label class="f" style="margin-top:10px">Observações para o carregamento <small class="mut">(saem no relatório e no passo a passo)</small><textarea id="recObs" rows="3" maxlength="1000" placeholder="Ex.: chapa na descarga; cliente só recebe até 16 h; usar 6 cintas"></textarea></label>`);
      q('#recObs').value = obsGet(); q('#recObs').addEventListener('input', e => obsSet(e.target.value, mode));
      q('#bShare').onclick = compartilhar;
    }
    const pr = q('#bPrint'); if (pr && !q('#bSteps')) { pr.insertAdjacentHTML('beforebegin', `<button class="btn pri" id="bSteps" style="width:100%;margin-bottom:8px">🪜 Passo a passo do carregamento (A4)</button>`); q('#bSteps').onclick = passoAPasso; }
    const calc = q('#bCalc'); if (calc && !q('#bPaste')) { calc.insertAdjacentHTML('beforebegin', `<div class="recrow"><button type="button" class="btn sm" id="bPaste">📋 Colar lista do pedido</button><button type="button" class="btn sm" id="bWhich">🚚 Qual veículo leva tudo?</button><button type="button" class="btn sm" id="bPal">🧱 Paletizar caixas soltas</button></div>`); q('#bPal').onclick = paletizar; q('#bPaste').onclick = colarLista; q('#bWhich').onclick = qualVeiculo; }
    const mg = q('#mgNote'); if (mg && !q('#bOpenShared')) { mg.insertAdjacentHTML('afterend', '<button class="btn" id="bOpenShared" style="margin:6px 0 10px">📥 Abrir plano compartilhado</button>'); q('#bOpenShared').onclick = abrirCompartilhado; }
  }
  montarBotoes();
  /* observações seguem o modo (rápida / catálogo / rota) */
  document.addEventListener('click', e => { if (e.target.closest('[data-go]')) setTimeout(() => { const el = q('#recObs'); if (el) el.value = obsGet(); }, 60); });
  /* observações também no relatório A4 */
  if (typeof reportHTML === 'function') { const base = reportHTML; window.reportHTML = reportHTML = function () { const o = obsGet(); return base() + (o ? `<h3>Observações para o carregamento</h3><p>${esc(o).replace(/\n/g, '<br>')}</p>` : ''); }; }
  setTimeout(() => { try { renderAxCard(); } catch (e) {} }, 0);
  return { compartilhar, abrirCodigo, abrirCompartilhado, colarLista, lerLinha, passoAPasso, qualVeiculo, taraHTML };
})();
