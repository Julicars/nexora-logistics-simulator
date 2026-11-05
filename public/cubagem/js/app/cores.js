/* Acessibilidade: modos de cor para daltonismo (protanopia/deuteranopia e tritanopia) e números nos produtos.
 * As paletas trocam o conteúdo de CORES (nucleo.js) e as variáveis CSS de status. Depende dos módulos anteriores. */
'use strict';

(function () {
  const D = {
    'pt-BR': { 'tab.access': 'Acessibilidade', 'cb.title': 'Modo de cores (daltonismo)',
      'cb.note': 'Troca as cores dos produtos, dos avisos e das barras por paletas que podem ser diferenciadas por quem tem daltonismo. Fica salvo neste navegador.',
      'cb.normal': 'Padrão', 'cb.normal.d': 'Cores originais da NEXORA',
      'cb.deut': 'Deuteranopia / Protanopia', 'cb.deut.d': 'Dificuldade com verde e vermelho (o tipo mais comum)',
      'cb.trit': 'Tritanopia', 'cb.trit.d': 'Dificuldade com azul e amarelo',
      'cb.mono': 'Alto contraste', 'cb.mono.d': 'Cores muito diferentes em brilho; ajuda também na impressão em preto e branco',
      'cb.numbers': 'Mostrar o número do produto nas listas e na etiqueta 3D (não depender só da cor)', 'cb.applied': 'Modo de cores aplicado: {m}' },
    en: { 'tab.access': 'Accessibility', 'cb.title': 'Color mode (color blindness)',
      'cb.note': 'Replaces product, warning and bar colors with palettes that people with color blindness can tell apart. Saved in this browser.',
      'cb.normal': 'Default', 'cb.normal.d': 'Original NEXORA colors',
      'cb.deut': 'Deuteranopia / Protanopia', 'cb.deut.d': 'Trouble with green and red (most common type)',
      'cb.trit': 'Tritanopia', 'cb.trit.d': 'Trouble with blue and yellow',
      'cb.mono': 'High contrast', 'cb.mono.d': 'Colors with very different brightness; also helps black-and-white printing',
      'cb.numbers': 'Show the product number in lists and on the 3D label (don’t rely on color alone)', 'cb.applied': 'Color mode applied: {m}' },
    es: { 'tab.access': 'Accesibilidad', 'cb.title': 'Modo de color (daltonismo)',
      'cb.note': 'Cambia los colores de productos, avisos y barras por paletas que las personas con daltonismo pueden distinguir. Se guarda en este navegador.',
      'cb.normal': 'Predeterminado', 'cb.normal.d': 'Colores originales de NEXORA',
      'cb.deut': 'Deuteranopía / Protanopía', 'cb.deut.d': 'Dificultad con verde y rojo (el tipo más común)',
      'cb.trit': 'Tritanopía', 'cb.trit.d': 'Dificultad con azul y amarillo',
      'cb.mono': 'Alto contraste', 'cb.mono.d': 'Colores con brillo muy distinto; también ayuda al imprimir en blanco y negro',
      'cb.numbers': 'Mostrar el número del producto en las listas y en la etiqueta 3D (no depender solo del color)', 'cb.applied': 'Modo de color aplicado: {m}' },
    fr: { 'tab.access': 'Accessibilité', 'cb.title': 'Mode couleurs (daltonisme)',
      'cb.note': 'Remplace les couleurs des produits, alertes et barres par des palettes distinguables par les personnes daltoniennes. Enregistré dans ce navigateur.',
      'cb.normal': 'Par défaut', 'cb.normal.d': 'Couleurs NEXORA d’origine',
      'cb.deut': 'Deutéranopie / Protanopie', 'cb.deut.d': 'Difficulté avec le vert et le rouge (type le plus courant)',
      'cb.trit': 'Tritanopie', 'cb.trit.d': 'Difficulté avec le bleu et le jaune',
      'cb.mono': 'Contraste élevé', 'cb.mono.d': 'Couleurs de luminosité très différente ; aide aussi à l’impression en noir et blanc',
      'cb.numbers': 'Afficher le numéro du produit dans les listes et sur l’étiquette 3D (ne pas dépendre de la couleur seule)', 'cb.applied': 'Mode couleurs appliqué : {m}' },
  };
  Object.keys(D).forEach((l) => I18N.extend(l, D[l]));
})();

// Paletas: Okabe-Ito (deuteranopia/protanopia), Paul Tol adaptada (tritanopia), contraste por luminância
const PALETAS = {
  normal: CORES.slice(),
  deut: ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#bbbbbb', '#882255', '#44aa99'],
  trit: ['#ee3377', '#0077bb', '#ee7733', '#33bbee', '#cc3311', '#009988', '#bbbbbb', '#aa4499', '#e6e6e6', '#882255'],
  mono: ['#ffd23f', '#3b82f6', '#ffffff', '#b45309', '#a3e635', '#7c3aed', '#94a3b8', '#f472b6', '#14b8a6', '#525c6b'],
};
const MODOS_COR = ['normal', 'deut', 'trit', 'mono'];
const CHAVE_CORES = 'simulador3d.cores.v1';
let modoCor = 'normal', cbNumeros = false;
(function () {
  const s = lerLocal(CHAVE_CORES);
  if (s && MODOS_COR.includes(s.modo)) modoCor = s.modo;
  if (s && s.numeros === true) cbNumeros = true;
})();

function numerarPontos() {
  ['#listaPedidos', '#listaPorProduto'].forEach((sel) => {
    Array.from($(sel).children).forEach((li, i) => {
      const pt = li.querySelector('.ponto');
      if (pt) pt.textContent = cbNumeros ? String(i + 1) : '';
    });
  });
}

function aplicarModoCor(avisar) {
  CORES.splice(0, CORES.length, ...PALETAS[modoCor]);
  MODOS_COR.forEach((m) => document.body.classList.toggle('cb-' + m, m === modoCor && m !== 'normal'));
  document.body.classList.toggle('cb-numeros', cbNumeros);
  gravarLocal(CHAVE_CORES, { modo: modoCor, numeros: cbNumeros });
  if (st.res) {
    colorirVolumes();
    renderPedidos();
    renderResultados();
    if (typeof construirExtras3D === 'function') construirExtras3D();
  }
  numerarPontos();
  renderOpcoesCor();
  if (avisar) sucesso(T('cb.applied', { m: T('cb.' + modoCor) }));
}

function renderOpcoesCor() {
  const box = $('#opcoesCor');
  box.innerHTML = MODOS_COR.map((m) =>
    `<button type="button" role="radio" class="opcao-cor" data-modo="${m}" aria-checked="${m === modoCor}">` +
    `<span class="amostras">${PALETAS[m].slice(0, 6).map((c) => `<i style="background:${c}"></i>`).join('')}</span>` +
    `<b>${T('cb.' + m)}</b><small>${T('cb.' + m + '.d')}</small></button>`).join('');
  $('#chkNumeros').checked = cbNumeros;
}
$('#opcoesCor').addEventListener('click', (e) => {
  const b = e.target.closest('[data-modo]');
  if (!b || b.dataset.modo === modoCor) return;
  modoCor = b.dataset.modo;
  aplicarModoCor(true);
});
$('#opcoesCor').addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const k = MODOS_COR.indexOf(modoCor), d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
  modoCor = MODOS_COR[(k + d + MODOS_COR.length) % MODOS_COR.length];
  aplicarModoCor(false);
  $(`#opcoesCor [data-modo="${modoCor}"]`).focus();
});
$('#chkNumeros').addEventListener('change', (e) => { cbNumeros = e.target.checked; aplicarModoCor(false); });

(function () {
  const rp = renderPedidos;
  renderPedidos = function () { rp(); numerarPontos(); };
  const rr = renderResultados;
  renderResultados = function () { rr(); numerarPontos(); };
})();

// aplica antes da primeira simulação (app.js roda depois deste arquivo)
CORES.splice(0, CORES.length, ...PALETAS[modoCor]);
MODOS_COR.forEach((m) => document.body.classList.toggle('cb-' + m, m === modoCor && m !== 'normal'));
document.body.classList.toggle('cb-numeros', cbNumeros);
renderOpcoesCor();
