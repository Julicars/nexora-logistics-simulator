<div align="center">

<img src="public/shared/img/logo-nav.png" alt="NEXORA Logistics Intelligence" width="360">

### Simulador 3D de carregamento de caminhões

*Sua logística. Sob controle.*

[![Node](https://img.shields.io/badge/Node.js-%3E%3D16-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Three.js](https://img.shields.io/badge/Three.js-0.147-000000?logo=three.js&logoColor=white)](https://threejs.org)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-uso%20e%20melhoria-f5a033)](LICENSE)
[![Idiomas](https://img.shields.io/badge/idiomas-PT--BR%20%7C%20EN%20%7C%20ES%20%7C%20FR-0b1a3a)](#)

**[Português](README.md)** · **[English](README.en.md)**

</div>

---

## Sobre

O **NEXORA Logistics Intelligence** é um simulador que mostra, em 3D, como carregar um caminhão antes de ele sair do pátio. Ele calcula a cubagem aproveitada, o peso total e o **peso em cada eixo**, e indica a ordem de descarga por parada.

Os volumes são posicionados pela heurística **Extreme Points** (Crainic, Perboli & Tadei, 2008), que evita sobreposição, respeita a capacidade de carga de cada caixa e o limite de cada eixo.

<div align="center">

<img src="docs/simulador.png" alt="Simulador 3D com carreta de 15,4 m carregada com 26 paletes" width="860">

</div>

## Principais recursos

- **Cena 3D interativa** — girar, aproximar, vistas predefinidas (3D, topo, lado, traseira, frente) e animação do carregamento com velocidade ajustável.
- **Cálculo de carga** — cubagem, peso bruto, peso por eixo (trator, carreta, rodotrem) e comparação com os limites legais.
- **Edição do carregamento** — arraste ou use as setas do teclado para mover um volume, inclusive **entre vagões** no rodotrem; o sistema impede sobreposição e excesso de peso em cima.
- **Orientação do volume** — botão *Orientação* (tecla `O`) com as posições possíveis: palete em pé ou deitado, no comprimento ou na largura; caixa em todas as 6 rotações. Também há *Girar 90°* (`R`) e *Deitar* (`D`).
- **Desfazer (Ctrl+Z)** — histórico de 10 passos para mover, girar, deitar e mudar a orientação.
- **Etiqueta 3D flutuante** — o volume selecionado mostra uma etiqueta acima dele com produto, código, nº, vagão, medidas e peso (também sai na impressão).
- **Veículos extras automáticos** — se a carga não couber, o sistema escolhe na frota o menor veículo que leva o restante (até 4) e mostra cada um ao lado, já carregado. Clique em um extra para torná-lo o veículo ativo e editar a carga dele, abrir as portas e desfazer.
- **Pedidos** — cadastre produtos com medidas, peças por volume, peso e capacidade de empilhamento; filtro rápido por nome ou código na lista e na tabela de edição.
- **Ordem de descarga** — lista de volumes na ordem em que devem sair, por vagão.
- **Cenários salvos** — guarde combinações com nome e compare lado a lado (ex.: carreta 15,4 m contra rodotrem).
- **Exportar** — impressão A4 com imagem do caminhão carregado, resumo e produtos, ou planilha CSV (abre no Excel com acentos corretos).
- **Acessível** — modos de cor para daltonismo (deuteranopia/protanopia, tritanopia e alto contraste), número do produto nas listas, navegação por teclado, avisos para leitores de tela e mensagens de erro claras.
- **Responsivo** — layout para celular (em pé e deitado), tablet, desktop e TV, incluindo o site (menu hambúrguer no celular).
- **Site institucional animado** — Home com contadores e letreiro de veículos, Sobre com linha do tempo e princípios, Contato com perguntas frequentes.
- **4 idiomas** — PT-BR, EN, ES e FR, com seletor no cabeçalho.
- **Sem dependências de instalação** — o Three.js já vem incluído no projeto; roda só com Node.js.

<div align="center">

<img src="docs/home.png" alt="Página inicial do NEXORA" width="860">

<img src="docs/home-animacao.gif" alt="Animação dos paletes entrando no baú" width="520">

</div>

## Como rodar

Requisito: **Node.js 16 ou superior**.

```bash
git clone <url-do-repositorio>
cd simulador-3d
npm start
```

Abra **http://localhost:3000** no navegador.

Para usar outra porta: `PORT=3100 npm start`.

## Testes

```bash
npm test                # consistência do empacotamento: limites do baú, sem sobreposição, pedido padrão
npm run test:seguranca  # verificações de segurança do servidor (cabeçalhos, rotas, validação, limite de taxa)
```

## Estrutura do projeto

```
server.js                    servidor HTTP e rota POST /api/simular
public/
  home/                      página inicial, Sobre e Contato
  cubagem/                   o simulador
    js/data.js               veículos (medidas reais) e pedido padrão
    js/packer.js             algoritmo Extreme Points (navegador e Node)
    js/eixos.js              eixos, tara, limites e peso por eixo
    js/veiculos3d.js         modelos 3D dos veículos e portas
    js/app/nucleo.js         estado, utilitários, persistência e avisos
    js/app/cena.js           cena Three.js e veículos
    js/app/camera.js         câmera, animação e redimensionamento
    js/app/edicao.js         seleção, arraste, teclado e validações
    js/app/resultados.js     simulação e painéis de resultado
    js/app/modais.js         pedidos, configurações e frota
    js/app/exportar.js       impressão A4 e CSV
    js/app/descarga.js       ordem de descarga
    js/app/cenarios.js       cenários salvos e comparação
    js/app/extras.js         desfazer, filtro, etiqueta 3D, orientação e veículos extras
    js/app/cores.js          modos de cor para daltonismo
  shared/                    paleta, idiomas (i18n.js), barra de navegação e vendor (Three.js local)
test/                        testes de empacotamento e de segurança
docs/                        imagens usadas neste README
```

## Como funciona o cálculo

1. O pedido é transformado em volumes com medidas, peso e capacidade de empilhamento.
2. O algoritmo Extreme Points testa os pontos de encaixe no baú e escolhe a posição que aproveita melhor o espaço, sem sobreposição e respeitando o peso máximo sobre cada caixa.
3. Os pesos são distribuídos pela posição dos volumes e comparados aos limites de cada eixo.
4. A ordem de descarga considera o vagão e a distância de cada volume até a porta.

## Segurança

- Cabeçalhos HTTP com **Content-Security-Policy** restrita, `X-Frame-Options: DENY` e `nosniff`.
- Arquivos estáticos servidos somente de dentro de `public/`, com proteção contra travessia de diretório.
- Entrada da API validada com limites de tamanho, tipo e faixa; limite de requisições por IP.
- Dados salvos no navegador (frota e cenários) são revalidados antes de uso.

## Acessibilidade

- Controles de vista e ferramentas com foco visível e rótulos.
- Com um volume selecionado, as setas do teclado movem o item (com Shift, passo maior).
- Mensagens de erro e de estado são anunciadas para leitores de tela.
- **Configurações → Acessibilidade**: modos de cor *Deuteranopia / Protanopia* (paleta Okabe-Ito), *Tritanopia* e *Alto contraste*. Os avisos deixam de depender de verde × vermelho e as barras de eixo ganham listras quando estão na tolerância ou acima do limite.
- Opção de mostrar o número do produto nas listas e na etiqueta 3D, para não depender só da cor.
- A escolha fica salva no navegador; o site respeita a preferência de *movimento reduzido* do sistema.

## Roadmap

- Exportação em PDF nativo (sem depender da impressão do navegador)
- Pesquisa por parada de entrega na ordem de descarga
- Mover volumes entre o veículo principal e os veículos extras
- Testes automatizados de interface (Playwright) no CI

## Licença

Este projeto é **source-available**: qualquer pessoa pode usar, estudar, melhorar e compartilhar versões modificadas, desde que mantenha a licença e o aviso de autoria. **Uso comercial exige autorização prévia por escrito.** Veja [LICENSE](LICENSE).

---

<div align="center">

Desenvolvido por **Julio Cézar de Paula Baldo** · [LinkedIn](https://www.linkedin.com/in/julio-c%C3%A9zar-de-paula-baldo-51774321a/) · [GitHub](https://github.com/Julicars)

</div>
