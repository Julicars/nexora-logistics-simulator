# Changelog

Todas as mudanças relevantes do NEXORA. Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [3.17.0] — 2026-11-12 · v40
### Adicionado
- **Paletização** (botão "🧱 Paletizar caixas soltas"): calcula caixas por camada (bloco, bloco girado ou padrão em dois blocos), camadas pela altura total, limite de peso do palete e de empilhamento, opção de deitar a caixa e sobra na borda.
- Paletes PBR, europeu, americano, químico e descartável; vistas de cima e de lado em SVG.
- Troca as caixas soltas por paletes cheios + palete incompleto na carga, direto no 3D.
- `core/palete.js` com testes (`test/palete.test.js`).

## [3.16.0] — 2026-11-12 · v39

### Adicionado (o que os melhores sistemas de plano de carga têm — EasyCargo, Cargo-Planner, Goodloading)
- **🔗 Compartilhar plano de carga** por link (com botão de WhatsApp) ou código: quem recebe abre o mesmo 3D, com as mesmas posições, veículo, eixos e observações, sem cadastro. Em **Planos salvos → 📥 Abrir plano compartilhado**, cole o link ou código.
- **📋 Colar lista do pedido:** texto de e-mail, NF-e ou planilha vira linhas de carga (quantidade, C × L × A em m/cm/mm, peso em kg/t, "cada" ou "total"), com prévia e aviso do que falta.
- **🪜 Passo a passo do carregamento (A4):** uma etapa por fileira, com camadas, vista de cima e de lado (fileira atual em laranja), observações, amarração/calços e aviso de eixos.
- **🚚 Qual veículo leva tudo?** Testa a carga em toda a frota (containers só com containers) e mostra o menor que serve, ocupação, carga útil e facilidade de achar; "Usar" troca o veículo.
- **Observações para o carregamento** (aba Salvar): saem no relatório, no passo a passo e no plano compartilhado.
- **⚖ Peso vazio real por eixo** no cartão do veículo: substitui a estimativa nos eixos, no PBT e na carga útil.

### Alterado (vocabulário do mercado)
- "Montagens salvas" → **Planos de carga salvos**; "Relatório da montagem" → **Relatório do plano de carga**; nome, salvar e mensagens no mesmo padrão.
- Mensagens dizem o que fazer: "Monte a carga antes: toque em “▶ Ver como a carga fica”", "Faltou a carga: adicione pelo menos um produto (ou cole a lista do pedido)".
- Referência de limites corrigida para Res. CONTRAN 882/2021 (antes citava a 210/2006).

## [3.15.0] — 2026-11-12 · v38

### Alterado (textos e chamada para ação, com base em pesquisa de leitura na web e conversão)
- **Home:** título com resultado ("Monte a carga certa e não pague multa na balança"), linha de apoio com "Em 2 minutos", um botão principal ("⚡ Montar minha carga agora") e um secundário ("▶ Ver exemplo pronto"). Passos e recursos começam pela palavra-chave (Carga, Veículo, Balança, Frete, Encaixe, 3D, Perigosos).
- **Resultados com números** calculados pelo próprio NEXORA (multa evitada, viagens a menos, big bags juntos) e convite para clientes reais contarem a experiência — sem depoimentos inventados.
- **Botões dizem o que acontece:** "▶ Ver como a carga fica" (antes "Calcular carregamento") e "💾 Salvar montagem para reabrir depois".
- **Mensagens dizem o que fazer:** "Faltou a cidade da entrega 1: na aba Rota, digite o nome e escolha na lista." e outras.
- Quadro "Peso por eixo" no celular: detalhes recolhidos, toque no título para abrir.

### Adicionado
- **Exemplo pronto:** 20 big bags de 1.250 kg numa carreta LS montados na hora, com botão "↩ Voltar para a minha carga" se havia uma carga antes.

## [3.14.1] — 2026-11-12 · v37

### Corrigido
- **Medidas em metros com vírgula automática:** digite só os números — 150 → 1,50; 10 → 0,10; 190 → 1,90. Se preferir, digite a vírgula: 1 , 9 → 1,9 (vira 1,90 ao sair do campo).
- **Consulta de empresas na prévia do Claude:** a prévia bloqueia acesso a sites externos; agora a tela explica isso e indica como publicar o NEXORA na web.

### Adicionado
- Fonte **CNPJ.ws** (pública, 3/min): reserva da consulta e inscrições estaduais de todos os estados na consulta completa (servidor e navegador).
- **Publicar na web:** GitHub Pages (`.github/workflows/pages.yml`), Netlify (`netlify.toml`), Vercel (`vercel.json`) — sem servidor; e Render (`render.yaml`) — sistema completo com Node. Passo a passo no README.

## [3.14.0] — 2026-11-12 · v36

### Adicionado
- **Formatação automática dos números enquanto se digita** (src/js/core/mascara.js), em todo o sistema, inclusive campos criados depois e as células editáveis dos registros:
  - Valores em R$: 1 2 3 4 5 6 → 1.234,56 (centavos à direita).
  - Medidas, pesos e quantidades: ponto de milhar automático (1.250) e vírgula para os decimais (1,20). Digitar ponto vira vírgula. Colar "R$ 1.234,56" ou "1234.56" funciona. Setas ↑/↓ continuam somando e subtraindo.
  - O campo mostra o número formatado, mas os cálculos recebem o número puro (sem mudar o restante do código).
- **Uso pela web, sem baixar:**
  - Instalável como app (botão "📲 Instalar o NEXORA" no menu; no iPhone, "Adicionar à Tela de Início") e abre sem internet depois da primeira visita (manifest + service worker).
  - Consulta de empresas sem o servidor: busca por nome e rede de sócios tentam direto pelo navegador, com cache de 1 dia; se a fonte bloquear, a tela explica e mostra o que é possível.

## [3.13.0] — 2026-11-12 · v35

### Adicionado
- **Consulta de empresas** (menu Consultas): busca por CNPJ ou por nome (com filtro de UF).
  - **Consulta simples:** razão social, nome fantasia, situação, abertura, natureza, porte, CNAE principal, endereço, telefone, e-mail, Simples/MEI e alertas (situação irregular, empresa nova, capital baixo, MEI, CNAE de transporte e lembrete do RNTRC).
  - **Consulta completa:** tudo da simples + capital social, regime tributário, inscrição estadual, CNAEs secundários, quadro de sócios e administradores, sanções CEIS/CNEP (com chave do Portal da Transparência) e o **diagrama de vínculos**: empresas ligadas aos mesmos sócios (pessoa física por nome + CPF mascarado; sócio empresa com os sócios dela). Clique numa empresa do diagrama para consultá-la. Baixar diagrama (SVG), JSON e imprimir.
  - Histórico das últimas consultas.
- Servidor: `/api/empresas` (server/empresas.js) com fontes de reserva (minhareceita.org → BrasilAPI → OpenCNPJ), CNPJá (5/min), Casa dos Dados (busca por nome, até 20) e cache em `data/empresas-cache.json`. Variáveis opcionais `NEXORA_TRANSPARENCIA_CHAVE` e `NEXORA_CASADOSDADOS_CHAVE`.
- Sem o servidor, o navegador consulta o CNPJ direto nas APIs públicas (busca por nome e rede completa pedem o servidor).

## [3.12.0] — 2026-11-12 · v34

### Adicionado
- **CIOT** nos registros do empregador e do transportador (campo e coluna). Frete abaixo do piso aparece como "abaixo do piso · CIOT bloqueado" e a roteirização avisa que a viagem não pode sair (Res. ANTT 6.078/2026).
- **MDF-e por estado:** a etapa Frete mostra quantos MDF-e emitir (um por UF de descarga, com o CIOT vinculado).
- **Custo por tonelada em cada configuração:** para a rota e a carga atuais, compara truck, bitruck, carreta 5 eixos, LS, vanderléia, LS quarto eixo, bitrem 7 e 9 eixos — piso por viagem, R$ por tonelada, número de viagens e total, destacando o mais barato e a facilidade de achar.
- **Eixo dianteiro de 7 t** para veículo elétrico, híbrido ou a gás (Res. CONTRAN 1015/2024), marcado no cartão do veículo.

### Alterado
- **Vale-pedágio pago à parte:** não entra mais no frete nem no total da prestação (Lei 10.209/2001; STJ 2026). Coluna própria nos dois registros.
- **CBS/IBS pelo ano do registro:** 2026 = 0,9% + 0,1% (teste); a partir de 2027 = 8,8% + 0,1% (estimativa; editável).

## [3.11.0] — 2026-11-12 · v33

### Adicionado
- **Facilidade de achar no mercado** em cada configuração de eixos (Fácil de achar / Com alguma procura / Difícil de achar), no cartão do veículo, no seletor "Trocar eixos", na lista da frota e na tabela de referência, com legenda. Estimativa pela frota que mais aparece em fretes e emplacamentos (truck, LS, carreta 5 eixos e bitrem 7 eixos no topo).

### Melhorado (responsivo)
- Telas de toque: botões pequenos do 3D com texto maior, links do fórum com área de toque maior, caixas de seleção de 22 px e campos com fonte de 16 px (o iPhone não dá mais zoom ao tocar).
- Seletor de eixos em 2 colunas no celular; quadro "Peso por eixo" não passa da largura da tela.
- Conferido sem rolagem lateral em 320, 360, 390, 768, 1024 e 1280 px, retrato e paisagem.

## [3.10.1] — 2026-11-11 · v32

### Adicionado
- **Observações da balança** (Res. CONTRAN 882/2021) no cartão do veículo e na página Veículos: até 50 t só PBT; acima de 50 t também eixos; obrigação de respeitar o limite por eixo (art. 51); tolerância não vale para planejamento nem para NF-e/CT-e/MDF-e; peso por eixo é estimativa; cálculo da multa.

## [3.10.0] — 2026-11-11 · v31

### Alterado
- **"Sistema arruma a carga" confere o peso como a balança** (Res. CONTRAN 882/2021 art. 50 §1º). Em veículo de até 50 t (toco, truck, bitruck, carretas até 50 t, Romeu e Julieta) limita só pelo peso total (PBT/PBTC) e não tira volumes por causa de eixo; o quadro "Peso por eixo" continua avisando. Acima de 50 t confere também cada eixo, com tolerância de 12,5%.
- Exemplo: 20 big bags de 1.375 kg na LS com cavalo trucado agora vão todos (43,3 t de 48,5 t).

## [3.9.1] — 2026-11-11 · v30

### Corrigido
- **Multa por excesso** segue a Res. CONTRAN 882/2021 art. 57: multa-base uma vez só, acréscimos de eixos e de PBT calculados separados e somados.
- **Fiscalização de veículos até 50 t** (art. 50 §1º): na balança só o PBT/PBTC é conferido; os eixos entram só se o PBT passar da tolerância de 5%. O quadro mostra "Acima do limite" sem multa nesse caso.
- **LS quarto eixo:** 58,5 t (6 + 17 + 10 + 25,5), comprimento de 17,5 m ou mais (art. 6º, I, f). Antes estava 54,5 t.

## [3.9.0] — 2026-11-11 · v29

### Adicionado
- **Status de balança por eixo e PBT** no quadro "Peso por eixo": OK (dentro do limite), Alerta (acima do limite, dentro da tolerância de 12,5% por eixo ou 5% no PBT) e Excesso.
- **Multa estimada** quando passa da tolerância (CTB art. 231, V): R$ 130,16 + valor por fração de 200 kg conforme a faixa de excesso, calculada só sobre o que passa da tolerância.
- Centro de gravidade da carga (distância da cabine) no quadro.

### Alterado
- Configurações de eixos listadas **do menor para o maior peso (PBT)** no seletor e na tabela de referência.
- Bitrem 9 eixos e rodotrem 9 eixos indicam que exigem AET e comprimento de 25 a 30 m.

## [3.8.0] — 2026-11-11 · v28

### Adicionado
- **Todas as configurações de eixos da Resolução CONTRAN 882/2021**, do toco ao rodotrem: toco, trucado, bitruck, caminhão 4 eixos tandem triplo; cavalo toco ou trucado com carreta de 1 eixo, 2 eixos, 2 eixos distanciados, LS, vanderléia; LS menor de 16 m (45 t), LS vanderléia simples (50 t), vanderléia trucada (53 t), LS quarto eixo (54,5 t); Romeu e Julieta (36, 43 e 50 t); bitrem 7 eixos (57 t) e 9 eixos (74 t); rodotrem 9 eixos (74 t).
- Tabela de referência na página Veículos com as 23 configurações, desenho e limites.

## [3.7.1] — 2026-11-11 · v27

### Alterado
- **Carga sempre junta:** nenhum produto fica com espaço entre as fileiras. Tudo começa na cabine e vai encostado até o fundo, nos dois modos (sistema e usuário).
- O sistema usa por padrão a tolerância legal de 12,5% por eixo antes de deixar volumes de fora.

## [3.7.0] — 2026-11-11 · v26

### Adicionado
- **Quem arruma a carga** (cartão do veículo, aba Carga), com dois botões:
  - **🤖 Sistema arruma a carga:** começa na cabine, gradua as fileiras (espaço máximo de 0,6 m) e respeita o limite de cada eixo; se precisar, deixa volumes de fora e pergunta pelo veículo extra.
  - **✋ Usuário arruma a carga:** coloca tudo junto a partir da cabine **sem mexer por causa do peso por eixo**. Só respeita a carga permitida do veículo (PBT). Depois você arruma como quiser (arrastar, setas, girar, deitar); o sistema avisa quando um eixo passa do limite, mas não bloqueia.
- **Quadro "Peso por eixo"** sempre visível no 3D, com barra e valor de cada eixo e do PBT, atualizado a cada movimento.
- Teste do modo "usuário arruma" (31 no total).

### Alterado
- Ao deixar volumes de fora por peso por eixo, o sistema procura o menor número de volumes a tirar (testando pela frente e pelo fundo) e arruma de novo a partir da cabine.
- A caixa "Fileiras juntas" foi substituída pelos dois botões acima.

## [3.6.0] — 2026-11-11 · v25

### Alterado
- **Big bag, palete e bobina vão "gradados" da cabine até o fundo**, com espaço igual entre as fileiras de no máximo 0,6 m (nunca um vão grande). Com 18, 19 ou 20 paletes a carga chega até as portas, como nas carretas que chegam carregadas. Caixas e demais volumes continuam juntos.
- Se algum eixo passar do limite, o sistema testa espaçamentos menores (sempre a partir da cabine) antes de deixar volumes de fora.

### Adicionado
- **Tabela de configurações de eixos** na tela Veículos, com o desenho de cada uma e os limites da Res. CONTRAN 882/2021: Toco 6+10=16 t, Trucado 6+17=23 t, Cavalo toco + LS 6+10+25,5=41,5 t, Cavalo trucado + LS 6+17+25,5=48,5 t, Cavalo toco + vanderléia 6+10+10+10+10=46 t, Romeu e Julieta 6+17+10+10=43 t e Rodotrem 9 eixos 74 t.
- Teste: 20 big bags de 1.250 kg da cabine ao fundo, sem vão maior que 0,6 m (30 no total).

## [3.5.0] — 2026-11-11 · v24

### Alterado
- **Toda carga começa na cabine**, em qualquer veículo, configuração de eixos e modo. O sistema não desloca mais o bloco para trás.
- **Padrão (desmarcado):** quando um eixo passaria do limite legal, abre espaço igual entre as fileiras até o fundo (escolhe a distribuição mais equilibrada), como nas fotos de carregamento real.
- **"Fileiras juntas, sem espaço entre elas"** (antes "Encostar na cabine e gradar até o fundo"): fileiras encostadas a partir da cabine, aceitando até a tolerância de 12,5% por eixo; só abre o espaço mínimo necessário.
- Se precisar deixar volumes de fora por peso, o sistema tira e **redistribui de novo a partir da cabine** (antes podia sobrar um vão na frente).

### Corrigido
- Com cavalo toco, o modo marcado não começava na cabine.
- Teste novo: carga começa na cabine com cavalo trucado, cavalo toco e vanderléia, nos dois modos (29 no total).

## [3.4.1] — 2026-11-11 · v23

### Corrigido
- **Carregamento parecido com o real:** comparado com fotos de carretas sider com big bags, o modo padrão agora sempre começa **encostado na cabine** e distribui as fileiras até perto das portas, dentro do limite legal de cada eixo (antes deixava um vão de 4 m na frente).
- **Peso no eixo dianteiro do cavalo:** a parte do peso da quinta roda que vai para o eixo dianteiro passou de 12% para 8%, calibrado com carregamentos reais de carreta LS (a quinta roda fica pouco à frente do tandem de tração). Estimativa: varia conforme o cavalo.
- **Modo "encostar na cabine":** deixa as fileiras juntas a partir da cabine e só abre espaço entre elas o mínimo necessário para ficar dentro da tolerância de 12,5%.
- Testes atualizados (28 no total).

## [3.4.0] — 2026-11-11 · v22

### Adicionado
- **Encostar na cabine e gradar até o fundo** (caixa no cartão do veículo, aba Carga): monta como no carregamento real, começando junto à cabine e distribuindo as fileiras até as portas. Aceita o peso por eixo até a tolerância de 12,5% (Lei 14.229/2021); o PBT continua no limite legal. Eixos acima do limite legal aparecem como "⚠ na tolerância". Fica salvo como preferência.
- No modo padrão, o equilíbrio de eixos tenta primeiro gradar a partir da cabine antes de deslocar o bloco.
- Planilhas dos registros com barra de rolagem visível (laranja), botões ◀ ▶, cabeçalho e totais fixos.
- Teste do modo cabine (27 no total).

## [3.3.0] — 2026-11-11 · v21

### Adicionado
- **Transportador × Empregador** no passo Frete da Roteirização, com campos diferentes para cada papel.
- **Transportador:** valor da NF-e, frete cobrado (já sugerido com piso + adicionais), pedágio, ad valorem e GRIS (% da NF-e), ICMS com sugestão interestadual (7%/12%), CBS 0,9% e IBS 0,1% (teste 2026), total da prestação do CT-e e % do frete sobre a NF-e. Salva no novo **Registro do transportador** (`data/transportes.json`).
- **Empregador:** frete mínimo ANTT, frete fechado, valor da NF-e, peso, volumes, adicionais, NF-e, CT-e, etiquetas, **foto do caminhão carregado** e **% do frete sobre a NF-e** (total pago ÷ NF-e). Salva no **Registro do empregador**, com miniatura da foto (clique para ampliar).
- Os dois registros com totais, média de frete/NF-e e aviso de frete abaixo do piso.
- Teste de separação dos registros (26 no total).

### Alterado
- O formulário "Registrar frete contratado" saiu do passo Concluir e foi para o passo Frete (perfil Empregador). "Registro de fretes" passou a se chamar **Registro do empregador**.

## [3.2.1] — 2026-11-11 · v20

### Corrigido
- **Veículos extras indevidos ao trocar de veículo:** ao recalcular (troca de veículo, carroceria ou eixos), a pergunta de veículo extra que estava aberta é descartada, e um "Sim" antigo não adiciona mais veículo à nova montagem.
- **Peso por eixo:** antes de deixar volumes de fora por excesso num eixo, o motor agora reposiciona as fileiras ao longo do comprimento (desloca o bloco e abre espaço entre fileiras) para distribuir o peso. Exemplo: 20 big bags de 1.250 kg cabem todos na Carreta 15,4 m (antes sobravam 8 e o sistema pedia veículos extras).
- Teste novo cobrindo esse caso (25 no total).

## [3.2.0] — 2026-11-11 · v19

### Adicionado
- **Registro de fretes contratados:** formulário no passo Concluir (transportadora, frete fechado, adicionais inclusos ou cobrados depois, NF-e, CT-e) e página **Registro de fretes** em formato de planilha web editável, com totais, busca e aviso de frete abaixo do piso ANTT. Salvo em JSON (`data/fretes.json` ou no navegador). Exporta para **Excel .xlsx** (gerador próprio, sem bibliotecas), CSV e JSON.
- Conferência da **chave de acesso de NF-e e CT-e** (44 dígitos, dígito verificador e modelo 55/57).
- **Calços e amarração:** sugestões de barra de travamento, calço e cintas pelas folgas, carroceria e tipo de carga, com desenho no 3D (botão *Amarração*) e seção no Plano. Base: Res. CONTRAN 945/2022 e 701/2017.
- **Etiquetas com QR Code** para cada volume (8 por folha A4), lidas por qualquer aplicativo de QR.
- **Produtos perigosos:** nº ONU, classe, risco subsidiário, grupo de embalagem, número de risco e nome para embarque no cadastro; rótulos de risco, painel de segurança e lembrete de documentos no Resultado.
- Testes do registro de fretes (24 no total).

## [3.1.0] — 2026-11-11 · v18

### Adicionado
- **Backup dos dados** (Configurações): baixar e restaurar um `.json` com produtos, frota, montagens, sessões, preferências e tabela ANTT personalizada, com confirmação antes de substituir.
- **Folha do motorista** por entrega (Roteirização › Concluir): uma página por parada, volumes na ordem de retirada, posição no veículo, coluna ✓ e assinatura.
- **Tabela ANTT editável** (Configurações): atualize CCD e CC das Tabelas A, B, C e D sem mexer no código, com referência da portaria e botão para voltar aos valores oficiais. O passo Frete avisa quando há valores personalizados.
- **Tabelas B, C e D da ANTT** (Portaria SUROC nº 22/2026), conferidas com a fonte oficial: só o cavalo, alto desempenho e alto desempenho só o cavalo.
- **Retorno vazio** opcional no passo Frete: 92% do CCD × distância de volta (Res. ANTT 5.867/2020).
- **Importar planilha** no editor de carga: CSV ou colar do Excel/Google Planilhas, com modelo para baixar e entrega reconhecida pelo número, destinatário ou cidade.
- **Filtro por entrega** na lista de volumes da Roteirização.
- **Fórum:** edição de tópicos (admin) e de respostas (admin ou o próprio autor), norma de referência em destaque, fechar tópico para respostas, contador de novidades no menu e selo "nova".

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
