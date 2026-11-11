/* NEXORA — página: expedicao */
(function () {
  const html = `
<section id="exp" aria-label="Montagem de carga">
  <div id="stage"><button class="sidemin" id="bSideMin" aria-label="Recolher painel da expedição" aria-expanded="true" title="Recolher / abrir painel">»</button>
   <div id="cv" aria-label="Cena 3D do carregamento. Use as setas para mover o volume selecionado." tabindex="0"></div>
   <div id="tag" aria-hidden="true"></div>
   <div class="tb top">
    <div class="glass"><span class="mode-tag" id="modeTag"></span></div>
    <div class="glass" role="group" aria-label="Vistas">
     <button class="btn sm on" data-view="3d">3D</button><button class="btn sm" data-view="top">Topo</button><button class="btn sm" data-view="side">Lado</button><button class="btn sm" data-view="rear">Traseira</button><button class="btn sm" data-view="front">Frente</button><button class="btn sm" data-view="inside">Interior</button>
    </div>
    <div class="glass"><button class="btn sm" id="bDoors">Abrir portas</button><button class="btn sm" id="bWalls" title="Paredes do baú">Paredes: transparentes</button><button class="btn sm" id="bVoid" aria-pressed="false">Espaços vazios</button></div>
    <div class="glass" id="vehTabs" role="group" aria-label="Veículos"></div>
   </div>
   <div class="tb bot">
    <div class="glass" role="group" aria-label="Animação">
     <button class="btn sm" id="bPlay" aria-label="Animar carregamento">▶ <span class="lbl">Carregar</span></button>
     <button class="btn sm" id="bUnload" aria-label="Animar descarregamento">⏏ <span class="lbl">Descarregar</span></button>
     <label class="mut spd" style="font-size:12px;display:flex;align-items:center;gap:6px"><span class="lbl">Velocidade</span> <input type="range" id="speed" min="0.25" max="4" step="0.25" value="1" style="width:80px" aria-label="Velocidade da animação"><span id="spv">1×</span></label>
    </div>
    <div class="glass" role="toolbar" aria-label="Edição do volume selecionado">
     <span id="selInfo" class="selinfo" aria-live="polite">Nenhum volume selecionado</span>
     <button class="btn sm" id="bRot" title="Girar 90° (tecla R ou Shift + roda do mouse)" aria-label="Girar 90 graus">⟳ <span class="lbl">Girar</span></button>
     <button class="btn sm" id="bLay" title="Deitar (tecla D)" aria-label="Deitar">⤓ <span class="lbl">Deitar</span></button>
     <button class="btn sm" id="bOri" title="Próxima orientação (tecla O)" aria-label="Próxima orientação">⇄ <span class="lbl">Orientação</span></button>
     <button class="btn sm" id="bFocus" title="Centralizar a câmera no volume" aria-label="Centralizar câmera no volume">◎ <span class="lbl">Centralizar</span></button>
     <button class="btn sm" id="bDesel" title="Tirar seleção (Esc)" aria-label="Tirar seleção">✕</button>
     <span class="sep" aria-hidden="true"></span>
     <button class="btn sm" id="bUndo" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶ <span class="lbl">Desfazer</span></button>
     <button class="btn sm" id="bRedo" title="Refazer (Ctrl+Y)" aria-label="Refazer">↷ <span class="lbl">Refazer</span></button>
    </div>
   </div>
  </div>
  <div id="side">
   <div class="tabs" role="tablist">
    <button data-tab="rota" id="tabRota" hidden>Rota</button><button class="on" data-tab="pedido">Carga</button><button data-tab="frete" class="ronly" hidden>Frete</button><button data-tab="fim" class="ronly" hidden>Concluir</button><button data-tab="calc">Resultado</button><button data-tab="desc">Plano</button><button data-tab="cot">Cotação</button><button data-tab="exp2" title="Salvar e exportar">Salvar</button>
   </div>
   <div class="pane" id="t-rota">
    <h3 class="rh">Remetente</h3>
    <div class="grid" style="gap:8px">
     <label class="f">Nome do remetente<input id="rSender" maxlength="120" placeholder="Ex.: Sua empresa"></label>
     <label class="f">Cidade de origem<input id="rOrig" class="cityac" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" placeholder="Digite a cidade (ex.: Campinas - SP)" aria-describedby="rOrigMsg"></label>
     <small id="rOrigMsg" class="mut"></small>
    </div>
    <h3 class="rh">Entregas <small class="mut">(a ordem é a sequência de descarga)</small></h3>
    <ol id="rStops" class="rstops" aria-label="Entregas na ordem de descarga"></ol>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" id="rAdd">+ Adicionar entrega</button><button class="btn sm" id="rOpt" title="Reordena pela menor distância total a partir da origem">↯ Sugerir melhor ordem</button></div>
    <div id="rMapBox" class="rmapbox"><div id="rMap" role="img" aria-label="Mapa da rota"></div><div id="rMapNote" class="mut"></div></div>
    <div id="rSum"></div>
    <div class="wiznav"><span></span><button class="btn pri" data-wiz="pedido">Próximo: Carga →</button></div>
   </div>
   <div class="pane" id="t-frete">
    <h3 class="rh">Frete mínimo ANTT</h3>
    <div class="grid g2" style="gap:8px">
     <label class="f">Tipo de carga<select id="rTipo"></select></label>
    </div>
    <div class="f" style="margin-top:8px"><span id="rEixosLbl">Eixos (do veículo do Pedido) <button type="button" class="btn sm" id="rEixosHelp" aria-expanded="false" aria-controls="rEixosInfo" title="O que são eixos?">?</button></span>
     <div id="rEixos" aria-labelledby="rEixosLbl" aria-live="polite"></div>
     <p id="rEixosInfo" class="mut axinfo" hidden>Eixo é cada linha de rodas que encosta no chão. Conte todas as linhas de rodas do conjunto (cavalo + carreta), inclusive a dianteira e eixos suspensos. Ex.: cavalo trucado (3 eixos) + carreta de 3 eixos = 6 eixos. O número vem automático do veículo escolhido no Pedido; para mudar, use "Trocar eixos" lá. Vans e furgões até 3,5 t são veículos de pequeno porte e não entram na tabela por eixos.</p>
    </div>
    <div id="rAntt" class="card" style="padding:12px;margin-top:8px"></div>
    <h3 class="rh">Valores adicionais</h3>
    <p class="mut" style="font-size:12px;margin:0 0 6px">Chapa, ajudante, pernoite, descarga… Escolha um item rápido ou adicione o seu. Cada valor pode ser geral ou de uma entrega.</p>
    <div id="rXPre" class="xpre"></div>
    <div id="rExtras"></div>
    <div id="rTotal" class="card rtotal"></div>
    <div class="wiznav"><button class="btn" data-wiz="pedido">← Carga</button><button class="btn pri" data-wiz="fim">Próximo: Concluir →</button></div>
   </div>
   <div class="pane" id="t-fim">
    <h3 class="rh">Resumo da viagem</h3>
    <div id="rFimSum"></div>
    <h3 class="rh">O que sai em cada entrega</h3>
    <div id="rUnload"></div>
    <h3 class="rh">Finalizar</h3>
    <div class="fimgrid"><button class="btn" data-goto="calc">📊 Resultado do carregamento</button><button class="btn" data-goto="desc">📋 Plano de carga e descarga</button><button class="btn" data-goto="cot">💲 Cotação (A4)</button><button class="btn pri" data-goto="exp2">💾 Salvar / exportar</button></div>
    <div class="wiznav"><button class="btn" data-wiz="frete">← Frete</button><span></span></div>
   </div>
   <div class="pane on" id="t-pedido">
    <h3 class="step"><span>1</span>Veículo</h3>
    <label class="f"><span class="sr">Veículo principal</span><select id="selVeh" aria-label="Veículo principal"></select></label><div id="axCfgInfo"></div>
    <h3 class="step"><span>2</span>O que vai carregar</h3>
    <div class="tbl-wrap"><table id="tOrder"><thead><tr><th>Produto</th><th style="width:70px">Qtd</th><th>Encaixe</th></tr></thead><tbody></tbody></table></div>
    <div id="orderTools" style="display:flex;gap:6px;margin:8px 0 0"></div>
    <h3 class="step"><span>3</span>Montar</h3>
    <button class="btn pri big" id="bCalc" style="width:100%">Calcular carregamento</button>
    <details class="vols" id="volsBox"><summary>Volumes no veículo <span id="volsN"></span></summary>
    <input id="oFilter" placeholder="Filtrar por nome, código ou nº" aria-label="Filtrar volumes" style="width:100%;margin:6px 0">
    <div class="list" id="itemList"></div></details>
   </div>
   <div class="pane" id="t-calc"><div id="calcOut"></div></div>
   <div class="pane" id="t-desc"><div id="loadOut"></div><div id="descOut"></div></div>
   <div class="pane" id="t-cot">
    <p class="mut" style="font-size:12px;margin-top:0">Os valores de frete são digitados por você. O sistema não inventa preços.</p>
    <div class="grid" style="gap:8px">
     <label class="f">Cliente<input id="qCli" maxlength="120"></label>
     <div class="grid g2" style="gap:8px"><label class="f">Origem<input id="qOri" maxlength="120"></label><label class="f">Destino<input id="qDes" maxlength="120"></label></div>
     <div id="qFretes"></div>
     <div class="grid g2" style="gap:8px"><label class="f">Pedágio (R$)<input id="qPed" type="number" min="0" step="0.01"></label><label class="f">Outros custos (R$)<input id="qOut" type="number" min="0" step="0.01"></label></div>
     <label class="f">Observações<textarea id="qObs" rows="3" maxlength="1000"></textarea></label>
    </div>
    <div id="qTot" class="card" style="padding:12px;margin-top:10px"></div>
    <button class="btn pri" id="bQuotePrint" style="width:100%;margin-top:8px">Gerar cotação (A4)</button>
   </div>
   <div class="pane" id="t-exp2">
    <label class="f">Nome da montagem<input id="cenName" maxlength="80" placeholder="Ex.: Pedido 4512 – Cliente X"></label>
    <button class="btn pri" id="bSavePlan" style="width:100%;margin-top:8px">Salvar montagem</button>
    <p class="mut" id="saveNote" style="font-size:12px"></p>
    <hr style="border-color:var(--line)">
    <button class="btn" id="bPrint" style="width:100%">Relatório da montagem (A4)</button>
    <button class="btn" id="bCsv" style="width:100%;margin-top:8px">Baixar planilha CSV</button>
    <textarea id="csvBox" rows="8" style="width:100%;margin-top:8px;display:none" aria-label="Conteúdo CSV"></textarea>
    <button class="btn sm" id="bCsvCopy" style="display:none">Copiar CSV</button>
   </div>
  </div>
 </section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
