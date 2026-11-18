/* carregamento sob demanda de bibliotecas pesadas (mapa e QR Code): só baixa quando a tela precisar */
window.NXLOAD = (function () { const m = {}; return src => m[src] || (m[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => { delete m[src]; no(new Error('Falha ao carregar ' + src)); }; document.head.appendChild(s); })); })();
/* NEXORA — sincronização com o servidor.
 * Com o servidor do NEXORA, produtos, frota, planos, clientes e preferências ficam guardados no servidor
 * e aparecem iguais em qualquer aparelho. Sem servidor (GitHub Pages, prévia), tudo continua no navegador.
 * Regra: vale a versão salva por último (por coleção). A chave de acesso é pedida só em outros aparelhos.
 */
const SYNC = (function () {
  'use strict';
  const KEYS = ['products', 'vehicles', 'plans', 'clientes', 'regras', 'modelos', 'origPad', 'pedTarifa', 'fatorCub', 'prefs', 'fav', 'corEntrega', 'contatos', 'amarraCfg', 'autoExtra', 'operador', 'consumo'];
  const raw = { get: k => { try { return localStorage.getItem('nx2_' + k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('nx2_' + k, v); return true; } catch (e) { return false; } } };
  const meta = () => { try { return JSON.parse(raw.get('syncMeta') || '{}'); } catch (e) { return {}; } };
  const setMeta = m => raw.set('syncMeta', JSON.stringify(m));
  let recusou = false, ativo = false, estado = 'local', ultimo = null, fila = new Set(), timer = null, pedindo = null;
  const chave = () => raw.get('chaveAcesso') || '';

  /* toda chamada /api/ leva a chave (se houver); 401 → pede a chave uma vez */
  const fetch0 = window.fetch.bind(window);
  window.fetch = async function (url, o = {}) {
    const u = typeof url === 'string' ? url : url.url || '';
    if (/^\/api\//.test(u) && chave()) { o = { ...o, headers: { ...(o.headers || {}), 'X-Nexora-Chave': chave() } }; }
    const r = await fetch0(url, o);
    if (r.status === 401 && /^\/api\//.test(u) && !o._semPedir && !recusou) { const b = await r.clone().json().catch(() => ({})); if (b.chave && await pedirChave()) return window.fetch(url, { ...o, _semPedir: true }); }
    return r;
  };
  function pedirChave(msg) {
    if (pedindo) return pedindo;
    pedindo = new Promise(ok => {
      const d = document.createElement('div'); d.className = 'nxkey'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'nxkT');
      d.innerHTML = `<form class="card nxkeyc"><h2 id="nxkT" style="margin:0 0 6px;font-size:18px">🔐 Chave de acesso</h2><p class="mut" style="margin:0 0 10px">${msg || 'Este NEXORA está num servidor protegido. Digite a chave de acesso (aparece no terminal do servidor quando ele inicia, ou em <b>data/chave.txt</b>). Ela fica salva neste aparelho.'}</p><label class="f">Chave<input name="k" autocomplete="off" placeholder="NX-XXXX-XXXX" required></label><p class="bad" id="nxkE" role="alert" style="margin:6px 0 0"></p><div class="cbacoes" style="margin-top:10px"><button class="btn pri" type="submit">Entrar</button><button class="btn" type="button" data-x>Usar só neste aparelho</button></div></form>`;
      document.body.appendChild(d); const inp = d.querySelector('input'); setTimeout(() => inp.focus(), 50);
      const fim = v => { d.remove(); pedindo = null; ok(v); };
      d.querySelector('[data-x]').onclick = () => { recusou = true; fim(false); };
      d.querySelector('form').onsubmit = async e => { e.preventDefault(); const k = inp.value.trim(); const r = await fetch0('/api/dados', { headers: { 'X-Nexora-Chave': k } }).catch(() => null);
        if (r && r.ok) { raw.set('chaveAcesso', k); fim(true); } else d.querySelector('#nxkE').textContent = 'Chave incorreta.'; };
    });
    return pedindo;
  }

  async function puxar() {
    const r = await window.fetch('/api/dados'); const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) { estado = 'local'; return null; }
    if (!r.ok) { estado = r.status === 401 ? 'sem-chave' : 'erro'; return null; }
    return (await r.json()).colecoes || {};
  }
  async function init() {
    let srv; try { srv = await puxar(); } catch (e) { estado = 'offline'; return; }
    if (!srv) return;
    ativo = true; estado = 'ok'; const m = meta(); let mudou = 0;
    for (const k of KEYS) {
      const s = srv[k], loc = raw.get(k);
      if (s && (!m[k] || s.em > m[k] || loc === null)) { raw.set(k, JSON.stringify(s.v)); m[k] = s.em; mudou++; }
      else if (loc !== null && (!s || (m[k] || 0) > s.em)) { if (!m[k]) m[k] = Date.now(); fila.add(k); }
    }
    setMeta(m); if (fila.size) agendar(10); ultimo = new Date();
    return mudou;
  }
  /* salvar no navegador → envia ao servidor (agrupa alterações em 800 ms) */
  const set0 = LS.set.bind(LS);
  LS.set = function (k, v) { const ok = set0(k, v); if (ok && KEYS.includes(k)) { const m = meta(); m[k] = Date.now(); setMeta(m); fila.add(k); if (ativo) agendar(800); } return ok; };
  function agendar(ms) { clearTimeout(timer); timer = setTimeout(enviar, ms); }
  async function enviar() {
    if (!ativo) return; const m = meta();
    for (const k of [...fila]) {
      const v = raw.get(k); if (v === null) { fila.delete(k); continue; }
      try {
        const r = await window.fetch('/api/dados/' + k, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: `{"em":${m[k] || Date.now()},"v":${v}}` });
        if (r.ok || r.status === 409) { fila.delete(k); if (r.status === 409) { const b = await r.json(); raw.set(k, JSON.stringify(b.atual.v)); m[k] = b.atual.em; setMeta(m); aviso(); } estado = 'ok'; ultimo = new Date(); }
        else { estado = 'erro'; }
      } catch (e) { estado = 'offline'; }
    }
    if (fila.size) agendar(15000);
    pinta();
  }
  let avisado = false;
  function aviso() { if (avisado) return; avisado = true; if (window.toast) toast('Há dados mais novos vindos de outro aparelho. Recarregue a página para ver.'); }
  /* ao voltar para a aba: confere se outro aparelho mudou algo */
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !ativo) return;
    try { const s = await puxar(); if (!s) return; const m = meta(); const novos = KEYS.filter(k => s[k] && s[k].em > (m[k] || 0) && !fila.has(k));
      if (novos.length) { for (const k of novos) { raw.set(k, JSON.stringify(s[k].v)); m[k] = s[k].em; } setMeta(m); if (window.toast) toast('Dados atualizados de outro aparelho. Recarregando…'); setTimeout(() => location.reload(), 1200); } } catch (e) { /* offline */ }
  });
  function pinta() { const el = document.getElementById('syncSt'); if (!el) return; el.textContent = { ok: '☁️ Sincronizado com o servidor', local: '💾 Dados salvos neste navegador', offline: '⚠️ Sem conexão com o servidor', 'sem-chave': '🔐 Sem chave: dados só neste aparelho', erro: '⚠️ Erro ao sincronizar' }[estado] + (fila.size && estado === 'ok' ? ' (enviando…)' : ''); }
  return { init, enviar, pinta, estado: () => estado, ativo: () => ativo, pedirChave, chave, sair: () => { localStorage.removeItem('nx2_chaveAcesso'); location.reload(); } };
})();
