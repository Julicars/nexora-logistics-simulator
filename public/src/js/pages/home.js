/* NEXORA — página: Página inicial */
(function () {
  const html = `
<section class="view" id="v-home"><div class="wrap home">
  <!-- HERO -->
  <div class="h-hero">
   <div class="h-copy">
    <span class="h-eyebrow"><i></i> Simulador 3D de montagem de carga</span>
    <h1 class="reveal">Planeje cada carga<br><span>antes do caminhão encostar na doca.</span></h1>
    <p class="reveal">O NEXORA calcula o encaixe físico de paletes, caixas, bobinas e big bags, respeita empilhamento, produtos perigosos e o peso por eixo da Res. CONTRAN 882/2021, e mostra o carregamento em 3D, volume por volume.</p>
    <div class="h-cta reveal">
     <button class="btn pri lg" data-go="rapida">⚡ Começar uma montagem</button>
     <button class="btn lg" data-go="catalogo">Usar o catálogo</button>
    </div>
    <ul class="h-trust reveal"><li>✔ 12 veículos oficiais</li><li>✔ Peso por eixo e PBT</li><li>✔ Funciona no celular</li></ul>
   </div>
   <div class="h-art" aria-hidden="true">
    <svg viewBox="0 0 560 330" class="h-svg">
     <defs>
      <linearGradient id="hg-bx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe8f7" stop-opacity=".22"/><stop offset="1" stop-color="#dfe8f7" stop-opacity=".06"/></linearGradient>
      <linearGradient id="hg-pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb24a"/><stop offset="1" stop-color="#e2861d"/></linearGradient>
      <linearGradient id="hg-cab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c7d3e6"/></linearGradient>
      <radialGradient id="hg-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2f8cf2" stop-opacity=".45"/><stop offset="1" stop-color="#2f8cf2" stop-opacity="0"/></radialGradient>
     </defs>
     <ellipse cx="290" cy="250" rx="270" ry="70" fill="url(#hg-glow)"/>
     <g class="h-road"><rect x="0" y="268" width="560" height="4" rx="2" fill="#2a3f72"/><g class="h-dash"><rect x="0" y="286" width="40" height="3" rx="1.5" fill="#3b5592"/><rect x="90" y="286" width="40" height="3" rx="1.5" fill="#3b5592"/><rect x="180" y="286" width="40" height="3" rx="1.5" fill="#3b5592"/><rect x="270" y="286" width="40" height="3" rx="1.5" fill="#3b5592"/><rect x="360" y="286" width="40" height="3" rx="1.5" fill="#3b5592"/><rect x="450" y="286" width="40" height="3" rx="1.5" fill="#3b5592"/><rect x="540" y="286" width="40" height="3" rx="1.5" fill="#3b5592"/></g></g>
     <!-- carreta -->
     <rect x="150" y="214" width="360" height="12" rx="2" fill="#8d96a6"/>
     <rect x="150" y="96" width="360" height="118" fill="url(#hg-bx)" stroke="#e8eef8" stroke-width="1.6"/>
     <g stroke="#e8eef8" stroke-opacity=".25"><line x1="222" y1="96" x2="222" y2="214"/><line x1="294" y1="96" x2="294" y2="214"/><line x1="366" y1="96" x2="366" y2="214"/><line x1="438" y1="96" x2="438" y2="214"/></g>
     <g class="h-pallets">
      <g class="pl" style="--d:0s"><rect x="156" y="164" width="56" height="44" rx="2" fill="url(#hg-pl)"/><rect x="156" y="208" width="56" height="6" fill="#a87a4a"/></g>
      <g class="pl" style="--d:.35s"><rect x="156" y="118" width="56" height="44" rx="2" fill="url(#hg-pl)"/></g>
      <g class="pl" style="--d:.7s"><rect x="216" y="164" width="56" height="44" rx="2" fill="url(#hg-pl)"/><rect x="216" y="208" width="56" height="6" fill="#a87a4a"/></g>
      <g class="pl" style="--d:1.05s"><rect x="216" y="118" width="56" height="44" rx="2" fill="url(#hg-pl)"/></g>
      <g class="pl" style="--d:1.4s"><rect x="276" y="164" width="56" height="44" rx="2" fill="url(#hg-pl)"/><rect x="276" y="208" width="56" height="6" fill="#a87a4a"/></g>
      <g class="pl" style="--d:1.75s"><rect x="276" y="118" width="56" height="44" rx="2" fill="url(#hg-pl)"/></g>
      <g class="pl" style="--d:2.1s"><rect x="336" y="164" width="56" height="44" rx="2" fill="url(#hg-pl)"/><rect x="336" y="208" width="56" height="6" fill="#a87a4a"/></g>
      <g class="pl" style="--d:2.45s"><rect x="396" y="164" width="56" height="44" rx="2" fill="url(#hg-pl)"/><rect x="396" y="208" width="56" height="6" fill="#a87a4a"/></g>
     </g>
     <text x="330" y="150" class="h-brand">NEXORA</text>
     <!-- cavalo -->
     <path d="M66 226 V140 q0 -12 12 -14 h52 q10 0 12 10 l6 30 V226 Z" fill="url(#hg-cab)" stroke="#9fb0cc"/>
     <path d="M74 140 h38 v30 h-46 v-22 q0 -8 8 -8 Z" fill="#0d1a33" opacity=".9"/>
     <rect x="70" y="190" width="78" height="4" fill="#f39a2b"/><rect x="70" y="196" width="70" height="2" fill="#2f8cf2"/>
     <rect x="60" y="214" width="96" height="12" rx="3" fill="#2a303b"/>
     <circle cx="62" cy="222" r="5" fill="#fff6c8"/>
     <!-- rodas -->
     <g class="h-wheels" fill="#121620" stroke="#dfe4ea" stroke-width="3">
      <circle cx="96" cy="250" r="18"/><circle cx="168" cy="250" r="18"/><circle cx="206" cy="250" r="18"/>
      <circle cx="412" cy="250" r="18"/><circle cx="452" cy="250" r="18"/><circle cx="492" cy="250" r="18"/>
     </g>
     <!-- chips -->
     <g class="h-chip" transform="translate(372 30)"><rect width="168" height="46" rx="10" fill="#0b1430" stroke="#32c48d"/><text x="14" y="20" class="h-c1">Eixos dentro do limite</text><text x="14" y="36" class="h-c2">6 + 17 + 25,5 t ✔</text></g>
     <g class="h-chip c2" transform="translate(150 30)"><rect width="150" height="46" rx="10" fill="#0b1430" stroke="#f7a334"/><text x="14" y="20" class="h-c1">Ocupação</text><text x="14" y="36" class="h-c2">28 paletes · 92%</text></g>
    </svg>
   </div>
  </div>

  <!-- NÚMEROS -->
  <div class="h-kpis">
   <div class="reveal counter"><b data-count="12">0</b><span>veículos oficiais<br><small>carreta, rodotrem, truck, 3/4, VAN, Iveco, containers</small></span></div>
   <div class="reveal counter"><b data-count="7">0</b><span>configurações de eixos<br><small>toco, trucado, LS, vanderléia, Romeu e Julieta…</small></span></div>
   <div class="reveal counter"><b data-count="9">0</b><span>regras de manuseio<br><small>frágil, explosivo, alimentício, não molhar…</small></span></div>
   <div class="reveal counter"><b data-count="5">0</b><span>tipos de volume<br><small>palete, caixa, bobina, big bag, outro</small></span></div>
  </div>

  <!-- COMO FUNCIONA -->
  <h2 class="h-sec reveal">Como funciona</h2>
  <ol class="h-steps">
   <li class="reveal"><i>1</i><b>Informe a carga</b><span>Escolha produtos do catálogo ou digite medidas, peso e quantidade na Montagem Rápida.</span></li>
   <li class="reveal"><i>2</i><b>Escolha o veículo</b><span>Carroceria baú, sider ou aberta e a configuração de eixos real da sua frota.</span></li>
   <li class="reveal"><i>3</i><b>Veja e ajuste em 3D</b><span>O motor monta fileira a fileira; arraste, gire e confira peso por eixo e ocupação.</span></li>
   <li class="reveal"><i>4</i><b>Leve para a doca</b><span>Plano de carregamento, ordem de descarga, relatório A4, CSV e cotação.</span></li>
  </ol>

  <!-- RECURSOS -->
  <h2 class="h-sec reveal">Tudo o que a expedição precisa</h2>
  <div class="h-feats">
   <article class="reveal"><svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg><b>Cubagem física real</b><p>Grade exata + Extreme Points: sem sobreposição, com apoio mínimo e orientação permitida.</p></article>
   <article class="reveal"><svg viewBox="0 0 24 24"><circle cx="6" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M2 13h20M6 13V7h9l4 6"/></svg><b>Peso por eixo e PBT</b><p>Limites da Res. CONTRAN 882/2021 com tara, carga útil e centro de gravidade.</p></article>
   <article class="reveal"><svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/></svg><b>Edição livre no 3D</b><p>Clique, arraste, gire e deite volumes; desfazer e refazer; a câmera continua livre.</p></article>
   <article class="reveal"><svg viewBox="0 0 24 24"><path d="M1 6h13v10H1zM14 10h4l3 3v3h-7"/><path d="M19 3v4M17 5h4"/></svg><b>Veículos extras com aviso</b><p>Se não couber, o sistema sugere o menor veículo que leva o restante — e pergunta antes.</p></article>
   <article class="reveal"><svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg><b>Produtos perigosos e frágeis</b><p>Explosivo longe de alimento, frágil sem nada em cima, perecível só em carroceria fechada.</p></article>
   <article class="reveal"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h6"/></svg><b>Relatório e cotação</b><p>Impressão A4, planilha CSV para Excel e cotação com valores de frete informados por você.</p></article>
  </div>

  <!-- FROTA -->
  <div class="h-fleet-hd reveal"><h2 class="h-sec" style="margin:0">Frota pronta para simular</h2><button class="btn" data-go="frota">Ver todos os veículos →</button></div>
  <div class="h-fleet" id="homeFleet"></div>
  <div class="marq" aria-label="Veículos suportados"><div id="marq"></div></div>

  <!-- CTA -->
  <div class="h-final reveal">
   <div><h2>Pronto para montar a próxima carga?</h2><p>Comece pela Montagem Rápida — sem cadastro, em menos de um minuto.</p></div>
   <button class="btn pri lg" data-go="rapida">Abrir Montagem Rápida</button>
  </div>
 </div></section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
