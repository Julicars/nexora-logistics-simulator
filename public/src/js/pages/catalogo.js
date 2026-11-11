/* NEXORA — página: Mostrar Catálogo (expedição) */
(function () {
  const html = `
<section class="view" id="v-catalogo"><div class="wrap">
  <div class="mode-head"><span class="mode-tag cat">Mostrar Catálogo</span><span class="mut">Somente produtos cadastrados. Medidas, pesos e fotos vêm do cadastro.</span></div>
  <div class="card cat-bar">
   <input id="ctFilter" placeholder="🔍 Pesquisar por nome ou código" aria-label="Pesquisar no catálogo" style="flex:1;min-width:200px">
   <select id="ctType" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option></select>
   <label class="f ctveh" style="flex-direction:row;align-items:center;gap:6px;min-width:0;max-width:100%">Veículo <select id="ctVeh" style="min-width:0;flex:1" aria-label="Veículo principal"></select></label>
   <button class="btn pri" id="ctGo" disabled>Montar carga</button>
  </div>
  <p id="ctSum" class="mut" style="margin:8px 2px"></p>
  <div id="ctGrid" class="cat-grid"></div>
 </div></section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
