/* Interface do simulador: cena Three.js, animação do carregamento e painéis. */
(function () {
  'use strict';

  /* ================= Utilidades ================= */
  const $ = (s) => document.querySelector(s);
  const nf = (v, d = 2) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ni = (v) => Math.round(v).toLocaleString('pt-BR');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // aceita "1,20" ou "1.20"
  const lerDecimal = (s) => parseFloat(String(s).trim().replace(/\s/g, '').replace(',', '.'));
  // aceita "30.000" ou "30000"
  const lerInteiro = (s) => { const d = String(s).replace(/\D/g, ''); return d ? parseInt(d, 10) : NaN; };
  const mostrarDecimal = (v) => (v === undefined || v === null || isNaN(v) ? '' : String(Math.round(v * 1000) / 1000).replace('.', ','));
  const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const saida = (t) => 1 - Math.pow(1 - t, 3);
  const plural = (n, um, varios) => `${ni(n)} ${Math.round(n) === 1 ? um : varios}`;

  const CORES = ['#4c8dff', '#f28c38', '#2dbe8c', '#b085f5', '#e9566b', '#36c2d6', '#e7c547', '#e58ac4', '#8fb339', '#c9773d'];
  const cor = (i) => CORES[i % CORES.length];
  const MODOS = Packer.MODOS;
  const modo = (p) => Packer.normalizarModo(p.orientacao);
  const ehPalete = (p) => p.tipo === 'palete';
  const MOTIVOS = { peso: 'acima da carga máxima', espaco: 'sem espaço', tamanho: 'não cabem nessa posição' };
  const COR_LONA = '#14305e';        // azul-escuro da lona e da carroceria
  const TEXTO_LONA = 'Julio Sistema';
  const FOLGA = 0.012;               // espaço visual entre caixas (m)
  const BASE_PALETE = 0.144;         // altura do estrado (PBR)

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
  const CHAVE_FROTA = 'simulador3d.frota.v1', CHAVE_PAINEIS = 'simulador3d.paineis.v1';
  const lerLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* navegador sem armazenamento */ } };
  const frotaValida = (l) => Array.isArray(l) && l.length > 0 && l.every((v) => v && v.nome && +v.c > 0 && +v.l > 0 && +v.h > 0);
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
  };

  // Melhor arranjo em grade de um produto: "1,10 m no comprimento (14) × 2 lado a lado = 28 por vagão"
  function encaixeDe(p) {
    const e = Packer.encaixe(p, st.veiculo)[0];
    if (!e || !e.total) return { e, texto: 'Não cabe no baú nessa posição', curto: 'não cabe' };
    const deitado = Math.abs(e.dz - p.h) > 1e-6;
    const texto = `${nf(e.dx)} m no comprimento (${e.nx}) × ${e.ny} lado a lado` +
      (e.nz > 1 ? ` × ${e.nz} camadas` : '') + ` = ${ni(e.total)} por vagão` + (deitado ? ', deitado' : '');
    return { e, texto, curto: `${e.nx} × ${e.ny} × ${e.nz} = ${ni(e.total)}` };
  }

  /* ================= Cena ================= */
  const vp = $('#viewport');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  vp.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#10141a');
  const camera = new THREE.PerspectiveCamera(38, 1.6, 0.1, 600);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;

  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x20242c, 0.95));
  const sol = new THREE.DirectionalLight(0xffffff, 0.8);
  sol.position.set(-12, 22, 14);
  scene.add(sol);
  const contra = new THREE.DirectionalLight(0x9fb4ff, 0.3);
  contra.position.set(14, 8, -10);
  scene.add(contra);

  function discoGradiente(raio, paradas, ordem) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 4, 128, 128, 128);
    paradas.forEach(([p, c]) => gr.addColorStop(p, c));
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(raio, raio, 1);
    m.renderOrder = ordem;
    scene.add(m);
    return m;
  }
  // chão iluminado no centro e sombra suave sob o veículo
  discoGradiente(70, [[0, 'rgba(30,37,47,1)'], [0.4, 'rgba(21,26,33,0.9)'], [1, 'rgba(16,20,26,0)']], -3);
  const sombra = discoGradiente(1, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0)']], -2);
  sombra.position.y = 0.002;

  // Lateral do estrado de madeira: tábuas e vãos para o garfo da empilhadeira
  const texturaEstrado = (function () {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#b88a57';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = 'rgba(70,45,20,0.25)';
    for (let i = 0; i < 9; i++) g.fillRect(0, 4 + i * 7, 256, 1);
    g.fillStyle = '#2e2216';
    [[0.13, 0.42], [0.58, 0.87]].forEach(([a, b]) => g.fillRect(a * 256, 20, (b - a) * 256, 32));
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 18, 256, 2);
    g.fillRect(0, 52, 256, 2);
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  })();

  let grupoVeiculo = null, spec = null;
  let matLona = [], matTexto = [], portas = [];
  let malha = null, malhaEstrado = null, arestas = null, detalhes = null;
  let matrizesBase = [], matrizesEstrado = [], inicioDetalhe = [];
  let cx0 = 0, largW = 2.5, DECK = 1.25, portaAtual = 0;

  // coordenadas da carga (X comprimento, Y largura, Z altura) -> Three.js (y para cima)
  const P = (x, y, z) => new THREE.Vector3(x - cx0, DECK + z, y - largW / 2);

  function construirVeiculo(v) {
    if (grupoVeiculo) {
      scene.remove(grupoVeiculo);
      grupoVeiculo.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      });
    }
    spec = Veiculo3D.especificar(v);
    DECK = spec.deck;
    largW = spec.W;
    cx0 = (spec.xFrente + spec.xTras) / 2;
    const r = Veiculo3D.construir(spec, P, { cor: COR_LONA, texto: TEXTO_LONA });
    grupoVeiculo = r.grupo;
    matLona = r.lonas;
    matTexto = r.textos;
    portas = r.portas;
    scene.add(grupoVeiculo);
    sombra.scale.set(spec.comprimento + 5, spec.W * 3.4, 1);
    aplicarAtraves();
    aplicarPorta();
    irPara(st.vista, true);
    if (st.res) construirVolumes(st.res);
  }

  function aplicarAtraves() {
    matLona.forEach((m) => { m.opacity = st.atraves ? 0.16 : 1; m.depthWrite = !st.atraves; m.needsUpdate = true; });
    matTexto.forEach((m) => { m.opacity = st.atraves ? 0.85 : 1; m.needsUpdate = true; });
    const b = $('#btnAtraves');
    b.setAttribute('aria-pressed', String(st.atraves));
    const t = st.atraves ? 'Mostrar lona fechada' : 'Ver através da lona';
    b.title = t; b.setAttribute('aria-label', t);
  }

  /* ---------- Porta traseira ---------- */
  function aplicarPorta() {
    const a = suave(portaAtual) * Veiculo3D.ABERTURA_PORTA;
    portas.forEach((p) => { p.pivo.rotation.y = p.sinal * a; });
  }
  function definirPorta(aberta) {
    st.portaAlvo = aberta ? 1 : 0;
    const b = $('#btnPorta'), t = aberta ? 'Fechar porta' : 'Abrir porta';
    b.setAttribute('aria-pressed', String(aberta));
    b.title = t; b.setAttribute('aria-label', t);
  }

  /* ---------- Volumes: caixas, paletes (carga + estrado) e linhas ---------- */
  const ARESTAS_CUBO = [
    [0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1],
  ];
  const mTmp = new THREE.Matrix4(), mEst = new THREE.Matrix4(), vTmp = new THREE.Vector3(), qId = new THREE.Quaternion(), sTmp = new THREE.Vector3();
  const ZERO = new THREE.Vector3(0, 0, 0);

  // Matrizes da carga (mTmp) e do estrado (mEst) de um volume na posição x, z, com escala e
  function matrizesDe(c, x, z, e) {
    if (c.palete) {
      const hb = Math.min(BASE_PALETE, c.dz * 0.4), ins = 0.015;
      vTmp.copy(P(x + c.dx / 2, c.y + c.dy / 2, z + hb + (c.dz - hb) / 2));
      sTmp.set((c.dx - 2 * ins) * e, (c.dz - hb - FOLGA) * e, (c.dy - 2 * ins) * e);
      mTmp.compose(vTmp, qId, sTmp);
      vTmp.copy(P(x + c.dx / 2, c.y + c.dy / 2, z + hb / 2));
      sTmp.set((c.dx - FOLGA) * e, hb * e, (c.dy - FOLGA) * e);
      mEst.compose(vTmp, qId, sTmp);
    } else {
      vTmp.copy(P(x + c.dx / 2, c.y + c.dy / 2, z + c.dz / 2));
      sTmp.set((c.dx - FOLGA) * e, (c.dz - FOLGA) * e, (c.dy - FOLGA) * e);
      mTmp.compose(vTmp, qId, sTmp);
      mEst.compose(vTmp, qId, ZERO);
    }
  }

  // Linhas de camadas e colunas sobre a carga do palete (aparência de caixas empilhadas e filmadas)
  function linhasPalete(c, out) {
    const hb = Math.min(BASE_PALETE, c.dz * 0.4), ins = 0.015, o = 0.004;
    const x0 = c.gx + ins - o, x1 = c.gx + c.dx - ins + o, y0 = c.y + ins - o, y1 = c.y + c.dy - ins + o;
    const z0 = c.z + hb, z1 = c.z + c.dz;
    const seg = (a, b) => { const p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]); out.push(p.x, p.y, p.z, q.x, q.y, q.z); };
    const nz = Math.max(2, Math.round((z1 - z0) / 0.3));
    for (let k = 1; k < nz; k++) {
      const z = z0 + ((z1 - z0) * k) / nz;
      seg([x0, y0, z], [x1, y0, z]); seg([x0, y1, z], [x1, y1, z]);
      seg([x0, y0, z], [x0, y1, z]); seg([x1, y0, z], [x1, y1, z]);
    }
    const nx = Math.max(2, Math.round((x1 - x0) / 0.4)), ny = Math.max(2, Math.round((y1 - y0) / 0.4));
    for (let k = 1; k < nx; k++) { const x = x0 + ((x1 - x0) * k) / nx; seg([x, y0, z0], [x, y0, z1]); seg([x, y1, z0], [x, y1, z1]); }
    for (let k = 1; k < ny; k++) { const y = y0 + ((y1 - y0) * k) / ny; seg([x0, y, z0], [x0, y, z1]); seg([x1, y, z0], [x1, y, z1]); }
  }

  function construirVolumes(res) {
    [malha, malhaEstrado, arestas, detalhes].forEach((m) => {
      if (!m) return;
      scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    const n = res.colocados.length, cap = Math.max(1, n);
    malha = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.04 }), cap);
    malhaEstrado = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: texturaEstrado, roughness: 0.9 }), cap);
    [malha, malhaEstrado].forEach((m) => m.instanceMatrix.setUsage(THREE.DynamicDrawUsage));
    matrizesBase = []; matrizesEstrado = []; inicioDetalhe = [];
    const posArestas = new Float32Array(n * 24 * 3), det = [];
    res.colocados.forEach((c, i) => {
      matrizesDe(c, c.gx, c.z, 1);
      matrizesBase.push(mTmp.clone());
      matrizesEstrado.push(mEst.clone());
      malha.setMatrixAt(i, mTmp);
      malhaEstrado.setMatrixAt(i, mEst);
      const z0 = c.palete ? c.z + Math.min(BASE_PALETE, c.dz * 0.4) : c.z, h = c.z + c.dz - z0;
      ARESTAS_CUBO.forEach((a, k) => {
        const p1 = P(c.gx + a[0] * c.dx, c.y + a[1] * c.dy, z0 + a[2] * h);
        const p2 = P(c.gx + a[3] * c.dx, c.y + a[4] * c.dy, z0 + a[5] * h);
        posArestas.set([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z], (i * 24 + k * 2) * 3);
      });
      inicioDetalhe.push(det.length / 3);
      if (c.palete) linhasPalete(c, det);
    });
    inicioDetalhe.push(det.length / 3);
    colorirVolumes();
    malha.count = malhaEstrado.count = 0;
    scene.add(malha, malhaEstrado);
    const ga = new THREE.BufferGeometry();
    ga.setAttribute('position', new THREE.BufferAttribute(posArestas, 3));
    arestas = new THREE.LineSegments(ga, new THREE.LineBasicMaterial({ color: 0x0a0d12, transparent: true, opacity: 0.45 }));
    ga.setDrawRange(0, 0);
    const gd = new THREE.BufferGeometry();
    gd.setAttribute('position', new THREE.Float32BufferAttribute(det, 3));
    detalhes = new THREE.LineSegments(gd, new THREE.LineBasicMaterial({ color: 0x0a0d12, transparent: true, opacity: 0.3 }));
    gd.setDrawRange(0, 0);
    scene.add(arestas, detalhes);
    voando = [];
    ultimoN = -1;
  }

  function colorirVolumes() {
    if (!malha || !st.res) return;
    const c = new THREE.Color(), cinza = new THREE.Color('#2b323c').convertSRGBToLinear();
    st.res.colocados.forEach((p, i) => {
      c.set(cor(p.pi)).convertSRGBToLinear();
      c.offsetHSL(0, 0, ((((i * 2654435761) % 1000) / 1000) - 0.5) * 0.06); // textura de papelão
      if (st.destaque >= 0 && p.pi !== st.destaque) c.lerp(cinza, 0.82);
      malha.setColorAt(i, c);
    });
    if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
  }

  /* ---------- Encaixe animado: cada volume entra pela porta e desliza até o lugar ---------- */
  const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let voando = [], ultimoN = -1;

  // Quantos volumes ficam em movimento ao mesmo tempo (cada um leva de 0,4 s a 0,9 s)
  function emVoo() {
    if (reduzir) return 1e-6;
    const d = 0.9 - 0.42 * Math.min(1, Math.log10(Math.max(1, st.vel)) / 2);
    return Math.max(1, Math.min(160, st.vel * d));
  }

  function matrizVoo(i, p) {
    const c = st.res.colocados[i], v = st.res.veiculo;
    const porta = c.vagao * (v.c + v.gap) + v.c - c.dx * 0.5; // entra pela porta
    const sobe = c.palete ? 0.12 : Math.min(0.25, Math.max(0, v.h - c.z - c.dz - 0.01));
    const fase = 0.8;
    let x, z;
    if (p < fase) { x = porta + (c.gx - porta) * suave(p / fase); z = c.z + sobe; }
    else { x = c.gx; z = c.z + sobe * (1 - saida((p - fase) / (1 - fase))); }
    matrizesDe(c, x, z, 0.55 + 0.45 * saida(Math.min(1, p / 0.18)));
  }

  function aplicarMostrados() {
    if (!st.res || !malha) return;
    const total = st.res.colocados.length, m = st.mostrados, k = emVoo();
    const visiveis = Math.min(total, Math.max(0, Math.ceil(m - 1e-9)));
    const assentados = Math.min(visiveis, Math.max(st.base, Math.floor(m - k + 1e-9) + 1));
    const novos = [];
    for (let i = assentados; i < visiveis; i++) {
      matrizVoo(i, Math.min(1, Math.max(0, (m - i) / k)));
      malha.setMatrixAt(i, mTmp);
      malhaEstrado.setMatrixAt(i, mEst);
      novos.push(i);
    }
    for (const i of voando) if (i < assentados || i >= visiveis) { malha.setMatrixAt(i, matrizesBase[i]); malhaEstrado.setMatrixAt(i, matrizesEstrado[i]); }
    if (novos.length || voando.length) { malha.instanceMatrix.needsUpdate = true; malhaEstrado.instanceMatrix.needsUpdate = true; }
    voando = novos;
    malha.count = malhaEstrado.count = visiveis;
    arestas.geometry.setDrawRange(0, assentados * 24);
    detalhes.geometry.setDrawRange(0, inicioDetalhe[assentados] || 0);
    if (visiveis !== ultimoN) {
      ultimoN = visiveis;
      $('#rngPasso').value = visiveis;
      $('#lblPasso').textContent = `${ni(visiveis)} de ${plural(total, 'volume', 'volumes')}`;
    }
  }

  function tocar(sim) {
    const total = st.res ? st.res.colocados.length : 0;
    st.tocando = sim && total > 0;
    if (st.tocando && st.mostrados >= total) st.mostrados = st.base = 0;
    if (st.tocando) definirPorta(true);
    $('#btnPlay').setAttribute('aria-label', st.tocando ? 'Pausar' : 'Reproduzir');
    $('#icoPlay').innerHTML = st.tocando
      ? '<path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/>'
      : '<path d="M4 2.5v11l9-5.5z" fill="currentColor"/>';
  }

  /* ---------- Câmera ---------- */
  let anim = null;
  function irPara(vista, imediato) {
    st.vista = vista;
    document.querySelectorAll('.vista').forEach((b) => b.classList.toggle('ativo', b.dataset.vista === vista));
    if (!spec) return;
    const total = Math.max(9, spec.comprimento), h = spec.H;
    const f = Math.max(1, 1.7 / Math.max(0.4, camera.aspect || 1.6));
    const alvo = new THREE.Vector3(0, DECK + h * 0.35, 0);
    let pos;
    switch (vista) {
      case 'sup': pos = new THREE.Vector3(0, total * 1.25 * f + 4, 0.01); alvo.y = DECK; break;
      case 'lat': pos = new THREE.Vector3(0, DECK + h * 0.55, total * 1.2 * f + 3); break;
      case 'tras': pos = new THREE.Vector3(total / 2 + 6 + 3 * f, DECK + h * 0.95, 1.2); alvo.set(total * 0.12, DECK + h * 0.45, 0); break;
      case 'front': pos = new THREE.Vector3(-total / 2 - 6 - 3 * f, DECK + h * 1.05, -1.2); break;
      default: pos = new THREE.Vector3(-total * 0.42 * f, DECK + total * 0.4 * f + 2, total * 0.72 * f + 2);
    }
    if (imediato) { camera.position.copy(pos); controls.target.copy(alvo); controls.update(); anim = null; return; }
    anim = { de: camera.position.clone(), para: pos, alvoDe: controls.target.clone(), alvoPara: alvo, t: 0 };
  }

  function redimensionar() {
    const w = vp.clientWidth, h = vp.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { const a = camera.aspect; redimensionar(); if (Math.abs(a - camera.aspect) > 0.15) irPara(st.vista, true); }).observe(vp);

  let tAnt = performance.now();
  function laco(t) {
    const dt = Math.min(0.1, (t - tAnt) / 1000);
    tAnt = t;
    if (st.tocando && st.res) {
      const total = st.res.colocados.length, fim = total + emVoo();
      st.mostrados = Math.min(fim, st.mostrados + st.vel * dt);
      if (st.mostrados >= fim) { st.mostrados = st.base = total; tocar(false); }
    }
    if (portaAtual !== st.portaAlvo) {
      const passo = reduzir ? 1 : dt / 1.1;
      portaAtual = st.portaAlvo > portaAtual ? Math.min(1, portaAtual + passo) : Math.max(0, portaAtual - passo);
      aplicarPorta();
    }
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / (reduzir ? 0.01 : 0.6));
      const e = saida(anim.t);
      camera.position.lerpVectors(anim.de, anim.para, e);
      controls.target.lerpVectors(anim.alvoDe, anim.alvoPara, e);
      if (anim.t >= 1) anim = null;
    }
    aplicarMostrados();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(laco);
  }

  /* ---------- Dica ao passar o mouse sobre um volume ---------- */
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $('#tooltip');
  let pendenteRay = null;
  vp.addEventListener('pointermove', (ev) => { pendenteRay = ev; });
  vp.addEventListener('pointerleave', () => { pendenteRay = null; tip.hidden = true; });
  const linhaTip = (a, b) => `<div class="t-l"><span>${a}</span><span>${b}</span></div>`;
  setInterval(() => {
    if (!pendenteRay || !malha || !st.res) return;
    const ev = pendenteRay; pendenteRay = null;
    if (ev.buttons) { tip.hidden = true; return; }
    const r = vp.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObject(malha, false)[0];
    if (!hit || hit.instanceId == null) { tip.hidden = true; return; }
    const c = st.res.colocados[hit.instanceId], p = st.pedidos[c.pi];
    const emCima = c.limite === 0 ? 'não empilha'
      : isFinite(c.limite) ? `${ni(c.carga)} de ${ni(c.limite)} kg` : c.carga > 0 ? `${ni(c.carga)} kg` : 'nada';
    tip.innerHTML =
      `<b style="color:${cor(c.pi)}">${esc(p.nome)}</b>` +
      linhaTip('Pedido', esc(p.codigo)) +
      linhaTip(c.palete ? 'Palete' : 'Volume', `nº ${ni(c.seq + 1)}${st.res.veiculo.vagoes > 1 ? ' · vagão ' + (c.vagao + 1) : ''}`) +
      (c.palete ? linhaTip('Peças', `${ni(c.pecas)} × ${nf(c.peso / c.pecas, 2)} kg`) : '') +
      linhaTip('Peso', `${nf(c.peso, c.peso >= 100 ? 0 : 1)} kg`) +
      linhaTip('Peso em cima', emCima) +
      linhaTip('Distância da frente', `${nf(c.x)} m`) +
      linhaTip('Medidas na posição', `${nf(c.dx)} × ${nf(c.dy)} × ${nf(c.dz)} m`);
    tip.hidden = false;
    const pw = vp.parentElement.getBoundingClientRect();
    let x = ev.clientX - pw.left + 14, y = ev.clientY - pw.top + 14;
    if (x + 250 > pw.width) x -= 270;
    if (y + 200 > pw.height) y -= 210;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }, 60);

  /* ================= Simulação ================= */
  function simular(opcoes) {
    const o = Object.assign({ inicio: 0 }, opcoes || {});
    st.res = Packer.empacotar(st.veiculo, st.pedidos, { estrategia: st.estrategia, apoioMin: st.apoioMin });
    construirVolumes(st.res);
    const total = st.res.colocados.length;
    $('#rngPasso').max = total;
    st.mostrados = st.base = Math.floor(total * o.inicio);
    tocar(total > st.base);
    calcularEixos();
    renderPedidos();
  }

  function calcularEixos() {
    st.eixos = Eixos.calcular(st.veiculo, st.res.colocados, st.eixosCfg);
    renderResultados();
  }

  /* ================= Painéis ================= */
  function atualizarResumoVeiculo() {
    const v = st.veiculo, n = Math.max(1, +v.vagoes | 0);
    const dims = `${nf(v.c)} × ${nf(v.l)} × ${nf(v.h)} m`;
    $('#resumoVeiculo').innerHTML =
      `<b>${esc(v.nome || 'Personalizado')}</b><span>${n > 1 ? n + ' vagões de ' : ''}${dims} · ${nf(v.c * v.l * v.h * n, 1)} m³` +
      `${v.cargaKg > 0 ? ' · até ' + ni(v.cargaKg) + ' kg' : ''}</span>`;
    $('#subtitulo').textContent = `${v.nome || 'Personalizado'} · ${n > 1 ? n + ' × ' : ''}${dims}`;
  }

  function totaisDe(lista) {
    return lista.reduce((t, p) => {
      const q = Math.max(0, Math.floor(+p.qtd || 0));
      t.vol += q; t.pecas += q * (ehPalete(p) ? Math.max(1, +p.pecas || 1) : 1); t.kg += q * (+p.peso || 0);
      return t;
    }, { vol: 0, pecas: 0, kg: 0 });
  }

  function renderPedidos() {
    const ul = $('#listaPedidos');
    ul.innerHTML = '';
    $('#nLinhas').textContent = plural(st.pedidos.length, 'linha', 'linhas');
    st.pedidos.forEach((p, i) => {
      const li = document.createElement('li');
      if (st.destaque === i) li.className = 'ativo';
      const enc = encaixeDe(p), lim = Packer.limiteDe(p);
      const cabem = enc.e && enc.e.total ? `cabem ${ni(enc.e.total)} por vagão` : enc.texto.toLowerCase();
      const sub = ehPalete(p)
        ? `${ni(p.pecas)} peças cada · ${cabem}`
        : `${cabem.charAt(0).toUpperCase() + cabem.slice(1)}${lim === 0 ? ' · não empilha' : isFinite(lim) ? ` · aguenta ${ni(lim)} kg` : ''}`;
      li.innerHTML =
        `<button type="button" aria-pressed="${st.destaque === i}" title="${esc(enc.texto)}">` +
        `<span class="ponto" style="background:${cor(i)}"></span>` +
        `<span class="ped-nome">${esc(p.nome)}</span><span class="ped-qtd">${ni(p.qtd)}<small>${ehPalete(p) ? 'pal' : 'cx'}</small></span>` +
        `<span class="ped-enc">${sub}</span></button>`;
      li.querySelector('button').addEventListener('click', () => {
        st.destaque = st.destaque === i ? -1 : i;
        colorirVolumes();
        renderPedidos();
      });
      ul.appendChild(li);
    });
    const t = totaisDe(st.pedidos);
    $('#totalPedidos').textContent = `Total: ${plural(t.vol, 'volume', 'volumes')}${t.pecas !== t.vol ? ` · ${ni(t.pecas)} peças` : ''} · ${ni(t.kg)} kg`;
  }

  function renderResultados() {
    const r = st.res, s = r.stats, ex = st.eixos;
    const card = $('#cardStatus');
    const faltam = r.pendentes > 0;
    const acima = ex.grupos.concat([Object.assign({ nome: 'Peso bruto total' }, ex.pbt)]).filter((g) => g.situacao !== 'ok');
    let classe = 'ok', titulo = '✓ Tudo carregado', corpo = '';
    if (faltam) {
      classe = 'aviso';
      titulo = `! ${r.pendentes === 1 ? '1 volume ficou' : ni(r.pendentes) + ' volumes ficaram'} de fora`;
      corpo += '<ul class="motivos">' + st.pedidos.map((p, i) => {
        const pp = r.porProduto[i];
        if (!pp || !pp.pendentes) return '';
        return Object.entries(pp.motivos).filter(([, q]) => q).map(([m, q]) =>
          `<li><b>${esc(p.nome)}</b>: ${ni(q)} ${MOTIVOS[m]}` +
          (m === 'peso' ? ` (${ni(p.qtd)} × ${nf(p.peso, 1)} kg; o peso é por volume)` : '') +
          (m === 'tamanho' ? ' (tente "Livre" ou "Deitado")' : '') + '</li>').join('');
      }).join('') + '</ul>';
    }
    if (acima.length) {
      const grave = acima.some((g) => g.situacao === 'excesso');
      if (grave) classe = 'perigo';
      else if (classe === 'ok') classe = 'aviso';
      if (!faltam) titulo = grave ? '! Excesso de peso por eixo' : '! Eixo acima do limite legal';
      corpo += '<ul class="motivos">' + acima.map((g) =>
        `<li><b>${esc(g.nome)}</b>: ${ni(g.total)} kg, limite ${ni(g.limite)} kg (+${nf((g.uso - 1) * 100, 1)}%${g.situacao === 'tolerancia' ? ', dentro da tolerância da balança' : ''})</li>`).join('') + '</ul>';
    }
    if (!faltam && !acima.length) corpo = `<p>${plural(s.total, 'volume', 'volumes')}${s.pecas !== s.total ? ` (${ni(s.pecas)} peças)` : ''} no baú, sem sobreposição, sem excesso de peso sobre nenhuma caixa e dentro do limite de todos os eixos.</p>`;
    card.className = 'status ' + classe;
    $('#pontoStatus').className = 'ponto-status ' + classe;
    $('#pontoStatus').title = titulo.replace(/^[!✓]\s*/, '');
    card.innerHTML = `<strong>${titulo}</strong>${corpo}`;

    $('#kAcom').textContent = ni(r.colocados.length);
    $('#kAcomDe').textContent = `de ${plural(s.total, 'volume', 'volumes')}` + (s.pecas !== s.total ? ` · ${ni(s.pecasCarregadas)} de ${ni(s.pecas)} peças` : '');
    $('#kOcup').textContent = nf(s.ocupacao * 100, 1) + '%';
    $('#barOcup').style.width = Math.min(100, s.ocupacao * 100) + '%';
    const cap = r.veiculo.cargaKg;
    $('#kPeso').textContent = `${ni(s.kg)} kg`;
    $('#kPesoDe').textContent = cap ? `${nf((s.kg / cap) * 100, 0)}% de ${ni(cap)} kg` : `peso bruto total ${ni(ex.pbt.total)} kg`;

    // peso por eixo: a marca na barra é o limite legal; depois dela vem a faixa de tolerância
    const linhaEixo = (g, tol, extra) => {
      const escala = 1 + tol, w = Math.min(100, (g.uso / escala) * 100);
      return `<li class="${g.situacao}${extra || ''}"><span>${esc(g.nome)}</span><span class="vl">${ni(g.total)} / ${ni(g.limite)} kg</span>` +
        `<span class="barra"><span style="width:${w}%"></span><i style="left:${100 / escala}%"></i></span></li>`;
    };
    $('#listaEixos').innerHTML = ex.grupos.map((g) => linhaEixo(g, Eixos.TOL_EIXO)).join('') +
      linhaEixo(Object.assign({ nome: 'Peso bruto total' }, ex.pbt), Eixos.TOL_PBT, ' total');

    $('#listaPorProduto').innerHTML = st.pedidos.map((p, i) => {
      const pp = r.porProduto[i] || { colocados: 0, pendentes: 0, pecas: 0, pecasPendentes: 0 };
      const tot = pp.colocados + pp.pendentes || 1;
      const un = ehPalete(p) ? (tot === 1 ? 'palete' : 'paletes') : '';
      return `<li><span class="ponto" style="background:${cor(i)}"></span><span class="nm">${esc(p.nome)}</span>` +
        `<span class="vl${pp.pendentes ? ' pend' : ''}">${ni(pp.colocados)} de ${ni(tot)}${un ? ' ' + un : ''}</span>` +
        `<span class="mini"><span style="width:${(pp.colocados / tot) * 100}%;background:${cor(i)}"></span></span>` +
        (ehPalete(p) ? `<span class="sub">${ni(pp.pecas)} de ${ni(pp.pecas + pp.pecasPendentes)} peças</span>` : '') + `</li>`;
    }).join('');

    const compCarga = r.veiculo.comprimentoTotal;
    const cgPct = compCarga ? (s.cgX / compCarga) * 100 : 0;
    const desvio = (s.cgY - r.veiculo.l / 2) * 100;
    const linhas = [
      ['Volumes carregados', `${ni(r.colocados.length)} de ${ni(s.total)}`],
      ['Peças carregadas', `${ni(s.pecasCarregadas)} de ${ni(s.pecas)}`],
      ['Peso da carga', `${ni(s.kg)} de ${ni(s.kgSolicitado)} kg`],
      ['Tara estimada do veículo', `${ni(ex.pbt.tara)} kg`],
      ['Peso bruto total', `${ni(ex.pbt.total)} kg<small>limite ${ni(ex.pbt.limite)} kg</small>`],
      ['Cubagem pedida', `${nf(s.volSolicitado, 2)} m³`],
      ['Cubagem carregada', `${nf(s.volCarregado, 2)} m³`],
      ['Capacidade do baú', `${nf(s.capacidade, 2)} m³`],
      ['Espaço livre', `${nf(s.volLivre, 2)} m³`],
      ['Piso ocupado', `${nf(s.pisoOcupado * 100, 1)}%`],
      ['Altura máxima', `${nf(s.alturaMax)} m`],
      ['Centro de gravidade da carga', `${nf(s.cgX)} m da frente<small>${nf(cgPct, 0)}% do comprimento, ${nf(Math.abs(desvio), 0)} cm ${desvio >= 0 ? 'à direita' : 'à esquerda'}</small>`],
    ];
    if (r.porVagao.length > 1) r.porVagao.forEach((v, i) => linhas.push([`Vagão ${i + 1}`, `${ni(v.volumes)} volumes · ${nf(v.ocupacao * 100, 1)}%<small>${ni(v.kg)} kg</small>`]));
    linhas.push(['Tempo de cálculo', `${nf(s.ms, 0)} ms<small>${ni(s.extremePoints)} pontos extremos</small>`]);
    $('#linhasRes').innerHTML = linhas.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  }

  /* ================= Janelas (pedidos, configurações, detalhes) ================= */
  let modalAberto = null, focoAntes = null;
  function abrirJanela(id) {
    fecharJanela();
    focoAntes = document.activeElement;
    modalAberto = $('#' + id);
    modalAberto.hidden = false;
    const f = modalAberto.querySelector('[data-fechar]');
    if (f) f.focus();
  }
  function fecharJanela() {
    if (!modalAberto) return;
    modalAberto.hidden = true;
    modalAberto = null;
    if (focoAntes && focoAntes.focus) focoAntes.focus();
  }
  document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharJanela));
  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) fecharJanela(); }));

  /* ---------- Editor de pedidos ---------- */
  let rascunho = [];

  function abrirPedidos() {
    rascunho = clone(st.pedidos);
    renderTabela();
    $('#erroModal').hidden = true;
    abrirJanela('modalPedidos');
  }

  function renderTabela() {
    const tb = $('#corpoTabela');
    tb.innerHTML = '';
    rascunho.forEach((p, i) => {
      const pal = ehPalete(p);
      const tr = document.createElement('tr');
      const num = (k, v, extra) => `<td><input class="num" id="p${i}-${k}" type="text" inputmode="${k === 'qtd' || k === 'pecas' ? 'numeric' : 'decimal'}" value="${esc(v)}"${extra || ''}></td>`;
      tr.innerHTML =
        `<td><input id="p${i}-codigo" type="text" value="${esc(p.codigo)}" style="width:96px"></td>` +
        `<td><input id="p${i}-nome" type="text" value="${esc(p.nome)}" style="min-width:150px"></td>` +
        `<td><select id="p${i}-tipo"><option value="caixa"${pal ? '' : ' selected'}>Caixa</option><option value="palete"${pal ? ' selected' : ''}>Palete</option></select></td>` +
        num('c', mostrarDecimal(p.c)) + num('l', mostrarDecimal(p.l)) + num('h', mostrarDecimal(p.h)) +
        num('qtd', p.qtd) +
        num('pecas', pal ? p.pecas : 1, pal ? '' : ' disabled') +
        num('pesoPeca', mostrarDecimal(p.pesoPeca)) + num('peso', mostrarDecimal(p.peso)) +
        `<td><select id="p${i}-orientacao">${Object.entries(MODOS).map(([k, t]) => `<option value="${k}"${modo(p) === k ? ' selected' : ''}>${t}</option>`).join('')}</select></td>` +
        `<td><input class="lim" id="p${i}-maxEmCima" type="text" inputmode="decimal" placeholder="sem limite" value="${p.maxEmCima == null ? '' : esc(mostrarDecimal(p.maxEmCima))}"></td>` +
        `<td class="enc" id="p${i}-enc"></td>` +
        `<td><button type="button" class="ico" aria-label="Remover linha"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8"/></svg></button></td>`;
      const campo = (k) => tr.querySelector(`#p${i}-${k}`);
      const ler = (k) => {
        const el = campo(k), v = el.value, q = rascunho[i];
        if (k === 'tipo') {
          q.tipo = v;
          if (v === 'palete') {
            q.orientacao = 'auto';
            if (q.maxEmCima == null) q.maxEmCima = 0;
            if (!(+q.pecas > 1)) { q.pecas = PRODUTO_PADRAO.pecas; q.pesoPeca = PRODUTO_PADRAO.pesoPeca; q.peso = q.pecas * q.pesoPeca; }
          }
          else { q.pecas = 1; q.pesoPeca = q.peso; }
          renderTabela();
          return;
        }
        if (k === 'qtd') q.qtd = lerInteiro(v);
        else if (k === 'pecas') {
          q.pecas = Math.max(1, lerInteiro(v) || 1);
          if (q.pesoPeca > 0) { q.peso = q.pecas * q.pesoPeca; campo('peso').value = mostrarDecimal(q.peso); }
        } else if (k === 'pesoPeca') {
          q.pesoPeca = lerDecimal(v);
          q.peso = (ehPalete(q) ? q.pecas : 1) * q.pesoPeca;
          campo('peso').value = isNaN(q.peso) ? '' : mostrarDecimal(q.peso);
        } else if (k === 'peso') {
          q.peso = lerDecimal(v);
          q.pesoPeca = q.peso / (ehPalete(q) ? q.pecas : 1);
          campo('pesoPeca').value = isNaN(q.pesoPeca) ? '' : mostrarDecimal(q.pesoPeca);
        } else if (k === 'maxEmCima') q.maxEmCima = v.trim() === '' ? null : lerDecimal(v);
        else if (k === 'c' || k === 'l' || k === 'h') q[k] = lerDecimal(v);
        else q[k] = v;
        atualizarAvisos();
      };
      tr.querySelectorAll('input,select').forEach((el) => {
        const k = el.id.split('-')[1];
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => ler(k));
      });
      tr.querySelector('button').addEventListener('click', () => { rascunho.splice(i, 1); renderTabela(); });
      tb.appendChild(tr);
    });
    atualizarAvisos();
  }

  // Encaixe de cada linha, total e avisos de quantidade ou peso acima do possível
  function atualizarAvisos() {
    const avisos = [];
    const vag = Math.max(1, +st.veiculo.vagoes | 0), cap = +st.veiculo.cargaKg;
    rascunho.forEach((q, j) => {
      const td = $(`#p${j}-enc`);
      if (!(q.c > 0 && q.l > 0 && q.h > 0)) { if (td) td.textContent = '—'; return; }
      const e = encaixeDe(q);
      if (td) { td.textContent = e.curto; td.title = e.texto; td.classList.toggle('ruim', !e.e.total); }
      if (!e.e.total) avisos.push(`Linha ${j + 1}: não cabe no baú na posição "${MODOS[modo(q)]}". Tente "Livre" ou "Deitado".`);
      else if (q.qtd > e.e.total * vag) avisos.push(`Linha ${j + 1}: nessa posição cabem no máximo ${ni(e.e.total * vag)} volumes (${e.texto}). Foram pedidos ${ni(q.qtd)}.`);
      if (cap > 0 && q.qtd * q.peso > cap) avisos.push(`Linha ${j + 1}: ${ni(q.qtd)} × ${nf(q.peso, 1)} kg = ${ni(q.qtd * q.peso)} kg, acima da carga máxima de ${ni(cap)} kg.`);
    });
    const av = $('#avisoModal');
    av.innerHTML = avisos.map((a) => `<li>${esc(a)}</li>`).join('');
    av.hidden = !avisos.length;
    const t = totaisDe(rascunho);
    $('#totalTabela').innerHTML = `Total: <b>${ni(t.vol)}</b> volumes · <b>${ni(t.pecas)}</b> peças · <b>${ni(t.kg)} kg</b>`;
  }

  function aplicarPedidos() {
    const erro = $('#erroModal');
    const falha = (t) => { erro.textContent = t; erro.hidden = false; };
    if (!rascunho.length) return falha('Inclua pelo menos uma linha de pedido.');
    for (const [i, p] of rascunho.entries()) {
      if (!(p.c > 0 && p.l > 0 && p.h > 0)) return falha(`Linha ${i + 1}: informe comprimento, largura e altura maiores que zero.`);
      if (!(p.qtd >= 0)) return falha(`Linha ${i + 1}: quantidade inválida.`);
      if (p.maxEmCima != null && !(p.maxEmCima >= 0)) return falha(`Linha ${i + 1}: "Aguenta em cima" deve ser um número em kg, 0 ou vazio.`);
    }
    st.pedidos = rascunho.map(normalizar);
    if (st.destaque >= st.pedidos.length) st.destaque = -1;
    fecharJanela();
    simular();
  }

  /* ---------- Configurações ---------- */
  function abrirConfig() {
    const v = st.veiculo;
    $('#vC').value = mostrarDecimal(v.c);
    $('#vL').value = mostrarDecimal(v.l);
    $('#vH').value = mostrarDecimal(v.h);
    $('#vVag').value = Math.max(1, +v.vagoes | 0);
    $('#vKg').value = v.cargaKg > 0 ? ni(v.cargaKg) : '';
    $('#vNome').value = st.idx === 'custom' ? '' : v.nome;
    $('#msgSalvar').textContent = '';
    renderTabelaEixos();
    renderFrota();
    abrirJanela('modalConfig');
  }

  function mostrarAba(aba) {
    document.querySelectorAll('.config-nav [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.aba === aba)));
    document.querySelectorAll('.config-aba').forEach((p) => { p.hidden = p.id !== 'aba-' + aba; });
  }
  document.querySelectorAll('.config-nav [role="tab"]').forEach((t) => t.addEventListener('click', () => mostrarAba(t.dataset.aba)));

  /* ---------- Configuração de veículos (cadastro da frota) ---------- */
  let tmrFrota = null;
  function renderFrota() {
    const tb = $('#corpoFrota');
    $('#nFrota').textContent = plural(frota.length, 'veículo', 'veículos');
    tb.innerHTML = '';
    frota.forEach((v, i) => {
      const tr = document.createElement('tr');
      if (i === st.idx) tr.className = 'atual';
      const num = (k, val, modo) => `<td><input class="num" id="f${i}-${k}" type="text" inputmode="${modo}" value="${esc(val)}"></td>`;
      tr.innerHTML =
        `<td><input class="nome" id="f${i}-nome" type="text" value="${esc(v.nome)}" aria-label="Nome do veículo"></td>` +
        `<td><select id="f${i}-categoria" aria-label="Categoria">${Object.entries(CATEGORIAS).map(([k, t]) => `<option value="${k}"${(v.categoria || 'truck') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></td>` +
        num('c', mostrarDecimal(v.c), 'decimal') + num('l', mostrarDecimal(v.l), 'decimal') + num('h', mostrarDecimal(v.h), 'decimal') +
        num('vagoes', Math.max(1, +v.vagoes | 0), 'numeric') +
        `<td><input class="lim" id="f${i}-cargaKg" type="text" inputmode="numeric" placeholder="sem limite" value="${v.cargaKg > 0 ? ni(v.cargaKg) : ''}"></td>` +
        `<td class="vol" id="f${i}-vol">${nf(v.c * v.l * v.h * Math.max(1, +v.vagoes | 0), 1)} m³</td>` +
        `<td><div class="acoes">` +
        (i === st.idx ? '<span class="mudo">Em uso</span>' : `<button type="button" class="btn peq" data-usar="${i}">Usar</button>`) +
        `<button type="button" class="ico" data-remover="${i}" aria-label="Remover ${esc(v.nome)}"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.8"/></svg></button></div></td>`;
      tr.querySelectorAll('input,select').forEach((el) => {
        const k = el.id.split('-')[1];
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => editarFrota(i, k, el.value));
      });
      tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-usar]').forEach((b) => b.addEventListener('click', () => { selecionarVeiculo(+b.dataset.usar); renderFrota(); }));
    tb.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', () => removerVeiculo(+b.dataset.remover)));
  }

  function editarFrota(i, k, valor) {
    const v = frota[i], erro = $('#erroFrota');
    erro.hidden = true;
    if (k === 'nome') {
      if (!valor.trim()) { erro.textContent = `Linha ${i + 1}: o nome não pode ficar vazio.`; erro.hidden = false; return; }
      v.nome = valor.trim();
    } else if (k === 'categoria') v.categoria = valor;
    else if (k === 'cargaKg') { const n = lerInteiro(valor); if (n > 0) v.cargaKg = n; else delete v.cargaKg; }
    else {
      const n = k === 'vagoes' ? lerInteiro(valor) : lerDecimal(valor);
      if (!(n > 0)) { erro.textContent = `Linha ${i + 1}: informe um número maior que zero.`; erro.hidden = false; return; }
      v[k] = k === 'vagoes' ? Math.min(3, n) : n;
    }
    $(`#f${i}-vol`).textContent = `${nf(v.c * v.l * v.h * Math.max(1, +v.vagoes | 0), 1)} m³`;
    salvarFrota();
    clearTimeout(tmrFrota);
    tmrFrota = setTimeout(() => {
      montarSelect();
      if (i === st.idx) selecionarVeiculo(i); // o veículo em uso foi alterado: redesenha e recalcula
    }, 450);
  }

  function removerVeiculo(i) {
    const erro = $('#erroFrota');
    if (frota.length <= 1) { erro.textContent = 'A lista precisa ter pelo menos um veículo.'; erro.hidden = false; return; }
    frota.splice(i, 1);
    if (st.idx === i) st.idx = 'custom';
    else if (typeof st.idx === 'number' && st.idx > i) st.idx--;
    salvarFrota();
    montarSelect();
    renderFrota();
  }

  $('#btnAddVeiculo').addEventListener('click', () => {
    frota.push({ nome: `Novo veículo ${frota.length + 1}`, categoria: 'truck', c: 8.5, l: 2.4, h: 2.6, vagoes: 1 });
    salvarFrota();
    montarSelect();
    renderFrota();
    const ult = $(`#f${frota.length - 1}-nome`);
    ult.focus();
    ult.select();
  });

  // Restaurar pede confirmação no próprio botão (clique de novo em até 4 s)
  let confirmaRestaurar = null;
  $('#btnFrotaPadrao').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!confirmaRestaurar) {
      b.textContent = 'Clique de novo para apagar seus veículos e restaurar a lista';
      confirmaRestaurar = setTimeout(() => { b.textContent = 'Restaurar lista original'; confirmaRestaurar = null; }, 4000);
      return;
    }
    clearTimeout(confirmaRestaurar);
    confirmaRestaurar = null;
    b.textContent = 'Restaurar lista original';
    frota = clone(VEICULOS);
    salvarFrota();
    selecionarVeiculo(0);
    montarSelect();
    renderFrota();
  });

  // Salva as medidas da aba "Veículo atual" como um veículo da lista
  $('#btnSalvarVeiculo').addEventListener('click', () => {
    const nome = $('#vNome').value.trim() || `Veículo ${frota.length + 1}`;
    const v = st.veiculo;
    const novo = { nome, categoria: v.categoria || 'truck', c: v.c, l: v.l, h: v.h, vagoes: Math.max(1, +v.vagoes | 0) };
    if (v.cargaKg > 0) novo.cargaKg = v.cargaKg;
    const existente = frota.findIndex((f) => f.nome.toLowerCase() === nome.toLowerCase());
    if (existente >= 0) frota[existente] = novo; else frota.push(novo);
    const i = existente >= 0 ? existente : frota.length - 1;
    salvarFrota();
    st.idx = i;
    st.veiculo.nome = nome;
    montarSelect();
    atualizarResumoVeiculo();
    $('#msgSalvar').textContent = existente >= 0 ? `"${nome}" atualizado na lista.` : `"${nome}" adicionado à lista.`;
  });

  function renderTabelaEixos() {
    const geo = Eixos.geometria(st.veiculo), cfg = st.eixosCfg;
    $('#corpoEixos').innerHTML = geo.grupos.map((g) =>
      `<tr><td>${esc(g.nome)}</td>` +
      `<td><input type="text" inputmode="numeric" id="ex-tara-${g.id}" data-eixo="${g.id}" data-campo="tara" value="${ni(cfg.tara[g.id] != null ? cfg.tara[g.id] : g.tara)}"></td>` +
      `<td><input type="text" inputmode="numeric" id="ex-limite-${g.id}" data-eixo="${g.id}" data-campo="limite" value="${ni(cfg.limite[g.id] != null ? cfg.limite[g.id] : g.limite)}"></td></tr>`).join('');
    $('#corpoEixos').querySelectorAll('input').forEach((el) => el.addEventListener('input', () => {
      const val = lerInteiro(el.value), alvo = st.eixosCfg[el.dataset.campo];
      if (val >= 0) alvo[el.dataset.eixo] = val; else delete alvo[el.dataset.eixo];
      if (st.res) calcularEixos();
    }));
  }

  /* ================= Eventos ================= */
  const sel = $('#selVeiculo');
  function montarSelect() {
    sel.innerHTML = '';
    Object.keys(CATEGORIAS).forEach((cat) => {
      const og = document.createElement('optgroup');
      og.label = CATEGORIAS[cat];
      frota.forEach((v, i) => { if ((v.categoria || 'truck') === cat) og.appendChild(new Option(v.nome, i)); });
      if (og.children.length) sel.appendChild(og);
    });
    sel.add(new Option('Personalizado', 'custom'));
    sel.value = String(st.idx);
  }
  function selecionarVeiculo(i) {
    st.idx = i;
    st.veiculo = clone(frota[i]);
    st.eixosCfg = { tara: {}, limite: {} };
    sel.value = String(i);
    atualizarResumoVeiculo();
    construirVeiculo(st.veiculo);
    simular();
  }
  montarSelect();
  sel.addEventListener('change', () => {
    if (sel.value === 'custom') {
      st.idx = 'custom';
      st.veiculo.nome = 'Personalizado';
      atualizarResumoVeiculo();
      abrirConfig();
      return;
    }
    selecionarVeiculo(+sel.value);
  });

  let tmrVeic = null;
  [['#vC', 'c', lerDecimal], ['#vL', 'l', lerDecimal], ['#vH', 'h', lerDecimal], ['#vVag', 'vagoes', lerInteiro], ['#vKg', 'cargaKg', lerInteiro]].forEach(([id, k, ler]) => {
    $(id).addEventListener('input', () => {
      const val = ler($(id).value);
      if (k === 'cargaKg') st.veiculo.cargaKg = val > 0 ? val : undefined;
      else if (!(val > 0)) return;
      else st.veiculo[k] = k === 'vagoes' ? Math.min(3, Math.max(1, val)) : val;
      if (k !== 'cargaKg') { st.veiculo.nome = 'Personalizado'; st.idx = 'custom'; sel.value = 'custom'; }
      atualizarResumoVeiculo();
      clearTimeout(tmrVeic);
      tmrVeic = setTimeout(() => { construirVeiculo(st.veiculo); simular(); if (k === 'vagoes') renderTabelaEixos(); }, 400);
    });
  });
  $('#btnEixosPadrao').addEventListener('click', () => { st.eixosCfg = { tara: {}, limite: {} }; renderTabelaEixos(); if (st.res) calcularEixos(); });
  $('#inApoio').addEventListener('input', (e) => { st.apoioMin = +e.target.value / 100; $('#outApoio').textContent = e.target.value + '%'; });
  $('#inApoio').addEventListener('change', () => simular());

  $('#selEstrategia').addEventListener('change', (e) => { st.estrategia = e.target.value; simular(); });
  $('#btnSimular').addEventListener('click', () => simular());
  $('#btnConfig').addEventListener('click', abrirConfig);
  $('#btnDetalhes').addEventListener('click', () => abrirJanela('modalDetalhes'));
  $('#btnAtraves').addEventListener('click', () => { st.atraves = !st.atraves; aplicarAtraves(); });
  $('#btnPorta').addEventListener('click', () => definirPorta(st.portaAlvo !== 1));
  document.querySelectorAll('.vista').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.vista)));

  $('#btnPlay').addEventListener('click', () => tocar(!st.tocando));
  $('#rngPasso').addEventListener('input', (e) => { tocar(false); st.mostrados = st.base = +e.target.value; });
  // velocidade de encaixe em escala logarítmica: 1 a 400 volumes por segundo
  const velDoControle = (s) => Math.max(1, Math.round(Math.pow(400, s / 100)));
  const atualizarVel = () => { st.vel = velDoControle(+$('#rngVel').value); $('#outVel').textContent = `${ni(st.vel)} vol/s`; };
  $('#rngVel').addEventListener('input', atualizarVel);

  $('#btnEditar').addEventListener('click', abrirPedidos);
  $('#btnAplicar').addEventListener('click', aplicarPedidos);
  $('#btnAddLinha').addEventListener('click', () => {
    rascunho.push(normalizar(Object.assign({ codigo: `PED-${String(rascunho.length + 1).padStart(3, '0')}`, nome: 'Novo produto' }, PRODUTO_PADRAO)));
    renderTabela();
  });
  $('#btnPadrao').addEventListener('click', () => { rascunho = clone(PEDIDOS_DEMO).map(normalizar); renderTabela(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalAberto) fecharJanela();
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); tocar(!st.tocando); }
  });

  /* ---------- Painéis laterais que recolhem ---------- */
  const app = $('.app');
  const paineis = Object.assign({ esq: false, dir: false }, lerLocal(CHAVE_PAINEIS) || {});
  function aplicarPainel(lado) {
    const recolhido = paineis[lado], painel = $(lado === 'esq' ? '#painelEsq' : '#painelDir');
    const btn = painel.querySelector('.recolher'), nome = lado === 'esq' ? 'carga' : 'resultado';
    app.classList.toggle(lado + '-recolhida', recolhido);
    painel.classList.toggle('recolhida', recolhido);
    btn.setAttribute('aria-expanded', String(!recolhido));
    btn.title = recolhido ? 'Abrir painel' : 'Recolher painel';
    btn.setAttribute('aria-label', (recolhido ? 'Abrir painel de ' : 'Recolher painel de ') + nome);
  }
  function alternarPainel(lado) {
    paineis[lado] = !paineis[lado];
    aplicarPainel(lado);
    gravarLocal(CHAVE_PAINEIS, paineis);
  }
  document.querySelectorAll('.recolher').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); alternarPainel(b.dataset.painel); }));
  // com o painel recolhido, clicar em qualquer parte da faixa abre de novo
  document.querySelectorAll('.painel-cab').forEach((cab) => cab.addEventListener('click', () => {
    const lado = cab.closest('.painel').id === 'painelEsq' ? 'esq' : 'dir';
    if (paineis[lado]) alternarPainel(lado);
  }));
  aplicarPainel('esq');
  aplicarPainel('dir');

  /* ================= Início ================= */
  redimensionar();
  atualizarVel();
  aplicarAtraves();
  definirPorta(false);
  atualizarResumoVeiculo();
  construirVeiculo(st.veiculo);
  simular({ inicio: 0.42 });
  requestAnimationFrame(laco);
  // redesenha o nome na lona quando a fonte terminar de carregar
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 120px "Barlow Condensed"').then(() => construirVeiculo(st.veiculo)).catch(() => {});
  }
})();
