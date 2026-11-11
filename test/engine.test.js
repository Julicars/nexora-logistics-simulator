'use strict';
const test = require('node:test');
const assert = require('node:assert');
const NX = require('../public/src/js/core/engine.js');
const F = NX.FLEET0, byName = n => F.find(v => v.name === n);
const line = (o) => NX.normalize({ id: 'l' + Math.random(), cod: 'T', nome: 'Teste', tipo: 'palete', pcs: 1, ...o });
const noOverlap = items => { for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (items[i].wg === items[j].wg && NX.overlap3(items[i], items[j])) return false; return true; };
const inBounds = (v, items) => items.every(i => i.x >= -1e-6 && i.y >= -1e-6 && i.z >= -1e-6 && i.x + i.l <= v.L + 1e-6 && i.y + i.w <= v.W + 1e-6 && i.z + i.h <= v.H + 1e-6);

test('medidas oficiais dos veículos não mudaram', () => {
  assert.deepStrictEqual(F.map(v => [v.name, v.L, v.W, v.H, v.wag]), [
    ['Carreta 15.4m', 15.4, 2.5, 2.7, 1], ['Carreta 14.6m', 14.6, 2.5, 2.7, 1], ['Rodo-Trem 12.50m', 12.5, 2.5, 2.7, 2],
    ['Truck 10.4m', 10.4, 2.4, 2.66, 1], ['Truck 9.7m', 9.7, 2.4, 2.66, 1], ['Truck 8.5m', 8.5, 2.4, 2.66, 1],
    ['3/4 5.5m', 5.5, 2.4, 2.4, 1], ['VAN 3.1m', 3.1, 1.8, 1.9, 1], ['IVECO BAU 3.9m', 3.9, 2.1, 2.1, 1],
    ["Container 45' HC", 13.5, 2.33, 2.58, 1], ["Container 40' HC", 12, 2.33, 2.58, 1], ["Container 20' DC", 5.88, 2.33, 2.26, 1]]);
});
test('peso total = peças × peso por peça (42 × 9 = 378)', () => {
  assert.strictEqual(NX.normalize({ tipo: 'palete', pcs: 42, kgp: 9, l: 1.2, w: 1.1, h: 1.9 }).kg, 378);
});
test('palete 1,20×1,10×1,90 na Carreta 15,4 m = 14 × 2 × 1 = 28', () => {
  const g = NX.grid(byName('Carreta 15.4m'), line({ l: 1.2, w: 1.1, h: 1.9, kgp: 9, pcs: 42, stack: 0 }));
  assert.deepStrictEqual([g.nl, g.nw, g.nh, g.n], [14, 2, 1, 28]);
});
test('30 paletes: 28 na carreta, 2 num veículo extra rodoviário', () => {
  const p = line({ l: 1.2, w: 1.1, h: 1.9, kgp: 9, pcs: 42, stack: 0, q: 30 });
  const r = NX.planLoad(F, 'v0', [p]);
  assert.strictEqual(r.vehs[0].items.length, 28);
  assert.strictEqual(r.vehs.reduce((s, V) => s + V.items.length, 0), 30);
  assert.strictEqual(r.left.length, 0);
  assert.ok(r.vehs.slice(1).every(V => V.v.cat !== 'Container'));
});
test('containers nunca entram como veículo extra', () => {
  const p = line({ l: 1.2, w: 1.0, h: 1.2, kgp: 500, q: 200 });
  const r = NX.planLoad(F, 'v2', [p]);
  assert.ok(r.vehs.length > 1 && r.vehs.slice(1).every(V => V.v.cat !== 'Container'));
});
test('container como principal é permitido', () => {
  const r = NX.planLoad(F, 'v10', [line({ l: 1.2, w: 1.0, h: 1.2, kgp: 300, q: 10 })]);
  assert.strictEqual(r.vehs[0].v.cat, 'Container');
  assert.ok(inBounds(r.vehs[0].v, r.vehs[0].items));
});
test('"não empilhar" (0) nunca fica com algo em cima', () => {
  const r = NX.planLoad(F, 'v3', [line({ l: 1.2, w: 1.0, h: 0.8, kgp: 300, stack: 0, q: 40 })]);
  for (const V of r.vehs) assert.ok(V.items.every(i => i.z === 0));
});
test('níveis máximos respeitados', () => {
  const r = NX.planLoad(F, 'v0', [line({ tipo: 'caixa', l: 0.6, w: 0.4, h: 0.3, kgp: 10, maxLevels: 3, q: 300, pos: 'pe' })]);
  for (const V of r.vehs) assert.ok(V.items.every(i => i.lv <= 3 && i.z < 0.9 + 1e-6));
});
test('peso sobre cada volume respeita "aguenta em cima"', () => {
  const r = NX.planLoad(F, 'v0', [line({ tipo: 'caixa', l: 1, w: 1, h: 0.5, kgp: 100, stack: 150, q: 60, pos: 'pe' })]);
  for (const V of r.vehs) for (const i of V.items) assert.ok((i.load || 0) <= 150 + 1e-6);
});
test('bobina deitada fica no assoalho e nada vai em cima', () => {
  const r = NX.planLoad(F, 'v0', [line({ tipo: 'bobina', d: 1.2, h: 1.5, kgp: 8000, pos: 'deitado', q: 3 })]);
  const its = r.vehs[0].items; assert.ok(its.length >= 1);
  assert.ok(its.every(i => i.z === 0 && i.ax !== 'v'));
});
test('bobina em pé empilha só até o limite de níveis', () => {
  const r = NX.planLoad(F, 'v0', [line({ tipo: 'bobina', d: 0.8, h: 0.6, kgp: 200, pos: 'pe', maxLevels: 2, q: 80 })]);
  for (const V of r.vehs) assert.ok(V.items.every(i => i.lv <= 2));
});
test('big bag nunca deitado e só big bag em cima de big bag', () => {
  const r = NX.planLoad(F, 'v0', [line({ tipo: 'bigbag', l: 1, w: 1, h: 1.2, kgp: 1000, maxLevels: 2, q: 20 }), line({ tipo: 'caixa', l: 0.5, w: 0.5, h: 0.5, kgp: 10, q: 30 })]);
  const its = r.vehs.flatMap(V => V.items);
  for (const i of its.filter(i => i.p.tipo === 'bigbag')) assert.ok(Math.abs(i.h - 1.2) < 1e-9);
  for (const i of its.filter(i => i.p.tipo !== 'bigbag')) assert.ok(!(i.sup || []).some(s => s.o.p.tipo === 'bigbag'));
});
test('mistura de produtos: sem sobreposição, dentro dos limites, eixos e PBT ok', () => {
  const lines = [line({ l: 1.2, w: 1.0, h: 1.45, kgp: 780, stack: 900, q: 12 }), line({ tipo: 'caixa', l: 0.6, w: 0.4, h: 0.4, kgp: 18, stack: 60, q: 80 }),
    line({ tipo: 'bobina', d: 1.0, h: 1.2, kgp: 2500, pos: 'deitado', q: 2 }), line({ tipo: 'bigbag', l: 1.0, w: 1.0, h: 1.1, kgp: 900, maxLevels: 2, q: 6 })];
  for (const id of ['v0', 'v2', 'v3', 'v6']) {
    const r = NX.planLoad(F, id, lines);
    for (const V of r.vehs) {
      assert.ok(noOverlap(V.items), 'sobreposição em ' + V.v.name);
      assert.ok(inBounds(V.v, V.items), 'fora dos limites em ' + V.v.name);
      assert.ok(NX.stats(V.v, V.items).axOk, 'eixo em ' + V.v.name);
      assert.strictEqual(NX.verifyVehicle(V.v, V.items), null);
    }
    assert.strictEqual(r.vehs.reduce((s, V) => s + V.items.length, 0) + r.left.length, r.total);
  }
});
test('verificação recusa sobreposição e fora dos limites', () => {
  const v = byName('Truck 8.5m'), p = line({ l: 1.2, w: 1.0, h: 1, kgp: 100 });
  const a = { n: 1, pid: p.id, p, x: 0, y: 0, z: 0, l: 1.2, w: 1, h: 1, wg: 0 };
  assert.match(NX.verifyVehicle(v, [a, { ...a, n: 2, x: 0.5 }]), /Sobreposição/);
  assert.match(NX.verifyVehicle(v, [{ ...a, x: 8 }]), /limites/);
  assert.match(NX.verifyVehicle(v, [{ ...a, z: 0.5 }]), /Apoio/);
});
test('rotação 90° troca largura e comprimento ocupados sem mudar o produto', () => {
  const p = line({ l: 1.2, w: 1.1, h: 1.9, kgp: 9, pcs: 42 });
  const os = NX.orientations(p, 'pe');
  assert.deepStrictEqual(os.map(o => [o.l, o.w]), [[1.2, 1.1], [1.1, 1.2]]);
  assert.deepStrictEqual([p.l, p.w, p.h], [1.2, 1.1, 1.9]);
});

test('quantidades e peças negativas são recusadas na validação', () => {
  const p = NX.normalize({ nome: 'X', cod: 'X1', tipo: 'palete', l: 1.2, w: 1.1, h: 1.9, pcs: -2, kgp: 9 });
  const e = NX.validateSpec(p, false);
  assert.ok(e.some(m => /Peças/.test(m)), 'peças negativas devem gerar erro: ' + e.join(' | '));
  const q = NX.normalize({ nome: 'X', cod: 'X1', tipo: 'palete', l: 1.2, w: 1.1, h: 1.9, pcs: 42, kgp: 9, q: -5 });
  assert.ok(NX.validateSpec(q, true).some(m => /Quantidade/.test(m)));
});

test('categorias: frágil não recebe nada em cima; carga pesada só no piso', () => {
  const v = byName('Truck 10.4m');
  const fr = line({ cod: 'FR', l: 0.6, w: 0.4, h: 0.4, kgp: 10, q: 300, cats: ['fragil'] });
  const r = NX.planLoad([v], v.id, [fr], { extras: false });
  assert.ok(r.vehs[0].items.length > 0);
  assert.ok(r.vehs[0].items.every(i => i.z === 0), 'nada empilhado sobre frágil');
  const ps = line({ cod: 'PS', l: 1, w: 1, h: 0.5, kgp: 300, q: 40, cats: ['pesado'] });
  const r2 = NX.planLoad([v], v.id, [ps], { extras: false });
  assert.ok(r2.vehs[0].items.every(i => i.z === 0), 'carga pesada só no piso');
});
test('categorias: explosivo e alimento nunca no mesmo veículo; alimento não vai em carroceria aberta', () => {
  const fleet = NX.FLEET0.map(v => ({ ...v }));
  const ex = line({ id: 'ex', cod: 'EX', l: 1.2, w: 1, h: 1, kgp: 300, q: 4, cats: ['explosivo'] });
  const al = line({ id: 'al', cod: 'AL', l: 1.2, w: 1, h: 1, kgp: 300, q: 4, cats: ['alimenticio'] });
  const r = NX.planLoad(fleet, 'v0', [ex, al]);
  for (const V of r.vehs) { const c = new Set(V.items.flatMap(i => i.p.cats)); assert.ok(!(c.has('explosivo') && c.has('alimenticio')), 'misturou em ' + V.v.name); }
  assert.equal(r.vehs.reduce((s, V) => s + V.items.length, 0), 8);
  const open = { ...fleet[0], body: 'aberta' };
  const r2 = NX.planLoad([open], open.id, [al], { extras: false });
  assert.equal(r2.vehs[0].items.length, 0); assert.equal(r2.left.length, 4);
  assert.ok(NX.verifyVehicle(fleet[0], r.vehs[0].items) === null);
});

test('carroceria aberta: altura útil = 4,40 m menos o assoalho; carga máx. pesquisada limita o peso', () => {
  const v = { ...byName('Carreta 15.4m'), body: 'aberta' };
  assert.equal(NX.effH(v), 3.15);
  const alto = line({ cod: 'AL', l: 1.2, w: 1.0, h: 3.0, kgp: 100, q: 4 });
  assert.equal(NX.planLoad([byName('Carreta 15.4m')], 'v0', [alto], { extras: false }).vehs[0].items.length, 0, 'baú 2,70 m não leva volume de 3 m');
  assert.equal(NX.planLoad([v], 'v0', [alto], { extras: false }).vehs[0].items.length, 4, 'aberta leva até 3,15 m');
  assert.equal(byName('Truck 10.4m').max, 14000);
  assert.ok(NX.vehMaxCargo(byName('Truck 10.4m')) <= 14000);
});
