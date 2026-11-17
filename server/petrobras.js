/* NEXORA — alimentação automática do preço Petrobras (diesel A às distribuidoras).
 * Fonte 1 (principal, no dia): comunicados da Agência Petrobras — lê a lista de notícias de Negócios,
 *   abre as notas sobre diesel e extrai "passará (de R$ X) para/a ser R$ Y por litro" + data de vigência.
 * Fonte 2 (conferência, semanal): Síntese Semanal de Preços da ANP (PDF) — preço de realização do diesel A
 *   (média de produtores/importadores) e PPI (paridade de importação) → defasagem.
 * Validação: faixa de valor, variação máxima, data plausível e coerência com a ANP. Na dúvida → "pendente"
 *   (o usuário confirma com 1 clique). Nunca grava número duvidoso em silêncio.
 */
'use strict';
const zlib = require('zlib');

const n2 = s => Number(String(s).replace(/\./g, '').replace(',', '.'));
const ymd = d => d.toISOString().slice(0, 10);
const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ---------- HTML → texto ---------- */
function textoHtml(h) {
  return String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (m, c) => String.fromCharCode(+c)).replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}
/* links de notícias de negócio na lista da Agência */
function linksAgencia(html, base) {
  const vistos = new Set(), out = [];
  String(html).replace(/href="([^"]*\/w\/negocio\/[^"#?]+)"/gi, (m, h) => {
    const u = new URL(h.replace(/&amp;/g, '&'), base).href; if (vistos.has(u)) return; vistos.add(u);
    const slug = semAcento(decodeURIComponent(u.split('/w/negocio/')[1] || '')).toLowerCase();
    if (/diesel|preco|precos|combusti|distribuidora/.test(slug) && !/querosene|qav|glp|gas-natural|gasolina(?!.*diesel)/.test(slug)) out.push(u);
  });
  return out;
}
/* data de publicação: "Publicado em 31/05/2026", "2026.05.31", "31 de maio de 2026" */
function dataPublicacao(t) {
  let m = /(\d{4})\.(\d{2})\.(\d{2})/.exec(t); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(t); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /(\d{1,2}) de ([a-zç]+) de (\d{4})/i.exec(semAcento(t)); if (m && MESES[m[2].toLowerCase()]) return `${m[3]}-${String(MESES[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
/* extrai o reajuste do diesel A de um comunicado */
function extrairComunicado(texto, pub) {
  const t = semAcento(texto).replace(/\s+/g, ' ');
  const i = t.search(/diesel( a)?\b/i); if (i < 0) return null;
  const ini = Math.max(0, t.lastIndexOf('.', i) + 1, i - 220), trecho = t.slice(ini, i + 900);
  if (/gasolina a/i.test(t.slice(i, i + 120)) && !/diesel a/i.test(t.slice(i, i + 60))) return null;
  let preco = null, anterior = null, delta = null, confianca = 'alta';
  let m = /passara(?: a ser)?,?(?: em media,?)? de R\$ ?([\d.,]+) (?:por litro )?para R\$ ?([\d.,]+)/i.exec(trecho);
  if (m) { anterior = n2(m[1]); preco = n2(m[2]); }
  if (!preco) { m = /passara a (?:ser|custar),?(?: em media,?)?(?: de)? R\$ ?([\d.,]+)/i.exec(trecho) || /(?:preco medio[^.]{0,80}?) (?:sera|e) de R\$ ?([\d.,]+) por litro/i.exec(trecho); if (m) preco = n2(m[1]); }
  if (!preco) { m = /(aument\w*|elev\w*|ajust\w*|reduz\w*|reducao|corta\w*|desconto)[^.]{0,160}?(?:em|de) R\$ ?([\d.,]+) (?:por litro|\/l)/i.exec(trecho); if (m) { delta = n2(m[2]) * (/reduz|reducao|corta|desconto/i.test(m[1]) ? -1 : 1); confianca = 'media'; } }
  if (!preco && delta == null) return null;
  /* vigência */
  let vig = null; const p = pub ? new Date(pub + 'T12:00:00Z') : null;
  m = /a partir d[eoa]s? ?(?:amanha|hoje)?,? ?\(?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\)?/i.exec(t);
  if (m) vig = `${m[3] || (p ? p.getUTCFullYear() : new Date().getFullYear())}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (!vig && p) { m = /a partir d\w+ (?:\w+[- ]feira|sabado|domingo)?,? ?\((\d{1,2})[oº°]?\)/i.exec(t); if (m) { const d = new Date(p); d.setUTCDate(+m[1]); if (+m[1] < p.getUTCDate() - 7) d.setUTCMonth(d.getUTCMonth() + 1); vig = ymd(d); } }
  if (!vig && p && /a partir de amanha/i.test(t)) { const d = new Date(p); d.setUTCDate(d.getUTCDate() + 1); vig = ymd(d); }
  if (!vig && pub) { vig = pub; confianca = 'media'; }
  return { preco, anterior, delta, vigencia: vig, confianca, trecho: trecho.slice(0, 280) };
}

/* ---------- PDF → texto (streams FlateDecode, operadores Tj/TJ) ---------- */
function textoPdf(buf) {
  const s = buf.toString('latin1'); let out = '', pos = 0;
  for (;;) {
    const a = s.indexOf('stream', pos); if (a < 0) break;
    const ini = s[a + 6] === '\r' ? a + 8 : a + 7, fim = s.indexOf('endstream', ini); if (fim < 0) break;
    const dict = s.slice(Math.max(0, a - 400), a); pos = fim + 9;
    if (!/FlateDecode/.test(dict.slice(dict.lastIndexOf('<<')))) continue;
    let raw = Buffer.from(s.slice(ini, fim), 'latin1'), txt = null;
    for (const f of [zlib.inflateSync, zlib.inflateRawSync]) { try { txt = f(raw).toString('latin1'); break; } catch (e) { try { txt = f(raw.subarray(0, raw.length - 2)).toString('latin1'); break; } catch (e2) { /* tenta o próximo */ } } }
    if (!txt || !/T[Jj]/.test(txt)) continue;
    txt.replace(/\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^)\\]|\\.)*)\)\s*Tj|(T\*|Td|TD|ET)/g, (m, arr, str, nl) => {
      if (nl) { out += '\n'; return ''; }
      const parte = arr != null ? (arr.match(/\(((?:[^)\\]|\\.)*)\)|-?\d+(?:\.\d+)?/g) || []).map(x => x[0] === '(' ? x.slice(1, -1) : (+x < -200 ? ' ' : '')).join('') : str;
      out += parte.replace(/\\(\d{3})/g, (mm, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\([()\\])/g, '$1').replace(/\\n/g, ' ') + ' ';
      return '';
    });
  }
  return out.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n');
}
/* da síntese: última semana de realização do diesel A e PPI */
function extrairSintese(texto) {
  const t = semAcento(texto).replace(/\s+/g, ' ');
  const res = {};
  /* bloco de realização do diesel: procura "REALIZACAO" depois de "Diesel A" (ou o contrário) e pega a última linha data + preço */
  const blocos = [...t.matchAll(/REALIZACAO/gi)].map(m => t.slice(m.index, m.index + 700));
  const bD = blocos.find(b => /diesel/i.test(b.slice(0, 300))) || null;
  if (bD) { const rows = [...bD.matchAll(/(\d{2})\/(\d{2})\/(\d{4}) (\d+,\d{2,3})/g)]; const r = rows[rows.length - 1]; if (r) res.realizacao = { semana: `${r[3]}-${r[2]}-${r[1]}`, preco: n2(r[4]) }; }
  const iP = t.search(/PPI/); if (iP >= 0) {
    const seg = t.slice(iP, iP + 900), rows = [...seg.matchAll(/(\d{2})\/(\d{2})\/(\d{4}) (\d+,\d{2,3}) (\d+,\d{2,3})/g)], r = rows[rows.length - 1];
    if (r) { res.ppi = { semana: `${r[3]}-${r[2]}-${r[1]}`, realizacao: n2(r[4]), ppi: n2(r[5]) }; if (!res.realizacao) res.realizacao = { semana: res.ppi.semana, preco: res.ppi.realizacao }; }
  }
  return res.realizacao || res.ppi ? res : null;
}
/* número da semana usado nos nomes da síntese (sintese-precos-NN.pdf): semanas desde 1º de janeiro */
const semanaAno = d => Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getUTCDay() + 1) / 7);

/* ---------- validação ---------- */
function validar(novo, ultimo, refAnp, hoje = new Date()) {
  const motivos = [];
  if (!(novo.preco >= 1.5 && novo.preco <= 8)) motivos.push('valor fora da faixa esperada (R$ 1,50 a R$ 8,00)');
  if (ultimo && Math.abs(novo.preco / ultimo.preco - 1) > 0.3) motivos.push('variação acima de 30% em relação ao último preço');
  if (novo.anterior && ultimo && Math.abs(novo.anterior - ultimo.preco) > 0.06) motivos.push(`o comunicado cita preço anterior R$ ${novo.anterior.toFixed(2)}, diferente do último registrado (R$ ${ultimo.preco.toFixed(2)})`);
  const dias = (Date.parse(novo.vigencia + 'T12:00:00Z') - hoje) / 864e5;
  if (!(dias > -45 && dias < 15)) motivos.push('data de vigência fora do esperado');
  if (refAnp && refAnp.preco && Math.abs(novo.preco / refAnp.preco - 1) > 0.15) motivos.push(`diferença acima de 15% do preço de refinaria da ANP (R$ ${refAnp.preco.toFixed(2)})`);
  if (novo.confianca !== 'alta') motivos.push('o comunicado informa só a variação, não o preço final');
  return motivos;
}

module.exports = { textoHtml, linksAgencia, dataPublicacao, extrairComunicado, textoPdf, extrairSintese, validar, semanaAno };
