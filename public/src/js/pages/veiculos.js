/* NEXORA — página: Frota, eixos e carrocerias */
(function () {
  const html = `
<section class="view" id="v-frota"><div class="wrap">
  <h1>Veículos</h1>
  <p class="mut">Medidas internas oficiais usadas nos cálculos (metros). Carga máxima vazia = vale o limite por eixo. <span id="fleetNote"></span></p>
  <div class="card tbl-wrap"><table id="tFrota"><thead><tr><th>Nome</th><th>Categoria</th><th>C (m)</th><th>L (m)</th><th>A (m)</th><th>Vagões</th><th>Eixos (configuração)</th><th>Carroceria</th><th>Carga máx. (kg)</th><th>Volume</th><th></th></tr></thead><tbody></tbody></table></div>
  <div class="card" style="margin-top:16px"><h2>Peso por eixo e PBT</h2><p class="mut" style="font-size:13px">Limites legais da Res. CONTRAN 882/2021 e, nos leves, o limite do fabricante. A tolerância de fiscalização (12,5% por eixo, 5% no PBT — Lei 14.229/2021) é mostrada só como referência: o planejamento usa o limite legal. Taras estimadas.</p><div id="axleInfo"></div></div>
  <div style="display:flex;justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px"><button class="btn" id="fAdd">Adicionar veículo</button><span><button class="btn" id="fReset">Restaurar medidas oficiais</button> <button class="btn pri" id="fSave">Salvar veículos</button></span></div>
 </div></section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
