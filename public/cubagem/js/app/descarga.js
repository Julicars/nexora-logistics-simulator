/* Ordem de descarga: dentro de cada vagão, do mais próximo da porta (maior x) para o mais distante.
   Entre vagões, segue a ordem de carregamento (vagão 0 primeiro). Depende de resultados.js (st.res). */
'use strict';

function ordemDescarga() {
  if (!st.res) return [];
  const porVagao = {};
  st.res.colocados.forEach((c) => { (porVagao[c.vagao] = porVagao[c.vagao] || []).push(c); });
  const vagoes = Object.keys(porVagao).map(Number).sort((a, b) => a - b);
  const lista = [];
  vagoes.forEach((vg) => {
    porVagao[vg].slice().sort((a, b) => (b.x + b.dx) - (a.x + a.dx)).forEach((c) => lista.push(c));
  });
  return lista.map((c, i) => ({ ordem: i + 1, c, pedido: st.pedidos[c.pi] }));
}

function renderDescarga() {
  const lista = ordemDescarga();
  const ul = $('#listaDescarga');
  if (!lista.length) { ul.innerHTML = `<li class="mudo">${esc(T('unload.empty'))}</li>`; return; }
  ul.innerHTML = lista.map(({ ordem, c, pedido }) =>
    `<li><span class="ordem">${ordem}</span><span class="ponto" style="background:${cor(c.pi)}"></span>` +
    `<span class="nm">${esc(pedido ? pedido.nome : '')}</span>` +
    `<span class="mudo">${T('det.wagon', { n: c.vagao + 1 })} · ${nf(c.x, 1)} m ${T('tip.distanceFromFront').toLowerCase()}</span></li>`
  ).join('');
}

const btnDescarga = $('#btnDescarga');
if (btnDescarga) btnDescarga.addEventListener('click', () => { renderDescarga(); abrirJanela('modalDescarga'); });
