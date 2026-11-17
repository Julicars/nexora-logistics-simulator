const test = require('node:test'), assert = require('node:assert'), zlib = require('zlib'), fs = require('fs'), os = require('os'), path = require('path');
const PB = require('../server/petrobras'), { createServer } = require('../server/index');

const NOTA_JUN = `<html><body><h1>Petrobras informa sobre desconto nos preços de diesel</h1><span>Publicado em 31/05/2026</span>
<p>A Petrobras informa que implementará, a partir desta segunda-feira (1º), desconto de R$ 0,3515 por litro nos preços de venda de óleo diesel A de uso rodoviário.</p>
<p>Dessa forma, o preço médio de venda da Petrobras para as distribuidoras passará de R$ 3,65 para R$ 3,30 por litro.</p></body></html>`;
const NOTA_MAR = `<p>São Paulo, 13 de março de 2026 – A Petrobras informa que, a partir de amanhã, 14/03, ajustará os seus preços de venda do diesel A para as distribuidoras em R$ 0,38 por litro.</p>`;
const NOTA_NOV = `<p>2026.11.16</p><p>A partir de amanhã, 17/11, o preço médio de venda de diesel A da Petrobras para as distribuidoras passará de R$ 3,30 para R$ 3,45 por litro.</p>`;

function pdf(texto) { // PDF mínimo com um stream FlateDecode contendo operadores de texto
  const conteudo = 'BT /F1 9 Tf ' + texto.split('\n').map(l => `(${l}) Tj T*`).join(' ') + ' ET';
  const z = zlib.deflateSync(Buffer.from(conteudo, 'latin1'));
  return Buffer.concat([Buffer.from(`%PDF-1.4\n4 0 obj\n<< /Length ${z.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), z, Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1')]);
}
const SINT = pdf('Óleo Diesel\nREALIZAÇÃO - Semana de 01/11/2026 a 07/11/2026\nDiesel A S10\nSemana terminada em Preço Médio R$/L\n24/10/2026 3,30 0,00%\n31/10/2026 3,30 0,00%\n07/11/2026 3,31 0,30%\nPPI Médio R$/L\n31/10/2026 3,31 3,72 12,4%\n07/11/2026 3,31 3,80 14,8%');

test('extrai preço e vigência dos comunicados', () => {
  const j = PB.extrairComunicado(PB.textoHtml(NOTA_JUN), PB.dataPublicacao(PB.textoHtml(NOTA_JUN)));
  assert.equal(j.preco, 3.3); assert.equal(j.anterior, 3.65); assert.equal(j.vigencia, '2026-06-01'); assert.equal(j.confianca, 'alta');
  const m = PB.extrairComunicado(PB.textoHtml(NOTA_MAR), PB.dataPublicacao(PB.textoHtml(NOTA_MAR)));
  assert.equal(m.preco, null); assert.equal(m.delta, 0.38); assert.equal(m.vigencia, '2026-03-14'); assert.equal(m.confianca, 'media');
  assert.equal(PB.extrairComunicado('Petrobras celebra 60 anos da Lubnor', null), null);
});
test('lê a síntese da ANP em PDF', () => {
  const r = PB.extrairSintese(PB.textoPdf(SINT));
  assert.deepEqual(r.realizacao, { semana: '2026-11-07', preco: 3.31 }); assert.equal(r.ppi.ppi, 3.8);
});
test('validação manda dúvidas para pendente', () => {
  const ult = { preco: 3.3 }, hoje = new Date('2026-11-16T12:00:00Z');
  assert.deepEqual(PB.validar({ preco: 3.45, anterior: 3.3, vigencia: '2026-11-17', confianca: 'alta' }, ult, { preco: 3.31 }, hoje), []);
  assert.ok(PB.validar({ preco: 6.9, vigencia: '2026-11-17', confianca: 'alta' }, ult, null, hoje).length);
  assert.ok(PB.validar({ preco: 3.45, anterior: 3.1, vigencia: '2026-11-17', confianca: 'alta' }, ult, null, hoje).some(m => /anterior/.test(m)));
});
test('servidor: detecta comunicado novo, grava sozinho e aprova pendências', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxp-'));
  const lista = '<a href="/w/negocio/petrobras-reduz-preco-do-diesel-para-distribuidoras">a</a><a href="/w/negocio/petrobras-reajusta-diesel-x">b</a><a href="/w/negocio/petrobras-assina-contrato-gnl">c</a>';
  const R = { '/lista': lista, '/w/negocio/petrobras-reduz-preco-do-diesel-para-distribuidoras': NOTA_NOV, '/w/negocio/petrobras-reajusta-diesel-x': `<p>2026.11.16</p><p>A partir de amanhã, 17/11, o preço médio do diesel A passará de R$ 3,30 para R$ 5,90 por litro.</p>` };
  const fake = async u => { const p = new URL(u).pathname; let b; if (/sintese-precos/.test(p)) b = SINT; else if (R[p] != null) b = Buffer.from(R[p]); else return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }; return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
  const srv = createServer({ dataDir: dir, fetch: fake, agenciaLista: 'https://agencia.test/lista', sinteseBase: 'https://anp.test/s' }); await new Promise(ok => srv.listen(0, ok)); const base = 'http://127.0.0.1:' + srv.address().port;
  const J = async (p, o) => (await fetch(base + p, o)).json();
  try {
    const m = await J('/api/combustivel/petrobras/verificar', { method: 'POST' });
    assert.equal(m.petroAuto.fontes.agencia.ok, true, JSON.stringify(m.petroAuto.fontes)); assert.equal(m.petroAuto.fontes.sintese.ok, true);
    const auto = m.petrobras.find(x => x.data === '2026-11-17'); assert.ok(auto); assert.equal(auto.preco, 3.45); assert.equal(auto.origem, 'comunicado');
    assert.equal(m.petroAuto.pendentes.length, 1); assert.equal(m.petroAuto.pendentes[0].preco, 5.9);
    assert.ok(m.petroAuto.ppi.defasagem > 10); assert.ok(m.alertas.some(a => /PPI/.test(a.tx)));
    const m2 = await J('/api/combustivel/petrobras/verificar', { method: 'POST' }); assert.equal(m2.petroAuto.pendentes.length, 1); assert.equal(m2.petrobras.length, 3);
    const m3 = await J('/api/combustivel/petrobras/pendente/' + m.petroAuto.pendentes[0].id, { method: 'DELETE' }); assert.equal(m3.petroAuto.pendentes.length, 0); assert.equal(m3.petrobras.length, 3);
  } finally { srv.close(); }
});
