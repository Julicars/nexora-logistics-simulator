/* NEXORA — página: Sobre a NEXORA */
(function () {
  const html = `
<section class="view" id="v-sobre"><div class="wrap">
  <h1>Sobre a NEXORA</h1>
  <p class="mut" style="max-width:720px">A NEXORA Logistics Intelligence nasceu na doca: do retrabalho de cargas que voltavam, do frete pago por espaço vazio e da multa por excesso de peso por eixo. Transformamos esse conhecimento em um simulador que qualquer conferente entende.</p>
  <div class="grid g2" style="margin-top:24px">
   <div class="card"><h2>Linha do tempo</h2>
    <div class="tl">
     <div class="reveal"><b>Diagnóstico</b><br><span class="mut">Mapeamos o processo de expedição: cubagem em planilha e decisão no olho.</span></div>
     <div class="reveal"><b>Motor de carga</b><br><span class="mut">Grade exata + Extreme Points (Crainic, Perboli &amp; Tadei, 2008) com regras de empilhamento e eixo.</span></div>
     <div class="reveal"><b>Simulador 3D</b><br><span class="mut">Carregamento e descarregamento animados, edição manual e etiquetas.</span></div>
     <div class="reveal"><b>Cargas industriais</b><br><span class="mut">Bobinas, big bags e formatos personalizados, cada um com sua regra.</span></div>
     <div class="reveal"><b>Plataforma web</b><br><span class="mut">Funciona no navegador, instala como app e roda sem internet. Com o servidor Node.js, fórum e registros compartilhados.</span></div>
    </div></div>
   <div class="card"><h2>Princípios</h2>
    <p><b>Segurança primeiro.</b> <span class="mut">Nenhum plano ultrapassa limites de eixo, de peso ou de empilhamento.</span></p>
    <p><b>Claro para a doca.</b> <span class="mut">Número do volume, cor e etiqueta: quem carrega entende de primeira.</span></p>
    <p><b>Menos viagens.</b> <span class="mut">Usar o veículo certo é a forma mais barata de reduzir emissões.</span></p>
    <p><b>Para todos.</b> <span class="mut">Funciona no celular, no tablet, no desktop e na TV da expedição.</span></p>
   </div>
  </div>
 </div></section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
