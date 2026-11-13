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
  /* Tabela A — carga lotação, contratação da composição veicular ou caminhão simples */
  const A = {
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
  const NOMES = {}; for (const k in A) NOMES[k] = A[k].nome;
  const mk = o => { const r = {}; for (const k in o) r[k] = { nome: NOMES[k], ccd: o[k].ccd, cc: o[k].cc }; return r; };
  /* Tabela B — carga lotação, contratação APENAS da unidade de tração (cavalo) */
  const B = mk({
      'granel-solido': { ccd: [_, _, 5.3538, 6.09, 6.7863, 7.2181, 8.0379], cc: [_, _, 533.4, 594.62, 608.99, 720.31, 773.22] },
      'granel-liquido': { ccd: [_, _, 5.4189, 6.1551, 6.8514, 7.2832, 8.103], cc: [_, _, 533.4, 594.62, 608.99, 720.31, 773.22] },
      'frigorificada': { ccd: [_, _, 6.2988, 7.1428, 7.9617, 8.4117, 9.3892], cc: [_, _, 584.04, 645.26, 659.62, 775.96, 831.06] },
      'conteinerizada': { ccd: [_, _, 5.3538, 6.09, 6.7863, 7.2181, 8.0379], cc: [_, _, 533.4, 594.62, 608.99, 720.31, 773.22] },
      'geral': { ccd: [_, _, 5.3538, 6.09, 6.7863, 7.2181, 8.0379], cc: [_, _, 533.4, 594.62, 608.99, 720.31, 773.22] },
      'neogranel': { ccd: [_, _, 5.3538, 6.09, 6.7863, 7.2181, 8.0379], cc: [_, _, 533.4, 594.62, 608.99, 720.31, 773.22] },
      'perig-solido': { ccd: [_, _, 6.1705, 6.9067, 7.603, 8.053, 8.8808], cc: [_, _, 689.44, 750.65, 765.02, 881.36, 936.46] },
      'perig-liquido': { ccd: [_, _, 6.2156, 6.9518, 7.6481, 8.0981, 8.9259], cc: [_, _, 701.84, 763.06, 777.43, 893.76, 948.87] },
      'perig-frigo': { ccd: [_, _, 6.9361, 7.7801, 8.599, 9.0727, 10.0606], cc: [_, _, 705.04, 766.25, 780.62, 903.48, 961.43] },
      'perig-conteiner': { ccd: [_, _, 5.7749, 6.5111, 7.2074, 7.6574, 8.4853], cc: [_, _, 639.21, 700.42, 714.79, 831.13, 886.23] },
      'perig-geral': { ccd: [_, _, 5.7749, 6.5111, 7.2074, 7.6574, 8.4853], cc: [_, _, 639.21, 700.42, 714.79, 831.13, 886.23] },
      'pressurizada': { ccd: [_, _, _, 6.09, 6.7863, _, 8.0379], cc: [_, _, _, 594.62, 608.99, _, 773.22] }
    });
  /* Tabela C — carga lotação de ALTO DESEMPENHO, contratação da composição veicular ou caminhão simples */
  const C = mk({
      'granel-solido': { ccd: [3.4876, 4.4476, 5.0799, 5.829, 6.5029, 6.8871, 7.8999], cc: [174.38, 198.05, 215.03, 229.64, 232.91, 270.36, 292.59] },
      'granel-liquido': { ccd: [3.535, 4.5028, 5.1771, 5.931, 6.6068, 6.9785, 7.9988], cc: [176.84, 201.78, 220.31, 235.73, 239.32, 274.7, 298.16] },
      'frigorificada': { ccd: [4.1786, 5.3115, 6.0901, 6.9516, 7.747, 8.2358, 9.3985], cc: [205.65, 232.97, 256.16, 271.54, 274.63, 329.34, 351.6] },
      'conteinerizada': { ccd: [_, 4.4378, 5.054, 5.8061, 6.4794, 6.8862, 7.8701], cc: [_, 196.43, 210.75, 225.87, 229.04, 270.22, 287.67] },
      'geral': { ccd: [3.4762, 4.4341, 5.0693, 5.8195, 6.4924, 6.9018, 7.8926], cc: [172.5, 195.81, 213.27, 228.08, 231.17, 272.8, 291.39] },
      'neogranel': { ccd: [3.0767, 4.4335, 5.0791, 5.8195, 6.4924, 6.9018, 7.8926], cc: [172.5, 195.72, 214.89, 228.08, 231.17, 272.8, 291.39] },
      'perig-solido': { ccd: [4.0241, 4.9948, 5.6653, 6.4144, 7.0883, 7.4921, 8.5135], cc: [224.77, 250.19, 270.47, 285.09, 288.36, 329.05, 352.7] },
      'perig-liquido': { ccd: [4.0551, 5.0336, 5.7135, 6.4674, 7.1433, 7.5346, 8.5635], cc: [229.89, 256.6, 278.43, 293.85, 297.43, 336.06, 360.94] },
      'perig-frigo': { ccd: [4.6738, 5.8205, 6.6174, 7.4789, 8.2743, 8.7886, 9.9625], cc: [253.51, 283.12, 310.6, 325.98, 329.07, 388.0, 412.1] },
      'perig-conteiner': { ccd: [_, 4.7065, 5.3608, 6.1129, 6.7862, 7.2127, 8.2051], cc: [_, 237.75, 255.37, 270.49, 273.66, 318.08, 336.95] },
      'perig-geral': { ccd: [3.7341, 4.7027, 5.3761, 6.1263, 6.7992, 7.2283, 8.2277], cc: [212.06, 237.13, 257.89, 272.7, 275.79, 320.66, 340.67] },
      'pressurizada': { ccd: [_, _, _, 5.9504, 6.6398, _, 8.0871], cc: [_, _, _, 249.68, 255.5, _, 323.48] }
    });
  /* Tabela D — carga lotação de ALTO DESEMPENHO, contratação APENAS da unidade de tração */
  const D = mk({
      'granel-solido': { ccd: [_, _, 4.6343, 5.2278, 5.8907, 6.1067, 6.8223], cc: [_, _, 201.32, 214.52, 217.61, 248.8, 263.35] },
      'granel-liquido': { ccd: [_, _, 4.6994, 5.2929, 5.9558, 6.1718, 6.8874], cc: [_, _, 201.32, 214.52, 217.61, 248.8, 263.35] },
      'frigorificada': { ccd: [_, _, 5.5936, 6.2949, 7.0803, 7.316, 8.1899], cc: [_, _, 234.06, 247.25, 250.34, 284.78, 300.75] },
      'conteinerizada': { ccd: [_, _, 4.6343, 5.2278, 5.8907, 6.1067, 6.8223], cc: [_, _, 201.32, 214.52, 217.61, 248.8, 263.35] },
      'geral': { ccd: [_, _, 4.6343, 5.2278, 5.8907, 6.1067, 6.8223], cc: [_, _, 201.32, 214.52, 217.61, 248.8, 263.35] },
      'neogranel': { ccd: [_, _, 4.6343, 5.2278, 5.8907, 6.1067, 6.8223], cc: [_, _, 201.32, 214.52, 217.61, 248.8, 263.35] },
      'perig-solido': { ccd: [_, _, 5.2197, 5.8131, 6.476, 6.7117, 7.4359], cc: [_, _, 256.77, 269.96, 273.05, 307.49, 323.46] },
      'perig-liquido': { ccd: [_, _, 5.2359, 5.8293, 6.4922, 6.7279, 7.4521], cc: [_, _, 259.44, 272.63, 275.73, 310.16, 326.13] },
      'perig-frigo': { ccd: [_, _, 6.1208, 6.8222, 7.6076, 7.8688, 8.7539], cc: [_, _, 288.5, 301.69, 304.78, 343.44, 361.25] },
      'perig-conteiner': { ccd: [_, _, 4.9411, 5.5346, 6.1975, 6.4332, 7.1574], cc: [_, _, 245.95, 259.14, 262.23, 296.67, 312.64] },
      'perig-geral': { ccd: [_, _, 4.9411, 5.5346, 6.1975, 6.4332, 7.1574], cc: [_, _, 245.95, 259.14, 262.23, 296.67, 312.64] },
      'pressurizada': { ccd: [_, _, _, 5.2278, 5.8907, _, 6.8223], cc: [_, _, _, 214.52, 217.61, _, 263.35] }
    });
  const OFICIAL = { A, B, C, D };
  const TABELAS = {
    A: { nome: 'Tabela A — Lotação (veículo completo)', desc: 'Você contrata o caminhão ou a composição inteira (cavalo + carreta), com motorista. É o caso mais comum.' },
    B: { nome: 'Tabela B — Lotação, só o cavalo', desc: 'Você contrata apenas a unidade de tração (o cavalo com motorista); a carreta é sua ou de terceiros.' },
    C: { nome: 'Tabela C — Alto desempenho (veículo completo)', desc: 'Operação de alto desempenho (definição da ANTT: maior produtividade do veículo, com carga e descarga em tempo reduzido), contratando o veículo completo.' },
    D: { nome: 'Tabela D — Alto desempenho, só o cavalo', desc: 'Alto desempenho, contratando apenas a unidade de tração.' }
  };
  /* valores personalizados pelo usuário (tela Configurações › Tabela ANTT) — guardados no navegador */
  const OVR_KEY = 'nexora_antt_override';
  let ovr = null; try { ovr = JSON.parse((root.localStorage && root.localStorage.getItem(OVR_KEY)) || 'null'); } catch (e) { ovr = null; }
  const tab = t => (ovr && ovr.tabs && ovr.tabs[t]) || OFICIAL[t] || OFICIAL.A;
  /* coeficiente para o nº de eixos: usa a coluna; se vazia, a coluna inferior mais próxima com valor (ou a superior) */
  function coef(tipo, eixos, t) {
    const T = tab(t || 'A'), c = T[tipo] || T.geral; let i = EIXOS.indexOf(eixos);
    if (i < 0) i = eixos > 9 ? 6 : eixos === 8 ? 5 : 0;
    for (let k = i; k >= 0; k--) if (c.ccd[k] != null) return { ccd: c.ccd[k], cc: c.cc[k], eixos: EIXOS[k] };
    for (let k = i; k < EIXOS.length; k++) if (c.ccd[k] != null) return { ccd: c.ccd[k], cc: c.cc[k], eixos: EIXOS[k] };
    return null;
  }
  const piso = (km, tipo, eixos, t) => { const c = coef(tipo, eixos, t); return c ? { ...c, km, valor: km * c.ccd + c.cc } : null; };
  /* retorno vazio (Res. ANTT 5.867/2020): 92% do CCD × distância de retorno — obrigatório para contêiner e frota dedicada/fidelizada */
  const RETORNO = 0.92;
  const retorno = (kmVolta, tipo, eixos, t) => { const c = coef(tipo, eixos, t); return c ? { ccd: c.ccd, km: kmVolta, valor: kmVolta * c.ccd * RETORNO } : null; };
  const ANTT = {
    fonte: 'Res. ANTT 6.084/2026 com Portaria SUROC nº 22/2026, vigente desde 30/09/2026', EIXOS, TABELAS, OFICIAL, NOMES, RETORNO,
    get T() { return tab('A'); }, tabela: tab, coef, piso, retorno,
    personalizado: () => !!(ovr && ovr.tabs),
    salvar(tabs, nota) { ovr = { tabs, nota: nota || '', data: new Date().toISOString() }; try { root.localStorage.setItem(OVR_KEY, JSON.stringify(ovr)); } catch (e) {} },
    restaurar() { ovr = null; try { root.localStorage.removeItem(OVR_KEY); } catch (e) {} },
    info: () => ovr
  };
  if (typeof module === 'object' && module.exports) module.exports = ANTT; else root.NX_ANTT = ANTT;
})(typeof window !== 'undefined' ? window : globalThis);
