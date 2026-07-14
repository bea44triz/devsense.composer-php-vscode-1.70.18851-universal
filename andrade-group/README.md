# Andrade Group — Plataforma de Gestão de Eventos

PWA (Progressive Web App) para coordenar equipes de brigadistas, seguranças e
limpeza em eventos. Gerenciadores criam eventos, freelancers se cadastram via
link exclusivo e registram presença (check-in/check-out) com foto e GPS. Tudo
gravado automaticamente no Google Sheets.

---

## Pré-requisitos

- Node.js 20+
- Conta Google com acesso a Google Cloud Console
- Planilha Google Sheets com as abas descritas abaixo

---

## Configuração do ambiente

### 1. Copie o arquivo de variáveis de ambiente

```bash
cp .env.local.example .env.local
```

### 2. Configure o Google Cloud

**OAuth 2.0 (login dos gerenciadores)**

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto
3. Ative as APIs: **Google Sheets API** e **Google Drive API**
4. Vá em _APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID_
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://seudominio.com/api/auth/callback/google` (prod)
5. Copie **Client ID** e **Client Secret** para `.env.local`

**Service Account (leitura/escrita no Sheets)**

1. _APIs & Services → Credentials → Create Credentials → Service Account_
2. Após criar, vá em _Keys → Add Key → JSON_ e baixe o arquivo
3. Abra sua planilha → _Compartilhar_ → adicione o e-mail da service account como **Editor**
4. Cole o conteúdo do JSON na variável `GOOGLE_SERVICE_ACCOUNT_JSON` em `.env.local`

### 3. Gere o AUTH_SECRET

```bash
openssl rand -base64 32
```

Cole o resultado em `AUTH_SECRET` no `.env.local`.

### 4. Crie as abas na planilha

Crie manualmente estas abas (sem acentos nos nomes):

| Aba | Colunas (ordem) |
|---|---|
| `Gerenciadores` | id, nome, email, status, criadoEm |
| `Eventos` | id, titulo, descricao, data, horaInicio, horaFim, local, endereco, latitude, longitude, equipes(JSON), valorHora, status, gerenciadorId, criadoEm |
| `INSCRICOES` | id, eventoId, nome, cpf, telefone, email, pixTipo, pixChave, equipe, tipo, criadoEm |
| `CheckInOut` | id, eventoId, cpf, nome, equipe, tipo, tipoRegistro, localRegistro, latitude, longitude, accuracy, timestamp |

> Os nomes de aba são case-sensitive. Não use acentos nem cedilha.

---

## Instalação e execução

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

```bash
# Build de produção
npm run build
npm start
```

---

## Deploy no Vercel

1. Importe o repositório no [Vercel](https://vercel.com)
2. Adicione todas as variáveis de `.env.local` em _Settings → Environment Variables_
3. A cada push na branch principal o deploy é feito automaticamente

---

## Fluxo de uso

### Gerenciador
1. Acesse `/gerenciador/login` e entre com Google
2. Vá em `/cadastrar-eventos` para criar um evento
3. Após criar, copie os links de cadastro por equipe e os links de check-in/check-out
4. Envie os links corretos para cada grupo

### Freelancer
1. Abra o link recebido (formato `/cadastro/{eventoId}?equipe=...&tipo=...`)
2. Preencha nome, CPF, telefone, e-mail e chave PIX
3. No dia do evento, abra o link de check-in:
   - Informe o CPF
   - Tire uma foto
   - Confirme a localização GPS
4. Ao encerrar, repita o processo com o link de check-out

---

## Rotas principais

| Rota | Descrição |
|---|---|
| `/` | Home pública |
| `/gerenciador/login` | Login Google |
| `/gerenciador/eventos` | Lista de eventos do gerenciador (protegida) |
| `/gerenciador/eventos/:id` | Detalhe do evento (protegida) |
| `/cadastrar-eventos` | Criação de evento (protegida) |
| `/cadastro/:eventoId?equipe=&tipo=` | Cadastro público do freelancer |
| `/checkin/:eventoId` | Check-in público |
| `/checkout/:eventoId` | Check-out público |

## APIs

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/eventos` | Lista eventos |
| POST | `/api/eventos` | Cria evento (auth) |
| GET | `/api/eventos/:id` | Busca evento por ID |
| POST | `/api/inscricoes` | Cadastra freelancer |
| GET | `/api/inscricoes?eventoId=` | Lista inscrições do evento |
| POST | `/api/checkin` | Registra check-in ou check-out |
| GET | `/api/checkin?eventoId=` | Lista registros do evento |

---

## Documentação técnica detalhada

Ver **`MAPA_DO_PROJETO.md`** para mapeamento completo de arquivos, funções e fluxo de dados.
