# Publicar o NEXORA na internet

O NEXORA precisa de **Node.js 18 ou mais novo** e de uma **pasta onde possa gravar arquivos**: dados sincronizados, backups, preços da ANP e viagens. Não usa banco de dados nem instala dependências (`npm install` não baixa nada).

## Variáveis de ambiente

| Variável | Para que serve | Exemplo |
|---|---|---|
| `PORT` | Porta do servidor. Muitas hospedagens definem sozinhas. | `3000` |
| `NEXORA_DADOS` | Pasta dos dados. Use uma pasta **fora** do código, para não perder nada ao publicar uma versão nova. | `/home/usuario/nexora-dados` |
| `NEXORA_CHAVE` | Chave de acesso dos outros aparelhos. Se não definir, o sistema gera uma e grava em `NEXORA_DADOS/chave.txt`. | `NX-MINHA-CHAVE-123` |
| `NEXORA_ADMIN_SENHA` | Senha do administrador do fórum. | — |
| `NEXORA_EXIGIR_CHAVE` | `1` passa a pedir a chave também no próprio servidor (localhost). Use se a hospedagem não repassar o IP real do visitante. | `1` |
| `NEXORA_COMBUSTIVEL` | `off` desliga as buscas automáticas de preços. | — |

**Chave de acesso.** No seu computador (`localhost`) o NEXORA não pede chave. Na internet, cada aparelho pede a chave uma vez e depois lembra dela. Quem não tiver a chave vê só as telas, sem os seus dados. A única exceção é o motorista: o link de entrega já leva a permissão daquela viagem.

## Opção 1 — Hospedagem de web app Node.js (mais barata)

Nesse tipo de plano, o app "dorme" quando ninguém acessa. As atualizações automáticas continuam funcionando por um **agendador (cron)** que chama o NEXORA de hora em hora.

1. No painel da hospedagem, crie um app Node.js e ligue-o ao seu repositório do GitHub, ou envie o zip.
2. Comando de início: `npm start`. Não há etapa de build.
3. Defina as variáveis `NEXORA_DADOS` (pasta persistente, fora da pasta do app) e `NEXORA_CHAVE`.
4. Crie um **cron job** de hora em hora com o comando abaixo, trocando o domínio e a chave:

   ```
   curl -s -H "X-Nexora-Chave: SUA_CHAVE" "https://SEU-DOMINIO.com.br/api/cron" > /dev/null
   ```

   Se o painel aceitar só uma URL, use `https://SEU-DOMINIO.com.br/api/cron?chave=SUA_CHAVE`. Funciona, mas a chave pode ficar gravada nos registros de acesso da hospedagem; por isso, prefira o cabeçalho.
5. Abra **Saúde do sistema** no NEXORA e clique em **Testar tudo agora**. Todas as fontes devem ficar verdes.

> Os nomes dos menus mudam de uma hospedagem para outra. Procure por "Node.js", "variáveis de ambiente" e "cron jobs / tarefas agendadas".

## Opção 2 — VPS (Ubuntu), servidor só seu

```bash
# 1. Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
sudo npm install -g pm2

# 2. Código e pasta de dados
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git ~/nexora
mkdir -p ~/nexora-dados

# 3. Iniciar e manter ligado (reinicia sozinho e volta após reboot)
cd ~/nexora
NEXORA_DADOS=~/nexora-dados NEXORA_CHAVE='NX-MINHA-CHAVE-123' PORT=3000 pm2 start server/index.js --name nexora
pm2 save && pm2 startup   # rode o comando que ele mostrar
```

Configuração do Nginx em `/etc/nginx/sites-available/nexora`:

```nginx
server {
  server_name SEU-DOMINIO.com.br www.SEU-DOMINIO.com.br;
  client_max_body_size 60m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nexora /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU-DOMINIO.com.br -d www.SEU-DOMINIO.com.br   # cadeado HTTPS grátis
```

Na VPS não precisa de cron: o próprio NEXORA agenda as atualizações. Para atualizar o sistema:

```bash
cd ~/nexora && git pull && pm2 restart nexora
```

## Domínio (Registro.br)

No painel do Registro.br, abra o domínio, depois **DNS** e **Editar zona**. Crie um registro **A** para `@` e outro para `www`, os dois com o **IP da VPS** ou o endereço indicado pela hospedagem. A propagação leva de minutos a algumas horas.

## Backup

- O servidor guarda **um backup por dia** em `NEXORA_DADOS/backups`, com os 30 dias mais recentes.
- Para guardar uma cópia fora do servidor, vá em **Configurações**, depois **Baixar backup completo**.
- Em **Restaurar backup**, você volta qualquer arquivo. Antes de restaurar, o estado atual também é salvo.
