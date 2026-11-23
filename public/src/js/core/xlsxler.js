/* NEXORA — leitor de planilha Excel (.xlsx) no navegador, sem bibliotecas.
 * O .xlsx é um zip com XML: lê o índice do zip, descompacta com DecompressionStream('deflate-raw')
 * e devolve as abas como matrizes. NXLER.ler(arrayBuffer) → Promise<[{ nome, linhas: [[célula…]…] }]>
 */
const NXLER = (function () {
  'use strict';
  const td = new TextDecoder('utf-8');
  async function inflar(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('Este navegador não abre .xlsx direto. Atualize o navegador ou salve a planilha como CSV.');
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  /* índice central do zip → { nome: () => Promise<texto> } */
  function unzip(buf) {
    const b = new Uint8Array(buf), dv = new DataView(buf); let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('O arquivo não é uma planilha .xlsx válida.');
    const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = {};
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Planilha corrompida.');
      const met = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const nome = td.decode(b.subarray(p + 46, p + 46 + nl));
      out[nome] = async () => { const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), d = b.subarray(ini, ini + comp); return td.decode(met === 8 ? await inflar(d) : d); };
      p += 46 + nl + el + cl;
    }
    return out;
  }
  const ent = s => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e.toLowerCase()] ?? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))));
  const textos = x => { let s = ''; x.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (m, t) => { s += t; }); return ent(s); };
  const col = r => { let c = 0; for (const ch of r.replace(/\d+/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
  async function ler(buf) {
    const z = unzip(buf), ss = [];
    if (z['xl/sharedStrings.xml']) (await z['xl/sharedStrings.xml']()).replace(/<si>([\s\S]*?)<\/si>/g, (m, si) => { ss.push(textos(si)); });
    const wb = z['xl/workbook.xml'] ? await z['xl/workbook.xml']() : '', rels = z['xl/_rels/workbook.xml.rels'] ? await z['xl/_rels/workbook.xml.rels']() : '';
    const alvo = {}; rels.replace(/<Relationship\b([^>]*)\/?>/g, (m, a) => { const id = /Id="([^"]+)"/.exec(a), t = /Target="([^"]+)"/.exec(a); if (id && t) alvo[id[1]] = t[1].replace(/^\/?(xl\/)?/, 'xl/'); });
    const folhas = []; wb.replace(/<sheet\b([^>]*)\/?>/g, (m, a) => { const n = /name="([^"]*)"/.exec(a), r = /r:id="([^"]+)"/.exec(a); folhas.push({ nome: n ? ent(n[1]) : '', arq: r && alvo[r[1]] }); });
    if (!folhas.length) Object.keys(z).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort().forEach((k, i) => folhas.push({ nome: 'Planilha' + (i + 1), arq: k }));
    const res = [];
    for (const f of folhas) {
      if (!f.arq || !z[f.arq]) continue; const linhas = [];
      (await z[f.arq]()).replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (m, row) => {
        const l = [];
        row.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (mm, at, corpo = '') => {
          const r = /\br="([A-Z]+\d+)"/.exec(at), t = (/\bt="(\w+)"/.exec(at) || [])[1], v = /<v>([\s\S]*?)<\/v>/.exec(corpo);
          const val = t === 's' ? (v ? ss[+v[1]] : null) : t === 'inlineStr' ? textos(corpo) : (t === 'str' || t === 'e') ? (v ? ent(v[1]) : null) : t === 'b' ? (v ? v[1] === '1' : null) : (v ? Number(v[1]) : null);
          l[r ? col(r[1]) : l.length] = val;
        });
        linhas.push(Array.from(l, x => x ?? ''));
      });
      res.push({ nome: f.nome, linhas });
    }
    return res;
  }
  return { ler };
})();
