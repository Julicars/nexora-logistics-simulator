/* NEXORA — página: Consulta de empresas (CNPJ ou nome) */
(function () {
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  const html = `
<section class="view" id="v-empresas"><div class="wrap">
  <h1 style="margin:0">Consulta de empresas</h1>
  <p class="mut" style="margin:4px 0 14px">Busque pelo CNPJ ou pelo nome. Dados públicos da Receita Federal (base aberta), com Simples/MEI, inscrição estadual e rede de sócios na consulta completa.</p>
  <form class="card eform" id="eForm" role="search" aria-label="Consultar empresa">
    <label class="f eq">CNPJ ou nome da empresa<input id="eQ" autocomplete="off" maxlength="80" placeholder="00.000.000/0000-00 ou parte do nome" aria-describedby="eHint"></label>
    <label class="f euf">UF <small class="mut">(opcional)</small><select id="eUf" aria-label="Estado para busca por nome e para a rede de sócios"><option value="">Todas</option>${UFS.map(u => `<option>${u}</option>`).join('')}</select></label>
    <div class="ebtns"><button type="submit" class="btn" data-modo="simples" id="eSimples">🔎 Consulta simples</button><button type="button" class="btn pri" data-modo="completa" id="eCompleta">🧾 Consulta completa</button></div>
    <small class="mut" id="eHint">Simples: o básico do cadastro. Completa: tudo + sócios, CNAEs, Simples/MEI, inscrição estadual e o diagrama das empresas ligadas aos mesmos sócios.</small>
    <p id="eErr" class="bad" role="alert" style="margin:0"></p>
  </form>
  <p id="eMode" class="fmode" role="status" hidden></p>
  <div id="eList" aria-live="polite"></div>
  <div id="eOut" aria-live="polite"></div>
  <div class="card" id="eHistBox" hidden><h2 style="margin:0 0 8px;font-size:16px">Consultas recentes</h2><div id="eHist" class="ehist"></div></div>
  <p class="mut" style="font-size:12px;margin-top:14px">Fontes: minhareceita.org e BrasilAPI (base aberta de CNPJ da Receita Federal), OpenCNPJ, CNPJ.ws (3 consultas/min), CNPJá (API pública: 5 consultas/min) e Casa dos Dados (busca por nome, até 20 resultados). O CPF dos sócios já vem mascarado pela Receita. Use para conferir clientes, fornecedores e transportadoras (LGPD: dados públicos, finalidade de verificação cadastral).</p>
</div></section>`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
