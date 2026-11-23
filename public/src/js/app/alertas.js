/* NEXORA — conferência antes de liberar a carga (aba Resultado).
 * Junta num painel só tudo o que o sistema já confere: volumes que ficaram de fora, peso, PBT e eixos,
 * equilíbrio lateral, produtos perigosos sem dados, carga acima da altura do
 * container (open top / flat rack), VGM, espaço vazio no fundo e frete abaixo do piso ANTT.
 * 🔴 bloqueio: não libera · 🟡 atenção: libera com confirmação · 🔵 lembrete.
 * Também gera o link de visualização do plano 3D (só leitura) para o cliente ou o conferente.
 */
const ALERTAS = (function () {
  'use strict';
  const q = s => document.querySelector(s);
  /* lista de verificações do plano atual */
  function verificar() {
    if (!plan) return [];
    const out = [], add = (nivel, txt, dica) => out.push({ nivel, txt, dica });
    if (plan.left.length) add('bloq', `${plan.left.length} volume(s) ficaram fora do carregamento.`, 'Adicione um veículo extra ou troque o veículo.');
    plan.vehs.forEach((V, vi) => {
      const v = V.v, s = NX.stats(v, V.items), nm = `Veículo ${vi + 1} (${v.name})`;
      if (!V.items.length) return;
      if (s.kg > s.maxKg + 1) add('bloq', `${nm}: carga de ${fmt(s.kg, 0)} kg acima da carga útil (${fmt(s.maxKg, 0)} kg).`);
      if (s.pbt > s.pbtLim + 1) add('bloq', `${nm}: PBT de ${fmt(s.pbt, 0)} kg acima do limite de ${fmt(s.pbtLim, 0)} kg.`);
      s.al.forEach(a => { if (a.tot > a.tolLim + 1) add('bloq', `${nm}: ${a.n} com ${fmt(a.tot / 1000, 2)} t, acima da tolerância (${fmt(a.tolLim / 1000, 2)} t).`, 'Redistribua a carga para a frente ou para trás.');
        else if (a.tot > a.lim + 1) add('aviso', `${nm}: ${a.n} com ${fmt(a.tot / 1000, 2)} t, acima do limite legal de ${fmt(a.lim / 1000, 2)} t (dentro da tolerância).`, 'A tolerância de 12,5% não pode ser usada no planejamento.'); });
      if (s.cg) {
        const lat = Math.abs(s.cg.lat), lim = v.W * 0.05;
        if (lat > lim) add(lat > lim * 2 ? 'bloq' : 'aviso', `${nm}: desequilíbrio lateral — centro de gravidade ${fmt(lat * 100, 0)} cm para a ${s.cg.lat > 0 ? 'direita' : 'esquerda'}.`, 'Referência do NEXORA: mais de 5% da largura do veículo. Troque volumes pesados de lado para centralizar o peso.');
      }
      const fundo = Math.min(...s.wagons.filter(w => w.n).map(w => w.freeLen));
      if (fundo > 0.5 && s.occ < 0.98) add('info', `${nm}: ${fmt(fundo, 2)} m livres no fundo.`, 'Trave a carga (escora, bolsa de ar ou cinta) para não correr na frenagem.');
      /* produtos perigosos */
      if (typeof PERIG === 'object') {
        const pg = [...new Map(V.items.filter(i => PERIG.isPerig(i.p)).map(i => [i.p.id, i.p])).values()];
        pg.filter(p => !p.onu || !p.classe).forEach(p => add('aviso', `${nm}: produto perigoso "${p.nome}" sem nº ONU ou classe no cadastro.`, 'Complete no cadastro do produto: rótulos e documentos dependem disso.'));
        if (pg.length) add('info', `${nm}: leva produto perigoso — confira rótulos, painéis, kit de emergência e curso do motorista.`);
      }
      /* fora de padrão: acima da altura do container */
      if (v.esp === 'ot' || v.esp === 'fr') { const top = Math.max(0, ...V.items.map(i => i.z + i.h)); if (top > v.H + 0.005) add('aviso', `${nm}: carga ${fmt((top - v.H) * 100, 0)} cm acima da altura do container (${fmt(v.H, 2)} m) — carga fora de padrão (OOG).`, 'Avise o armador na reserva: a carga OOG tem cobrança e posição especial no navio.'); }
      if (v.esp === 'prancha') add('info', `${nm}: carga em prancha aberta — amarração e lona por conta da operação.`, 'Acima de 2,60 m de largura ou 4,40 m de altura a viagem exige autorização especial (AET).');
      if (v.cat === 'Container' && window.NX_CARGA) { const g = NX_CARGA.vgm(V.items, v, LS.get('vgm:' + v.id, {})); if (g.max && !g.ok) add('bloq', `${nm}: VGM de ${fmt(g.total, 0)} kg acima do peso bruto da placa CSC (${fmt(g.max, 0)} kg).`); }
      const sem = V.items.filter(i => !(+i.kg > 0)).length; if (sem) add('aviso', `${nm}: ${sem} volume(s) sem peso informado.`, 'Sem o peso, eixos e PBT ficam subestimados.');
    });
    /* frete abaixo do piso (Lei 15.485/2026) */
    if (mode === 'route' && RT.piso) { const piso = RT.piso() || 0, fr = ((S.route.quote || {}).fretes || []).reduce((a, x) => a + (+x || 0), 0);
      if (piso > 0 && fr > 0 && fr + 0.005 < piso) add('aviso', `Frete de ${brl(fr)} abaixo do piso ANTT (${brl(piso)}).`, 'Pagar abaixo do piso gera sanção (Lei 15.485/2026) e o CIOT não é gerado.'); }
    return out;
  }
  const ICO = { bloq: '🔴', aviso: '🟡', info: '🔵' };
  function render() {
    const el = q('#alertOut'); if (!el) return; if (!plan) { el.innerHTML = ''; marcaAba(null); return; }
    const L = verificar(), nb = L.filter(x => x.nivel === 'bloq').length, na = L.filter(x => x.nivel === 'aviso').length;
    const st = nb ? ['bloq', `Bloqueada: ${nb} problema(s) impedem liberar`] : na ? ['aviso', `Liberar com atenção: ${na} aviso(s)`] : ['ok', 'Pronta para liberar'];
    /* liberação vale para o arranjo conferido: se mexerem nos volumes depois, precisa liberar de novo */
    const sig = plan.vehs.map(V => V.items.map(i => [i.n, i.wg, i.x.toFixed(2), i.y.toFixed(2), i.z.toFixed(2)].join()).join('|')).join('/');
    if (plan._lib && plan._lib.sig !== sig) plan._lib = null; const lib = plan._lib; ALERTAS._sig = sig;
    el.innerHTML = `<section class="alp ${st[0]}" aria-labelledby="alpT"><h3 id="alpT">${st[0] === 'ok' ? '🟢' : ICO[st[0]]} Conferência antes de liberar · <span>${st[1]}</span></h3>
      ${L.length ? `<ul class="alpl">${L.sort((a, b) => 'bloq aviso info'.indexOf(a.nivel) - 'bloq aviso info'.indexOf(b.nivel)).map(x => `<li class="${x.nivel}"><span aria-hidden="true">${ICO[x.nivel]}</span><div><b>${esc(x.txt)}</b>${x.dica ? `<small>${esc(x.dica)}</small>` : ''}</div></li>`).join('')}</ul>` : '<p class="mut" style="margin:6px 0">Nenhum problema encontrado: peso, eixos, equilíbrio e volumes conferidos.</p>'}
      <div class="alpb">${lib ? `<span class="ok">✔ Liberada por <b>${esc(lib.quem)}</b> em ${new Date(lib.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>` : `<label class="f" style="margin:0"><span>Conferente</span><input id="alpQuem" maxlength="60" value="${esc(LS.get('conferente', ''))}" autocomplete="name"></label>
        ${na && !nb ? '<label class="alpck"><input type="checkbox" id="alpOk"> Li os avisos e assumo a liberação</label>' : ''}
        <button type="button" class="btn pri" id="alpLib" ${nb ? 'disabled aria-disabled="true" title="Resolva os bloqueios primeiro"' : ''}>✔ Liberar carga</button>`}
        <button type="button" class="btn" id="alpVer">🔗 Link de visualização 3D</button></div><div id="alpLink"></div></section>`;
    marcaAba(nb ? 'bloq' : na ? 'aviso' : null);
    const b = q('#alpLib'); if (b) b.onclick = () => liberar(L);
    q('#alpVer').onclick = () => VER3D.gerar();
  }
  function marcaAba(n) { const t = document.querySelector('[data-tab="calc"]'); if (!t) return; t.classList.toggle('albq', n === 'bloq'); t.classList.toggle('alav', n === 'aviso'); t.title = n === 'bloq' ? 'Há bloqueios na conferência' : n === 'aviso' ? 'Há avisos na conferência' : ''; }
  function liberar(L) {
    const quem = (q('#alpQuem').value || '').trim(); if (!quem) { toast('Informe o nome do conferente.', true); q('#alpQuem').focus(); return; }
    if (L.some(x => x.nivel === 'aviso') && !(q('#alpOk') || {}).checked) { toast('Marque que leu os avisos para liberar.', true); return; }
    LS.set('conferente', quem);
    plan._lib = { quem, quando: new Date().toISOString(), sig: ALERTAS._sig };
    const hist = LS.get('liberacoes', []); hist.unshift({ quem, quando: plan._lib.quando, veiculos: plan.vehs.map(V => V.v.name), volumes: plan.vehs.reduce((s, V) => s + V.items.length, 0), kg: Math.round(plan.vehs.reduce((s, V) => s + V.items.reduce((a, i) => a + i.kg, 0), 0)), avisos: L.filter(x => x.nivel === 'aviso').map(x => x.txt) });
    LS.set('liberacoes', hist.slice(0, 300)); render(); toast('Carga liberada por ' + quem + '.');
  }
  return { verificar, render };
})();

/* ---------- link de visualização do plano 3D (só leitura) ----------
 * Com o servidor: guarda o plano em /api/planos3d e gera link curto (ver.html?p=ID&t=TOKEN, vale 60 dias).
 * Sem servidor (página estática): o plano vai compactado dentro do próprio link (ver.html#d=…). */
const VER3D = (function () {
  'use strict';
  const q = s => document.querySelector(s), r3 = n => Math.round(n * 1000) / 1000;
  const entrega = p => { if (mode !== 'route' || !p.stop) return ''; const st = (S.route.stops || []).find(s => s.id === p.stop), k = RT.rank ? RT.rank(p.stop) : 0; return st ? (k ? k + 'ª entrega: ' : '') + (st.nome ? st.nome + ' · ' : '') + RT.label(st) : ''; };
  function pacote() {
    const ps = [], idx = new Map();
    const pi = p => { if (!idx.has(p.id)) { idx.set(p.id, ps.length); ps.push([String(p.nome || '').slice(0, 80), String(p.cod || '').slice(0, 40), colorOf(p), +(+p.kg || 0).toFixed(1), entrega(p).slice(0, 60), p.tipo === 'bobina' ? 'b' : '']); } return idx.get(p.id); };
    const nome = mode === 'route' ? (S.route.stops || []).map(s => s.city).filter(Boolean).slice(0, 3).join(' → ') : '';
    return { v: 1, nome: (nome || 'Plano de carga').slice(0, 80), data: new Date().toISOString(),
      vs: plan.vehs.map(V => ({ nm: V.v.name, cat: V.v.cat, L: V.v.L, W: V.v.W, H: V.v.H, Hm: NX.effH(V.v), wag: V.v.wag, esp: V.v.esp || '', b: NX.bodyOf(V.v),
        it: [...V.items].sort((a, b) => a.n - b.n).map(i => [r3(i.x), r3(i.y), r3(i.z), r3(i.l), r3(i.w), r3(i.h), i.wg, i.n, pi(i.p)]) })), ps };
  }
  const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  async function compacta(o) { const st = new Blob([JSON.stringify(o)]).stream().pipeThrough(new CompressionStream('deflate-raw')); return b64u(new Uint8Array(await new Response(st).arrayBuffer())); }
  const base = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'ver.html';
  async function gerar() {
    if (!plan) return toast('Calcule o carregamento antes.', true);
    const el = q('#alpLink'); el.innerHTML = '<p class="mut">Gerando link…</p>';
    const pk = pacote(); let url = '', obs = '';
    try {
      const r = await fetch('/api/planos3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pk) });
      if (!(r.headers.get('content-type') || '').includes('json')) throw new Error('sem servidor');
      const b = await r.json(); if (!r.ok) throw new Error(b.erro || 'Erro ' + r.status);
      url = `${base()}?p=${b.id}&t=${encodeURIComponent(b.token)}`; obs = 'Link guardado no servidor por 60 dias.';
    } catch (e) {
      if (typeof CompressionStream !== 'function') { el.innerHTML = '<p class="bad">Não foi possível gerar o link neste navegador.</p>'; return; }
      url = `${base()}#d=${await compacta(pk)}`; obs = 'Sem servidor: o plano vai dentro do próprio link (não expira).';
    }
    el.innerHTML = `<div class="alpk"><input readonly value="${esc(url)}" aria-label="Link de visualização" id="alpUrl"><div class="alpkb"><button type="button" class="btn sm" id="alpCp">📋 Copiar</button><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Plano de carga 3D (só visualização): ' + url)}">WhatsApp</a><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a></div>
      <div id="alpQr" class="alpqr"></div><small class="mut">Quem abrir vê o plano em 3D no celular, sem editar: girar, ver volume por volume e a ordem de carregamento. ${obs}</small></div>`;
    q('#alpCp').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link copiado.'); } catch (e) { q('#alpUrl').select(); document.execCommand('copy'); toast('Link copiado.'); } };
    if (url.length < 1800) NXLOAD('src/vendor/qrcode/qrcode.js').then(() => { const qr = qrcode(0, 'L'); qr.addData(url); qr.make(); q('#alpQr').innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); }).catch(() => {});
  }
  return { gerar, pacote };
})();
