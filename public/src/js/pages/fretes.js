/* NEXORA — páginas: Registro do empregador (fretes contratados) e Registro do transportador */
(function () {
  const page = (id, p, titulo, sub, vazio) => `
<section class="view" id="v-${id}"><div class="wrap">
  <div class="fhead"><div><h1 style="margin:0">${titulo}</h1><p class="mut" style="margin:4px 0 0">${sub} Duplo clique (ou Enter) numa célula para editar. Tudo fica salvo em JSON e pode ser baixado em Excel.</p></div>
   <div class="factions"><input id="${p}Search" type="search" placeholder="Buscar (cliente, cidade, NF-e…)" aria-label="Buscar no registro"><button class="btn" id="${p}Add">+ Linha em branco</button></div></div>
  <p id="${p}Mode" class="fmode" role="status" hidden></p>
  <div class="rgtools"><button class="btn pri" id="${p}Xlsx">⬇ Excel (.xlsx)</button><button class="btn" id="${p}Csv">⬇ CSV</button><button class="btn" id="${p}Json">⬇ JSON</button><label class="btn" for="${p}JsonIn" tabindex="0" id="${p}JsonInLbl">⬆ Importar JSON</label><input type="file" id="${p}JsonIn" accept=".json,application/json" class="sr"><span id="${p}Sum" class="mut" aria-live="polite"></span></div>
  <div class="rghint"><span>↔ A planilha tem mais colunas: use as setas, a barra laranja abaixo da tabela, Shift + roda do mouse ou arraste no celular.</span><span class="rgnav"><button type="button" class="btn sm" data-rgscroll="-1" aria-label="Rolar a planilha para a esquerda">◀</button><button type="button" class="btn sm" data-rgscroll="1" aria-label="Rolar a planilha para a direita">▶</button></span></div><div class="card rgwrap"><div class="tbl-wrap" tabindex="0" role="region" aria-label="Planilha (role para os lados para ver todas as colunas)"><table class="rgtbl" id="${p}Tbl" data-vazio="${vazio}"><thead></thead><tbody></tbody><tfoot></tfoot></table></div></div>
  <p class="mut" style="font-size:12px">NF-e e CT-e: informe o número ou a chave de acesso de 44 dígitos (a chave é conferida pelo dígito verificador). Separe várias NF-e por vírgula.</p>
</div></section>`;
  document.getElementById('main').insertAdjacentHTML('beforeend',
    page('fretes', 'rg', 'Registro do empregador', 'Fretes que você contratou: frete fechado, valor da NF-e, % do frete sobre a NF-e, CT-e e foto do caminhão carregado.', 'Nenhum frete registrado. Na Roteirização, passo Frete, escolha “Empregador” e salve.') +
    page('transportes', 'tp', 'Registro do transportador', 'Fretes que você realizou como transportador: piso ANTT, valor cobrado, pedágio, ICMS, CBS/IBS e documentos.', 'Nenhum transporte registrado. Na Roteirização, passo Frete, escolha “Transportador” e salve.'));
})();
