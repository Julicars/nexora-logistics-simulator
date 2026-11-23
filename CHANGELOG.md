# Changelog

Todas as mudanças relevantes do NEXORA. Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [3.31.0] — 2026-11-23
### Novo
- **Conferência antes de liberar** (aba Resultado): um painel junta todas as checagens:
  - volumes de fora, carga útil, PBT e eixos;
  - desequilíbrio lateral (centro de gravidade a mais de 5% da largura);
  - produto perigoso sem nº ONU ou classe;
  - carga acima do container (OOG), VGM e espaço vazio no fundo;
  - frete abaixo do piso ANTT.
  Bloqueios impedem a liberação. Com avisos, o conferente precisa confirmar. A liberação guarda nome e hora, e vale só para aquele arranjo.
- **Link de visualização do plano 3D** (`ver.html`):
  - cliente ou conferente abre no celular, só leitura;
  - permite girar, ver os dados de cada volume e acompanhar o passo a passo do carregamento;
  - tem link curto no servidor (`/api/planos3d`, 60 dias) ou o plano compactado dentro do próprio link quando não há servidor;
  - envio por WhatsApp e QR Code.
- **Importar planilha Excel (.xlsx) direto**, sem salvar como CSV:
  - acha o cabeçalho nas 15 primeiras linhas e reconhece nomes de ERP (it-codigo, desc-item, qt-pedida);
  - converte cm, mm e toneladas.
- **Cargas fora de padrão:** Container 20'/40' Open Top, 20'/40' Flat Rack (DSV) e Prancha 3 eixos.
  - Open top e flat rack aceitam carga acima da altura do container, até a altura legal, com aviso de OOG.
  - Nunca entram como veículo extra.
  - A frota salva recebe os novos veículos sem mudar os existentes.

## [3.30.0] — 2026-11-17
### Segurança
- **CSRF:** alterações na API só são aceitas vindas da própria origem.
- **Força bruta:** 10 chaves erradas em 15 min bloqueiam o IP por 15 min.
- **Novo `NEXORA_EXIGIR_CHAVE=1`:** passa a pedir a chave também no localhost.
- **Cabeçalhos:**
  - `Permissions-Policy` e `Cross-Origin-Opener-Policy`.
  - HSTS quando o acesso é por HTTPS.
  - CSP com `object-src 'none'`, `base-uri`, `form-action` e `frame-ancestors`.
- **Arquivos:**
  - Arquivos ocultos bloqueados no servidor de arquivos.
  - `chave.txt` gravado com permissão 600.
- Novo guia `SEGURANCA.md`. O DEPLOY.md agora recomenda o cron com a chave no cabeçalho.
- Novo teste de segurança: CSRF, arquivos ocultos, bloqueio por tentativas e chave obrigatória.
### Arquivos menores
- `docs/`: 4,8 MB → 3,5 MB.
  - Vídeo MP4: 1,6 MB → 0,95 MB.
  - GIF: 2,2 MB → 1,4 MB.
  - Capturas recomprimidas.
- **Logos** em WebP na página (44 + 32 KB → 18 + 18 KB). O `logo.png` continua só para o ícone do app.
- **Municípios** sem o "|0" repetido (194 → 183 KB).
- **Espaços em branco** sobrando removidos.
### Documentação
- Cabeçalhos explicativos em todos os testes e na folha de estilo do motorista; comentários nos pontos de segurança do servidor.
- README com novas capturas: Combustíveis, Clientes, Saúde do sistema, motorista e entregas.

## [3.29.1] — 2026-11-17
### Melhorado
- Saúde do sistema: o aviso "Atenção" de preço da Petrobras para confirmar agora aparece na própria tela, com o motivo, o link do comunicado e os botões Confirmar e Descartar.
- Mais detalhes em cada fonte: número de praças de pedágio, último IPCA, quantidade de feriados e preço de refinaria da síntese ANP.

## [3.29.0] — 2026-11-17
### Adicionado
- **Dados no servidor** (`server/dados.js` + `core/sync.js`):
  - Produtos, frota, planos, clientes, regras e preferências são sincronizados entre aparelhos; vale a versão salva por último.
  - Sem servidor, tudo continua funcionando no navegador.
- **Chave de acesso:**
  - Gerada na primeira execução (aparece no terminal e fica em `data/chave.txt`) ou definida em `NEXORA_CHAVE`.
  - Acesso pelo próprio computador não pede chave; outros aparelhos pedem uma vez.
  - Protege `/api/dados`, `/api/fretes`, `/api/transportes`, `/api/viagens`, `/api/cron` e as alterações em `/api/combustivel`.
- **Backup:**
  - Automático, 1 por dia, guardando 30 (`data/backups`).
  - Em Configurações: "Baixar backup completo" e "Restaurar backup". Antes de restaurar, o estado atual é salvo.
- **Saúde do sistema:** nova tela com a situação de cada fonte automática (ANP, dólar, Brent, Petrobras, síntese ANP, pedágio, IPCA, feriados e backup), teste pelo navegador (clima, CEP, rota, CNPJ) e o botão "Testar tudo agora".
- **Hospedagem:**
  - `/api/cron?chave=…` roda todas as tarefas, para hospedagens que "dormem".
  - Guia `DEPLOY.md` para hospedagem Node.js e para VPS (PM2, Nginx, HTTPS e domínio).
- **Custo estimado da viagem** (aba Frete):
  - Diesel pela média ANP da UF de origem, com consumo editável; ARLA; pedágio federal; valores adicionais.
  - Comparação com o piso ANTT.
- **Horário de recebimento:**
  - Nova hora de saída da viagem.
  - Chegada estimada em cada entrega (direção + 40 min por parada), com aviso quando cai fora do horário do cliente.
- **Link do motorista** (`motorista.html` + `server/viagens.js`):
  - **Para o motorista:** entregas na ordem, mapa, botão de ligar, "Entregue" (com recebedor, foto do canhoto e GPS) e "Problema".
  - **No escritório:** acompanhamento a cada 30 s e envio pelo WhatsApp.
  - Viagens apagadas após 120 dias.
- **Relatórios:**
  - Frete por mês, custo por km comparado ao diesel S-10, frete por tonelada e percentual acima do piso.
  - Destinos e transportadoras ou clientes mais frequentes, entregas feitas pelo link do motorista, exportação para Excel.
- **Mais leve:** o mapa (Leaflet) e o gerador de QR Code só são baixados quando usados (cerca de 200 KB a menos na abertura).

## [3.28.0] — 2026-11-17
### Adicionado
- **Cadastro de clientes** (menu Cadastro → Clientes):
  - Pelo CNPJ, o sistema busca razão social, endereço, telefone e e-mail na Receita. Pelo CEP, preenche o endereço (ViaCEP, com a BrasilAPI de reserva).
  - Também guarda contato, horário de recebimento, se exige agendamento, restrição a veículo grande e observações.
  - Busca, exportação para Excel e importação de CSV.
  - Botão "Usar em rota".
- **Roteirização mais fácil:**
  - **Entregas:**
    - Nome do cliente com autocompletar: escolhendo um cliente cadastrado, cidade, endereço e CEP vêm prontos.
    - CEP em cada entrega, que preenche a cidade sozinho.
    - "👥 Escolher clientes", para adicionar vários de uma vez.
    - "📋 Colar lista": uma entrega por linha, com cliente, cidade ou CEP; aceita colar do Excel.
  - **Viagem:**
    - Data de saída e data de cada entrega.
    - "⭐ Origem padrão", que preenche sozinho o remetente e a origem.
- **Clima na rota:** previsão do Open-Meteo para cada entrega no dia (até 16 dias), com avisos de chuva forte, vento e calor.
- **Feriados:**
  - Nacionais pela BrasilAPI, com cache no servidor e reserva fixa.
  - Estaduais de data fixa, numa lista do próprio sistema.
  - Aviso na saída e em cada entrega; os domingos também são avisados.
- **Pedágio:**
  - Praças das rodovias federais concedidas no traçado real da rota (ANTT, dados abertos, atualização semanal).
  - Estimativa do custo pelos eixos do veículo, com a tarifa média por eixo opcional e salva.
- **Gatilho do piso ANTT:** compara o diesel S-10 atual (ANP) com o diesel de referência da tabela (R$ 7,33, Portaria SUROC 22/2026). Avisa quando a variação chega a 5% (Lei 13.703/2018, art. 5º, §3º) na Roteirização e na aba Combustíveis → Diesel.
- **Calculadora de correção pela inflação (IPCA)** nas Calculadoras, com dados do Banco Central (SGS 433).
- API: `/api/servicos/{pedagio,ipca,feriados/:ano}`, com cache em disco e uso do último dado bom quando a fonte cai.

## [3.27.1] — 2026-11-17
### Melhorado (celular)
- Aba Combustíveis:
  - As listas de postos, de mudanças de preço e de preços da Petrobras viram cartões empilhados no celular, com rótulos.
  - A lista de postos mostra 30 por vez, com o botão "Mostrar mais".
  - As abas de combustível ficam numa única linha com rolagem lateral.
  - Os cartões aparecem em 2 colunas, e filtros e calculadora se ajustam à tela, sem rolagem lateral.
  - O botão flutuante "Nova carga" fica oculto nessa aba, para não cobrir o conteúdo.
- Correções:
  - O número em negrito dentro do texto pequeno dos cartões não aparece mais gigante.
  - Na lista de cidades, o nome e a UF não ficam mais grudados.
- Todas as telas foram verificadas em 360 px de largura, sem estouro lateral.

## [3.27.0] — 2026-11-17
### Adicionado
- **Preço da Petrobras automático** (`server/petrobras.js`):
  - **Fonte principal:** os comunicados da Agência Petrobras, lidos 1 vez por dia e de hora em hora quando há alerta de petróleo ou dólar. O servidor extrai "passará de R$ X para R$ Y por litro" e a data de vigência; quando o comunicado traz só a variação (por exemplo, "em R$ 0,38"), também entende.
  - **Conferência:** a Síntese Semanal de Preços da ANP (PDF). O servidor lê o preço de realização do diesel A e o PPI, mostra a defasagem e alerta quando ela passa de 10%.
- **Validação automática:** faixa de valor, variação máxima de 30%, preço anterior citado no comunicado, data plausível e diferença de até 15% em relação à ANP. Se algo não bater, o preço fica **pendente**, com o motivo, um trecho do comunicado e os botões Confirmar e Descartar.
- **Dedução:** se o diesel na bomba se mover R$ 0,15 ou mais em uma semana sem reajuste registrado, o sistema avisa que pode haver um anúncio não capturado.
- **Painel de saúde das fontes:** última leitura de cada fonte, ok ou falha.
- **Histórico com origem:** cada preço mostra se veio de comunicado ou de cadastro manual, com link para a fonte.
- O cadastro manual continua disponível como reserva.
- API: `POST /api/combustivel/petrobras/verificar`, `POST /petrobras/pendente/:id` (confirmar) e `DELETE /petrobras/pendente/:id` (descartar).

## [3.26.1] — 2026-11-17
### Adicionado
- O preço da Petrobras agora aparece marcado como **ATUALIZAÇÃO MANUAL**.
- O cartão da Petrobras ganhou o botão "ver como", que abre o cadastro.
- O cadastro explica o que digitar e onde pegar o valor: Agência Petrobras e precos.petrobras.com.br.

## [3.26.0] — 2026-11-17
### Adicionado
- Aba Combustíveis separada por combustível: **Diesel**, **Gasolina** (comum e aditivada), **Etanol** e **GNV**.
- Cada aba mostra só os seus cartões, linhas do gráfico, ranking, postos, mudanças de preço e calculadora.
- O painel de mercado (dólar, petróleo e Petrobras) e o ARLA aparecem só no Diesel.
- A aba escolhida fica salva e pode ser trocada pelo teclado com as setas.
- Servidor: `mudancas.porProd`, com as mudanças de preço separadas por combustível.

## [3.25.0] — 2026-11-17
### Adicionado
- A aba agora se chama **Combustíveis** e cobre todos os combustíveis da pesquisa da ANP: diesel S-10, diesel S-500, gasolina comum, gasolina aditivada, etanol e GNV.
- Isso vale para os cartões, o gráfico semanal (com todas as linhas), o ranking por estado e cidade, a lista de postos, o mapa, as mudanças de preço, o Excel e a calculadora.
- Cartão "Etanol ou gasolina?" com a regra dos 70%.
- Na calculadora, o combustível é escolhido e o ARLA só entra para diesel.

## [3.24.0] — 2026-11-17
### Adicionado
- Painel **Mercado** na aba Diesel & Abastecimento:
  - **Dólar:** PTAX do Banco Central (API oficial, atualizada por dia útil).
  - **Brent:** em dólar, em reais por barril e em reais por litro (série diária da EIA via FRED, que chega com alguns dias de atraso).
  - **Petrobras:** preço do diesel A às distribuidoras, que vem de comunicados; já vem com os anúncios de março e junho de 2026 e você cadastra os novos.
- Gráfico "Quem puxa quem": índice base 100 com dólar, Brent em reais, preço da Petrobras e preço da bomba (ANP).
- Composição estimada do litro do S-10: parcela da Petrobras e o restante.
- Alertas quando o Brent em reais se move 5% em 7 dias ou 10% em 30 dias, ou quando o dólar se move 3% em 7 dias.
- API: `GET /api/combustivel/mercado`, `POST /mercado/atualizar`, `POST /petrobras` e `DELETE /petrobras/:data`. O mercado é atualizado ao iniciar e a cada 6 h.

## [3.23.0] — 2026-11-17
### Adicionado
- Nova aba **Diesel & Abastecimento** (menu Consultas): preço do diesel S-10 e S-500 por posto, cidade, estado e Brasil, com dados oficiais e gratuitos da ANP.
- `server/combustivel.js`: confere a página da ANP ao iniciar e a cada 6 h e baixa só as semanas novas da planilha "preços por posto revendedor" (até 8 de uma vez, para formar o histórico). Guarda os dados em `data/combustivel`.
- `server/xlsxler.js`: leitor de .xlsx sem dependências (zip + XML).
- Médias, mínimo e máximo, gráfico de evolução semanal (Brasil ou UF), ranking por estado, as 10 cidades mais baratas e as 10 mais caras, e a variação de preço de cada posto em relação à semana anterior.
- Lista de postos com filtros (UF, cidade, produto, ordem, busca), exportação para Excel e mapa. As coordenadas vêm da API Revendedores da ANP; sem coordenada, o posto aparece no centro da cidade.
- Calculadora do custo de diesel e ARLA da viagem, que usa a média de preço do Brasil ou da UF e a distância da última rota.
- Importação manual da planilha da ANP (.xlsx) para quando o site da ANP estiver fora do ar.
- API: `/api/combustivel/{status,resumo,postos,municipios,geo}`, `POST /atualizar` e `POST /importar`.

## [3.22.3] — 2026-11-17
### Corrigido
- **Mapa da Roteirização:** o OpenStreetMap passou a bloquear o acesso (“Access blocked”) e um ícone da biblioteca do mapa aparecia gigante (bandeira azul e amarela). Agora usa os mapas da CARTO (base OpenStreetMap), claro ou escuro conforme o tema, e o ícone foi removido.
- **Tema claro:** a capa da Home ficou clara (sem o bloco azul), o logo ganhou versão com letras escuras (`logo-claro.png`) e o topo do menu e do celular ficaram claros. Relatórios impressos continuam com o logo original.

## [3.22.2] — 2026-11-17 · tema claro revisado
### Corrigido
- Tema claro em todo o site: título da capa da Home invisível, cartões “Menos multa…” escuros com texto apagado, cartões do Fórum, selos “fácil/médio/difícil de achar”, estrelas de favorito, tabelas e mapa da Roteirização, botões laranja com pouco contraste.
- A **cena 3D** também fica clara no tema claro (fundo, chão e grade), e os painéis sobre o 3D seguem o tema.
- Varredura automática de contraste (texto × fundo) em todas as telas, janelas e abas nos dois temas: nenhum texto abaixo do mínimo.

## [3.22.1] — 2026-11-17 · versão final para o GitHub
### Corrigido
- Dicas da primeira vez: o balão continuava na tela ao trocar de página e cobria botões (ex.: “Excel” no Registro de fretes); agora fecha ao navegar e não abre duas vezes.
### Adicionado
- `subir-auto.bat`: envio automático para o GitHub (Windows), com registro em `subir-auto.log` (fora do Git).

## [3.22.0] — 2026-11-16 · v47
### Adicionado
- **Duplicar plano** salvo · **cores por entrega** no 3D da Roteirização · **foto do 3D** para baixar/compartilhar · **mensagem pronta para o WhatsApp**.
- **Aviso de carga leve** (menos de 50% de espaço e peso) com o veículo menor que leva tudo · **“Quantos mais cabem?”** por produto (espaço, peso e eixos conferidos).
- **Favoritos** de produtos (catálogo) e de veículos (aparecem primeiro) · **modelos de carga** que se repetem.
- **Nome de quem montou** no relatório, na etiqueta (QR) e no WhatsApp.
- **Tema claro** · **dicas da primeira vez** · **busca no menu** · **botão flutuante “Nova carga”** no celular · **calculadoras** (cubagem e conversor de unidades).
### Corrigido
- Contraste do tema claro revisado (WCAG AA).

## [3.21.2] — 2026-11-16 · v46 (organização do repositório)
### Alterado
- `docs/` sem subpastas: capturas convertidas para **WebP** (de 11 MB para 1,2 MB), `demo.gif` menor (2,2 MB) e `demo.mp4`; 10 capturas antigas sem uso removidas.
- `js/3d/scene.js` → `js/app/cena3d.js` (uma pasta a menos).
- `.gitignore` completo (dados, logs, zips, arquivos de sistema) e `.gitattributes` (fim de linha e binários).

## [3.21.1] — 2026-11-16 · v45 (auditoria de bugs)
### Corrigido
- Registro de fretes/transportes: o contador “N registro(s)” escrevia por cima do resumo do cálculo do transportador na Expedição (IDs repetidos `rgSum`/`tpSum`).
- Plano salvo com volumes que sobraram: ao reabrir, os volumes de fora ficavam vazios e “Recolocar”/“veículo extra” podiam falhar.
- Plano aberto por link/código: agora confere a montagem (sobreposição, peso, eixos) e avisa se houver problema; veículos com medidas absurdas no código são recusados.
- Impressão da ficha da empresa saía em branco (ou com o último relatório de carga).
- “Sempre dividir automaticamente” não tinha como ser desligado: nova opção em Configurações.
- Tela cheia do diagrama travava a rolagem da página ao abrir outra empresa a partir dele; ouvintes de tela/tamanho deixavam de acumular.
- Configurações no celular: cartões passavam da largura da tela (grades agora encolhem o conteúdo).
- Regras de carregamento valem também ao mexer à mão num plano reaberto.
- Servidor: envio grande demais responde 413 (antes derrubava a conexão) e JSON inválido responde 400.

## [3.21.0] — 2026-11-16 · v44
### Adicionado
- **Regras de carregamento no cadastro do produto**: “não viaja junto com”, “não pode ficar em cima de” (produtos, códigos ou categorias) e “só no piso”. A montagem já respeita automaticamente; as regras gerais da empresa continuam no ⚙ e a tela mostra as dos produtos.
### Corrigido
- Cadastro de produto com medidas formatadas (ex.: 0,60) era recusado como “zero”: o formulário agora lê os números pela máscara.

## [3.20.0] — 2026-11-16 · v43
### Adicionado
- **Regras próprias de carregamento** (⚙): “não viaja junto com”, “não pode ficar em cima de” e “só no piso”, por nome, código ou categoria; o motor respeita em toda montagem e em movimentos manuais.
- **Peso cubado** (fator 300/250/200/167 kg/m³) e **peso para cobrança** (maior entre real e cubado); **metros lineares de piso (LDM)** por veículo.
- **Cintas pela norma europeia EN 12195-1** (amarração de topo): atrito do piso, STF da catraca e ângulo ajustáveis; usa o maior entre a regra da Res. CONTRAN 945 e a EN 12195-1.
- **VGM do contêiner** (SOLAS, método 2): carga + escora + tara contra a placa CSC, com declaração para imprimir.
- **Dividir em vários veículos automaticamente** (“Dividir tudo” e opção “sempre dividir”).
- 3D: **mover volume para outro veículo**, **tirar da carga** e **recolocar os volumes de fora**.
- Frete: aviso quando há carga perigosa e a tabela escolhida não é a de maior valor (Res. ANTT 6.076/2026); linha de **crédito de CBS + IBS** para o contratante.

## [3.19.0] — 2026-11-13 · v42
### Adicionado
- **Nota de risco (0–100)** na consulta completa, com os motivos (situação, idade, capital, sanções, embargo, lista suja, sanções internacionais, RNTRC).
- **Setor da empresa** pelo CNAE (indústria, atacado, varejo, transportadora, logística, agro, construção, serviços).
- **Transportadoras (ANTT, dados abertos)**: RNTRC (número, situação, categoria ETC/TAC/CTC, desde), frota cadastrada, habilitação TRIC e OTM.
- **Seguros da transportadora**: RCTR-C, RC-DC, seguradora, validade e gerenciadora de risco anotados pelo usuário (não existem em base pública), com aviso de vencido.
- **IBAMA**: embargos ambientais por CNPJ. **Lista suja do trabalho escravo**: carregar a planilha oficial do MTE e conferir empresa, empresas sócias e mesma raiz de CNPJ.
- **Sanções internacionais**: listas oficiais OFAC (EUA) e ONU, baixadas 1x por dia no servidor; confere empresa e sócios (nome idêntico marcado como “confira”).
- Diagrama: **tocar numa pessoa já busca as empresas dela** e traz para o diagrama; reajusta a vista após expandir.

## [3.18.0] — 2026-11-13 · v41
### Adicionado
- **Diagrama de vínculos interativo** (`app/grafo.js`, sem bibliotecas): arrastar para mover, roda do mouse/pinça para zoom, arrastar nós, tela cheia, procurar no diagrama, destacar ligações, painel de detalhes, **expandir vínculos** de empresa ou pessoa (duplo clique), organizar de novo, teclado (setas, + / −, 0, Esc) e exportar SVG.
- **Consulta de pessoas (sócios)**: nome completo (+ CPF opcional, convertido para o formato mascarado da Receita antes de sair do sistema) → empresas em que é sócia/administradora, cargos, datas, situação, homônimos separados e diagrama próprio. Só vínculos societários públicos — sem endereço, telefone ou outros dados pessoais.
- Consulta completa: **GLEIF/LEI** (registro global, com controladora direta/final), CEPIM e acordos de leniência, contratos com o governo federal (Portal da Transparência, com chave) e links oficiais para certidões (Receita/PGFN, FGTS, CNDT/TST, RNTRC/ANTT, Sintegra).
- Rota `POST /api/empresas/pessoa`; testes novos.

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
