/*
 * NEXORA — Motor de cálculo de carga (compartilhado entre navegador e Node.js)
 * Posicionamento: grade exata por produto + Extreme Points (Crainic, Perboli & Tadei, 2008)
 * Regras: limites do baú, sobreposição, apoio mínimo, peso sobre cada volume, níveis máximos,
 *         regras por tipo (palete, caixa, bobina, big bag, outro), limite por eixo e PBT.
 */
(function (root) {
'use strict';
const EPS = 1e-6;

/* ---------- VEÍCULOS OFICIAIS (medidas internas, metros) — não alterar sem autorização ---------- */
/* ---------- CONFIGURAÇÃO (src/config/*.js) ---------- */
const CFG = (typeof module === 'object' && module.exports)
  ? Object.assign({}, require('../../config/veiculos.js'), require('../../config/categorias.js'))
  : (root.NX_CONFIG || {});
if (!CFG.FROTA || !CFG.PCATS) throw new Error('NEXORA: arquivos de configuração (src/config) não carregados.');
const { MAXKG, ALT_MAX, ASSOALHO, PCATS, PROTECT, INCOMPAT, BODIES } = CFG;
const FLEET0 = CFG.FROTA.map((r,i)=>({id:'v'+i,name:r[0],cat:r[1],L:r[2],W:r[3],H:r[4],wag:r[5],max:MAXKG[r[0]]||null}));
const deckH = v => ASSOALHO[v.cat] || ASSOALHO.padrao;
const CATS = ['Carreta','Rodotrem','Truck','3/4','Van','Iveco baú','Container'];

/* ---------- TIPOS DE CARGA ---------- */
const TIPOS = {
 palete:{nome:'Palete',emb:['Palete de madeira','Palete de plástico','Palete PBR','Palete europeu','Palete descartável']},
 caixa:{nome:'Caixa',emb:['Caixa individual','Caixas agrupadas','Caixa empilhável','Caixa frágil']},
 bobina:{nome:'Bobina',emb:['Bobina de aço','Bobina de papel','Bobina de filme','Bobina de cabo']},
 bigbag:{nome:'Big Bag',emb:['Big Bag 1 t','Big Bag 1,5 t','Big Bag com válvula','Big Bag com palete']},
 outro:{nome:'Outro',emb:['Volume industrial','Engradado','Tambor','Formato personalizado']}
};
const POS = {
 palete:[['pe','Em pé · melhor encaixe'],['pe-c','Em pé · C no comprimento'],['pe-l','Em pé · C na largura'],['deitado','Deitado · melhor encaixe'],['auto','Qualquer · melhor encaixe']],
 caixa:[['auto','Qualquer · melhor encaixe'],['pe','Em pé · melhor encaixe'],['pe-c','Em pé · C no comprimento'],['pe-l','Em pé · C na largura'],['deitado','Deitada · melhor encaixe']],
 bobina:[['auto','Em pé ou deitada · melhor encaixe'],['pe','Em pé (eixo vertical)'],['deitado','Deitada · melhor encaixe'],['deit-c','Deitada · eixo no comprimento'],['deit-l','Deitada · eixo na largura']],
 bigbag:[['pe','Em pé · melhor encaixe'],['pe-c','Em pé · C no comprimento'],['pe-l','Em pé · C na largura']],
 outro:[['auto','Qualquer · melhor encaixe'],['pe','Em pé · melhor encaixe'],['pe-c','Em pé · C no comprimento'],['pe-l','Em pé · C na largura'],['deitado','Deitado · melhor encaixe']]
};
POS.caixa = POS.caixa;

const hasCat=(p,k)=>!!(p&&Array.isArray(p.cats)&&p.cats.includes(k));
const bodyOptions=cat=>(['Carreta','Rodotrem','Truck','3/4'].includes(cat)?['bau','sider','aberta']:[]);
const bodyOf=v=>{const o=bodyOptions(v.cat);return o.includes(v.body)?v.body:(o[0]||(v.cat==='Container'?'container':'bau'))};
/* veículo efetivo para o cálculo: carroceria aberta não tem teto -> altura útil limitada pela altura legal (4,40 m do chão) */
const effH = v => bodyOf(v)==='aberta' ? +(ALT_MAX - deckH(v)).toFixed(2) : v.H;
const effV = v => bodyOf(v)==='aberta' ? {...v, H: effH(v)} : v;
/* motivo para um produto NÃO poder ir neste veículo (carroceria ou mistura com o que já está nele) */
function blockReason(v,p,catsIn){
 if(bodyOf(v)==='aberta'){const k=PROTECT.find(c=>hasCat(p,c));if(k)return PCATS[k].nome+' não pode ir em carroceria aberta';}
 if(catsIn)for(const [a,b] of INCOMPAT){if(hasCat(p,a)&&catsIn.has(b))return PCATS[a].nome+' não pode viajar com '+PCATS[b].nome.toLowerCase();if(hasCat(p,b)&&catsIn.has(a))return PCATS[b].nome+' não pode viajar com '+PCATS[a].nome.toLowerCase();}
 return null;
}

/* ---------- NORMALIZAÇÃO / VALIDAÇÃO DE PRODUTO OU LINHA ---------- */
const num = v => (v===''||v===null||v===undefined)?NaN:+v;
function normalize(p){
 const o = {...p};
 o.tipo = TIPOS[o.tipo] ? o.tipo : 'caixa';
 o.cats = [...new Set((Array.isArray(o.cats) ? o.cats : (o.cats ? [o.cats] : [])).filter(k => PCATS[k]))];
 if(o.tipo==='bobina'){ o.d = num(o.d!==undefined?o.d:o.l); o.l = o.d; o.w = o.d; }
 for(const k of ['l','w','h']) o[k] = num(o[k]);
 { const pc=num(o.pcs); o.pcs = isNaN(pc) ? 1 : Math.round(pc); }
 o.kgp = num(o.kgp);
 if(!(o.kgp>=0) && num(o.kg)>0) o.kgp = num(o.kg)/o.pcs;
 o.kg = o.kgp>=0 ? +(o.kgp*o.pcs).toFixed(3) : num(o.kg);
 o.stackable = o.stackable!==false && o.stackable!=='nao';
 o.maxLevels = num(o.maxLevels)>0 ? Math.round(num(o.maxLevels)) : null;
 o.stack = (o.stack===''||o.stack===null||o.stack===undefined) ? null : num(o.stack);
 if(!POS[o.tipo].some(x=>x[0]===o.pos)) o.pos = POS[o.tipo][0][0];
 if(o.q!==undefined) o.q = Math.round(num(o.q));
 return o;
}
function validateSpec(p, needQty){
 const e = [];
 if(!String(p.nome||'').trim()) e.push('Informe o nome/descrição.');
 if(!String(p.cod||'').trim()) e.push('Informe o código.');
 if(String(p.cod||'').length>40||String(p.nome||'').length>120) e.push('Código ou nome muito longo.');
 if(!TIPOS[p.tipo]) e.push('Tipo de embalagem inválido.');
 const lab = p.tipo==='bobina' ? {l:'Diâmetro',h:'Largura da bobina'} : {l:'Comprimento',w:'Largura',h:'Altura'};
 for(const k of Object.keys(lab)){ const v=num(p[k]); if(!(v>0)) e.push(lab[k]+' deve ser maior que zero.'); else if(v>20) e.push(lab[k]+' acima de 20 m.'); }
 if(!(num(p.pcs)>=1)) e.push('Peças por volume deve ser 1 ou mais.');
 if(!(num(p.kg)>0)) e.push('Peso por volume deve ser maior que zero.');
 if(num(p.kg)>40000) e.push('Peso por volume acima de 40 t.');
 if(p.stack!==null && p.stack!==undefined && p.stack!=='' && !(num(p.stack)>=0)) e.push('"Aguenta em cima" não pode ser negativo.');
 if(p.maxLevels!==null && p.maxLevels!==undefined && p.maxLevels!=='' && !(num(p.maxLevels)>=1)) e.push('Níveis máximos deve ser 1 ou mais.');
 if(needQty && !(num(p.q)>=1)) e.push('Quantidade deve ser 1 ou mais.');
 if(needQty && num(p.q)>5000) e.push('Quantidade acima de 5.000 volumes.');
 return e;
}
const stackOf = p => (p.stackable===false || hasCat(p,'fragil')) ? 0 : ((p.stack===null||p.stack===''||p.stack===undefined) ? Infinity : +p.stack);
const levelsOf = p => (p.stackable===false) ? 1 : (p.tipo==='bobina' ? (p.maxLevels||99) : (p.maxLevels||99));

/* ---------- LIMITES POR EIXO E PBT ----------
 * Limites legais: Res. CONTRAN 882/2021 (consolida a 210/2006): eixo simples 2 pneus 6 t; eixo simples 4 pneus 10 t;
 * tandem duplo 17 t; tandem triplo (semirreboque) 25,5 t; 3S3 > 16 m = 48,5 t; rodotrem 9 eixos = 74 t; truck 6x2 = 23 t.
 * Veículos leves: PBT/eixos limitados pelo fabricante (Agrale 8700 = 3,2 t + 5,5 t, PBT 8,7 t;
 * Iveco Daily 30-160 = 1,85 t + 2,05 t, PBT legal 3,5 t; Daily 35-160 = 1,85 t + 2,55 t, PBT legal 3,5 t / técnico 4,4 t).
 * Tolerância de fiscalização (Lei 14.229/2021): 12,5% por eixo e 5% no PBT — NÃO usada no planejamento.
 * Taras: estimativas (fichas de fabricantes quando disponíveis); ajuste à sua frota. */
const CONT_TARE = { "Container 45' HC": 4800, "Container 40' HC": 3900, "Container 20' DC": 2200 };
/* Configurações de eixos (modelo "Frota Certa" / CONTRAN 882/2021) */
/* Configurações de eixos — Resolução CONTRAN 882/2021 (limites por eixo/conjunto e PBT/PBTC).
   tr: cavalo (toco 6+10 | trucado 6+17); tg: grupos da carreta [nome, limite kg, nº de eixos]. */
const AXCFG = {
 'toco':          {nome:'Toco 2 eixos (6 + 10 = 16 t)', pbt:16000, disp:'facil', cats:['Truck']},
 'trucado':       {nome:'Trucado 3 eixos (6 + 17 = 23 t)', pbt:23000, disp:'facil', cats:['Truck']},
 'bitruck':       {nome:'Bitruck 4 eixos (6 + 6 + 17 = 29 t)', pbt:29000, disp:'facil', cats:['Truck']},
 'truck-tt':      {nome:'Caminhão 4 eixos tandem triplo (6 + 25,5 = 31,5 t)', pbt:31500, disp:'dificil', cats:['Truck']},
 'cav-toco-1':    {nome:'Cavalo toco + carreta 1 eixo (6 + 10 + 10 = 26 t)', disp:'dificil', cats:['Carreta','Container'], tr:'toco', tg:[['Carreta (1 eixo)',10000,1]], pbt:26000},
 'cav-toco-2':    {nome:'Cavalo toco + carreta 2 eixos (6 + 10 + 17 = 33 t)', disp:'medio', cats:['Carreta','Container'], tr:'toco', tg:[['Carreta (tandem duplo)',17000,2]], pbt:33000},
 'cav-toco-2d':   {nome:'Cavalo toco + carreta 2 eixos distanciados (6 + 10 + 20 = 36 t)', disp:'dificil', cats:['Carreta','Container'], tr:'toco', tg:[['Carreta — 1º eixo',10000,1],['Carreta — 2º eixo',10000,1]], pbt:36000},
 'cav-toco-ls':   {nome:'Cavalo toco + carreta LS (6 + 10 + 25,5 = 41,5 t)', disp:'facil', cats:['Carreta','Container'], tr:'toco', tg:[['Carreta LS (tandem triplo)',25500,3]], pbt:41500},
 'cav-toco-vand': {nome:'Cavalo toco + carreta vanderléia (6 + 10 + 30 = 46 t)', disp:'medio', cats:['Carreta','Container'], tr:'toco', tg:[['Vanderléia — 1º eixo',10000,1],['Vanderléia — 2º eixo',10000,1],['Vanderléia — 3º eixo',10000,1]], pbt:46000},
 'cav-truc-1':    {nome:'Cavalo trucado + carreta 1 eixo (6 + 17 + 10 = 33 t)', disp:'dificil', cats:['Carreta','Container'], tr:'trucado', tg:[['Carreta (1 eixo)',10000,1]], pbt:33000},
 'cav-truc-2':    {nome:'Cavalo trucado + carreta 2 eixos (6 + 17 + 17 = 40 t)', disp:'medio', cats:['Carreta','Container'], tr:'trucado', tg:[['Carreta (tandem duplo)',17000,2]], pbt:40000},
 'cav-truc-2d':   {nome:'Cavalo trucado + carreta 2 eixos distanciados (6 + 17 + 20 = 43 t)', disp:'dificil', cats:['Carreta','Container'], tr:'trucado', tg:[['Carreta — 1º eixo',10000,1],['Carreta — 2º eixo',10000,1]], pbt:43000},
 'cav-truc-ls-c': {nome:'LS 6 eixos menor de 16 m / basculante (PBT 45 t)', disp:'medio', cats:['Carreta','Container'], tr:'trucado', tg:[['Carreta LS (tandem triplo)',25500,3]], pbt:45000},
 'cav-truc-ls':   {nome:'Cavalo trucado + carreta LS acima de 16 m (6 + 17 + 25,5 = 48,5 t)', disp:'facil', cats:['Carreta','Container'], tr:'trucado', tg:[['Carreta LS (tandem triplo)',25500,3]], pbt:48500},
 'cav-truc-vs':   {nome:'LS vanderléia simples 6 eixos (6 + 17 + 10 + 17 = 50 t)', disp:'dificil', cats:['Carreta','Container'], tr:'trucado', tg:[['Carreta — eixo isolado',10000,1],['Carreta — tandem duplo',17000,2]], pbt:50000},
 'cav-truc-vand': {nome:'Cavalo trucado + vanderléia (6 + 17 + 30 = 53 t)', disp:'medio', cats:['Carreta','Container'], tr:'trucado', tg:[['Vanderléia — 1º eixo',10000,1],['Vanderléia — 2º eixo',10000,1],['Vanderléia — 3º eixo',10000,1]], pbt:53000},
 'cav-truc-4e':   {nome:'LS quarto eixo, 17,5 m ou mais (6 + 17 + 10 + 25,5 = 58,5 t)', disp:'medio', cats:['Carreta','Container'], tr:'trucado', tg:[['Carreta — eixo distanciado',10000,1],['Carreta LS (tandem triplo)',25500,3]], pbt:58500},
 'romeu-julieta': {nome:'Romeu e Julieta trucado (6 + 17 + 10 + 10 = 43 t)', pbt:43000, disp:'medio', cats:['Rodotrem']},
 'rj-3c3':        {nome:'Caminhão-reboque trucado (6 + 17 + 10 + 17 = 50 t)', pbt:50000, disp:'medio', cats:['Rodotrem']},
 'rj-2c2':        {nome:'Toco + reboque (6 + 10 + 10 + 10 = 36 t)', pbt:36000, disp:'dificil', cats:['Rodotrem']},
 'bitrem7':       {nome:'Bitrem 7 eixos (6 + 17 + 17 + 17 = 57 t)', pbt:57000, disp:'facil', cats:['Rodotrem']},
 'bitrem9':       {nome:'Bitrem 9 eixos (6 + 17 + 25,5 + 25,5 = 74 t · exige AET, 25 a 30 m)', pbt:74000, disp:'dificil', cats:['Rodotrem']},
 'rodotrem9':     {nome:'Rodotrem 9 eixos (6 + 17 + 17 + 17 + 17 = 74 t · exige AET, 25 a 30 m)', pbt:74000, disp:'medio', cats:['Rodotrem']},
 'fab':           {nome:'Limite do fabricante', disp:'facil', cats:['3/4','Van','Iveco baú']}
};
const axDefault = cat => ({Carreta:'cav-truc-ls',Container:'cav-truc-ls',Truck:'trucado',Rodotrem:'rodotrem9'}[cat]||'fab');
const axcfgOf = v => (AXCFG[v.axcfg] && AXCFG[v.axcfg].cats.includes(v.cat)) ? v.axcfg : axDefault(v.cat);
/* do menor para o maior peso (PBT) */
/* facilidade de achar no mercado (estimativa: frota anunciada em fretes e emplacamentos ANFIR) */
const DISP={facil:'Fácil de achar',medio:'Encontra com alguma procura',dificil:'Difícil de achar'};
const axDisp = k => { const d=(AXCFG[k]&&AXCFG[k].disp)||'medio'; return {k:d,txt:DISP[d]}; };
const axOptions = cat => Object.entries(AXCFG).filter(([,o])=>o.cats.includes(cat)).sort((a,b)=>(a[1].pbt||0)-(b[1].pbt||0)).map(([k,o])=>[k,o.nome]);
/* multa por excesso de peso — CTB art. 231, V e Res. CONTRAN 882/2021 art. 57: multa-base (R$ 130,16) uma vez só;
   acréscimo por 200 kg ou fração (arredonda para cima), na faixa do excesso total, calculado separado para eixos e para
   PBT/PBTC e somado. Só conta o que passa da tolerância (arts. 52-53). */
function acrescimo(kg){ if(kg<=0)return 0; const v=kg<=600?5.32:kg<=800?10.64:kg<=1000?21.28:kg<=3000?31.92:kg<=5000?42.56:53.20; return Math.ceil(kg/200)*v; }
function multaExcesso(excEixos,excPbt=0){ const e=Math.max(0,excEixos),p=Math.max(0,excPbt); return e||p ? 130.16+acrescimo(e)+acrescimo(p) : 0; }
/* fiscalização na balança (Res. 882 art. 50): PBT regulamentar até 50 t → só PBT/PBTC (tolerância 5%);
   se passar dela, também os eixos, com penalidades somadas. Acima de 50 t → eixos (12,5%) e PBT (5%). */
function balanca(st){ const pbtTol=Math.round(st.pbtLim*1.05), excP=Math.max(0,st.pbt-pbtTol), soPbt=st.pbtLim<=50000;
 const checaEixo=!soPbt||excP>0, excE=checaEixo?st.al.reduce((t,a)=>t+Math.max(0,a.tot-a.tolLim),0):0;
 return {soPbt,pbtTol,excP,excE,multa:multaExcesso(excE,excP),retido:excP>0||excE>0}; }
/* peso vazio real por eixo (balança), quando o usuário informa no veículo: substitui a estimativa */
function axleModel(v){ const m=axleModel0(v); if(v&&Array.isArray(v.taras)) m.ax.forEach((a,i)=>{ const t=+v.taras[i]; if(t>0){ a.tare=t; a.taraReal=true; } }); return m; }
function axleModel0(v){
 const L=v.L, tol={eixo:0.125,pbt:0.05}, k=axcfgOf(v), src='CONTRAN 882/2021';
 /* Res. CONTRAN 1015/2024: dianteiro de 7 t para veículo elétrico, híbrido ou a gás (GNV/biometano) */
 const steer=t=>({n:'Dianteiro (simples, 2 pneus)'+(v.combAlt?' · 7 t (elétrico/gás)':''),lim:v.combAlt?7000:6000,tare:t+(v.combAlt?800:0)});
 if(v.cat==='Carreta'||v.cat==='Container'){
  const C=AXCFG[k], toco=C.tr==='toco', cont=v.cat==='Container'?(CONT_TARE[v.name]||3900):0;
  const tr=toco?[steer(4300),{n:'Tração do cavalo (simples, 4 pneus)',lim:10000,tare:3000}]:[steer(4970),{n:'Tração do cavalo (tandem duplo)',lim:17000,tare:3850}];
  const base={type:'semi',s1:0.8,tractor:toco?'toco':'trucado',cfg:C.nome,tol,src,k};
  const nax=C.tg.reduce((s,g)=>s+g[2],0), ttot=(v.cat==='Container'?5200:4600+800*nax)+cont;
  const grp=C.tg.map(([n,lim,na])=>({n:(v.cat==='Container'&&C.tg.length===1?'Porta-container (conjunto)':n),lim,tare:ttot*na/nax}));
  /* posição de cada grupo, do fundo para a frente */
  let x=L-0.7; const tx=[]; for(let i=C.tg.length-1;i>=0;i--){const na=C.tg[i][2],w=(na-1)*1.3;tx[i]=Math.max(x-w/2,1.5);x-=w+(C.tg[i][1]===10000&&C.tg.length>1?2.6:1.3)}
  const sh=C.tg.map(g=>g[1]/C.tg.reduce((s,h)=>s+h[1],0));
  return {...base,s2:tx.reduce((a,b,i)=>a+b*sh[i],0),split:C.tg.length,share:sh,tgN:C.tg.map(g=>g[2]),trailerX:tx,ax:[...tr,...grp],pbt:C.pbt};
 }
 if(v.cat==='Rodotrem'){
  const rj=(ax,pbt)=>({type:'rj',s1:-1.3,s2:L*0.7,p1:1.0,p2:L-1.2,cfg:AXCFG[k].nome,tol,src,k,ax,pbt});
  if(k==='romeu-julieta') return rj([steer(4300),{n:'Caminhão — traseiro (tandem duplo)',lim:17000,tare:4600},{n:'Reboque — eixo dianteiro (simples, 4 pneus)',lim:10000,tare:2300},{n:'Reboque — eixo traseiro (simples, 4 pneus)',lim:10000,tare:2300}],43000);
  if(k==='rj-3c3') return rj([steer(4300),{n:'Caminhão — traseiro (tandem duplo)',lim:17000,tare:4600},{n:'Reboque — eixo dianteiro (simples, 4 pneus)',lim:10000,tare:2300},{n:'Reboque — traseiro (tandem duplo)',lim:17000,tare:3000}],50000);
  if(k==='rj-2c2') return rj([steer(4000),{n:'Caminhão — traseiro (simples, 4 pneus)',lim:10000,tare:3200},{n:'Reboque — eixo dianteiro (simples, 4 pneus)',lim:10000,tare:2300},{n:'Reboque — eixo traseiro (simples, 4 pneus)',lim:10000,tare:2300}],36000);
  if(k==='bitrem7') return {type:'bitrem',s1:0.8,s2:L-1.2,tractor:'trucado',cfg:AXCFG[k].nome,tol,src,k,ax:[steer(4970),{n:'Tração do cavalo (tandem duplo)',lim:17000,tare:3850},{n:'1º semirreboque (tandem duplo)',lim:17000,tare:6000},{n:'2º semirreboque (tandem duplo)',lim:17000,tare:5500}],pbt:57000};
  if(k==='bitrem9') return {type:'bitrem',s1:0.8,s2:L-1.6,tractor:'trucado',cfg:AXCFG[k].nome,tol,src,k,ax:[steer(4970),{n:'Tração do cavalo (tandem duplo)',lim:17000,tare:3850},{n:'1º semirreboque (tandem triplo)',lim:25500,tare:7000},{n:'2º semirreboque (tandem triplo)',lim:25500,tare:6500}],pbt:74000};
  return {type:'rodo',s1:0.8,s2:L-1.2,tractor:'trucado',cfg:AXCFG[k].nome,tol,src,k,ax:[steer(4970),{n:'Tração do cavalo (tandem duplo)',lim:17000,tare:3850},{n:'1º semirreboque (tandem duplo)',lim:17000,tare:5000},{n:'Dolly (tandem duplo)',lim:17000,tare:2600},{n:'2º semirreboque (tandem duplo)',lim:17000,tare:5000}],pbt:74000};
 }
 if(v.cat==='Truck'){
  const R=(rear,ax,pbt,s1=-1.3)=>({type:'rigid',s1,s2:L*(rear===1?0.66:0.7),rear,cfg:AXCFG[k].nome,tol,src,k,ax,pbt});
  if(k==='toco') return R(1,[steer(4000),{n:'Traseiro (simples, 4 pneus)',lim:10000,tare:3200}],16000);
  if(k==='bitruck') return R(2,[{n:'Dianteiros (2 eixos direcionais)',lim:12000,tare:5600},{n:'Traseiro (tandem duplo)',lim:17000,tare:4600}],29000,-0.6);
  if(k==='truck-tt') return R(3,[steer(4500),{n:'Traseiro (tandem triplo)',lim:25500,tare:5800}],31500);
  return R(2,[steer(4300),{n:'Traseiro (tandem duplo)',lim:17000,tare:4400}],23000);
 }
 if(v.cat==='3/4') return {type:'rigid',s1:-1.1,s2:L*0.68,rear:1,k,cfg:'Caminhão leve 4x2 (3/4) — limite do fabricante',ax:[{n:'Dianteiro',lim:3200,tare:2000},{n:'Traseiro (rodagem dupla)',lim:5500,tare:1900}],pbt:8700,tol,src:'Ficha técnica Agrale 8700'};
 if(v.cat==='Iveco baú') return {type:'rigid',s1:-1.0,s2:L*0.7,rear:1,k,cfg:'Iveco Daily 35-160 chassi + baú (PBT legal 3,5 t)',ax:[{n:'Dianteiro',lim:1850,tare:1500},{n:'Traseiro (rodagem dupla)',lim:2550,tare:1100}],pbt:3500,pbtTec:4400,tol,src:'Ficha técnica Iveco Daily 35-160'};
 return {type:'rigid',s1:-0.9,s2:L*0.7,rear:1,k,cfg:'Furgão 3,5 t (classe Daily 30-160)',ax:[{n:'Dianteiro',lim:1850,tare:1450},{n:'Traseiro',lim:2050,tare:850}],pbt:3500,tol,src:'Ficha técnica Iveco Daily 30-160'};
}
/* parte do peso no pino-rei (quinta roda) que vai para o eixo dianteiro do cavalo. A quinta roda fica
   pouco à frente do centro do tandem de tração; 8% foi calibrado com carregamentos reais de carreta LS
   (big bags encostados na cabine). Varia conforme o cavalo: é uma estimativa. */
const FRONT=0.08;
function axleLoads(v,items){
 const m=axleModel(v),a=m.ax.map(()=>0);
 for(const it of items){
  const x=it.x+it.l/2,W=it.kg;
  let r=W*(x-m.s1)/(m.s2-m.s1);r=Math.max(-W,Math.min(2*W,r));const f=W-r;
  if(m.type==='rigid'){a[0]+=f;a[1]+=r}
  else if(m.type==='semi'){a[0]+=f*FRONT;a[1]+=f*(1-FRONT); for(let k=0;k<m.split;k++)a[2+k]+=r*m.share[k]}
  else if(m.type==='rj'){ if(it.wg===0){a[0]+=f;a[1]+=r} else { let r2=W*(x-m.p1)/(m.p2-m.p1);r2=Math.max(-W,Math.min(2*W,r2));a[2]+=W-r2;a[3]+=r2; } }
  else if(m.type==='bitrem'){ if(it.wg===0){a[0]+=f*FRONT;a[1]+=f*(1-FRONT);a[2]+=r} else {a[2]+=f;a[3]+=r} }
  else{ if(it.wg===0){a[0]+=f*FRONT;a[1]+=f*(1-FRONT);a[2]+=r} else {a[3]+=f;a[4]+=r} }
 }
 return m.ax.map((x,i)=>({n:x.n,lim:x.lim,tare:x.tare,cargo:a[i],tot:a[i]+x.tare,tolLim:Math.round(x.lim*(1+m.tol.eixo)),soPbt:m.pbt<=50000}));
}
/* Opções do motor. cabine=true: carregamento "encostado na cabine e gradado até o fundo", como se faz
   na prática, aceitando o peso por eixo até a tolerância legal de 12,5% (Lei 14.229/2021). */
const OPC={cabine:true,manual:false}; /* manual: o usuário arruma a carga; o motor não mexe por causa dos eixos */
function opcoes(o){if(o)Object.assign(OPC,o);return {...OPC}}
/* limite usado pelo sistema ao arrumar. Veículo de até 50 t: a balança confere só o PBT (Res. CONTRAN 882 art. 50 §1º),
   então o sistema não tira volumes por causa de eixo — só avisa no quadro "Peso por eixo". Acima de 50 t: eixo com 12,5%. */
const axLim=a=>a.soPbt?Infinity:(OPC.cabine?a.tolLim:a.lim);
function vehMaxCargo(v){const m=axleModel(v);const tare=m.ax.reduce((s,a)=>s+a.tare,0);let c=m.pbt-tare;if(v.max)c=Math.min(c,v.max);return c}
const vol = v => v.L*v.W*effH(v)*v.wag;

/* ---------- ORIENTAÇÕES (a rotação muda só a orientação; as medidas físicas ficam no produto) ---------- */
function uniqO(o,i,a){return a.findIndex(b=>Math.abs(b.l-o.l)<1e-9&&Math.abs(b.w-o.w)<1e-9&&Math.abs(b.h-o.h)<1e-9&&b.ax===o.ax)===i}
function orientations(p,mode){
 mode = mode||p.pos||'auto';
 if(p.tipo==='bobina'){
  const d=p.l, L=p.h;
  const pe=[{l:d,w:d,h:L,k:'Em pé (eixo vertical)',ax:'v'}];
  const dc={l:L,w:d,h:d,k:'Deitada · eixo no comprimento',ax:'x'}, dl={l:d,w:L,h:d,k:'Deitada · eixo na largura',ax:'z'};
  const o = mode==='pe'?pe : mode==='deit-c'?[dc] : mode==='deit-l'?[dl] : mode==='deitado'?[dc,dl] : [...pe,dc,dl];
  return o.filter(uniqO);
 }
 const {l,w,h}=p;
 const up=[{l,w,h,k:'Em pé · C no comprimento',ax:'v'},{l:w,w:l,h,k:'Em pé · C na largura',ax:'v'}];
 if(p.tipo==='bigbag'){ return (mode==='pe-c'?[up[0]]:mode==='pe-l'?[up[1]]:up).filter(uniqO); }
 const lay = p.tipo==='palete'
  ? [{l:h,w,h:l,k:'Deitado · comprimento',ax:'d'},{l:w,w:h,h:l,k:'Deitado · largura',ax:'d'}]
  : [{l,w:h,h:w,k:'Deitada C×A×L',ax:'d'},{l:h,w:l,h:w,k:'Deitada A×C×L',ax:'d'},{l:w,w:h,h:l,k:'Deitada L×A×C',ax:'d'},{l:h,w,h:l,k:'Deitada A×L×C',ax:'d'}];
 const o = mode==='pe'?up : mode==='pe-c'?[up[0]] : mode==='pe-l'?[up[1]] : mode==='deitado'?lay : [...up,...lay];
 return o.filter(uniqO);
}
/* melhor grade (fileiras × colunas × camadas) de um produto num vagão */
function grid(v0,p,mode){
 const v=effV(v0);
 let best=null;const st=stackOf(p);
 for(const o of orientations(p,mode)){
  const nl=Math.floor(v.L/o.l+1e-9),nw=Math.floor(v.W/o.w+1e-9);let nh=Math.floor(v.H/o.h+1e-9);
  nh=Math.min(nh,st===Infinity?99:Math.floor(st/Math.max(p.kg,0.001)+1e-9)+1,levelsOf(p));
  if(p.tipo==='bobina'&&o.ax!=='v')nh=Math.min(nh,1);
  if(hasCat(p,'pesado'))nh=1;
  const n=nl*nw*nh;
  if(n>0&&(!best||n>best.n||(n===best.n&&nw*nh>best.nw*best.nh)))best={o,nl,nw,nh,n,tot:n*v.wag};
 }return best;
}

/* ---------- VALIDAÇÃO DE POSIÇÃO ---------- */
const ov=(a1,a2,b1,b2)=>a1<b2-EPS&&b1<a2-EPS;
function overlap3(a,b){return ov(a.x,a.x+a.l,b.x,b.x+b.l)&&ov(a.y,a.y+a.w,b.y,b.y+b.w)&&ov(a.z,a.z+a.h,b.z,b.z+b.h)}
function areaOv(a,b){const dx=Math.min(a.x+a.l,b.x+b.l)-Math.max(a.x,b.x),dy=Math.min(a.y+a.w,b.y+b.w)-Math.max(a.y,b.y);return dx>EPS&&dy>EPS?dx*dy:0}
const lyingCoil = it => it.p && it.p.tipo==='bobina' && it.ax && it.ax!=='v';
const vn = n => 'nº '+String(n).padStart(2,'0');
/* c = {L,W,H}; items = já posicionados; b = candidato. Retorna {ok, msg, sup, add, lv} */
function checkPlace(c,items,b,ignore){
 if(b.x<-EPS||b.y<-EPS||b.z<-EPS||b.x+b.l>c.L+EPS||b.y+b.w>c.W+EPS||b.z+b.h>c.H+EPS)return {ok:false,msg:'Fora dos limites internos do veículo'};
 if(b.p){ const allowed=orientations(b.p); if(!allowed.some(o=>Math.abs(o.l-b.l)<1e-6&&Math.abs(o.w-b.w)<1e-6&&Math.abs(o.h-b.h)<1e-6)) return {ok:false,msg:'Orientação não permitida para este produto'}; }
 for(const o of items){if(o===ignore||o.wg!==b.wg)continue;if(overlap3(o,b))return {ok:false,msg:'Sobreposição com o volume '+vn(o.n)}}
 if(b.z<=EPS) return {ok:true,sup:[],add:new Map(),lv:1};
 if(lyingCoil(b)) return {ok:false,msg:'Bobina deitada deve ficar apoiada no assoalho, calçada'};
 if(hasCat(b.p,'pesado')) return {ok:false,msg:'Carga pesada só pode ficar no piso do veículo'};
 let sup=[],tot=0;
 for(const o of items){if(o===ignore||o.wg!==b.wg)continue;if(Math.abs(o.z+o.h-b.z)<1e-4){const a=areaOv(o,b);if(a>0){sup.push({o,a});tot+=a}}}
 const need = b.p&&b.p.tipo==='bigbag' ? 0.9 : 0.75;
 if(tot<b.l*b.w*need-EPS)return {ok:false,msg:`Apoio insuficiente embaixo (mín. ${need*100}% da base)`};
 let lv=1;
 for(const q of sup){const o=q.o;
  if(lyingCoil(o)) return {ok:false,msg:'Não é permitido empilhar sobre bobina deitada (volume '+vn(o.n)+')'};
  if(o.p&&o.p.tipo==='bigbag'&&!(b.p&&b.p.tipo==='bigbag')) return {ok:false,msg:'Sobre big bag só pode ir outro big bag (volume '+vn(o.n)+')'};
  if(hasCat(o.p,'fragil')) return {ok:false,msg:'O volume '+vn(o.n)+' ('+o.nome+') é frágil: nada pode ir em cima'};
  if(o.p&&o.p.stackable===false) return {ok:false,msg:'O volume '+vn(o.n)+' ('+o.nome+') não pode ser empilhado'};
  lv=Math.max(lv,(o.lv||1)+1);
 }
 const lim=Math.min(b.p?levelsOf(b.p):99,...sup.map(q=>q.o.p?levelsOf(q.o.p):99));
 if(lv>lim) return {ok:false,msg:`Limite de ${lim} nível(is) de empilhamento`};
 const add=new Map();
 const push=(o,w)=>{add.set(o,(add.get(o)||0)+w);const ts=(o.sup||[]).reduce((s,q)=>s+q.a,0);for(const q of (o.sup||[]))push(q.o,w*q.a/ts)};
 for(const q of sup)push(q.o,b.kg*q.a/tot);
 for(const [o,w] of add){if(o===ignore)continue;if((o.load||0)+w>o.stack+EPS)return {ok:false,msg:'Excesso de peso sobre o volume '+vn(o.n)+' ('+o.nome+')'}}
 return {ok:true,sup,add,lv};
}
function commit(b,res){b.sup=res.sup;b.lv=res.lv;b.load=b.load||0;for(const [o,w] of res.add)o.load=(o.load||0)+w}
/* recalcula apoios, níveis e cargas; retorna a 1ª violação encontrada (ou null) */
function rebuildLoads(items){
 const s=[...items].sort((a,b)=>a.z-b.z);for(const i of s){i.load=0;i.sup=[];i.lv=1}
 const placed=[];let err=null;
 for(const i of s){const r=checkPlace(i.c,placed,i,null);if(r.ok)commit(i,r);else{if(!err)err={it:i,msg:r.msg}}placed.push(i)}
 return err;
}
function projections(items,c,wg,p,axis){
 let best=0;
 for(const o of items){if(o.wg!==wg)continue;
  if(axis==='x'){if(o.x+o.l<=p.x+EPS&&p.y>=o.y-EPS&&p.y<o.y+o.w-EPS&&p.z>=o.z-EPS&&p.z<o.z+o.h-EPS)best=Math.max(best,o.x+o.l)}
  if(axis==='y'){if(o.y+o.w<=p.y+EPS&&p.x>=o.x-EPS&&p.x<o.x+o.l-EPS&&p.z>=o.z-EPS&&p.z<o.z+o.h-EPS)best=Math.max(best,o.y+o.w)}
  if(axis==='z'){if(o.z+o.h<=p.z+EPS&&p.x>=o.x-EPS&&p.x<o.x+o.l-EPS&&p.y>=o.y-EPS&&p.y<o.y+o.w-EPS)best=Math.max(best,o.z+o.h)}
 }return best;
}
const inside=(items,g,q)=>items.some(o=>o.wg===g&&q.x>=o.x-EPS&&q.x<o.x+o.l-EPS&&q.y>=o.y-EPS&&q.y<o.y+o.w-EPS&&q.z>=o.z-EPS&&q.z<o.z+o.h-EPS);

/* ---------- EMPACOTAMENTO NUM VEÍCULO ---------- */
function mkItem(u,c,wg,x,y,z,o){return {...u,c,wg,x,y,z,l:o.l,w:o.w,h:o.h,ax:o.ax,ok:o.k,load:0,sup:[],lv:1}}
function pack(v0,units){
 const v=effV(v0);
 const c={L:v.L,W:v.W,H:v.H},items=[],left=[];
 const maxKg=vehMaxCargo(v);let kg=0;const m=axleModel(v);
 /* FASE 1 — grade exata por produto: fileiras da frente para a traseira; camada de baixo primeiro */
 const cx=Array(v.wag).fill(0);let wg=0;const rest=[];const vc=new Set();const addC=p=>{for(const k of (p.cats||[]))vc.add(k)};
 const groups=[];for(const u of units){let G=groups.find(q=>q.pid===u.pid);if(!G)groups.push(G={pid:u.pid,p:u.p,us:[]});G.us.push(u)}
 for(const G of groups){
  if(blockReason(v,G.p,vc)){left.push(...G.us);continue}
  const gr=grid(v,G.p);if(!gr){rest.push(...G.us);continue}
  const {o,nw,nh}=gr;const y0=(c.W-nw*o.w)/2;let k=0;
  while(k<G.us.length){
   while(wg<v.wag&&cx[wg]+o.l>c.L+EPS)wg++;
   if(wg>=v.wag)break;
   const x=cx[wg];
   for(let lv=0;lv<nh&&k<G.us.length;lv++)for(let j=0;j<nw&&k<G.us.length;j++){
    const u=G.us[k++];
    if(kg+u.kg>maxKg){left.push(u);continue}
    const b=mkItem(u,c,wg,x,y0+j*o.w,lv*o.h,o);
    const r=checkPlace(c,items,b,null);
    if(r.ok){commit(b,r);items.push(b);kg+=b.kg;addC(u.p)}else rest.push(u);
   }
   cx[wg]=x+o.l;
  }
  rest.push(...G.us.slice(k));
 }
 /* FASE 2 — Extreme Points nos espaços restantes */
 const eps=[];for(let g=0;g<v.wag;g++){const E=[{x:cx[g],y:0,z:0},{x:0,y:0,z:0}];
  for(const b of items.filter(i=>i.wg===g))E.push({x:b.x+b.l,y:b.y,z:b.z},{x:b.x,y:b.y+b.w,z:b.z},{x:b.x,y:b.y,z:b.z+b.h});
  eps.push(E.filter(q=>q.x<c.L-EPS&&q.y<c.W-EPS&&q.z<c.H-EPS&&!inside(items,g,q)))}
 for(const u of rest){
  if(kg+u.kg>maxKg){left.push(u);continue}
  if(blockReason(v,u.p,vc)){left.push(u);continue}
  let best=null;
  for(let g=0;g<v.wag&&!best;g++){
   const cand=[...eps[g]].sort((a,b)=>a.x-b.x||a.z-b.z||a.y-b.y);
   for(const p of cand){
    for(const o of orientations(u.p)){
     const b=mkItem(u,c,g,p.x,p.y,p.z,o);
     const r=checkPlace(c,items,b,null);if(!r.ok)continue;
     const sc=(b.x+b.l)*1000+b.z*10+(c.W-(b.y+b.w))*0.1;
     if(!best||sc<best.sc)best={b,r,sc,p};
    }
    if(best&&best.p===p)break;
   }
  }
  if(!best){left.push(u);continue}
  const b=best.b;commit(b,best.r);items.push(b);addC(u.p);kg+=b.kg;
  const E=eps[b.wg];E.splice(E.indexOf(best.p),1);
  const n=[{x:b.x+b.l,y:b.y,z:b.z},{x:b.x,y:b.y+b.w,z:b.z},{x:b.x,y:b.y,z:b.z+b.h}];
  const np=[...n,
   {x:b.x+b.l,y:projections(items,c,b.wg,n[0],'y'),z:b.z},{x:b.x+b.l,y:b.y,z:projections(items,c,b.wg,n[0],'z')},
   {x:projections(items,c,b.wg,n[1],'x'),y:b.y+b.w,z:b.z},{x:b.x,y:b.y+b.w,z:projections(items,c,b.wg,n[1],'z')},
   {x:projections(items,c,b.wg,n[2],'x'),y:b.y,z:b.z+b.h},{x:b.x,y:projections(items,c,b.wg,n[2],'y'),z:b.z+b.h}];
  for(const q of np){if(q.x<c.L-EPS&&q.y<c.W-EPS&&q.z<c.H-EPS&&!E.some(e=>Math.abs(e.x-q.x)<EPS&&Math.abs(e.y-q.y)<EPS&&Math.abs(e.z-q.z)<EPS)&&!inside(items,b.wg,q))E.push(q)}
 }
 if(!OPC.manual)balanceAxles(v,items);
 /* ajuste final de eixos: retira volumes livres (sem nada em cima) da extremidade sobrecarregada */
 /* excesso nos eixos depois da arrumação: procura o MENOR número de volumes a tirar.
    Testa duas ordens (da frente para o fundo e do fundo para a frente, sempre os de cima primeiro);
    a cada tentativa a carga é arrumada de novo a partir da cabine. Fica com a que tira menos. */
 const excess=()=>axleLoads(v,items).reduce((t,a)=>t+Math.max(0,a.tot-axLim(a)),0);
 if(!OPC.manual&&excess()>1){
  const all=[...items],snap=all.map(o=>[o,o.x]);
  const restore=()=>{items.length=0;items.push(...all);snap.forEach(([o,x])=>o.x=x);rebuildLoads(items)};
  const orders=[[...all].sort((a,b)=>a.x-b.x||b.z-a.z),[...all].sort((a,b)=>(b.x+b.l)-(a.x+a.l)||b.z-a.z)];
  let best=null;
  for(const ord of orders){
   for(let k=1;k<all.length;k++){
    if(best&&k>=best.k)break;
    const rm=new Set(ord.slice(0,k));
    /* não tira um volume que tenha outro em cima que fique */
    if([...rm].some(o=>all.some(q=>!rm.has(q)&&q.sup.some(s2=>s2.o===o))))continue;
    items.length=0;items.push(...all.filter(o=>!rm.has(o)));rebuildLoads(items);balanceAxles(v,items);
    if(excess()<=1){best={k,rm,pos:items.map(o=>[o,o.x])};break}
   }
   restore();
  }
  if(best){items.length=0;items.push(...all.filter(o=>!best.rm.has(o)));best.pos.forEach(([o,x])=>o.x=x);rebuildLoads(items);left.push(...best.rm)}
 }
 /* segurança: se ainda sobrar excesso (casos raros), tira um a um da ponta sobrecarregada */
 for(let guard=0;guard<2000&&!OPC.manual;guard++){
  const al=axleLoads(v,items);const bi=al.findIndex(a=>a.tot>axLim(a)+1);if(bi<0)break;
  const front=(m.type==='rigid'&&bi===0)||(m.type!=='rigid'&&bi<=1)||(m.type==='rodo'&&bi===3);
  const free=items.filter(o=>!items.some(q=>q!==o&&q.sup.some(s=>s.o===o)));
  const pool=m.type==='rodo'?free.filter(o=>o.wg===(bi>=3?1:0)):free;
  const cand=(pool.length?pool:free).sort((a,b)=>front?a.x-b.x:(b.x+b.l)-(a.x+a.l))[0];if(!cand)break;
  items.splice(items.indexOf(cand),1);left.push(cand);rebuildLoads(items);balanceAxles(v,items);rebuildLoads(items);
 }
 items.forEach((it,i)=>it.seq=i);
 return {items,left:left.map(u=>({n:u.n,pid:u.pid,p:u.p,nome:u.nome,cod:u.cod,kg:u.kg,stack:u.stack,pcs:u.pcs}))};
}
/* EQUILÍBRIO DE EIXOS: antes de tirar volumes por excesso de peso num eixo, tenta reposicionar as
   fileiras ao longo do comprimento (deslocar o bloco para trás e/ou abrir espaço entre fileiras).
   Cada fileira (grupo de volumes que se sobrepõem no comprimento, incluindo os empilhados) se move
   inteira, então apoio e empilhamento continuam válidos. Escolhe a posição com menos excesso. */
/* ARRUMAÇÃO AO LONGO DO COMPRIMENTO (regra de carregamento real):
   - toda carga começa encostada na cabine (x = 0) e as fileiras ficam JUNTAS, sem espaço entre elas;
   - se algum eixo passar do limite, o motor tira volumes e arruma de novo (ver pack) — nunca abre vãos. */
const GAPMAX=0, SPREAD=new Set(); /* regra: carga SEMPRE junta, sem espaço entre as fileiras */
function balanceAxles(v,items){
 const AL=()=>axleLoads(v,items);
 const over=()=>AL().reduce((s,a)=>s+Math.max(0,a.tot-axLim(a)),0);
 const worst=()=>Math.max(...AL().map(a=>a.tot/a.lim));
 for(let g=0;g<v.wag;g++){
  const its=items.filter(i=>i.wg===g);if(!its.length)continue;
  const cl=[];for(const it of [...its].sort((a,b)=>a.x-b.x)){const c=cl[cl.length-1];if(c&&it.x<c.x1-EPS){c.x1=Math.max(c.x1,it.x+it.l);c.its.push(it)}else cl.push({x0:it.x,x1:it.x+it.l,its:[it]})}
  for(const c of cl)for(const it of c.its)it._rel=it.x-c.x0;
  const lens=cl.map(c=>c.x1-c.x0),free=Math.max(0,v.L-lens.reduce((a,b)=>a+b,0));
  const n=cl.length,cap=n>1?Math.min(GAPMAX,free/(n-1)):0;
  const spread=!OPC.cabine&&its.every(i=>SPREAD.has(i.p&&i.p.tipo));
  const layout=gap=>{let x=0;return lens.map(l=>{const p=x;x+=l+gap;return p})};
  const apply=pos=>cl.forEach((c,k)=>{for(const it of c.its)it.x=pos[k]+it._rel});
  /* ordem de preferência dos espaçamentos: gradado (máximo) → menor; ou junto (zero) → maior */
  const STEPS=20,gaps=[];for(let k=0;k<=STEPS;k++)gaps.push(cap*(spread?STEPS-k:k)/STEPS);
  let pick=null,best=null;
  for(const gp of gaps){const pos=layout(gp);apply(pos);const o=over();
   if(o<=1){pick=pos;break}
   if(!best||o<best.o-1e-6)best={pos,o};}
  apply(pick||best.pos);its.forEach(i=>delete i._rel);
 }
}
/* gera unidades (volumes) a partir de linhas normalizadas {..spec, q} */
function buildUnits(lines){
 const u=[];let n=1;
 for(const p of lines){for(let i=0;i<p.q;i++)u.push({n:n++,pid:p.id,p,nome:p.nome,cod:p.cod,kg:+p.kg,stack:stackOf(p),pcs:p.pcs})}
 return u;
}
/* plano completo: veículo principal + até 4 extras (containers nunca entram como extra) */
/* sugestão de UM veículo extra para os volumes que sobraram (containers nunca entram como extra) */
function suggestExtra(fleet,left,forceId){
 const road=fleet.filter(v=>v.cat!=='Container').sort((a,b)=>vol(a)-vol(b)||vehMaxCargo(a)-vehMaxCargo(b));
 if(forceId){const v=road.find(x=>x.id===forceId);if(!v)return null;const r=pack(v,left);return r.items.length?{v,r,all:!r.left.length}:null}
 for(const v of road){const r=pack(v,left);if(!r.left.length&&r.items.length)return {v,r,all:true}}
 let b=null;for(const v of road){const r=pack(v,left);if(!b||r.items.length>b.r.items.length)b={v,r}}
 return b&&b.r.items.length?{...b,all:false}:null;
}
/* plano: veículo principal; extras só quando opts.extras !== false (até 4) */
function planLoad(fleet,mainId,lines,opts){
 const units=buildUnits(lines);
 const v0=fleet.find(v=>v.id===mainId)||fleet[0];
 const res=pack(v0,units);const vehs=[{v:v0,items:res.items}];let left=res.left;
 while(!(opts&&opts.extras===false)&&left.length&&vehs.length<5){
  const sg=suggestExtra(fleet,left);if(!sg)break;
  vehs.push({v:sg.v,items:sg.r.items});left=sg.r.left;
 }
 return {vehs,left,total:units.length};
}

/* ---------- ESTATÍSTICAS DE UM VEÍCULO ---------- */
function stats(v,items){
 const kg=items.reduce((s,i)=>s+i.kg,0),cub=items.reduce((s,i)=>s+i.l*i.w*i.h,0);
 const al=axleLoads(v,items),m=axleModel(v),pbt=al.reduce((s,a)=>s+a.tot,0),maxKg=vehMaxCargo(v);
 const wagons=[];for(let g=0;g<v.wag;g++){const its=items.filter(i=>i.wg===g);const end=its.length?Math.max(...its.map(i=>i.x+i.l)):0;
  wagons.push({g,n:its.length,kg:its.reduce((s,i)=>s+i.kg,0),cub:its.reduce((s,i)=>s+i.l*i.w*i.h,0),freeLen:v.L-end,usedLen:end})}
 let cg=null;if(kg>0){let x=0,y=0,z=0;for(const i of items){const off=i.wg*(v.L+0.9);x+=(off+i.x+i.l/2)*i.kg;y+=(i.y+i.w/2)*i.kg;z+=(i.z+i.h/2)*i.kg}cg={x:x/kg,y:y/kg,z:z/kg,lat:y/kg-v.W/2}}
 const byProd={};for(const i of items){const k=i.pid;(byProd[k]=byProd[k]||{p:i.p,n:0,kg:0,pcs:0,cub:0});byProd[k].n++;byProd[k].kg+=i.kg;byProd[k].pcs+=i.pcs;byProd[k].cub+=i.l*i.w*i.h}
 return {kg,cub,vol:vol(v),occ:cub/vol(v),free:vol(v)-cub,maxKg,kgOcc:kg/maxKg,al,pbt,pbtLim:m.pbt,axOk:al.every(a=>a.tot<=a.lim+1)&&pbt<=m.pbt+1,axTol:al.every(a=>a.soPbt||a.tot<=a.tolLim+1)&&pbt<=m.pbt+1,wagons,cg,byProd};
}
/* ---------- VERIFICAÇÃO INDEPENDENTE DE UM PLANO SALVO (usada no servidor) ---------- */
function verifyVehicle(v,items){
 const c={L:v.L,W:v.W,H:effH(v)};
 const its=items.map(i=>({...i,c,stack:stackOf(i.p),kg:+i.p.kg,nome:i.p.nome,pcs:i.p.pcs}));
 for(const i of its){if(!(i.wg>=0&&i.wg<v.wag))return 'Volume '+vn(i.n)+': compartimento inválido'}
 { const vc=new Set(); for(const i of its){const why=blockReason(v,i.p,vc);if(why)return 'Volume '+vn(i.n)+': '+why;for(const k of (i.p.cats||[]))vc.add(k)} }
 const err=rebuildLoads(its);if(err)return 'Volume '+vn(err.it.n)+': '+err.msg;
 const kg=its.reduce((s,i)=>s+i.kg,0);if(kg>vehMaxCargo(v)+1)return 'Peso acima da capacidade do veículo';
 const al=axleLoads(v,its);const bad=al.find(a=>a.tot>axLim(a)+1);if(bad&&!OPC.manual)return 'Excede limite do eixo: '+bad.n;
 return null;
}

const NX={axDisp,multaExcesso,balanca,EPS,MAXKG,ALT_MAX,deckH,effH,effV,PCATS,PROTECT,INCOMPAT,hasCat,BODIES,bodyOptions,bodyOf,blockReason,suggestExtra,AXCFG,axOptions,axcfgOf,FLEET0,CATS,TIPOS,POS,normalize,validateSpec,stackOf,levelsOf,axleModel,axleLoads,vehMaxCargo,vol,orientations,grid,
 overlap3,areaOv,checkPlace,commit,rebuildLoads,balanceAxles,opcoes,axLim,pack,buildUnits,planLoad,stats,verifyVehicle,vn};
if(typeof module==='object'&&module.exports)module.exports=NX;else{root.NX=NX;for(const k in NX)if(!(k in root))root[k]=NX[k]}
})(typeof window!=='undefined'?window:globalThis);
