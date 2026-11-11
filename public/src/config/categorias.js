/* NEXORA — configuração: categorias de manuseio/risco e carrocerias
 * Arquivo de dados. Altere aqui (e não no motor) para ajustar a frota, limites e categorias. */
(function (root) {
'use strict';
/* ---------- CATEGORIAS DE MANUSEIO / RISCO ---------- */
const PCATS = {
 explosivo:{nome:'Explosivo',ic:'💥',cor:'#ff5d5d',desc:'Classe 1: não viaja com inflamáveis, corrosivos, tóxicos nem alimentos.'},
 inflamavel:{nome:'Inflamável',ic:'🔥',cor:'#ff8a3d',desc:'Não viaja com explosivos.'},
 corrosivo:{nome:'Corrosivo',ic:'🧪',cor:'#c084fc',desc:'Não viaja com explosivos nem com alimentos/perecíveis.'},
 toxico:{nome:'Tóxico',ic:'☠️',cor:'#a3e635',desc:'Não viaja com explosivos nem com alimentos/perecíveis.'},
 fragil:{nome:'Frágil',ic:'🍷',cor:'#5cb4ff',desc:'Nada pode ser colocado em cima.'},
 pesado:{nome:'Carga pesada',ic:'🏋️',cor:'#cbd5e1',desc:'Só no piso do veículo.'},
 perecivel:{nome:'Perecível',ic:'❄️',cor:'#7dd3fc',desc:'Precisa de carroceria fechada (baú ou sider).'},
 alimenticio:{nome:'Alimentício',ic:'🍎',cor:'#32c48d',desc:'Carroceria fechada; não viaja com tóxicos, corrosivos ou explosivos.'},
 'nao-molhar':{nome:'Não molhar',ic:'☂️',cor:'#93c5fd',desc:'Não vai em carroceria aberta.'}
};
const PROTECT=['perecivel','alimenticio','nao-molhar'];
const INCOMPAT=[['explosivo','inflamavel'],['explosivo','corrosivo'],['explosivo','toxico'],['explosivo','alimenticio'],['explosivo','perecivel'],['toxico','alimenticio'],['toxico','perecivel'],['corrosivo','alimenticio'],['corrosivo','perecivel']];
/* carrocerias */
const BODIES={bau:'Baú',sider:'Sider',aberta:'Aberta (grade)'};
const CFG = { PCATS, PROTECT, INCOMPAT, BODIES };
if (typeof module === 'object' && module.exports) module.exports = CFG;
else root.NX_CONFIG = Object.assign(root.NX_CONFIG || {}, CFG);
})(typeof self !== 'undefined' ? self : this);
