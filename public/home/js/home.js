/* Home, Sobre e Contato: idioma, animações de entrada, cena do hero e formulário de contato. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const T = (k, v) => I18N.T(k, v);
  const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Idioma ---------- */
  const sel = $('#selIdioma');
  I18N.LANGS.forEach((l) => sel.appendChild(new Option(`${l.flag} ${l.nome}`, l.code)));
  sel.value = I18N.lang;
  sel.addEventListener('change', () => I18N.definir(sel.value));
  I18N.onChange = () => { desenhaHud(); };
  I18N.aplicar();
  document.documentElement.lang = I18N.lang;

  /* ---------- Aparecer ao rolar ---------- */
  const revs = document.querySelectorAll('.rev');
  if ('IntersectionObserver' in window && !reduzir) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visivel'); io.unobserve(e.target); } }), { threshold: 0.15 });
    revs.forEach((el) => io.observe(el));
  } else revs.forEach((el) => el.classList.add('visivel'));

  /* ---------- Cena do hero: paletes entrando no baú (projeção isométrica) ---------- */
  const cv = $('#cena');
  let nAtual = 0;
  const PAL_KG = 378, COLS = 8, LIN = 2, TOTAL = COLS * LIN;
  function desenhaHud() {
    if (!cv) return;
    $('#hudPal').textContent = nAtual + ' / ' + TOTAL;
    $('#hudKg').textContent = (nAtual * PAL_KG).toLocaleString(I18N.locale()) + ' kg';
    $('#hudPiso').textContent = Math.round((nAtual / TOTAL) * 100) + '%';
  }
  if (cv) {
    const g = cv.getContext('2d');
    const CORES = [['#f5a033', '#ffc16b', '#c97a14'], ['#2b7ad9', '#5aa0f5', '#1d57a3'], ['#f5a033', '#ffc16b', '#c97a14'], ['#4f8fe0', '#7db4fa', '#2f65aa']];
    const L = COLS, W = LIN * 1.1, H = 1.9, PH = 1.3;
    let w = 0, h = 0, u = 1, ox = 0, oy = 0;
    const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6);
    const iso = (x, y, z) => [ox + (x - y) * C * u, oy + (x + y) * S * u - z * u];
    function medir() {
      const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 1.5);
      w = r.width; h = r.height;
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      g.setTransform(d, 0, 0, d, 0, 0);
      const larg = (L + W) * C, alt = (L + W) * S + H;
      u = Math.min((w * 0.94) / larg, (h * 0.9) / alt);
      ox = w / 2 - ((L - W) * C * u) / 2;
      oy = h * 0.5 - ((L + W) * S * u) / 2 + (H * u) / 2;
    }
    const poli = (pts, fill, stroke) => {
      g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
    };
    function caixa(x, y, z, dx, dy, dz, cor, alfa) {
      g.globalAlpha = alfa;
      // topo, face da frente-direita (x máx) e frente-esquerda (y máx)
      poli([iso(x, y, z + dz), iso(x + dx, y, z + dz), iso(x + dx, y + dy, z + dz), iso(x, y + dy, z + dz)], cor[1], 'rgba(6,16,36,.55)');
      poli([iso(x + dx, y, z), iso(x + dx, y + dy, z), iso(x + dx, y + dy, z + dz), iso(x + dx, y, z + dz)], cor[2], 'rgba(6,16,36,.55)');
      poli([iso(x, y + dy, z), iso(x + dx, y + dy, z), iso(x + dx, y + dy, z + dz), iso(x, y + dy, z + dz)], cor[0], 'rgba(6,16,36,.55)');
      g.globalAlpha = 1;
    }
    const lerp = (a, b, t) => a + (b - a) * t, saida = (t) => 1 - Math.pow(1 - t, 3);
    const PASSO = 0.3, DUR = 0.8, SEGURA = 2.4, FADE = 0.7;
    const CICLO = TOTAL * PASSO + DUR + SEGURA + FADE;
    function quadro(t) {
      g.clearRect(0, 0, w, h);
      const tc = t % CICLO;
      const fim = TOTAL * PASSO + DUR + SEGURA;
      const fade = tc > fim ? 1 - (tc - fim) / FADE : 1;
      g.globalAlpha = 1;
      // piso do baú e parede do fundo
      const pad = 0.15;
      poli([iso(0, 0, 0), iso(L, 0, 0), iso(L, W, 0), iso(0, W, 0)], 'rgba(22,41,74,0.95)', 'rgba(90,130,200,0.5)');
      poli([iso(0, 0, 0), iso(L, 0, 0), iso(L, 0, H), iso(0, 0, H)], 'rgba(43,122,217,0.10)', 'rgba(90,130,200,0.35)');
      poli([iso(0, 0, 0), iso(0, W, 0), iso(0, W, H), iso(0, 0, H)], 'rgba(43,122,217,0.16)', 'rgba(90,130,200,0.35)');
      // paletes: do fundo para a frente
      let n = 0;
      const itens = [];
      for (let c = 0; c < COLS; c++) for (let r = 0; r < LIN; r++) itens.push({ c, r, i: c * LIN + r });
      itens.sort((a, b) => a.c + a.r - (b.c + b.r) || a.c - b.c);
      itens.forEach((it) => {
        const ini = it.i * PASSO, p = Math.min(1, Math.max(0, (tc - ini) / DUR));
        if (p <= 0) return;
        if (p >= 1) n++;
        const e = saida(p), x = it.c + pad / 2, y = it.r * 1.1 + pad / 2;
        const xs = lerp(L + 3.2, x, e), zs = (1 - e) * 1.1;
        caixa(xs, y, zs, 1 - pad, 1.1 - pad, 0.14, ['#a37a49', '#c79a63', '#7d5b33'], Math.min(1, p * 3) * fade);   // estrado
        caixa(xs, y, zs + 0.14, 1 - pad, 1.1 - pad, PH - 0.14, CORES[it.c % 4], Math.min(1, p * 3) * fade);
      });
      // aresta da frente do piso e porta
      g.globalAlpha = fade;
      poli([iso(L, 0, 0), iso(L, W, 0), iso(L, W, H), iso(L, 0, H)], null, 'rgba(245,160,51,0.5)');
      poli([iso(0, W, 0), iso(L, W, 0), iso(L, W, H), iso(0, W, H)], null, 'rgba(90,130,200,0.28)');
      g.globalAlpha = 1;
      if (n !== nAtual) { nAtual = n; desenhaHud(); }
    }
    medir();
    // redimensionar um <canvas> (até via ResizeObserver, que sempre dispara uma vez ao observar)
    // limpa o desenho; como a animação está sempre rodando, o próximo quadro já cobre isso
    new ResizeObserver(() => { medir(); }).observe(cv);
    // anima só quando a cena está na tela e a aba está ativa, a no máximo 30 quadros por segundo.
    // é uma cena só ilustrativa (não há texto nem controle essencial nela), por isso toca mesmo
    // com "movimento reduzido" pedido pelo navegador — sem isso, pré-visualizações embutidas que
    // forçam essa preferência (ex.: o preview do artefato) deixavam a cena parada.
    let visivel = true, rodando = false, ultimo = 0, t0 = performance.now(), parado = 0;
    function laco(now) {
      if (!visivel || document.hidden) { rodando = false; parado = now; return; }
      if (now - ultimo >= 33) { ultimo = now; quadro((now - t0) / 1000); }
      requestAnimationFrame(laco);
    }
    function iniciar() {
      if (rodando) return;
      rodando = true;
      if (parado) t0 += performance.now() - parado;   // continua de onde parou
      requestAnimationFrame(laco);
    }
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visivel = es[0].isIntersecting; if (visivel) iniciar(); }).observe(cv);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) iniciar(); });
    quadro(0);
    iniciar();
  }
  desenhaHud();
})();

/* Interações do site: menu no celular, barra de progresso, contadores, destaque nos cards e voltar ao topo. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = (k) => I18N.T(k);

  /* ---------- Menu hambúrguer ---------- */
  const nav = $('.nav-site'), dir = nav && nav.querySelector('.nav-direita');
  if (nav && dir) {
    dir.id = dir.id || 'navMenu';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'nav-toggle'; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', dir.id);
    b.innerHTML = '<span></span><span></span><span></span>';
    const rot = () => b.setAttribute('aria-label', T('nav.menu'));
    rot();
    nav.insertBefore(b, dir);
    const fechar = () => { nav.classList.remove('aberto'); b.setAttribute('aria-expanded', 'false'); };
    b.addEventListener('click', () => { const a = nav.classList.toggle('aberto'); b.setAttribute('aria-expanded', String(a)); });
    dir.querySelectorAll('a').forEach((a) => a.addEventListener('click', fechar));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('aberto')) { fechar(); b.focus(); } });
    document.addEventListener('click', (e) => { if (nav.classList.contains('aberto') && !nav.contains(e.target)) fechar(); });
    window.matchMedia('(min-width: 761px)').addEventListener('change', (m) => { if (m.matches) fechar(); });
    const selL = $('#selIdioma');
    if (selL) selL.addEventListener('change', rot);   // roda depois da troca de idioma feita acima
  }

  /* ---------- Progresso de leitura, nav compacta e voltar ao topo ---------- */
  const barra = $('.progresso span'), topo = $('#btnTopo');
  let pend = false;
  function rolagem() {
    pend = false;
    const h = document.documentElement, max = h.scrollHeight - h.clientHeight, y = h.scrollTop || document.body.scrollTop;
    if (barra) barra.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (nav) nav.classList.toggle('rolado', y > 12);
    if (topo) topo.hidden = y < 600;
  }
  window.addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(rolagem); } }, { passive: true });
  rolagem();
  if (topo) topo.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' }));

  /* ---------- Entrada escalonada: cada item de um grupo entra um pouco depois do anterior ---------- */
  document.querySelectorAll('.grade-cards, .passos, .numeros-site, .linha-tempo, .faq, .canais-grade').forEach((g) => {
    Array.from(g.querySelectorAll(':scope > .rev')).forEach((el, i) => el.style.setProperty('--d', (i * 0.08).toFixed(2) + 's'));
  });

  /* ---------- Contadores animados ---------- */
  const fmt = (n, el) => (el.dataset.sep ? Math.round(n).toLocaleString(I18N.locale()) : String(Math.round(n))) + (el.dataset.suf || '');
  function contar(el) {
    const alvo = +el.dataset.contar;
    if (reduzir) { el.textContent = fmt(alvo, el); return; }
    const t0 = performance.now(), dur = 1400;
    (function passo(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(alvo * e, el);
      if (p < 1) requestAnimationFrame(passo);
    })(t0);
  }
  const conts = document.querySelectorAll('[data-contar]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { contar(e.target); io.unobserve(e.target); } }), { threshold: 0.4 });
    conts.forEach((el) => io.observe(el));
  } else conts.forEach(contar);

  /* ---------- Luz que segue o mouse nos cards ---------- */
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.card, .canal-card, .faixa-cta').forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    // inclinação leve da cena do hero
    const cena = $('.hero-cena');
    if (cena && !reduzir) {
      cena.addEventListener('pointermove', (e) => {
        const r = cena.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        cena.style.transform = `perspective(1100px) rotateY(${x * 6}deg) rotateX(${-y * 5}deg)`;
      });
      cena.addEventListener('pointerleave', () => { cena.style.transform = ''; });
    }
  }

  /* ---------- FAQ: abre um por vez ---------- */
  const faqs = document.querySelectorAll('.faq-item');
  faqs.forEach((d) => d.addEventListener('toggle', () => { if (d.open) faqs.forEach((o) => { if (o !== d) o.open = false; }); }));
})();
