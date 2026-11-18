/* NEXORA — link do motorista (Roteirização → Concluir).
 * Cria a viagem no servidor com as entregas na ordem, gera o link para o motorista (WhatsApp)
 * e acompanha o andamento: entregue / problema, hora, recebedor, foto do canhoto e GPS.
 */
const VIAGEM = (function () {
  'use strict';
  const q = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let atual = null, timer = null, semServidor = false, lig = false;
  const link = v => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}motorista.html?v=${v.id}&t=${encodeURIComponent(v.token)}`;
  const ST = { pendente: ['⏳', 'Pendente'], entregue: ['✅', 'Entregue'], problema: ['⚠️', 'Problema'] };
  async function api(p, o) { const r = await fetch('/api/viagens' + p, o); if (!(r.headers.get('content-type') || '').includes('json')) { semServidor = true; throw new Error('sem servidor'); } const b = await r.json(); if (!r.ok) throw new Error(b.erro || 'Erro ' + r.status); return b; }
  function paradas() {
    const r = S.route, cli = (() => { try { return LS.get('clientes', []); } catch (e) { return []; } })();
    return r.stops.filter(s => s.lat != null).map(s => {
      const c = s.cli && cli.find(x => x.id === s.cli), its = typeof plan === 'object' && plan ? plan.vehs.flatMap(V => V.items.filter(it => it.p.stop === s.id)) : [];
      return { nome: s.nome || '', cidade: s.city + ' - ' + s.uf, end: s.end || '', lat: s.lat, lon: s.lon, horario: c ? c.horario || '' : '', telefone: c ? c.telefone || '' : '', obs: [c && c.agenda ? 'Exige agendamento' : '', c ? c.obs || '' : ''].filter(Boolean).join(' · '), volumes: its.length, kg: Math.round(its.reduce((a, it) => a + it.kg, 0)) };
    });
  }
  function render() {
    const el = q('#rViagem'); if (!el) return; ligar();
    const id = S.route.viagemId;
    if (semServidor) { el.innerHTML = '<p class="mut" style="margin:0">O link do motorista precisa do servidor do NEXORA (npm start ou hospedagem).</p>'; return; }
    if (!id || !atual || atual.id !== id) {
      el.innerHTML = `<p class="mut" style="margin:0 0 8px">Gere um link para o motorista abrir no celular: ele vê as entregas na ordem, abre o mapa, liga para o cliente e marca cada entrega como feita, com foto do canhoto. Você acompanha aqui.</p>
        <div class="clgrid"><label class="f">Motorista<input id="vgMot" maxlength="80" value="${esc(S.route.motorista || '')}"></label><label class="f">Placa<input id="vgPlaca" maxlength="10" value="${esc(S.route.placa || '')}" data-nomask="1"></label></div>
        <button type="button" class="btn pri" id="vgCriar" style="margin-top:8px">📲 Gerar link do motorista</button>`;
      if (id && !atual) carregar(id);
      return;
    }
    const v = atual, feitas = v.paradas.filter(p => p.status === 'entregue').length, prob = v.paradas.filter(p => p.status === 'problema').length, l = link(v);
    el.innerHTML = `<div class="vgtop"><b>${esc(v.nome || 'Viagem')}</b> ${v.motorista ? '· 👤 ' + esc(v.motorista) : ''} ${v.placa ? '· ' + esc(v.placa) : ''}<span class="vgprog"><i style="width:${v.paradas.length ? feitas / v.paradas.length * 100 : 0}%"></i></span><span>${feitas}/${v.paradas.length} entregues${prob ? ` · <b class="bad">${prob} com problema</b>` : ''}</span></div>
      <div class="vglink"><input readonly value="${esc(l)}" aria-label="Link do motorista" id="vgLink"><button class="btn sm" type="button" id="vgCopiar">Copiar</button><a class="btn sm pri" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Olá${v.motorista ? ' ' + v.motorista : ''}! Suas entregas de hoje (${v.paradas.length}): abra o link, siga a ordem e marque cada entrega como feita, com foto do canhoto:\n${l}`)}">WhatsApp</a></div>
      <ol class="vglist">${v.paradas.map(p => `<li class="vg-${p.status}"><span>${ST[p.status][0]}</span><div><b>${esc(p.nome || 'Entrega ' + p.n)}</b> <span class="mut">${esc(p.cidade)}</span><br><small>${ST[p.status][1]}${p.hora ? ' às ' + new Date(p.hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}${p.recebedor ? ' · recebido por ' + esc(p.recebedor) : ''}${p.nota ? ' · “' + esc(p.nota) + '”' : ''}${p.gps ? ` · <a href="https://www.google.com/maps?q=${p.gps.lat},${p.gps.lon}" target="_blank" rel="noopener">GPS</a>` : ''}${p.foto ? ` · <a href="/api/viagens/${v.id}/parada/${p.n}/foto?t=${encodeURIComponent(v.token)}" target="_blank" rel="noopener">📷 canhoto</a>` : ''}</small></div></li>`).join('')}</ol>
      <div class="cbacoes"><button class="btn sm" type="button" id="vgAtual">⟳ Atualizar</button><button class="btn sm" type="button" id="vgNova">Nova viagem</button><span class="mut" style="font-size:12px">Atualiza sozinho a cada 30 s.</span></div>`;
  }
  async function carregar(id) { try { atual = await api('/' + id); } catch (e) { if (!semServidor) { S.route.viagemId = null; saveWork(); } atual = null; } render(); }
  async function criar() {
    const ps = paradas(); if (!ps.length) return toast('Adicione as entregas com cidade na aba Rota.', true);
    S.route.motorista = q('#vgMot').value.trim(); S.route.placa = q('#vgPlaca').value.trim().toUpperCase();
    const r = S.route, nome = `${r.orig ? RT.label(r.orig) : ''} → ${ps.length} entrega(s)${r.saida ? ' · ' + r.saida.split('-').reverse().join('/') : ''}`;
    try { atual = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, motorista: r.motorista, placa: r.placa, origem: r.orig ? RT.label(r.orig) : '', saida: r.saida, paradas: ps }) }); S.route.viagemId = atual.id; saveWork(); render(); toast('Link criado. Envie para o motorista pelo WhatsApp.'); }
    catch (e) { toast(e.message === 'sem servidor' ? 'O link do motorista precisa do servidor do NEXORA.' : e.message, true); render(); }
  }
  function ligar() {
    if (lig) return; lig = true;
    document.addEventListener('click', e => {
      const t = e.target; if (!t.closest('#rViagem')) return;
      if (t.id === 'vgCriar') criar();
      if (t.id === 'vgCopiar') { const i = q('#vgLink'); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => toast('Link copiado.')).catch(() => { document.execCommand('copy'); toast('Link copiado.'); }); }
      if (t.id === 'vgAtual' && atual) carregar(atual.id);
      if (t.id === 'vgNova') { S.route.viagemId = null; atual = null; saveWork(); render(); }
    });
    timer = setInterval(() => { const el = q('#rViagem'); if (atual && el && el.offsetParent && document.visibilityState === 'visible') carregar(atual.id); }, 30000);
  }
  return { render };
})();
