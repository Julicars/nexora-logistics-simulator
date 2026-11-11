/* NEXORA — página: Montagens salvas */
(function () {
  const html = `
<section class="view" id="v-montagens"><div class="wrap">
  <h1>Montagens salvas</h1>
  <p class="mut" id="mgNote"></p>
  <div class="card tbl-wrap"><table id="tPlans"><thead><tr><th><span class="sr">Comparar</span></th><th>Nome</th><th>Origem</th><th>Veículo</th><th>Veículos</th><th>Volumes</th><th>Peso</th><th>Ocupação</th><th>Data</th><th></th></tr></thead><tbody></tbody></table></div>
  <div id="cmpOut" style="margin-top:16px"></div>
 </div></section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
