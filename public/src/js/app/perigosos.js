/* NEXORA — Produtos perigosos: dados ONU no cadastro, rótulos de risco, painel de segurança e lembrete
 * dos documentos. Base: Resolução ANTT 5.998/2022 (com alterações das Res. 6.016/2023 e 6.056/2024),
 * NBR 7500 (sinalização), NBR 7503 (ficha de emergência) e NBR 9735 (equipamentos de emergência).
 * É um lembrete de apoio, não substitui a análise do expedidor nem a regulamentação.
 */
const PERIG = (function () {
  'use strict';
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const CATS = ['explosivo', 'inflamavel', 'corrosivo', 'toxico'];
  /* classes/subclasses ONU — cor do rótulo (fundo, texto) */
  const CL = {
    '1': ['Explosivos', '#f39a2b', '#000'], '2.1': ['Gás inflamável', '#e3262d', '#fff'], '2.2': ['Gás não inflamável e não tóxico', '#1f9d55', '#fff'], '2.3': ['Gás tóxico', '#ffffff', '#000'],
    '3': ['Líquido inflamável', '#e3262d', '#fff'], '4.1': ['Sólido inflamável', 'url(#st41)', '#000'], '4.2': ['Combustão espontânea', 'url(#st42)', '#000'], '4.3': ['Perigoso quando molhado', '#1f6fd1', '#fff'],
    '5.1': ['Oxidante', '#f5d90a', '#000'], '5.2': ['Peróxido orgânico', 'url(#st52)', '#000'], '6.1': ['Tóxico', '#ffffff', '#000'], '6.2': ['Infectante', '#ffffff', '#000'],
    '7': ['Radioativo', 'url(#st7)', '#000'], '8': ['Corrosivo', 'url(#st8)', '#000'], '9': ['Perigosos diversos', 'url(#st9)', '#000']
  };
  const DEFS = `<defs><linearGradient id="st41" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset=".1" stop-color="#fff"/><stop offset=".1" stop-color="#e3262d"/><stop offset=".2" stop-color="#e3262d"/><stop offset=".2" stop-color="#fff"/><stop offset=".3" stop-color="#fff"/><stop offset=".3" stop-color="#e3262d"/><stop offset=".4" stop-color="#e3262d"/><stop offset=".4" stop-color="#fff"/><stop offset=".5" stop-color="#fff"/><stop offset=".5" stop-color="#e3262d"/><stop offset=".6" stop-color="#e3262d"/><stop offset=".6" stop-color="#fff"/><stop offset=".7" stop-color="#fff"/><stop offset=".7" stop-color="#e3262d"/><stop offset=".8" stop-color="#e3262d"/><stop offset=".8" stop-color="#fff"/></linearGradient>
    <linearGradient id="st42" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#fff"/><stop offset=".5" stop-color="#e3262d"/></linearGradient><linearGradient id="st52" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#e3262d"/><stop offset=".5" stop-color="#f5d90a"/></linearGradient>
    <linearGradient id="st7" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#f5d90a"/><stop offset=".5" stop-color="#fff"/></linearGradient><linearGradient id="st8" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#fff"/><stop offset=".5" stop-color="#111"/></linearGradient>
    <linearGradient id="st9" x1="0" x2="1"><stop offset=".1" stop-color="#111"/><stop offset=".1" stop-color="#fff"/><stop offset=".2" stop-color="#fff"/><stop offset=".2" stop-color="#111"/><stop offset=".3" stop-color="#111"/><stop offset=".3" stop-color="#fff"/></linearGradient></defs>`;
  function rotulo(cl) {
    const c = CL[cl] || ['Classe ' + cl, '#fff', '#000'], main = String(cl).split('.')[0];
    return `<svg viewBox="0 0 100 100" class="rot" role="img" aria-label="Rótulo de risco classe ${cl}: ${c[0]}">${DEFS}<rect x="15" y="15" width="70" height="70" transform="rotate(45 50 50)" fill="${c[1]}" stroke="#000" stroke-width="2"/><rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)" fill="none" stroke="${c[2] === '#fff' ? '#fff' : '#000'}" stroke-width="1"/><text x="50" y="47" text-anchor="middle" font-size="9" font-weight="700" fill="${c[2]}" font-family="sans-serif">${c[0].length > 18 ? c[0].split(' ')[0] : c[0]}</text><text x="50" y="86" text-anchor="middle" font-size="14" font-weight="800" fill="${c[2] === '#fff' && /url/.test(c[1]) ? '#fff' : c[2]}" font-family="sans-serif" ${/st8/.test(c[1]) ? 'style="fill:#fff"' : ''}>${main}</text></svg>`;
  }
  const painel = (risco, onu) => `<svg viewBox="0 0 120 80" class="pnl" role="img" aria-label="Painel de segurança${onu ? ': número de risco ' + (risco || '—') + ', número ONU ' + onu : ' sem números'}"><rect x="2" y="2" width="116" height="76" rx="4" fill="#f39a2b" stroke="#000" stroke-width="4"/>${onu ? `<line x1="2" y1="40" x2="118" y2="40" stroke="#000" stroke-width="4"/><text x="60" y="32" text-anchor="middle" font-size="24" font-weight="800" font-family="sans-serif">${esc(risco || '')}</text><text x="60" y="70" text-anchor="middle" font-size="24" font-weight="800" font-family="sans-serif">${esc(onu)}</text>` : ''}</svg>`;

  /* ---------- campos no cadastro de produto ---------- */
  const form = q('#fProd');
  const fs = `<details class="perig" id="pPerig"><summary>⚠ Dados de produto perigoso (ONU)</summary>
    <p class="mut" style="font-size:12px;margin:4px 0 8px">Preencha se o produto é perigoso para o transporte. Esses dados aparecem no Resultado, nas etiquetas e no lembrete de documentos. Confira na Ficha com Dados de Segurança (FDS) do fabricante.</p>
    <div class="grid g3" style="gap:8px">
     <label class="f">Número ONU<input name="onu" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="Ex.: 1203"></label>
     <label class="f">Classe ou subclasse<select name="classe"><option value="">—</option>${Object.entries(CL).map(([k, c]) => `<option value="${k}">${k} · ${c[0]}</option>`).join('')}</select></label>
     <label class="f">Risco subsidiário<input name="subrisco" maxlength="20" placeholder="Ex.: 6.1"></label>
     <label class="f">Grupo de embalagem<select name="grupo"><option value="">— / não se aplica</option><option>I</option><option>II</option><option>III</option></select></label>
     <label class="f">Número de risco (painel)<input name="numRisco" maxlength="4" placeholder="Ex.: 33"></label>
     <label class="f">Nome apropriado para embarque<input name="nomeEmb" maxlength="160" placeholder="Ex.: GASOLINA"></label>
    </div></details>`;
  q('fieldset.pcats').insertAdjacentHTML('afterend', fs);
  const box = q('#pPerig');
  const sync = () => { if (CATS.some(k => q(`#pCats input[value="${k}"]`) && q(`#pCats input[value="${k}"]`).checked) || form.onu.value) box.open = true; };
  q('#pCats').addEventListener('change', sync);
  const F = ['onu', 'classe', 'subrisco', 'grupo', 'numRisco', 'nomeEmb'];
  function formData(o) { const r = {}; for (const k of F) r[k] = String(o[k] || '').trim(); return r; }
  function fill(p) { for (const k of F) form[k].value = (p && p[k]) || ''; box.open = !!(p && (p.onu || (p.cats || []).some(k => CATS.includes(k)))); }
  function validate(o) { if (o.onu && !/^\d{4}$/.test(o.onu)) return 'Número ONU: são 4 dígitos (ex.: 1203).'; if (o.numRisco && !/^X?\d{2,3}$/i.test(o.numRisco)) return 'Número de risco: 2 ou 3 dígitos, podendo começar com X (ex.: 33, X423).'; return ''; }

  /* ---------- painel no Resultado ---------- */
  const isPerig = p => !!p.onu || (p.cats || []).some(k => CATS.includes(k));
  function render() {
    const el = q('#perigOut'); if (!el) return; if (!plan) { el.innerHTML = ''; return; }
    const blocks = plan.vehs.map((V, vi) => {
      const by = new Map(); for (const it of V.items) if (isPerig(it.p)) { const k = it.p.id || it.pid; const e = by.get(k) || { p: it.p, n: 0, kg: 0 }; e.n++; e.kg += it.kg; by.set(k, e); }
      if (!by.size) return '';
      const L = [...by.values()], semOnu = L.filter(e => !e.p.onu), classes = [...new Set(L.flatMap(e => [e.p.classe, ...(String(e.p.subrisco || '').split(/[,;\s]+/))]).filter(c => CL[c]))];
      const prods = L.map(e => `<tr><td>${esc(e.p.nome)}</td><td>${e.p.onu ? 'ONU ' + esc(e.p.onu) : '<span class="bad">sem nº ONU</span>'}</td><td>${esc(e.p.classe || '—')}${e.p.subrisco ? ' (' + esc(e.p.subrisco) + ')' : ''}</td><td>${esc(e.p.grupo || '—')}</td><td>${e.n} vol · ${fmt(e.kg, 0)} kg</td></tr>`).join('');
      const one = L.length === 1 && L[0].p.onu;
      return `<div class="perigv"><b>Veículo ${vi + 1}: ${esc(V.v.name)}</b>
        <div class="tbl-wrap"><table class="perigt"><tr><th>Produto</th><th>Nº ONU</th><th>Classe</th><th>Grupo emb.</th><th>Quantidade</th></tr>${prods}</table></div>
        <div class="sinal"><div><small>Rótulos de risco (nos lados e na traseira)</small><div class="rots">${classes.map(rotulo).join('') || '<span class="mut">Informe a classe no cadastro do produto.</span>'}</div></div>
        <div><small>Painel de segurança (frente, traseira e laterais)</small><div class="pnls">${one ? painel(L[0].p.numRisco, L[0].p.onu) : painel()}</div><small class="mut">${one ? 'Um só produto perigoso: número de risco em cima, número ONU embaixo.' : 'Mais de um produto perigoso: painel laranja sem números (confira na NBR 7500 e na regulamentação).'}</small></div></div>
        ${semOnu.length ? `<p class="bad" style="font-size:13px">Complete no cadastro o número ONU e a classe de: ${semOnu.map(e => esc(e.p.nome)).join(', ')}.</p>` : ''}</div>`;
    }).filter(Boolean);
    if (!blocks.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<h3 style="margin:14px 0 4px">⚠ Produtos perigosos</h3>${blocks.join('')}
      <div class="perigck"><b>Lembrete de documentos e itens (Res. ANTT 5.998/2022 e alterações)</b><ul>
        <li>Documento fiscal, CT-e e MDF-e com a descrição do produto perigoso: nº ONU, nome apropriado para embarque, classe (e risco subsidiário), grupo de embalagem e quantidade.</li>
        <li>Motorista com o curso específico para transporte de produtos perigosos (CETPP, antigo MOPP) válido na CNH.</li>
        <li>Rótulos de risco e painéis de segurança no veículo, iguais ao que está no documento (NBR 7500).</li>
        <li>Conjunto de equipamentos para emergência e EPI do motorista (NBR 9735).</li>
        <li>Informações de emergência do produto (ficha de emergência, NBR 7503) fornecidas pelo expedidor. As fontes divergem sobre o porte físico obrigatório depois da Res. 5.998/2022: mantenha disponível.</li>
        <li>Carga a granel: veículo e equipamento com certificados de inspeção (CIV/CIPP) válidos.</li>
        <li>Compatibilidade entre produtos no mesmo veículo (o NEXORA já bloqueia as combinações proibidas das categorias) e possíveis isenções por quantidade limitada — confira na regulamentação.</li>
      </ul><p class="mut" style="font-size:12px;margin:4px 0 0">Lembrete de apoio. A classificação e a documentação são responsabilidade do expedidor e do transportador.</p></div>`;
  }
  return { formData, fill, validate, render, rotulo, painel, isPerig };
})();
