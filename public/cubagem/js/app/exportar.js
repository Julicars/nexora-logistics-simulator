/* Exportar o plano de carga: impressão A4 (CSS @media print) e CSV (abre no Excel). Sem bibliotecas novas. */
'use strict';

// Linhas da tabela de carregamento, na ordem em que cada volume foi colocado
function linhasPlano() {
  if (!st.res) return [];
  return st.res.colocados.map((c, i) => {
    const p = st.pedidos[c.pi] || {};
    return {
      seq: i + 1, codigo: p.codigo || '', nome: p.nome || '', vagao: c.vagao + 1,
      x: nf(c.x), y: nf(c.y), z: nf(c.z), c: nf(c.dx), l: nf(c.dy), h: nf(c.dz), peso: nf(c.peso, 1),
    };
  });
}

// Tira uma foto da cena 3D como está na tela agora, para ilustrar o plano impresso.
// Sem preserveDrawingBuffer no renderer, o buffer só fica legível logo após um render() —
// por isso desenha de novo e lê o canvas na mesma chamada, antes do navegador limpar o quadro.
function capturarImagemVeiculo() {
  try {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}

// Resumo por produto: agrupa os volumes carregados pelo nome do produto (não pelo código técnico)
function resumoPorProduto() {
  if (!st.res) return [];
  const porNome = new Map();
  st.res.colocados.forEach((c) => {
    const p = st.pedidos[c.pi] || {};
    const nome = p.nome || p.codigo || T('opt.custom.name');
    const linha = porNome.get(nome) || { nome, qtd: 0, peso: 0 };
    linha.qtd += 1;
    linha.peso += c.peso || 0;
    porNome.set(nome, linha);
  });
  return Array.from(porNome.values()).sort((a, b) => b.qtd - a.qtd);
}

function montarAreaImpressao() {
  const area = $('#areaImpressao');
  if (!area || !st.res) return;
  const v = st.veiculo, produtos = resumoPorProduto();
  const totalVolumes = st.res.colocados.length;
  const totalPeso = st.res.stats ? st.res.stats.kg : produtos.reduce((s, p) => s + p.peso, 0);
  const imagem = capturarImagemVeiculo();
  const corpoProdutos = produtos.map((p) =>
    `<tr><td>${esc(p.nome)}</td><td>${ni(p.qtd)}</td><td>${ni(Math.round(p.peso))} kg</td></tr>`
  ).join('');
  area.innerHTML = `
    <h1>NEXORA Logistics Intelligence</h1>
    <h2>${esc(v.nome || T('opt.custom.name'))} — ${nf(v.c)} × ${nf(v.l)} × ${nf(v.h)} m</h2>
    <p>${T('print.generatedAt')}: ${new Date().toLocaleString(I18N.locale())}</p>
    ${imagem ? `<img class="img-veiculo" src="${imagem}" alt="${esc(v.nome || '')}">` : ''}
    <div class="resumo-impressao">
      <div><strong>${ni(totalVolumes)}</strong><span>${T('th.qty')}</span></div>
      <div><strong>${ni(Math.round(totalPeso))} kg</strong><span>${T('k.cargoWeight')}</span></div>
    </div>
    <table><thead><tr><th>${T('th.description')}</th><th>${T('th.qty')}</th><th>${T('th.kgPerVol')}</th></tr></thead><tbody>${corpoProdutos}</tbody></table>
  `;
}

// dentro de um iframe de outra origem (ex.: pré-visualização embutida), o navegador costuma
// bloquear window.print()/download disparado pelo documento filho; abrir em uma aba própria contorna isso
let dentroDeIframe = false;
try { dentroDeIframe = window.top !== window.self; } catch (e) { dentroDeIframe = true; }

function imprimirPlano() {
  if (!st.res || !st.res.colocados.length) { erro(T('err.nothingToExport')); return; }
  montarAreaImpressao();
  try {
    if (dentroDeIframe) {
      const jan = window.open('', '_blank');
      if (!jan) throw new Error('popup bloqueado');
      const estilo = `<style>
        @page { size: A4; margin: 15mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
        h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 0 0 10px; font-weight: 600; }
        h3 { font-size: 13px; margin: 18px 0 6px; } p { font-size: 12px; margin: 0 0 12px; color: #444; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
        th, td { border: 1px solid #999; padding: 3px 6px; text-align: left; }
        th { background: #eee; }
        .img-veiculo { display: block; max-width: 100%; max-height: 90mm; margin: 6px 0 14px; border: 1px solid #ddd; }
        .resumo-impressao { display: flex; gap: 24px; margin: 0 0 16px; }
        .resumo-impressao div { border: 1px solid #ccc; border-radius: 4px; padding: 8px 16px; text-align: center; }
        .resumo-impressao strong { display: block; font-size: 20px; }
        .resumo-impressao span { font-size: 10.5px; color: #555; }
      </style>`;
      jan.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>NEXORA</title>${estilo}</head><body>${$('#areaImpressao').innerHTML}</body></html>`);
      jan.document.close();
      jan.focus();
      setTimeout(() => { jan.print(); }, 300);
    } else {
      window.print();
    }
  } catch (e) {
    erro(T('err.printBlocked'));
  }
}

// CSV com BOM (acentos corretos no Excel) e separador ";" (padrão de planilhas em PT-BR)
function exportarCSV() {
  if (!st.res || !st.res.colocados.length) { erro(T('err.nothingToExport')); return; }
  try {
    const linhas = linhasPlano();
    const cab = ['seq', 'codigo', 'nome', 'vagao', 'x_m', 'y_m', 'z_m', 'comprimento_m', 'largura_m', 'altura_m', 'peso_kg'];
    const campo = (v) => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
    const corpo = linhas.map((r) => [r.seq, r.codigo, r.nome, r.vagao, r.x, r.y, r.z, r.c, r.l, r.h, r.peso].map(campo).join(';'));
    const csv = '﻿' + [cab.join(';')].concat(corpo).join('\r\n');
    if (dentroDeIframe) {
      // dentro de um iframe de outra origem, uma aba nova não acessa um blob: criado no iframe (fica
      // preso ao processo dele), e o Chrome bloqueia navegar direto para uma data: URL. Solução: abrir
      // a aba primeiro (ainda dentro do clique do usuário) e criar o Blob com os objetos da própria
      // aba nova, navegando-a para a URL que ela mesma gerou — assim o download roda no contexto dela
      const jan = window.open('', '_blank');
      if (!jan) throw new Error('popup bloqueado');
      const blob = new jan.Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = jan.URL.createObjectURL(blob);
      const a = jan.document.createElement('a');
      a.href = url;
      a.download = `nexora-plano-carga-${new Date().toISOString().slice(0, 10)}.csv`;
      jan.document.body.appendChild(a);
      a.click();
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexora-plano-carga-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    sucesso(T('msg.csvExported'));
  } catch (e) {
    erro(T('err.exportFailed'));
  }
}

const btnImprimir = $('#btnImprimir');
if (btnImprimir) btnImprimir.addEventListener('click', imprimirPlano);
const btnExportarCSV = $('#btnExportarCSV');
if (btnExportarCSV) btnExportarCSV.addEventListener('click', exportarCSV);
