/* NEXORA — formatação automática dos números enquanto se digita (padrão brasileiro).
 *  - Valores em R$: 1 2 3 4 5 → 123,45 → digitando mais: 1.234,56 (centavos à direita, como em caixa de banco).
 *  - Medidas em metros: 1 5 0 → 1,50 (a vírgula entra sozinha, 2 casas).
 *  - Pesos e quantidades: o ponto de milhar entra sozinho (1.250) e a vírgula separa os decimais (1,20).
 *    Pode digitar ponto ou vírgula para os decimais: vira vírgula.
 * Funciona em todos os <input type="number"> do sistema, inclusive os criados depois (MutationObserver).
 * O campo vira texto na tela, mas input.value continua devolvendo o número puro ("1234.56"),
 * então o resto do código não muda. Para não formatar um campo, use data-nomask.
 */
(function () {
  'use strict';
  const D = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const nget = el => D.get.call(el), nset = (el, v) => D.set.call(el, v);
  const brMoney = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const labelOf = el => { const l = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`)); return (l ? l.textContent : '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.placeholder || ''); };
  /* medidas em metros (comprimento, largura, altura, diâmetro): digita só números e a vírgula entra sozinha — 150 → 1,50 */
  const isDim = el => el.hasAttribute('data-dim') || /^(l|w|h|L|W|H)$/.test(el.name || el.dataset.k || '') || /\(m\)|\bmetros?\b|comprimento|largura|altura|di[âa]metro/i.test(labelOf(el));
  const isMoney = el => el.hasAttribute('data-money') || /R\$|\breais\b/i.test(labelOf(el));
  const decOf = el => { if (el.dataset.dec) return +el.dataset.dec; const s = el.getAttribute('step'); if (!s || s === 'any') return s === 'any' ? 3 : 0; const m = String(s).match(/\.(\d+)/); return m ? m[1].length : 0; };

  /* texto na tela → número puro */
  function raw(el) {
    const s = nget(el); if (!s) return '';
    if (el.dataset.mask === 'money' || (el.dataset.mask === 'dim' && !el._livre)) { const d = s.replace(/\D/g, ''), k = +el.dataset.dec; return d ? (parseInt(d, 10) / 10 ** k).toFixed(k) : ''; }
    let t = s.replace(/\./g, '').replace(',', '.'); if (t.endsWith('.')) t = t.slice(0, -1); return t === '-' ? '' : t;
  }
  /* número puro → texto na tela */
  function show(el, v) {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) return '';
    const n = typeof v === 'number' ? v : Number(String(v).trim()); if (!isFinite(n)) return '';
    if (el.dataset.mask === 'dim') return n.toLocaleString('pt-BR', { minimumFractionDigits: +el.dataset.dec, maximumFractionDigits: +el.dataset.dec });
    return el.dataset.mask === 'money' ? brMoney(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: +el.dataset.dec || 0, useGrouping: true });
  }
  /* reformata o que está sendo digitado, mantendo o cursor no lugar certo */
  function live(el, ev) {
    if (el._livre && !/,/.test(nget(el))) el._livre = false;
    const s = nget(el), pos = el.selectionStart == null ? s.length : el.selectionStart;
    const sig = c => /[\d,]/.test(c), before = [...s.slice(0, pos)].filter(sig).length;
    let out;
    if (el.dataset.mask === 'money' || (el.dataset.mask === 'dim' && !el._livre)) { const k = +el.dataset.dec, d = s.replace(/\D/g, '').replace(/^0+(?=\d)/, ''); out = d ? (parseInt(d, 10) / 10 ** k).toLocaleString('pt-BR', { minimumFractionDigits: k, maximumFractionDigits: k }) : ''; }
    else {
      const dec = +el.dataset.dec || 0, neg = el.dataset.neg && s.trim().startsWith('-');
      /* "1.2" ou "12.50" (ponto como decimal, vindo de colagem/preenchimento automático) → vírgula; "1.250" continua milhar */
      const digitando = ev && /^(insertText|delete)/.test(ev.inputType || '');
      let s2 = s; if (!digitando && !s2.includes(',') && (s2.match(/\./g) || []).length === 1 && !/\.\d{3}$/.test(s2)) s2 = s2.replace('.', ',');
      let t = s2.replace(/[^\d,]/g, ''); const i = t.indexOf(',');
      let ip = i < 0 ? t : t.slice(0, i), dp = i < 0 ? null : t.slice(i + 1).replace(/,/g, '');
      if (!dec) dp = null; else if (dp !== null) dp = dp.slice(0, dec);
      ip = ip.replace(/^0+(?=\d)/, ''); if (ip === '' && dp !== null) ip = '0';
      out = (neg ? '-' : '') + ip.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dp !== null ? ',' + dp : '');
    }
    if (out === s) return; nset(el, out);
    if (document.activeElement !== el) return;
    let k = 0, p = 0; if (el.dataset.mask === 'money' || (el.dataset.mask === 'dim' && !el._livre)) p = out.length; else { while (p < out.length && k < before) { if (sig(out[p])) k++; p++; } }
    try { el.setSelectionRange(p, p); } catch (e) { /* ok */ }
  }
  function apply(el) {
    if (el.dataset.mask || el.hasAttribute('data-nomask') || el.type !== 'number') return;
    const v = nget(el), money = isMoney(el), dim = !money && isDim(el);
    el.dataset.mask = money ? 'money' : dim ? 'dim' : 'num'; el.dataset.dec = money ? 2 : dim ? Math.max(2, decOf(el) || 2) : decOf(el);
    if (el.min && +el.min < 0) el.dataset.neg = '1';
    el.type = 'text'; el.inputMode = money || +el.dataset.dec ? 'decimal' : 'numeric'; el.autocomplete = 'off'; el.spellcheck = false;
    el.classList.add('masked'); if (money) el.classList.add('money');
    Object.defineProperty(el, 'value', { configurable: true, get() { return raw(el); }, set(x) { nset(el, show(el, x)); } });
    Object.defineProperty(el, 'valueAsNumber', { configurable: true, get() { const r = raw(el); return r === '' ? NaN : +r; }, set(x) { nset(el, show(el, x)); } });
    nset(el, show(el, v));
    el.addEventListener('input', e => live(el, e), true);
    el.addEventListener('blur', () => { if (el._livre) { const r = raw(el); el._livre = false; nset(el, show(el, r)); } });
    el.addEventListener('keydown', e => {
      /* medida: se a pessoa digitar vírgula/ponto, o que já digitou vira metros inteiros (1 , 9 → 1,9) */
      if (el.dataset.mask === 'dim' && !el._livre && (e.key === ',' || e.key === '.' || e.key === 'Decimal' || e.code === 'NumpadDecimal')) {
        e.preventDefault(); const sel = el.selectionStart === 0 && el.selectionEnd === nget(el).length; const d = sel ? '' : nget(el).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        const ip = d ? String(parseInt(d, 10)) : '0'; el._livre = true; nset(el, ip + ','); el.setSelectionRange(ip.length + 1, ip.length + 1); el.dispatchEvent(new Event('input', { bubbles: true })); return;
      }
      if (el.dataset.mask === 'num' && (e.key === '.' || e.key === 'Decimal' || e.code === 'NumpadDecimal') && +el.dataset.dec) {
        e.preventDefault(); if (nget(el).includes(',')) return; const a = el.selectionStart, b = el.selectionEnd, s = nget(el);
        nset(el, s.slice(0, a) + ',' + s.slice(b)); el.setSelectionRange(a + 1, a + 1); el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { /* setas sobem/descem 1 unidade, como antes */
        e.preventDefault(); const st = el.dataset.mask === 'money' ? 1 : el.dataset.mask === 'dim' ? 0.01 : (+el.getAttribute('step') > 0 ? +el.getAttribute('step') : 1);
        let n = (+raw(el) || 0) + (e.key === 'ArrowUp' ? st : -st); if (el.min !== '' && n < +el.min) n = +el.min; if (el.max !== '' && n > +el.max) n = +el.max;
        nset(el, show(el, +n.toFixed(6))); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    el.addEventListener('paste', e => { const t = (e.clipboardData || window.clipboardData).getData('text'); if (!t) return;
      /* colar "1.234,56", "1234.56" ou "R$ 1.234,56" */
      let c = t.replace(/[^\d.,-]/g, ''); if (/,\d{1,3}$/.test(c)) c = c.replace(/\./g, '').replace(',', '.'); else if (/\.\d{3}(\.|$)/.test(c) && !/\.\d{1,2}$/.test(c)) c = c.replace(/\./g, ''); else c = c.replace(/,/g, '');
      if (c && isFinite(+c)) { e.preventDefault(); nset(el, show(el, +c)); el.dispatchEvent(new Event('input', { bubbles: true })); } });
  }
  const scan = root => { if (root.nodeType !== 1) return; if (root.matches && root.matches('input[type=number]')) apply(root); root.querySelectorAll && root.querySelectorAll('input[type=number]').forEach(apply); };
  function start() { scan(document.body); new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) scan(n); }).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.NX_MASK = { apply, raw, show };
})();
