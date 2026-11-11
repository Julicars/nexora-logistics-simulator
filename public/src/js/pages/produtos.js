/* NEXORA — página: Cadastro de produtos */
(function () {
  const html = `
<section class="view" id="v-produtos"><div class="wrap">
  <h1>Cadastro de produtos</h1>
  <form class="card" id="fProd" novalidate>
   <div class="prod-grid">
    <div class="photo-box">
     <div id="pFotoPrev" class="photo" aria-label="Fotografia do produto">Sem foto</div>
     <label class="btn sm" style="text-align:center;margin-top:8px">Escolher foto<input type="file" id="pFoto" accept="image/png,image/jpeg,image/webp" hidden></label>
     <button type="button" class="btn sm" id="pFotoDel" style="margin-top:6px">Remover foto</button>
    </div>
    <div>
     <div class="grid g4">
      <label class="f">Nome do produto *<input name="nome" required maxlength="120"></label>
      <label class="f">Código / referência *<input name="cod" required maxlength="40"></label>
      <label class="f">Categoria<input name="cat" list="catList" maxlength="60"><datalist id="catList"></datalist></label>
      <label class="f">Cor no 3D<input name="cor" type="color" value="#f39a2b"></label>
      <label class="f">Tipo de carga *<select name="tipo"></select></label>
      <label class="f">Tipo de embalagem<input name="emb" list="embList" maxlength="60"><datalist id="embList"></datalist></label>
      <label class="f" id="fl-l"><span>Comprimento (m) *</span><input name="l" type="number" step="0.01" min="0.01" required></label>
      <label class="f" id="fl-w"><span>Largura (m) *</span><input name="w" type="number" step="0.01" min="0.01" required></label>
      <label class="f" id="fl-h"><span>Altura (m) *</span><input name="h" type="number" step="0.01" min="0.01" required></label>
      <label class="f">Peças por volume *<input name="pcs" type="number" min="1" step="1" value="1"></label>
      <label class="f">Peso por peça (kg) *<input name="kgp" type="number" min="0" step="0.001"></label>
      <label class="f">Peso total do volume (kg)<input name="kg" type="number" readonly tabindex="-1" class="ro"></label>
      <label class="f">Pode empilhar?<select name="stackable"><option value="sim">Sim</option><option value="nao">Não</option></select></label>
      <label class="f">Níveis máximos<input name="maxLevels" type="number" min="1" step="1" placeholder="sem limite"></label>
      <label class="f">Peso máx. suportado em cima (kg)<input name="stack" type="number" min="0" step="1" placeholder="sem limite"></label>
      <label class="f">Orientações permitidas<select name="pos"></select></label>
     </div>
     <label class="f" style="margin-top:10px">Restrições de transporte<textarea name="obs" rows="2" maxlength="500" placeholder="Ex.: este lado para cima, não molhar, transportar calçada…"></textarea></label>
     <fieldset class="pcats"><legend>Categoria de manuseio e risco <small class="mut">(marque todas que se aplicam — o cálculo respeita as regras)</small></legend><div id="pCats"></div></fieldset>
     <p class="mut" id="pHint" style="font-size:12px"></p>
     <p id="pErr" class="bad" role="alert"></p>
     <button class="btn pri" id="pSave">Salvar produto</button> <button type="button" class="btn" id="pCancel" hidden>Cancelar edição</button>
    </div>
   </div>
  </form>
  <div class="card" style="margin-top:16px">
   <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><h2 style="margin:0">Produtos cadastrados</h2><input id="pFilter" placeholder="🔍 Filtrar por nome ou código" aria-label="Filtrar produtos" style="flex:1;min-width:180px"></div>
   <div class="tbl-wrap"><table id="tProd"><thead><tr><th>Nº</th><th>Foto</th><th>Produto</th><th>Código</th><th>Categoria</th><th>Tipo</th><th>Medidas (m)</th><th>Peças</th><th>Peso/vol</th><th>Empilhamento</th><th></th></tr></thead><tbody></tbody></table></div>
  </div>
 </div></section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
