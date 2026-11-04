/* Simulação e painéis de resultado (veículo, pedidos, eixos, detalhes). Depende dos módulos anteriores. */
'use strict';

/* ================= Simulação ================= */
function simular(opcoes) {
  const o = Object.assign({ inicio: 0 }, opcoes || {});
  // limita quantidades para que valores absurdos não travem o navegador
  let restante = 3000;
  st.pedidos.forEach((p) => { p.qtd = Math.max(0, Math.min(Math.floor(+p.qtd || 0), restante)); restante -= p.qtd; });
  st.res = Packer.empacotar(st.veiculo, st.pedidos, { estrategia: st.estrategia, apoioMin: st.apoioMin });
  st.sel = st.hover = -1;
  atualizarFerramentas();
  drag = null; vp.classList.remove('arrastando');
  construirVolumes(st.res);
  const total = st.res.colocados.length;
  $('#rngPasso').max = total;
  st.mostrados = st.base = Math.floor(total * o.inicio);
  tocar(total > st.base);
  calcularEixos();
  renderPedidos();
}

function calcularEixos() {
  st.eixos = Eixos.calcular(st.veiculo, st.res.colocados, st.eixosCfg);
  renderResultados();
}

/* ================= Painéis ================= */
function atualizarResumoVeiculo() {
  const v = st.veiculo, n = Math.max(1, +v.vagoes | 0);
  const dims = `${nf(v.c)} × ${nf(v.l)} × ${nf(v.h)} m`;
  const nome = v.nome || T('opt.custom.name');
  const vagPref = n > 1 ? T('resumo.wagonsOf', { n }) : '';
  const ate = v.cargaKg > 0 ? ' · ' + T('resumo.upTo', { n: ni(v.cargaKg) }) : '';
  $('#resumoVeiculo').innerHTML = `<b>${esc(nome)}</b><span>${vagPref}${dims} · ${nf(v.c * v.l * v.h * n, 1)} m³${ate}</span>`;
  $('#subtitulo').textContent = `${nome} · ${n > 1 ? n + ' × ' : ''}${dims}`;
}

function totaisDe(lista) {
  return lista.reduce((t, p) => {
    const q = Math.max(0, Math.floor(+p.qtd || 0));
    t.vol += q; t.pecas += q * (ehPalete(p) ? Math.max(1, +p.pecas || 1) : 1); t.kg += q * (+p.peso || 0);
    return t;
  }, { vol: 0, pecas: 0, kg: 0 });
}

function renderPedidos() {
  const ul = $('#listaPedidos');
  ul.innerHTML = '';
  $('#nLinhas').textContent = plural(st.pedidos.length, 'line', 'lines');
  st.pedidos.forEach((p, i) => {
    const li = document.createElement('li');
    if (st.destaque === i) li.className = 'ativo';
    const enc = encaixeDe(p), lim = Packer.limiteDe(p);
    const cabem = enc.e && enc.e.total ? T('enc.fits', { n: ni(enc.e.total) }) : enc.texto.toLowerCase();
    const sub = ehPalete(p)
      ? `${ni(p.pecas)} ${T('enc.each')} · ${cabem}`
      : `${cabem.charAt(0).toUpperCase() + cabem.slice(1)}${lim === 0 ? ' · ' + T('empty.doesntStack') : isFinite(lim) ? ` · ${T('empty.bears', { n: ni(lim) })}` : ''}`;
    const sufixo = ehPalete(p) ? T('pallet').substring(0, 3) : T('type.box').substring(0, 2).toLowerCase();
    li.innerHTML =
      `<button type="button" aria-pressed="${st.destaque === i}" title="${esc(enc.texto)}">` +
      `<span class="ponto" style="background:${cor(i)}"></span>` +
      `<span class="ped-nome">${esc(p.nome)}</span><span class="ped-qtd">${ni(p.qtd)}<small>${esc(sufixo)}</small></span>` +
      `<span class="ped-enc">${sub}</span></button>`;
    li.querySelector('button').addEventListener('click', () => {
      st.destaque = st.destaque === i ? -1 : i;
      colorirVolumes();
      renderPedidos();
    });
    ul.appendChild(li);
  });
  const t = totaisDe(st.pedidos);
  const totVol = plural(t.vol, 'volume', 'volumes');
  const extraPecas = t.pecas !== t.vol ? T('total.pieces', { n: ni(t.pecas) }) : '';
  $('#totalPedidos').textContent = `${T('total.text', { v: totVol })}${extraPecas} · ${ni(t.kg)} kg`;
}

function renderResultados() {
  const r = st.res, s = r.stats, ex = st.eixos;
  const card = $('#cardStatus');
  const faltam = r.pendentes > 0;
  const acima = ex.grupos.concat([Object.assign({ nomeKey: 'axle.grossTotal' }, ex.pbt)]).filter((g) => g.situacao !== 'ok');
  let classe = 'ok', titulo = T('status.allLoaded'), corpo = '';
  if (faltam) {
    classe = 'aviso';
    titulo = r.pendentes === 1 ? T('status.leftOut.one') : T('status.leftOut', { n: ni(r.pendentes) });
    corpo += '<ul class="motivos">' + st.pedidos.map((p, i) => {
      const pp = r.porProduto[i];
      if (!pp || !pp.pendentes) return '';
      return Object.entries(pp.motivos).filter(([, q]) => q).map(([m, q]) =>
        `<li><b>${esc(p.nome)}</b>: ${ni(q)} ${T(MOTIVO_KEYS[m])}` +
        (m === 'peso' ? ` (${ni(p.qtd)} × ${nf(p.peso, 1)} kg; ${T('reason.pesoHint')})` : '') +
        (m === 'tamanho' ? ' (' + T('reason.tamanhoHint') + ')' : '') + '</li>').join('');
    }).join('') + '</ul>';
  }
  if (acima.length) {
    const grave = acima.some((g) => g.situacao === 'excesso');
    if (grave) classe = 'perigo';
    else if (classe === 'ok') classe = 'aviso';
    if (!faltam) titulo = T(grave ? 'status.axleOverweight' : 'status.axleOverLimit');
    corpo += '<ul class="motivos">' + acima.map((g) =>
      `<li><b>${esc(nomeEixo(g))}</b>: ${ni(g.total)} kg, ${T('det.limit')} ${ni(g.limite)} kg (+${nf((g.uso - 1) * 100, 1)}%${g.situacao === 'tolerancia' ? ', ' + T('reason.tolerance') : ''})</li>`).join('') + '</ul>';
  }
  if (!faltam && !acima.length) {
    const totVol = plural(s.total, 'volume', 'volumes') + (s.pecas !== s.total ? ` (${ni(s.pecas)} ${T('pieces')})` : '');
    corpo = `<p>${T('status.allOk', { v: totVol })}</p>`;
  }
  card.className = 'status ' + classe;
  $('#pontoStatus').className = 'ponto-status ' + classe;
  $('#pontoStatus').title = titulo.replace(/^[!✓]\s*/, '');
  card.innerHTML = `<strong>${titulo}</strong>${corpo}`;

  $('#kAcom').textContent = ni(r.colocados.length);
  $('#kAcomDe').textContent = `${T('of')} ${plural(s.total, 'volume', 'volumes')}` + (s.pecas !== s.total ? ` · ${ni(s.pecasCarregadas)} ${T('of')} ${ni(s.pecas)} ${T('pieces')}` : '');
  $('#kOcup').textContent = nf(s.ocupacao * 100, 1) + '%';
  $('#barOcup').style.width = Math.min(100, s.ocupacao * 100) + '%';
  const cap = r.veiculo.cargaKg;
  $('#kPeso').textContent = `${ni(s.kg)} kg`;
  $('#kPesoDe').textContent = cap ? `${nf((s.kg / cap) * 100, 0)}% ${T('of')} ${ni(cap)} kg` : `${T('det.grossWeight').toLowerCase()} ${ni(ex.pbt.total)} kg`;

  // peso por eixo: a marca na barra é o limite legal; depois dela vem a faixa de tolerância
  const linhaEixo = (g, tol, extra) => {
    const escala = 1 + tol, w = Math.min(100, (g.uso / escala) * 100);
    return `<li class="${g.situacao}${extra || ''}"><span>${esc(nomeEixo(g))}</span><span class="vl">${ni(g.total)} / ${ni(g.limite)} kg</span>` +
      `<span class="barra"><span style="width:${w}%"></span><i style="left:${100 / escala}%"></i></span></li>`;
  };
  $('#listaEixos').innerHTML = ex.grupos.map((g) => linhaEixo(g, Eixos.TOL_EIXO)).join('') +
    linhaEixo(Object.assign({ nomeKey: 'axle.grossTotal' }, ex.pbt), Eixos.TOL_PBT, ' total');

  $('#listaPorProduto').innerHTML = st.pedidos.map((p, i) => {
    const pp = r.porProduto[i] || { colocados: 0, pendentes: 0, pecas: 0, pecasPendentes: 0 };
    const tot = pp.colocados + pp.pendentes || 1;
    const un = ehPalete(p) ? ' ' + T(tot === 1 ? 'pallet' : 'pallets') : '';
    return `<li><span class="ponto" style="background:${cor(i)}"></span><span class="nm">${esc(p.nome)}</span>` +
      `<span class="vl${pp.pendentes ? ' pend' : ''}">${ni(pp.colocados)} ${T('of')} ${ni(tot)}${un}</span>` +
      `<span class="mini"><span style="width:${(pp.colocados / tot) * 100}%;background:${cor(i)}"></span></span>` +
      (ehPalete(p) ? `<span class="sub">${ni(pp.pecas)} ${T('of')} ${ni(pp.pecas + pp.pecasPendentes)} ${T('pieces')}</span>` : '') + `</li>`;
  }).join('');

  const compCarga = r.veiculo.comprimentoTotal;
  const cgPct = compCarga ? (s.cgX / compCarga) * 100 : 0;
  const desvio = (s.cgY - r.veiculo.l / 2) * 100;
  const linhas = [
    [T('det.volumesLoaded'), `${ni(r.colocados.length)} ${T('of')} ${ni(s.total)}`],
    [T('det.piecesLoaded'), `${ni(s.pecasCarregadas)} ${T('of')} ${ni(s.pecas)}`],
    [T('det.cargoWeight'), `${ni(s.kg)} ${T('of')} ${ni(s.kgSolicitado)} kg`],
    [T('det.vehicleTare'), `${ni(ex.pbt.tara)} kg`],
    [T('det.grossWeight'), `${ni(ex.pbt.total)} kg<small>${T('det.limit')} ${ni(ex.pbt.limite)} kg</small>`],
    [T('det.requestedVolume'), `${nf(s.volSolicitado, 2)} m³`],
    [T('det.loadedVolume'), `${nf(s.volCarregado, 2)} m³`],
    [T('det.capacity'), `${nf(s.capacidade, 2)} m³`],
    [T('det.freeSpace'), `${nf(s.volLivre, 2)} m³`],
    [T('det.floorUsed'), `${nf(s.pisoOcupado * 100, 1)}%`],
    [T('det.maxHeight'), `${nf(s.alturaMax)} m`],
    [T('det.cog'), `${nf(s.cgX)} ${T('det.fromFront')}<small>${nf(cgPct, 0)}% · ${nf(Math.abs(desvio), 0)} cm ${T(desvio >= 0 ? 'det.right' : 'det.left')}</small>`],
  ];
  if (r.porVagao.length > 1) r.porVagao.forEach((v, i) => linhas.push([T('det.wagon', { n: i + 1 }), `${ni(v.volumes)} ${T('volumes')} · ${nf(v.ocupacao * 100, 1)}%<small>${ni(v.kg)} kg</small>`]));
  linhas.push([T('det.calcTime'), `${nf(s.ms, 0)} ms<small>${T('det.extremePoints', { n: ni(s.extremePoints) })}</small>`]);
  $('#linhasRes').innerHTML = linhas.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}
