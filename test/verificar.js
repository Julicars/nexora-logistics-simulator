// Verifica o empacotamento: limites do baú, sobreposição, apoio e peso sobre cada caixa. Uso: npm test
const { empacotar, limiteDe } = require('../public/cubagem/js/packer.js');
const { VEICULOS, PEDIDOS_DEMO } = require('../public/cubagem/js/data.js');

// Cenários de teste: o pedido padrão e cargas com caixas soltas e limite de peso em cima
const caixa = (codigo, c, l, h, qtd, peso, orientacao, maxEmCima) =>
  ({ codigo, nome: codigo, tipo: 'caixa', c, l, h, qtd, pecas: 1, peso, orientacao, maxEmCima });
const EXEMPLOS = {
  padrao: PEDIDOS_DEMO,
  misto: [
    Object.assign({}, PEDIDOS_DEMO[0], { qtd: 18 }),
    caixa('CX-1', 0.55, 0.42, 0.36, 120, 14, 'auto', 80),
    caixa('CX-2', 0.40, 0.27, 0.33, 160, 9.5, 'auto', null),
    caixa('CX-3', 1.05, 0.14, 0.68, 30, 13, 'auto', 0),
  ],
  caixas: [
    caixa('CX-1', 0.55, 0.42, 0.36, 400, 14, 'auto', 80),
    caixa('CX-2', 0.40, 0.27, 0.33, 380, 9.5, 'auto', null),
    caixa('CX-3', 0.42, 0.38, 0.60, 170, 7, 'livre', 40),
    caixa('CX-4', 1.05, 0.14, 0.68, 50, 13, 'auto', 0),
  ],
};

const EPS = 1e-6;
let falhou = false;

// Recalcula, de forma independente, quanto peso cada caixa carrega em cima
function cargasSobre(cx) {
  const carga = cx.map(() => 0);
  const ordem = cx.map((_, i) => i).sort((a, b) => cx[b].z - cx[a].z);   // de cima para baixo
  const recebe = cx.map((c) => c.peso);                                      // peso próprio + o que vem de cima
  for (const i of ordem) {
    const c = cx[i];
    if (c.z < EPS) continue;
    const apoios = [];
    cx.forEach((b, j) => {
      if (b.vagao !== c.vagao || Math.abs(b.z + b.dz - c.z) > 1e-4) return;
      const ox = Math.min(c.x + c.dx, b.x + b.dx) - Math.max(c.x, b.x);
      const oy = Math.min(c.y + c.dy, b.y + b.dy) - Math.max(c.y, b.y);
      if (ox > EPS && oy > EPS) apoios.push([j, ox * oy]);
    });
    const tot = apoios.reduce((s, a) => s + a[1], 0);
    for (const [j, a] of apoios) { const v = (recebe[i] * a) / tot; carga[j] += v; recebe[j] += v; }
  }
  return carga;
}

for (const [nomeEx, pedidos] of Object.entries(EXEMPLOS)) {
  for (const v of VEICULOS) {
    for (const estrategia of ['blocos', 'peso', 'pedido']) {
      const r = empacotar(v, pedidos, { estrategia, apoioMin: 0.75 });
      const cx = r.colocados;
      let erros = 0, excesso = 0;
      for (let i = 0; i < cx.length; i++) {
        const a = cx[i];
        if (a.x < -EPS || a.y < -EPS || a.z < -EPS || a.x + a.dx > v.c + EPS || a.y + a.dy > v.l + EPS || a.z + a.dz > v.h + EPS) erros++;
        for (let j = i + 1; j < cx.length; j++) {
          const b = cx[j];
          if (a.vagao !== b.vagao) continue;
          if (a.x < b.x + b.dx - EPS && a.x + a.dx > b.x + EPS && a.y < b.y + b.dy - EPS && a.y + a.dy > b.y + EPS && a.z < b.z + b.dz - EPS && a.z + a.dz > b.z + EPS) erros++;
        }
      }
      const carga = cargasSobre(cx);
      cx.forEach((c, i) => { if (carga[i] > limiteDe(pedidos[c.pi]) + 1e-3) excesso++; });
      if (erros || excesso) falhou = true;
      if (estrategia === 'blocos') console.log(
        `${nomeEx.padEnd(8)} ${v.nome.padEnd(18)} colocados ${String(cx.length).padStart(4)}/${r.stats.total}  ` +
        `peças ${String(r.stats.pecasCarregadas).padStart(5)}  ocupação ${(r.stats.ocupacao * 100).toFixed(1).padStart(5)}%  ` +
        `${r.stats.ms.toFixed(0).padStart(4)} ms  sobreposição ${erros}  excesso de peso em cima ${excesso}`);
    }
  }
}

// Pedido padrão: 26 paletes de 42 peças de 9 kg na Carreta 15.4m
const r = empacotar(VEICULOS[0], PEDIDOS_DEMO, {});
const ok = r.colocados.length === 26 && r.stats.pecasCarregadas === 1092 && Math.round(r.stats.kg) === 9828;
console.log(`\nPedido padrão na ${VEICULOS[0].nome}: ${r.colocados.length} paletes, ${r.stats.pecasCarregadas} peças, ${Math.round(r.stats.kg)} kg ${ok ? 'OK' : 'ERRO'}`);
if (!ok) falhou = true;
process.exit(falhou ? 1 : 0);
