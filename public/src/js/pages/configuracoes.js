/* NEXORA — página: Configurações e acessibilidade */
(function () {
  const html = `
<section class="view" id="v-config"><div class="wrap">
  <h1>Configurações</h1>
  <p class="mut">Preferências deste navegador. Valem para todas as telas.</p>
  <div class="grid g2">
   <div class="card"><h2>Acessibilidade</h2>
    <label class="f">Modo de cor<select id="cbMode">
     <option value="normal">Padrão</option><option value="deut">Deuteranopia / Protanopia</option><option value="trit">Tritanopia</option><option value="hc">Alto contraste</option></select></label>
    <label class="f" style="margin-top:12px">Tamanho do texto<select id="fsMode"><option value="100">Normal (100%)</option><option value="112">Grande (112%)</option><option value="125">Maior (125%)</option><option value="140">Muito grande (140%)</option></select></label>
    <label class="chk"><input type="checkbox" id="rmMode"> Reduzir animações (carregamento 3D não anima sozinho)</label>
    <label class="chk"><input type="checkbox" id="fcMode"> Destacar o foco do teclado com mais força</label>
    <label class="chk"><input type="checkbox" id="nbMode" checked> Mostrar número em cada volume no 3D</label>
   </div>
   <div class="card"><h2>Interface</h2>
    <label class="chk"><input type="checkbox" id="pNavMin"> Menu lateral recolhido</label>
    <label class="chk"><input type="checkbox" id="pSideMin"> Painel da expedição recolhido</label>
    <p class="mut" style="font-size:13px">Você também pode recolher e abrir os painéis pelos botões « » nas laterais.</p>
    <h2 style="margin-top:18px">Atalhos de teclado</h2>
    <p class="mut" style="font-size:13px;line-height:1.7">Setas: mover volume (Shift = passo maior) · O: orientação · R: girar 90° · D: deitar · Ctrl+Z: desfazer · Ctrl+Y: refazer · Esc: limpar seleção · [ e ]: recolher menu / painel</p>
    <button class="btn" id="bResetPrefs">Restaurar padrões</button>
   </div>
  </div>
 </div></section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
