/* NEXORA — acessibilidade
 * - clicar/tocar no 3D leva o foco do teclado para a cena (os atalhos passam a funcionar)
 * - janelas (modais): foco preso dentro, Esc fecha, foco volta para quem abriu
 * - formulários: erro ligado ao campo (aria-invalid + foco no primeiro campo com problema)
 * - cena 3D descrita para leitores de tela, com os atalhos
 */
(function () {
  'use strict';
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  /* ---------- 3D: foco e descrição ---------- */
  const cv = q('#cv');
  if (cv) {
    cv.setAttribute('role', 'application');
    cv.setAttribute('aria-roledescription', 'cena 3D de carregamento');
    cv.setAttribute('aria-label', 'Cena 3D do carregamento');
    const help = document.createElement('p'); help.id = 'cvHelp'; help.className = 'sr';
    help.textContent = 'Selecione um volume na lista de volumes ou clicando nele. Atalhos: setas movem o volume (Shift para passo maior), R gira 90 graus, D deita, O troca a orientação, Control Z desfaz, Control Y refaz, Esc tira a seleção. Colchetes recolhem o menu e o painel.';
    cv.after(help); cv.setAttribute('aria-describedby', 'cvHelp');
    /* clicar ou tocar no 3D tira o foco de campos (selects, inputs) e entrega à cena */
    cv.addEventListener('pointerdown', () => { if (document.activeElement !== cv) cv.focus({ preventScroll: true }); }, true);
  }

  /* ---------- janelas (modais): foco preso, Esc, retorno de foco ---------- */
  const opener = new WeakMap();
  const closeBtn = m => q('#moX,#maxX,#mxNo,#bClosePrint,[data-close],.mh button', m);
  function onOpen(m) {
    opener.set(m, document.activeElement);
    m.setAttribute('aria-modal', 'true'); if (!m.getAttribute('role')) m.setAttribute('role', 'dialog');
    q('#app').setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!m.contains(document.activeElement)) { const f = qa(FOCUSABLE, m).find(e => e.offsetParent !== null); f && f.focus(); } }, 40);
  }
  function onClose(m) {
    if (!qa('.modal.on').length) q('#app').removeAttribute('aria-hidden');
    const o = opener.get(m); if (o && document.contains(o) && o.offsetParent !== null) o.focus({ preventScroll: true });
  }
  for (const m of qa('.modal')) {
    let was = m.classList.contains('on');
    new MutationObserver(() => { const on = m.classList.contains('on'); if (on && !was) onOpen(m); if (!on && was) onClose(m); was = on; }).observe(m, { attributes: true, attributeFilter: ['class'] });
    m.addEventListener('keydown', e => {
      if (!m.classList.contains('on')) return;
      if (e.key === 'Escape') { const b = closeBtn(m); if (b) { e.preventDefault(); b.click(); } return; }
      if (e.key !== 'Tab') return;
      const f = qa(FOCUSABLE, m).filter(x => x.offsetParent !== null); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- formulário de produto: erro ligado ao campo ---------- */
  const FIELD = [[/nome/i, 'nome'], [/c[oó]digo/i, 'cod'], [/di[aâ]metro|comprimento/i, 'l'], [/largura da bobina|altura/i, 'h'], [/largura/i, 'w'], [/pe[çc]as/i, 'pcs'], [/peso/i, 'kgp'], [/aguenta/i, 'stack'], [/n[ií]veis/i, 'maxLevels']];
  const pErr = q('#pErr'), fProd = q('#fProd');
  if (pErr && fProd) {
    pErr.setAttribute('role', 'alert');
    new MutationObserver(() => {
      qa('[aria-invalid]', fProd).forEach(e => { e.removeAttribute('aria-invalid'); e.removeAttribute('aria-describedby'); });
      const txt = pErr.textContent.trim(); if (!txt) return;
      const bad = [];
      for (const part of txt.split(/(?<=\.)\s+/)) for (const [re, name] of FIELD) if (re.test(part)) { const el = fProd.elements[name]; if (el && !bad.includes(el)) bad.push(el); break; }
      bad.forEach(el => { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'pErr'); });
      if (bad[0]) bad[0].focus();
    }).observe(pErr, { childList: true, characterData: true, subtree: true });
    fProd.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid') && e.target.value) e.target.removeAttribute('aria-invalid'); });
  }

  /* ---------- editor de carga: campos obrigatórios vazios marcados ---------- */
  const rows = q('#moRows');
  if (rows) {
    const REQ = ['nome', 'l', 'w', 'h', 'q', 'kgp'];
    const mark = () => qa('input[data-k]', rows).forEach(i => {
      if (!REQ.includes(i.dataset.k) || i.disabled) return;
      const empty = i.value.trim() === '' || ((i.type === 'number' || i.dataset.mask) && !(+i.value > 0) && i.dataset.k !== 'kgp');
      if (empty) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', 'moMsg'); } else { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); }
    });
    new MutationObserver(mark).observe(rows, { childList: true });
    rows.addEventListener('input', mark);
    const apply = q('#moApply');
    if (apply) apply.addEventListener('click', () => { const b = q('[aria-invalid=true]', rows); if (b) b.focus(); }, true);
  }

  /* ---------- avisos: área viva educada para mensagens comuns ---------- */
  const toast = q('#toast'); if (toast) { toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); }
})();
