/* NEXORA — cálculos de carga: peso cubado, metros lineares de piso (LDM), amarração por atrito (EN 12195-1)
 * e peso bruto verificado do contêiner (VGM, SOLAS cap. VI regra 2 — método 2). Sem dependências (navegador e Node).
 */
(function (root) {
  'use strict';
  const G = 9.81;

  /* ---------- peso cubado e LDM ---------- */
  /* fator rodoviário de referência: 300 kg/m³ (carga fechada); fracionada costuma usar 200–250 */
  function cubado(items, fator = 300) {
    const m3 = items.reduce((s, i) => s + i.l * i.w * i.h, 0), kg = items.reduce((s, i) => s + (+i.kg || 0), 0), cub = m3 * fator;
    return { m3, kg, cubado: cub, taxavel: Math.max(kg, cub), base: cub > kg ? 'cubado' : 'real', densidade: m3 ? kg / m3 : 0, fator };
  }
  /* metros lineares de piso (loading meters): área de piso ocupada ÷ largura padrão de 2,40 m;
   * também o comprimento de piso efetivamente usado em cada compartimento */
  function ldm(items, larguraRef = 2.4) {
    const piso = items.filter(i => i.z < 0.01).reduce((s, i) => s + i.l * i.w, 0);
    const porComp = {}; for (const i of items) porComp[i.wg || 0] = Math.max(porComp[i.wg || 0] || 0, i.x + i.l);
    return { ldm: piso / larguraRef, area: piso, comprimento: Object.values(porComp).reduce((s, v) => s + v, 0) };
  }

  /* ---------- amarração por atrito (EN 12195-1:2010, amarração de topo) ----------
   * n ≥ (c − μ·cz)·m·g / (2·μ·sen α·FT) · fs     fs = 1,1 longitudinal, 1,0 transversal
   * coeficientes rodoviários: frente 0,8 g · trás 0,5 g · lateral 0,5 g · vertical 1,0 g
   * FT = STF da catraca (força de tensionamento padrão, daN, escrita na etiqueta da cinta) */
  const ATRITO = [
    ['madeira-madeira', 'Madeira/palete sobre madeira', 0.45], ['madeira-aluminio', 'Madeira/palete sobre piso de alumínio', 0.4],
    ['madeira-aco', 'Madeira/palete sobre chapa de aço', 0.3], ['papelao', 'Caixa de papelão / filme stretch', 0.3],
    ['aco-aco', 'Aço sobre aço (bobina, chapa)', 0.2], ['bigbag', 'Big bag sobre madeira', 0.4], ['manta', 'Com manta antiderrapante', 0.6]
  ];
  function cintasTopo(kg, op = {}) {
    const mu = op.mu != null ? +op.mu : 0.45, stf = op.stf || 400, ang = (op.ang || 60) * Math.PI / 180, travaFrente = op.travaFrente !== false, travaTras = !!op.travaTras, travaLado = !!op.travaLado;
    const daN = kg * G / 10;
    const n = (c, fs) => c <= mu ? 0 : Math.ceil(((c - mu) * daN) / (2 * mu * Math.sin(ang) * stf) * fs - 1e-9);
    const r = { frente: travaFrente ? 0 : n(0.8, 1.1), tras: travaTras ? 0 : n(0.5, 1.1), lado: travaLado ? 0 : n(0.5, 1.0) };
    r.n = Math.max(r.frente, r.tras, r.lado); r.mu = mu; r.stf = stf; r.ang = op.ang || 60;
    r.porque = r.n === r.frente && r.n ? 'frenagem' : r.n === r.tras && r.n ? 'aceleração/ré' : r.n ? 'curvas' : 'atrito suficiente';
    return r;
  }

  /* ---------- VGM (peso bruto verificado do contêiner, SOLAS) ---------- */
  /* taras e peso bruto máximo (placa CSC) de referência; confira a placa do seu contêiner */
  const CONTEINER = { "Container 20' DC": { tara: 2230, max: 30480 }, "Container 40' HC": { tara: 3900, max: 30480 }, "Container 45' HC": { tara: 4800, max: 32500 } };
  function vgm(items, v, op = {}) {
    const ref = CONTEINER[v.name] || { tara: op.tara || 0, max: op.max || 0 };
    const tara = op.tara != null && op.tara !== '' ? +op.tara : ref.tara, max = op.max ? +op.max : ref.max;
    const carga = items.reduce((s, i) => s + (+i.kg || 0), 0), escora = +op.escora || 0;
    const total = carga + escora + tara;
    return { carga, escora, tara, total, max, folga: max ? max - total : null, ok: !max || total <= max };
  }

  const API = { cubado, ldm, ATRITO, cintasTopo, CONTEINER, vgm };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.NX_CARGA = API;
})(typeof window !== 'undefined' ? window : globalThis);
