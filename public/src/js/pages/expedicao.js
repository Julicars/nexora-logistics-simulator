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
    <div class="glass"><button class="btn sm" id="bDoors">Abrir portas</button><button class="btn sm" id="bWalls" title="Paredes do baú">Paredes: transparentes</button><button class="btn sm" id="bVoid" aria-pressed="false">Espaços vazios</button><button class="btn sm" id="bSec" aria-pressed="false" title="Sugestões de calço, barra e cinta">Amarração</button></div>
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
    <div class="perfil" role="radiogroup" aria-label="Quem é você nesta viagem?"><span>Quem é você nesta viagem?</span>
     <button type="button" role="radio" data-perfil="trp" aria-checked="false">🚚 Transportador</button><button type="button" role="radio" data-perfil="emp" aria-checked="false">🏢 Empregador</button></div>
    <p id="pfDesc" class="mut" style="font-size:12px;margin:4px 0 0"></p>
    <h3 class="rh">Frete mínimo ANTT</h3>
    <div class="grid g2" style="gap:8px">
     <label class="f">Tipo de carga<select id="rTipo"></select></label>
     <label class="f">Contratação<select id="rTab"></select></label>
    </div>
    <p id="rTabDesc" class="mut" style="font-size:12px;margin:4px 0 0"></p>
    <div class="retv"><label class="chk"><input type="checkbox" id="rRet"> Cobrar retorno vazio</label>
     <div id="rRetBox" hidden><label class="f">Distância de volta (km)<input type="number" id="rRetKm" min="0" step="1"></label>
     <small class="mut">92% do custo por km × distância de volta (Res. ANTT 5.867/2020). Obrigatório no transporte de contêiner e em frota dedicada ou fidelizada (por exemplo, por razão sanitária).</small></div></div>
    <div class="f" style="margin-top:8px"><span id="rEixosLbl">Eixos (do veículo do Pedido) <button type="button" class="btn sm" id="rEixosHelp" aria-expanded="false" aria-controls="rEixosInfo" title="O que são eixos?">?</button></span>
     <div id="rEixos" aria-labelledby="rEixosLbl" aria-live="polite"></div>
     <p id="rEixosInfo" class="mut axinfo" hidden>Eixo é cada linha de rodas que encosta no chão. Conte todas as linhas de rodas do conjunto (cavalo + carreta), inclusive a dianteira e eixos suspensos. Ex.: cavalo trucado (3 eixos) + carreta de 3 eixos = 6 eixos. O número vem automático do veículo escolhido no Pedido; para mudar, use "Trocar eixos" lá. Vans e furgões até 3,5 t são veículos de pequeno porte e não entram na tabela por eixos.</p>
    </div>
    <div id="rAntt" class="card" style="padding:12px;margin-top:8px"></div>
    <div class="pf-trp">
    <h3 class="rh">Valores adicionais</h3>
    <p class="mut" style="font-size:12px;margin:0 0 6px">Chapa, ajudante, pernoite, descarga… Escolha um item rápido ou adicione o seu. Cada valor pode ser geral ou de uma entrega.</p>
    <div id="rXPre" class="xpre"></div>
    <div id="rExtras"></div>
    <div id="rTotal" class="card rtotal"></div>
    <h3 class="rh">CT-e: valores da prestação</h3>
    <form id="tpForm" class="rgform" novalidate>
     <div class="grid g2" style="gap:8px"><label class="f">Cliente (embarcador)<input id="tpCli" maxlength="120"></label><label class="f">Data<input id="tpDt" type="date"></label></div>
     <div class="grid g2" style="gap:8px"><label class="f">Valor da NF-e (R$)<input id="tpNf" type="number" min="0" step="0.01" inputmode="decimal"></label><label class="f">Frete cobrado (R$)<input id="tpFr" type="number" min="0" step="0.01" inputmode="decimal"></label></div>
     <p class="mut" style="font-size:12px;margin:0" id="tpAuto"></p>
     <div class="grid g2" style="gap:8px"><label class="f">Vale-pedágio (R$, pago à parte pelo contratante)<input id="tpPed" type="number" min="0" step="0.01"></label><label class="f">Ad valorem / seguro (% da NF-e)<input id="tpAdv" type="number" min="0" step="0.001"></label></div>
     <div class="grid g2" style="gap:8px"><label class="f">GRIS (% da NF-e)<input id="tpGris" type="number" min="0" step="0.001"></label><label class="f">ICMS (%)<input id="tpIcms" type="number" min="0" max="40" step="0.01"></label></div>
     <small class="mut" id="tpIcmsHint"></small>
     <div class="grid g2" style="gap:8px"><label class="f">CBS (%)<input id="tpCbs" type="number" min="0" step="0.01" value="0.9"></label><label class="f">IBS (%)<input id="tpIbs" type="number" min="0" step="0.01" value="0.1"></label></div>
     <small class="mut">2026 é ano de teste da reforma tributária: CBS 0,9% e IBS 0,1% destacados no CT-e (LC 214/2025). Ajuste se o seu caso for diferente (ex.: Simples Nacional).</small>
     <div class="grid g2" style="gap:8px"><label class="f">NF-e (número ou chave)<input id="tpNfe" maxlength="300" inputmode="numeric"></label><label class="f">CT-e (número ou chave)<input id="tpCte" maxlength="120" inputmode="numeric"></label></div>
     <label class="f">CIOT (código da operação de transporte)<input id="tpCiot" maxlength="40" inputmode="numeric" placeholder="gerado na ANTT/administradora"></label>
     <label class="f">Observações<input id="tpObs" maxlength="300"></label>
     <div id="tpSum" class="card rtotal"></div>
     <p id="tpErr" class="bad" role="alert"></p>
     <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn pri">💾 Salvar no registro do transportador</button><button type="button" class="btn" data-go="transportes">Abrir registro</button></div>
    </form>
    </div>
    <div class="pf-emp">
    <h3 class="rh">Frete contratado</h3>
    <form id="rgForm" class="rgform" novalidate>
     <div class="grid g2" style="gap:8px"><label class="f">Transportadora<input id="rgTr" maxlength="120" autocomplete="organization"></label><label class="f">Data<input id="rgDt" type="date"></label></div>
     <div class="grid g2" style="gap:8px"><label class="f">Valor do frete fechado (R$)<input id="rgVl" type="number" min="0" step="0.01" required inputmode="decimal"></label><label class="f">Valor da NF-e (R$)<input id="rgNfVal" type="number" min="0" step="0.01" inputmode="decimal"></label></div>
     <p class="mut" style="font-size:12px;margin:0" id="rgAuto"></p>
     <div><span class="mut" style="font-size:13px">Adicionais (incluídos no frete ou cobrados depois)</span><div id="rgAds"></div><button type="button" class="btn sm" id="rgAdAdd">+ Adicional</button><button type="button" class="btn sm" id="rgAdCopy" hidden>Copiar</button></div>
     <div class="grid g2" style="gap:8px"><label class="f">NF-e (número ou chave; várias separadas por vírgula)<input id="rgNfe" maxlength="300" inputmode="numeric"></label><label class="f">CT-e (número ou chave)<input id="rgCte" maxlength="120" inputmode="numeric"></label></div>
     <div class="grid g2" style="gap:8px"><label class="f">CIOT (código da operação de transporte)<input id="rgCiot" maxlength="40" inputmode="numeric"></label><label class="f">Vale-pedágio (R$, pago à parte)<input id="rgVp" type="number" min="0" step="0.01"></label></div>
     <label class="f">Observações<input id="rgObs" maxlength="300"></label>
     <div id="rgSum" class="card rtotal"></div>
     <label class="chk"><input type="checkbox" id="rgFoto" checked> Guardar uma foto do caminhão carregado (3D)</label>
     <p id="rgErr" class="bad" role="alert"></p>
     <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn pri">💾 Salvar no registro do empregador</button><button type="button" class="btn" id="rgLabels">🏷 Etiquetas</button><button type="button" class="btn" data-go="fretes">Abrir registro</button></div>
    </form>
    </div>
    <div class="wiznav"><button class="btn" data-wiz="pedido">← Carga</button><button class="btn pri" data-wiz="fim">Próximo: Concluir →</button></div>
   </div>
   <div class="pane" id="t-fim">
    <h3 class="rh">Resumo da viagem</h3>
    <div id="rFimSum"></div>
    <h3 class="rh">O que sai em cada entrega</h3>
    <div id="rUnload"></div>
    <h3 class="rh">Finalizar</h3>
    <div class="fimgrid"><button class="btn" data-goto="calc">📊 Resultado do carregamento</button><button class="btn" data-goto="desc">📋 Plano de carga e descarga</button><button class="btn" id="rDriver">🖨 Folha do motorista (por entrega)</button><button class="btn" id="rLabels">🏷 Etiquetas com QR Code</button><button class="btn" data-goto="cot">💲 Cotação (A4)</button><button class="btn pri" data-goto="exp2">💾 Salvar / exportar</button></div>
    <div class="wiznav"><button class="btn" data-wiz="frete">← Frete</button><span></span></div>
   </div>
   <div class="pane on" id="t-pedido">
    <h3 class="step"><span>1</span>Veículo</h3>
    <label class="f"><span class="sr">Veículo principal</span><select id="selVeh" aria-label="Veículo principal"></select></label><div id="axCfgInfo"></div>
    <h3 class="step"><span>2</span>O que vai carregar</h3>
    <div class="tbl-wrap"><table id="tOrder"><thead><tr><th>Produto</th><th style="width:70px">Qtd</th><th>Encaixe</th></tr></thead><tbody></tbody></table></div>
    <div id="orderTools" style="display:flex;gap:6px;margin:8px 0 0"></div>
    <h3 class="step"><span>3</span>Montar</h3>
    <button class="btn pri big" id="bCalc" style="width:100%">▶ Ver como a carga fica</button>
    <details class="vols" id="volsBox"><summary>Volumes no veículo <span id="volsN"></span></summary>
    <div class="ofil"><input id="oFilter" placeholder="Filtrar por nome, código ou nº" aria-label="Filtrar volumes"><select id="oStop" aria-label="Filtrar por entrega" class="ronly-b"></select></div>
    <div class="list" id="itemList"></div></details>
   </div>
   <div class="pane" id="t-calc"><div id="calcOut"></div><div id="perigOut"></div></div>
   <div class="pane" id="t-desc"><div id="loadOut"></div><div id="secOut"></div><div id="descOut"></div></div>
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
    <label class="f">Nome do plano de carga<input id="cenName" maxlength="80" placeholder="Ex.: Pedido 4512 – Cliente X"></label>
    <button class="btn pri" id="bSavePlan" style="width:100%;margin-top:8px">💾 Salvar plano de carga para reabrir depois</button>
    <p class="mut" id="saveNote" style="font-size:12px"></p>
    <hr style="border-color:var(--line)">
    <button class="btn" id="bPrint" style="width:100%">📄 Relatório do plano de carga (A4)</button>
    <button class="btn" id="bLabels" style="width:100%;margin-top:8px">🏷 Etiquetas dos volumes com QR Code</button>
    <button class="btn" id="bCsv" style="width:100%;margin-top:8px">Baixar planilha CSV</button>
    <textarea id="csvBox" rows="8" style="width:100%;margin-top:8px;display:none" aria-label="Conteúdo CSV"></textarea>
    <button class="btn sm" id="bCsvCopy" style="display:none">Copiar CSV</button>
   </div>
  </div>
 </section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
