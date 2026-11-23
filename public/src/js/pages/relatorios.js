/* NEXORA — página: Relatórios */
(function () {
  document.getElementById('main').insertAdjacentHTML('beforeend', `
<section class="view" id="v-relatorios"><div class="wrap">
  <div class="clhead"><div><h1 style="margin:0">Relatórios</h1><p class="mut" style="margin:4px 0 0">Resumo dos fretes registrados, custo por km, destinos e clientes que mais aparecem, entregas pelo motorista e o diesel no período.</p></div>
  <div class="cbacoes"><label class="f">Registros<select id="rlFonte"><option value="fretes">Empregador (fretes contratados)</option><option value="transportes">Transportador (fretes realizados)</option></select></label><label class="f">Período<select id="rlPer"><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option><option value="12" selected>Últimos 12 meses</option><option value="0">Tudo</option></select></label><button class="btn" type="button" id="rlExcel">⬇ Excel</button></div></div>
  <div id="rlKpis" class="cbcards" aria-live="polite"></div>
  <div class="cbgrid"><div class="card"><h2 style="margin:0 0 8px;font-size:16px">Frete por mês</h2><div id="rlMes" class="cbhist"></div></div><div class="card"><h2 style="margin:0 0 8px;font-size:16px">R$/km × diesel S-10</h2><div id="rlKm" class="cbhist"></div></div></div>
  <div class="cbgrid"><div class="card"><h2 style="margin:0 0 8px;font-size:16px">Destinos mais frequentes</h2><div id="rlDest"></div></div><div class="card"><h2 style="margin:0 0 8px;font-size:16px" id="rlQuemT">Transportadoras</h2><div id="rlQuem"></div></div></div>
  <div class="card"><h2 style="margin:0 0 8px;font-size:16px">Entregas pelo link do motorista</h2><div id="rlVg"></div></div>
</div></section>`);
})();
