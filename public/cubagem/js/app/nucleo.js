/* Núcleo: estado compartilhado, utilitários e frota. Carregado antes dos demais módulos de app/. */
'use strict';

/* ================= Utilidades ================= */
const $ = (s) => document.querySelector(s);
const T = (k, v) => I18N.T(k, v);
const nf = (v, d = 2) => Number(v).toLocaleString(I18N.locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const ni = (v) => Math.round(v).toLocaleString(I18N.locale());
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
// aceita "1,20" ou "1.20"
const lerDecimal = (s) => parseFloat(String(s).trim().replace(/\s/g, '').replace(',', '.'));
// aceita "30.000" ou "30000"
const lerInteiro = (s) => { const d = String(s).replace(/\D/g, ''); return d ? parseInt(d, 10) : NaN; };
const mostrarDecimal = (v) => (v === undefined || v === null || isNaN(v) ? '' : String(Math.round(v * 1000) / 1000).replace('.', ','));
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const saida = (t) => 1 - Math.pow(1 - t, 3);
const plural = (n, um, varios) => `${ni(n)} ${Math.round(n) === 1 ? T(um) : T(varios)}`;
const nomeEixo = (g) => g.nomeKey ? T(g.nomeKey, g.nomeVars) : g.nome;
const nomeCat = (k) => T('cat.' + k);
const nomeModo = (k) => T('mode.' + k);

// Paleta de cores por produto compatível com a marca NEXORA (laranja + azuis)
const CORES = ['#f5a033', '#2b7ad9', '#22c55e', '#a855f7', '#ef4444', '#06b6d4', '#eab308', '#ec4899', '#84cc16', '#f97316'];
const cor = (i) => CORES[i % CORES.length];
const modo = (p) => Packer.normalizarModo(p.orientacao);
const ehPalete = (p) => p.tipo === 'palete';
const MOTIVO_KEYS = { peso: 'reason.peso', espaco: 'reason.espaco', tamanho: 'reason.tamanho' };
const COR_LONA = '#0b1a3a';        // azul-marinho profundo da marca NEXORA
const TEXTO_LONA = 'NEXORA';
const FOLGA = 0.012;               // espaço visual entre caixas (m)
const BASE_PALETE = 0.144;         // altura do estrado (PBR)
const COR_SELECAO = '#ffffff';     // volume selecionado
const COR_INVALIDA = '#e5484d';    // posição que não pode ser usada

// Ajusta pedidos antigos ao formato atual (tipo, peças, peso por peça, limite em cima)
function normalizar(p) {
  const q = Object.assign({}, p);
  q.tipo = q.tipo === 'palete' ? 'palete' : 'caixa';
  q.pecas = q.tipo === 'palete' ? Math.max(1, Math.floor(+q.pecas || 1)) : 1;
  q.peso = +q.peso > 0 ? +q.peso : 0;
  q.pesoPeca = q.pecas ? q.peso / q.pecas : q.peso;
  if (q.empilhavel === false) q.maxEmCima = 0;
  delete q.empilhavel;
  if (q.maxEmCima === '' || q.maxEmCima === undefined || (q.maxEmCima !== null && isNaN(+q.maxEmCima))) q.maxEmCima = null;
  return q;
}

/* ---------- Frota (lista de veículos), salva neste navegador ---------- */
const CHAVE_FROTA = 'simulador3d.frota.v1', CHAVE_PAINEIS = 'simulador3d.paineis.v1', CHAVE_CENARIOS = 'simulador3d.cenarios.v1';
const lerLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; /* navegador sem armazenamento */ } };
// Dados do localStorage podem ter sido adulterados: valida tipos e faixas (evita XSS e travamento)
const dimOk = (x, max) => typeof x === 'number' && isFinite(x) && x > 0 && x <= max;
const frotaValida = (l) => Array.isArray(l) && l.length > 0 && l.length <= 100 && l.every((v) => v && typeof v === 'object' &&
  typeof v.nome === 'string' && v.nome.length > 0 && v.nome.length <= 80 && dimOk(v.c, 40) && dimOk(v.l, 40) && dimOk(v.h, 40) &&
  (v.vagoes === undefined || (Number.isInteger(v.vagoes) && v.vagoes >= 1 && v.vagoes <= 4)) &&
  (v.cargaKg === undefined || (typeof v.cargaKg === 'number' && isFinite(v.cargaKg) && v.cargaKg >= 0 && v.cargaKg <= 1e6)));
let frota = (function () { const f = lerLocal(CHAVE_FROTA); return frotaValida(f) ? f : clone(VEICULOS); })();
const salvarFrota = () => gravarLocal(CHAVE_FROTA, frota);

// Produto novo: palete 1,20 × 1,10 × 1,90 m com 42 peças de 9 kg
const PRODUTO_PADRAO = { tipo: 'palete', c: 1.2, l: 1.1, h: 1.9, qtd: 1, pecas: 42, pesoPeca: 9, peso: 42 * 9, orientacao: 'auto', maxEmCima: 0 };

const st = {
  veiculo: clone(frota[0]),
  idx: 0,           // posição do veículo na frota, ou 'custom'
  pedidos: clone(PEDIDOS_DEMO).map(normalizar),
  estrategia: 'blocos',
  apoioMin: 0.75,
  res: null,
  eixos: null,
  eixosCfg: { tara: {}, limite: {} },
  mostrados: 0,     // posição contínua da animação (volumes)
  base: 0,          // volumes abaixo deste índice ficam sempre assentados
  tocando: false,
  vel: 36,          // volumes por segundo
  destaque: -1,
  atraves: true,
  vista: 'iso',
  portaAlvo: 0,     // 0 fechada, 1 aberta
  editar: false,    // mouse destravado: dá para mover os paletes
  sel: -1,          // volume selecionado
  hover: -1,        // volume sob o mouse
};

// Melhor arranjo em grade de um produto: "1,10 m no comprimento (14) × 2 lado a lado = 28 por vagão"
function encaixeDe(p) {
  const e = Packer.encaixe(p, st.veiculo)[0];
  if (!e || !e.total) return { e, texto: T('enc.doesntFit'), curto: T('enc.doesntFitShort') };
  const deitado = Math.abs(e.dz - p.h) > 1e-6;
  const texto = `${nf(e.dx)} ${T('enc.inLength')} (${e.nx}) × ${e.ny} ${T('enc.sideBySide')}` +
    (e.nz > 1 ? ` × ${e.nz} ${T('enc.layers')}` : '') + ` = ${ni(e.total)} ${T('enc.perWagon')}` + (deitado ? ', ' + T('enc.lying') : '');
  return { e, texto, curto: `${e.nx} × ${e.ny} × ${e.nz} = ${ni(e.total)}` };
}

/* ---------- Aviso ao usuário: toast fixo no topo (item de acessibilidade/UX) ---------- */
let tmrToast = null;
function toast(msg, tipo) {
  const el = $('#toast');
  if (!el) { console.warn(msg); return; }
  clearTimeout(tmrToast);
  el.textContent = msg;
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  el.hidden = false;
  tmrToast = setTimeout(() => { el.hidden = true; }, tipo === 'erro' ? 6000 : 3200);
}
const erro = (msg) => toast(msg, 'erro');
const sucesso = (msg) => toast(msg, 'sucesso');
