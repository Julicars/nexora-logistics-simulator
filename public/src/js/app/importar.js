/* NEXORA — importar itens de planilha (CSV ou colado do Excel / Google Planilhas) para o editor de carga */
(function () {
  'use strict';
  const q = s => document.querySelector(s);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim();
  /* cabeçalhos aceitos → campo do editor (inclui nomes comuns de ERP, como o TOTVS Datasul: it-codigo, desc-item, qt-pedida) */
  const MAP = [
    [/^(descricao|desc item|desc|produto|nome|item$|mercadoria|material)/, 'nome'], [/^(codigo|cod|it codigo|item codigo|ref|referencia|sku|part)/, 'cod'], [/^(tipo|embalagem|emb$)/, 'tipo'],
    [/^(comprimento|comp|c$|c m|c cm|c mm|diametro|length)/, 'l'], [/^(largura|larg|l$|l m|l cm|l mm|width)/, 'w'], [/^(altura|alt|a$|a m|a cm|a mm|height)/, 'h'],
    [/^(quantidade|qtd|qtde|quant|qt |qt$|qt pedida|volumes|vol$|qty)/, 'q'], [/^(pecas|pcs|pecas por volume|pecas vol|unid por vol)/, 'pcs'],
    [/^(peso por peca|kg peca|kg por peca|kgp|peso unit)/, 'kgp'], [/^(peso|kg|peso bruto|peso vol|kg vol|peso por volume|kg por volume|weight)/, 'kg'],
    [/^(entrega|destino|parada|cidade|destinatario|cliente)/, 'stop']
  ];
  const TIPO = t => { const n = norm(t); if (/bobin/.test(n)) return 'bobina'; if (/big ?bag/.test(n)) return 'bigbag'; if (/caix/.test(n)) return 'caixa'; if (/palet|pallet/.test(n)) return 'palete'; return Object.keys(NX.TIPOS).find(k => norm(NX.TIPOS[k].nome) === n) || 'caixa'; };
  const num = v => { if (typeof v === 'number') return v; let s = String(v ?? '').trim().replace(/\s/g, ''); if (!s) return NaN; if (/,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); return +s; };
  const NOMES = { nome: 'Descrição', cod: 'Código', tipo: 'Tipo', l: 'Comprimento', w: 'Largura', h: 'Altura', q: 'Quantidade', pcs: 'Peças', kgp: 'Peso por peça', kg: 'Peso', stop: 'Entrega' };
  /* matriz (linhas × células) → itens. Acha a linha de cabeçalho nas 15 primeiras e converte cm/mm/t */
  function deMatriz(M) {
    M = M.filter(l => l.some(c => String(c ?? '').trim()));
    let hi = -1, head = null;
    for (let i = 0; i < Math.min(15, M.length); i++) { const h = M[i].map(c => { const n = norm(c); const m = MAP.find(([re]) => re.test(n)); return m ? m[1] : null; }); if (h.includes('nome') && h.includes('q')) { hi = i; head = h; break; } }
    if (hi < 0) throw new Error('Não encontrei as colunas "Descrição" e "Quantidade" no cabeçalho (procurei nas 15 primeiras linhas).');
    head = head.map((k, i) => k && head.indexOf(k) === i ? k : null); /* coluna repetida: vale a primeira */
    const rows = M.slice(hi + 1).filter(l => String(l[head.indexOf('nome')] ?? '').trim());
    /* unidade das medidas: pelo cabeçalho (cm, mm) ou pelo tamanho dos números */
    const esc = {}; ['l', 'w', 'h'].forEach(k => { const i = head.indexOf(k); if (i < 0) return; const t = norm(M[hi][i]), mx = Math.max(0, ...rows.map(r => num(r[i])).filter(x => x > 0));
      esc[k] = /\bmm\b/.test(t) ? 1000 : /\bcm\b/.test(t) ? 100 : /\bm\b/.test(t) ? 1 : mx > 400 ? 1000 : mx > 20 ? 100 : 1; });
    const ton = ['kg', 'kgp'].filter(k => head.indexOf(k) >= 0 && /\b(t|ton|tonelada)/.test(norm(M[hi][head.indexOf(k)])));
    const objs = rows.map(l => { const o = {}; head.forEach((k, i) => { if (!k) return; let v = l[i]; if (esc[k] && esc[k] !== 1 && num(v) > 0) v = num(v) / esc[k]; if (ton.includes(k) && num(v) > 0) v = num(v) * 1000; o[k] = v; }); return o; });
    objs.info = { linha: hi + 1, colunas: [...new Set(head.filter(Boolean))].map(k => NOMES[k] + (esc[k] === 100 ? ' (cm)' : esc[k] === 1000 ? ' (mm)' : '')) };
    return objs;
  }
  function parse(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim()); if (lines.length < 2) throw new Error('Inclua a linha de cabeçalho e pelo menos uma linha de item.');
    const d = ['\t', ';', ','].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
    const split = l => { const out = []; let cur = '', qt = false; for (const ch of l) { if (ch === '"') qt = !qt; else if (ch === d && !qt) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
    return deMatriz(lines.map(split));
  }
  function stopOf(v) {
    if (mode !== 'route' || !v) return mode === 'route' ? RT.lastStop() : undefined;
    const st = S.route.stops, n = norm(v), k = parseInt(String(v).replace(/\D/g, ''), 10);
    const hit = st.find(s => norm(s.nome) === n || norm(s.city) === n || norm(s.city + ' ' + s.uf) === n.replace(/ /g, ' ')) || (k >= 1 && k <= st.length && /^e?\s*\d+$/i.test(String(v).trim()) ? st[k - 1] : null);
    return hit ? hit.id : '';
  }
  function add(text, M) {
    const msg = q('#moImpMsg'); msg.className = '';
    try {
      const rows = M ? deMatriz(M) : parse(text); let ok = 0; const errs = [];
      rows.forEach((o, i) => {
        const tipo = TIPO(o.tipo || o.nome), /* sem coluna Tipo: deduz pela descrição (bobina, caixa, palete…) */ pcs = num(o.pcs) > 0 ? Math.round(num(o.pcs)) : 1; let kg = num(o.kg), kgp = num(o.kgp);
        if (!(kg >= 0) && kgp >= 0) kg = kgp * pcs; if (!(kgp >= 0) && kg >= 0) kgp = kg / pcs;
        const it = { id: nid(), cod: (o.cod || 'IMP-' + String(draft.length + 1).padStart(3, '0')).slice(0, 40), nome: String(o.nome || '').slice(0, 120), tipo, l: num(o.l), w: tipo === 'bobina' ? num(o.l) : num(o.w), h: num(o.h), q: Math.round(num(o.q)), pcs, kgp: +(+kgp || 0).toFixed(4), kg: +(+kg || 0).toFixed(3), pos: NX.POS[tipo][0][0], stack: null, maxLevels: null, cor: COLS[draft.length % COLS.length], stop: stopOf(o.stop) };
        const e = NX.validateSpec(NX.normalize(it), true); if (e.length) errs.push(`linha ${i + 2}: ${e[0]}`);
        draft.push(it); ok++;
      });
      renderDraft(); q('#moImpTxt').value = '';
      msg.className = errs.length ? 'warn' : 'ok';
      msg.textContent = `${ok} item(ns) adicionado(s). Colunas reconhecidas: ${rows.info.colunas.join(', ')}.` + (errs.length ? ` Confira ${errs.length} linha(s) marcadas como incompletas: ${errs.slice(0, 3).join('; ')}${errs.length > 3 ? '…' : ''}` : '') + (mode === 'route' && rows.some(o => o.stop && !stopOf(o.stop)) ? ' Algumas entregas não foram reconhecidas: escolha na coluna Entrega.' : '');
    } catch (er) { msg.className = 'bad'; msg.textContent = er.message; }
  }
  q('#moImp').onclick = e => { const b = q('#moImpBox'); b.hidden = !b.hidden; e.currentTarget.setAttribute('aria-expanded', !b.hidden); if (!b.hidden) q('#moImpTxt').focus(); };
  q('#moImpGo').onclick = () => add(q('#moImpTxt').value);
  q('#moImpFileLbl').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('#moImpFile').click(); } });
  q('#moImpFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    if (/\.xls$/i.test(f.name)) { q('#moImpMsg').className = 'bad'; q('#moImpMsg').textContent = 'Formato .xls antigo: no Excel use "Salvar como › Pasta de Trabalho do Excel (.xlsx)" ou CSV.'; e.target.value = ''; return; }
    if (/\.xlsx$/i.test(f.name)) { /* Excel: usa a primeira aba que tiver o cabeçalho reconhecido */
      try { const abas = await NXLER.ler(buf); let ult = null;
        for (const a of abas) { try { deMatriz(a.linhas); add('', a.linhas); return; } catch (er) { ult = er; } }
        throw ult || new Error('Planilha vazia.');
      } catch (er) { q('#moImpMsg').className = 'bad'; q('#moImpMsg').textContent = er.message; } finally { e.target.value = ''; }
      return; } let t = new TextDecoder('utf-8').decode(buf); if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
    add(t); e.target.value = '';
  };
  q('#moImpModel').onclick = () => {
    const csv = '﻿Descrição;Código;Tipo;Comprimento (m);Largura (m);Altura (m);Quantidade;Peças por volume;Peso por volume (kg);Entrega\nPALLET MERCADO LIVRE;PED-001;Palete;1,20;1,10;1,90;10;42;378;1\nCAIXA ELETRÔNICOS;PED-002;Caixa;0,60;0,40;0,40;30;4;18;2\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'modelo-carga-nexora.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
