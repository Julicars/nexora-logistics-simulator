<div align="center">

<img src="public/src/img/logo.webp" alt="NEXORA Logistics Intelligence" width="320">

### Montagem de carga em 3D, peso por eixo, frete mínimo ANTT e consulta de empresas — num só lugar.

<p>
<img alt="Versão" src="https://img.shields.io/badge/vers%C3%A3o-3.30.0-f39a2b?style=for-the-badge">
<img alt="Node" src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white">
<img alt="Sem frameworks" src="https://img.shields.io/badge/HTML%20%2B%20CSS%20%2B%20JS-sem%20frameworks-2f8cf2?style=for-the-badge">
<img alt="Testes" src="https://img.shields.io/badge/testes-53%20passando-32c48d?style=for-the-badge">
<img alt="Acessibilidade" src="https://img.shields.io/badge/WCAG%202-A%2FAA-7c3aed?style=for-the-badge">
</p>

<p>
<a href="#-comece-em-1-minuto"><b>Começar</b></a> ·
<a href="#-o-que-o-nexora-faz"><b>Funcionalidades</b></a> ·
<a href="#-telas"><b>Telas</b></a> ·
<a href="#-publicar-na-web"><b>Publicar</b></a> ·
<a href="#-normas-e-leis-aplicadas"><b>Normas</b></a> ·
<a href="CHANGELOG.md"><b>Novidades</b></a>
</p>

<img src="docs/demo.gif" alt="Demonstração do NEXORA: carga montada em 3D, amarração, paletização e roteirização" width="900">

<sub>▶ <a href="docs/demo.mp4"><b>Assistir ao vídeo em alta qualidade (MP4, 53 s)</b></a></sub>

</div>

---

## ✨ Por que o NEXORA

> **Monte a carga certa e não pague multa na balança.** Em 2 minutos você vê a carga em 3D, da cabine ao fundo, com o peso de cada eixo conferido pela Res. CONTRAN 882 e o piso de frete da ANTT da viagem — com a multa estimada se passar do limite.

<table>
<tr>
<td width="33%" valign="top">

### 🚛 Carga em 3D
Encaixe automático, empilhamento, regras de manuseio, **fileiras sempre juntas a partir da cabine** e animação de carregamento.

</td>
<td width="33%" valign="top">

### ⚖️ Peso por eixo
23 configurações de eixos (do toco ao rodotrem), tolerâncias da balança, **multa estimada** e centro de gravidade.

</td>
<td width="33%" valign="top">

### 💲 Frete ANTT
Piso mínimo vigente (Res. 6.084/2026), aviso de **CIOT bloqueado**, CT-e com CBS/IBS e custo por tonelada.

</td>
</tr>
<tr>
<td valign="top">

### 🧱 Paletização
Caixas soltas viram paletes: padrão em dois blocos, camadas, peso e altura. Um toque troca na carga.

</td>
<td valign="top">

### 🔗 Empresas e sócios
Consulta por CNPJ, nome ou **pessoa**, diagrama interativo de vínculos, risco, ANTT, IBAMA e sanções.

</td>
<td valign="top">

### 📦 Sem complicação
Sem login, sem banco de dados, funciona **sem internet** e instala como app no celular.

</td>
</tr>
</table>

---

## 🚀 Comece em 1 minuto

```bash
git clone <seu-repositório> nexora && cd nexora
npm start            # http://localhost:3000  (Node 18+)
```

Ou **sem instalar nada**: abra `public/index.html` no navegador. Na Home, toque em **“Ver exemplo pronto”** para ver uma carga montada na hora.

<details>
<summary><b>Variáveis de ambiente (opcionais)</b></summary>

| Variável | Para que serve | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `NEXORA_ADMIN_SENHA` | Senha do administrador do fórum | gerada a cada início |
| `NEXORA_DADOS` | Pasta dos dados (`forum.json`, `fretes.json`, cache…) | `./data` |
| `NEXORA_TRANSPARENCIA_CHAVE` | Chave gratuita do Portal da Transparência (sanções e contratos federais) | — |
| `NEXORA_CASADOSDADOS_CHAVE` | Busca por nome sem o limite da API pública | — |

| Sistema | Exemplo |
|---|---|
| Linux / macOS | `NEXORA_ADMIN_SENHA=suaSenha npm start` |
| Windows (PowerShell) | `$env:NEXORA_ADMIN_SENHA="suaSenha"; npm start` |
| Windows (CMD) | `set NEXORA_ADMIN_SENHA=suaSenha && npm start` |

</details>

---

## 👥 Clientes e roteirização automática

- **Clientes:** cadastre pelo CNPJ ou pelo CEP e o endereço vem pronto. Na rota, basta digitar o nome do cliente.
- **Roteirização:** cole a lista de entregas, escolha vários clientes ou digite CEPs. Cada entrega mostra clima (Open-Meteo), feriado nacional e estadual, e horário e agendamento do cliente.
- **Pedágio:** mostra as praças federais concedidas no caminho, com dados abertos da ANTT.
- **Piso ANTT:** avisa quando o diesel passa do gatilho de reajuste de 5%.
- **Calculadoras:** correção de valores pelo IPCA, com dados do Banco Central.

## ☁️ Dados no servidor, link do motorista e relatórios

- **Sincronização:** com o servidor, os dados ficam iguais no PC e no celular. Outros aparelhos pedem a **chave de acesso** uma vez.
- **Backup:** automático todo dia, e você também baixa e restaura pela tela de Configurações.
- **Link do motorista:** no celular, o motorista marca as entregas e manda a foto do canhoto; o escritório acompanha.
- **Saúde do sistema:** mostra se todas as atualizações automáticas estão funcionando.
- **Relatórios:** frete por mês, R$/km comparado ao diesel, destinos e transportadoras.
- **Publicar na internet:** veja [DEPLOY.md](DEPLOY.md).

## ✅ Conferência, link 3D, Excel e cargas especiais
- **Conferência antes de liberar** (aba Resultado). Um painel junta todas as checagens:
  - 🔴 Bloqueia a liberação: volumes de fora, peso acima da carga útil, PBT ou eixo acima da tolerância, VGM acima da placa.
  - 🟡 Pede confirmação: eixo acima do limite legal, desequilíbrio lateral, produto perigoso sem nº ONU, carga OOG, frete abaixo do piso ANTT.
  - 🔵 Lembretes: espaço vazio no fundo e produto perigoso a bordo.
  - A liberação registra o conferente e a hora.
- **Link de visualização 3D** (`ver.html`): o cliente ou o conferente vê o plano no celular, sem editar:
  - girar o 3D;
  - tocar num volume para ver os dados;
  - passo a passo do carregamento.
  Envio por WhatsApp ou QR Code.
- **Importar Excel (.xlsx)** direto na janela da carga. Colunas reconhecidas sozinhas, inclusive nomes do TOTVS (it-codigo, desc-item, qt-pedida), com medidas em m, cm ou mm.
- **Cargas fora de padrão:** containers 20'/40' Open Top e Flat Rack e Prancha 3 eixos. A carga pode passar da altura do container (OOG), com aviso.

## ⛽ Combustíveis & Abastecimento

Preços oficiais da ANP para diesel S-10 e S-500, gasolina comum e aditivada, etanol e GNV, com atualização **semanal** sobre uma amostra de cerca de 400 municípios, baixados sozinhos pelo servidor (`npm start`). A aba mostra:

- médias do Brasil, das UFs e das cidades;
- dólar (PTAX/Banco Central), petróleo Brent e preço da Petrobras, com gráfico comparativo e alertas;
- postos com CNPJ e endereço;
- histórico e mudanças de preço;
- mapa;
- custo de diesel da viagem.

Para desligar a busca automática, use `NEXORA_COMBUSTIVEL=off`.

## 🖼 Telas

<table>
<tr>
<td width="50%"><img src="docs/montagem-3d.webp" alt="Montagem em 3D"><br><b>Montagem em 3D</b> — peso por eixo ao vivo, carroceria, vistas e animação.</td>
<td width="50%"><img src="docs/roteirizacao.webp" alt="Roteirização"><br><b>Roteirização</b> — várias entregas, ordem de descarga e mapa.</td>
</tr>
<tr>
<td><img src="docs/paletizacao.webp" alt="Paletização"><br><b>Paletização</b> — vista de cima e de lado, camadas e paletes.</td>
<td><img src="docs/regras-produto.webp" alt="Regras no cadastro"><br><b>Regras no cadastro</b> — “não viaja com”, “não vai em cima de”, “só no piso”.</td>
</tr>
<tr>
<td><img src="docs/consulta-empresa.webp" alt="Consulta de empresas"><br><b>Consulta de empresas</b> — nota de risco, ANTT/RNTRC, IBAMA e sanções.</td>
<td><img src="docs/diagrama-vinculos.webp" alt="Diagrama de vínculos"><br><b>Diagrama de vínculos</b> — arraste, zoom, tela cheia e expansão por sócio.</td>
</tr>
<tr>
<td><img src="docs/home.webp" alt="Home"><br><b>Home</b> — exemplo pronto e a carga em 4 passos.</td>
<td><img src="docs/registro-fretes.webp" alt="Registro de fretes"><br><b>Registro de fretes</b> — planilha web que vira Excel.</td>
</tr>
</table>

<details>
<summary><b>Mais telas</b> (celular, fórum, etiquetas, perigosos…)</summary>

| | |
|---|---|
| <img src="docs/celular-3d.webp" width="300" alt="Celular"> **No celular** | ![Fórum](docs/forum.webp) **Fórum** — ANTT, CIOT, frete mínimo, vale-pedágio |
| ![Etiquetas](docs/etiquetas-qr.webp) **Etiquetas com QR Code** — 8 por folha A4 | ![Perigosos](docs/produtos-perigosos.webp) **Produtos perigosos** — rótulo, painel e lembrete |
| ![Produtos](docs/produtos.webp) **Cadastro de produtos** | ![Veículos](docs/veiculos.webp) **Frota** — eixos e carroceria |
| ![Concluir](docs/roteirizacao-concluir.webp) **Concluir** — o que sai em cada entrega | ![Configurações](docs/configuracoes.webp) **Configurações** — acessibilidade, backup e tabela ANTT |
| ![Combustíveis](docs/combustivel.webp) **Combustíveis** — diesel, gasolina, etanol e GNV (ANP), dólar, Brent e Petrobras | ![Clientes](docs/clientes.webp) **Clientes** — CNPJ e CEP preenchem o endereço |
| ![Saúde](docs/saude.webp) **Saúde do sistema** — situação das fontes automáticas | <img src="docs/motorista.webp" width="240" alt="Motorista"> <img src="docs/roteirizacao-entregas.webp" width="200" alt="Entregas"> **Motorista e entregas** — link no celular, clima e feriados |

</details>

---

## 🧭 O que o NEXORA faz

### Três formas de montar a carga

| Modo | Para quê |
|---|---|
| **Mostrar Catálogo** | Pedido com produtos já cadastrados (com cotação) |
| **Montagem Rápida** | Simulação digitando medidas e pesos — ou **colando a lista do pedido** do e-mail/NF-e |
| **Roteirização** | Várias entregas em passo a passo: Rota → Carga → Frete → Concluir |

### Motor de carga
- **Encaixe:** grade exata por produto e depois *Extreme Points* nos espaços que sobram. Toda carga **começa na cabine e vai junta**, sem espaço entre fileiras.
- **Empilhamento:** níveis máximos, peso que aguenta em cima e “não empilha”; big bag só sobre big bag; bobina deitada calçada no piso.
- **Peso por eixo:** limites da Res. CONTRAN 882/2021 com as taras reais; confere como a balança (PBT até 50 t; acima, cada eixo com 12,5% de tolerância) e mostra a **multa estimada**.
- **Regras de manuseio:** frágil, pesado, perecível, alimentício, não molhar, explosivo, inflamável, corrosivo e tóxico, com incompatibilidades.
- **Regras próprias:** no **cadastro do produto** (“não viaja junto com”, “não pode ficar em cima de”, “só no piso”) e regras gerais da empresa.
- **Vários veículos:** pergunta antes de cada extra — ou **divide tudo automaticamente**. Containers nunca entram como extra.
- **Qual veículo leva tudo?** compara a frota e indica o menor que leva a carga dentro da lei.

### No 3D
- Vistas 3D, topo, lado, traseira, frente e interior; portas, paredes transparentes e espaços vazios.
- Arrastar, girar, deitar, **mover para outro veículo**, **tirar** e **recolocar** volumes, com desfazer/refazer; cada movimento é conferido (colisão, apoio, empilhamento, eixos e regras).
- **Amarração no 3D:** barras, calços e cintas — com o número de cintas calculado pela **EN 12195-1** (atrito do piso, STF da catraca e ângulo) e pela Res. CONTRAN 945.

### Números que importam
- **Peso cubado** (300/250/200/167 kg/m³) e peso para cobrança; **metros lineares de piso (LDM)**.
- **VGM do contêiner** (SOLAS, método 2) com declaração para imprimir.
- **Paletização** de caixas soltas (PBR, europeu, americano, químico, descartável).

### Facilidades do dia a dia
Duplicar plano, cores por entrega, foto do 3D, mensagem pronta para o WhatsApp, aviso de carga leve com veículo menor, “quantos mais cabem”, favoritos, modelos de carga, nome de quem montou, tema claro, dicas da primeira vez, busca no menu, botão “Nova carga” no celular e calculadoras de cubagem e de unidades.

### Saídas
Relatório A4, **passo a passo de carregamento** com desenhos, cotação, planilha CSV/Excel, **folha do motorista** por entrega, etiquetas com QR Code, link para **compartilhar o plano** e planos salvos com comparação lado a lado.

### Frete e documentos
- **Piso mínimo ANTT** (`km × CCD + CC`) — Tabelas A, B, C e D, 12 tipos de carga, 2 a 9 eixos, retorno vazio; aviso quando a carga mista exige a **tabela de maior valor**.
- **Transportador × Empregador:** prestação do CT-e (pedágio, ad valorem, GRIS, ICMS, **CBS/IBS** e o crédito do contratante) ou % do frete sobre a NF-e.
- Frete abaixo do piso: aviso de **CIOT bloqueado** (Res. ANTT 6.077/6.078/2026). Quantos **MDF-e** a viagem precisa.
- **Registros** do empregador e do transportador em planilha web, com exportação Excel.

### Consulta de empresas e sócios
- **CNPJ, nome ou pessoa** (sócio/administrador — só vínculos societários públicos, CPF sempre mascarado).
- **Nota de risco 0–100** com motivos; setor pelo CNAE.
- **Transportadoras:** RNTRC (ANTT), frota cadastrada, TRIC e OTM; anotação de **seguros RCTR-C/RC-DC** com aviso de vencimento.
- **IBAMA** (embargos), **lista suja do trabalho escravo** (planilha oficial do MTE), **OFAC e ONU**, **GLEIF/LEI**, sanções e contratos federais.
- **Diagrama interativo** de vínculos: arrastar, zoom, tela cheia, procurar, expandir por sócio e exportar SVG.

<details>
<summary><b>Fontes de dados da consulta</b></summary>

minhareceita.org · BrasilAPI · OpenCNPJ · CNPJ.ws · CNPJá · Casa dos Dados · GLEIF · Portal da Transparência/CGU · dados abertos da ANTT e do IBAMA · OFAC (Tesouro dos EUA) · Conselho de Segurança da ONU · Cadastro de Empregadores (MTE). Com `npm start` tudo passa pelo servidor, com cache em `data/`.

| Rota | Método |
|---|---|
| `/api/empresas/cnpj/:cnpj` · `/completa/:cnpj` · `/rede/:cnpj` | GET |
| `/api/empresas/busca` `{nome, uf}` · `/pessoa` `{nome, doc?, uf?}` | POST |
| `/api/empresas/listas` · `/listas/lista-suja` | GET · POST |

</details>

### Fórum da equipe
Categorias ANTT, CIOT, Frete Mínimo, Vale-Pedágio, Legislação, Transporte e Comunicados. Só o administrador cria tópicos; qualquer pessoa responde com um apelido. Dados em `data/forum.json`, com limites contra abuso.

---

## 🌐 Publicar na web

| Opção | Como | O que funciona |
|---|---|---|
| **Site estático** (grátis) | GitHub Pages (workflow pronto em `.github/workflows/pages.yml`), Netlify (`netlify.toml`) ou Vercel (`vercel.json`) — publica a pasta `public/` | Montagem 3D, roteirização, frete ANTT, registros no navegador, app instalável, uso offline e consulta por CNPJ |
| **Sistema completo** | Render.com com o `render.yaml` (*New → Blueprint*) | Tudo: fórum e registros compartilhados, busca por nome, rede de sócios, listas oficiais e cache |

> A prévia dentro do Claude bloqueia sites externos: lá a consulta de empresas não funciona. Use uma das opções acima.

---

## ⌨️ Atalhos de teclado

| Tecla | Ação | | Tecla | Ação |
|---|---|---|---|---|
| Setas | Move o volume (Shift = passo maior) | | Ctrl + Z / Y | Desfaz / refaz |
| R | Gira 90° | | Esc | Tira a seleção |
| D | Deita | | `[` e `]` | Recolhe menu / painel |
| O | Próxima orientação | | | |

No diagrama de vínculos: setas movem a vista, `+` / `−` aproximam, `0` ajusta e Esc sai da tela cheia.

---

## ♿ Acessibilidade e celular

- Auditoria **axe-core (WCAG 2 A/AA)** em todas as telas, sem falhas graves.
- Tudo funciona pelo teclado; lista de volumes com descrição falada da posição; janelas com foco preso.
- Tamanho do texto, menos movimento, foco reforçado, modos para daltonismo e alto contraste.
- Testado em celular (360–430 px), tablet, notebook e Full HD. Números com **R$ e vírgula automáticos** ao digitar.

---

## 📐 Normas e leis aplicadas

| Tema | Referência |
|---|---|
| Pesos e dimensões, tolerâncias e multa | Res. CONTRAN 882/2021 · Lei 14.229/2021 |
| Amarração de carga | Res. CONTRAN 945/2022 · Res. CONTRAN 701/2017 (bobinas) · EN 12195-1 |
| Piso mínimo de frete | Res. ANTT 5.867/2020, 6.076, 6.077, 6.078 e 6.084/2026 · Portaria SUROC 22/2026 |
| Produtos perigosos | Res. ANTT 5.998/2022 · NBR 7500, 7503 e 9735 |
| Contêiner | SOLAS cap. VI, regra 2 (VGM) · IMO MSC.1/Circ.1475 |
| Reforma tributária | LC 214/2025 · Ato Conjunto RFB/CGIBS 4/2026 (CBS/IBS no CT-e) |
| Dados pessoais | LGPD — só dados societários públicos, CPF mascarado |

<details>
<summary><b>Configurações de eixos (exemplos)</b></summary>

| Configuração | Limites por eixo | PBT/PBTC |
|---|---|---|
| Toco | 6 + 10 t | 16 t |
| Trucado | 6 + 17 t | 23 t |
| Cavalo trucado + carreta LS | 6 + 17 + 25,5 t | 48,5 t |
| Cavalo toco + vanderléia | 6 + 10 + 10 + 10 + 10 t | 46 t |
| Rodotrem 9 eixos | 6 + 17 + 17 + 17 + 17 t | 74 t |

São 23 configurações no total, ordenadas do mais leve ao mais pesado, com o selo de “fácil / médio / difícil de achar”.

</details>

> Os cálculos são apoio à decisão. Confira sempre o frete na [calculadora oficial da ANTT](https://calculadorafrete.antt.gov.br/); amarração, documentos de produtos perigosos e tributos são responsabilidade de quem carrega, transporta e da contabilidade.

---

## 🗂 Estrutura

```
nexora/
├─ server/            index.js (HTTP + APIs) · forum.js · fretes.js · empresas.js · fontes.js
├─ test/              engine · carga · palete · empresas · fretes · forum  (53 testes)
├─ docs/              capturas (WebP), demo.gif e demo.mp4
├─ DEPLOY.md          como publicar (hospedagem Node.js, VPS, domínio, HTTPS)
├─ SEGURANCA.md       proteções e cuidados ao publicar
└─ public/
   ├─ index.html · manifest.webmanifest · sw.js (app instalável e offline)
   └─ src/
      ├─ config/      veiculos.js · categorias.js · antt.js   ← ajuste sem mexer no código
      ├─ data/        5.570 municípios do IBGE · mapa do Brasil offline
      ├─ css/         base · layout · pages · responsive
      └─ js/
         ├─ core/     engine (motor) · carga (cubado, LDM, EN 12195-1, VGM) · palete · empresa · mascara · storage · xlsx
         ├─ app/      app · cena3d (Three.js) · rota · fretes · recursos · amarracao · grafo · empresas · etiquetas · perigosos · forum · a11y
         └─ pages/    uma página por arquivo
```

---

## 🧪 Testes

```bash
npm test
```

53 testes automáticos: motor de carga (encaixe, empilhamento, eixos, regras próprias, extras), cubado/LDM/cintas/VGM, paletização, consulta de empresas (fontes simuladas, CPF nunca enviado completo), fórum e registros.

---

## ⚠️ Limitações conhecidas

- Produtos, frota e planos ficam **no navegador** de quem usa — use o **backup** em Configurações.
- Sem internet a distância é estimada (linha reta × 1,25); pedágios não são calculados.
- Seguros de carga (RCTR-C/RC-DC) não existem em base pública: são anotados pelo usuário.
- Registros e fórum não têm login: use o servidor só em rede interna.

<div align="center">

---

<sub>Créditos: municípios do IBGE via kelvins/municipios-brasileiros (MIT) · mapa <a href="https://leafletjs.com">Leaflet</a> e © OpenStreetMap · rotas OSRM · 3D <a href="https://threejs.org">Three.js</a> (MIT) · QR Code qrcode-generator (MIT)</sub>

<b>NEXORA Logistics Intelligence</b> · feito com HTML, CSS, JavaScript e Node.js

</div>
