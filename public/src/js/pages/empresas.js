/* NEXORA — página: Consulta de empresas (CNPJ ou nome) */
(function () {
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  const html = `
<section class="view" id="v-empresas"><div class="wrap">
  <h1 style="margin:0">Consulta de empresas e sócios</h1>
  <p class="mut" style="margin:4px 0 14px">Busque uma empresa pelo CNPJ ou nome — ou uma pessoa, para ver em quais empresas ela é sócia ou administradora. Dados públicos da Receita Federal e de cadastros oficiais.</p>
  <form class="card eform" id="eForm" role="search" aria-label="Consultar empresa ou pessoa">
    <fieldset class="etipo"><legend class="sr">O que procurar</legend><label><input type="radio" name="eTipo" value="emp" checked> 🏢 Empresa</label><label><input type="radio" name="eTipo" value="pes"> 👤 Pessoa (sócio)</label></fieldset>
    <label class="f eq"><span id="eQLbl">CNPJ ou nome da empresa</span><input id="eQ" autocomplete="off" maxlength="80" placeholder="00.000.000/0000-00 ou parte do nome" aria-describedby="eHint"></label>
    <label class="f ecpf" hidden>CPF <small class="mut">(opcional — separa homônimos)</small><input id="eCpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" data-nomask="1"></label>
    <label class="f euf">UF <small class="mut">(opcional)</small><select id="eUf" aria-label="Estado para busca por nome e para a rede de sócios"><option value="">Todas</option>${UFS.map(u => `<option>${u}</option>`).join('')}</select></label>
    <div class="ebtns"><button type="submit" class="btn" data-modo="simples" id="eSimples">🔎 Consulta simples</button><button type="button" class="btn pri" data-modo="completa" id="eCompleta">🧾 Consulta completa</button><button type="submit" class="btn pri" id="ePessoa" hidden>👤 Buscar empresas da pessoa</button></div>
    <small class="mut" id="eHint">Simples: o básico do cadastro. Completa: tudo + sócios, CNAEs, Simples/MEI, inscrição estadual e o diagrama das empresas ligadas aos mesmos sócios.</small>
    <p id="eErr" class="bad" role="alert" style="margin:0"></p>
  </form>
  <p id="eMode" class="fmode" role="status" hidden></p>
  <div id="eList" aria-live="polite"></div>
  <div id="eOut" aria-live="polite"></div>
  <details class="card elistas"><summary><b>📋 Listas oficiais</b> <small class="mut">— lista suja do trabalho escravo (MTE)</small></summary>
    <p style="font-size:14px">O Ministério do Trabalho publica o <b>Cadastro de Empregadores</b> (a “lista suja”) duas vezes por ano, em abril e outubro, e o endereço do arquivo muda a cada edição. Baixe a planilha no <a href="https://www.gov.br/trabalho-e-emprego/pt-br" target="_blank" rel="noopener">site do Ministério do Trabalho ↗</a> (procure “Cadastro de Empregadores”), salve como CSV e carregue aqui. A consulta completa passa a conferir a empresa e os sócios.</p>
    <label class="btn sm" style="cursor:pointer">📂 Carregar planilha (CSV)<input type="file" id="eListaArq" accept=".csv,text/csv,.txt" hidden></label> <span id="eListaSt" role="status"></span>
    <p class="mut" style="font-size:12px;margin:8px 0 0">Sanções internacionais (OFAC/EUA e ONU) são baixadas automaticamente uma vez por dia quando o NEXORA roda no computador (npm start).</p></details>
  <div class="card" id="eHistBox" hidden><h2 style="margin:0 0 8px;font-size:16px">Consultas recentes</h2><div id="eHist" class="ehist"></div></div>
  <p class="mut" style="font-size:12px;margin-top:14px">Pessoas: só aparecem os vínculos societários públicos (empresa, cargo, data de entrada e faixa etária, com CPF mascarado pela Receita) — o NEXORA não busca endereço, telefone ou outros dados pessoais. Fontes: minhareceita.org e BrasilAPI (base aberta de CNPJ da Receita Federal), OpenCNPJ, CNPJ.ws (3 consultas/min), CNPJá (API pública: 5 consultas/min) e Casa dos Dados (busca por nome e por sócio, até 20 resultados), GLEIF (registro global LEI) e Portal da Transparência/CGU (sanções e contratos federais, com chave gratuita). O CPF dos sócios já vem mascarado pela Receita. Use para conferir clientes, fornecedores e transportadoras (LGPD: dados públicos, finalidade de verificação cadastral).</p>
</div></section>`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
