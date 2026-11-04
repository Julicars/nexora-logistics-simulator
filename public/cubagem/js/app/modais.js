/* Janelas (pedidos, configurações, detalhes), frota e seleção de veículo. Depende dos módulos anteriores. */
'use strict';

/* ================= Janelas (pedidos, configurações, detalhes) ================= */
let modalAberto = null, focoAntes = null;
function abrirJanela(id) {
  fecharJanela();
  focoAntes = document.activeElement;
  modalAberto = $('#' + id);
  modalAberto.hidden = false;
  const f = modalAberto.querySelector('[data-fechar]');
  if (f) f.focus();
}
function fecharJanela() {
  if (!modalAberto) return;
  modalAberto.hidden = true;
  modalAberto = null;
  if (focoAntes && focoAntes.focus) focoAntes.focus();
}
document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharJanela));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) fecharJanela(); }));

/* ---------- Editor de pedidos ---------- */
let rascunho = [];

function abrirPedidos() {
  rascunho = clone(st.pedidos);
  renderTabela();
  $('#erroModal').hidden = true;
  abrirJanela('modalPedidos');
}

function renderTabela() {
  const tb = $('#corpoTabela');
  tb.innerHTML = '';
  rascunho.forEach((p, i) => {
    const pal = ehPalete(p);
    const tr = document.createElement('tr');
    const num = (k, v, extra) => `<td><input class="num" id="p${i}-${k}" type="text" inputmode="${k === 'qtd' || k === 'pecas' ? 'numeric' : 'decimal'}" value="${esc(v)}"${extra || ''}></td>`;
    tr.innerHTML =
      `<td><input id="p${i}-codigo" type="text" value="${esc(p.codigo)}" style="width:96px"></td>` +
      `<td><input id="p${i}-nome" type="text" value="${esc(p.nome)}" style="min-width:150px"></td>` +
      `<td><select id="p${i}-tipo"><option value="caixa"${pal ? '' : ' selected'}>${T('type.box')}</option><option value="palete"${pal ? ' selected' : ''}>${T('type.pallet')}</option></select></td>` +
      num('c', mostrarDecimal(p.c)) + num('l', mostrarDecimal(p.l)) + num('h', mostrarDecimal(p.h)) +
      num('qtd', p.qtd) +
      num('pecas', pal ? p.pecas : 1, pal ? '' : ' disabled') +
      num('pesoPeca', mostrarDecimal(p.pesoPeca)) + num('peso', mostrarDecimal(p.peso)) +
      `<td><select id="p${i}-orientacao">${Object.keys(Packer.MODOS).map((k) => `<option value="${k}"${modo(p) === k ? ' selected' : ''}>${nomeModo(k)}</option>`).join('')}</select></td>` +
      `<td><input class="lim" id="p${i}-maxEmCima" type="text" inputmode="decimal" placeholder="${esc(T('placeholder.noLimit').toLowerCase())}" value="${p.maxEmCima == null ? '' : esc(mostrarDecimal(p.maxEmCima))}"></td>` +
      `<td class="enc" id="p${i}-enc"></td>` +
      `<td><button type="button" class="ico" aria-label="${esc(T('remove'))}"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8"/></svg></button></td>`;
    const campo = (k) => tr.querySelector(`#p${i}-${k}`);
    const ler = (k) => {
      const el = campo(k), v = el.value, q = rascunho[i];
      if (k === 'tipo') {
        q.tipo = v;
        if (v === 'palete') {
          q.orientacao = 'auto';
          if (q.maxEmCima == null) q.maxEmCima = 0;
          if (!(+q.pecas > 1)) { q.pecas = PRODUTO_PADRAO.pecas; q.pesoPeca = PRODUTO_PADRAO.pesoPeca; q.peso = q.pecas * q.pesoPeca; }
        }
        else { q.pecas = 1; q.pesoPeca = q.peso; }
        renderTabela();
        return;
      }
      if (k === 'qtd') q.qtd = lerInteiro(v);
      else if (k === 'pecas') {
        q.pecas = Math.max(1, lerInteiro(v) || 1);
        if (q.pesoPeca > 0) { q.peso = q.pecas * q.pesoPeca; campo('peso').value = mostrarDecimal(q.peso); }
      } else if (k === 'pesoPeca') {
        q.pesoPeca = lerDecimal(v);
        q.peso = (ehPalete(q) ? q.pecas : 1) * q.pesoPeca;
        campo('peso').value = isNaN(q.peso) ? '' : mostrarDecimal(q.peso);
      } else if (k === 'peso') {
        q.peso = lerDecimal(v);
        q.pesoPeca = q.peso / (ehPalete(q) ? q.pecas : 1);
        campo('pesoPeca').value = isNaN(q.pesoPeca) ? '' : mostrarDecimal(q.pesoPeca);
      } else if (k === 'maxEmCima') q.maxEmCima = v.trim() === '' ? null : lerDecimal(v);
      else if (k === 'c' || k === 'l' || k === 'h') q[k] = lerDecimal(v);
      else q[k] = v;
      atualizarAvisos();
    };
    tr.querySelectorAll('input,select').forEach((el) => {
      const k = el.id.split('-')[1];
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => ler(k));
    });
    tr.querySelector('button').addEventListener('click', () => { rascunho.splice(i, 1); renderTabela(); });
    tb.appendChild(tr);
  });
  atualizarAvisos();
}

// Encaixe de cada linha, total e avisos de quantidade ou peso acima do possível
function atualizarAvisos() {
  const avisos = [];
  const vag = Math.max(1, +st.veiculo.vagoes | 0), cap = +st.veiculo.cargaKg;
  rascunho.forEach((q, j) => {
    const td = $(`#p${j}-enc`);
    if (!(q.c > 0 && q.l > 0 && q.h > 0)) { if (td) td.textContent = '—'; return; }
    const e = encaixeDe(q);
    if (td) { td.textContent = e.curto; td.title = e.texto; td.classList.toggle('ruim', !e.e.total); }
    if (!e.e.total) avisos.push(T('notfit.position', { j: j + 1, m: nomeModo(modo(q)) }));
    else if (q.qtd > e.e.total * vag) avisos.push(T('notfit.max', { j: j + 1, max: ni(e.e.total * vag), e: e.texto, q: ni(q.qtd) }));
    if (cap > 0 && q.qtd * q.peso > cap) avisos.push(T('notfit.weight', { j: j + 1, q: ni(q.qtd), p: nf(q.peso, 1), t: ni(q.qtd * q.peso), c: ni(cap) }));
  });
  const av = $('#avisoModal');
  av.innerHTML = avisos.map((a) => `<li>${esc(a)}</li>`).join('');
  av.hidden = !avisos.length;
  const t = totaisDe(rascunho);
  $('#totalTabela').innerHTML = `Total: <b>${ni(t.vol)}</b> ${T('volumes')} · <b>${ni(t.pecas)}</b> ${T('pieces')} · <b>${ni(t.kg)} kg</b>`;
}

function aplicarPedidos() {
  const erroEl = $('#erroModal');
  const falha = (t) => { erroEl.textContent = t; erroEl.hidden = false; erro(t); };
  if (!rascunho.length) return falha(T('err.needLine'));
  for (const [i, p] of rascunho.entries()) {
    // mensagem aponta o código/nome do produto, não só o número da linha, para achar mais rápido
    const rotulo = (p.codigo || p.nome) ? ` (${esc(p.codigo || p.nome)})` : '';
    if (!(p.c > 0 && p.l > 0 && p.h > 0)) return falha(T('err.dims', { i: i + 1 }) + rotulo);
    if (!(p.qtd >= 0)) return falha(T('err.qty', { i: i + 1 }) + rotulo);
    if (p.maxEmCima != null && !(p.maxEmCima >= 0)) return falha(T('err.topKg', { i: i + 1 }) + rotulo);
  }
  st.pedidos = rascunho.map(normalizar);
  if (st.destaque >= st.pedidos.length) st.destaque = -1;
  fecharJanela();
  simular();
}

/* ---------- Configurações ---------- */
function abrirConfig() {
  const v = st.veiculo;
  $('#vC').value = mostrarDecimal(v.c);
  $('#vL').value = mostrarDecimal(v.l);
  $('#vH').value = mostrarDecimal(v.h);
  $('#vVag').value = Math.max(1, +v.vagoes | 0);
  $('#vKg').value = v.cargaKg > 0 ? ni(v.cargaKg) : '';
  $('#vNome').value = st.idx === 'custom' ? '' : v.nome;
  $('#msgSalvar').textContent = '';
  renderTabelaEixos();
  renderFrota();
  abrirJanela('modalConfig');
}

function mostrarAba(aba) {
  document.querySelectorAll('.config-nav [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.aba === aba)));
  document.querySelectorAll('.config-aba').forEach((p) => { p.hidden = p.id !== 'aba-' + aba; });
}
document.querySelectorAll('.config-nav [role="tab"]').forEach((t) => t.addEventListener('click', () => mostrarAba(t.dataset.aba)));

/* ---------- Configuração de veículos (cadastro da frota) ---------- */
let tmrFrota = null;
function renderFrota() {
  const tb = $('#corpoFrota');
  $('#nFrota').textContent = plural(frota.length, 'vehicle', 'vehicles');
  tb.innerHTML = '';
  frota.forEach((v, i) => {
    const tr = document.createElement('tr');
    if (i === st.idx) tr.className = 'atual';
    const num = (k, val, modo) => `<td><input class="num" id="f${i}-${k}" type="text" inputmode="${modo}" value="${esc(val)}"></td>`;
    tr.innerHTML =
      `<td><input class="nome" id="f${i}-nome" type="text" value="${esc(v.nome)}" aria-label="${esc(T('label.name'))}"></td>` +
      `<td><select id="f${i}-categoria" aria-label="${esc(T('th.category'))}">${Object.keys(CATEGORIAS).map((k) => `<option value="${k}"${(v.categoria || 'truck') === k ? ' selected' : ''}>${nomeCat(k)}</option>`).join('')}</select></td>` +
      num('c', mostrarDecimal(v.c), 'decimal') + num('l', mostrarDecimal(v.l), 'decimal') + num('h', mostrarDecimal(v.h), 'decimal') +
      num('vagoes', Math.max(1, +v.vagoes | 0), 'numeric') +
      `<td><input class="lim" id="f${i}-cargaKg" type="text" inputmode="numeric" placeholder="${esc(T('placeholder.noLimit').toLowerCase())}" value="${v.cargaKg > 0 ? ni(v.cargaKg) : ''}"></td>` +
      `<td class="vol" id="f${i}-vol">${nf(v.c * v.l * v.h * Math.max(1, +v.vagoes | 0), 1)} m³</td>` +
      `<td><div class="acoes">` +
      (i === st.idx ? `<span class="mudo">${esc(T('btn.inUse'))}</span>` : `<button type="button" class="btn peq" data-usar="${i}">${esc(T('btn.use'))}</button>`) +
      `<button type="button" class="ico" data-remover="${i}" aria-label="${esc(T('remove'))} ${esc(v.nome)}"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8"/></svg></button></div></td>`;
    tr.querySelectorAll('input,select').forEach((el) => {
      const k = el.id.split('-')[1];
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => editarFrota(i, k, el.value));
    });
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-usar]').forEach((b) => b.addEventListener('click', () => { selecionarVeiculo(+b.dataset.usar); renderFrota(); }));
  tb.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', () => removerVeiculo(+b.dataset.remover)));
}

function editarFrota(i, k, valor) {
  const v = frota[i], erroEl = $('#erroFrota');
  erroEl.hidden = true;
  if (k === 'nome') {
    if (!valor.trim()) { erroEl.textContent = T('err.nameEmpty', { i: i + 1 }); erroEl.hidden = false; erro(erroEl.textContent); return; }
    v.nome = valor.trim();
  } else if (k === 'categoria') v.categoria = valor;
  else if (k === 'cargaKg') { const n = lerInteiro(valor); if (n > 0) v.cargaKg = n; else delete v.cargaKg; }
  else {
    const n = k === 'vagoes' ? lerInteiro(valor) : lerDecimal(valor);
    if (!(n > 0)) { erroEl.textContent = T('err.positive', { i: i + 1 }); erroEl.hidden = false; erro(erroEl.textContent); return; }
    v[k] = k === 'vagoes' ? Math.min(3, n) : n;
  }
  $(`#f${i}-vol`).textContent = `${nf(v.c * v.l * v.h * Math.max(1, +v.vagoes | 0), 1)} m³`;
  salvarFrota();
  clearTimeout(tmrFrota);
  tmrFrota = setTimeout(() => {
    montarSelect();
    if (i === st.idx) selecionarVeiculo(i); // o veículo em uso foi alterado: redesenha e recalcula
  }, 450);
}

function removerVeiculo(i) {
  const erroEl = $('#erroFrota');
  if (frota.length <= 1) { erroEl.textContent = T('err.oneVehicle'); erroEl.hidden = false; erro(erroEl.textContent); return; }
  frota.splice(i, 1);
  if (st.idx === i) st.idx = 'custom';
  else if (typeof st.idx === 'number' && st.idx > i) st.idx--;
  salvarFrota();
  montarSelect();
  renderFrota();
}

$('#btnAddVeiculo').addEventListener('click', () => {
  frota.push({ nome: T('newVehicle', { n: frota.length + 1 }), categoria: 'truck', c: 8.5, l: 2.4, h: 2.6, vagoes: 1 });
  salvarFrota();
  montarSelect();
  renderFrota();
  const ult = $(`#f${frota.length - 1}-nome`);
  ult.focus();
  ult.select();
});

// Restaurar pede confirmação no próprio botão (clique de novo em até 4 s)
let confirmaRestaurar = null;
$('#btnFrotaPadrao').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (!confirmaRestaurar) {
    b.textContent = T('btn.restoreConfirm');
    confirmaRestaurar = setTimeout(() => { b.textContent = T('btn.restoreList'); confirmaRestaurar = null; }, 4000);
    return;
  }
  clearTimeout(confirmaRestaurar);
  confirmaRestaurar = null;
  b.textContent = T('btn.restoreList');
  frota = clone(VEICULOS);
  salvarFrota();
  selecionarVeiculo(0);
  montarSelect();
  renderFrota();
});

// Salva as medidas da aba "Veículo atual" como um veículo da lista
$('#btnSalvarVeiculo').addEventListener('click', () => {
  const nome = $('#vNome').value.trim() || T('newVehicle', { n: frota.length + 1 });
  const v = st.veiculo;
  const novo = { nome, categoria: v.categoria || 'truck', c: v.c, l: v.l, h: v.h, vagoes: Math.max(1, +v.vagoes | 0) };
  if (v.cargaKg > 0) novo.cargaKg = v.cargaKg;
  const existente = frota.findIndex((f) => f.nome.toLowerCase() === nome.toLowerCase());
  if (existente >= 0) frota[existente] = novo; else frota.push(novo);
  const i = existente >= 0 ? existente : frota.length - 1;
  salvarFrota();
  st.idx = i;
  st.veiculo.nome = nome;
  montarSelect();
  atualizarResumoVeiculo();
  $('#msgSalvar').textContent = T(existente >= 0 ? 'msg.vehicleUpdated' : 'msg.vehicleAdded', { n: nome });
});

function renderTabelaEixos() {
  const geo = Eixos.geometria(st.veiculo), cfg = st.eixosCfg;
  $('#corpoEixos').innerHTML = geo.grupos.map((g) =>
    `<tr><td>${esc(nomeEixo(g))}</td>` +
    `<td><input type="text" inputmode="numeric" id="ex-tara-${g.id}" data-eixo="${g.id}" data-campo="tara" value="${ni(cfg.tara[g.id] != null ? cfg.tara[g.id] : g.tara)}"></td>` +
    `<td><input type="text" inputmode="numeric" id="ex-limite-${g.id}" data-eixo="${g.id}" data-campo="limite" value="${ni(cfg.limite[g.id] != null ? cfg.limite[g.id] : g.limite)}"></td></tr>`).join('');
  $('#corpoEixos').querySelectorAll('input').forEach((el) => el.addEventListener('input', () => {
    const val = lerInteiro(el.value), alvo = st.eixosCfg[el.dataset.campo];
    if (val >= 0) alvo[el.dataset.eixo] = val; else delete alvo[el.dataset.eixo];
    if (st.res) calcularEixos();
  }));
}

/* ---------- Seleção de veículo da frota ---------- */
const sel = $('#selVeiculo');
function montarSelect() {
  sel.innerHTML = '';
  Object.keys(CATEGORIAS).forEach((cat) => {
    const og = document.createElement('optgroup');
    og.label = nomeCat(cat);
    frota.forEach((v, i) => { if ((v.categoria || 'truck') === cat) og.appendChild(new Option(v.nome, i)); });
    if (og.children.length) sel.appendChild(og);
  });
  sel.add(new Option(T('opt.custom'), 'custom'));
  sel.value = String(st.idx);
}
function selecionarVeiculo(i) {
  st.idx = i;
  st.veiculo = clone(frota[i]);
  st.eixosCfg = { tara: {}, limite: {} };
  sel.value = String(i);
  atualizarResumoVeiculo();
  construirVeiculo(st.veiculo);
  simular();
}
montarSelect();
sel.addEventListener('change', () => {
  if (sel.value === 'custom') {
    st.idx = 'custom';
    st.veiculo.nome = T('opt.custom.name');
    atualizarResumoVeiculo();
    abrirConfig();
    return;
  }
  selecionarVeiculo(+sel.value);
});

let tmrVeic = null;
[['#vC', 'c', lerDecimal], ['#vL', 'l', lerDecimal], ['#vH', 'h', lerDecimal], ['#vVag', 'vagoes', lerInteiro], ['#vKg', 'cargaKg', lerInteiro]].forEach(([id, k, ler]) => {
  $(id).addEventListener('input', () => {
    const val = ler($(id).value);
    if (k === 'cargaKg') st.veiculo.cargaKg = val > 0 ? val : undefined;
    else if (!(val > 0)) return;
    else st.veiculo[k] = k === 'vagoes' ? Math.min(3, Math.max(1, val)) : val;
    if (k !== 'cargaKg') { st.veiculo.nome = T('opt.custom.name'); st.idx = 'custom'; sel.value = 'custom'; }
    atualizarResumoVeiculo();
    clearTimeout(tmrVeic);
    tmrVeic = setTimeout(() => { construirVeiculo(st.veiculo); simular(); if (k === 'vagoes') renderTabelaEixos(); }, 400);
  });
});
$('#btnEixosPadrao').addEventListener('click', () => { st.eixosCfg = { tara: {}, limite: {} }; renderTabelaEixos(); if (st.res) calcularEixos(); });
$('#inApoio').addEventListener('input', (e) => { st.apoioMin = +e.target.value / 100; $('#outApoio').textContent = e.target.value + '%'; });
$('#inApoio').addEventListener('change', () => simular());
