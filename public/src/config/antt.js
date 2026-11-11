/* NEXORA — Piso mínimo de frete ANTT (Lei 13.703/2018)
 * Tabela A — Transporte Rodoviário de Carga Lotação (contratação do veículo completo)
 * Coeficientes da Resolução ANTT nº 6.084/2026 reajustados pela Portaria SUROC nº 22, de 28/09/2026
 * (vigente a partir de 30/09/2026 — diesel S10 de referência R$ 7,33/L).
 * Piso = distância (km) × CCD (R$/km) + CC (R$, carga e descarga, uma vez por viagem).
 * Quando a ANTT publicar nova tabela, atualize apenas os números abaixo.
 */
(function (root) {
  const EIXOS = [2, 3, 4, 5, 6, 7, 9];
  const _ = null;
  /* [CCD por eixo], [CC por eixo] — na ordem de EIXOS */
  const T = {
    'granel-solido':   { nome: 'Granel sólido', ccd: [4.1056, 5.2555, 5.9476, 6.8548, 7.5641, 8.2316, 9.4318], cc: [460.59, 552.24, 597.00, 664.83, 680.01, 820.34, 908.91] },
    'granel-liquido':  { nome: 'Granel líquido', ccd: [4.1796, 5.3511, 6.1019, 7.0226, 7.7372, 8.3700, 9.5909], cc: [471.98, 569.57, 621.52, 693.08, 709.72, 840.50, 934.76] },
    'frigorificada':   { nome: 'Frigorificada ou aquecida', ccd: [4.8234, 6.1659, 7.0345, 8.0623, 8.8911, 9.8134, 11.1479], cc: [520.07, 623.27, 686.63, 757.98, 772.35, 982.76, 1067.06] },
    'conteinerizada':  { nome: 'Conteinerizada', ccd: [_, 5.2282, 5.8755, 6.7910, 7.4986, 8.2292, 9.3486], cc: [_, 544.75, 577.15, 647.29, 662.01, 819.69, 886.05] },
    'geral':           { nome: 'Carga geral', ccd: [4.0738, 5.2177, 5.9180, 6.8284, 7.5347, 8.2727, 9.4114], cc: [451.84, 541.86, 588.86, 657.56, 671.93, 831.66, 903.32] },
    'neogranel':       { nome: 'Neogranel', ccd: [3.6743, 5.2162, 5.9453, 6.8284, 7.5347, 8.2727, 9.4114], cc: [451.84, 541.44, 596.35, 657.56, 671.93, 831.66, 903.32] },
    'perig-solido':    { nome: 'Perigosa (granel sólido)', ccd: [4.8756, 6.0354, 6.7644, 7.6715, 8.3808, 9.0666, 10.2747], cc: [608.79, 703.16, 753.03, 820.86, 836.04, 981.39, 1072.15] },
    'perig-liquido':   { nome: 'Perigosa (granel líquido)', ccd: [4.9621, 6.1436, 6.8986, 7.8193, 8.5339, 9.1849, 10.4138], cc: [632.58, 732.90, 789.96, 861.51, 878.16, 1013.95, 1110.41] },
    'perig-frigo':     { nome: 'Perigosa (frigorificada ou aquecida)', ccd: [5.4315, 6.7869, 7.6718, 8.6996, 9.5284, 10.4745, 11.8192], cc: [630.88, 737.63, 807.63, 878.98, 893.35, 1110.28, 1197.43] },
    'perig-conteiner': { nome: 'Perigosa (conteinerizada)', ccd: [_, 5.6126, 6.2966, 7.2121, 7.9198, 8.6686, 9.7960], cc: [_, 645.45, 682.95, 753.10, 767.81, 930.51, 999.06] },
    'perig-geral':     { nome: 'Perigosa (carga geral)', ccd: [4.4482, 5.6021, 6.3392, 7.2495, 7.9558, 8.7121, 9.8588], cc: [549.81, 642.55, 694.66, 763.36, 777.73, 942.48, 1016.33] },
    'pressurizada':    { nome: 'Granel pressurizada', ccd: [_, _, _, 7.1929, 7.9452, _, 9.9531], cc: [_, _, _, 757.81, 784.82, _, 1052.26] }
  };
  /* coeficiente para o nº de eixos: usa a coluna; se vazia, a coluna inferior mais próxima com valor (ou a superior) */
  function coef(tipo, eixos) {
    const t = T[tipo] || T.geral; let i = EIXOS.indexOf(eixos);
    if (i < 0) i = eixos > 9 ? 6 : eixos === 8 ? 5 : 0;
    for (let k = i; k >= 0; k--) if (t.ccd[k] != null) return { ccd: t.ccd[k], cc: t.cc[k], eixos: EIXOS[k] };
    for (let k = i; k < EIXOS.length; k++) if (t.ccd[k] != null) return { ccd: t.ccd[k], cc: t.cc[k], eixos: EIXOS[k] };
    return null;
  }
  const piso = (km, tipo, eixos) => { const c = coef(tipo, eixos); return c ? { ...c, km, valor: km * c.ccd + c.cc } : null; };
  const ANTT = { fonte: 'Tabela A (carga lotação) — Res. ANTT 6.084/2026 com Portaria SUROC nº 22/2026, vigente desde 30/09/2026', EIXOS, T, coef, piso };
  if (typeof module === 'object' && module.exports) module.exports = ANTT; else root.NX_ANTT = ANTT;
})(typeof window !== 'undefined' ? window : globalThis);
