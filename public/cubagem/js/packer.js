/*
 * Packer 3D — heurística Extreme Points (Crainic, Perboli & Tadei, 2008)
 *
 * Eixos (mesmos da interface):
 *   X = comprimento (frente da carroceria -> porta)
 *   Y = largura
 *   Z = altura
 *
 * Restrições físicas consideradas:
 *   - limites internos do baú (comprimento, largura, altura)
 *   - nenhuma sobreposição entre volumes
 *   - orientações permitidas por produto (fixa, "este lado para cima", livre)
 *   - apoio mínimo da base (% da área apoiada no piso ou em topos de outras caixas)
 *   - peso máximo sobre cada volume ("aguenta X kg em cima"; 0 = não empilha).
 *     O peso de cada caixa colocada desce pelas caixas de baixo, dividido pela
 *     área de contato, e nenhuma caixa da pilha pode passar do seu limite
 *   - paletes: entram como um volume com N peças; vão primeiro, junto à frente
 *   - capacidade de peso do veículo (dividida igualmente entre vagões)
 *
 * Funciona no navegador (window.Packer) e no Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Packer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EPS = 1e-6;
  const GAP_VAGOES = 1.2; // espaço visual/físico entre vagões (m)
  const arred = (v) => Math.round(v * 10000) / 10000;
  const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---------- Orientações ----------
   * Cada orientação é [dx, dy, dz]: medida ao longo do comprimento do baú, da largura e da altura.
   *   auto        em pé, gira no piso e escolhe o melhor encaixe
   *   comprimento em pé, C da caixa ao longo do comprimento do baú
   *   largura     em pé, C da caixa atravessado (na largura do baú)
   *   deitado     a altura da caixa fica na horizontal
   *   livre       qualquer posição (em pé ou deitado)
   * 'vertical' e 'fixa' são nomes antigos de 'auto' e 'comprimento'.
   */
  const MODOS = {
    auto: 'Em pé · melhor encaixe',
    comprimento: 'Em pé · C no comprimento',
    largura: 'Em pé · C na largura',
    deitado: 'Deitado',
    livre: 'Livre (em pé ou deitado)',
  };
  const normalizarModo = (m) => (m === 'vertical' ? 'auto' : m === 'fixa' ? 'comprimento' : MODOS[m] ? m : 'auto');

  function orientacoesBrutas(p) {
    const c = +p.c, l = +p.l, h = +p.h;
    switch (normalizarModo(p.orientacao)) {
      case 'comprimento': return [[c, l, h]];
      case 'largura': return [[l, c, h]];
      case 'deitado': return [[h, l, c], [l, h, c], [h, c, l], [c, h, l]];
      case 'livre': return [[c, l, h], [l, c, h], [h, l, c], [l, h, c], [h, c, l], [c, h, l]];
      default: return [[c, l, h], [l, c, h]];
    }
  }

  // Quantos volumes cabem num vagão vazio usando só essa orientação, em grade ("casado").
  function grade(o, v) {
    const nx = Math.floor((+v.c + EPS) / o[0]), ny = Math.floor((+v.l + EPS) / o[1]), nz = Math.floor((+v.h + EPS) / o[2]);
    return { dx: o[0], dy: o[1], dz: o[2], nx, ny, nz, total: nx * ny * nz };
  }

  // Orientações permitidas, da que mais encaixa para a que menos encaixa no vagão.
  function orientacoes(p, v) {
    const vistos = new Set();
    const lista = orientacoesBrutas(p).filter((o) => {
      const k = o.map(arred).join('x');
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
    if (!v) return lista;
    return lista
      .map((o) => ({ o, g: grade(o, v) }))
      .sort((a, b) => b.g.total - a.g.total || a.o[2] - b.o[2] || a.o[0] - b.o[0])
      .map((x) => x.o);
  }

  // Resumo do encaixe teórico por orientação (usado na tela para explicar o arranjo).
  function encaixe(p, v) {
    return orientacoes(p, v).map((o) => grade(o, v));
  }

  // Peso máximo que um volume aguenta em cima (kg). Infinity = sem limite, 0 = não empilha.
  function limiteDe(p) {
    if (p.empilhavel === false) return 0;
    const m = p.maxEmCima;
    if (m === null || m === undefined || m === '' || isNaN(+m)) return Infinity;
    return Math.max(0, +m);
  }
  const ehPalete = (p) => p.tipo === 'palete';
  const pecasDe = (p) => (ehPalete(p) ? Math.max(1, Math.floor(+p.pecas || 1)) : 1);

  /* ---------- Grade espacial para consultas rápidas ---------- */
  class Grade {
    constructor(L, W, H, cel) {
      this.cel = cel;
      this.nx = Math.max(1, Math.ceil(L / cel));
      this.ny = Math.max(1, Math.ceil(W / cel));
      this.nz = Math.max(1, Math.ceil(H / cel));
      this.celulas = new Map();
      this.carimbo = 0;
    }
    _faixa(a, b, n) {
      let i0 = Math.floor((a + EPS) / this.cel);
      let i1 = Math.floor((b - EPS) / this.cel);
      if (i1 < i0) i1 = i0;
      return [Math.max(0, i0), Math.min(n - 1, i1)];
    }
    adicionar(cx) {
      const [x0, x1] = this._faixa(cx.x, cx.x2, this.nx);
      const [y0, y1] = this._faixa(cx.y, cx.y2, this.ny);
      const [z0, z1] = this._faixa(cx.z, cx.z2, this.nz);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++)
          for (let k = z0; k <= z1; k++) {
            const key = i + this.nx * (j + this.ny * k);
            let arr = this.celulas.get(key);
            if (!arr) this.celulas.set(key, (arr = []));
            arr.push(cx);
          }
    }
    consultar(ax, ay, az, bx, by, bz) {
      const out = [];
      const s = ++this.carimbo;
      const [x0, x1] = this._faixa(ax, bx, this.nx);
      const [y0, y1] = this._faixa(ay, by, this.ny);
      const [z0, z1] = this._faixa(az, bz, this.nz);
      for (let i = x0; i <= x1; i++)
        for (let j = y0; j <= y1; j++)
          for (let k = z0; k <= z1; k++) {
            const arr = this.celulas.get(i + this.nx * (j + this.ny * k));
            if (!arr) continue;
            for (const cx of arr) if (cx._m !== s) { cx._m = s; out.push(cx); }
          }
      return out;
    }
  }

  /* ---------- Compartimento (um vagão) ---------- */
  function novoCompartimento(idx, v, maxKg) {
    return {
      idx,
      L: +v.c, W: +v.l, H: +v.h,
      offsetX: idx * (+v.c + GAP_VAGOES),
      maxKg,
      kg: 0,
      caixas: [],
      eps: [{ x: 0, y: 0, z: 0 }],
      chavesEP: new Set(['0|0|0']),
      ordenado: true,
      falhas: new Set(),
      controlaCarga: false,
      grade: new Grade(+v.c, +v.l, +v.h, 0.5),
    };
  }

  function sobrepoe(b, x, y, z, dx, dy, dz) {
    return x < b.x2 - EPS && x + dx > b.x + EPS &&
           y < b.y2 - EPS && y + dy > b.y + EPS &&
           z < b.z2 - EPS && z + dz > b.z + EPS;
  }

  // Caixas logo abaixo de uma base, com a área de contato de cada uma
  function apoiosDe(cp, x, y, z, dx, dy) {
    const out = [];
    if (z <= EPS) return out;
    for (const b of cp.grade.consultar(x, y, z - 0.002, x + dx, y + dy, z)) {
      if (Math.abs(b.z2 - z) > 1e-4) continue;
      const ox = Math.min(x + dx, b.x2) - Math.max(x, b.x);
      const oy = Math.min(y + dy, b.y2) - Math.max(y, b.y);
      if (ox > EPS && oy > EPS) out.push({ b, a: ox * oy });
    }
    return out;
  }

  // Quanto peso cada caixa da pilha recebe a mais ao colocar w kg sobre esses apoios.
  // O peso desce de cima para baixo, repartido pela área de contato.
  function incrementos(apoios, w) {
    const inc = new Map(), pend = [];
    const tot = apoios.reduce((s, x) => s + x.a, 0);
    if (!(tot > 0) || !(w > 0)) return inc;
    const soma = (b, v) => {
      if (!inc.has(b)) { inc.set(b, 0); pend.push(b); }
      inc.set(b, inc.get(b) + v);
    };
    apoios.forEach(({ b, a }) => soma(b, (w * a) / tot));
    while (pend.length) {
      let k = 0;
      for (let i = 1; i < pend.length; i++) if (pend[i].z > pend[k].z) k = i;
      const b = pend.splice(k, 1)[0], v = inc.get(b);
      for (const s of b.apoios) soma(s.b, v * s.f);
    }
    return inc;
  }

  function cabe(cp, x, y, z, dx, dy, dz, apoioMin, peso) {
    if (x + dx > cp.L + EPS || y + dy > cp.W + EPS || z + dz > cp.H + EPS) return false;
    const viz = cp.grade.consultar(x, y, z, x + dx, y + dy, z + dz);
    for (const b of viz) if (sobrepoe(b, x, y, z, dx, dy, dz)) return false;

    if (z > EPS) {
      const apoios = apoiosDe(cp, x, y, z, dx, dy);
      let area = 0;
      for (const { b, a } of apoios) {
        if (b.limite <= EPS) return false;
        area += a;
      }
      if (area < apoioMin * dx * dy - 1e-9) return false;
      if (cp.controlaCarga) {
        for (const [b, v] of incrementos(apoios, peso)) if (b.carga + v > b.limite + 1e-6) return false;
      }
    }
    return true;
  }

  /* Projeções de um ponto até a parede ou a face de caixa mais próxima */
  function projX(cp, px, py, pz) {
    let m = 0;
    for (const b of cp.caixas)
      if (b.x2 <= px + EPS && b.x2 > m && py >= b.y - EPS && py < b.y2 - EPS && pz >= b.z - EPS && pz < b.z2 - EPS) m = b.x2;
    return m;
  }
  function projY(cp, px, py, pz) {
    let m = 0;
    for (const b of cp.caixas)
      if (b.y2 <= py + EPS && b.y2 > m && px >= b.x - EPS && px < b.x2 - EPS && pz >= b.z - EPS && pz < b.z2 - EPS) m = b.y2;
    return m;
  }
  function projZ(cp, px, py, pz) {
    let m = 0;
    for (const b of cp.caixas)
      if (b.z2 <= pz + EPS && b.z2 > m && px >= b.x - EPS && px < b.x2 - EPS && py >= b.y - EPS && py < b.y2 - EPS) m = b.z2;
    return m;
  }

  function dentroDeCaixa(cp, x, y, z) {
    const viz = cp.grade.consultar(x, y, z, x + 0.001, y + 0.001, z + 0.001);
    for (const b of viz)
      if (x >= b.x - EPS && x < b.x2 - EPS && y >= b.y - EPS && y < b.y2 - EPS && z >= b.z - EPS && z < b.z2 - EPS) return true;
    return false;
  }

  function adicionarEP(cp, x, y, z) {
    x = arred(x); y = arred(y); z = arred(z);
    if (x >= cp.L - EPS || y >= cp.W - EPS || z >= cp.H - EPS) return;
    const k = x + '|' + y + '|' + z;
    if (cp.chavesEP.has(k)) return;
    cp.chavesEP.add(k);
    if (dentroDeCaixa(cp, x, y, z)) return;
    cp.eps.push({ x, y, z });
    cp.ordenado = false;
  }

  function tentar(cp, item, apoioMin) {
    if (cp.kg + item.peso > cp.maxKg + EPS) return null;
    if (cp.falhas.has(item.pi)) return null;
    if (!cp.ordenado) {
      // frente -> porta, piso -> teto, lateral esquerda -> direita
      cp.eps.sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);
      cp.ordenado = true;
    }
    if (item.limite <= EPS) {
      // Volume que não recebe carga por cima: busca em todos os EPs a posição que
      // desperdiça menos altura acima dele, sem se afastar demais da frente.
      let melhor = null, melhorScore = Infinity;
      for (const p of cp.eps) {
        if (p.x > (melhor ? melhor.p.x + 0.0 : Infinity) + 3) break;
        for (let r = 0; r < item.ors.length; r++) {
          const o = item.ors[r];
          if (!cabe(cp, p.x, p.y, p.z, o[0], o[1], o[2], apoioMin, item.peso)) continue;
          const score = p.x + 2 * (cp.H - p.z - o[2]) + 0.1 * p.y + 0.001 * r;
          if (score < melhorScore) { melhorScore = score; melhor = { p, o }; }
        }
      }
      if (melhor) return melhor;
      cp.falhas.add(item.pi);
      return null;
    }
    for (let i = 0; i < cp.eps.length; i++) {
      const p = cp.eps[i];
      let melhor = null;
      // item.ors já vem ordenado pelo melhor encaixe em grade ("casado"):
      // usa a primeira orientação que couber neste ponto.
      for (const o of item.ors) {
        if (cabe(cp, p.x, p.y, p.z, o[0], o[1], o[2], apoioMin, item.peso)) { melhor = o; break; }
      }
      if (melhor) return { p, o: melhor };
    }
    cp.falhas.add(item.pi);
    return null;
  }

  function inserir(cp, item, p, o) {
    const [dx, dy, dz] = o;
    const b = {
      x: p.x, y: p.y, z: p.z, x2: arred(p.x + dx), y2: arred(p.y + dy), z2: arred(p.z + dz),
      dx, dy, dz, pi: item.pi, peso: item.peso, limite: item.limite, carga: 0, apoios: [], _m: 0,
    };
    if (cp.controlaCarga && b.z > EPS) {
      const ap = apoiosDe(cp, b.x, b.y, b.z, dx, dy);
      const tot = ap.reduce((s2, a) => s2 + a.a, 0);
      for (const [c, v] of incrementos(ap, item.peso)) c.carga += v;
      b.apoios = ap.map((a) => ({ b: a.b, f: a.a / tot }));
    }
    cp.caixas.push(b);
    cp.grade.adicionar(b);
    cp.kg += item.peso;
    cp.falhas.clear();

    // remove EPs que ficaram dentro da nova caixa
    cp.eps = cp.eps.filter((e) => !(e.x >= b.x - EPS && e.x < b.x2 - EPS && e.y >= b.y - EPS && e.y < b.y2 - EPS && e.z >= b.z - EPS && e.z < b.z2 - EPS));

    // novos extreme points: projeções dos 3 cantos
    const { x, y, z, x2, y2, z2 } = b;
    adicionarEP(cp, x2, projY(cp, x2, y, z), z);
    adicionarEP(cp, x2, y, projZ(cp, x2, y, z));
    adicionarEP(cp, projX(cp, x, y2, z), y2, z);
    adicionarEP(cp, x, y2, projZ(cp, x, y2, z));
    adicionarEP(cp, projX(cp, x, y, z2), y, z2);
    adicionarEP(cp, x, projY(cp, x, y, z2), z2);
    // cantos sem projeção ajudam a fechar paredes
    adicionarEP(cp, x2, y, z);
    adicionarEP(cp, x, y2, z);
    adicionarEP(cp, x, y, z2);
    return b;
  }

  /* ---------- Ordenação dos itens ---------- */
  function ordenarItens(itens, produtos, estrategia) {
    if (estrategia === 'pedido') return itens; // ordem dos pedidos (rota de entrega)
    // paletes primeiro (vão na frente, com empilhadeira), depois caixas, por último as que não empilham
    const chave = (it) => [it.palete ? 0 : it.limite > EPS ? 1 : 2];
    if (estrategia === 'peso') {
      return itens.sort((a, b) => chave(a)[0] - chave(b)[0] || b.peso - a.peso || b.vol - a.vol || a.pi - b.pi);
    }
    // blocos: agrupa por produto, produtos maiores primeiro
    return itens.sort((a, b) => chave(a)[0] - chave(b)[0] || b.vol - a.vol || b.peso - a.peso || a.pi - b.pi);
  }

  /* ---------- Função principal ---------- */
  function empacotar(veiculo, produtos, opcoes) {
    const opt = Object.assign({ estrategia: 'blocos', apoioMin: 0.75 }, opcoes || {});
    const t0 = agora();
    const vagoes = Math.max(1, Math.floor(+veiculo.vagoes || 1));
    const maxKgTotal = +veiculo.cargaKg > 0 ? +veiculo.cargaKg : Infinity;
    const comps = [];
    for (let i = 0; i < vagoes; i++) comps.push(novoCompartimento(i, veiculo, maxKgTotal / vagoes));

    const itens = [];
    produtos.forEach((p, pi) => {
      const ors = orientacoes(p, veiculo);
      const cabeVazio = ors.some((o) => grade(o, veiculo).total > 0);
      const qtd = Math.max(0, Math.floor(+p.qtd || 0));
      const vol = p.c * p.l * p.h, limite = limiteDe(p), palete = ehPalete(p), pecas = pecasDe(p);
      for (let k = 0; k < qtd; k++) itens.push({ pi, ors, cabeVazio, peso: +p.peso || 0, limite, palete, pecas, vol });
    });
    // só acompanha o peso sobre cada caixa se algum produto tiver limite em kg
    const controla = itens.some((it) => it.limite > EPS && isFinite(it.limite));
    comps.forEach((cp) => { cp.controlaCarga = controla; });
    ordenarItens(itens, produtos, opt.estrategia);

    const colocados = [];
    const pendentes = [];
    for (const it of itens) {
      let ok = false;
      for (const cp of comps) {
        const r = tentar(cp, it, opt.apoioMin);
        if (r) {
          const b = inserir(cp, it, r.p, r.o);
          colocados.push({
            seq: colocados.length, pi: it.pi, vagao: cp.idx, peso: it.peso, pecas: it.pecas,
            palete: it.palete, limite: it.limite, carga: 0, ref: b,
            x: b.x, y: b.y, z: b.z, gx: cp.offsetX + b.x,
            dx: b.dx, dy: b.dy, dz: b.dz,
          });
          ok = true;
          break;
        }
      }
      if (!ok) {
        // motivo: maior que o baú, limite de peso, ou falta de espaço
        it.motivo = !it.cabeVazio ? 'tamanho' : comps.every((cp) => cp.kg + it.peso > cp.maxKg + EPS) ? 'peso' : 'espaco';
        pendentes.push(it);
      }
    }

    colocados.forEach((c) => { c.carga = c.ref.carga; delete c.ref; });

    /* ---------- Indicadores ---------- */
    const L = +veiculo.c, W = +veiculo.l, H = +veiculo.h;
    const capVol = vagoes * L * W * H;
    const volSolic = itens.reduce((s, i) => s + i.vol, 0);
    let volCarr = 0, kg = 0, mx = 0, my = 0, piso = 0, altMax = 0;
    for (const c of colocados) {
      const v = c.dx * c.dy * c.dz;
      volCarr += v;
      kg += c.peso;
      mx += c.peso * (c.gx + c.dx / 2);
      my += c.peso * (c.y + c.dy / 2);
      if (c.z < EPS) piso += c.dx * c.dy;
      altMax = Math.max(altMax, c.z + c.dz);
    }
    const compTotal = vagoes * L + (vagoes - 1) * GAP_VAGOES;
    const porProduto = produtos.map(() => ({ colocados: 0, pendentes: 0, pecas: 0, pecasPendentes: 0, motivos: { tamanho: 0, peso: 0, espaco: 0 } }));
    colocados.forEach((c) => { porProduto[c.pi].colocados++; porProduto[c.pi].pecas += c.pecas; });
    pendentes.forEach((p) => { porProduto[p.pi].pendentes++; porProduto[p.pi].pecasPendentes += p.pecas; porProduto[p.pi].motivos[p.motivo]++; });
    const pendPorPeso = pendentes.some((p) => comps.every((cp) => cp.kg + p.peso > cp.maxKg + EPS));

    return {
      veiculo: { c: L, l: W, h: H, vagoes, cargaKg: isFinite(maxKgTotal) ? maxKgTotal : null, gap: GAP_VAGOES, comprimentoTotal: compTotal },
      colocados,
      pendentes: pendentes.length,
      porProduto,
      porVagao: comps.map((cp) => ({
        volumes: cp.caixas.length,
        kg: cp.kg,
        ocupacao: cp.caixas.reduce((s, b) => s + b.dx * b.dy * b.dz, 0) / (L * W * H),
      })),
      stats: {
        total: itens.length,
        pecas: itens.reduce((s2, i) => s2 + i.pecas, 0),
        pecasCarregadas: colocados.reduce((s2, c) => s2 + c.pecas, 0),
        kgSolicitado: itens.reduce((s2, i) => s2 + i.peso, 0),
        volSolicitado: volSolic,
        volCarregado: volCarr,
        capacidade: capVol,
        volLivre: capVol - volCarr,
        ocupacao: volCarr / capVol,
        pisoOcupado: piso / (vagoes * L * W),
        kg,
        cgX: kg > 0 ? mx / kg : 0,
        cgY: kg > 0 ? my / kg : W / 2,
        alturaMax: altMax,
        pendentePorPeso: pendPorPeso,
        extremePoints: comps.reduce((s, cp) => s + cp.eps.length, 0),
        ms: agora() - t0,
      },
    };
  }

  return { empacotar, orientacoes, encaixe, normalizarModo, limiteDe, pecasDe, MODOS, GAP_VAGOES };
});
