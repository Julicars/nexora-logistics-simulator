/*
 * Modelos 3D dos veículos (Three.js).
 *
 * Tudo é desenhado nas coordenadas da carga, em metros:
 *   x = comprimento (0 = parede da frente do baú, cresce até a porta)
 *   y = largura (0 = lateral esquerda)
 *   z = altura (0 = piso do baú; o chão fica em z = -deck)
 * A função P(x, y, z), recebida do app, converte para a cena.
 *
 * Tipos de modelo: van, leve (Iveco/baú leve), tresquartos, truck,
 * carreta (cavalo + sider, também rodotrem) e container (cavalo + porta-container).
 */
(function (root) {
  'use strict';

  const PI = Math.PI;
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const ABERTURA_PORTA = PI * 1.42; // ~255°, folha encostada na lateral

  /* ---------- Qual modelo usar para cada veículo ---------- */
  function especificar(v) {
    const L = +v.c, W = +v.l, H = +v.h, n = Math.max(1, +v.vagoes | 0);
    const tipo = Eixos.tipoModelo(v);   // mesma regra usada no cálculo de peso por eixo

    const base = {
      van: { deck: 0.58, rr: 0.34, xFrente: -2.1 },
      leve: { deck: 0.92, rr: 0.37, xFrente: -2.35 },
      tresquartos: { deck: 1.02, rr: 0.46, xFrente: -2.2 },
      truck: { deck: 1.2, rr: 0.52, xFrente: -2.55 },
      carreta: { deck: 1.3, rr: 0.52, xFrente: -3.75 },
      container: { deck: 1.4, rr: 0.52, xFrente: -3.75 },
    }[tipo];
    const gap = Packer.GAP_VAGOES;
    const xTras = n * L + (n - 1) * gap + 0.3;
    return Object.assign({ tipo, L, W, H, n, gap, xTras, comprimento: xTras - base.xFrente }, base);
  }

  /* ---------- Texturas desenhadas em canvas ---------- */
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }
  function textura(cv, repetir) {
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repetir[0], repetir[1]); }
    return t;
  }

  // reserva: metros livres no fim da lateral, onde a porta aberta encosta
  function texturaTexto(L, H, texto, reserva) {
    const w = 2048, h = Math.max(256, Math.round((w * H) / L));
    const [cv, g] = canvas(w, h);
    const fonte = (t) => `700 ${t}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
    const util = w * Math.max(0.55, 1 - (reserva || 0) / L), cx = util / 2;
    let tam = h * 0.34;
    g.font = fonte(tam);
    const larg = g.measureText(texto).width;
    if (larg > util * 0.84) { tam *= (util * 0.84) / larg; g.font = fonte(tam); }
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(texto, cx, h * 0.47);
    const lw = g.measureText(texto).width;
    g.fillStyle = '#4a86ff';
    g.fillRect(cx - lw / 2, h * 0.47 + tam * 0.52, lw, Math.max(4, tam * 0.06));
    return textura(cv);
  }

  // Lona de sider: cor de fundo, cintas verticais com fivelas e bainhas
  function texturaLona(L, H, cor) {
    const w = 2048, h = Math.max(160, Math.round((w * H) / L));
    const [cv, g] = canvas(w, h);
    g.fillStyle = cor;
    g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.08)');
    gr.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const n = Math.max(3, Math.round(L / 0.62)), sw = Math.max(3, (w * 0.05) / L);
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * w) / n;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(x - sw / 2, 0, sw, h);
      g.fillStyle = 'rgba(205,214,228,0.6)';
      g.fillRect(x - sw, h * 0.86, sw * 2, h * 0.05);
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 0, w, h * 0.04);
    g.fillRect(0, h * 0.96, w, h * 0.04);
    return textura(cv);
  }

  // Chapa corrugada de container: nervuras verticais
  function texturaContainer(L, H, cor) {
    const w = 2048, h = 256;
    const [cv, g] = canvas(w, h);
    g.fillStyle = cor;
    g.fillRect(0, 0, w, h);
    const n = Math.max(6, Math.round(L / 0.28)), pw = w / n;
    for (let i = 0; i < n; i++) {
      const x = i * pw;
      const gr = g.createLinearGradient(x, 0, x + pw, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.13)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.02)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0.05)');
      gr.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = gr;
      g.fillRect(x, 0, pw, h);
    }
    return textura(cv);
  }

  // Faixa refletiva vermelha e branca do para-choque
  function texturaListra() {
    const [cv, g] = canvas(256, 32);
    for (let i = -2; i < 10; i++) {
      g.fillStyle = i % 2 ? '#f2f2f2' : '#d42a2a';
      g.beginPath();
      g.moveTo(i * 32, 32); g.lineTo(i * 32 + 32, 32); g.lineTo(i * 32 + 64, 0); g.lineTo(i * 32 + 32, 0);
      g.fill();
    }
    return textura(cv, [5, 1]);
  }

  /* ---------- Geometria auxiliar ---------- */
  // Recorta o arco da roda na borda inferior de um perfil lateral
  function arcoRoda(s, xa, zc, ra, zLinha, esqParaDir) {
    const q = (zLinha - zc) / ra;
    if (q >= 0.98) return;
    const a0 = Math.asin(Math.max(-0.99, q));
    if (esqParaDir) { s.lineTo(xa - ra * Math.cos(a0), zLinha); s.absarc(xa, zc, ra, PI - a0, a0, true); }
    else { s.lineTo(xa + ra * Math.cos(a0), zLinha); s.absarc(xa, zc, ra, a0, PI - a0, false); }
  }

  // Some com a face traseira de um perfil extrudado (abertura das portas da van)
  function apagarFace(geo, xAlvo) {
    const p = geo.attributes.position, nr = geo.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      let ok = true;
      for (let k = 0; k < 3 && ok; k++) if (Math.abs(p.getX(i + k) - xAlvo) > 0.03 || nr.getX(i + k) < 0.9) ok = false;
      if (ok) for (let k = 1; k < 3; k++) p.setXYZ(i + k, p.getX(i), p.getY(i), p.getZ(i));
    }
    p.needsUpdate = true;
  }

  /* ================= Construção ================= */
  function construir(s, P, cfg) {
    const { L, W, H, n, gap, deck, rr, tipo } = s;
    const chao = -deck;
    const G = new THREE.Group();
    const lonas = [], textos = [], portas = [];

    const std = (hex, r, m, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: lin(hex), roughness: r, metalness: m }, extra || {}));
    const M = {
      cabine: std('#eef1f5', 0.38, 0.25),
      pintura: std(cfg.cor, 0.4, 0.4),
      chassi: std('#1b1e23', 0.8, 0.3),
      piso: std('#2c323b', 0.9, 0.1),
      preto: std('#262a30', 0.7, 0.15),
      borracha: std('#16181b', 0.95, 0, { side: THREE.DoubleSide }),
      metal: std('#aab2bc', 0.35, 0.75),
      cromo: std('#dfe4ea', 0.18, 0.95),
      grade: std('#2c3139', 0.55, 0.45),
      quadro: std('#121b2b', 0.6, 0.4),
      vidro: std('#0b1420', 0.06, 0.9, { emissive: lin('#0c1b2e') }),
      farol: std('#f7f3e2', 0.2, 0.1, { emissive: lin('#d8cfa6'), emissiveIntensity: 0.6 }),
      lanterna: std('#d3262f', 0.35, 0.1, { emissive: lin('#8a0d12') }),
      ambar: std('#f29b1d', 0.35, 0.1, { emissive: lin('#8a5205') }),
      faixa: std(cfg.cor, 0.45, 0.35),
      listra: new THREE.MeshStandardMaterial({ map: texturaListra(), roughness: 0.5, metalness: 0.1 }),
    };
    // Carroceria: fica translúcida no modo "ver através"
    const corpo = (map, brilho) => {
      const m = new THREE.MeshStandardMaterial({
        color: map ? 0xffffff : lin(cfg.cor), map: map || null,
        roughness: brilho ? 0.42 : 0.85, metalness: brilho ? 0.35 : 0.05,
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });
      lonas.push(m);
      return m;
    };

    /* ---- primitivas em coordenadas da carga ---- */
    const add = (m) => { G.add(m); return m; };
    const bx = (dx, dy, dz, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(dx, dz, dy), mat);
      m.position.copy(P(x + dx / 2, y + dy / 2, z + dz / 2));
      return add(m);
    };
    const cil = (r, comp, x, y, z, eixo, mat, seg) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, comp, seg || 20), mat);
      if (eixo === 'x') m.rotation.z = PI / 2;
      else if (eixo === 'y') m.rotation.x = PI / 2;
      m.position.copy(P(x, y, z));
      return add(m);
    };
    // Perfil lateral (forma no plano x-z) extrudado na largura, de y0 a y1, com cantos arredondados (bv)
    const perfil = (shape, y0, y1, mat, bv) => {
      const b = bv || 0;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.002, y1 - y0 - 2 * b), bevelEnabled: b > 0,
        bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 14,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(P(0, y0 + b, 0));
      return add(m);
    };
    // Placa plana virada para a normal (nx, ny, nz) da carga
    const placa = (w, h, x, y, z, nx, ny, nz, mat) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const p = P(x, y, z);
      m.position.copy(p);
      m.lookAt(p.x + nx, p.y + nz, p.z + ny);
      return add(m);
    };
    const texCache = {};
    const texto = (x, yFace, z, comp, alt, lado, reserva) => {
      const k = comp.toFixed(2) + 'x' + alt.toFixed(2);
      if (!texCache[k]) texCache[k] = texturaTexto(comp, alt, cfg.texto, reserva);
      const mt = new THREE.MeshBasicMaterial({ map: texCache[k], transparent: true, depthWrite: false });
      textos.push(mt);
      placa(comp, alt, x, yFace, z, 0, lado, 0, mt).renderOrder = 2;
    };
    const faixa = (x0, x1, z, h, y0, y1, bv, mat) => {
      bx(x1 - x0, 0.01, h, x0, y0 - bv - 0.012, z, mat || M.faixa);
      bx(x1 - x0, 0.01, h, x0, y1 + bv + 0.002, z, mat || M.faixa);
    };

    /* ---- rodas ---- */
    const geoPneu = {};
    function pneu(r, w) {
      const k = r + '|' + w;
      if (!geoPneu[k]) {
        const ri = r * 0.6, h = w / 2, s2 = Math.min(0.07, w * 0.24);
        const pts = [[ri, -h], [r - s2, -h], [r - s2 * 0.3, -h + s2 * 0.3], [r, -h + s2], [r, h - s2], [r - s2 * 0.3, h - s2 * 0.3], [r - s2, h], [ri, h]];
        geoPneu[k] = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 36);
      }
      return geoPneu[k];
    }
    function roda(x, yc, w) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(pneu(rr, w), M.borracha));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.6, rr * 0.6, w * 0.84, 28), M.metal));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.22, rr * 0.27, w * 0.96, 16), M.grade));
      g.rotation.x = PI / 2;
      g.position.copy(P(x, yc, chao + rr));
      return add(g);
    }
    function eixo(x, w, dupla, folga) {
      const off = folga == null ? 0.03 : folga;
      [[off + w / 2, 1], [W - off - w / 2, -1]].forEach(([y, sg]) => {
        roda(x, y, w);
        if (dupla) roda(x, y + sg * (w + 0.03), w);
      });
      cil(0.065, Math.max(0.2, W - 2 * off - 2 * w), x, W / 2, chao + rr, 'y', M.chassi, 12);
    }
    function paralama(x0, x1, w, dupla) {
      const vao = dupla ? 2 * w + 0.07 : w + 0.06;
      [0, W - vao].forEach((y) => {
        bx(x1 - x0, vao, 0.04, x0, y, chao + 2 * rr + 0.05, M.preto);
        bx(0.025, vao, rr * 1.35, x1 - 0.025, y, chao + 0.16, M.borracha); // para-barro
      });
    }

    /* ---- vidros, retrovisores e porta da cabine ---- */
    function vidros(o) {
      const [aX, aZ] = o.a, [bX, bZ] = o.b;
      const dx = bX - aX, dz = bZ - aZ, len = Math.hypot(dx, dz);
      const nx = -dz / len, nz = dx / len, off = o.bv + 0.012;
      const t0 = 0.06 / len, t1 = 1 - 0.05 / len, tm = (t0 + t1) / 2;
      placa(o.y1 - o.y0 - 0.28, len * (t1 - t0), aX + dx * tm + nx * off, (o.y0 + o.y1) / 2, aZ + dz * tm + nz * off, nx, 0, nz, M.vidro);
      const fx = (z) => aX + (dx * (z - aZ)) / dz + 0.13;
      const j = new THREE.Shape();
      j.moveTo(fx(o.zJ0), o.zJ0); j.lineTo(o.xJ, o.zJ0); j.lineTo(o.xJ, o.zJ1); j.lineTo(fx(o.zJ1), o.zJ1); j.lineTo(fx(o.zJ0), o.zJ0);
      perfil(j, o.y0 - o.bv - 0.012, o.y0 - o.bv - 0.002, M.vidro, 0);
      perfil(j, o.y1 + o.bv + 0.002, o.y1 + o.bv + 0.012, M.vidro, 0);
      [o.y0 - o.bv - 0.014, o.y1 + o.bv + 0.002].forEach((y) => {
        bx(0.014, 0.012, o.zJ1 - o.zPorta0, o.xPorta, y, o.zPorta0, M.preto);     // vinco da porta
        bx(0.16, 0.012, 0.04, o.xPorta - 0.28, y, o.zJ0 - 0.13, M.cromo);         // maçaneta
      });
      if (o.espelho) {
        const [ex, ez, h] = o.espelho;
        bx(0.05, 0.27, 0.04, ex, o.y0 - o.bv - 0.27, ez + h * 0.62, M.preto);
        bx(0.1, 0.08, h, ex - 0.03, o.y0 - o.bv - 0.34, ez, M.preto);
        bx(0.05, 0.27, 0.04, ex, o.y1 + o.bv, ez + h * 0.62, M.preto);
        bx(0.1, 0.08, h, ex - 0.03, o.y1 + o.bv + 0.26, ez, M.preto);
      }
    }

    /* ---- cabine avançada (caminhões e cavalo mecânico) ---- */
    function cabineFrontal(o) {
      const { xF, prof, zB, alt, y0, larg, eixoF } = o, y1 = y0 + larg, bv = 0.06;
      const xB = xF + prof, zT = zB + alt, zW = zB + alt * 0.47, rk = alt * 0.075, rc = 0.17;
      const s = new THREE.Shape();
      s.moveTo(xF, zB);
      s.lineTo(xF, zW);
      s.lineTo(xF + rk, zT - rc);
      s.quadraticCurveTo(xF + rk + 0.03, zT, xF + rk + rc, zT);
      s.lineTo(xB - 0.12, zT);
      s.quadraticCurveTo(xB, zT, xB, zT - 0.12);
      s.lineTo(xB, zB);
      arcoRoda(s, eixoF, chao + rr, rr + 0.08, zB, false);
      s.lineTo(xF, zB);
      perfil(s, y0, y1, M.cabine, bv);

      vidros({ a: [xF, zW], b: [xF + rk, zT - rc], y0, y1, bv, xJ: xF + prof * 0.5, zJ0: zW + 0.1, zJ1: zT - 0.24,
        xPorta: xF + prof * 0.57, zPorta0: zB + 0.22, espelho: [xF + 0.2, zW - 0.05, 0.46] });
      faixa(xF + 0.04, xB - 0.04, zB + 0.3, 0.13, y0, y1, bv);

      // grade, faróis, para-choque e para-sol
      const zG = zB + alt * 0.2, hG = zW - 0.1 - zG;
      bx(0.05, larg - 0.76, hG, xF - bv - 0.035, y0 + 0.38, zG, M.grade);
      for (let i = 0; i < 4; i++) bx(0.02, larg - 0.86, 0.035, xF - bv - 0.05, y0 + 0.43, zG + (hG * (i + 0.6)) / 4.3, M.metal);
      [y0 + 0.1, y1 - 0.54].forEach((y) => {
        bx(0.04, 0.44, 0.22, xF - bv - 0.02, y, zB + 0.1, M.preto);
        bx(0.03, 0.38, 0.15, xF - bv - 0.04, y + 0.03, zB + 0.135, M.farol);
      });
      bx(0.3, larg + 0.02, 0.36, xF - bv - 0.1, y0 - 0.01, zB - 0.33, M.grade);
      bx(0.32, larg - 0.08, 0.05, xF + rk - bv - 0.22, y0 + 0.04, zT - 0.12, M.preto);
      // degraus
      [y0 - 0.02, y1 - 0.28].forEach((y) => [0.24, 0.52].forEach((d) => bx(0.42, 0.3, 0.05, eixoF + rr + 0.06, y, zB - d, M.preto)));

      if (o.defletor > 0.2) {
        const hd = o.defletor, d = new THREE.Shape();
        d.moveTo(xF + rk + 0.32, zT - 0.03);
        d.lineTo(xB - 0.05, zT - 0.03);
        d.lineTo(xB - 0.05, zT + hd);
        d.lineTo(xB - 0.55, zT + hd);
        d.quadraticCurveTo(xF + prof * 0.4, zT + hd * 0.8, xF + rk + 0.32, zT + 0.02);
        d.lineTo(xF + rk + 0.32, zT - 0.03);
        perfil(d, y0 + 0.14, y1 - 0.14, M.cabine, 0.05);
      }
      if (o.extensores) [y0 + 0.03, y1 - 0.06].forEach((y) => bx(0.55, 0.03, alt - 0.35, xB + 0.03, y, zB + 0.3, M.cabine));
    }

    /* ---- baú / sider / container com portas traseiras ---- */
    function portasTraseiras(xh, yL, yR, z0, alt, mat, nBarras, janela) {
      const t = 0.045, wl = (yR - yL) / 2 - 0.004;
      [[yL, 1], [yR, -1]].forEach(([yh, sg]) => {
        const piv = new THREE.Group();
        piv.position.copy(P(xh, yh, z0));
        const folha = new THREE.Mesh(new THREE.BoxGeometry(t, alt, wl), mat);
        folha.position.set(t / 2, alt / 2, (sg * wl) / 2);
        piv.add(folha);
        const peca = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); piv.add(o); };
        for (let i = 0; i < nBarras; i++) {
          const zz = sg * wl * (0.28 + 0.44 * i);
          peca(new THREE.CylinderGeometry(0.02, 0.02, alt * 0.97, 10), M.cromo, t + 0.03, alt / 2, zz);
          peca(new THREE.BoxGeometry(0.04, 0.05, 0.18), M.cromo, t + 0.055, alt * 0.45, zz + sg * 0.1);
          [0.06, alt - 0.06].forEach((y) => peca(new THREE.BoxGeometry(0.05, 0.06, 0.08), M.chassi, t + 0.025, y, zz));
        }
        [0.12, 0.5, 0.88].forEach((f) => peca(new THREE.BoxGeometry(0.035, 0.09, 0.16), M.chassi, t + 0.012, alt * f, sg * 0.08));
        if (janela) peca(new THREE.BoxGeometry(0.01, alt * 0.28, wl * 0.72), M.vidro, t + 0.006, alt * 0.76, sg * wl * 0.5);
        G.add(piv);
        portas.push({ pivo: piv, sinal: sg });
      });
    }

    function gradePiso(ox, Lc) {
      const pts = [];
      for (let x = 0; x <= Lc + 1e-6; x += 0.5) pts.push(P(ox + x, 0, 0.004), P(ox + x, W, 0.004));
      for (let y = 0; y <= W + 1e-6; y += 0.5) pts.push(P(ox, y, 0.004), P(ox + Lc, y, 0.004));
      add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a4452, transparent: true, opacity: 0.7 })));
    }

    // tc: 'lona' (sider com cintas), 'caixa' (baú liso) ou 'container'
    function corpoCarga(ox, tc) {
      const cont = tc === 'container', liso = tc === 'caixa';
      const e = cont ? 0.06 : 0.015, t = cont ? 0.1 : 0.06;
      bx(L, W, 0.08, ox, 0, -0.08, M.piso);
      gradePiso(ox, L);

      const mapa = cont ? texturaContainer(L, H, cfg.cor) : tc === 'lona' ? texturaLona(L, H, cfg.cor) : null;
      const mLado = corpo(mapa, liso), mResto = corpo(null, liso);
      placa(L, H, ox + L / 2, -e, H / 2, 0, -1, 0, mLado);
      placa(L, H, ox + L / 2, W + e, H / 2, 0, 1, 0, mLado);
      const teto = add(new THREE.Mesh(new THREE.PlaneGeometry(L, W + 2 * e), mResto));
      teto.rotation.x = -PI / 2;
      teto.position.copy(P(ox + L / 2, W / 2, H + e));
      const frente = add(new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * e, H), cont ? corpo(texturaContainer(W, H, cfg.cor), false) : mResto));
      frente.rotation.y = PI / 2;
      frente.position.copy(P(ox - e, W / 2, H / 2));

      // estrutura: longarinas, travessas e colunas dos cantos
      const q = cont ? M.quadro : M.metal, zb = -0.14, zt = H + (cont ? 0.1 : 0.08), hs = cont ? 0.12 : 0.1;
      [-t, W].forEach((y) => { bx(L, t, 0.16, ox, y, zb, q); bx(L, t, hs, ox, y, zt - hs, q); });
      [ox - t, ox + L].forEach((x) => { bx(t, W, 0.16, x, 0, zb, q); bx(t, W, hs, x, 0, zt - hs, q); });
      [ox - t, ox + L].forEach((x) => [-t, W].forEach((y) => bx(t, t, zt - zb, x, y, zb, q)));
      if (cont) {
        [ox - t - 0.02, ox + L - 0.02].forEach((x) => [-t - 0.02, W - 0.02].forEach((y) =>
          [zb - 0.02, zt - 0.12].forEach((z) => bx(t + 0.04, t + 0.04, 0.14, x, y, z, M.chassi))));
      }
      portasTraseiras(ox + L + t, -t, W + t, zb + 0.02, zt - zb - 0.04, corpo(cont ? texturaContainer(W / 2, H, cfg.cor) : null, liso), 2, false);
      const reserva = W / 2 + t + 0.3;
      texto(ox + L / 2, -e - 0.02, H / 2, L, H, -1, reserva);
      texto(ox + L / 2, W + e + 0.02, H / 2, L, H, 1, reserva);
    }

    function traseira(xr, engate) {
      const zb = chao + 0.42;
      bx(0.12, W - 0.24, 0.17, xr - 0.32, 0.12, zb, M.listra);
      [0.42, W - 0.5].forEach((y) => bx(0.08, 0.08, -0.14 - (zb + 0.17), xr - 0.3, y, zb + 0.17, M.chassi));
      bx(0.06, W - 0.12, 0.15, xr - 0.1, 0.06, -0.32, M.preto);
      [[0.12, M.lanterna], [0.38, M.ambar], [W - 0.34, M.lanterna], [W - 0.6, M.ambar]].forEach(([y, m]) => bx(0.03, 0.22, 0.09, xr - 0.045, y, -0.29, m));
      if (engate) bx(0.4, 0.2, 0.16, xr - 0.1, W / 2 - 0.1, chao + 0.66, M.chassi);
    }

    function protecaoLateral(x0, x1) {
      if (x1 - x0 < 0.6) return;
      [0.03, W - 0.08].forEach((y) => {
        [0.42, 0.74].forEach((zz) => bx(x1 - x0, 0.05, 0.08, x0, y, chao + zz, M.metal));
        [x0, x1 - 0.05].forEach((xx) => bx(0.05, 0.05, -0.2 - (chao + 0.42), xx, y, chao + 0.42, M.metal));
      });
    }

    function pesApoio(x) {
      [W / 2 - 0.78, W / 2 + 0.64].forEach((y) => {
        bx(0.13, 0.14, -0.42 - (chao + 0.1), x, y, chao + 0.1, M.chassi);
        bx(0.32, 0.3, 0.06, x - 0.1, y - 0.08, chao, M.chassi);
      });
      bx(0.06, 1.42, 0.06, x + 0.035, W / 2 - 0.7, chao + 0.55, M.chassi);
      bx(0.05, 0.05, 0.3, x + 0.04, W / 2 + 0.78, chao + 0.5, M.metal);
    }

    /* ---- cavalo mecânico ---- */
    function cavalo() {
      const larg = Math.max(W, 2.46), y0 = (W - larg) / 2, y1 = y0 + larg;
      const xF = -3.6, prof = 2.3, zBg = 0.98, alt = 2.2, eixoF = xF + 0.95;
      const topo = deck + H + (tipo === 'container' ? 0.1 : 0.08);
      cabineFrontal({ xF, prof, zB: zBg - deck, alt, y0, larg, eixoF, defletor: topo - (zBg + alt) - 0.08, extensores: true });
      const zc = chao + 0.8;
      [W / 2 - 0.5, W / 2 + 0.34].forEach((y) => bx(5.6, 0.16, 0.26, xF + 0.3, y, zc, M.chassi));
      bx(1.1, 1.1, 0.12, 0.05, W / 2 - 0.55, zc + 0.26, M.grade);                    // quinta roda (pino-rei em x = 0,6)
      cil(0.29, 0.95, xF + prof + 0.62, y1 - 0.34, chao + 0.74, 'x', M.metal, 28);     // tanque
      [-0.3, 0.3].forEach((d) => cil(0.3, 0.04, xF + prof + 0.62 + d, y1 - 0.34, chao + 0.74, 'x', M.chassi, 28));
      bx(0.7, 0.42, 0.48, xF + prof + 0.25, y0 + 0.06, chao + 0.48, M.preto);           // baterias
      cil(0.065, 2.2, xF + prof + 0.14, y1 - 0.2, chao + 2.25, 'z', M.cromo, 14);       // escapamento
      eixo(eixoF, 0.3, false);
      [0.5, 1.82].forEach((x) => eixo(x, 0.28, true));
      paralama(0.5 - rr - 0.06, 1.82 + rr + 0.06, 0.28, true);
    }

    /* ---- semirreboque (sider ou porta-container) ---- */
    function semi(ox, i, tc) {
      corpoCarga(ox, tc);
      const zv = tc === 'container' ? -0.5 : -0.44;
      [W / 2 - 0.56, W / 2 + 0.42].forEach((y) => bx(L - 0.1, 0.14, 0.3, ox + 0.05, y, zv, M.chassi));
      if (tc === 'container') for (let x = ox + 0.4; x < ox + L - 0.3; x += 1.6) bx(0.1, W - 0.3, 0.08, x, 0.15, zv + 0.2, M.chassi);
      const w = 0.28, xs = [];
      for (let k = 0; k < (n > 1 ? 2 : L > 11 ? 3 : 2); k++) xs.push(ox + L - 1.3 - k * 1.32); // igual a Eixos.geometria
      xs.forEach((x) => eixo(x, w, true));
      const xMin = Math.min(...xs), xMax = Math.max(...xs);
      paralama(xMin - rr - 0.08, xMax + rr + 0.08, w, true);
      let ini = ox + 2.6;
      if (i === 0) pesApoio(ox + 2.3);
      else { // dolly do rodotrem
        const xd = [ox + 0.75, ox + 2.05];
        xd.forEach((x) => eixo(x, w, true));
        paralama(xd[0] - rr - 0.08, xd[1] + rr + 0.08, w, true);
        bx(1.5, 1.3, 0.12, ox + 0.65, W / 2 - 0.65, zv - 0.12, M.chassi);
        bx(gap + 0.9, 0.12, 0.12, ox - gap - 0.15, W / 2 - 0.06, chao + 0.72, M.chassi);
        ini = xd[1] + rr + 0.3;
      }
      protecaoLateral(ini, xMin - rr - 0.25);
      traseira(ox + L, i < n - 1);
    }

    /* ---- truck e 3/4 ---- */
    function rigido(peq) {
      const larg = peq ? Math.min(W, 2.24) : Math.min(W + 0.04, 2.48), y0 = (W - larg) / 2;
      const zBg = peq ? 0.86 : 1.0, alt = peq ? 1.72 : 1.95;
      const xF = peq ? -2.02 : -2.38, prof = peq ? 1.78 : 2.05, eixoF = xF + (peq ? 0.78 : 0.88);
      cabineFrontal({ xF, prof, zB: zBg - deck, alt, y0, larg, eixoF, defletor: peq ? 0 : deck + H + 0.08 - (zBg + alt) - 0.1 });
      [W / 2 - 0.48, W / 2 + 0.34].forEach((y) => bx(L - xF - 0.6, 0.14, 0.24, xF + 0.3, y, -0.36, M.chassi));
      corpoCarga(0, 'lona');
      const w = peq ? 0.24 : 0.28;
      const xs = peq ? [L * 0.62] : [L * 0.6 - 0.66, L * 0.6 + 0.66];
      eixo(eixoF, w, false);
      xs.forEach((x) => eixo(x, w, true));
      paralama(xs[0] - rr - 0.07, xs[xs.length - 1] + rr + 0.07, w, true);
      cil(0.25, 0.85, xF + prof + 0.55, W - 0.33, chao + 0.66, 'x', M.metal, 28);
      protecaoLateral(xF + prof + 1.05, xs[0] - rr - 0.25);
      traseira(L, false);
    }

    /* ---- caminhão leve com cabine de bico (Iveco) ---- */
    function leve() {
      const larg = Math.min(W + 0.02, 2.06), y0 = (W - larg) / 2, y1 = y0 + larg, bv = 0.05;
      const xF = -2.25, xB = -0.16, zB = 0.42 - deck, zT = 2.45 - deck, zH = 1.1 - deck, eixoF = xF + 0.6;
      const xWb = xF + 0.8, xWt = xF + 1.3;
      const s = new THREE.Shape();
      s.moveTo(xF + 0.08, zB);
      arcoRoda(s, eixoF, chao + rr, rr + 0.07, zB, true);
      s.lineTo(xB, zB);
      s.lineTo(xB, zT - 0.1);
      s.quadraticCurveTo(xB, zT, xB - 0.1, zT);
      s.lineTo(xWt + 0.16, zT);
      s.quadraticCurveTo(xWt + 0.02, zT, xWt, zT - 0.1);
      s.lineTo(xWb, zH + 0.14);
      s.lineTo(xF + 0.12, zH);
      s.quadraticCurveTo(xF, zH - 0.01, xF, zH - 0.12);
      s.lineTo(xF, zB + 0.08);
      s.quadraticCurveTo(xF, zB, xF + 0.08, zB);
      perfil(s, y0, y1, M.cabine, bv);
      vidros({ a: [xWb, zH + 0.14], b: [xWt, zT - 0.1], y0, y1, bv, xJ: xB - 0.42, zJ0: zH + 0.3, zJ1: zT - 0.17,
        xPorta: xB - 0.3, zPorta0: zB + 0.12, espelho: [xWb + 0.06, zH + 0.25, 0.32] });
      faixa(xF + 0.05, xB - 0.05, zH - 0.04, 0.1, y0, y1, bv);
      const yc = W / 2;
      bx(0.04, larg - 0.62, 0.3, xF - bv - 0.03, yc - (larg - 0.62) / 2, zH - 0.44, M.grade);
      [y0 + 0.06, y1 - 0.4].forEach((y) => bx(0.05, 0.34, 0.14, xF - bv - 0.02, y, zH - 0.26, M.farol));
      bx(0.2, larg + 0.04, 0.26, xF - bv - 0.1, y0 - 0.02, zB - 0.02, M.preto);
      [W / 2 - 0.44, W / 2 + 0.32].forEach((y) => bx(L - xF - 0.4, 0.12, 0.2, xF + 0.3, y, -0.3, M.chassi));
      corpoCarga(0, 'caixa');
      eixo(eixoF, 0.21, false);
      const xt = L * 0.64;
      eixo(xt, 0.2, true);
      paralama(xt - rr - 0.06, xt + rr + 0.06, 0.2, true);
      traseira(L, false);
    }

    /* ---- van (furgão monobloco) ---- */
    function van() {
      const bv = 0.05, y0 = -0.06, y1 = W + 0.06;
      const zBot = 0.3 - deck, zT = H + 0.12, xR = L + 0.06, xF = -2.0;
      const eixoF = -1.42, eixoT = L - 0.95, zc = chao + rr, ra = rr + 0.07;
      const zWb = 1.36 - deck, zHf = 1.04 - deck, xWb = -1.38, xWt = -0.86;
      // compartimento de carga (translúcido no modo "ver através")
      const c = new THREE.Shape();
      c.moveTo(0, zBot);
      arcoRoda(c, eixoT, zc, ra, zBot, true);
      c.lineTo(xR, zBot);
      c.lineTo(xR, zT - 0.22);
      c.quadraticCurveTo(xR, zT, xR - 0.22, zT);
      c.lineTo(0, zT);
      c.lineTo(0, zBot);
      const mc = perfil(c, y0, y1, corpo(null, true), bv);
      apagarFace(mc.geometry, xR + bv);
      // cabine com capô e para-brisa inclinado
      const k = new THREE.Shape();
      k.moveTo(xF + 0.1, zBot);
      arcoRoda(k, eixoF, zc, ra, zBot, true);
      k.lineTo(0, zBot);
      k.lineTo(0, zT);
      k.lineTo(xWt + 0.3, zT);
      k.quadraticCurveTo(xWt + 0.08, zT, xWt, zT - 0.15);
      k.lineTo(xWb, zWb);
      k.lineTo(xF + 0.14, zHf);
      k.quadraticCurveTo(xF, zHf - 0.03, xF, zHf - 0.16);
      k.lineTo(xF, zBot + 0.1);
      k.quadraticCurveTo(xF, zBot, xF + 0.1, zBot);
      perfil(k, y0, y1, M.pintura, bv);
      vidros({ a: [xWb, zWb], b: [xWt, zT - 0.15], y0, y1, bv, xJ: -0.32, zJ0: zWb + 0.14, zJ1: zT - 0.27,
        xPorta: -0.2, zPorta0: zBot + 0.12, espelho: [xWb + 0.12, zWb + 0.06, 0.3] });
      faixa(xF + 0.25, xR - 0.12, zBot + 0.5, 0.08, y0, y1, bv, M.preto);
      // frente
      const yc = W / 2;
      bx(0.04, W - 0.66, 0.24, xF - bv - 0.02, yc - (W - 0.66) / 2, zHf - 0.42, M.grade);
      [y0 + 0.1, y1 - 0.46].forEach((y) => bx(0.05, 0.36, 0.13, xF - bv - 0.02, y, zHf - 0.3, M.farol));
      bx(0.16, y1 - y0 + 0.04, 0.22, xF - bv - 0.08, y0 - 0.02, zBot - 0.02, M.preto);
      // traseira
      bx(0.12, y1 - y0 + 0.04, 0.18, xR + bv - 0.06, y0 - 0.02, zBot - 0.02, M.preto);
      [y0 - bv + 0.01, y1 + bv - 0.1].forEach((y) => bx(0.04, 0.09, 0.62, xR + bv - 0.03, y, zBot + 0.42, M.lanterna));
      bx(L, W, 0.06, 0, 0, -0.06, M.piso);
      gradePiso(0, L);
      portasTraseiras(xR + bv, y0 + 0.06, y1 - 0.06, zBot + 0.14, zT - 0.2 - (zBot + 0.14), corpo(null, true), 0, true);
      texto(L / 2, y0 - bv - 0.014, H * 0.52, L, H * 0.8, -1, W / 2 + 0.3);
      texto(L / 2, y1 + bv + 0.014, H * 0.52, L, H * 0.8, 1, W / 2 + 0.3);
      eixo(eixoF, 0.22, false, 0.06);
      eixo(eixoT, 0.22, false, 0.06);
    }

    switch (tipo) {
      case 'van': van(); break;
      case 'leve': leve(); break;
      case 'tresquartos': rigido(true); break;
      case 'truck': rigido(false); break;
      case 'container': cavalo(); for (let i = 0; i < n; i++) semi(i * (L + gap), i, 'container'); break;
      default: cavalo(); for (let i = 0; i < n; i++) semi(i * (L + gap), i, 'lona');
    }
    return { grupo: G, lonas, textos, portas };
  }

  root.Veiculo3D = { especificar, construir, ABERTURA_PORTA };
})(typeof self !== 'undefined' ? self : this);
