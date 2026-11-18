/* Testes — cálculos de carga: peso cubado, metros lineares, cintas (EN 12195-1) e VGM.
 * Rodar: npm test (usa só o node:test, sem dependências; nada acessa a internet: as fontes externas são simuladas). */
'use strict';
const test = require('node:test'), assert = require('node:assert');
const C = require('../public/src/js/core/carga.js');
test('peso cubado: 300 kg/m³ e base de cobrança pelo maior', () => {
  const r = C.cubado([{ l: 1, w: 1, h: 1, kg: 100 }, { l: 1, w: 1, h: 1, kg: 100 }]); assert.equal(r.cubado, 600); assert.equal(r.taxavel, 600); assert.equal(r.base, 'cubado');
  assert.equal(C.cubado([{ l: 1, w: 1, h: 1, kg: 900 }]).base, 'real');
});
test('LDM: área de piso ÷ 2,4 (só a camada de baixo)', () => {
  const r = C.ldm([{ x: 0, l: 1.2, w: 1, z: 0 }, { x: 0, l: 1.2, w: 1, z: 1 }, { x: 0, l: 1.2, w: 1.2, z: 0 }]); assert.equal(+r.ldm.toFixed(3), 1.1); assert.equal(r.comprimento, 1.2);
});
test('EN 12195-1: 1000 kg, μ 0,45, STF 400 daN, 60°, frente travada → cintas pela lateral/traseira', () => {
  const r = C.cintasTopo(1000, { mu: 0.45 });
  /* (0,5-0,45)*981/(2*0,45*0,866*400) = 0,157 → 1 (traseira fs 1,1 → 0,173 → 1) */
  assert.equal(r.frente, 0); assert.equal(r.lado, 1); assert.equal(r.n, 1);
  assert.equal(C.cintasTopo(1000, { mu: 0.6 }).n, 0, 'manta antiderrapante: atrito já segura');
  assert.ok(C.cintasTopo(5000, { mu: 0.2 }).n >= 10, 'aço sobre aço precisa de muitas cintas');
  assert.ok(C.cintasTopo(1000, { mu: 0.45, travaFrente: false }).frente > 1);
});
test('VGM método 2: carga + escora + tara, comparado à placa CSC', () => {
  const r = C.vgm([{ kg: 20000 }, { kg: 5000 }], { name: "Container 20' DC" }, { escora: 150 });
  assert.equal(r.total, 27380); assert.ok(r.ok);
  assert.equal(C.vgm([{ kg: 29000 }], { name: "Container 20' DC" }).ok, false);
});
