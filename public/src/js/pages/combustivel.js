/* NEXORA — página: Combustíveis & Abastecimento (preços oficiais da ANP) */
(function () {
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  const html = `
<section class="view" id="v-combustivel"><div class="wrap">
  <h1 style="margin:0">Combustíveis &amp; Abastecimento</h1>
  <p class="mut" style="margin:4px 0 12px">Preço do diesel S-10 e S-500, gasolina comum e aditivada, etanol e GNV por posto, cidade, estado e Brasil — dados oficiais e gratuitos da ANP (Levantamento de Preços de Combustíveis), baixados e atualizados automaticamente pelo servidor do NEXORA.</p>
  <div class="card cbstatus" id="cbStatus" role="status" aria-live="polite">Carregando…</div>
  <div class="cbabas" role="tablist" aria-label="Combustível">
    <button type="button" role="tab" data-grupo="diesel" aria-selected="true">🚛 Diesel</button><button type="button" role="tab" data-grupo="gasolina" aria-selected="false">⛽ Gasolina</button><button type="button" role="tab" data-grupo="etanol" aria-selected="false">🌱 Etanol</button><button type="button" role="tab" data-grupo="gnv" aria-selected="false">🔵 GNV</button>
  </div>
  <section class="card cbmerc" id="cbMerc" aria-labelledby="cbMercT">
    <div class="cbhd"><h2 id="cbMercT">🌎 Mercado: dólar, petróleo e Petrobras</h2><span class="cbacoes"><span class="mut" id="cbMercEm"></span><button class="btn sm" type="button" id="cbMercAt">⟳ Atualizar</button></span></div>
    <div id="cbAlertas" role="status" aria-live="polite"></div>
    <div class="cbcards" id="cbMercCards"></div>
    <div class="cbgrid" style="margin:0">
      <div><div class="cbhd"><h3 class="cbh3">Quem puxa quem <small class="mut">(índice: início do período = 100)</small></h3><select id="cbMercPer" aria-label="Período"><option value="90">3 meses</option><option value="180" selected>6 meses</option><option value="365">12 meses</option></select></div><div id="cbMercGraf" class="cbhist"></div></div>
      <div><h3 class="cbh3">De onde vem o preço do litro do diesel (S-10, média Brasil)</h3><div id="cbComp"></div>
        <div id="cbPetroPend" aria-live="polite"></div>
        <details class="cbpetro" id="cbPetroBox"><summary>🤖 Preço Petrobras às distribuidoras <span class="cbauto">AUTOMÁTICO</span></summary>
          <div class="cbpetroajuda">
            <p style="margin:0 0 6px"><b>Como é atualizado:</b> o servidor lê todo dia os comunicados da <a href="https://agencia.petrobras.com.br/" target="_blank" rel="noopener">Agência Petrobras</a> (de hora em hora quando o petróleo ou o dólar disparam) e confere toda semana com a Síntese de Preços da ANP. Se o valor passar nas conferências, entra sozinho; se algo parecer estranho, aparece acima para você confirmar.</p>
            <div id="cbFontes" class="cbfontes"></div>
            <p class="mut" style="margin:6px 0 0;font-size:12px"><b>Reserva manual:</b> se as fontes falharem, cadastre abaixo o <b>preço médio do diesel A</b> (sem impostos) do comunicado — <a href="https://agencia.petrobras.com.br/" target="_blank" rel="noopener">Agência Petrobras</a> ou <a href="https://precos.petrobras.com.br" target="_blank" rel="noopener">precos.petrobras.com.br</a>.</p>
            <button class="btn sm" type="button" id="cbPetroVer" style="margin-top:6px">🔎 Verificar comunicados agora</button>
          </div>
          <form id="cbPetroF" class="cbcalc"><label class="f">A partir de<input type="date" id="cbPetroD" required></label><label class="f">Diesel A (R$/L)<input id="cbPetroP" inputmode="decimal" placeholder="3,30" required></label><label class="f" style="grid-column:1/-1">Observação<input id="cbPetroO" maxlength="200" placeholder="ex.: comunicado da Petrobras de dd/mm"></label><button class="btn pri" type="submit">Salvar</button></form>
          <div id="cbPetroL"></div>

        </details>
      </div>
    </div>
    <p class="mut" style="font-size:12px;margin:8px 0 0">Dólar: PTAX do Banco Central (oficial, 1 vez por dia útil). Brent: série diária da EIA via FRED (gratuita, chega com alguns dias de atraso — não é cotação ao vivo). 1 barril = 158,99 litros.</p>
  </section>
  <div id="cbVazio" class="card" hidden>
    <h2 style="margin:0 0 6px;font-size:16px">Sem dados ainda</h2>
    <p id="cbVazioTx" class="mut" style="margin:0 0 10px"></p>
    <div class="cbacoes"><button class="btn pri" id="cbAtualizar2" type="button">⟳ Buscar na ANP agora</button>
    <label class="btn" for="cbArq2">⬆ Importar planilha da ANP (.xlsx)</label><input type="file" id="cbArq2" accept=".xlsx" class="sr"></div>
    <p class="mut" style="font-size:12px;margin:8px 0 0">Planilha: ANP → Preços → <a href="https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas" target="_blank" rel="noopener">Levantamento de Preços (últimas semanas)</a> → “Preços por posto revendedor”.</p>
  </div>
  <div id="cbConteudo" hidden>
    <div class="cbcards" id="cbCards"></div>
    <div class="cbgrid">
      <div class="card"><div class="cbhd"><h2>Evolução semanal dos preços médios</h2><select id="cbHistUf" aria-label="Recorte do gráfico"><option value="">Brasil</option>${UFS.map(u => `<option>${u}</option>`).join('')}</select></div><div id="cbHist" class="cbhist"></div></div>
      <div class="card"><div class="cbhd"><h2>Por estado</h2><select id="cbUfProd" aria-label="Produto">${[['s10','Diesel S-10'],['s500','Diesel S-500 (comum)'],['gas','Gasolina comum'],['gasad','Gasolina aditivada'],['etanol','Etanol'],['gnv','GNV']].map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></div><div id="cbUfs" class="cbufs"></div></div>
    </div>
    <div class="cbgrid">
      <div class="card"><h2>🟢 Cidades mais baratas <small class="mut" id="cbCidProdTx"></small></h2><div id="cbBaratas"></div></div>
      <div class="card"><h2>🔴 Cidades mais caras <small class="mut" id="cbCarasTx"></small></h2><div id="cbCaras"></div></div>
    </div>
    <div class="card">
      <div class="cbhd"><h2>Postos pesquisados</h2><span class="mut" id="cbPostosTx"></span></div>
      <form id="cbFiltro" class="cbfiltro" role="search" aria-label="Filtrar postos">
        <label class="f">Produto<select id="cbProd">${[['s10','Diesel S-10'],['s500','Diesel S-500 (comum)'],['gas','Gasolina comum'],['gasad','Gasolina aditivada'],['etanol','Etanol'],['gnv','GNV']].map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
        <label class="f">UF<select id="cbUf"><option value="">Todas</option>${UFS.map(u => `<option>${u}</option>`).join('')}</select></label>
        <label class="f">Cidade<select id="cbMun"><option value="">Todas</option></select></label>
        <label class="f">Ordem<select id="cbOrdem"><option value="barato">Mais barato</option><option value="caro">Mais caro</option><option value="var">Maior alta na semana</option><option value="nome">Nome</option></select></label>
        <label class="f cbbusca">Busca<input id="cbBusca" placeholder="posto, bandeira, rua…" autocomplete="off" maxlength="60"></label>
        <div class="cbacoes"><button class="btn" type="button" id="cbMapaBt" aria-pressed="false">🗺 Mapa</button><button class="btn" type="button" id="cbExcel">⬇ Excel</button></div>
      </form>
      <div id="cbMapa" class="cbmapa" hidden></div>
      <div id="cbPostos" class="cbpostos"></div>
    </div>
    <div class="cbgrid">
      <div class="card"><h2>📈 Mudanças de preço na semana</h2><p class="mut" id="cbMudTx" style="margin:0 0 8px"></p><div id="cbMud"></div></div>
      <div class="card"><h2>🧮 Custo de combustível da viagem</h2>
        <form id="cbCalc" class="cbcalc">
          <label class="f">Distância (km)<input id="ccKm" inputmode="decimal" value="500"></label>
          <label class="f">Consumo (km/L)<input id="ccCons" inputmode="decimal" value="2,8"></label>
          <label class="f">Preço do litro (R$)<input id="ccPreco" inputmode="decimal"></label>
          <label class="f">Combustível<select id="ccProd">${[['s10','Diesel S-10'],['s500','Diesel S-500 (comum)'],['gas','Gasolina comum'],['gasad','Gasolina aditivada'],['etanol','Etanol'],['gnv','GNV']].map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
          <label class="f">Preço de<select id="ccRef"><option value="br">Média Brasil</option>${UFS.map(u => `<option value="${u}">Média ${u}</option>`).join('')}<option value="man">Digitar</option></select></label>
          <label class="f cbarla">ARLA 32 (% do diesel; 0 se não usa)<input id="ccArla" inputmode="decimal" value="5"></label>
          <label class="f cbarla">Preço ARLA (R$/L)<input id="ccArlaP" inputmode="decimal" value="3,90"></label>
          <label class="f">Ida e volta<select id="ccIv"><option value="1">Só ida</option><option value="2">Ida e volta</option></select></label>
        </form>
        <div id="ccOut" class="cbcalcout" aria-live="polite"></div>
        <button class="btn sm" type="button" id="ccRota">Usar distância da última rota</button>
      </div>
    </div>
    <div class="cbacoes" style="margin-top:6px"><button class="btn" id="cbAtualizar" type="button">⟳ Verificar nova semana na ANP</button><label class="btn" for="cbArq">⬆ Importar planilha (.xlsx)</label><input type="file" id="cbArq" accept=".xlsx" class="sr"></div>
  </div>
  <p class="mut" style="font-size:12px;margin-top:14px"><b>Sobre os dados:</b> a ANP pesquisa toda semana (domingo a sábado) uma <b>amostra</b> de postos em ~400 municípios e publica na sexta ou segunda — não é preço em tempo real nem cobre todos os postos. O servidor confere a página da ANP ao iniciar e a cada 6 horas e só baixa semanas novas; cada semana fica guardada e forma o histórico. Coordenadas no mapa: API Revendedores (cadastro oficial da ANP); sem elas, o posto aparece no centro da cidade. Fonte: ANP — dados abertos, uso livre com citação.</p>
</div></section>`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
