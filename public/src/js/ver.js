/* NEXORA — visualização do plano 3D (ver.html). Só leitura, sem login: o link já traz o acesso.
 * ver.html?p=ID&t=TOKEN  → busca o plano no servidor (/api/planos3d)
 * ver.html#d=…           → plano compactado dentro do próprio link (sem servidor)
 * Eixos do plano: x = comprimento a partir da cabine, y = largura, z = altura (metros).
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 1) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const GAP = 0.9, ESP = { ot: 'Open top', fr: 'Flat rack', prancha: 'Prancha' };
  let D = null, vi = 0, cena, cam, rend, ctl, grupo, malhas = [], ordem = [], sel = null, play = null;

  function erro(m) { document.querySelector('.vr-main').innerHTML = `<p class="vr-erro">⚠️ ${esc(m)}</p>`; }
  async function carregar() {
    const P = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
    if (P.get('p')) { const r = await fetch(`/api/planos3d/${encodeURIComponent(P.get('p'))}?t=${encodeURIComponent(P.get('t') || '')}`); const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.erro || 'Não foi possível abrir o plano.'); return b; }
    if (h.get('d')) {
      const s = atob(h.get('d').replace(/-/g, '+').replace(/_/g, '/')), u8 = Uint8Array.from(s, c => c.charCodeAt(0));
      const st = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return JSON.parse(await new Response(st).text());
    }
    throw new Error('Link incompleto. Peça um novo link a quem enviou.');
  }
  const V = () => D.vs[vi], prod = it => D.ps[it[8]] || ['Volume', '', '#f39a2b', 0, ''];

  function iniciar3d() {
    const cv = $('#vrCv');
    rend = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); rend.setPixelRatio(Math.min(2, devicePixelRatio));
    cena = new THREE.Scene(); cam = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    cena.add(new THREE.HemisphereLight(0xffffff, 0x334466, 0.9)); const sol = new THREE.DirectionalLight(0xffffff, 0.7); sol.position.set(10, 20, 12); cena.add(sol);
    ctl = new THREE.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.495;
    const tam = () => { const r = cv.parentElement.getBoundingClientRect(); rend.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); };
    addEventListener('resize', tam); tam();
    (function loop() { requestAnimationFrame(loop); ctl.update(); rend.render(cena, cam); })();
    /* toque/clique num volume mostra os dados */
    let ini = null; cv.addEventListener('pointerdown', e => { ini = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', e => { if (!ini || Math.hypot(e.clientX - ini[0], e.clientY - ini[1]) > 6) return; const r = cv.getBoundingClientRect(), rc = new THREE.Raycaster();
      rc.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, cam);
      const hit = rc.intersectObjects(malhas.filter(m => m.visible))[0]; mostrar(hit ? hit.object.userData.it : null); });
  }
  function montar() {
    if (grupo) cena.remove(grupo); grupo = new THREE.Group(); cena.add(grupo); malhas = []; sel = null; mostrar(null);
    const v = V(), comp = v.wag * v.L + (v.wag - 1) * GAP;
    for (let g = 0; g < v.wag; g++) {
      const x0 = g * (v.L + GAP);
      const piso = new THREE.Mesh(new THREE.BoxGeometry(v.L, 0.08, v.W), new THREE.MeshStandardMaterial({ color: v.esp === 'prancha' || v.b === 'aberta' ? 0x6b4a2b : 0x8d96a6 })); piso.position.set(x0 + v.L / 2, -0.04, 0); grupo.add(piso);
      const caixa = (H, cor, trac) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(v.L, H, v.W)), trac ? new THREE.LineDashedMaterial({ color: cor, dashSize: 0.25, gapSize: 0.18 }) : new THREE.LineBasicMaterial({ color: cor })); if (trac) e.computeLineDistances(); e.position.set(x0 + v.L / 2, H / 2, 0); grupo.add(e); };
      if (v.esp !== 'prancha') caixa(v.H, 0x9cc3f0, false); if (v.Hm > v.H + 0.01) caixa(v.Hm, 0xffd27a, true);
      /* parede da frente translúcida = lado da cabine */
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(v.W, v.H), new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.18, side: THREE.DoubleSide })); fr.rotation.y = Math.PI / 2; fr.position.set(x0, v.H / 2, 0); grupo.add(fr);
    }
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, Math.min(2.6, v.H), v.W * 0.95), new THREE.MeshStandardMaterial({ color: 0x334155 })); cab.position.set(-1.1, Math.min(2.6, v.H) / 2, 0); grupo.add(cab);
    for (const it of v.it) {
      const [x, y, z, l, w, h, wg] = it, p = prod(it);
      /* bobina: cilindro (em pé quando comprimento = largura; deitada com o eixo no lado diferente) */
      let geo; if (p[5] === 'b') { const ab = (a, b) => Math.abs(a - b) < 1e-3; if (ab(l, w)) geo = new THREE.CylinderGeometry(l / 2, l / 2, h, 28); else if (ab(w, h)) { geo = new THREE.CylinderGeometry(w / 2, w / 2, l, 28); geo.rotateZ(Math.PI / 2); } else { geo = new THREE.CylinderGeometry(l / 2, l / 2, w, 28); geo.rotateX(Math.PI / 2); } }
      else geo = new THREE.BoxGeometry(l * 0.995, h * 0.995, w * 0.995);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: p[2], roughness: 0.6 }));
      m.position.set(wg * (v.L + GAP) + x + l / 2, z + h / 2, y + w / 2 - v.W / 2); m.userData.it = it;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: 0x111827 })); m.add(e);
      grupo.add(m); malhas.push(m);
    }
    /* ordem de carregamento: compartimento, da cabine para o fundo, de baixo para cima, da esquerda para a direita */
    ordem = [...malhas].sort((a, b) => { const A = a.userData.it, B = b.userData.it; return A[6] - B[6] || A[0] - B[0] || A[2] - B[2] || B[1] - A[1]; });
    const sl = $('#vrPasso'); sl.max = ordem.length; sl.value = ordem.length; passo(ordem.length);
    vista('3d', comp, v);
    resumo();
  }
  function vista(k, comp, v) {
    v = v || V(); comp = comp || v.wag * v.L + (v.wag - 1) * GAP; const c = new THREE.Vector3(comp / 2, v.H / 2, 0);
    /* distância para o veículo inteiro caber na tela (celular em pé tem a tela estreita) */
    const fh = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect), d = Math.max(6, (comp + 3) / 2 / Math.tan(fh / 2) * 0.75);
    const P = { '3d': [comp / 2 + d * 0.55, d * 0.6, d * 0.85], lado: [comp / 2, v.H / 2, d * 1.15], topo: [comp / 2 + 0.01, d * 1.2, 0.01], fundo: [comp + Math.max(6, v.W * 3), v.H * 0.9, 0] }[k];
    cam.position.set(P[0], P[1], P[2]); ctl.target.copy(c); ctl.update();
    document.querySelectorAll('[data-vis]').forEach(b => { b.classList.toggle('on', b.dataset.vis === k); b.setAttribute('aria-pressed', b.dataset.vis === k); });
  }
  function passo(n) { ordem.forEach((m, i) => { m.visible = i < n; }); $('#vrPassoN').textContent = n >= ordem.length ? `todos os ${ordem.length} volumes` : `${n} de ${ordem.length}`; if (n > 0 && n < ordem.length) mostrar(ordem[n - 1].userData.it, true); }
  function mostrar(it, passoAPasso) {
    if (sel) sel.material.emissive.setHex(0); sel = null; const el = $('#vrInfo');
    if (!it) { el.hidden = true; return; }
    sel = malhas.find(m => m.userData.it === it); if (sel) sel.material.emissive.setHex(0x553300);
    const p = prod(it), v = V(), [x, y, z, l, w, h, wg, n] = it;
    el.hidden = false;
    el.innerHTML = `<b>Volume ${n}</b>${passoAPasso ? ` · ${ordem.indexOf(sel) + 1}º a carregar` : ''} — ${esc(p[0])}${p[1] ? ` <small>(${esc(p[1])})</small>` : ''}<br>${fmt(l, 2)} × ${fmt(w, 2)} × ${fmt(h, 2)} m${p[3] ? ` · ${fmt(p[3], 0)} kg` : ''}${p[4] ? `<br>📍 ${esc(p[4])}` : ''}<br><small>${v.wag > 1 ? `Compartimento ${wg + 1} · ` : ''}${fmt(x, 2)} m da frente · ${z > 0.01 ? fmt(z, 2) + ' m do piso' : 'no piso'}</small>`;
  }
  function resumo() {
    const v = V(), kg = v.it.reduce((s, i) => s + (prod(i)[3] || 0), 0), cub = v.it.reduce((s, i) => s + i[3] * i[4] * i[5], 0), vol = v.L * v.W * v.H * v.wag;
    $('#vrRes').innerHTML = `<div><b>${v.it.length}</b><span>volumes</span></div><div><b>${fmt(kg / 1000, 2)} t</b><span>peso da carga</span></div><div><b>${fmt(cub, 1)} m³</b><span>ocupação ${fmt(cub / vol * 100, 0)}%</span></div><div><b>${esc(ESP[v.esp] || v.cat)}</b><span>${fmt(v.L, 2)} × ${fmt(v.W, 2)} × ${fmt(v.H, 2)} m</span></div>`;
    const by = new Map(); for (const i of v.it) { const k = i[8], e = by.get(k) || { p: prod(i), n: 0 }; e.n++; by.set(k, e); }
    $('#vrLeg').innerHTML = [...by.values()].map(e => `<li><i style="background:${esc(e.p[2])}"></i><span>${esc(e.p[0])}${e.p[4] ? `<br><small style="margin:0">📍 ${esc(e.p[4])}</small>` : ''}</span><small>${e.n} vol.</small></li>`).join('');
  }
  async function main() {
    try { D = await carregar(); } catch (e) { return erro(e.message || 'Não foi possível abrir o plano.'); }
    if (typeof THREE === 'undefined') return erro('Não foi possível carregar o 3D (sem internet?).');
    $('#vrTit').textContent = D.nome || 'Plano de carga'; $('#vrSub').textContent = 'Só visualização · ' + new Date(D.data).toLocaleDateString('pt-BR');
    const nav = $('#vrVeh'); nav.innerHTML = D.vs.map((v, i) => `<button data-v="${i}" aria-pressed="${i === 0}" class="${i === 0 ? 'on' : ''}">${i + 1}. ${esc(v.nm)}</button>`).join(''); nav.hidden = D.vs.length < 2;
    nav.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; vi = +b.dataset.v; nav.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); montar(); };
    iniciar3d(); montar();
    document.querySelector('.vr-vis').onclick = e => { const b = e.target.closest('[data-vis]'); if (b) vista(b.dataset.vis); };
    $('#vrPasso').oninput = e => { pararPlay(); passo(+e.target.value); };
    $('#vrPlay').onclick = () => { if (play) return pararPlay(); const sl = $('#vrPasso'); if (+sl.value >= ordem.length) sl.value = 0; $('#vrPlay').textContent = '⏸';
      play = setInterval(() => { const n = +sl.value + 1; sl.value = n; passo(n); if (n >= ordem.length) pararPlay(); }, Math.max(120, 6000 / Math.max(1, ordem.length))); };
  }
  function pararPlay() { clearInterval(play); play = null; $('#vrPlay').textContent = '▶'; }
  main();
})();
