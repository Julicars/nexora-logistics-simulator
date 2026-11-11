/* NEXORA — página: Janelas (editor de carga, eixos, veículo extra, impressão) e avisos */
(function () {
  const html = `
<!-- MODAL: Montagem Rápida (dados manuais) -->
<div class="modal" id="mOrder" role="dialog" aria-modal="true" aria-labelledby="moT"><div class="card">
 <div class="mh"><h2 id="moT">Montagem Rápida · carga manual</h2><button class="btn sm" id="moX" aria-label="Fechar" style="background:none;border:0">✕</button></div>
 <div class="mb">
  <div class="edmode" role="radiogroup" aria-label="Quantidade de campos"><button type="button" role="radio" data-ed="simple">Simples</button><button type="button" role="radio" data-ed="full">Completo</button><small class="mut" id="edHint"></small></div>
  <p class="hint adv-only">Medidas do volume em metros (C comprimento, L largura, A altura). Para bobina, C = diâmetro e A = largura da bobina. O peso pode ser digitado por peça ou por volume. Em "Aguenta em cima", vazio = sem limite e 0 = não empilhar. <b>Nada aqui é salvo no cadastro de produtos.</b></p>
  <input id="moF" placeholder="🔍 Filtrar por nome ou código" aria-label="Filtrar linhas" style="width:260px;margin-bottom:8px">
  <div class="qt"><table><thead><tr>
   <th>Código</th><th>Descrição</th><th>Tipo</th>
   <th class="grp"><small>Dimensões (m)</small>C / Ø</th><th>L</th><th>A</th>
   <th class="grp">Qtd</th>
   <th class="grp"><small>Peso</small>Peças/vol</th><th>kg/peça</th><th>kg/vol</th>
   <th class="grp"><small>Configuração</small>Posição</th><th>Níveis</th><th>Aguenta em cima (kg)</th><th>Manuseio</th>
   <th class="grp moStop" hidden>Entrega</th><th class="grp">Encaixe</th><th></th></tr></thead><tbody id="moRows"></tbody></table></div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn pri" id="moAdd">+ Adicionar item</button><button class="btn" id="moReset">Limpar tudo</button></div>
  <p id="moTot" style="font-size:13px;margin:12px 0 4px"></p>
  <p id="moMsg" class="warn" style="font-size:13px;margin:4px 0" role="alert"></p>
 </div>
 <div class="mf"><button class="btn" id="moCancel">Cancelar</button><button class="btn pri" id="moApply">Aplicar e simular</button></div>
</div></div>

<div class="modal" id="mAx" role="dialog" aria-modal="true" aria-labelledby="maxT"><div class="card" style="max-width:860px">
 <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 id="maxT" style="font-family:Barlow,system-ui,sans-serif;font-size:18px;font-weight:800;margin:0"></h2><button class="btn sm" id="maxX" aria-label="Fechar">✕</button></div>
 <p class="mut" style="font-size:12.5px;margin:4px 0 10px">Escolha como este veículo roda. O peso por eixo, a carga útil e o desenho 3D seguem a configuração (Res. CONTRAN 882/2021).</p>
 <div id="maxGrid" class="axgrid"></div>
</div></div>
<div class="modal" id="mExtra" role="dialog" aria-modal="true" aria-labelledby="mxT"><div class="card" style="max-width:460px">
 <h2 id="mxT" style="font-family:Barlow,system-ui,sans-serif;font-size:18px;font-weight:800">Adicionar veículo extra?</h2>
 <p id="mxMsg" style="margin:6px 0 12px"></p>
 <label class="f">Veículo extra<select id="mxVeh"></select></label>
 <p id="mxFit" class="mut" style="font-size:12.5px;margin:6px 0 0"></p>
 <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap"><button class="btn" id="mxNo">Não, deixar sobrando</button><button class="btn pri" id="mxYes">Adicionar veículo</button></div>
</div></div>
<div class="modal" id="mPrint" role="dialog" aria-modal="true" aria-label="Prévia de impressão"><div class="card" style="background:#fff;color:#111"><div id="printPrev"></div><div style="margin-top:12px;display:flex;gap:8px"><button class="btn pri" id="bDoPrint">Imprimir</button><button class="btn" id="bClosePrint" style="color:#fff">Fechar</button></div></div></div>
<div id="printArea"></div>
<div id="toast" aria-live="polite"></div>
<div id="live" class="sr" aria-live="assertive"></div>
`;
  document.body.insertAdjacentHTML('beforeend', html);
})();
