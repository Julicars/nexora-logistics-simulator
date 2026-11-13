'use strict';
const test = require('node:test'), assert = require('node:assert');
const P = require('../public/src/js/core/palete.js');
const PBR = P.PALETES.pbr;
const semSobrepor = rs => rs.every((a, i) => rs.every((b, j) => i >= j || a.x + a.l <= b.x + 1e-6 || b.x + b.l <= a.x + 1e-6 || a.y + a.w <= b.y + 1e-6 || b.y + b.w <= a.y + 1e-6));
test('caixa 40×30 no PBR: padrão em dois blocos põe 10 por camada (bloco simples daria 9)', () => {
  const c = P.camada(0.4, 0.3, 1.2, 1.0); assert.equal(c.n, 10); assert.ok(semSobrepor(c.rects));
  assert.ok(c.rects.every(r => r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.l <= 1.2 + 1e-6 && r.y + r.w <= 1.0 + 1e-6));
});
test('camadas pela altura e paletes cheios + parcial', () => {
  const r = P.paletizar({ l: 0.4, w: 0.3, h: 0.25, kg: 10, q: 130 }, PBR, { altMax: 1.65 });
  assert.equal(r.porCamada, 10); assert.equal(r.camadas, 6); assert.equal(r.porPal, 60);
  assert.equal(r.cheios, 2); assert.equal(r.resto, 10); assert.equal(r.paletes, 3);
  assert.equal(r.cheio.alt, 1.65); assert.equal(r.cheio.kg, 625); assert.equal(r.parcial.camadas, 1);
});
test('limite de peso do palete manda quando a caixa é pesada', () => {
  const r = P.paletizar({ l: 0.4, w: 0.3, h: 0.25, kg: 40, q: 100 }, PBR, { altMax: 1.65 });
  assert.equal(r.porPal, 30); assert.equal(r.limite, 'peso'); assert.ok(r.cheio.kg <= PBR.max + PBR.tara);
});
test('empilhamento máximo e caixa deitada', () => {
  assert.equal(P.paletizar({ l: 0.4, w: 0.3, h: 0.25, kg: 5, q: 1, empilha: 2 }, PBR, { altMax: 1.65 }).camadas, 3);
  const alta = { l: 0.3, w: 0.3, h: 1.1, kg: 5, q: 10 };
  assert.ok(P.paletizar(alta, PBR, { altMax: 1.0 }).erro);
  assert.ok(P.paletizar({ ...alta, deita: true }, PBR, { altMax: 1.0 }).porPal > 0);
});
test('sobra na borda permite mais caixas', () => {
  const sem = P.paletizar({ l: 0.42, w: 0.34, h: 0.3, kg: 5, q: 1 }, PBR, { altMax: 1.6 }), com = P.paletizar({ l: 0.42, w: 0.34, h: 0.3, kg: 5, q: 1 }, PBR, { altMax: 1.6, sobra: 0.03 });
  assert.ok(com.porCamada > sem.porCamada);
});
