/* NEXORA — camada de dados.
 * Sem login e sem banco de dados: tudo fica salvo neste navegador (localStorage). */
'use strict';
const LS = {
  get(k, d) { try { const v = localStorage.getItem('nx2_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nx2_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const SS = {
  get(k) { try { return sessionStorage.getItem('nx2_' + k); } catch (e) { return null; } },
  set(k, v) { try { v === null ? sessionStorage.removeItem('nx2_' + k) : sessionStorage.setItem('nx2_' + k, v); } catch (e) {} }
};
const localId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function seedLocalProducts() {
  const P = o => NX.normalize({ id: localId('p'), cat: 'Geral', ...o });
  return [
    P({ nome: 'Material industrial', cod: 'MAT-IND', cat: 'Industrial', tipo: 'palete', emb: 'Palete de madeira', l: 1.2, w: 1.1, h: 1.9, pcs: 42, kgp: 9, stackable: false, pos: 'pe', cor: '#f39a2b', obs: 'Não empilhar.' }),
    P({ nome: 'Bebida lata 350ml', cod: 'BEB-350', cat: 'Bebidas', tipo: 'palete', emb: 'Palete PBR', l: 1.2, w: 1.0, h: 1.45, pcs: 120, kgp: 6.5, stack: 900, maxLevels: 2, pos: 'pe', cor: '#2f8cf2' }),
    P({ nome: 'Eletrônicos caixa', cod: 'ELT-CX1', cat: 'Eletrônicos', tipo: 'caixa', emb: 'Caixa frágil', l: 0.6, w: 0.4, h: 0.4, pcs: 4, kgp: 4.5, stack: 60, maxLevels: 4, pos: 'pe', cor: '#b36bff', obs: 'Este lado para cima.' }),
    P({ nome: 'Bobina de aço 1,2 m', cod: 'BOB-120', cat: 'Siderurgia', tipo: 'bobina', emb: 'Bobina de aço', d: 1.2, h: 1.0, pcs: 1, kgp: 6000, stackable: false, pos: 'deitado', cor: '#8a97a8', obs: 'Transportar deitada, calçada.' }),
    P({ nome: 'Big Bag fertilizante', cod: 'BB-1000', cat: 'Agro', tipo: 'bigbag', emb: 'Big Bag 1 t', l: 1.0, w: 1.0, h: 1.2, pcs: 1, kgp: 1000, maxLevels: 2, stack: 1000, pos: 'pe', cor: '#e8dcc0' })
  ];
}
class ApiError extends Error { constructor(msg, status, errors) { super(msg); this.status = status; this.errors = errors || [msg]; } }

const DB = {
  server: false, user: null, role: 'admin',
  async init() { return false; },

  /* ---- produtos ---- */
  async listProducts() { let p = LS.get('products', null); if (!p) { p = seedLocalProducts(); LS.set('products', p); } return p; },
  async saveProduct(prod) {
    const list = await this.listProducts(); const p = NX.normalize({ ...prod, id: prod.id || localId('p') });
    const e = NX.validateSpec(p, false);
    if (list.some(x => x.cod.toLowerCase() === p.cod.toLowerCase() && x.id !== p.id)) e.push('Já existe um produto com este código.');
    if (e.length) throw new ApiError(e.join(' '), 400, e);
    const i = list.findIndex(x => x.id === p.id); if (i >= 0) list[i] = p; else list.push(p);
    if (!LS.set('products', list)) throw new ApiError('Sem espaço no navegador (foto muito grande?).', 507);
    return p;
  },
  async deleteProduct(id) { LS.set('products', (await this.listProducts()).filter(p => p.id !== id)); return { ok: true }; },

  /* ---- veículos ---- */
  async listVehicles() {
    let l = LS.get('vehicles', null) || JSON.parse(JSON.stringify(NX.FLEET0));
    if (!LS.get('fleetMaxV', false)) { for (const v of l) if ((v.max === null || v.max === undefined) && NX.MAXKG[v.name]) v.max = NX.MAXKG[v.name]; LS.set('vehicles', l); LS.set('fleetMaxV', true); }
    return l;
  },
  async saveVehicles(list) {
    const e = []; for (const v of list) { if (!v.name) e.push('Nome vazio.'); for (const k of ['L', 'W', 'H']) if (!(v[k] > 0)) e.push(v.name + ': medida inválida.'); if (!(v.wag >= 1 && v.wag <= 3)) e.push(v.name + ': vagões 1 a 3.'); }
    if (e.length) throw new ApiError(e.join(' '), 400, e); LS.set('vehicles', list); return list;
  },
  async officialVehicles() { const l = JSON.parse(JSON.stringify(NX.FLEET0)); LS.set('vehicles', l); return l; },

  /* ---- montagens ---- */
  async listPlans() { return LS.get('plans', []).map(({ vehs, ...r }) => ({ ...r, nVeh: vehs.length, nVol: vehs.reduce((s, V) => s + V.items.length, 0) })); },
  async getPlan(id) { const p = LS.get('plans', []).find(x => x.id === id); if (!p) throw new ApiError('Montagem não encontrada.', 404); return p; },
  async savePlan(payload, localCheck) {
    const e = localCheck(); if (e.length) throw new ApiError(e.join(' '), 422, e);
    const list = LS.get('plans', []); const p = { ...payload, id: localId('m'), criado: new Date().toISOString() };
    list.unshift(p); if (!LS.set('plans', list.slice(0, 200))) throw new ApiError('Sem espaço no navegador para salvar.', 507); return p;
  },
  async deletePlan(id) { LS.set('plans', LS.get('plans', []).filter(p => p.id !== id)); return { ok: true }; },
  async contact(msg) { const l = LS.get('contatos', []); l.unshift({ ...msg, data: new Date().toISOString() }); LS.set('contatos', l.slice(0, 100)); return { ok: true }; }
};
