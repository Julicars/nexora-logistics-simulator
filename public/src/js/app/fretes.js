/* NEXORA — Registros em planilha web (empregador e transportador).
 * Com o servidor (npm start): data/fretes.json e data/transportes.json, compartilhados.
 * Sem servidor: salvo neste navegador. Células editáveis, busca, totais, exportação Excel/CSV/JSON.
 */
const DOCS = (function () {
  /* NF-e / CT-e: chave de 44 dígitos com dígito verificador (módulo 11) e modelo (55 NF-e, 57 CT-e) */
  function chave(s, modelo) {
    const d = String(s || '').replace(/\D/g, ''); if (d.length !== 44) return null;
    let soma = 0, p = 2; for (let i = 42; i >= 0; i--) { soma += +d[i] * p; p = p === 9 ? 2 : p + 1; }
    const r = soma % 11, dv = r < 2 ? 0 : 11 - r, mod = d.slice(20, 22);
    return { ok: dv === +d[43], modelo: mod, numero: String(+d.slice(25, 34)), certo: !modelo || mod === modelo };
  }
  function checkDoc(v, modelo, nome) {
    for (const part of String(v || '').split(/[,;\s]+/).filter(Boolean)) {
      const d = part.replace(/\D/g, '');
      if (d.length === 44) { const c = chave(d, modelo); if (!c.ok) return `${nome}: a chave ${d.slice(0, 6)}… tem o dígito verificador errado.`; if (!c.certo) return `${nome}: a chave ${d.slice(0, 6)}… é do modelo ${c.modelo}, não de ${nome} (${modelo}).`; }
      else if (!/^\d{1,9}$/.test(d)) return `${nome}: "${part}" não é um número nem uma chave de 44 dígitos.`;
    }
    return '';
  }
  const show = v => String(v || '').split(/[,;\s]+/).filter(Boolean).map(p => { const d = p.replace(/\D/g, ''); return d.length === 44 ? 'nº ' + String(+d.slice(25, 34)) : p; }).join(', ');
  return { chave, checkDoc, show };
})();

function createRegistry(cfg) {
  'use strict';
  const q = s => document.querySelector('#' + cfg.p + s);
  let list = [], remote = null;
  async function api(path, opt = {}) { const r = await fetch('/api/' + cfg.key + path, { ...opt, headers: { 'Content-Type': 'application/json' } }); const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.erro || 'Erro ' + r.status); return b; }
  async function load() {
    if (remote !== false) { try { list = (await api('')).fretes; remote = true; } catch (e) { remote = false; } }
    if (remote === false) list = LS.get(cfg.key, []);
    const m = q('Mode'); m.hidden = remote; m.textContent = 'Modo local: sem o servidor NEXORA, o registro fica só neste navegador. Baixe em JSON ou Excel para guardar.';
  }
  const uid = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  const saveLocal = () => { if (!LS.set(cfg.key, list)) toast('Sem espaço no navegador: exporte e apague registros antigos.', true); };
  async function create(f) { if (remote) { const r = await api('', { method: 'POST', body: JSON.stringify(f) }); list.unshift(r); return r; } const r = { ...f, id: uid(), criado: new Date().toISOString() }; list.unshift(r); saveLocal(); return r; }
  async function update(f) { if (remote) { const r = await api('/' + f.id, { method: 'PUT', body: JSON.stringify(f) }); list[list.findIndex(x => x.id === f.id)] = r; return r; } f.alterado = new Date().toISOString(); saveLocal(); return f; }
  async function remove(id) { if (remote) await api('/' + id, { method: 'DELETE' }); list = list.filter(x => x.id !== id); if (!remote) saveLocal(); }

  const COLS = cfg.cols, num = c => c.tipo === 'moeda' || c.tipo === 'numero' || c.tipo === 'pct';
  const val = (c, f) => c.calc ? c.calc(f) : f[c.k];
  const fmtCell = (c, v) => v === undefined || v === null || v === '' || (typeof v === 'number' && !isFinite(v)) ? '' : c.tipo === 'moeda' ? brl(v) : c.tipo === 'pct' ? fmt(v, 2) + '%' : c.tipo === 'data' ? new Date(String(v).length === 10 ? v + 'T12:00' : v).toLocaleDateString('pt-BR') : c.tipo === 'numero' ? fmt(v, c.dec || 0) : c.doc ? DOCS.show(v) : String(v);
  const filtered = () => { const s = String(q('Search').value || '').toLowerCase().trim(); return !s ? list : list.filter(f => JSON.stringify({ ...f, foto: '' }).toLowerCase().includes(s)); };
  function render() {
    const T = q('Tbl');
    T.querySelector('thead').innerHTML = `<tr>${COLS.map(c => `<th scope="col" class="${num(c) ? 'rn' : ''}">${c.t}</th>`).join('')}<th><span class="sr">Ações</span></th></tr>`;
    const rows = filtered();
    T.querySelector('tbody').innerHTML = rows.map(f => `<tr data-id="${f.id}">${COLS.map(c => {
      const v = val(c, f);
      if (c.k === 'foto') return `<td>${f.foto ? `<button class="rgfoto" data-foto="${f.id}" aria-label="Ver foto do caminhão carregado"><img src="${f.foto}" alt=""></button>` : '<span class="mut">—</span>'}</td>`;
      const st = c.status ? c.status(f) : '';
      return `<td class="${[num(c) ? 'rn' : '', c.ed ? 'ed' : 'calc', st].join(' ')}" ${c.ed ? `tabindex="0" data-k="${c.k}" aria-label="${c.t}: ${esc(fmtCell(c, v)) || 'vazio'}. Enter para editar"` : ''}>${esc(fmtCell(c, v))}</td>`; }).join('')}<td><button class="btn sm" data-rgdel="${f.id}" aria-label="Excluir registro">×</button></td></tr>`).join('')
      || `<tr><td colspan="${COLS.length + 1}" class="mut">${T.dataset.vazio}</td></tr>`;
    T.querySelector('tfoot').innerHTML = rows.length ? `<tr>${COLS.map((c, i) => `<td class="${num(c) ? 'rn' : ''}">${i === 0 ? '<b>Total</b>' : c.soma ? '<b>' + fmtCell(c, rows.reduce((s, f) => s + (+val(c, f) || 0), 0)) + '</b>' : c.media ? '<b>' + fmtCell(c, cfg.media(rows)) + '</b>' : ''}</td>`).join('')}<td></td></tr>` : '';
    q('Sum').textContent = `${rows.length} registro(s)` + (cfg.resumo ? cfg.resumo(rows) : '');
  }
  function edit(td) {
    if (td.querySelector('input')) return; const id = td.parentElement.dataset.id, f = list.find(x => x.id === id), c = COLS.find(x => x.k === td.dataset.k); if (!f || !c) return;
    const inp = document.createElement('input'); inp.type = c.ed; if (c.ed === 'number') { inp.step = c.tipo === 'moeda' ? '0.01' : c.dec ? String(10 ** -c.dec) : 'any'; if (c.tipo === 'moeda') inp.dataset.money = ''; } inp.value = f[c.k] ?? ''; inp.setAttribute('aria-label', c.t); td.textContent = ''; td.appendChild(inp); inp.focus(); if (c.ed !== 'date') inp.select();
    let done = false;
    const finish = async ok => {
      if (done) return; done = true;
      if (ok) {
        let v = inp.value.trim(); if (c.ed === 'number') v = v === '' ? null : +v;
        if (c.doc && v) { const er = DOCS.checkDoc(v, c.doc, c.t); if (er) { toast(er, true); done = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; } }
        if (String(f[c.k] ?? '') !== String(v ?? '')) { f[c.k] = v; if (cfg.recalc) cfg.recalc(f); try { await update(f); toast('Registro atualizado.'); } catch (e) { toast(e.message, true); } }
      }
      render(); const n = q('Tbl').querySelector(`tr[data-id="${id}"] td[data-k="${c.k}"]`); n && n.focus();
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } });
    inp.addEventListener('blur', () => finish(true));
  }
  const T = q('Tbl');
  T.addEventListener('dblclick', e => { const td = e.target.closest('td.ed'); td && edit(td); });
  T.addEventListener('click', async e => {
    const ph = e.target.closest('[data-foto]'); if (ph) { const f = list.find(x => x.id === ph.dataset.foto); showPrint(`<div style="font-family:system-ui;color:#000"><h3>Caminhão carregado — ${esc(f.transportadora || f.cliente || '')} · ${esc(f.data || '')}</h3><img src="${f.foto}" style="width:100%;border:1px solid #999" alt="Foto do caminhão carregado"></div>`); return; }
    const td = e.target.closest('td.ed'); if (td && window.matchMedia('(pointer:coarse)').matches) return edit(td);
    const b = e.target.closest('[data-rgdel]'); if (!b) return;
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Excluir?'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = '×'; } }, 3500); return; }
    try { await remove(b.dataset.rgdel); toast('Registro excluído.'); render(); } catch (er) { toast(er.message, true); }
  });
  T.addEventListener('keydown', e => {
    const td = e.target.closest('td.ed'); if (!td || e.target !== td) return;
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); edit(td); return; }
    const mv = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key]; if (!mv) return; e.preventDefault();
    const tr = td.parentElement, cells = [...tr.querySelectorAll('td.ed')], i = cells.indexOf(td);
    if (mv[1]) { const n = cells[i + mv[1]]; n && n.focus(); } else { const r = mv[0] > 0 ? tr.nextElementSibling : tr.previousElementSibling; const n = r && r.querySelector(`td[data-k="${td.dataset.k}"]`); n && n.focus(); }
  });
  q('Search').addEventListener('input', render);
  const wrap = T.closest('.tbl-wrap'); T.closest('section').querySelectorAll('[data-rgscroll]').forEach(b => b.onclick = () => wrap.scrollBy({ left: +b.dataset.rgscroll * Math.max(300, wrap.clientWidth * 0.7), behavior: 'smooth' }));
  const upd = () => T.closest('section').querySelectorAll('[data-rgscroll]').forEach(b => b.disabled = +b.dataset.rgscroll < 0 ? wrap.scrollLeft < 2 : wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 2); wrap.addEventListener('scroll', upd); new ResizeObserver(upd).observe(wrap);
  q('Add').onclick = async () => { await create({ data: new Date().toISOString().slice(0, 10), origemDado: 'manual', adicionais: [] }); render(); const n = T.querySelector('tbody tr td.ed'); n && edit(n); };
  const XC = COLS.filter(c => c.k !== 'foto');
  const rowsOut = () => filtered().map(f => XC.map(c => { const v = val(c, f); return c.doc ? DOCS.show(v) : c.tipo === 'pct' ? (isFinite(v) ? +(+v).toFixed(2) : null) : c.tipo === 'moeda' && v != null && v !== '' ? +(+v).toFixed(2) : v; }));
  const stamp = () => new Date().toISOString().slice(0, 10);
  function dl(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600); }
  q('Xlsx').onclick = () => { if (!list.length) return toast('Nada para exportar.', true); NXLSX.download(`${cfg.key}-nexora-${stamp()}.xlsx`, cfg.aba, XC.map(c => ({ titulo: c.tipo === 'pct' ? c.t + ' (%)' : c.t, largura: c.w, tipo: c.tipo === 'pct' ? 'numero' : c.tipo })), rowsOut()); };
  q('Csv').onclick = () => { if (!list.length) return toast('Nada para exportar.', true); const s = v => { v = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    dl(`${cfg.key}-nexora-${stamp()}.csv`, '﻿' + [XC.map(c => c.t).join(';'), ...rowsOut().map(r => r.map(s).join(';'))].join('\n'), 'text/csv;charset=utf-8'); };
  q('Json').onclick = () => dl(`${cfg.key}-nexora-${stamp()}.json`, JSON.stringify({ app: 'NEXORA', tipo: cfg.key, criado: new Date().toISOString(), fretes: list }, null, 1), 'application/json');
  q('JsonInLbl').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('JsonIn').click(); } });
  q('JsonIn').onchange = async e => {
    const file = e.target.files[0]; if (!file) return; e.target.value = '';
    try { const j = JSON.parse(await file.text()); const arr = Array.isArray(j) ? j : j.fretes; if (!Array.isArray(arr)) throw new Error('Arquivo sem a lista "fretes".');
      const have = new Set(list.map(f => f.id)); let n = 0; for (const f of arr) { if (f && typeof f === 'object' && !have.has(f.id)) { const { id, criado, ...rest } = f; await create(rest); n++; } }
      toast(`${n} registro(s) importado(s).`); render(); } catch (er) { toast('Não foi possível importar: ' + er.message, true); }
  };
  return { open: async () => { await load(); render(); }, create, load, checkDoc: DOCS.checkDoc, chave: DOCS.chave };
}

/* ---------- cálculos ---------- */
const pctNf = (frete, nf) => +nf > 0 && +frete >= 0 ? (+frete / +nf) * 100 : NaN;
function empTotals(f) {
  const ad = f.adicionais || [], inc = ad.filter(a => a.quando === 'incluso').reduce((s, a) => s + (+a.valor || 0), 0), dep = ad.filter(a => a.quando !== 'incluso').reduce((s, a) => s + (+a.valor || 0), 0);
  const total = (+f.valor || 0) + dep, sit = !(f.piso > 0) ? 'sem piso' : (+f.valor || 0) + 0.005 >= f.piso ? 'acima do piso' : 'abaixo do piso';
  return { inc, dep, total, sit, pct: pctNf(total, f.valorNfe) };
}
/* transportador: prestação = frete + pedágio + ad valorem + GRIS; ICMS "por dentro" sobre a prestação; CBS/IBS sobre a prestação */
/* CBS/IBS pelo ano do registro (LC 214/2025): 2026 teste 0,9% + 0,1%; 2027-2028 CBS 8,8% + IBS 0,1% (estimativa —
   confira com a contabilidade; Simples Nacional tem regra própria) */
function ibsCbsAno(data) { const a = +(String(data || '').slice(0, 4)) || new Date().getFullYear(); return a >= 2027 ? { cbs: 8.8, ibs: 0.1 } : { cbs: 0.9, ibs: 0.1 }; }
function trpCalc(f) {
  const nf = +f.valorNfe || 0, adv = nf * (+f.advPct || 0) / 100, gris = nf * (+f.grisPct || 0) / 100;
  /* vale-pedágio (Lei 10.209/2001) é pago à parte pelo contratante: não entra no frete nem na prestação (STJ, 2026) */
  const prest = (+f.frete || 0) + adv + gris, tx = ibsCbsAno(f.data);
  const icms = prest * (+f.icmsAliq || 0) / 100, cbs = prest * (f.cbsAliq ?? tx.cbs) / 100, ibs = prest * (f.ibsAliq ?? tx.ibs) / 100;
  const sit = !(f.piso > 0) ? 'sem piso' : (+f.frete || 0) + 0.005 >= f.piso ? 'acima do piso' : 'abaixo do piso';
  return { adv, gris, prest, icms, cbs, ibs, sit, pct: pctNf(prest, nf) };
}
/* desde maio/2026 (Res. ANTT 6.078/2026) frete abaixo do piso não gera CIOT, e o CIOT é exigido no MDF-e */
const ciotSit = s => s === 'abaixo do piso' ? 'abaixo do piso · CIOT bloqueado' : s;
const sitCls = s => /abaixo/.test(s) ? 'bad' : s === 'acima do piso' ? 'ok' : 'mut';
const FRETES = createRegistry({
  key: 'fretes', p: 'rg', aba: 'Fretes contratados',
  resumo: rows => { const b = rows.filter(f => empTotals(f).sit === 'abaixo do piso').length; const nf = rows.reduce((s, f) => s + (+f.valorNfe || 0), 0), fr = rows.reduce((s, f) => s + empTotals(f).total, 0); return (nf ? ` · frete médio ${fmt(fr / nf * 100, 2)}% da NF-e` : '') + (b ? ` · ${b} abaixo do piso ANTT` : ''); },
  media: rows => { const nf = rows.reduce((s, f) => s + (+f.valorNfe || 0), 0), fr = rows.reduce((s, f) => s + empTotals(f).total, 0); return nf ? fr / nf * 100 : NaN; },
  cols: [
    { k: 'data', t: 'Data', tipo: 'data', w: 11, ed: 'date' }, { k: 'transportadora', t: 'Transportadora', w: 22, ed: 'text' },
    { k: 'remetente', t: 'Remetente', w: 20, ed: 'text' }, { k: 'origem', t: 'Origem', w: 18, ed: 'text' }, { k: 'destinos', t: 'Destino(s)', w: 30, ed: 'text' },
    { k: 'km', t: 'Km', tipo: 'numero', w: 8, ed: 'number', soma: 1 }, { k: 'veiculo', t: 'Veículo', w: 16, ed: 'text' },
    { k: 'volumes', t: 'Volumes', tipo: 'numero', w: 9, ed: 'number', soma: 1 }, { k: 'pesoKg', t: 'Peso total (kg)', tipo: 'numero', w: 12, ed: 'number', soma: 1 },
    { k: 'piso', t: 'Frete mínimo ANTT', tipo: 'moeda', w: 15, ed: 'number', soma: 1 },
    { k: 'valor', t: 'Frete fechado', tipo: 'moeda', w: 14, ed: 'number', soma: 1 },
    { k: '_dep', t: 'Adicionais depois', tipo: 'moeda', w: 14, calc: f => empTotals(f).dep, soma: 1 }, { k: '_tot', t: 'Total pago', tipo: 'moeda', w: 14, calc: f => empTotals(f).total, soma: 1 },
    { k: 'valorNfe', t: 'Valor da NF-e', tipo: 'moeda', w: 14, ed: 'number', soma: 1 },
    { k: '_pct', t: 'Frete / NF-e', tipo: 'pct', w: 11, calc: f => empTotals(f).pct, media: 1 },
    { k: '_sit', t: 'Situação', w: 16, calc: f => ciotSit(empTotals(f).sit), status: f => sitCls(empTotals(f).sit) },
    { k: 'nfe', t: 'NF-e', w: 22, ed: 'text', doc: '55' }, { k: 'cte', t: 'CT-e', w: 18, ed: 'text', doc: '57' }, { k: 'ciot', t: 'CIOT', w: 18, ed: 'text' },
    { k: 'valePedagio', t: 'Vale-pedágio (à parte)', tipo: 'moeda', w: 14, ed: 'number', soma: 1 },
    { k: '_adl', t: 'Adicionais (detalhe)', w: 36, calc: f => (f.adicionais || []).map(a => `${a.desc}: ${brl(a.valor)} (${a.quando === 'incluso' ? 'incluso' : 'depois'})`).join('; ') },
    { k: 'obs', t: 'Observações', w: 30, ed: 'text' }, { k: 'foto', t: 'Caminhão carregado', w: 10 }
  ]
});
const TRANSP = createRegistry({
  key: 'transportes', p: 'tp', aba: 'Transportes realizados',
  resumo: rows => { const b = rows.filter(f => trpCalc(f).sit === 'abaixo do piso').length; return b ? ` · ${b} abaixo do piso ANTT` : ''; },
  media: rows => { const nf = rows.reduce((s, f) => s + (+f.valorNfe || 0), 0), pr = rows.reduce((s, f) => s + trpCalc(f).prest, 0); return nf ? pr / nf * 100 : NaN; },
  cols: [
    { k: 'data', t: 'Data', tipo: 'data', w: 11, ed: 'date' }, { k: 'cliente', t: 'Cliente (embarcador)', w: 22, ed: 'text' },
    { k: 'origem', t: 'Origem', w: 18, ed: 'text' }, { k: 'destinos', t: 'Destino(s)', w: 30, ed: 'text' }, { k: 'km', t: 'Km', tipo: 'numero', w: 8, ed: 'number', soma: 1 },
    { k: 'veiculo', t: 'Veículo', w: 16, ed: 'text' }, { k: 'eixos', t: 'Eixos', tipo: 'numero', w: 7, ed: 'number' }, { k: 'tabela', t: 'Tabela ANTT', w: 10, ed: 'text' },
    { k: 'volumes', t: 'Volumes', tipo: 'numero', w: 9, ed: 'number', soma: 1 }, { k: 'pesoKg', t: 'Peso (kg)', tipo: 'numero', w: 10, ed: 'number', soma: 1 },
    { k: 'valorNfe', t: 'Valor da NF-e', tipo: 'moeda', w: 14, ed: 'number', soma: 1 }, { k: 'piso', t: 'Piso ANTT', tipo: 'moeda', w: 12, ed: 'number', soma: 1 },
    { k: 'frete', t: 'Frete cobrado', tipo: 'moeda', w: 14, ed: 'number', soma: 1 }, { k: 'pedagio', t: 'Vale-pedágio (à parte)', tipo: 'moeda', w: 13, ed: 'number', soma: 1 },
    { k: 'advPct', t: 'Ad valorem %', tipo: 'numero', dec: 3, w: 10, ed: 'number' }, { k: '_adv', t: 'Ad valorem', tipo: 'moeda', w: 11, calc: f => trpCalc(f).adv, soma: 1 },
    { k: 'grisPct', t: 'GRIS %', tipo: 'numero', dec: 3, w: 8, ed: 'number' }, { k: '_gris', t: 'GRIS', tipo: 'moeda', w: 10, calc: f => trpCalc(f).gris, soma: 1 },
    { k: '_prest', t: 'Total da prestação', tipo: 'moeda', w: 15, calc: f => trpCalc(f).prest, soma: 1 },
    { k: 'icmsAliq', t: 'ICMS %', tipo: 'numero', dec: 2, w: 8, ed: 'number' }, { k: '_icms', t: 'ICMS', tipo: 'moeda', w: 11, calc: f => trpCalc(f).icms, soma: 1 },
    { k: '_cbs', t: 'CBS', tipo: 'moeda', w: 10, calc: f => trpCalc(f).cbs, soma: 1 }, { k: '_ibs', t: 'IBS', tipo: 'moeda', w: 10, calc: f => trpCalc(f).ibs, soma: 1 },
    { k: '_pct', t: 'Frete / NF-e', tipo: 'pct', w: 11, calc: f => trpCalc(f).pct, media: 1 },
    { k: '_sit', t: 'Situação', w: 16, calc: f => ciotSit(trpCalc(f).sit), status: f => sitCls(trpCalc(f).sit) },
    { k: 'nfe', t: 'NF-e', w: 22, ed: 'text', doc: '55' }, { k: 'cte', t: 'CT-e', w: 18, ed: 'text', doc: '57' }, { k: 'ciot', t: 'CIOT', w: 18, ed: 'text' }, { k: 'obs', t: 'Observações', w: 30, ed: 'text' }
  ]
});
FRETES.totals = empTotals;
