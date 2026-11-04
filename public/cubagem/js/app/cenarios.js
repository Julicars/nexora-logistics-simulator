/* Cenários salvos: guarda veículo/pedidos + o resumo já calculado (não o resultado completo) no
   navegador, para recarregar ou comparar depois. Depende de nucleo.js/resultados.js/modais.js. */
'use strict';

const MAX_CENARIOS = 30;
const cenarioValido = (c) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.nome === 'string' && c.nome.length > 0 && c.nome.length <= 80 &&
  c.veiculo && typeof c.veiculo === 'object' && Array.isArray(c.pedidos) && c.pedidos.length <= 200 && c.resumo && typeof c.resumo === 'object';
const listaValida = (l) => Array.isArray(l) && l.length <= MAX_CENARIOS && l.every(cenarioValido);
let cenarios = (function () { const l = lerLocal(CHAVE_CENARIOS); return listaValida(l) ? l : []; })();
const salvarCenarios = () => gravarLocal(CHAVE_CENARIOS, cenarios);

function resumoAtual() {
  if (!st.res || !st.eixos) return null;
  const s = st.res.stats, ex = st.eixos;
  return {
    volumes: st.res.colocados.length, volumesTotal: s.total, pendentes: st.res.pendentes,
    ocupacao: s.ocupacao, kg: s.kg, kgTotal: ex.pbt.total, kgLimite: ex.pbt.limite,
    pisoOcupado: s.pisoOcupado, alturaMax: s.alturaMax,
  };
}

function salvarCenarioAtual(nome) {
  const resumo = resumoAtual();
  if (!resumo) { erro(T('err.nothingToExport')); return; }
  const nomeFinal = (nome || '').trim() || T('scenario.defaultName', { n: cenarios.length + 1 });
  cenarios.push({
    id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    nome: nomeFinal.slice(0, 80), data: new Date().toISOString(),
    veiculo: clone(st.veiculo), pedidos: clone(st.pedidos), opcoes: { estrategia: st.estrategia, apoioMin: st.apoioMin },
    resumo,
  });
  if (cenarios.length > MAX_CENARIOS) cenarios = cenarios.slice(cenarios.length - MAX_CENARIOS);
  salvarCenarios();
  sucesso(T('scenario.saved', { n: nomeFinal }));
  renderCenarios();
}

function carregarCenario(id) {
  const c = cenarios.find((x) => x.id === id);
  if (!c) return;
  st.veiculo = clone(c.veiculo);
  st.idx = 'custom';
  st.pedidos = clone(c.pedidos).map(normalizar);
  if (c.opcoes) { st.estrategia = c.opcoes.estrategia || st.estrategia; st.apoioMin = c.opcoes.apoioMin || st.apoioMin; }
  montarSelect();
  atualizarResumoVeiculo();
  construirVeiculo(st.veiculo);
  simular();
  fecharJanela();
  sucesso(T('scenario.loaded', { n: c.nome }));
}

function removerCenario(id) {
  cenarios = cenarios.filter((c) => c.id !== id);
  salvarCenarios();
  renderCenarios();
}

function renderComparacao(ids) {
  const el = $('#comparacaoCenarios');
  if (ids.length < 2) { el.innerHTML = ''; el.hidden = true; return; }
  const sel = ids.map((id) => cenarios.find((c) => c.id === id)).filter(Boolean).slice(0, 4);
  const linha = (rotulo, fn, fmt) => `<tr><th>${esc(rotulo)}</th>${sel.map((c) => `<td>${esc(fmt ? fmt(fn(c)) : fn(c))}</td>`).join('')}</tr>`;
  el.innerHTML = `<table class="tabela">
    <thead><tr><th></th>${sel.map((c) => `<th>${esc(c.nome)}</th>`).join('')}</tr></thead>
    <tbody>
      ${linha(T('det.vehicleTare'), (c) => c.veiculo.nome || '')}
      ${linha(T('k.loaded'), (c) => `${ni(c.resumo.volumes)} ${T('of')} ${ni(c.resumo.volumesTotal)}`)}
      ${linha(T('k.occupation'), (c) => c.resumo.ocupacao * 100, (v) => nf(v, 1) + '%')}
      ${linha(T('k.cargoWeight'), (c) => c.resumo.kg, (v) => ni(v) + ' kg')}
      ${linha(T('det.grossWeight'), (c) => `${ni(c.resumo.kgTotal)} / ${ni(c.resumo.kgLimite)} kg`)}
      ${linha(T('det.floorUsed'), (c) => c.resumo.pisoOcupado * 100, (v) => nf(v, 1) + '%')}
      ${linha(T('det.maxHeight'), (c) => c.resumo.alturaMax, (v) => nf(v) + ' m')}
    </tbody></table>`;
  el.hidden = false;
}

function renderCenarios() {
  const ul = $('#listaCenarios');
  if (!ul) return;
  if (!cenarios.length) { ul.innerHTML = `<li class="mudo">${esc(T('scenario.empty'))}</li>`; renderComparacao([]); return; }
  ul.innerHTML = cenarios.map((c) =>
    `<li><label><input type="checkbox" class="cmp" value="${c.id}"> <b>${esc(c.nome)}</b></label>` +
    `<span class="mudo">${nf(c.resumo.ocupacao * 100, 1)}% · ${ni(c.resumo.kg)} kg</span>` +
    `<button type="button" class="btn peq" data-carregar="${c.id}">${esc(T('btn.load'))}</button>` +
    `<button type="button" class="ico" data-remover-cenario="${c.id}" aria-label="${esc(T('remove'))} ${esc(c.nome)}"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8"/></svg></button></li>`
  ).join('');
  ul.querySelectorAll('[data-carregar]').forEach((b) => b.addEventListener('click', () => carregarCenario(b.dataset.carregar)));
  ul.querySelectorAll('[data-remover-cenario]').forEach((b) => b.addEventListener('click', () => removerCenario(b.dataset.removerCenario)));
  const atualizarCmp = () => renderComparacao(Array.from(ul.querySelectorAll('.cmp:checked')).map((el) => el.value));
  ul.querySelectorAll('.cmp').forEach((el) => el.addEventListener('change', atualizarCmp));
  atualizarCmp();
}

const btnSalvarCenario = $('#btnSalvarCenario');
if (btnSalvarCenario) btnSalvarCenario.addEventListener('click', () => {
  salvarCenarioAtual($('#nomeCenario').value);
  $('#nomeCenario').value = '';
});
const btnCenarios = $('#btnCenarios');
if (btnCenarios) btnCenarios.addEventListener('click', () => { renderCenarios(); abrirJanela('modalCenarios'); });
