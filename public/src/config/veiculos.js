/* NEXORA — configuração: veículos (frota oficial, carga máxima, altura)
 * Arquivo de dados. Altere aqui (e não no motor) para ajustar a frota, limites e categorias. */
(function (root) {
'use strict';
/* Carga máx. (kg): capacidade típica de mercado (carreta LS ≈ 32 t; rodotrem 9 eixos ≈ 50 t; truck ≈ 14 t;
 * 3/4 ≈ 4,5 t; furgão 3,5 t ≈ 1,5 t; Daily 35-160 baú ≈ 1,05 t) e payload máximo dos containers (DHL).
 * O cálculo usa sempre o MENOR valor entre esta carga máxima e o limite legal por eixo/PBT. */
const MAXKG = { 'Carreta 15.4m':32000, 'Carreta 14.6m':32000, 'Rodo-Trem 12.50m':50000, 'Truck 10.4m':14000, 'Truck 9.7m':14000, 'Truck 8.5m':14000,
 '3/4 5.5m':4500, 'VAN 3.1m':1500, 'IVECO BAU 3.9m':1050, "Container 45' HC":26500, "Container 40' HC":26330, "Container 20' DC":28230 };
const FROTA = [
 ['Carreta 15.4m','Carreta',15.4,2.5,2.7,1],['Carreta 14.6m','Carreta',14.6,2.5,2.7,1],['Rodo-Trem 12.50m','Rodotrem',12.5,2.5,2.7,2],
 ['Truck 10.4m','Truck',10.4,2.4,2.66,1],['Truck 9.7m','Truck',9.7,2.4,2.66,1],['Truck 8.5m','Truck',8.5,2.4,2.66,1],
 ['3/4 5.5m','3/4',5.5,2.4,2.4,1],['VAN 3.1m','Van',3.1,1.8,1.9,1],['IVECO BAU 3.9m','Iveco baú',3.9,2.1,2.1,1],
 ["Container 45' HC",'Container',13.5,2.33,2.58,1],["Container 40' HC",'Container',12,2.33,2.58,1],["Container 20' DC",'Container',5.88,2.33,2.26,1]
]; /* nome, categoria, comprimento, largura, altura internos (m), vagões */
/* altura do assoalho ao chão (m) e limite legal de altura do veículo com carga (Res. CONTRAN 882/2021: 4,40 m) */
const ALT_MAX = 4.40;
const ASSOALHO = { 'Van':0.55, 'Iveco baú':0.95, '3/4':1.05, 'Truck':1.2, 'Container':1.42, padrao:1.25 }; /* altura do assoalho ao chão (m) */
const CFG = { MAXKG, FROTA, ALT_MAX, ASSOALHO };
if (typeof module === 'object' && module.exports) module.exports = CFG;
else root.NX_CONFIG = Object.assign(root.NX_CONFIG || {}, CFG);
})(typeof self !== 'undefined' ? self : this);
