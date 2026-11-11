/* NEXORA — página: Fórum */
(function () {
  const html = `
<section class="view" id="v-forum"><div class="wrap">
  <div class="fhead"><div><h1 style="margin:0">Fórum</h1><p class="mut" style="margin:4px 0 0">ANTT, CIOT, frete mínimo, vale-pedágio, legislação e o dia a dia do transporte.</p></div>
   <div class="factions"><input id="fSearch" type="search" placeholder="Buscar nos tópicos" aria-label="Buscar nos tópicos"><button class="btn" id="fAdmin">Entrar como administrador</button></div></div>
  <p id="fMode" class="fmode" role="status" hidden></p>
  <nav class="fcrumb" id="fCrumb" aria-label="Caminho no fórum"></nav>
  <div id="fBody" aria-live="polite"></div>
</div></section>
<div class="modal" id="mFAdmin" role="dialog" aria-modal="true" aria-labelledby="fAdmT"><div class="card" style="max-width:380px">
 <div class="mh"><h2 id="fAdmT">Acesso do administrador</h2><button class="btn sm" data-close aria-label="Fechar">✕</button></div>
 <form class="mb" id="fAdmForm"><label class="f">Senha<input type="password" id="fAdmPass" autocomplete="current-password" required></label>
 <p class="mut" style="font-size:12px">A senha aparece no terminal quando o servidor é iniciado (ou é a definida em NEXORA_ADMIN_SENHA).</p>
 <p id="fAdmErr" class="bad" role="alert"></p><button class="btn pri" style="width:100%">Entrar</button></form>
</div></div>`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
