/* NEXORA — leitor de planilhas .xlsx sem dependências (zip + XML), usado para as planilhas semanais da ANP.
 * lerXlsx(buffer) → [{ nome, linhas: [[célula, ...], ...] }]  (células como texto ou número)
 */
'use strict';
const zlib = require('zlib');

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Arquivo não é um .xlsx válido (zip não encontrado).');
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip corrompido.');
    const metodo = buf.readUInt16LE(p + 10), comp = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + nl);
    out[nome] = () => {
      const ini = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), dados = buf.subarray(ini, ini + comp);
      return (metodo === 8 ? zlib.inflateRawSync(dados) : dados).toString('utf8');
    };
    p += 46 + nl + el + cl;
  }
  return out;
}
const ent = s => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e.toLowerCase()] ?? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))));
const textos = x => { let s = ''; x.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (m, t) => { s += t; }); return ent(s); };
const colIdx = r => { let c = 0; for (const ch of r.replace(/\d+/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };

function lerXlsx(buf) {
  const z = unzip(buf), ss = [];
  if (z['xl/sharedStrings.xml']) z['xl/sharedStrings.xml']().replace(/<si>([\s\S]*?)<\/si>/g, (m, si) => { ss.push(textos(si)); });
  const wb = z['xl/workbook.xml'] ? z['xl/workbook.xml']() : '', rels = z['xl/_rels/workbook.xml.rels'] ? z['xl/_rels/workbook.xml.rels']() : '';
  const alvo = {}; rels.replace(/<Relationship\b([^>]*)\/?>/g, (m, a) => { const id = /Id="([^"]+)"/.exec(a), t = /Target="([^"]+)"/.exec(a); if (id && t) alvo[id[1]] = t[1].replace(/^\/?(xl\/)?/, 'xl/'); });
  const folhas = []; wb.replace(/<sheet\b([^>]*)\/?>/g, (m, a) => { const n = /name="([^"]*)"/.exec(a), r = /r:id="([^"]+)"/.exec(a); folhas.push({ nome: n ? ent(n[1]) : '', arq: r && alvo[r[1]] }); });
  if (!folhas.length) Object.keys(z).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort().forEach((k, i) => folhas.push({ nome: 'Planilha' + (i + 1), arq: k }));
  return folhas.filter(f => f.arq && z[f.arq]).map(f => {
    const linhas = [];
    z[f.arq]().replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (m, row) => {
      const l = [];
      row.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (mm, at, corpo = '') => {
        const r = /\br="([A-Z]+\d+)"/.exec(at), t = (/\bt="(\w+)"/.exec(at) || [])[1], v = /<v>([\s\S]*?)<\/v>/.exec(corpo);
        let val = null;
        if (t === 's') val = v ? ss[+v[1]] : null; else if (t === 'inlineStr') val = textos(corpo); else if (t === 'str' || t === 'e') val = v ? ent(v[1]) : null; else if (t === 'b') val = v ? v[1] === '1' : null; else val = v ? Number(v[1]) : null;
        l[r ? colIdx(r[1]) : l.length] = val;
      });
      linhas.push(l);
    });
    return { nome: f.nome, linhas };
  });
}
module.exports = { lerXlsx, unzip };
