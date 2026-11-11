# Changelog

Todas as mudanças relevantes do NEXORA. Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [3.0.0] — 2026-11-11 · v17

### Corrigido
- Passo **Concluir** da Roteirização: os botões *Plano de carga* e *Salvar / exportar* saíam do painel. Agora ficam em uma coluna e quebram o texto.
- Cadastro de produtos: os chips de **categoria de manuseio** ficavam desalinhados (caixa de marcação grande e texto quebrado, como em "Carga pesada").
- Aba **Cotação** saía do painel lateral em notebooks e desktops.
- Seletor de veículo do **Catálogo** cortado em celulares pequenos (iPhone SE, Galaxy Fold).
- Campo de filtro do editor de carga passava da tela no Galaxy Fold.
- Valor do total mínimo quebrava no meio do número.
- Moldura laranja aparecia no título ao trocar de passo.

### Alterado
- **Montagem Rápida sem cotação:** a aba Cotação e a cotação no relatório foram retiradas desse modo (continuam no Catálogo e na Roteirização).
- **Pastas reorganizadas:** servidor em `server/` (`index.js` e `forum.js`), páginas em `public/src/js/pages/`, imagens da documentação em `docs/img/`.
- `LEIAME.md` substituído por este `README.md` completo, com capturas de tela, e por este `CHANGELOG.md`.

### Verificado
- Responsividade em 9 tamanhos de tela, agora checando também o painel lateral e os cartões por dentro.
- Acessibilidade (axe-core, WCAG 2 A/AA) em todas as telas, incluindo falhas moderadas: nenhuma.

## [2.6.0] — v16 · Fórum
### Adicionado
- **Fórum** (Comunidade › Fórum) com as categorias ANTT, CIOT, Frete Mínimo, Vale-Pedágio, Legislação, Transporte e Logística e Comunicados.
- Só o administrador (senha em `NEXORA_ADMIN_SENHA`) cria, fixa e apaga tópicos; qualquer pessoa responde com nome ou apelido.
- Gravação em `data/forum.json`, sem banco de dados; modo local quando não há servidor.
- Limite de mensagens por minuto, limite de tentativas de senha e textos sem HTML.
- 4 testes da API do fórum.

## [2.5.0] — v15 · Roteirização em passo a passo
### Alterado
- A Roteirização virou um passo a passo: **1 Rota → 2 Carga → 3 Frete → 4 Concluir**, com validação em cada etapa e ✓ nos passos concluídos.
- Novo passo **Concluir** com o resumo da viagem e o acesso ao resultado, plano, cotação e salvar.

## [2.4.0] — v14 · Eixos ligados ao veículo e Carga simplificada
### Alterado
- Os eixos do piso ANTT vêm **automático do veículo** escolhido; vans e furgões até 3,5 t (pequeno porte, Lei 15.485/2026) não usam a tabela por eixos.
- Trocar o veículo monta a carga de novo.
- Aba **Pedido** virou **Carga**, em 3 passos (Veículo, O que vai carregar, Montar).
- Editor de carga com modo **Simples** (só o essencial) e **Completo**.

## [2.3.0] — v13 · Responsivo
### Alterado
- Editor de carga em **cartões** no celular.
- A Roteirização abre direto na aba Rota.
- Celular deitado com mais espaço para o 3D.

## [2.2.0] — v12 · Melhorias da Roteirização
### Adicionado
- Busca de cidades própria (lista bonita, destaque do texto, filtro por UF, aviso de cidade com nome repetido).
- **Valores adicionais** (chapa, ajudante, pernoite e outros), gerais ou por entrega, com o **total mínimo da viagem**.
- Desenho dos eixos e ajuda "o que são eixos".
- Remetente e destino na etiqueta do volume no 3D.
### Corrigido
- O aviso "Entrega 1: informe uma cidade válida" aparecia mesmo com a cidade escolhida.

## [2.1.0] — v11 · Acessibilidade, atalhos e Roteirização
### Adicionado
- **Montagem com Roteirização:** remetente, entregas, ordem sugerida, carga pelo inverso da entrega, mapa (OpenStreetMap ou mapa próprio offline), km e piso mínimo ANTT (Portaria SUROC nº 22/2026).
- Base de municípios do IBGE para funcionar sem internet.
- Acessibilidade: lista de volumes por teclado com descrição falada, foco preso nas janelas, erros ligados ao campo, alvos de toque de 44 px, textos de no mínimo 12 px e auditoria axe-core.
### Corrigido
- **Atalhos de teclado** não funcionavam depois de clicar no 3D (o foco ficava em um campo) nem durante a animação.

## [2.0.0] — v10 e anteriores
- Motor de encaixe (grade + Extreme Points), empilhamento, peso por eixo (CONTRAN 882/2021), categorias de manuseio, carrocerias baú, sider e aberta.
- Mostrar Catálogo e Montagem Rápida independentes; pergunta antes de cada veículo extra; containers nunca como extra.
- Cena 3D com renderização sob demanda; correção da seleção de volume vizinho; barra de edição única.
- Sistema sem login e sem banco de dados (dados no navegador); configuração separada em `src/config/`.
- Responsividade em 13 aparelhos.
