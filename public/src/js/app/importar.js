/* NEXORA — importar itens de planilha (CSV ou colado do Excel / Google Planilhas) para o editor de carga */
(function () {
  'use strict';
  const q = s => document.querySelector(s);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim();
  /* cabeçalhos aceitos → campo do editor */
  const MAP = [
    [/^(descricao|produto|nome|item|mercadoria)/, 'nome'], [/^(codigo|cod|ref|referencia|sku)/, 'cod'], [/^tipo/, 'tipo'],
    [/^(comprimento|comp|c$|c m|diametro)/, 'l'], [/^(largura|larg|l$|l m)/, 'w'], [/^(altura|alt|a$|a m)/, 'h'],
    [/^(quantidade|qtd|qtde|quant|volumes|vol$)/, 'q'], [/^(pecas|pcs|pecas por volume|pecas vol)/, 'pcs'],
    [/^(peso por peca|kg peca|kg por peca|kgp)/, 'kgp'], [/^(peso|kg|peso vol|kg vol|peso por volume|kg por volume)/, 'kg'],
    [/^(entrega|destino|parada|cidade|destinatario)/, 'stop']
  ];
  const TIPO = t => { const n = norm(t); if (/bobin/.test(n)) return 'bobina'; if (/big ?bag/.test(n)) return 'bigbag'; if (/caix/.test(n)) return 'caixa'; if (/palet|pallet/.test(n)) return 'palete'; return Object.keys(NX.TIPOS).find(k => norm(NX.TIPOS[k].nome) === n) || 'caixa'; };
  const num = v => { let s = String(v ?? '').trim().replace(/\s/g, ''); if (!s) return NaN; if (/,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); return +s; };
  function parse(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim()); if (lines.length < 2) throw new Error('Inclua a linha de cabeçalho e pelo menos uma linha de item.');
    const d = ['\t', ';', ','].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
    const split = l => { const out = []; let cur = '', qt = false; for (const ch of l) { if (ch === '"') qt = !qt; else if (ch === d && !qt) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
    const head = split(lines[0]).map(h => { const n = norm(h); const m = MAP.find(([re]) => re.test(n)); return m ? m[1] : null; });
    if (!head.includes('nome') || !head.includes('q')) throw new Error('Não encontrei as colunas obrigatórias "Descrição" e "Quantidade" no cabeçalho.');
    return lines.slice(1).map(l => { const c = split(l), o = {}; head.forEach((k, i) => { if (k) o[k] = c[i]; }); return o; });
  }
  function stopOf(v) {
    if (mode !== 'route' || !v) return mode === 'route' ? RT.lastStop() : undefined;
    const st = S.route.stops, n = norm(v), k = parseInt(String(v).replace(/\D/g, ''), 10);
    const hit = st.find(s => norm(s.nome) === n || norm(s.city) === n || norm(s.city + ' ' + s.uf) === n.replace(/ /g, ' ')) || (k >= 1 && k <= st.length && /^e?\s*\d+$/i.test(String(v).trim()) ? st[k - 1] : null);
    return hit ? hit.id : '';
  }
  function add(text) {
    const msg = q('#moImpMsg'); msg.className = '';
    try {
      const rows = parse(text); let ok = 0; const errs = [];
      rows.forEach((o, i) => {
        const tipo = TIPO(o.tipo), pcs = num(o.pcs) > 0 ? Math.round(num(o.pcs)) : 1; let kg = num(o.kg), kgp = num(o.kgp);
        if (!(kg >= 0) && kgp >= 0) kg = kgp * pcs; if (!(kgp >= 0) && kg >= 0) kgp = kg / pcs;
        const it = { id: nid(), cod: (o.cod || 'IMP-' + String(draft.length + 1).padStart(3, '0')).slice(0, 40), nome: String(o.nome || '').slice(0, 120), tipo, l: num(o.l), w: tipo === 'bobina' ? num(o.l) : num(o.w), h: num(o.h), q: Math.round(num(o.q)), pcs, kgp: +(+kgp || 0).toFixed(4), kg: +(+kg || 0).toFixed(3), pos: NX.POS[tipo][0][0], stack: null, maxLevels: null, cor: COLS[draft.length % COLS.length], stop: stopOf(o.stop) };
        const e = NX.validateSpec(NX.normalize(it), true); if (e.length) errs.push(`linha ${i + 2}: ${e[0]}`);
        draft.push(it); ok++;
      });
      renderDraft(); q('#moImpTxt').value = '';
      msg.className = errs.length ? 'warn' : 'ok';
      msg.textContent = `${ok} item(ns) adicionado(s).` + (errs.length ? ` Confira ${errs.length} linha(s) marcadas como incompletas: ${errs.slice(0, 3).join('; ')}${errs.length > 3 ? '…' : ''}` : '') + (mode === 'route' && rows.some(o => o.stop && !stopOf(o.stop)) ? ' Algumas entregas não foram reconhecidas: escolha na coluna Entrega.' : '');
    } catch (er) { msg.className = 'bad'; msg.textContent = er.message; }
  }
  q('#moImp').onclick = e => { const b = q('#moImpBox'); b.hidden = !b.hidden; e.currentTarget.setAttribute('aria-expanded', !b.hidden); if (!b.hidden) q('#moImpTxt').focus(); };
  q('#moImpGo').onclick = () => add(q('#moImpTxt').value);
  q('#moImpFileLbl').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('#moImpFile').click(); } });
  q('#moImpFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) { q('#moImpMsg').className = 'bad'; q('#moImpMsg').textContent = 'Arquivo do Excel: abra no Excel e use "Salvar como › CSV", ou copie as linhas e cole aqui.'; e.target.value = ''; return; }
    const buf = await f.arrayBuffer(); let t = new TextDecoder('utf-8').decode(buf); if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
    add(t); e.target.value = '';
  };
  q('#moImpModel').onclick = () => {
    const csv = '﻿Descrição;Código;Tipo;Comprimento (m);Largura (m);Altura (m);Quantidade;Peças por volume;Peso por volume (kg);Entrega\nPALLET MERCADO LIVRE;PED-001;Palete;1,20;1,10;1,90;10;42;378;1\nCAIXA ELETRÔNICOS;PED-002;Caixa;0,60;0,40;0,40;30;4;18;2\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'modelo-carga-nexora.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
