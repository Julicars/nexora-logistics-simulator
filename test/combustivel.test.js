const test = require('node:test'), assert = require('node:assert'), zlib = require('zlib'), fs = require('fs'), os = require('os'), path = require('path');
const { lerXlsx } = require('../server/xlsxler'), { lerSemana, linksSemanais, produtoDiesel, produtoTipo } = require('../server/combustivel'), { createServer } = require('../server/index');

/* monta um .xlsx real (zip com deflate + sharedStrings) no formato da planilha da ANP */
function xlsx(linhas) {
  const ss = [], idx = s => { let i = ss.indexOf(s); if (i < 0) { i = ss.length; ss.push(s); } return i; };
  const col = i => String.fromCharCode(65 + i), x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => v == null ? '' : typeof v === 'number' ? `<c r="${col(c)}${r + 1}"><v>${v}</v></c>` : `<c r="${col(c)}${r + 1}" t="s"><v>${idx(v)}</v></c>`).join('')}</row>`).join('');
  const files = [['xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="REVENDAS" sheetId="1" r:id="rId1"/></sheets></workbook>'], ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/sharedStrings.xml', `<sst>${ss.map(s => `<si><t>${x(s)}</t></si>`).join('')}</sst>`], ['xl/worksheets/sheet1.xml', `<worksheet><sheetData>${rows}</sheetData></worksheet>`]];
  const loc = [], cen = []; let off = 0;
  for (const [n, t] of files) { const nm = Buffer.from(n), raw = Buffer.from(t), d = zlib.deflateRawSync(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(8, 8); h.writeUInt32LE(d.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26); loc.push(h, nm, d);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(d.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42); cen.push(c, nm); off += 30 + nm.length + d.length; }
  const cd = Buffer.concat(cen), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...loc, cd, e]);
}
const CAB = ['CNPJ', 'RAZÃO', 'FANTASIA', 'ENDEREÇO', 'NÚMERO', 'COMPLEMENTO', 'BAIRRO', 'CEP', 'MUNICÍPIO', 'ESTADO', 'BANDEIRA', 'PRODUTO', 'UNIDADE DE MEDIDA', 'PREÇO DE REVENDA', 'DATA DA COLETA'];
const L = (cnpj, mun, uf, prod, preco, data = '10/11/2026') => [cnpj, 'POSTO ' + cnpj.slice(-2) + ' LTDA', 'Posto ' + cnpj.slice(-2), 'RUA A', '10', null, 'CENTRO', '01000-000', mun, uf, 'IPIRANGA', prod, 'R$/l', preco, data];
const sem1 = xlsx([['LEVANTAMENTO DE PREÇOS'], [], CAB, L('11111111000101', 'SAO PAULO', 'SAO PAULO', 'OLEO DIESEL S10', '7,10'), L('11111111000101', 'SAO PAULO', 'SAO PAULO', 'OLEO DIESEL', '6,95'), L('22222222000102', 'CAMPINAS', 'SAO PAULO', 'OLEO DIESEL S10', 7.4), L('33333333000103', 'RIO BRANCO', 'ACRE', 'DIESEL S10', '8,20'), L('44444444000104', 'SAO PAULO', 'SP', 'GASOLINA COMUM', '6,10')]);
const sem2 = xlsx([CAB, L('11111111000101', 'SAO PAULO', 'SAO PAULO', 'OLEO DIESEL S10', '7,30', '17/11/2026'), L('22222222000102', 'CAMPINAS', 'SAO PAULO', 'OLEO DIESEL S10', '7,20', '17/11/2026'), L('33333333000103', 'RIO BRANCO', 'ACRE', 'DIESEL S10', '8,20', '17/11/2026')]);

test('lê xlsx comprimido e identifica diesel', () => {
  assert.equal(lerXlsx(sem1)[0].linhas[2][0], 'CNPJ');
  assert.equal(produtoDiesel('ÓLEO DIESEL S-10'), 's10'); assert.equal(produtoDiesel('OLEO DIESEL'), 's500'); assert.equal(produtoDiesel('GASOLINA'), null); assert.equal(produtoTipo('GASOLINA ADITIVADA'), 'gasad'); assert.equal(produtoTipo('ETANOL HIDRATADO'), 'etanol'); assert.equal(produtoTipo('GNV'), 'gnv'); assert.equal(produtoTipo('GLP'), null);
  const s = lerSemana(sem1), p = s.postos.find(x => x.c === '11111111000101');
  assert.equal(s.postos.length, 4); assert.equal(s.postos.find(x => x.c === '44444444000104').gas, 6.1); assert.equal(p.s10, 7.1); assert.equal(p.s500, 6.95); assert.equal(p.u, 'SP'); assert.equal(p.d, '2026-11-10');
});
test('acha links semanais na página da ANP', () => {
  const l = linksSemanais('<a href="https://x.gov.br/arquivos-lpc/2026/revendas_lpc_2026-11-01_2026-11-07.xlsx">a</a><a href="/arquivos-lpc/2026/revendas_lpc_2026_11_08-2026_11_14.xlsx/@@download/file">b</a>', 'https://x.gov.br/p');
  assert.deepEqual(l.map(x => x.inicio), ['2026-11-08', '2026-11-01']); assert.equal(l[1].fim, '2026-11-07');
});
test('servidor: atualiza da ANP, resumo, postos com variação e importação', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxc-'));
  const pag = '<a href="/a/revendas_lpc_2026_11_08-2026_11_14.xlsx">x</a><a href="/a/revendas_lpc_2026_11_01-2026_11_07.xlsx">y</a>';
  const fake = async u => { const b = /11_08/.test(u) ? sem2 : /11_01/.test(u) ? sem1 : Buffer.from(pag); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
  const srv = createServer({ dataDir: dir, fetch: fake, anpPagina: 'https://anp.test/pagina' }); await new Promise(ok => srv.listen(0, ok)); const base = 'http://127.0.0.1:' + srv.address().port;
  const J = async (p, o) => (await fetch(base + p, o)).json();
  try {
    assert.equal((await fetch(base + '/api/combustivel/resumo')).status, 404);
    const a = await J('/api/combustivel/atualizar', { method: 'POST' }); assert.equal(a.erro, null); assert.equal(a.novas.length, 2);
    const r = await J('/api/combustivel/resumo');
    assert.equal(r.semana.inicio, '2026-11-08'); assert.equal(r.br.s10.media, 7.567); assert.equal(r.uf.AC.s10.media, 8.2); assert.equal(r.historico.length, 2);
    assert.equal(r.cidades.s10.caras[0].m, 'RIO BRANCO'); assert.equal(r.mudancas.altas[0].c, '11111111000101'); assert.equal(r.mudancas.quedas[0].c, '22222222000102');
    const p = await J('/api/combustivel/postos?uf=SP&produto=s10'); assert.equal(p.total, 2); assert.equal(p.postos[0].m, 'CAMPINAS'); assert.equal(p.postos[0].var, -0.2);
    assert.deepEqual(await J('/api/combustivel/municipios?uf=SP'), ['CAMPINAS', 'SAO PAULO']);
    const b = await J('/api/combustivel/atualizar', { method: 'POST' }); assert.equal(b.novas.length, 0);
    const i = await J('/api/combustivel/importar?nome=revendas_lpc_2026_11_15-2026_11_21.xlsx', { method: 'POST', body: sem2 }); assert.equal(i.inicio, '2026-11-15');
    assert.equal((await fetch(base + '/api/combustivel/importar', { method: 'POST', body: 'lixo' })).status, 400);
  } finally { srv.close(); }
});
test('mercado: dólar PTAX, Brent FRED, Petrobras e alertas', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxm-')), hoje = new Date(), dia = n => new Date(hoje - n * 864e5).toISOString().slice(0, 10);
  const ptax = { value: [20, 10, 1].map((n, i) => ({ cotacaoCompra: 5, cotacaoVenda: [5.0, 5.1, 5.4][i], dataHoraCotacao: dia(n) + ' 13:05:00.000' })) };
  const csv = 'observation_date,DCOILBRENTEU\n' + [[20, 70], [10, 72], [8, '.'], [1, 80]].map(([n, v]) => dia(n) + ',' + v).join('\n');
  const fake = async u => { const b = Buffer.from(/olinda/.test(u) ? JSON.stringify(ptax) : /fred/.test(u) ? csv : ''); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
  const srv = createServer({ dataDir: dir, fetch: fake, bcbPtax: 'https://olinda.test/x', fredCsv: 'https://fred.test/x' }); await new Promise(ok => srv.listen(0, ok)); const base = 'http://127.0.0.1:' + srv.address().port;
  const J = async (p, o) => (await fetch(base + p, o)).json();
  try {
    const m = await J('/api/combustivel/mercado/atualizar', { method: 'POST' });
    assert.deepEqual(m.erros, {}); assert.equal(m.dolar.atual.v, 5.4); assert.equal(m.brent.atual.v, 80); assert.equal(m.brent.emReais, 432); assert.equal(m.brent.porLitroRs, 2.717);
    assert.equal(m.brent.serie.length, 3); assert.ok(m.alertas.some(a => a.tipo === 'alta'));
    assert.equal(m.petrobras.length, 2);
    const p = await J('/api/combustivel/petrobras', { method: 'POST', body: JSON.stringify({ data: '2026-11-10', preco: '3,45', obs: 'teste' }) }); assert.equal(p.petrobras[2].preco, 3.45);
    assert.equal((await fetch(base + '/api/combustivel/petrobras', { method: 'POST', body: '{"data":"x","preco":1}' })).status, 400);
    const d = await J('/api/combustivel/petrobras/2026-11-10', { method: 'DELETE' }); assert.equal(d.petrobras.length, 2);
  } finally { srv.close(); }
});
