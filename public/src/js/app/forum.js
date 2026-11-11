/* NEXORA — Fórum (navegador).
 * Com o servidor NEXORA (npm start): tópicos e respostas ficam em data/forum.json e todos veem.
 * Sem servidor (arquivo aberto direto ou dentro do Claude): modo local, salvo só neste navegador.
 * Regras: só o administrador cria/apaga tópicos; qualquer pessoa responde com nome ou apelido.
 */
const FORUM = (function () {
  'use strict';
  const q = s => document.querySelector(s);
  const CATS0 = [['antt', 'ANTT', '🏛️', 'Resoluções, regulamentações, fiscalizações, atualizações e obrigações.'], ['ciot', 'CIOT', '🧾', 'Emissão, obrigatoriedade, procedimentos e mudanças na legislação.'], ['frete', 'Frete Mínimo', '💲', 'Tabela de fretes, cálculos, reajustes e atualizações.'], ['pedagio', 'Vale-Pedágio', '🛣️', 'Regras, obrigatoriedade, procedimentos e legislação.'], ['legis', 'Legislação', '⚖️', 'Leis, normas, portarias e atualizações do setor de transporte.'], ['logistica', 'Transporte e Logística', '🚚', 'Notícias, informações e novidades do mercado.'], ['avisos', 'Comunicados', '📢', 'Avisos importantes e comunicados gerais.']].map(([id, nome, ic, desc]) => ({ id, nome, ic, desc }));
  let st = { cats: CATS0, topics: [], admin: false }, remote = null, token = sessionStorage.getItem('nxFTok') || '', view = { k: 'cats' };
  const uid = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  const local = () => LS.get('forum', null) || { topics: [{ id: uid(), cat: 'avisos', titulo: 'Bem-vindo ao fórum NEXORA', texto: 'Modo local: os tópicos ficam só neste navegador. Para o fórum compartilhado, rode o sistema com o servidor (npm start).', autor: 'Administração', admin: true, data: new Date().toISOString(), fixo: true, respostas: [] }] };

  async function api(path, opt = {}) {
    const r = await fetch('/api/forum' + path, { ...opt, headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Admin-Token': token } : {}) } });
    const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.erro || 'Erro ' + r.status); return b;
  }
  async function load() {
    if (remote !== false) {
      try { const b = await api(''); remote = true; st = b; if (token && !b.admin) { token = ''; sessionStorage.removeItem('nxFTok'); } }
      catch (e) { if (remote === true) { toast('Fórum: ' + e.message, true); return; } remote = false; }
    }
    if (remote === false) { const d = local(); st = { cats: CATS0, topics: d.topics, admin: true }; }
    const m = q('#fMode'); m.hidden = remote; m.textContent = 'Modo local: sem o servidor NEXORA, o fórum funciona só neste navegador (ninguém mais vê). Rode com “npm start” para compartilhar com todos.';
    q('#fAdmin').hidden = remote === false; q('#fAdmin').textContent = st.admin ? 'Sair do modo administrador' : 'Entrar como administrador';
  }
  const saveLocal = () => LS.set('forum', { topics: st.topics });
  const when = d => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const txt = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g, '<br>');
  const catOf = id => st.cats.find(c => c.id === id) || st.cats[0];
  const last = t => (t.respostas && t.respostas.length ? t.respostas[t.respostas.length - 1].data : t.data);
  const sorted = list => [...list].sort((a, b) => (b.fixo - a.fixo) || (new Date(last(b)) - new Date(last(a))));
  const badge = a => a ? '<span class="fadm">admin</span>' : '';

  function crumb() {
    const c = view.cat && catOf(view.cat), t = view.k === 'topic' && st.topics.find(x => x.id === view.id);
    q('#fCrumb').innerHTML = `<button class="lnk" data-fv="cats">Categorias</button>${c ? ` › <button class="lnk" data-fv="cat" data-c="${c.id}">${esc(c.nome)}</button>` : ''}${t ? ` › <span>${esc(t.titulo)}</span>` : view.k === 'new' ? ' › <span>Novo tópico</span>' : view.k === 'search' ? ' › <span>Busca</span>' : ''}`;
  }
  function topicRow(t) {
    const c = catOf(t.cat), n = (t.respostas || []).length;
    return `<button class="ftopic" data-fv="topic" data-id="${t.id}"><span class="fti">${t.fixo ? '📌' : c.ic}</span><span class="ftm"><b>${esc(t.titulo)}</b><small class="mut">${esc(c.nome)} · ${esc(t.autor)} · ${when(t.data)}</small></span><span class="ftn"><b>${n}</b><small>${n === 1 ? 'resposta' : 'respostas'}</small></span></button>`;
  }
  function render() {
    crumb(); const B = q('#fBody');
    if (view.k === 'cats') {
      B.innerHTML = `<div class="fcats">${st.cats.map(c => { const ts = st.topics.filter(t => t.cat === c.id), l = sorted(ts)[0];
        return `<button class="fcat" data-fv="cat" data-c="${c.id}"><span class="fci" aria-hidden="true">${c.ic}</span><span class="fcm"><b>${esc(c.nome)}</b><small>${esc(c.desc)}</small>${l ? `<small class="mut">Último: ${esc(l.titulo)}</small>` : ''}</span><span class="ftn"><b>${ts.length}</b><small>${ts.length === 1 ? 'tópico' : 'tópicos'}</small></span></button>`; }).join('')}</div>`;
    } else if (view.k === 'cat') {
      const c = catOf(view.cat), ts = sorted(st.topics.filter(t => t.cat === c.id));
      B.innerHTML = `<div class="fcathead"><span class="fci">${c.ic}</span><div><h2 style="margin:0">${esc(c.nome)}</h2><p class="mut" style="margin:2px 0 0">${esc(c.desc)}</p></div>${st.admin ? `<button class="btn pri" data-fv="new" data-c="${c.id}">+ Novo tópico</button>` : ''}</div>
        <div class="flist">${ts.map(topicRow).join('') || '<p class="mut">Nenhum tópico nesta categoria ainda. Os tópicos são abertos pela administração.</p>'}</div>`;
    } else if (view.k === 'search') {
      const k = norm(view.s), ts = sorted(st.topics.filter(t => norm(t.titulo + ' ' + t.texto + ' ' + (t.respostas || []).map(r => r.texto).join(' ')).includes(k)));
      B.innerHTML = `<h2>Resultados para “${esc(view.s)}”</h2><div class="flist">${ts.map(topicRow).join('') || '<p class="mut">Nada encontrado.</p>'}</div>`;
    } else if (view.k === 'topic') {
      const t = st.topics.find(x => x.id === view.id); if (!t) { view = { k: 'cats' }; return render(); }
      const nome = LS.get('forumNome', '');
      B.innerHTML = `<article class="fpost main"><header><h2>${t.fixo ? '📌 ' : ''}${esc(t.titulo)}</h2><small class="mut">${esc(catOf(t.cat).nome)} · ${esc(t.autor)} ${badge(t.admin)} · ${when(t.data)}</small>${st.admin ? `<button class="btn sm" data-fdel="${t.id}">Apagar tópico</button>` : ''}</header><div class="ftxt">${txt(t.texto)}</div></article>
        <h3 class="frh">${(t.respostas || []).length} resposta(s)</h3>
        ${(t.respostas || []).map(r => `<article class="fpost"><header><b>${esc(r.autor)}</b> ${badge(r.admin)}<small class="mut">${when(r.data)}</small>${st.admin ? `<button class="btn sm" data-fdelr="${r.id}" aria-label="Apagar resposta de ${esc(r.autor)}">Apagar</button>` : ''}</header><div class="ftxt">${txt(r.texto)}</div></article>`).join('')}
        <form class="card freply" id="fReply" novalidate><h3 style="margin:0 0 8px">Responder</h3>
         <label class="f">Seu nome ou apelido<input id="fRName" maxlength="40" value="${esc(nome)}" autocomplete="nickname" required></label>
         <label class="f">Mensagem<textarea id="fRText" rows="4" maxlength="5000" required></textarea></label>
         <p id="fRErr" class="bad" role="alert"></p><button class="btn pri">Publicar resposta</button>
         <p class="mut" style="font-size:12px;margin:6px 0 0">Seja respeitoso e cite a fonte (lei, resolução, portaria) quando possível.</p></form>`;
    } else if (view.k === 'new') {
      B.innerHTML = `<form class="card" id="fNew" novalidate><h2 style="margin-top:0">Novo tópico</h2>
        <label class="f">Categoria<select id="fNCat">${st.cats.map(c => `<option value="${c.id}" ${c.id === view.cat ? 'selected' : ''}>${c.ic} ${esc(c.nome)}</option>`).join('')}</select></label>
        <label class="f">Título<input id="fNTit" maxlength="140" required></label>
        <label class="f">Texto<textarea id="fNTxt" rows="8" maxlength="5000" required></textarea></label>
        <label class="chk"><input type="checkbox" id="fNFix"> Fixar no topo da categoria</label>
        <p id="fNErr" class="bad" role="alert"></p>
        <div style="display:flex;gap:8px"><button type="button" class="btn" data-fv="cat" data-c="${view.cat || 'avisos'}">Cancelar</button><button class="btn pri">Publicar tópico</button></div></form>`;
      setTimeout(() => { const i = q('#fNTit'); i && i.focus(); }, 30);
    }
  }
  async function refresh() { await load(); render(); }
  function nav(v) { view = v; render(); q('#main').scrollTop = 0; const h = q('#fBody h2, #fBody .fcat'); h && h.focus && (h.tabIndex = h.tabIndex < 0 ? -1 : h.tabIndex); }

  q('#v-forum').addEventListener('click', async e => {
    const b = e.target.closest('[data-fv]');
    if (b) { const k = b.dataset.fv; if (k === 'cats') nav({ k }); else if (k === 'cat') nav({ k, cat: b.dataset.c }); else if (k === 'topic') { const t = st.topics.find(x => x.id === b.dataset.id); nav({ k, id: b.dataset.id, cat: t && t.cat }); } else if (k === 'new') nav({ k, cat: b.dataset.c }); return; }
    const d = e.target.closest('[data-fdel],[data-fdelr]'); if (!d) return;
    if (d.dataset.confirm !== '1') { d.dataset.confirm = '1'; d.textContent = 'Confirmar exclusão'; setTimeout(() => { if (d.isConnected) { d.dataset.confirm = ''; d.textContent = d.dataset.fdel ? 'Apagar tópico' : 'Apagar'; } }, 3500); return; }
    try {
      if (d.dataset.fdel) { if (remote) await api('/topics/' + d.dataset.fdel, { method: 'DELETE' }); else { st.topics = st.topics.filter(t => t.id !== d.dataset.fdel); saveLocal(); } view = { k: 'cat', cat: view.cat }; toast('Tópico apagado.'); }
      else { if (remote) await api(`/topics/${view.id}/replies/${d.dataset.fdelr}`, { method: 'DELETE' }); else { const t = st.topics.find(x => x.id === view.id); t.respostas = t.respostas.filter(r => r.id !== d.dataset.fdelr); saveLocal(); } toast('Resposta apagada.'); }
      await refresh();
    } catch (er) { toast(er.message, true); }
  });
  q('#v-forum').addEventListener('submit', async e => {
    e.preventDefault();
    if (e.target.id === 'fReply') {
      const autor = q('#fRName').value.trim(), texto = q('#fRText').value.trim(), err = q('#fRErr');
      if (!autor || !texto) { err.textContent = !autor ? 'Informe seu nome ou apelido.' : 'Escreva a mensagem.'; (!autor ? q('#fRName') : q('#fRText')).focus(); return; }
      LS.set('forumNome', autor);
      try { if (remote) await api(`/topics/${view.id}/replies`, { method: 'POST', body: JSON.stringify({ autor, texto }) }); else { st.topics.find(x => x.id === view.id).respostas.push({ id: uid(), autor, texto, admin: false, data: new Date().toISOString() }); saveLocal(); }
        toast('Resposta publicada.'); await refresh(); const posts = document.querySelectorAll('#fBody .fpost'); posts[posts.length - 1].scrollIntoView({ block: 'center' }); } catch (er) { err.textContent = er.message; }
    }
    if (e.target.id === 'fNew') {
      const cat = q('#fNCat').value, titulo = q('#fNTit').value.trim(), texto = q('#fNTxt').value.trim(), fixo = q('#fNFix').checked, err = q('#fNErr');
      if (!titulo || !texto) { err.textContent = !titulo ? 'Informe o título.' : 'Escreva o texto do tópico.'; (!titulo ? q('#fNTit') : q('#fNTxt')).focus(); return; }
      try { let t; if (remote) t = await api('/topics', { method: 'POST', body: JSON.stringify({ cat, titulo, texto, fixo }) }); else { t = { id: uid(), cat, titulo, texto, fixo, autor: 'Administração', admin: true, data: new Date().toISOString(), respostas: [] }; st.topics.unshift(t); saveLocal(); }
        toast('Tópico publicado.'); await refresh(); nav({ k: 'topic', id: t.id, cat }); } catch (er) { err.textContent = er.message; }
    }
  });
  q('#fAdmForm').addEventListener('submit', async e => {
    e.preventDefault();
    {
      try { const r = await api('/login', { method: 'POST', body: JSON.stringify({ senha: q('#fAdmPass').value }) }); token = r.token; sessionStorage.setItem('nxFTok', token); q('#mFAdmin').classList.remove('on'); q('#fAdmPass').value = ''; toast('Modo administrador ativo.'); await refresh(); }
      catch (er) { q('#fAdmErr').textContent = er.message; q('#fAdmPass').focus(); }
    }
  });
  q('#fAdmin').onclick = async () => {
    if (st.admin) { try { await api('/logout', { method: 'POST' }); } catch (e) {} token = ''; sessionStorage.removeItem('nxFTok'); toast('Você saiu do modo administrador.'); await refresh(); return; }
    q('#fAdmErr').textContent = ''; q('#mFAdmin').classList.add('on'); setTimeout(() => q('#fAdmPass').focus(), 40);
  };
  q('#mFAdmin [data-close]').onclick = () => q('#mFAdmin').classList.remove('on');
  let sT; q('#fSearch').addEventListener('input', e => { clearTimeout(sT); sT = setTimeout(() => { const v = e.target.value.trim(); nav(v.length >= 2 ? { k: 'search', s: v } : { k: 'cats' }); }, 250); });
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return { open: refresh };
})();
