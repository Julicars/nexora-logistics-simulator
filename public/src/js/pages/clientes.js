/* NEXORA — página: Cadastro de clientes */
(function () {
  const html = `
<section class="view" id="v-clientes"><div class="wrap">
  <div class="clhead"><div><h1 style="margin:0">Clientes</h1>
  <p class="mut" style="margin:4px 0 0">Cadastre uma vez e use na Roteirização: o endereço, a cidade e o mapa já vêm prontos. Digite o CNPJ ou o CEP que o NEXORA preenche o resto.</p></div>
  <button class="btn pri" type="button" id="clNovo">+ Novo cliente</button></div>
  <div class="clbar"><label class="sr" for="clBusca">Procurar cliente</label><input id="clBusca" type="search" placeholder="🔎 Procurar por nome, CNPJ, cidade…" autocomplete="off">
    <button class="btn sm" type="button" id="clExcel">⬇ Excel</button><label class="btn sm" for="clImp">⬆ Importar planilha</label><input type="file" id="clImp" accept=".csv,.txt" class="sr"></div>
  <form class="card clform" id="clForm" hidden novalidate aria-labelledby="clFormT">
    <h2 id="clFormT" style="margin:0 0 8px;font-size:17px">Novo cliente</h2>
    <input type="hidden" name="id">
    <div class="clgrid">
      <label class="f clwide">Nome / Razão social *<input name="nome" required maxlength="140" autocomplete="organization"></label>
      <label class="f">CNPJ ou CPF<span class="clin"><input name="doc" inputmode="numeric" maxlength="18" data-nomask="1" placeholder="Só números"><button type="button" class="btn sm" id="clCnpj" title="Buscar dados pelo CNPJ">🔎</button></span></label>
      <label class="f">Nome fantasia / apelido<input name="fantasia" maxlength="100"></label>
      <label class="f">CEP<span class="clin"><input name="cep" inputmode="numeric" maxlength="9" data-nomask="1" placeholder="00000-000"><button type="button" class="btn sm" id="clCep" title="Buscar endereço pelo CEP">📍</button></span></label>
      <label class="f clwide">Endereço<input name="logradouro" maxlength="140" autocomplete="street-address"></label>
      <label class="f">Número<input name="numero" maxlength="20"></label>
      <label class="f">Complemento<input name="complemento" maxlength="60"></label>
      <label class="f">Bairro<input name="bairro" maxlength="80"></label>
      <label class="f">Cidade - UF *<input name="cidade" class="clcity" maxlength="80" placeholder="Ex.: Campinas - SP" autocomplete="off" list="clCidades"></label>
      <label class="f">Contato<input name="contato" maxlength="80"></label>
      <label class="f">Telefone / WhatsApp<input name="telefone" inputmode="tel" maxlength="20" data-nomask="1"></label>
      <label class="f">E-mail<input name="email" type="email" maxlength="120"></label>
      <label class="f">Horário de recebimento<input name="horario" maxlength="60" placeholder="Ex.: seg a sex, 8h às 16h"></label>
      <label class="f clchk"><input type="checkbox" name="agenda"> Exige agendamento</label>
      <label class="f clchk"><input type="checkbox" name="restricao"> Restrição de veículo grande</label>
      <label class="f clwide">Observações<textarea name="obs" rows="2" maxlength="400" placeholder="Doca, portaria, documentos exigidos…"></textarea></label>
    </div>
    <p id="clMsg" class="mut" role="status" aria-live="polite" style="margin:6px 0"></p>
    <p id="clErr" class="bad" role="alert" style="margin:0"></p>
    <div class="cbacoes" style="margin-top:8px"><button class="btn pri" type="submit">Salvar cliente</button><button class="btn" type="button" id="clCancel">Cancelar</button></div>
  </form>
  <datalist id="clCidades"></datalist>
  <div id="clLista" aria-live="polite"></div>
  <p class="mut" style="font-size:12px;margin-top:12px">Os clientes ficam salvos neste navegador e, com o servidor do NEXORA, sincronizados entre os aparelhos. CNPJ: dados públicos da Receita (mesma consulta da tela de empresas). CEP: ViaCEP/BrasilAPI. Importar: arquivo CSV com colunas nome; cnpj; cep; numero; contato; telefone; email (cabeçalho na primeira linha).</p>
</div></section>`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
