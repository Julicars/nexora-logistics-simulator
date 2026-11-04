/* Ligação dos eventos restantes e início do simulador. Carrega depois de todos os módulos de app/. */
'use strict';

/* ================= Eventos ================= */
$('#selEstrategia').addEventListener('change', (e) => { st.estrategia = e.target.value; simular(); });
$('#btnSimular').addEventListener('click', () => simular());
$('#btnConfig').addEventListener('click', abrirConfig);
$('#btnDetalhes').addEventListener('click', () => abrirJanela('modalDetalhes'));
$('#btnAtraves').addEventListener('click', () => { st.atraves = !st.atraves; aplicarAtraves(); });
$('#btnPorta').addEventListener('click', () => definirPorta(st.portaAlvo !== 1));
$('#btnTrava').addEventListener('click', () => definirEdicao(!st.editar));
document.querySelectorAll('.vista').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.vista)));

$('#btnPlay').addEventListener('click', () => tocar(!st.tocando));
$('#rngPasso').addEventListener('input', (e) => { tocar(false); st.mostrados = st.base = +e.target.value; });
// velocidade de encaixe em escala logarítmica: 1 a 400 volumes por segundo
const velDoControle = (s) => Math.max(1, Math.round(Math.pow(400, s / 100)));
const atualizarVel = () => { st.vel = velDoControle(+$('#rngVel').value); $('#outVel').textContent = T('player.volPerSec', { n: ni(st.vel) }); };
$('#rngVel').addEventListener('input', atualizarVel);

$('#btnEditar').addEventListener('click', abrirPedidos);
$('#btnAplicar').addEventListener('click', aplicarPedidos);
$('#btnAddLinha').addEventListener('click', () => {
  rascunho.push(normalizar(Object.assign({ codigo: `PED-${String(rascunho.length + 1).padStart(3, '0')}`, nome: T('newProduct') }, PRODUTO_PADRAO)));
  renderTabela();
});
$('#btnPadrao').addEventListener('click', () => { rascunho = clone(PEDIDOS_DEMO).map(normalizar); renderTabela(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalAberto) fecharJanela();
  if (e.key === ' ' && e.target === document.body) { e.preventDefault(); tocar(!st.tocando); }
});

/* ---------- Painéis laterais que recolhem ---------- */
const app = $('.app');
const paineis = Object.assign({ esq: false, dir: false }, lerLocal(CHAVE_PAINEIS) || {});
function aplicarPainel(lado) {
  const recolhido = paineis[lado], painel = $(lado === 'esq' ? '#painelEsq' : '#painelDir');
  const btn = painel.querySelector('.recolher'), nome = T(lado === 'esq' ? 'panel.name.cargo' : 'panel.name.result');
  app.classList.toggle(lado + '-recolhida', recolhido);
  painel.classList.toggle('recolhida', recolhido);
  btn.setAttribute('aria-expanded', String(!recolhido));
  btn.title = T(recolhido ? 'panel.expand' : 'panel.collapse');
  btn.setAttribute('aria-label', T(recolhido ? 'panel.expand' : 'panel.collapse') + ' · ' + nome);
}
function alternarPainel(lado) {
  paineis[lado] = !paineis[lado];
  aplicarPainel(lado);
  gravarLocal(CHAVE_PAINEIS, paineis);
}
document.querySelectorAll('.recolher').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); alternarPainel(b.dataset.painel); }));
// com o painel recolhido, clicar em qualquer parte da faixa abre de novo
document.querySelectorAll('.painel-cab').forEach((cab) => cab.addEventListener('click', () => {
  const lado = cab.closest('.painel').id === 'painelEsq' ? 'esq' : 'dir';
  if (paineis[lado]) alternarPainel(lado);
}));
aplicarPainel('esq');
aplicarPainel('dir');

/* ---------- Seletor de idioma ---------- */
const selIdioma = $('#selIdioma');
I18N.LANGS.forEach((l) => selIdioma.appendChild(new Option(`${l.flag} ${l.nome}`, l.code)));
selIdioma.value = I18N.lang;
I18N.aplicar();
selIdioma.addEventListener('change', () => I18N.definir(selIdioma.value));

// Quando trocar o idioma, re-renderiza tudo que foi montado por JS
I18N.onChange = () => {
  atualizarResumoVeiculo();
  renderPedidos();
  renderTabelaEixos();
  montarSelect();
  if (st.res) renderResultados();
  atualizarVel();
  definirPorta(st.portaAlvo === 1);
  aplicarAtraves();
  atualizarTrava();
  aplicarPainel('esq'); aplicarPainel('dir');
  // redesenha a lona com o nome traduzido (NEXORA fica igual em todos os idiomas, mas garante consistência)
  construirVeiculo(st.veiculo);
};

/* ================= Início ================= */
redimensionar();
atualizarVel();
aplicarAtraves();
definirPorta(false);
atualizarTrava();
atualizarResumoVeiculo();
construirVeiculo(st.veiculo);
simular({ inicio: 0.42 });
requestAnimationFrame(laco);
// redesenha o nome na lona quando a fonte terminar de carregar
if (document.fonts && document.fonts.load) {
  document.fonts.load('700 120px "Barlow Condensed"').then(() => construirVeiculo(st.veiculo)).catch(() => {});
}
