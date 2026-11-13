/* NEXORA — Etiquetas dos volumes com QR Code.
 * O QR traz um texto simples (sem link): qualquer leitor de QR do celular mostra os dados do volume
 * para o motorista conferir na entrega. 8 etiquetas por folha A4 (2 × 4).
 */
const ETQ = (function () {
  'use strict';
  const q = s => document.querySelector(s);
  function qrSvg(text) {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  }
  function labels() {
    if (!plan) { toast('Calcule o carregamento antes.', true); return null; }
    const total = plan.vehs.reduce((a, V) => a + V.items.length, 0), dt = new Date().toLocaleDateString('pt-BR');
    const route = mode === 'route', R = S.route;
    const lab = c => c ? (c.city !== undefined ? c.city : c.nome) + ' - ' + c.uf : '';
    const out = [];
    plan.vehs.forEach((V, vi) => [...V.items].sort((a, b) => a.n - b.n).forEach(it => {
      const k = route && RT.rank(it.p.stop), st = k ? R.stops[k - 1] : null;
      const perig = (it.p.onu ? `ONU ${it.p.onu}${it.p.classe ? ' · Classe ' + it.p.classe : ''}` : '');
      const lines = [`NEXORA · VOLUME ${String(it.n).padStart(2, '0')}/${total}`, `PRODUTO: ${it.nome}`, `CODIGO: ${it.cod}`, `PESO: ${fmt(it.kg, 1)} kg · ${it.pcs} peca(s)`, `MEDIDAS: ${fmt(it.l, 2)} x ${fmt(it.w, 2)} x ${fmt(it.h, 2)} m`,
        st ? `ENTREGA ${k}/${R.stops.length}: ${st.nome || ''} - ${lab(st)}` : '', route && R.orig ? `REMETENTE: ${R.sender || ''} - ${lab(R.orig)}` : '', `VEICULO ${vi + 1}: ${V.v.name}`, perig ? 'PERIGOSO: ' + perig : '', `MONTAGEM: ${dt}`].filter(Boolean);
      out.push(`<div class="etq">
        <div class="etq-h"><b>VOL ${String(it.n).padStart(2, '0')}</b><span>/${total}</span>${k ? `<em>E${k}</em>` : ''}</div>
        <div class="etq-b"><div class="etq-t"><b>${esc(it.nome)}</b><small>${esc(it.cod)} · ${fmt(it.kg, 0)} kg · ${fmt(it.l, 2)}×${fmt(it.w, 2)}×${fmt(it.h, 2)} m</small>
          ${st ? `<p><b>${esc(st.nome || 'Entrega ' + k)}</b><br>${esc(lab(st))}</p>` : ''}${perig ? `<p class="etq-p">⚠ ${esc(perig)}</p>` : ''}<small>Veículo ${vi + 1}: ${esc(V.v.name)}</small></div>
        <div class="etq-q">${qrSvg(lines.join('\n'))}</div></div></div>`);
    }));
    return out;
  }
  function print() {
    const L = labels(); if (!L) return;
    const pages = []; for (let i = 0; i < L.length; i += 8) pages.push(`<div class="etq-page">${L.slice(i, i + 8).join('')}</div>`);
    showPrint(`<style>.etq-page{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:66mm;gap:3mm;break-after:page;font-family:system-ui,sans-serif;color:#000}.etq-page:last-child{break-after:auto}
      .etq{border:1.5px dashed #555;border-radius:3mm;padding:3mm;display:flex;flex-direction:column;overflow:hidden;background:#fff}
      .etq-h{display:flex;align-items:baseline;gap:2mm;border-bottom:1px solid #000;padding-bottom:1mm}.etq-h b{font-size:22pt;line-height:1}.etq-h span{font-size:12pt}.etq-h em{margin-left:auto;font-style:normal;font-weight:800;font-size:18pt;background:#000;color:#fff;padding:0 2mm;border-radius:1mm}
      .etq-b{display:flex;gap:3mm;flex:1;min-height:0;padding-top:2mm}.etq-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1mm;font-size:9pt}.etq-t b{font-size:11pt}.etq-t p{margin:1mm 0;font-size:10pt}.etq-p{color:#b00;font-weight:800}
      .etq-q{width:34mm;flex:none;align-self:center}.etq-q svg{width:34mm;height:34mm;display:block}</style>${pages.join('')}`);
  }
  ['#rLabels', '#bLabels'].forEach(s => { const b = q(s); if (b) b.onclick = print; });
  return { print, qrSvg };
})();
