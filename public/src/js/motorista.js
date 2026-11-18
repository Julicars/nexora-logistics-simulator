/* NEXORA — página do motorista (abre pelo link enviado no WhatsApp). Sem login: o link já traz o acesso desta viagem. */
(function () {
  'use strict';
  const P = new URLSearchParams(location.search), ID = P.get('v'), T = P.get('t'), main = document.getElementById('mt');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let V = null, aberto = null;
  function toast(m, err) { const t = document.getElementById('mtToast'); t.textContent = m; t.className = err ? 'err' : ''; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 3500); }
  async function api(p, o = {}) { const r = await fetch(`/api/viagens/${ID}${p}${p.includes('?') ? '&' : '?'}t=${encodeURIComponent(T)}`, o); const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.erro || 'Sem conexão. Tente de novo.'); return b; }
  async function carregar() { try { V = await api(''); desenhar(); } catch (e) { main.innerHTML = `<p class="mt-car">⚠️ ${esc(e.message)}</p>`; } }
  function desenhar() {
    const feitas = V.paradas.filter(p => p.status !== 'pendente').length, prox = V.paradas.find(p => p.status === 'pendente');
    document.getElementById('mtTit').textContent = V.nome || 'Entregas';
    main.innerHTML = `<div class="mt-res"><span>${feitas}/${V.paradas.length}</span><span class="mt-bar"><i style="width:${feitas / V.paradas.length * 100}%"></i></span><span>${feitas === V.paradas.length ? '🏁 Concluído' : 'em andamento'}</span></div>
      <ol class="mt-st">${V.paradas.map(p => { const cl = p.status === 'entregue' ? 'ok' : p.status === 'problema' ? 'pb' : prox === p ? 'prox' : '';
        const mapa = p.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.end ? p.end + ', ' : '') + p.cidade)}`;
        return `<li class="mt-c ${cl}" id="p${p.n}"><div class="mt-h"><span class="mt-n">${p.n}</span><div><div class="mt-nome">${esc(p.nome || 'Entrega ' + p.n)}</div><div class="mt-sub">${esc(p.end ? p.end + ' · ' : '')}${esc(p.cidade)}</div>${p.volumes ? `<div class="mt-sub">📦 ${p.volumes} volume(s)${p.kg ? ' · ' + p.kg.toLocaleString('pt-BR') + ' kg' : ''}</div>` : ''}${p.horario ? `<div class="mt-sub">🕘 Recebe: ${esc(p.horario)}</div>` : ''}</div></div>
          ${p.obs ? `<div class="mt-obs">ℹ️ ${esc(p.obs)}</div>` : ''}
          ${p.status !== 'pendente' ? `<div class="mt-feito ${p.status === 'problema' ? 'pb' : ''}">${p.status === 'entregue' ? '✅ Entregue' : '⚠️ Problema'}${p.hora ? ' às ' + new Date(p.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}${p.recebedor ? ' · ' + esc(p.recebedor) : ''}${p.nota ? ' · ' + esc(p.nota) : ''}${p.foto ? ' · 📷' : ''}</div>` : ''}
          <div class="mt-b"><a class="mt-a" href="${mapa}" target="_blank" rel="noopener">🗺️ Mapa</a>${p.telefone ? `<a class="mt-a" href="tel:${esc(p.telefone.replace(/[^\d+]/g, ''))}">📞 Ligar</a>` : '<span></span>'}
          ${p.status === 'pendente' ? `<button class="mt-ok" data-a="ok" data-n="${p.n}">✅ Entregue</button><button class="mt-pb" data-a="pb" data-n="${p.n}">⚠️ Problema</button>` : `<button class="mt-full" data-a="desfaz" data-n="${p.n}">↩ Desfazer</button>`}</div>
          ${aberto && aberto.n === p.n ? form(p) : ''}</li>`; }).join('')}</ol>`;
    if (aberto) { const f = document.getElementById('mtF'); f && f.querySelector('input,textarea').focus(); }
  }
  const form = p => `<form class="mt-f" id="mtF">${aberto.tipo === 'ok' ? `<label>Quem recebeu<input name="r" autocomplete="name" placeholder="Nome de quem recebeu"></label><label>📷 Foto do canhoto (opcional)<input name="f" type="file" accept="image/*" capture="environment"></label>` : ''}<label>${aberto.tipo === 'ok' ? 'Observação (opcional)' : 'O que aconteceu? *'}<textarea name="n" rows="2" ${aberto.tipo === 'pb' ? 'required' : ''} placeholder="${aberto.tipo === 'pb' ? 'Ex.: cliente fechado, avaria, recusa…' : ''}"></textarea></label><div class="mt-b"><button type="submit" class="${aberto.tipo === 'ok' ? 'mt-ok' : 'mt-pb'}">Confirmar</button><button type="button" data-a="cancel">Cancelar</button></div></form>`;
  function foto(file) { return new Promise((ok, no) => { if (!file) return ok(null); const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.7)); }; img.onerror = () => no(new Error('Não consegui ler a foto.')); img.src = u; }); }
  const gps = () => new Promise(ok => { if (!navigator.geolocation) return ok(null); navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok(null), { timeout: 6000, maximumAge: 60000 }); });
  async function enviar(n, status, extra = {}) {
    try { V = await api(`/parada/${n}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...extra }) }); aberto = null; desenhar(); toast(status === 'entregue' ? '✅ Entrega registrada!' : status === 'problema' ? 'Problema registrado.' : 'Desfeito.');
      const pr = document.querySelector('.mt-c.prox'); if (pr && status !== 'pendente') pr.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    catch (e) { toast(e.message, true); }
  }
  main.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const n = +b.dataset.n;
    if (b.dataset.a === 'ok' || b.dataset.a === 'pb') { aberto = { n, tipo: b.dataset.a }; desenhar(); }
    if (b.dataset.a === 'cancel') { aberto = null; desenhar(); }
    if (b.dataset.a === 'desfaz' && confirm('Desfazer esta entrega?')) enviar(n, 'pendente'); });
  main.addEventListener('submit', async e => { e.preventDefault(); const f = e.target, bt = f.querySelector('[type=submit]'); bt.disabled = true; bt.textContent = 'Enviando…';
    try { const ft = f.f && f.f.files[0] ? await foto(f.f.files[0]) : null; await enviar(aberto.n, aberto.tipo === 'ok' ? 'entregue' : 'problema', { recebedor: f.r ? f.r.value : '', nota: f.n.value, foto: ft, gps: await gps() }); }
    catch (er) { toast(er.message, true); bt.disabled = false; bt.textContent = 'Confirmar'; } });
  if (!ID || !T) main.innerHTML = '<p class="mt-car">Link incompleto. Peça um novo link ao escritório.</p>'; else { carregar(); setInterval(() => { if (!aberto && document.visibilityState === 'visible') carregar(); }, 60000); }
})();
