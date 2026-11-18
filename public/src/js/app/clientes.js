/* NEXORA — Cadastro de clientes (salvo neste navegador).
 * CNPJ → razão social, endereço e contato (mesma consulta da tela de empresas); CEP → endereço e cidade.
 * A cidade fica ligada ao município do IBGE (com coordenadas), então o cliente entra direto na Roteirização.
 */
const CLI = (function () {
  'use strict';
  const q = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let lista = [], MUN = null, iniciado = false;
  function mun() { if (!MUN) MUN = (window.NX_MUN || []).map(l => { const [nome, uf, la, lo, cap] = l.split('|'); return { nome, uf, lat: +la, lon: +lo, cap: cap === '1', k: norm(nome) }; }); return MUN; }
  /* "Campinas - SP", "Campinas/SP" ou nome + UF separados */
  function cidade(txt, ufX) {
    const t = norm(txt), m = t.match(/^(.*?)\s*[-\/,]\s*([a-z]{2})$/), nome = m ? m[1].trim() : t, uf = (m ? m[2] : ufX || '').toUpperCase();
    if (!nome) return null; const h = mun().filter(c => c.k === nome && (!uf || c.uf === uf));
    return h.length === 1 ? h[0] : h.find(c => c.cap) || null;
  }
  const rotulo = c => c ? c.nome + ' - ' + c.uf : '';
  const fmtDoc = d => !d ? '' : d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : d;
  const fmtCep = c => (c || '').replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
  const endereco = c => [c.logradouro, c.numero, c.complemento, c.bairro].filter(Boolean).join(', ');
  const toastX = (m, e) => (window.toast ? toast(m, e) : alert(m));

  async function carregar() { lista = await DB.listClients(); return lista; }
  function desenhar() {
    const t = norm(q('#clBusca').value), vis = lista.filter(c => !t || norm([c.nome, c.fantasia, c.doc, c.city, c.uf, c.contato, c.bairro].join(' ')).includes(t) || (c.doc || '').includes(t.replace(/\D/g, '') || '§'));
    q('#clLista').innerHTML = !lista.length ? '<div class="card clvazio"><b>Nenhum cliente ainda.</b><p class="mut" style="margin:4px 0 0">Clique em “+ Novo cliente”. Com o CNPJ ou o CEP, o NEXORA preenche o endereço sozinho.</p></div>'
      : !vis.length ? '<p class="mut">Nenhum cliente com essa busca.</p>'
      : `<p class="mut" style="margin:0 0 6px">${vis.length} de ${lista.length} cliente(s)</p><ul class="cllist">${vis.map(c => `<li class="card clitem">
        <div class="cltop"><b>${esc(c.nome)}</b>${c.fantasia ? ` <span class="mut">(${esc(c.fantasia)})</span>` : ''}${c.agenda ? ' <span class="cltag">📅 agendamento</span>' : ''}${c.restricao ? ' <span class="cltag">🚫 veículo grande</span>' : ''}</div>
        <div class="mut clinfo">${c.doc ? 'CNPJ/CPF ' + esc(fmtDoc(c.doc)) + ' · ' : ''}${esc(endereco(c))}${c.city ? ' · <b>' + esc(c.city + ' - ' + c.uf) + '</b>' : ' · <span class="bad">sem cidade</span>'}${c.cep ? ' · CEP ' + esc(fmtCep(c.cep)) : ''}</div>
        ${c.contato || c.telefone || c.email || c.horario ? `<div class="clinfo">${[c.contato && '👤 ' + esc(c.contato), c.telefone && '📞 ' + esc(c.telefone), c.email && '✉️ ' + esc(c.email), c.horario && '🕘 ' + esc(c.horario)].filter(Boolean).join(' · ')}</div>` : ''}
        <div class="cbacoes clbt"><button class="btn sm pri" type="button" data-cl="rota" data-id="${c.id}" ${c.lat == null ? 'disabled title="Informe a cidade"' : ''}>🚚 Usar em rota</button><button class="btn sm" type="button" data-cl="edit" data-id="${c.id}">✏️ Editar</button><button class="btn sm" type="button" data-cl="del" data-id="${c.id}" aria-label="Excluir ${esc(c.nome)}">🗑</button></div></li>`).join('')}</ul>`;
  }
  const F = () => q('#clForm'), el = n => F().elements[n];
  function abrir(c) {
    F().reset(); q('#clErr').textContent = ''; q('#clMsg').textContent = '';
    q('#clFormT').textContent = c ? 'Editar cliente' : 'Novo cliente';
    if (c) { for (const k of ['id', 'nome', 'fantasia', 'logradouro', 'numero', 'complemento', 'bairro', 'contato', 'telefone', 'email', 'horario', 'obs']) el(k).value = c[k] || ''; el('doc').value = fmtDoc(c.doc); el('cep').value = fmtCep(c.cep); el('cidade').value = c.city ? c.city + ' - ' + c.uf : ''; el('agenda').checked = !!c.agenda; el('restricao').checked = !!c.restricao; }
    F().hidden = false; F().scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => el(c ? 'nome' : 'doc').focus(), 250);
  }
  async function porCep(silencioso) {
    const r = await SV.cep(el('cep').value).catch(() => null);
    if (!r) { if (!silencioso) q('#clMsg').textContent = 'Digite um CEP com 8 números.'; return; }
    if (r.naoEncontrado) { q('#clMsg').textContent = 'CEP não encontrado.'; return; }
    if (r.logradouro && !el('logradouro').value) el('logradouro').value = r.logradouro;
    if (r.bairro && !el('bairro').value) el('bairro').value = r.bairro;
    if (r.cidade) el('cidade').value = r.cidade + ' - ' + r.uf;
    el('cep').value = fmtCep(r.cep); q('#clMsg').textContent = `📍 Endereço preenchido pelo CEP: ${r.logradouro || ''} ${r.bairro ? '· ' + r.bairro : ''} · ${r.cidade} - ${r.uf}`;
    if (!el('numero').value) el('numero').focus();
  }
  async function porCnpj() {
    const d = el('doc').value.replace(/\D/g, ''); if (d.length !== 14) { q('#clMsg').textContent = 'A busca automática funciona com CNPJ (14 números).'; return; }
    q('#clMsg').textContent = 'Buscando na Receita…';
    let e = null;
    try { const r = await fetch('/api/empresas/cnpj/' + d); const ct = r.headers.get('content-type') || ''; if (ct.includes('json')) { const j = await r.json(); if (r.ok) e = j.empresa; else throw new Error(j.erro); } } catch (er) { /* tenta direto */ }
    if (!e) { try { const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + d); if (r.ok) e = window.NX_EMP.normalizar(await r.json(), 'BrasilAPI'); } catch (er) { /* sem acesso */ } }
    if (!e) { q('#clMsg').textContent = 'Não foi possível consultar o CNPJ agora. Preencha à mão ou tente de novo.'; return; }
    const en = e.endereco || {}, cap = s => String(s || '').toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    el('nome').value = e.razao || el('nome').value; if (e.fantasia && !el('fantasia').value) el('fantasia').value = e.fantasia;
    if (en.cep) el('cep').value = fmtCep(en.cep); if (en.logradouro) el('logradouro').value = en.logradouro; if (en.numero) el('numero').value = en.numero; if (en.complemento) el('complemento').value = en.complemento; if (en.bairro) el('bairro').value = en.bairro;
    if (en.municipio) el('cidade').value = cap(en.municipio) + ' - ' + en.uf;
    if (e.telefones && e.telefones[0] && !el('telefone').value) el('telefone').value = e.telefones[0]; if (e.email && !el('email').value) el('email').value = String(e.email).toLowerCase();
    el('doc').value = fmtDoc(d);
    q('#clMsg').textContent = `✅ Dados da Receita: ${e.razao}${e.situacao ? ' · situação ' + e.situacao : ''}${/ATIVA/i.test(e.situacao || '') || !e.situacao ? '' : ' ⚠️'}`;
  }
  async function salvar(ev) {
    ev.preventDefault(); q('#clErr').textContent = '';
    const v = n => el(n).value.trim(), cid = cidade(v('cidade'));
    if (!cid) { q('#clErr').textContent = v('cidade') ? 'Cidade não encontrada: escreva como “Campinas - SP” ou use o CEP.' : 'Informe a cidade (ou o CEP).'; el('cidade').focus(); return; }
    const c = { id: v('id') || undefined, nome: v('nome'), fantasia: v('fantasia'), doc: v('doc'), cep: v('cep').replace(/\D/g, ''), logradouro: v('logradouro'), numero: v('numero'), complemento: v('complemento'), bairro: v('bairro'), city: cid.nome, uf: cid.uf, lat: cid.lat, lon: cid.lon, contato: v('contato'), telefone: v('telefone'), email: v('email'), horario: v('horario'), agenda: el('agenda').checked, restricao: el('restricao').checked, obs: v('obs') };
    try { const s = await DB.saveClient(c); await carregar(); F().hidden = true; desenhar(); toastX(`Cliente “${s.nome}” salvo.`); const it = q(`[data-cl=edit][data-id="${s.id}"]`); if (it) it.focus(); }
    catch (er) { q('#clErr').textContent = er.message; }
  }
  /* importação CSV simples: nome;cnpj;cep;numero;contato;telefone;email — busca o CEP de cada linha */
  async function importar(inp) {
    const f = inp.files[0]; inp.value = ''; if (!f) return;
    const txt = await f.text(), linhas = txt.split(/\r?\n/).filter(l => l.trim()); if (linhas.length < 2) return toastX('Arquivo vazio ou sem cabeçalho.', true);
    const sep = linhas[0].includes(';') ? ';' : ',', cab = linhas[0].split(sep).map(norm), idx = n => cab.findIndex(c => c.includes(n));
    const I = { nome: idx('nome'), doc: Math.max(idx('cnpj'), idx('cpf'), idx('doc')), cep: idx('cep'), numero: idx('numero'), contato: idx('contato'), telefone: Math.max(idx('telefone'), idx('fone')), email: idx('mail'), cidade: idx('cidade'), uf: idx('uf') };
    if (I.nome < 0) return toastX('Faltou a coluna “nome” no cabeçalho.', true);
    let ok = 0, falha = 0;
    for (const l of linhas.slice(1)) {
      const c = l.split(sep).map(x => x.trim().replace(/^"|"$/g, '')), g = k => I[k] >= 0 ? c[I[k]] || '' : '';
      const x = { nome: g('nome'), doc: g('doc'), cep: g('cep').replace(/\D/g, ''), numero: g('numero'), contato: g('contato'), telefone: g('telefone'), email: g('email') };
      let cid = g('cidade') ? cidade(g('cidade'), g('uf')) : null;
      if (x.cep) { const r = await SV.cep(x.cep).catch(() => null); if (r && !r.naoEncontrado) { x.logradouro = r.logradouro; x.bairro = r.bairro; cid = cid || cidade(r.cidade, r.uf); } }
      if (cid) Object.assign(x, { city: cid.nome, uf: cid.uf, lat: cid.lat, lon: cid.lon });
      try { await DB.saveClient(x); ok++; } catch (e) { falha++; }
    }
    await carregar(); desenhar(); toastX(`Importados: ${ok} cliente(s)${falha ? ` · ${falha} linha(s) com erro (sem nome ou documento repetido)` : ''}.`, !!falha && !ok);
  }
  function excel() {
    if (!lista.length || typeof NXLSX !== 'object') return;
    NXLSX.download('clientes-nexora.xlsx', 'Clientes', [{ titulo: 'Nome', largura: 34 }, { titulo: 'Fantasia', largura: 20 }, { titulo: 'CNPJ/CPF', largura: 18 }, { titulo: 'CEP', largura: 10 }, { titulo: 'Endereço', largura: 40 }, { titulo: 'Cidade', largura: 20 }, { titulo: 'UF', largura: 5 }, { titulo: 'Contato', largura: 18 }, { titulo: 'Telefone', largura: 16 }, { titulo: 'E-mail', largura: 26 }, { titulo: 'Horário', largura: 20 }, { titulo: 'Agendamento', largura: 12 }, { titulo: 'Obs.', largura: 30 }],
      lista.map(c => [c.nome, c.fantasia || '', fmtDoc(c.doc), fmtCep(c.cep), endereco(c), c.city || '', c.uf || '', c.contato || '', c.telefone || '', c.email || '', c.horario || '', c.agenda ? 'sim' : '', c.obs || '']));
  }
  function ligar() {
    q('#clNovo').onclick = () => abrir(null); q('#clCancel').onclick = () => { F().hidden = true; q('#clNovo').focus(); };
    F().onsubmit = salvar; q('#clCep').onclick = () => porCep(false); q('#clCnpj').onclick = porCnpj;
    el('cep').addEventListener('input', e => { if (e.target.value.replace(/\D/g, '').length === 8) porCep(true); });
    el('doc').addEventListener('change', e => { if (e.target.value.replace(/\D/g, '').length === 14 && !el('nome').value) porCnpj(); });
    el('cidade').addEventListener('input', e => { const t = norm(e.target.value).replace(/\s*-.*$/, ''); if (t.length < 2) return; q('#clCidades').innerHTML = mun().filter(c => c.k.startsWith(t)).slice(0, 12).map(c => `<option value="${esc(c.nome + ' - ' + c.uf)}">`).join(''); });
    q('#clBusca').oninput = desenhar; q('#clExcel').onclick = excel; q('#clImp').onchange = e => importar(e.target);
    q('#clLista').onclick = async e => {
      const b = e.target.closest('[data-cl]'); if (!b) return; const c = lista.find(x => x.id === b.dataset.id); if (!c) return;
      if (b.dataset.cl === 'edit') abrir(c);
      else if (b.dataset.cl === 'del') { if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Confirmar'; return; } await DB.deleteClient(c.id); await carregar(); desenhar(); toastX('Cliente excluído.'); }
      else if (b.dataset.cl === 'rota') { if (typeof RT === 'object' && RT.addCliente) { RT.addCliente(c); go('rota'); toastX(`“${c.nome}” adicionado como entrega.`); } }
    };
  }
  async function open() { if (!iniciado) { iniciado = true; ligar(); } await carregar(); desenhar(); }
  return { open, carregar, lista: () => lista, cidade, endereco, rotulo };
})();
if (document.querySelector('#v-clientes.on')) CLI.open();
