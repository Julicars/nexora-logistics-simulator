# Segurança do NEXORA

## O que já vem protegido

| Área | Proteção |
|---|---|
| **Dados** (produtos, frota, planos, clientes, fretes, viagens) | Na internet, só quem tem a **chave de acesso** lê ou altera os dados. A chave é comparada em tempo constante. Depois de **10 chaves erradas em 15 min**, aquele endereço fica bloqueado por 15 min. |
| **Chave** | Fica em `NEXORA_CHAVE` ou em `data/chave.txt`, arquivo com permissão só do dono (600). Aparece apenas no terminal do servidor. |
| **Motorista** | O link traz um token aleatório de 72 bits que vale só para aquela viagem. O motorista não vê outras viagens nem os dados do sistema. As viagens são apagadas depois de 120 dias. |
| **Fotos** | Só são aceitas imagens JPEG de até 2,5 MB, conferidas pelo conteúdo do arquivo (não pelo nome). |
| **CSRF** | Alterações na API só são aceitas vindas de páginas do próprio NEXORA. Outro site não consegue apagar ou trocar seus dados, nem com o servidor rodando no seu computador. |
| **XSS** | Todo texto digitado é "escapado" antes de aparecer na tela. A **CSP** só permite scripts do próprio site e do three.js, sem plugins (`object-src 'none'`), sem `<base>` externo e sem envio de formulários para fora. |
| **Cabeçalhos** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: same-origin` (o link do motorista não vaza para o Google Maps), `Permissions-Policy` (só localização e câmera), `Cross-Origin-Opener-Policy` e HSTS quando o acesso é por HTTPS. |
| **Arquivos** | O servidor só entrega a pasta `public/`. Tentativas de sair dela (`../`) e arquivos ocultos (`.env`, `.git`) são bloqueadas. A pasta `data/` nunca é servida. |
| **Tamanho dos envios** | Limites por rota (formulários de 10 KB, backup de 60 MB) para impedir que alguém derrube o servidor com envios gigantes. |
| **Fórum** | Senha de administrador, limite de 20 escritas por minuto e de 5 tentativas de senha por minuto por IP. |
| **LGPD** | O CPF é sempre mascarado. Não há consulta de dados pessoais além dos vínculos societários públicos. Os backups ficam só no seu servidor. |

## O que você precisa fazer ao publicar

1. **Use HTTPS** (Let's Encrypt é grátis; veja o DEPLOY.md). Sem HTTPS, a chave trafega aberta.
2. **Defina `NEXORA_CHAVE`** com uma chave longa (12 caracteres ou mais) e não compartilhe em grupos.
3. Se a hospedagem **não** repassar o IP real (`X-Forwarded-For`), defina `NEXORA_EXIGIR_CHAVE=1`.
4. Guarde `NEXORA_DADOS` **fora** da pasta do código e baixe um backup de vez em quando (Configurações → Baixar backup).
5. Para trocar a chave: mude `NEXORA_CHAVE` (ou apague `data/chave.txt`) e reinicie o servidor. Os aparelhos vão pedir a chave nova.

## Limitações conhecidas

- **Não há login por usuário.** Todos que têm a chave têm o mesmo acesso.
- **O three.js vem de CDN** (cdnjs/jsdelivr) sem verificação de integridade (SRI). Para eliminar essa dependência externa, dá para copiar o arquivo para `public/src/vendor/`.
- **Os dados em `data/` não são criptografados no disco.** Proteja o acesso ao servidor (SSH com chave, firewall).
