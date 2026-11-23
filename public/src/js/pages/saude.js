/* NEXORA — página: Saúde do sistema (todas as fontes automáticas num lugar) */
(function () {
  document.getElementById('main').insertAdjacentHTML('beforeend', `
<section class="view" id="v-saude"><div class="wrap">
  <div class="clhead"><div><h1 style="margin:0">Saúde do sistema</h1>
  <p class="mut" style="margin:4px 0 0">Mostra se cada atualização automática está funcionando, quando rodou pela última vez e o erro, se houver.</p></div>
  <div class="cbacoes"><button class="btn pri" type="button" id="sdTestar">🔄 Testar tudo agora</button><button class="btn" type="button" id="sdRecarregar">Atualizar tela</button></div></div>
  <div id="sdResumo" class="cbcards" aria-live="polite"></div>
  <div class="card"><h2 style="margin:0 0 8px;font-size:16px">Fontes automáticas</h2><div id="sdTab" class="tbl-wrap"></div></div>
  <div class="card" style="margin-top:12px"><h2 style="margin:0 0 8px;font-size:16px">Teste pelo navegador</h2><p class="mut" style="margin:0 0 6px">Algumas fontes são consultadas direto deste aparelho (clima, CEP, rota pela estrada).</p><div id="sdNav"></div></div>
  <p class="mut" style="font-size:12px;margin-top:12px">Dica para hospedagens que “dormem” (ex.: hospedagem Node.js compartilhada): agende uma chamada de hora em hora para <code>/api/cron?chave=SUA_CHAVE</code>. Veja o arquivo DEPLOY.md.</p>
</div></section>`);
  /* bloco de dados e backup dentro de Configurações */
  const cfg = document.querySelector('#v-config .wrap');
  if (cfg) cfg.insertAdjacentHTML('beforeend', `<div class="card" id="cfgDados" style="margin-top:12px"><h2>☁️ Dados, sincronização e backup</h2>
    <p id="cfgSync" class="mut" role="status" style="margin:0 0 8px"></p>
    <div class="cbacoes"><button class="btn" type="button" id="cfgBaixar">⬇ Baixar backup completo</button><label class="btn" for="cfgRest">⬆ Restaurar backup</label><input type="file" id="cfgRest" accept=".json" class="sr"><button class="btn" type="button" id="cfgChave">🔐 Trocar chave deste aparelho</button></div>
    <div id="cfgBk" class="mut" style="font-size:12px;margin-top:8px"></div></div>`);
})();
