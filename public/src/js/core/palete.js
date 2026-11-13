/* NEXORA — Paletização: quantas caixas cabem em cada camada e em cada palete.
 * Padrões de camada testados (o melhor vence):
 *  - bloco: todas as caixas no mesmo sentido;
 *  - dois blocos: parte no sentido A e o resto girado 90° (corte no comprimento ou na largura do palete),
 *    como os padrões "em bloco" e "amarrado" que os paletizadores usam.
 * Respeita: medidas do palete, folga/sobra permitida na borda, altura máxima da carga, peso máximo do palete,
 * quantas caixas a de baixo aguenta em cima e se a caixa pode deitar. Sem dependências (navegador e Node).
 */
(function (root) {
  'use strict';
  const EPS = 1e-9;
  const PALETES = {
    pbr: { nome: 'PBR (1,20 × 1,00 m)', L: 1.2, W: 1.0, h: 0.15, tara: 25, max: 1200 },
    euro: { nome: 'Europeu (1,20 × 0,80 m)', L: 1.2, W: 0.8, h: 0.144, tara: 25, max: 1500 },
    americano: { nome: 'Americano (1,22 × 1,02 m)', L: 1.219, W: 1.016, h: 0.14, tara: 22, max: 1100 },
    quimico: { nome: 'Químico (1,20 × 1,20 m)', L: 1.2, W: 1.2, h: 0.156, tara: 30, max: 1250 },
    descartavel: { nome: 'Descartável (1,20 × 1,00 m)', L: 1.2, W: 1.0, h: 0.12, tara: 12, max: 600 }
  };
  const fl = (a, b) => Math.floor((a + EPS) / b);
  /* melhor camada de caixas a×b num palete L×W; devolve contagem e retângulos (x, y, l, w) */
  function camada(a, b, L, W) {
    let best = { n: 0, rects: [], nome: '' };
    const bloco = (x0, y0, LL, WW, l, w) => { const r = []; for (let i = 0; i < fl(LL, l); i++) for (let j = 0; j < fl(WW, w); j++) r.push({ x: x0 + i * l, y: y0 + j * w, l, w }); return r; };
    const tenta = (rects, nome) => { if (rects.length > best.n) best = { n: rects.length, rects, nome }; };
    tenta(bloco(0, 0, L, W, a, b), 'bloco'); tenta(bloco(0, 0, L, W, b, a), 'bloco girado');
    for (const [p, q] of [[a, b], [b, a]]) {
      for (let i = 1; i * p < L + EPS; i++) tenta(bloco(0, 0, i * p, W, p, q).concat(bloco(i * p, 0, L - i * p, W, q, p)), 'dois blocos');
      for (let j = 1; j * q < W + EPS; j++) tenta(bloco(0, 0, L, j * q, p, q).concat(bloco(0, j * q, L, W - j * q, q, p)), 'dois blocos');
    }
    /* centraliza na base do palete */
    if (best.n) { const mx = Math.max(...best.rects.map(r => r.x + r.l)), my = Math.max(...best.rects.map(r => r.y + r.w)), dx = (L - mx) / 2, dy = (W - my) / 2; best.rects.forEach(r => { r.x += dx; r.y += dy; }); }
    return best;
  }
  /* caixa {l,w,h,kg,q, deita, empilha (quantas aguenta em cima; 0 = sem limite)} · palete {L,W,h,tara,max} · opções {altMax (altura total), sobra (m de cada lado)} */
  function paletizar(cx, pal, op = {}) {
    const altMax = +op.altMax || 1.6, sobra = Math.max(0, +op.sobra || 0), L = pal.L + 2 * sobra, W = pal.W + 2 * sobra;
    const hUtil = altMax - pal.h;
    const faces = [[cx.l, cx.w, cx.h]]; if (cx.deita) faces.push([cx.l, cx.h, cx.w], [cx.w, cx.h, cx.l]);
    let best = null;
    for (const [a, b, h] of faces) {
      if (!(a > 0 && b > 0 && h > 0)) continue;
      const c = camada(a, b, L, W); if (!c.n) continue;
      let cam = fl(hUtil, h); if (cx.empilha > 0) cam = Math.min(cam, cx.empilha + 1);
      let porPal = c.n * cam;
      const porPeso = cx.kg > 0 ? Math.floor((pal.max + EPS) / cx.kg) : Infinity;
      let limite = ''; if (porPeso < porPal) { porPal = porPeso; limite = 'peso'; cam = Math.ceil(porPal / c.n); } else if (cx.empilha > 0 && cam === cx.empilha + 1 && fl(hUtil, h) > cam) limite = 'empilhamento'; else limite = 'altura';
      if (porPal < 1) continue;
      const cand = { face: [a, b, h], camada: c, camadas: cam, porPal, limite, aprov: c.n * a * b / (pal.L * pal.W) };
      if (!best || cand.porPal > best.porPal || (cand.porPal === best.porPal && cand.camadas < best.camadas)) best = cand;
    }
    if (!best) return { erro: cx.kg > pal.max ? 'A caixa pesa mais que o palete aguenta.' : 'A caixa não cabe no palete com essa altura.' };
    const q = Math.max(0, Math.round(+cx.q || 0)), cheios = Math.floor(q / best.porPal), resto = q - cheios * best.porPal;
    const [a, b, h] = best.face, lado = best.camada.rects.map(r => ({ ...r, x: +(r.x - sobra).toFixed(4), y: +(r.y - sobra).toFixed(4) }));
    const medidas = n => { const camN = Math.ceil(n / best.camada.n); return { caixas: n, camadas: camN, alt: +(pal.h + camN * h).toFixed(3), kg: +(pal.tara + n * (+cx.kg || 0)).toFixed(1),
      L: +Math.max(pal.L, Math.max(...lado.map(r => r.x + r.l)) - Math.min(...lado.map(r => r.x)) ).toFixed(3), W: +Math.max(pal.W, Math.max(...lado.map(r => r.y + r.w)) - Math.min(...lado.map(r => r.y))).toFixed(3) }; };
    return { face: { l: a, w: b, h }, porCamada: best.camada.n, padrao: best.camada.nome, rects: lado, camadas: best.camadas, porPal: best.porPal, limite: best.limite, aprov: best.aprov,
      cheios, resto, paletes: cheios + (resto ? 1 : 0), cheio: cheios ? medidas(best.porPal) : null, parcial: resto ? medidas(resto) : null };
  }
  const API = { PALETES, camada, paletizar };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.NX_PAL = API;
})(typeof self !== 'undefined' ? self : this);
