# NEXORA Logistics Intelligence

Simulador de **montagem de carga em 3D** para transporte rodoviário. Calcula quantos volumes cabem em cada veículo, respeita empilhamento, peso por eixo e regras de manuseio, monta a carga **por destino** com roteirização, calcula o **piso mínimo de frete da ANTT** e tem um **fórum** para a equipe.

Feito só com **HTML, CSS, JavaScript e Node.js** — sem frameworks, sem banco de dados e sem login.

![Montagem Rápida em 3D](docs/img/05-montagem-rapida-3d.png)

---

## Sumário

1. [Como rodar](#como-rodar)
2. [Telas](#telas)
3. [Funcionalidades](#funcionalidades)
4. [Roteirização e frete mínimo ANTT](#roteirização-e-frete-mínimo-antt)
5. [Fórum](#fórum)
6. [Atalhos de teclado](#atalhos-de-teclado)
7. [Acessibilidade e responsividade](#acessibilidade-e-responsividade)
8. [Estrutura de pastas](#estrutura-de-pastas)
9. [Configuração](#configuração)
10. [Testes](#testes)
11. [Regras e fontes](#regras-e-fontes)
12. [Limitações conhecidas](#limitações-conhecidas)

---

## Como rodar

**Requisito:** Node.js 18 ou mais novo (só para o servidor e os testes).

```bash
npm start                # abre em http://localhost:3000
```

Defina a senha do administrador do fórum (opcional, mas recomendado):

| Sistema | Comando |
|---|---|
| Linux / macOS | `NEXORA_ADMIN_SENHA=suaSenha npm start` |
| Windows (PowerShell) | `$env:NEXORA_ADMIN_SENHA="suaSenha"; npm start` |
| Windows (CMD) | `set NEXORA_ADMIN_SENHA=suaSenha && npm start` |

Sem a variável, uma senha aleatória é gerada e mostrada no terminal a cada início.

**Sem instalar nada:** abra `public/index.html` direto no navegador. Tudo funciona, menos o fórum compartilhado (ele entra em modo local) e o mapa com ruas (aparece o mapa próprio do Brasil).

| Variável | Para que serve | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `NEXORA_ADMIN_SENHA` | Senha do administrador do fórum | gerada a cada início |
| `NEXORA_DADOS` | Pasta onde o fórum grava `forum.json` | `./data` |

---

## Telas

| | |
|---|---|
| ![Home](docs/img/01-home.png) **Home** — visão geral, frota e atalhos | ![Produtos](docs/img/02-produtos.png) **Produtos** — cadastro com foto, medidas, peso e categorias de manuseio |
| ![Veículos](docs/img/03-veiculos.png) **Veículos** — frota, configuração de eixos e carroceria | ![Catálogo](docs/img/04-catalogo.png) **Mostrar Catálogo** — monte o pedido com produtos cadastrados |
| ![Resultado](docs/img/06-resultado-eixos.png) **Resultado** — ocupação, peso por eixo e centro de gravidade | ![Editor](docs/img/07-editor-carga.png) **Editor de carga** — modo Simples ou Completo |
| ![Rota](docs/img/08-roteirizacao-rota.png) **Roteirização · 1 Rota** — remetente, entregas e mapa | ![Frete](docs/img/09-roteirizacao-frete.png) **Roteirização · 3 Frete** — piso ANTT, adicionais e total |
| ![Concluir](docs/img/10-roteirizacao-concluir.png) **Roteirização · 4 Concluir** — resumo e o que sai em cada entrega | ![Fórum](docs/img/11-forum.png) **Fórum** — ANTT, CIOT, frete mínimo, vale-pedágio… |
| ![Configurações](docs/img/12-configuracoes.png) **Configurações** — tamanho do texto, cores, movimento | ![Celular](docs/img/13-celular-roteirizacao.png) **No celular** |

---

## Funcionalidades

### Três formas de montar a carga
| Modo | Para quê | Guarda no cadastro? |
|---|---|---|
| **Mostrar Catálogo** | Pedido com produtos já cadastrados | Usa o cadastro |
| **Montagem Rápida** | Simulação rápida digitando medidas e pesos (sem cotação) | Não |
| **Roteirização** | Carga com várias entregas, em passo a passo (Rota → Carga → Frete → Concluir) | Não |

Cada modo tem a sua sessão: o que você faz em um não altera os outros.

### Motor de cálculo
- **Encaixe:** grade exata por produto (fileiras × colunas × camadas) e depois *Extreme Points* para aproveitar os espaços que sobram.
- **Empilhamento:** níveis máximos, peso que aguenta em cima e "não empilha".
- **Peso por eixo:** limites da Resolução CONTRAN 882/2021 para cada configuração; o sistema tira volumes da ponta sobrecarregada se precisar.
- **Categorias de manuseio:** frágil, carga pesada, perecível, alimentício, não molhar, explosivo, inflamável, corrosivo e tóxico, com regras de incompatibilidade (veja [Regras e fontes](#regras-e-fontes)).
- **Veículos extras:** quando a carga não cabe, o sistema **pergunta antes** de adicionar cada veículo, sugere o menor que leva o restante e explica o motivo. Containers nunca entram como extra.

### 3D
- Vistas 3D, topo, lado, traseira, frente e interior; portas, paredes transparentes e espaços vazios.
- Animação de carregamento e descarregamento, com velocidade ajustável.
- Selecionar, mover, girar, deitar e trocar a orientação de volumes, com desfazer e refazer. O motor confere cada movimento (colisão, apoio, empilhamento e eixos).
- Etiqueta do volume com medidas, peso, posição e, na Roteirização, **remetente e destino**.

### Saídas
- Relatório A4 da montagem, cotação A4 (Catálogo e Roteirização) e planilha CSV.
- Montagens salvas no navegador, com comparação lado a lado.

---

## Roteirização e frete mínimo ANTT

**Passo a passo:**

1. **Rota:** remetente, cidade de origem e entregas (destinatário e cidade). A busca de cidades usa a base do IBGE (5.570 municípios), que já vem no sistema e funciona sem internet. O botão *Sugerir melhor ordem* calcula a sequência de menor distância (vizinho mais próximo + 2-opt), e você ajusta com ↑ ↓.
2. **Carga:** veículo e itens, cada um com a sua entrega. O carregamento é feito **pelo inverso da entrega**: a última entrega vai perto da cabine e a primeira fica junto às portas.
3. **Frete:** piso ANTT, valores adicionais (chapa, ajudante, pernoite, descarga paletizada, agendamento, seguro, escolta ou outro) e o **total mínimo da viagem**. O botão *Levar para a Cotação* preenche a cotação.
4. **Concluir:** resumo, o que sai em cada entrega, aviso se algum volume ficou bloqueado por carga de entrega posterior, e acesso ao resultado, plano, cotação e salvar.

**Mapa e quilometragem:** com internet, usa OpenStreetMap (Leaflet) e a rota real do OSRM. Sem internet, mostra um mapa próprio do Brasil e a distância **estimada** (linha reta × 1,25), sempre identificada como estimativa. **Pedágios não são calculados.**

**Piso mínimo:** `Piso = km × CCD + CC`, pela **Tabela A (carga lotação)** da Resolução ANTT 6.084/2026 com a **Portaria SUROC nº 22/2026** (vigente desde 30/09/2026), com os 12 tipos de carga e de 2 a 9 eixos.
- O número de eixos vem **automático do veículo** escolhido na Carga (configuração de eixos da frota).
- **Vans e furgões até 3,5 t** (veículo de carga de pequeno porte, Lei 15.485/2026) não entram na tabela por eixos: o sistema avisa e não calcula piso.
- Quando a ANTT publicar uma nova tabela, troque só os números de `public/src/config/antt.js`.
- Confira sempre na [calculadora oficial da ANTT](https://calculadorafrete.antt.gov.br/) antes de fechar um frete.

---

## Fórum

Categorias: **ANTT, CIOT, Frete Mínimo, Vale-Pedágio, Legislação, Transporte e Logística e Comunicados**.

- **Quem publica:** só o administrador cria, fixa e apaga tópicos (e apaga respostas). Qualquer pessoa responde informando um nome ou apelido, sem cadastro.
- **Onde fica:** em `data/forum.json` (sem banco de dados). Faça backup desse arquivo.
- **Proteções:** limite de mensagens por minuto, limite de tentativas de senha, sessão do administrador de 8 horas e textos sem HTML (links viram links seguros).
- **Sem servidor:** modo local, salvo só no navegador, com aviso na tela.

| Rota da API | Método | Quem |
|---|---|---|
| `/api/forum` | GET | todos |
| `/api/forum/login` · `/logout` | POST | administrador |
| `/api/forum/topics` | POST | administrador |
| `/api/forum/topics/:id` | DELETE | administrador |
| `/api/forum/topics/:id/replies` | POST | todos |
| `/api/forum/topics/:id/replies/:rid` | DELETE | administrador |

---

## Atalhos de teclado

Clique no 3D (ou selecione um volume na lista) para o teclado ir para a cena.

| Tecla | Ação |
|---|---|
| Setas | Move o volume (Shift = passo maior) |
| R | Gira 90° |
| D | Deita |
| O | Próxima orientação |
| Ctrl + Z / Ctrl + Y | Desfaz / refaz |
| Esc | Tira a seleção |
| [ e ] | Recolhe o menu / o painel |

As teclas funcionam mesmo durante a animação (ela é encerrada).

---

## Acessibilidade e responsividade

- Auditoria automática **axe-core (WCAG 2 A/AA)** em todas as telas: nenhuma falha crítica, grave ou moderada.
- Lista de volumes navegável por teclado, com descrição falada da posição de cada volume; o 3D tem texto de ajuda para leitores de tela.
- Janelas com foco preso, Esc fecha e o foco volta para quem abriu.
- Erros de formulário ligados ao campo, com foco no primeiro campo com problema.
- Alvos de toque de 44 px em telas de toque, textos com no mínimo 12 px e contraste revisado.
- Configurações: tamanho do texto, menos movimento, foco reforçado e modos de cor para daltonismo e alto contraste.
- Verificado em 9 tamanhos de tela, sem nada cortado ou saindo para os lados: iPhone SE, iPhone 14, Galaxy Fold, Pixel, iPad Mini (em pé e deitado), notebook, desktop Full HD e celular deitado. No celular, o editor de carga vira cartões.

---

## Estrutura de pastas

```
nexora/
├─ README.md                 este arquivo
├─ CHANGELOG.md              histórico de versões
├─ package.json              npm start · npm test
├─ server/
│  ├─ index.js               servidor HTTP (arquivos estáticos + API do fórum)
│  └─ forum.js               fórum: regras, senha, limites, gravação em JSON
├─ test/
│  ├─ engine.test.js         testes do motor de cálculo
│  └─ forum.test.js          testes da API do fórum
├─ docs/img/                 capturas de tela usadas neste README
├─ data/                     criada ao rodar: forum.json (fora do controle de versão)
└─ public/
   ├─ index.html             casca: menu lateral e área das páginas
   └─ src/
      ├─ config/             o que você ajusta sem mexer no código
      │  ├─ veiculos.js        frota, carga máxima, altura legal, assoalho
      │  ├─ categorias.js      categorias de manuseio/risco e carrocerias
      │  └─ antt.js            tabela de piso mínimo (Tabela A)
      ├─ data/
      │  ├─ municipios.js      5.570 municípios do IBGE (nome, UF, coordenadas)
      │  └─ brasil.js          contorno dos estados (mapa offline)
      ├─ css/
      │  ├─ base.css           cores, tipografia, componentes
      │  ├─ layout.css         expedição, janelas, painéis
      │  ├─ pages.css          Home
      │  └─ responsive.css     telas, acessibilidade, roteirização e fórum
      ├─ js/
      │  ├─ core/              engine.js (motor) · storage.js (navegador)
      │  ├─ 3d/                scene.js (Three.js)
      │  ├─ app/               app.js (telas) · rota.js (roteirização) · forum.js · a11y.js
      │  └─ pages/             uma página por arquivo (HTML montado em JS)
      ├─ img/                  logo e ícone
      └─ vendor/leaflet/       mapa OpenStreetMap (licença BSD-2)
```

---

## Configuração

| Arquivo | O que muda |
|---|---|
| `public/src/config/veiculos.js` | Frota padrão, carga máxima por veículo, altura legal (4,40 m), altura do assoalho |
| `public/src/config/categorias.js` | Categorias de manuseio, incompatibilidades e carrocerias |
| `public/src/config/antt.js` | Coeficientes CCD e CC da tabela de piso mínimo |

O motor lê esses arquivos tanto no navegador quanto nos testes.

---

## Testes

```bash
npm test
```

São 23 testes: o motor (encaixe, empilhamento, eixos, categorias, extras e verificação de montagem salva) e a API do fórum (permissões, senha, respostas e gravação).

---

## Regras e fontes

**Configurações de eixos (CONTRAN 882/2021)**

| Configuração | Limites por eixo | PBT/PBTC |
|---|---|---|
| Toco | 6 + 10 t | 16 t |
| Trucado | 6 + 17 t | 23 t |
| Cavalo toco + carreta LS | 6 + 10 + 25,5 t | 41,5 t |
| Cavalo trucado + carreta LS | 6 + 17 + 25,5 t | 48,5 t |
| Cavalo toco + vanderléia | 6 + 10 + 10 + 10 + 10 t | 46 t |
| Romeu e Julieta trucado | 6 + 17 + 10 + 10 t | 43 t |
| Rodotrem 9 eixos | 6 + 17 + 17 + 17 + 17 t | 74 t |

**Carroceria aberta:** a altura útil é 4,40 m (altura máxima legal) menos a altura do assoalho.

**Categorias de manuseio**

| Categoria | Regra no cálculo |
|---|---|
| Frágil | Nada vai em cima |
| Carga pesada | Só no piso |
| Perecível, Alimentício, Não molhar | Não vão em carroceria aberta |
| Explosivo | Não viaja com inflamável, corrosivo, tóxico, alimentício ou perecível |
| Tóxico, Corrosivo | Não viajam com alimentício ou perecível |
| Inflamável | Não viaja com explosivo |

Essas regras são uma simplificação. Para produtos perigosos, confira sempre a regulamentação da ANTT, a ficha de emergência e a compatibilidade do produto.

**Dados de terceiros:** municípios do IBGE via [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros) (MIT) · contorno dos estados via [click_that_hood](https://github.com/codeforgermany/click_that_hood) · mapa [Leaflet](https://leafletjs.com) (BSD-2) e © colaboradores do OpenStreetMap · rotas [OSRM](https://project-osrm.org) · 3D [Three.js](https://threejs.org) r128 (MIT).

---

## Limitações conhecidas

- Produtos, frota e montagens ficam **no navegador** de quem usa: limpar os dados do navegador apaga tudo. Exporte em CSV ou PDF o que for importante.
- Sem internet, a distância é estimada e o piso também; os pedágios não são calculados.
- O piso considera só a Tabela A (carga lotação), sem retorno vazio.
- O fórum compartilhado precisa do servidor (`npm start`).
