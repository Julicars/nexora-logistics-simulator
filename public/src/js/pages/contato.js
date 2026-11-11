/* NEXORA — página: Contato e perguntas frequentes */
(function () {
  const html = `
<section class="view" id="v-contato"><div class="wrap">
  <h1>Contato</h1>
  <div class="grid g2">
   <form class="card" id="fContato" novalidate>
    <div class="grid g2">
     <label class="f">Nome<input name="nome" required autocomplete="name"></label>
     <label class="f">E-mail<input name="email" type="email" required autocomplete="email"></label>
    </div>
    <label class="f" style="margin-top:10px">Empresa<input name="emp"></label>
    <label class="f" style="margin-top:10px">Mensagem<textarea name="msg" rows="5" required></textarea></label>
    <p id="cErr" class="bad" role="alert"></p>
    <button class="btn pri">Enviar mensagem</button>
    <p class="mut" style="font-size:13px" id="cNote">A mensagem fica registrada neste navegador.</p>
   </form>
   <div>
    <h2>Perguntas frequentes</h2>
    <details><summary>Qual a diferença entre Mostrar Catálogo e Montagem Rápida?</summary><p class="mut">O Catálogo usa só produtos cadastrados (medidas, pesos e fotos vêm do cadastro). A Montagem Rápida é para cotações: você digita os dados e nada é salvo no catálogo. As duas usam o mesmo motor de cálculo e o mesmo 3D, e uma não altera a outra.</p></details>
    <details><summary>Como o sistema calcula quantos volumes cabem?</summary><p class="mut">Primeiro monta uma grade exata por produto (fileiras × colunas × camadas). O que sobra é encaixado pela heurística Extreme Points, testando as orientações permitidas.</p></details>
    <details><summary>Os limites de peso por eixo são oficiais?</summary><p class="mut">São referências da Resolução CONTRAN 210/2006 (eixo simples 6 t, tandem duplo 17 t, tandem triplo 25,5 t), com taras estimadas. Confirme com a configuração real do seu veículo.</p></details>
    <details><summary>E se a carga não couber?</summary><p class="mut">O sistema escolhe o menor veículo rodoviário que leva o restante, até 4 extras. Containers nunca entram como extra: só quando você escolhe um container como veículo principal.</p></details>
    <details><summary>Como funcionam bobinas e big bags?</summary><p class="mut">Bobina deitada fica no assoalho, calçada, sem nada em cima; em pé pode empilhar até o limite de níveis. Big bag nunca deita, precisa de 90% de apoio e só leva outro big bag em cima.</p></details>
   </div>
  </div>
 </div></section>
`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
})();
