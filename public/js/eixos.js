/*
 * Peso por eixo.
 *
 * Posição dos eixos de cada tipo de veículo (a mesma usada no desenho 3D), tara e
 * limite de cada grupo de eixos, e a divisão do peso da carga entre eles por
 * equilíbrio de momentos (estática de viga bi-apoiada).
 *
 * Coordenadas: x em metros a partir da parede da frente do 1º vagão (negativo = cabine).
 *
 * Limites legais (Resolução CONTRAN 882/2021):
 *   eixo isolado com 2 pneus 6 t · eixo isolado com 4 pneus 10 t
 *   dois eixos em tandem 17 t · três eixos em tandem 25,5 t
 * Tolerância na pesagem: 12,5% por eixo e 5% no peso bruto total.
 * Van, baú leve e 3/4 usam o limite técnico típico do fabricante, que é menor que o legal.
 * Taras e limites técnicos são estimativas: ajuste em Configurações com os dados do veículo.
 *
 * Funciona no navegador (window.Eixos) e no Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Eixos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GAP = 1.2;            // mesmo espaço entre vagões do Packer
  const PINO_REI = 0.6;       // pino-rei (quinta roda) um pouco à frente do tandem de tração
  const TOL_EIXO = 0.125, TOL_PBT = 0.05, PBT_MAX = 74000;

  function tipoModelo(v) {
    const nome = String(v.nome || '').toLowerCase();
    const cat = v.categoria || '';
    const L = +v.c, n = Math.max(1, +v.vagoes | 0);
    if (/\bvan\b/.test(nome)) return 'van';
    if (cat === 'outros' || /iveco|daily/.test(nome)) return L <= 3.4 ? 'van' : 'leve';
    if (cat === 'container' || /container/.test(nome)) return 'container';
    if (cat === 'carreta' || cat === 'rodotrem' || n > 1) return 'carreta';
    if (cat === 'tres_quarto') return 'tresquartos';
    if (cat === 'truck') return 'truck';
    return L <= 3.4 ? 'van' : L <= 4.5 ? 'leve' : L <= 6.5 ? 'tresquartos' : L <= 11 ? 'truck' : 'carreta';
  }

  // Número de eixos do semirreboque: rodotrem usa 2 por vagão (9 eixos no total)
  const eixosSemi = (L, n) => (n > 1 ? 2 : L > 11 ? 3 : 2);
  const limiteConjunto = (k) => (k >= 3 ? 25500 : k === 2 ? 17000 : 10000);

  /* Geometria e valores padrão de cada grupo de eixos.
   * apoio: em qual corpo o grupo está ('veiculo', 'cavalo' ou 'vagao<i>'). */
  function geometria(v) {
    const tipo = tipoModelo(v), L = +v.c, n = Math.max(1, +v.vagoes | 0);
    const g = [];
    const grupo = (id, nome, xs, limite, tara, rodas) => g.push({ id, nome, xs, x: xs.reduce((a, b) => a + b, 0) / xs.length, limite, tara, rodas });
    const comCavalo = tipo === 'carreta' || tipo === 'container';
    if (tipo === 'van') {
      grupo('dianteiro', 'Eixo dianteiro', [-1.42], 1850, 1250, 'simples');
      grupo('traseiro', 'Eixo traseiro', [L - 0.95], 2450, 1000, 'simples');
    } else if (tipo === 'leve') {
      grupo('dianteiro', 'Eixo dianteiro', [-1.65], 2300, 1600, 'simples');
      grupo('traseiro', 'Eixo traseiro', [L * 0.64], 3900, 1200, 'dupla');
    } else if (tipo === 'tresquartos') {
      grupo('dianteiro', 'Eixo dianteiro', [-1.24], 3500, 2400, 'simples');
      grupo('traseiro', 'Eixo traseiro', [L * 0.62], 6500, 1900, 'dupla');
    } else if (tipo === 'truck') {
      grupo('dianteiro', 'Eixo dianteiro', [-1.5], 6000, 4900, 'simples');
      grupo('traseiro', 'Eixos traseiros (tandem)', [L * 0.6 - 0.66, L * 0.6 + 0.66], 17000, 5100, 'dupla');
    } else {
      // cavalo mecânico 6x2 + semirreboque(s)
      grupo('dianteiro', 'Eixo dianteiro do cavalo', [-2.65], 6000, 5200, 'simples');
      const taraTracao = tipo === 'container' ? (L > 13 ? 8300 : L > 11 ? 7900 : 7000) : n > 1 ? 7000 : 6700;
      grupo('tracao', 'Eixos de tração (cavalo)', [0.5, 1.82], 17000, taraTracao, 'dupla');
      for (let i = 0; i < n; i++) {
        const ox = i * (L + GAP), k = eixosSemi(L, n), xs = [];
        for (let e = k - 1; e >= 0; e--) xs.push(ox + L - 1.3 - e * 1.32);
        if (i > 0) grupo('dolly' + i, `Dolly do ${i + 1}º vagão`, [ox + 0.75, ox + 2.05], 17000, 3600, 'dupla');
        const taraSemi = tipo === 'container' ? (L > 13 ? 6300 : L > 11 ? 5800 : 3800) : n > 1 ? (i ? 4200 : 4000) : 4700;
        grupo('semi' + i, n > 1 ? `Eixos do ${i + 1}º vagão` : 'Eixos do semirreboque', xs, limiteConjunto(k), taraSemi, 'dupla');
      }
    }
    return { tipo, comCavalo, n, L, grupos: g };
  }

  /* Divide o peso da carga entre os eixos.
   * cfg: { tara: {id: kg}, limite: {id: kg} } sobrescreve os valores padrão. */
  function calcular(v, colocados, cfg) {
    const geo = geometria(v), c = cfg || {};
    const grupos = geo.grupos.map((gr) => Object.assign({}, gr, {
      tara: c.tara && c.tara[gr.id] != null ? +c.tara[gr.id] : gr.tara,
      limite: c.limite && c.limite[gr.id] != null ? +c.limite[gr.id] : gr.limite,
      carga: 0,
    }));
    const G = Object.fromEntries(grupos.map((g) => [g.id, g]));
    // divide uma força F aplicada em x entre dois apoios (xa, xb)
    const dividir = (F, x, a, b) => {
      const t = (x - a.x) / (b.x - a.x);
      a.carga += F * (1 - t);
      b.carga += F * t;
    };
    const pino = { x: PINO_REI, carga: 0 };
    for (const cx of colocados) {
      const F = cx.peso, x = cx.gx + cx.dx / 2;
      if (!geo.comCavalo) dividir(F, x, G.dianteiro, G.traseiro);
      else if (cx.vagao === 0) dividir(F, x, pino, G.semi0);
      else dividir(F, x, G['dolly' + cx.vagao], G['semi' + cx.vagao]);
    }
    if (geo.comCavalo) dividir(pino.carga, pino.x, G.dianteiro, G.tracao);

    const situacao = (total, limite, tol) =>
      total <= limite + 0.5 ? 'ok' : total <= limite * (1 + tol) + 0.5 ? 'tolerancia' : 'excesso';
    grupos.forEach((g) => {
      g.total = g.tara + g.carga;
      g.uso = g.limite > 0 ? g.total / g.limite : 0;
      g.situacao = situacao(g.total, g.limite, TOL_EIXO);
    });
    const tara = grupos.reduce((s, g) => s + g.tara, 0);
    const carga = grupos.reduce((s, g) => s + g.carga, 0);
    const pbtLimite = Math.min(PBT_MAX, grupos.reduce((s, g) => s + g.limite, 0));
    const pbt = {
      tara, carga, total: tara + carga, limite: pbtLimite,
      uso: (tara + carga) / pbtLimite,
      situacao: situacao(tara + carga, pbtLimite, TOL_PBT),
    };
    const pior = [pbt, ...grupos].some((g) => g.situacao === 'excesso') ? 'excesso'
      : [pbt, ...grupos].some((g) => g.situacao === 'tolerancia') ? 'tolerancia' : 'ok';
    return { tipo: geo.tipo, grupos, pbt, situacao: pior };
  }

  return { tipoModelo, geometria, calcular, TOL_EIXO, TOL_PBT };
});
