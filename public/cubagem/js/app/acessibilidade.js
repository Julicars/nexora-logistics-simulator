/* Acessibilidade NEXORA: tabela do plano de carga, navegação por teclado entre volumes,
 * aria-live para resultado/status, foco em modais, skip link, contraste alto e alvos de toque.
 * Depende de: nucleo.js, cena.js, edicao.js, resultados.js, modais.js, exportar.js, extras.js, cores.js */
'use strict';

/* ==================== Textos (4 idiomas) ==================== */
(function () {
  const D = {
    'pt-BR': {
      'ac.listView': 'Ver como lista', 'ac.listViewTitle': 'Plano de carga em formato de tabela acessível',
      'ac.close': 'Fechar', 'ac.modal.title': 'Plano de carga — tabela',
      'ac.th.seq': 'Nº', 'ac.th.code': 'Código', 'ac.th.name': 'Nome/Descrição',
      'ac.th.wagon': 'Vagão', 'ac.th.x': 'X (m)', 'ac.th.y': 'Y (m)', 'ac.th.z': 'Z (m)',
      'ac.th.c': 'C (m)', 'ac.th.l': 'L (m)', 'ac.th.h': 'A (m)', 'ac.th.weight': 'Peso (kg)',
      'ac.empty': 'Sem plano. Clique em Simular para gerar o carregamento.',
      'ac.nav.vol': 'Volume {n} de {t}: {name} · vagão {v}',
      'ac.nav.none': 'Nenhum volume selecionado. Use Tab para navegar.',
      'ac.nav.hint': 'Tab / Shift+Tab para navegar entre volumes · Enter para selecionar',
      'ac.contrast': 'Alto contraste', 'ac.contrast.note': 'Aumenta o contraste das bordas e textos para facilitar a leitura.',
      'ac.zoom': 'Escala de texto', 'ac.zoom.note': 'Aumenta o tamanho dos textos da interface.',
      'ac.zoom.100': 'Normal (100%)', 'ac.zoom.125': 'Grande (125%)', 'ac.zoom.150': 'Maior (150%)',
      'ac.skip': 'Ir para o conteúdo',
      'ac.live.loaded': '{n} volumes carregados · {kg} kg · {o}% de ocupação',
      'ac.live.leftOut': '{n} volumes não couberam',
      'ac.live.extra': 'Sugeridos {n} veículos adicionais',
      'ac.live.done': 'Simulação concluída.',
    },
    en: {
      'ac.listView': 'List view', 'ac.listViewTitle': 'Load plan as accessible table',
      'ac.close': 'Close', 'ac.modal.title': 'Load plan — table',
      'ac.th.seq': '#', 'ac.th.code': 'Code', 'ac.th.name': 'Name/Description',
      'ac.th.wagon': 'Section', 'ac.th.x': 'X (m)', 'ac.th.y': 'Y (m)', 'ac.th.z': 'Z (m)',
      'ac.th.c': 'L (m)', 'ac.th.l': 'W (m)', 'ac.th.h': 'H (m)', 'ac.th.weight': 'Weight (kg)',
      'ac.empty': 'No plan yet. Click Simulate to generate the load.',
      'ac.nav.vol': 'Volume {n} of {t}: {name} · section {v}',
      'ac.nav.none': 'No volume selected. Use Tab to navigate.',
      'ac.nav.hint': 'Tab / Shift+Tab to navigate volumes · Enter to select',
      'ac.contrast': 'High contrast', 'ac.contrast.note': 'Increases edge and text contrast for easier reading.',
      'ac.zoom': 'Text scale', 'ac.zoom.note': 'Increases the size of interface text.',
      'ac.zoom.100': 'Normal (100%)', 'ac.zoom.125': 'Large (125%)', 'ac.zoom.150': 'Larger (150%)',
      'ac.skip': 'Skip to content',
      'ac.live.loaded': '{n} volumes loaded · {kg} kg · {o}% occupancy',
      'ac.live.leftOut': '{n} volumes did not fit',
      'ac.live.extra': '{n} additional vehicles suggested',
      'ac.live.done': 'Simulation complete.',
    },
    es: {
      'ac.listView': 'Ver como lista', 'ac.listViewTitle': 'Plan de carga en tabla accesible',
      'ac.close': 'Cerrar', 'ac.modal.title': 'Plan de carga — tabla',
      'ac.th.seq': 'Nº', 'ac.th.code': 'Código', 'ac.th.name': 'Nombre/Descripción',
      'ac.th.wagon': 'Vagón', 'ac.th.x': 'X (m)', 'ac.th.y': 'Y (m)', 'ac.th.z': 'Z (m)',
      'ac.th.c': 'L (m)', 'ac.th.l': 'An (m)', 'ac.th.h': 'Al (m)', 'ac.th.weight': 'Peso (kg)',
      'ac.empty': 'Sin plan. Haga clic en Simular para generar la carga.',
      'ac.nav.vol': 'Volumen {n} de {t}: {name} · vagón {v}',
      'ac.nav.none': 'Ningún volumen seleccionado. Use Tab para navegar.',
      'ac.nav.hint': 'Tab / Shift+Tab para navegar entre volúmenes · Enter para seleccionar',
      'ac.contrast': 'Alto contraste', 'ac.contrast.note': 'Aumenta el contraste de bordes y textos.',
      'ac.zoom': 'Escala de texto', 'ac.zoom.note': 'Aumenta el tamaño del texto de la interfaz.',
      'ac.zoom.100': 'Normal (100%)', 'ac.zoom.125': 'Grande (125%)', 'ac.zoom.150': 'Mayor (150%)',
      'ac.skip': 'Ir al contenido',
      'ac.live.loaded': '{n} volúmenes cargados · {kg} kg · {o}% de ocupación',
      'ac.live.leftOut': '{n} volúmenes no cupieron',
      'ac.live.extra': 'Sugeridos {n} vehículos adicionales',
      'ac.live.done': 'Simulación completada.',
    },
    fr: {
      'ac.listView': 'Vue liste', 'ac.listViewTitle': 'Plan de chargement en tableau accessible',
      'ac.close': 'Fermer', 'ac.modal.title': 'Plan de chargement — tableau',
      'ac.th.seq': 'N°', 'ac.th.code': 'Code', 'ac.th.name': 'Nom/Description',
      'ac.th.wagon': 'Section', 'ac.th.x': 'X (m)', 'ac.th.y': 'Y (m)', 'ac.th.z': 'Z (m)',
      'ac.th.c': 'L (m)', 'ac.th.l': 'l (m)', 'ac.th.h': 'H (m)', 'ac.th.weight': 'Poids (kg)',
      'ac.empty': 'Pas de plan. Cliquez sur Simuler pour générer le chargement.',
      'ac.nav.vol': 'Colis {n} sur {t} : {name} · section {v}',
      'ac.nav.none': 'Aucun colis sélectionné. Utilisez Tab pour naviguer.',
      'ac.nav.hint': 'Tab / Maj+Tab pour naviguer entre colis · Entrée pour sélectionner',
      'ac.contrast': 'Contraste élevé', 'ac.contrast.note': 'Augmente le contraste des bordures et des textes.',
      'ac.zoom': 'Échelle du texte', 'ac.zoom.note': "Agrandit le texte de l'interface.",
      'ac.zoom.100': 'Normal (100 %)', 'ac.zoom.125': 'Grand (125 %)', 'ac.zoom.150': 'Plus grand (150 %)',
      'ac.skip': 'Aller au contenu',
      'ac.live.loaded': '{n} colis chargés · {kg} kg · {o} % occupé',
      'ac.live.leftOut': '{n} colis hors chargement',
      'ac.live.extra': '{n} véhicules supplémentaires suggérés',
      'ac.live.done': 'Simulation terminée.',
    },
  };
  Object.keys(D).forEach((l) => I18N.extend(l, D[l]));
})();

/* ==================== Skip link ==================== */
(function () {
  const skip = document.createElement('a');
  skip.href = '#palco';
  skip.className = 'skip-link';
  skip.textContent = T('ac.skip');
  // insere no começo do body
  document.body.insertBefore(skip, document.body.firstChild);
  // garante que #palco seja focável
  const palco = document.querySelector('.palco');
  if (palco && !palco.id) palco.id = 'palco';
  if (palco && !palco.hasAttribute('tabindex')) palco.setAttribute('tabindex', '-1');
})();

/* ==================== Modal "Ver como lista" ==================== */
(function () {
  // cria o modal no DOM
  const html = `
<div class="modal" id="modalListaPlano" hidden>
  <div class="modal-caixa largo" role="dialog" aria-modal="true" aria-labelledby="tituloListaPlano">
    <div class="modal-cab">
      <h2 id="tituloListaPlano">${esc(T('ac.modal.title'))}</h2>
      <button type="button" class="ico" id="fecharListaPlano" data-fechar aria-label="${esc(T('ac.close'))}">
        <svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8"/></svg>
      </button>
    </div>
    <div class="tabela-rolagem" id="corpoListaPlano"></div>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // atualiza o título do modal com o idioma atual
  function atualizarTituloModal() {
    const t = document.getElementById('tituloListaPlano');
    if (t) t.textContent = T('ac.modal.title');
    const f = document.getElementById('fecharListaPlano');
    if (f) f.setAttribute('aria-label', T('ac.close'));
  }

  // preenche a tabela com os dados do plano atual
  function abrirListaPlano() {
    atualizarTituloModal();
    const corpo = document.getElementById('corpoListaPlano');
    if (!corpo) return;
    if (!st.res || !st.res.colocados.length) {
      corpo.innerHTML = `<p class="nota" style="padding:16px">${esc(T('ac.empty'))}</p>`;
    } else {
      const linhas = linhasPlano();
      const cols = [
        { key: 'seq', label: T('ac.th.seq') }, { key: 'codigo', label: T('ac.th.code') },
        { key: 'nome', label: T('ac.th.name') }, { key: 'vagao', label: T('ac.th.wagon') },
        { key: 'x', label: T('ac.th.x') }, { key: 'y', label: T('ac.th.y') }, { key: 'z', label: T('ac.th.z') },
        { key: 'c', label: T('ac.th.c') }, { key: 'l', label: T('ac.th.l') }, { key: 'h', label: T('ac.th.h') },
        { key: 'peso', label: T('ac.th.weight') },
      ];
      const cabHead = cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('');
      const corpo_rows = linhas.map((r) => {
        const cells = cols.map((c) => `<td>${esc(String(r[c.key] ?? ''))}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      corpo.innerHTML = `
<table class="tabela" aria-label="${esc(T('ac.modal.title'))}">
  <thead><tr>${cabHead}</tr></thead>
  <tbody>${corpo_rows}</tbody>
</table>`;
    }
    // usa a infraestrutura de modal do modais.js (gerencia focoAntes / modalAberto)
    abrirJanela('modalListaPlano');
  }

  // o modal de lista é dinâmico — adiciona listener de clique no fundo para fechar
  document.getElementById('modalListaPlano').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalListaPlano')) fecharJanela();
  });

  // botão "Ver como lista" na barra de exportação
  const btnListaPlano = document.getElementById('btnListaPlano');
  if (btnListaPlano) btnListaPlano.addEventListener('click', abrirListaPlano);
})();

/* ==================== aria-live: resultado da simulação ==================== */
(function () {
  // cria região aria-live invisível
  const region = document.createElement('div');
  region.id = 'acLiveResult';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.className = 'sr-only';
  document.body.appendChild(region);

  function anunciarResultado() {
    if (!st.res) return;
    const col = st.res.colocados.length;
    const fora = st.res.foraDoVeiculo ? st.res.foraDoVeiculo.length : 0;
    const stats = st.res.stats || {};
    const kg = stats.kg ? ni(Math.round(stats.kg)) : '—';
    const ocup = stats.ocupacao != null ? Math.round(stats.ocupacao * 100) : '—';

    const partes = [T('ac.live.done')];
    partes.push(T('ac.live.loaded', { n: ni(col), kg, o: ocup }));
    if (fora > 0) partes.push(T('ac.live.leftOut', { n: ni(fora) }));

    // verifica extras gerados pelo extras.js
    const corpoExtras = document.getElementById('corpoExtras');
    if (corpoExtras && corpoExtras.children.length > 0) {
      partes.push(T('ac.live.extra', { n: corpoExtras.children.length }));
    }

    region.textContent = '';
    // pequeno delay para garantir que o leitor detecte a mudança
    setTimeout(() => { region.textContent = partes.join(' '); }, 100);
  }

  // hook na função simular — anuncia após construir os resultados
  (function () {
    const orig = simular;
    simular = function (opcoes) {
      orig(opcoes);
      // aguarda a animação terminar (se houver) antes de anunciar
      const delay = st.res && st.res.colocados.length > 0 ? 600 : 150;
      setTimeout(anunciarResultado, delay);
    };
  })();
})();

/* ==================== Navegação por teclado entre volumes (Tab / Shift+Tab) ==================== */
(function () {
  // índice do volume focado pelo teclado (diferente de st.sel que é o selecionado/editável)
  let volFoco = -1;

  // elemento aria-live para anunciar o volume com foco
  const liveVol = document.createElement('div');
  liveVol.id = 'acLiveVol';
  liveVol.setAttribute('aria-live', 'polite');
  liveVol.setAttribute('aria-atomic', 'true');
  liveVol.className = 'sr-only';
  document.body.appendChild(liveVol);

  // dica visual de navegação por teclado (append ao viewport)
  const dicaNav = document.createElement('div');
  dicaNav.id = 'dicaNavVol';
  dicaNav.className = 'dica-nav-vol sr-hidden';
  dicaNav.setAttribute('aria-hidden', 'true');
  dicaNav.textContent = T('ac.nav.hint');
  const vp = document.getElementById('viewport');
  if (vp) vp.appendChild(dicaNav);

  function totalVolumes() {
    return st.res && st.res.colocados ? st.res.colocados.length : 0;
  }

  function nomeVolume(i) {
    if (!st.res || !st.res.colocados[i]) return '';
    const c = st.res.colocados[i];
    const p = st.pedidos[c.pi] || {};
    return p.nome || p.codigo || `vol ${i + 1}`;
  }

  function anunciarVol(i) {
    const total = totalVolumes();
    if (i < 0 || i >= total) {
      liveVol.textContent = T('ac.nav.none');
      return;
    }
    const c = st.res.colocados[i];
    liveVol.textContent = T('ac.nav.vol', {
      n: ni(i + 1), t: ni(total),
      name: nomeVolume(i), v: ni(c.vagao + 1),
    });
  }

  function irParaVol(i) {
    const total = totalVolumes();
    if (total === 0) return;
    // cicla
    volFoco = ((i % total) + total) % total;
    // realça visualmente (mesma lógica de selecionar mas sem entrar em modo edição)
    if (typeof colorirVolumes === 'function') {
      const anterior = st.sel;
      st.sel = volFoco;
      colorirVolumes();
      st.sel = anterior; // não muda o sel — só destaca
    }
    anunciarVol(volFoco);
  }

  // quando um volume é selecionado pelo clique/edição, sincroniza o índice de foco
  (function () {
    const orig = selecionar;
    selecionar = function (i) {
      orig(i);
      if (i >= 0) volFoco = i;
    };
  })();

  // reseta o foco de teclado quando uma nova simulação começa
  (function () {
    const orig = simular;
    simular = function (opcoes) {
      orig(opcoes);
      volFoco = -1;
    };
  })();

  // detecta foco no viewport e mostra a dica
  if (vp) {
    vp.addEventListener('focus', () => {
      dicaNav.classList.remove('sr-hidden');
      dicaNav.classList.add('visivel');
    });
    vp.addEventListener('blur', () => {
      dicaNav.classList.remove('visivel');
    });
  }

  // Tab e Shift+Tab enquanto o viewport tem foco
  document.addEventListener('keydown', (e) => {
    const tag = (e.target || {}).tagName || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || modalAberto) return;

    // Tab no viewport navega entre volumes
    if (e.key === 'Tab' && document.activeElement === document.getElementById('viewport')) {
      const total = totalVolumes();
      if (total === 0) return;
      e.preventDefault();
      irParaVol(volFoco + (e.shiftKey ? -1 : 1));
      return;
    }

    // Enter enquanto viewport tem foco + volFoco válido → seleciona para edição
    if (e.key === 'Enter' && document.activeElement === document.getElementById('viewport') && volFoco >= 0) {
      e.preventDefault();
      selecionar(volFoco);
      return;
    }
  });
})();

/* ==================== Aba de acessibilidade: alto contraste e zoom de texto ==================== */
(function () {
  const CHAVE_CONTRASTE = 'simulador3d.altoContraste.v1';
  const CHAVE_ZOOM = 'simulador3d.zoomTexto.v1';

  let altoContraste = lerLocal(CHAVE_CONTRASTE) === true;
  let zoomTexto = lerLocal(CHAVE_ZOOM) || '100';

  function aplicarContraste() {
    document.body.classList.toggle('alto-contraste', altoContraste);
  }
  function aplicarZoom() {
    const v = parseFloat(zoomTexto) || 100;
    document.documentElement.style.setProperty('--zoom-texto', v / 100);
  }

  aplicarContraste();
  aplicarZoom();

  // renderiza as opções extras na aba Acessibilidade (após opcoesCor)
  function renderOpcoesTeclas() {
    const aba = document.getElementById('aba-acess');
    if (!aba) return;

    // remove bloco anterior se existir
    const old = document.getElementById('secaoContrastes');
    if (old) old.remove();

    const sec = document.createElement('section');
    sec.id = 'secaoContrastes';
    sec.className = 'config-secao';
    sec.innerHTML = `
<h3>${esc(T('ac.contrast'))}</h3>
<p class="nota">${esc(T('ac.contrast.note'))}</p>
<label class="check-linha">
  <input type="checkbox" id="chkAltoContraste"${altoContraste ? ' checked' : ''}>
  <span>${esc(T('ac.contrast'))}</span>
</label>

<h3 style="margin-top:18px">${esc(T('ac.zoom'))}</h3>
<p class="nota">${esc(T('ac.zoom.note'))}</p>
<div class="opcoes-zoom" role="radiogroup" id="opcoesZoom">
  ${['100', '125', '150'].map((v) => `
  <label class="opcao-cor">
    <input type="radio" name="zoomTexto" value="${v}"${zoomTexto === v ? ' checked' : ''}>
    <span>${esc(T('ac.zoom.' + v))}</span>
  </label>`).join('')}
</div>`;

    aba.appendChild(sec);

    document.getElementById('chkAltoContraste').addEventListener('change', (e) => {
      altoContraste = e.target.checked;
      gravarLocal(CHAVE_CONTRASTE, altoContraste);
      aplicarContraste();
    });

    document.getElementById('opcoesZoom').addEventListener('change', (e) => {
      if (e.target.name === 'zoomTexto') {
        zoomTexto = e.target.value;
        gravarLocal(CHAVE_ZOOM, zoomTexto);
        aplicarZoom();
      }
    });
  }

  // hook no mostrarAba para render quando a aba for aberta
  (function () {
    const orig = mostrarAba;
    mostrarAba = function (aba) {
      orig(aba);
      if (aba === 'acess') renderOpcoesTeclas();
    };
  })();
})();

/* ==================== Foco correto ao abrir/fechar modal (reforço) ==================== */
// modais.js já devolve o foco, mas garante que modais sem [data-fechar] como primeiro
// elemento também recebam foco no primeiro elemento focável
(function () {
  const orig = abrirJanela;
  abrirJanela = function (id) {
    orig(id);
    if (!modalAberto) return;
    // se o botão fechar não recebeu foco, foca o primeiro elemento interativo
    if (document.activeElement === document.body || document.activeElement === focoAntes) {
      const focavel = modalAberto.querySelector(
        'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focavel) focavel.focus();
    }
  };
})();

/* ==================== Tecla Escape fecha modal ==================== */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalAberto) {
    e.stopPropagation();
    fecharJanela();
  }
});

/* ==================== Foco fica dentro do modal (focus trap leve) ==================== */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !modalAberto) return;
  const focaveis = Array.from(modalAberto.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);
  if (focaveis.length === 0) return;
  const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
  if (e.shiftKey && document.activeElement === primeiro) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primeiro.focus();
  }
});

/* ==================== Atalho de teclado: "L" abre o "Ver como lista" ==================== */
document.addEventListener('keydown', (e) => {
  const tag = (e.target || {}).tagName || '';
  if (/INPUT|SELECT|TEXTAREA/.test(tag) || modalAberto) return;
  if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'l' || e.key === 'L') && st.res) {
    e.preventDefault();
    const btn = document.getElementById('btnListaPlano');
    if (btn) btn.click();
  }
});
