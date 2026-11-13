/* NEXORA — ferramentas de Configurações: backup dos dados e edição da tabela ANTT */
(function () {
  'use strict';
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const ANTT = window.NX_ANTT;

  /* ---------- backup ---------- */
  const PREFIX = ['nx2_', 'nexora_'];
  const ours = k => PREFIX.some(p => k.startsWith(p)) && !k.endsWith('forum'); /* o fórum local não entra */
  q('#bBkOut').onclick = () => {
    const data = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (ours(k)) data[k] = localStorage.getItem(k); }
    const blob = new Blob([JSON.stringify({ app: 'NEXORA', versao: 3, criado: new Date().toISOString(), dados: data }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nexora-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    const n = Object.keys(data).length; q('#bkMsg').textContent = `Backup gerado com ${n} item(ns). Guarde o arquivo em local seguro.`;
  };
  q('#bBkInLbl').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('#bkFile').click(); } });
  q('#bkFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const msg = q('#bkMsg');
    try {
      const j = JSON.parse(await f.text()); if (j.app !== 'NEXORA' || !j.dados || typeof j.dados !== 'object') throw new Error('Este arquivo não é um backup do NEXORA.');
      const keys = Object.keys(j.dados).filter(ours); if (!keys.length) throw new Error('O backup está vazio.');
      msg.className = 'warn'; msg.innerHTML = `Restaurar ${keys.length} item(ns) do backup de ${new Date(j.criado).toLocaleString('pt-BR')}? Os dados atuais deste navegador serão substituídos. <span style="display:inline-flex;gap:6px;margin-top:6px"><button class="btn sm pri" id="bkYes">Confirmar restauração</button><button class="btn sm" id="bkNo">Cancelar</button></span>`;
      q('#bkYes').focus();
      q('#bkNo').onclick = () => { msg.className = 'mut'; msg.textContent = 'Restauração cancelada.'; };
      q('#bkYes').onclick = () => {
        for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (ours(k)) localStorage.removeItem(k); }
        for (const k of keys) localStorage.setItem(k, String(j.dados[k]));
        msg.className = 'ok'; msg.textContent = 'Backup restaurado. Recarregando…'; setTimeout(() => location.reload(), 700);
      };
    } catch (er) { msg.textContent = 'Não foi possível restaurar: ' + er.message; msg.className = 'bad'; }
    e.target.value = '';
  };

  /* ---------- tabela ANTT ---------- */
  if (!ANTT) return;
  let draft = null;
  const cur = () => q('#atTab').value || 'A';
  function loadDraft() { draft = {}; for (const t of Object.keys(ANTT.TABELAS)) draft[t] = JSON.parse(JSON.stringify(ANTT.tabela(t))); }
  function render() {
    if (!draft) loadDraft();
    const t = cur(), tipo = q('#atTipo').value || 'geral', c = draft[t][tipo];
    q('#atRows').innerHTML = ANTT.EIXOS.map((e, i) => `<tr><td><b>${e}</b></td><td><input type="number" step="0.0001" min="0" data-at="ccd" data-i="${i}" value="${c.ccd[i] ?? ''}" placeholder="—" aria-label="CCD ${e} eixos"></td><td><input type="number" step="0.01" min="0" data-at="cc" data-i="${i}" value="${c.cc[i] ?? ''}" placeholder="—" aria-label="CC ${e} eixos"></td></tr>`).join('');
    const inf = ANTT.info(); q('#atMsg').className = 'mut';
    q('#atMsg').textContent = inf ? `Usando valores personalizados${inf.nota ? ' (' + inf.nota + ')' : ''}, salvos em ${new Date(inf.data).toLocaleString('pt-BR')}.` : 'Usando os valores oficiais: ' + ANTT.fonte + '.';
  }
  q('#atTab').innerHTML = Object.entries(ANTT.TABELAS).map(([k, t]) => `<option value="${k}">${t.nome}</option>`).join('');
  q('#atTipo').innerHTML = Object.entries(ANTT.NOMES).map(([k, n]) => `<option value="${k}" ${k === 'geral' ? 'selected' : ''}>${n}</option>`).join('');
  q('#atTab').onchange = q('#atTipo').onchange = render;
  q('#atRows').addEventListener('input', e => { const i = e.target; if (!i.dataset.at) return; const c = draft[cur()][q('#atTipo').value]; c[i.dataset.at][+i.dataset.i] = i.value === '' ? null : Math.max(0, +i.value); });
  q('#atSave').onclick = () => {
    for (const t in draft) for (const k in draft[t]) { const c = draft[t][k]; for (let i = 0; i < 7; i++) if ((c.ccd[i] == null) !== (c.cc[i] == null)) { q('#atMsg').className = 'bad'; q('#atMsg').textContent = `${ANTT.TABELAS[t].nome}, ${ANTT.NOMES[k]}, ${ANTT.EIXOS[i]} eixos: preencha CCD e CC juntos (ou deixe os dois vazios).`; return; } }
    ANTT.salvar(draft, q('#atNota').value.trim()); render(); toast('Tabela ANTT personalizada salva.'); if (typeof RT === 'object') RT.renderAntt();
  };
  q('#atReset').onclick = () => { ANTT.restaurar(); loadDraft(); q('#atNota').value = ''; render(); toast('Valores oficiais da ANTT restaurados.'); if (typeof RT === 'object') RT.renderAntt(); };
  const inf = ANTT.info(); if (inf) q('#atNota').value = inf.nota || '';
  render();
})();
