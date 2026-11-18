/* NEXORA — Saúde do sistema + dados/backup (Configurações) */
const SAUDE = (function () {
  'use strict';
  const q = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const quando = d => { if (!d) return '—'; const t = Date.parse(d); if (isNaN(t)) return esc(d); const m = (Date.now() - t) / 6e4; return new Date(t).toLocaleString('pt-BR') + ` <span class="mut">(${m < 60 ? Math.round(m) + ' min' : m < 2880 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' dias'} atrás)</span>`; };
  const idadeH = d => d ? (Date.now() - Date.parse(d)) / 36e5 : Infinity;
  const dot = st => `<span class="cbdot ${st}" aria-hidden="true"></span>`;
  const ST = { ok: 'Funcionando', warn: 'Atenção', bad: 'Com erro', mut: 'Ainda não rodou' };
  let S = null;
  async function carregar() {
    try { const r = await fetch('/api/saude'); if (!(r.headers.get('content-type') || '').includes('json')) throw 0; S = await r.json(); }
    catch (e) { q('#sdResumo').innerHTML = '<div class="card cbcard" style="grid-column:1/-1"><b>Sem servidor</b><small class="mut">A saúde das fontes precisa do servidor do NEXORA (npm start ou hospedagem). Aqui só funcionam os testes pelo navegador abaixo.</small></div>'; q('#sdTab').innerHTML = ''; return; }
    const a = S.anp || {}, m = S.mercado || {}, p = S.petrobras || {}, sv = S.servicos || {}, pf = p.fontes || {};
    const linhas = [
      ['Preços de combustíveis (ANP)', 'semanal · servidor confere a cada 6 h', a.erro ? 'bad' : !a.verificadoEm ? 'mut' : idadeH(a.verificadoEm) > 30 ? 'warn' : 'ok', a.verificadoEm, a.erro || (a.ultima ? `Semana ${a.ultima.inicio.split('-').reverse().join('/')} a ${a.ultima.fim.split('-').reverse().join('/')} · ${a.semanas} semana(s) guardadas` : '')],
      ['Dólar PTAX (Banco Central)', 'diário · a cada 6 h', m.erros && m.erros.dolar ? 'bad' : !m.em ? 'mut' : 'ok', m.em, (m.erros && m.erros.dolar) || (m.dolar ? `R$ ${String(m.dolar.v).replace('.', ',')} em ${m.dolar.d.split('-').reverse().join('/')}` : '')],
      ['Petróleo Brent (EIA/FRED)', 'diário (com atraso) · a cada 6 h', m.erros && m.erros.brent ? 'bad' : !m.em ? 'mut' : 'ok', m.em, (m.erros && m.erros.brent) || (m.brent ? `US$ ${String(m.brent.v).replace('.', ',')} em ${m.brent.d.split('-').reverse().join('/')}` : '')],
      ['Comunicados da Petrobras', 'diário · de hora em hora em alerta', pf.agencia ? (pf.agencia.ok ? (p.pendentes ? 'warn' : 'ok') : 'bad') : 'mut', pf.agencia && (pf.agencia.em || pf.agencia.erroEm), pf.agencia ? (pf.agencia.ok ? (pf.agencia.info || '') + (p.pendentes ? ` · ⚠️ ${p.pendentes} preço(s) novo(s) esperando sua confirmação (veja abaixo)` : '') : pf.agencia.erro) : ''],
      ['Síntese semanal da ANP (PDF)', 'semanal', pf.sintese ? (pf.sintese.ok ? 'ok' : 'bad') : 'mut', pf.sintese && (pf.sintese.em || pf.sintese.erroEm), pf.sintese ? (pf.sintese.ok ? pf.sintese.info : pf.sintese.erro) : ''],
      ['Praças de pedágio (ANTT)', 'semanal (cache 7 dias)', sv.pedagio ? (idadeH(sv.pedagio) > 24 * 10 ? 'warn' : 'ok') : 'mut', sv.pedagio, (sv.info || {}).pedagio],
      ['IPCA (Banco Central)', 'mensal (cache 1 dia)', sv.ipca ? 'ok' : 'mut', sv.ipca, (sv.info || {}).ipca],
      ['Feriados nacionais (BrasilAPI)', 'anual (cache 30 dias)', sv.feriados ? 'ok' : 'mut', sv.feriados, (sv.info || {}).feriados],
      ['Backup automático', 'diário · guarda 30', S.backups && S.backups.length ? (S.backups[0].nome.includes(new Date().toISOString().slice(0, 10)) ? 'ok' : 'warn') : 'mut', S.backups && S.backups[0] ? S.backups[0].nome.replace(/^nexora-|\.json$/g, '') : null, S.backups && S.backups[0] ? `${S.backups.length} arquivo(s) · último ${S.backups[0].kb} KB` : 'nenhum ainda']];
    const cont = { ok: 0, warn: 0, bad: 0, mut: 0 }; linhas.forEach(l => cont[l[2]]++);
    q('#sdResumo').innerHTML = `<div class="card cbcard"><span class="mut">Funcionando</span><b class="ok">${cont.ok}</b><small class="mut">de ${linhas.length} fontes</small></div><div class="card cbcard"><span class="mut">Com erro</span><b class="${cont.bad ? 'bad' : ''}">${cont.bad}</b><small class="mut">${cont.warn} com atenção · ${cont.mut} ainda não rodaram</small></div><div class="card cbcard"><span class="mut">Versão</span><b>${esc(S.versao)}</b><small class="mut">servidor às ${new Date(S.agora).toLocaleTimeString('pt-BR')}</small></div><div class="card cbcard"><span class="mut">Dados sincronizados</span><b>${Object.keys(S.dados || {}).length}</b><small class="mut">coleção(ões) no servidor · ${S.viagens} viagem(ns)</small></div>`;
    const pend = (p.pendLista || []).map(x => `<div class="cbalerta alta" style="margin-top:8px"><b>⚠️ Preço da Petrobras para confirmar:</b> R$ ${x.preco.toFixed(2).replace('.', ',')} a partir de ${x.data.split('-').reverse().join('/')} — <a href="${esc(x.link)}" target="_blank" rel="noopener">ver comunicado</a><br><small>Não entrou sozinho porque: ${x.motivos.map(esc).join('; ')}.</small><div class="cbacoes" style="margin-top:6px"><button class="btn sm pri" type="button" data-sdp="${x.id}" data-ok="1">✔ Confirmar preço</button><button class="btn sm" type="button" data-sdp="${x.id}" data-ok="0">✖ Descartar</button></div></div>`).join('');
    q('#sdTab').innerHTML = pend + `<table class="tbl cbcardtab"><thead><tr><th>Fonte</th><th>Situação</th><th>Última vez</th><th>Detalhe</th></tr></thead><tbody>${linhas.map(([n, f, st, em, det]) => `<tr><td data-l="Fonte"><b>${n}</b><br><small class="mut">${f}</small></td><td data-l="Situação">${dot(st)}${ST[st]}</td><td data-l="Última vez">${quando(em)}</td><td data-l="Detalhe" class="${st === 'bad' ? 'bad' : ''}">${esc(det || '')}</td></tr>`).join('')}</tbody></table>`;
  }
  async function navegador() {
    const el = q('#sdNav'); el.innerHTML = '<span class="mut">Testando…</span>';
    const t = async (nome, f) => { const t0 = performance.now(); try { await f(); return `<li>${dot('ok')}<b>${nome}</b> <span class="mut">${Math.round(performance.now() - t0)} ms</span></li>`; } catch (e) { return `<li>${dot('bad')}<b>${nome}</b> <span class="bad">${esc(e.message || 'sem acesso')}</span></li>`; } };
    const ok = async u => { const r = await fetch(u, { signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('HTTP ' + r.status); };
    const r = await Promise.all([t('Clima (Open-Meteo)', () => ok('https://api.open-meteo.com/v1/forecast?latitude=-23.55&longitude=-46.63&daily=weather_code&forecast_days=1')), t('CEP (ViaCEP)', () => ok('https://viacep.com.br/ws/01001000/json/')), t('Rota pela estrada (OSRM)', () => ok('https://router.project-osrm.org/route/v1/driving/-46.63,-23.55;-47.06,-22.90?overview=false')), t('CNPJ (BrasilAPI)', () => ok('https://brasilapi.com.br/api/cnpj/v1/33000167000101'))]);
    el.innerHTML = `<ul class="cbfontl" style="font-size:13px">${r.join('')}</ul>`;
  }
  async function testar(bt) {
    bt.disabled = true; const tx = bt.textContent; bt.textContent = 'Testando (pode levar 1 minuto)…';
    try { const r = await fetch('/api/saude/testar', { method: 'POST' }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Erro ' + r.status); toast('Teste concluído.'); }
    catch (e) { toast(e.message, true); }
    bt.disabled = false; bt.textContent = tx; await carregar(); navegador();
  }
  /* ---------- Configurações: dados e backup ---------- */
  async function cfg() {
    if (!q('#cfgDados')) return;
    if (typeof SYNC === 'object') { const st = SYNC.estado(); q('#cfgSync').innerHTML = { ok: '☁️ <b>Sincronizado com o servidor.</b> Produtos, frota, planos, clientes e preferências aparecem iguais em qualquer aparelho.', local: '💾 <b>Dados só neste navegador</b> (sem servidor). Use “Baixar backup” para não perder nada.', offline: '⚠️ Sem conexão com o servidor agora; as alterações são enviadas quando voltar.', 'sem-chave': '🔐 Este aparelho está sem a chave de acesso: os dados ficam só aqui.', erro: '⚠️ Erro ao sincronizar.' }[st] || ''; }
    try { const r = await fetch('/api/dados/backups'); if (r.ok && (r.headers.get('content-type') || '').includes('json')) { const l = await r.json(); q('#cfgBk').textContent = l.length ? `Backups automáticos no servidor (1 por dia, guarda 30): ${l.slice(0, 5).map(b => b.nome.replace(/^nexora-|\.json$/g, '')).join(', ')}${l.length > 5 ? '…' : ''}` : 'O servidor cria um backup automático por dia.'; } } catch (e) { /* sem servidor */ }
  }
  async function baixar() {
    let dados = null;
    try { const r = await fetch('/api/dados/backup'); if (r.ok && (r.headers.get('content-type') || '').includes('json')) dados = await r.json(); } catch (e) { /* local */ }
    if (!dados) { const col = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('nx2_') && !/chaveAcesso|syncMeta|work/.test(k)) { try { col[k.slice(4)] = { v: JSON.parse(localStorage.getItem(k)), em: Date.now() }; } catch (e) { /* ignora */ } } } dados = { nexora: 'backup', versao: 1, criado: new Date().toISOString(), colecoes: col, origem: 'navegador' }; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' })); a.download = `nexora-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); toast('Backup baixado.');
  }
  async function restaurar(inp) {
    const f = inp.files[0]; inp.value = ''; if (!f) return; let b; try { b = JSON.parse(await f.text()); } catch (e) { return toast('Arquivo inválido.', true); }
    if (b.nexora !== 'backup') return toast('Este arquivo não é um backup do NEXORA.', true);
    if (!confirm('Restaurar este backup substitui os dados atuais (um backup do estado atual é guardado antes). Continuar?')) return;
    let srv = false; try { const r = await fetch('/api/dados/restaurar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); srv = r.ok && (r.headers.get('content-type') || '').includes('json'); if (!srv && r.status !== 404 && (r.headers.get('content-type') || '').includes('json')) throw new Error((await r.json()).erro); } catch (e) { if (e.message) return toast(e.message, true); }
    for (const [k, x] of Object.entries(b.colecoes || {})) try { localStorage.setItem('nx2_' + k, JSON.stringify(x.v)); } catch (e) { /* ignora */ }
    localStorage.removeItem('nx2_syncMeta'); toast('Backup restaurado. Recarregando…'); setTimeout(() => location.reload(), 900);
  }
  let lig = false;
  function ligar() {
    if (lig) return; lig = true;
    q('#sdTab').addEventListener('click', async e => { const b = e.target.closest('[data-sdp]'); if (!b) return; b.disabled = true; try { const r = await fetch('/api/combustivel/petrobras/pendente/' + b.dataset.sdp, { method: b.dataset.ok === '1' ? 'POST' : 'DELETE' }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Erro ' + r.status); toast(b.dataset.ok === '1' ? 'Preço confirmado.' : 'Descartado.'); } catch (er) { toast(er.message, true); } carregar(); });
    q('#sdTestar').onclick = e => testar(e.currentTarget); q('#sdRecarregar').onclick = () => { carregar(); navegador(); };
    if (q('#cfgBaixar')) { q('#cfgBaixar').onclick = baixar; q('#cfgRest').onchange = e => restaurar(e.target); q('#cfgChave').onclick = () => SYNC.pedirChave('Digite a chave de acesso do servidor para este aparelho.').then(ok => ok && location.reload()); }
  }
  return { open() { ligar(); carregar(); navegador(); }, cfg() { ligar(); cfg(); } };
})();
if (document.querySelector('#v-saude.on')) SAUDE.open();
