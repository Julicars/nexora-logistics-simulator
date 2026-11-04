/*
 * Veículos: medidas internas úteis em metros.
 * c = comprimento de cada vagão, l = largura, h = altura, vagoes = nº de compartimentos.
 * cargaKg é opcional: sem ele, o simulador não limita peso (dá para informar na tela).
 */
(function (root) {
  const veiculosDB = {
    carreta: [
      { nome: 'Carreta 15.4m', c: 15.40, l: 2.50, h: 2.70, vagoes: 1 },
      { nome: 'Carreta 14.6m', c: 14.60, l: 2.50, h: 2.70, vagoes: 1 },
    ],
    rodotrem: [
      { nome: 'Rodo-Trem 12.50m', c: 12.50, l: 2.50, h: 2.70, vagoes: 2 },
    ],
    truck: [
      { nome: 'Truck 10.4m', c: 10.40, l: 2.40, h: 2.66, vagoes: 1 },
      { nome: 'Truck 9.7m', c: 9.70, l: 2.40, h: 2.66, vagoes: 1 },
      { nome: 'Truck 8.5m', c: 8.50, l: 2.40, h: 2.66, vagoes: 1 },
    ],
    tres_quarto: [
      { nome: '3/4 5.5m', c: 5.5, l: 2.40, h: 2.40, vagoes: 1 },
    ],
    outros: [
      { nome: 'VAN 3.1m', c: 3.10, l: 1.80, h: 1.90, vagoes: 1 },
      { nome: 'IVECO BAU 3.9m', c: 3.90, l: 2.10, h: 2.10, vagoes: 1 },
    ],
    container: [
      { nome: "Container 45' HC", c: 13.50, l: 2.33, h: 2.58, vagoes: 1 },
      { nome: "Container 40' HC", c: 12.00, l: 2.33, h: 2.58, vagoes: 1 },
      { nome: "Container 20' DC", c: 5.88, l: 2.33, h: 2.26, vagoes: 1 },
    ],
  };

  const CATEGORIAS = {
    carreta: 'Carreta',
    rodotrem: 'Rodotrem',
    truck: 'Truck',
    tres_quarto: '3/4',
    outros: 'Van e baú leve',
    container: 'Container',
  };

  // Lista plana usada pela tela; cada veículo leva a sua categoria.
  const VEICULOS = [];
  Object.keys(veiculosDB).forEach((cat) => veiculosDB[cat].forEach((v) => VEICULOS.push(Object.assign({ categoria: cat }, v))));

  /* Pedido pré-definido. Medidas em metros.
   * tipo: 'caixa' (volume solto) ou 'palete' (volume com várias peças).
   * pecas: peças por volume; pesoPeca: kg de cada peça; peso: kg do volume (= pecas × pesoPeca).
   * maxEmCima: kg que o volume aguenta em cima (vazio = sem limite, 0 = não empilha).
   * orientacao: 'auto' | 'comprimento' | 'largura' | 'deitado' | 'livre' (ver packer.js) */
  // 26 paletes 1,20 × 1,10 × 1,90 m, 42 peças de 9 kg cada (378 kg por palete, 1.092 peças, 9.828 kg)
  const PEDIDOS_DEMO = [
    { codigo: 'PED-001', nome: 'Palete 1,20 × 1,10', tipo: 'palete', c: 1.20, l: 1.10, h: 1.90, qtd: 26, pecas: 42, pesoPeca: 9, peso: 42 * 9, orientacao: 'auto', maxEmCima: 0 },
  ];

  root.veiculosDB = veiculosDB;
  root.CATEGORIAS = CATEGORIAS;
  root.VEICULOS = VEICULOS;
  root.PEDIDOS_DEMO = PEDIDOS_DEMO;
  if (typeof module === 'object' && module.exports) module.exports = { veiculosDB, CATEGORIAS, VEICULOS, PEDIDOS_DEMO };
})(typeof self !== 'undefined' ? self : this);
