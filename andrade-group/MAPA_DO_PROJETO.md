# MAPA DO PROJETO — Andrade Group

> Documento gerado para revisão técnica externa. Descreve a arquitetura, os
> arquivos-chave e o fluxo de dados do sistema.

---

## 1. Tecnologia utilizada

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework web | Next.js (App Router) | 16.2.9 |
| Linguagem | TypeScript | ^5 |
| Estilização | Tailwind CSS | ^4 |
| Autenticação | NextAuth v5 (Auth.js beta) | ^5.0.0-beta.31 |
| Provedor OAuth | Google (openid + email + profile) | — |
| Banco de dados | Google Sheets (via API v4) | googleapis ^173 |
| Geocodificação reversa | Nominatim (OpenStreetMap) | REST público |
| Autocomplete de endereço | Nominatim (OpenStreetMap) | REST público |
| Deploy | Vercel | — |
| Runtime | Node.js (edge/serverless no Vercel) | — |
| Ícones | lucide-react | ^1.20 |

---

## 2. Estrutura de pastas

```
andrade-group/
│
├── src/
│   ├── auth.ts                        ← Configuração NextAuth (Google OAuth)
│   ├── proxy.ts                       ← (reservado)
│   │
│   ├── app/                           ← Páginas e rotas (Next.js App Router)
│   │   ├── layout.tsx                 ← Layout raiz (providers, globals)
│   │   ├── page.tsx                   ← Home pública
│   │   ├── globals.css                ← CSS global + animações
│   │   │
│   │   ├── actions/
│   │   │   └── eventos.ts             ← Server Action: criarEvento()
│   │   │
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts  ← Handler NextAuth
│   │   │   ├── eventos/route.ts             ← GET/POST /api/eventos
│   │   │   ├── eventos/[id]/route.ts        ← GET /api/eventos/:id
│   │   │   ├── checkin/route.ts             ← GET/POST /api/checkin
│   │   │   ├── inscricoes/route.ts          ← GET/POST /api/inscricoes
│   │   │   ├── vagas/route.ts               ← (descontinuada → redireciona para inscricoes)
│   │   │   ├── freelancers/route.ts         ← (reservado)
│   │   │   └── debug/route.ts               ← Diagnóstico interno
│   │   │
│   │   ├── cadastrar-eventos/page.tsx  ← Página de criação de evento (gerenciador)
│   │   ├── cadastro/[eventoId]/page.tsx ← Formulário público de cadastro do freelancer
│   │   ├── checkin/[eventoId]/page.tsx  ← Fluxo público de check-in
│   │   ├── checkout/[eventoId]/page.tsx ← Fluxo público de check-out
│   │   │
│   │   ├── gerenciador/
│   │   │   ├── login/page.tsx          ← Login Google (gerenciador)
│   │   │   ├── eventos/page.tsx        ← Lista "Meus Eventos" (protegida)
│   │   │   └── eventos/[id]/page.tsx   ← Detalhe do evento (protegida)
│   │   │
│   │   ├── eventos/page.tsx            ← (listagem pública — experimental)
│   │   ├── eventos/[id]/page.tsx       ← (detalhe público — experimental)
│   │   ├── checkinout/page.tsx         ← (histórico — experimental)
│   │   ├── cadastrar-dados/page.tsx    ← (reservado)
│   │   └── perfil/page.tsx             ← (reservado)
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx              ← Botão reutilizável
│   │   │   ├── Input.tsx               ← Campo de entrada reutilizável
│   │   │   ├── Card.tsx + CardSection  ← Card com seções
│   │   │   ├── Badge.tsx               ← Badge de status
│   │   │   ├── LinkCopy.tsx            ← Linha de link com botão "copiar"
│   │   │   └── Skeleton.tsx            ← Skeleton loader
│   │   ├── Layout/
│   │   │   ├── AppShell.tsx            ← Shell com bottom nav
│   │   │   ├── BottomNav.tsx           ← Navegação inferior
│   │   │   └── PageHeader.tsx          ← Cabeçalho de página com back
│   │   ├── CheckInOut/
│   │   │   ├── CameraCapture.tsx       ← Captura de foto via câmera
│   │   │   └── LocationCard.tsx        ← Exibição de localização GPS
│   │   └── auth/
│   │       └── AdminSessionBar.tsx     ← Barra de sessão admin
│   │
│   ├── hooks/
│   │   └── useGeolocation.ts           ← Hook para captura de GPS
│   │
│   ├── lib/
│   │   ├── google-sheets.ts            ← TODAS as operações de leitura/escrita no Sheets
│   │   ├── gerenciadores.ts            ← Auto-registro de gerenciador no 1º login
│   │   └── utils.ts                    ← generateId, formatCpf, formatPhone, vagasDisponiveis
│   │
│   └── types/
│       ├── index.ts                    ← Tipos: Evento, Inscricao, CheckInOut, EquipeVaga, etc.
│       └── next-auth.d.ts             ← Extensão do tipo Session (managerId, managerStatus)
│
├── .env.local.example                 ← Template de variáveis de ambiente (sem dados reais)
├── next.config.ts                     ← Configuração Next.js
├── postcss.config.mjs                 ← Configuração PostCSS (Tailwind)
├── tsconfig.json                      ← Configuração TypeScript
├── package.json                       ← Dependências e scripts
└── eslint.config.mjs                  ← Regras ESLint
```

---

## 3. Página usada para criar eventos

**Arquivo:** `src/app/cadastrar-eventos/page.tsx`

Rota: `/cadastrar-eventos` (acesso restrito a gerenciadores autenticados)

O formulário coleta: título, descrição, data, horário início/fim, nome do local,
endereço (com autocomplete Nominatim), vagas por equipe/tipo e valor da diária.

Ao submeter, chama a Server Action `criarEvento()` e após sucesso exibe os links
gerados para cada equipe.

---

## 4. Componente responsável pela seção "Equipes e vagas"

**Arquivo:** `src/app/cadastrar-eventos/page.tsx` — trecho interno dentro do `<form>`,
`<CardSection title="Equipes e vagas">` (linha ~333).

É uma tabela HTML inline com linhas geradas por `EQUIPES.map()` e colunas por
`TIPOS.map()`. Cada célula contém um `<input type="number">` controlado pelo
estado `vagas` (tipo `VagasMap = Record<string, string>`).

---

## 5. Onde estão definidas as equipes Brigadistas, Seguranças e Limpeza

**Arquivo:** `src/app/cadastrar-eventos/page.tsx` — constante `EQUIPES` (linha ~22):

```ts
const EQUIPES: { key: EquipeNome; label: string }[] = [
  { key: 'brigadistas', label: 'Brigadistas' },
  { key: 'segurancas',  label: 'Seguranças'  },
  { key: 'limpeza',     label: 'Limpeza'     },
]
```

O tipo `EquipeNome` é definido em `src/types/index.ts`:

```ts
export type EquipeNome = 'brigadistas' | 'segurancas' | 'limpeza'
```

Os mesmos rótulos são repetidos (com `EQUIPE_LABELS`) em:
- `src/app/cadastro/[eventoId]/page.tsx`
- `src/app/gerenciador/eventos/[id]/page.tsx`

---

## 6. Onde são definidos os campos Coordenador e Freelancer

**Arquivo:** `src/app/cadastrar-eventos/page.tsx` — constante `TIPOS` (linha ~27):

```ts
const TIPOS: { key: TipoVaga; label: string }[] = [
  { key: 'coordenador', label: 'Coordenador' },
  { key: 'freelancer',  label: 'Freelancer'  },
]
```

O tipo `TipoVaga` é definido em `src/types/index.ts`:

```ts
export type TipoVaga = 'coordenador' | 'freelancer'
```

---

## 7. Função responsável por gerar os links de inscrição

**Arquivo:** `src/app/cadastrar-eventos/page.tsx` — função `gerarLinks()` (linha ~46):

```ts
function gerarLinks(eventoId: string, vagas: VagasMap) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const links = []
  EQUIPES.forEach(e => {
    TIPOS.forEach(t => {
      const qty = Number(vagas[`${e.key}_${t.key}`] ?? 0)
      if (qty > 0) {
        links.push({
          equipe: e.key, tipo: t.key,
          label: `${e.label} — ${t.label}`,
          url: `${base}/cadastro/${eventoId}?equipe=${e.key}&tipo=${t.key}`,
        })
      }
    })
  })
  return links
}
```

Padrão do link gerado: `/cadastro/{eventoId}?equipe={equipe}&tipo={tipo}`

O mesmo padrão de URL é montado no Server Component
`src/app/gerenciador/eventos/[id]/page.tsx` (linha ~33):

```ts
url: `${baseUrl}/cadastro/${id}?equipe=${e.equipe}&tipo=${e.tipo}`
```

---

## 8. Função responsável por contar vagas

**Arquivo:** `src/lib/utils.ts` — função `vagasDisponiveis()`:

```ts
export function vagasDisponiveis(total: number, ocupadas: number) {
  return Math.max(0, total - ocupadas)
}
```

O total de vagas por evento é calculado na listagem `src/app/gerenciador/eventos/page.tsx`:

```ts
const totalVagas = e.equipes.reduce((s, eq) => s + eq.vagas, 0)
```

---

## 9. Função responsável por bloquear vagas preenchidas

Atualmente **não há um mecanismo automático de bloqueio de vagas** por concorrência.
O campo `vagasOcupadas` existe na interface `EquipeVaga` (em `src/types/index.ts`)
e é inicializado como `0` na criação do evento, mas **não é incrementado automaticamente**
quando um freelancer se inscreve.

Para bloquear vagas preenchidas seria necessário:
1. No `POST /api/inscricoes`, ler o evento, verificar `vagasOcupadas < vagas` para a
   equipe/tipo em questão, e incrementar `vagasOcupadas` na planilha.

Este é um ponto de melhoria identificado para a próxima versão.

---

## 10. Função responsável pelo cadastro do freelancer

**Arquivo:** `src/app/api/inscricoes/route.ts` — handler `POST`:

Rota: `POST /api/inscricoes`

Recebe: `{ eventoId, nome, cpf, telefone, email, pixTipo, pixChave, equipe, tipo }`

Fluxo:
1. Valida campos obrigatórios
2. Confirma que o evento existe via `getEventoById()`
3. Gera um `id` único via `generateId()`
4. Chama `appendInscricao(row)` → escreve na aba `INSCRICOES` do Sheets

A tela que aciona essa rota é: `src/app/cadastro/[eventoId]/page.tsx`

---

## 11. Arquivos responsáveis pela validação de nome, CPF, celular, e-mail e chave PIX

### Validação de presença (campos obrigatórios)

**Frontend:** `src/app/cadastro/[eventoId]/page.tsx` — função `validate()` (linha ~55):

```ts
const validate = () => {
  const e: Partial<typeof form> = {}
  if (!form.nome.trim())      e.nome      = 'Obrigatório'
  if (!form.cpf.trim())       e.cpf       = 'Obrigatório'
  if (!form.telefone.trim())  e.telefone  = 'Obrigatório'
  if (!form.email.trim())     e.email     = 'Obrigatório'
  if (!form.pixChave.trim())  e.pixChave  = 'Obrigatório'
  setErrors(e)
  return Object.keys(e).length === 0
}
```

**Backend:** `src/app/api/inscricoes/route.ts` — verificação simples de presença
de todos os campos no body (linha ~9):

```ts
if (!eventoId || !nome || !cpf || !telefone || !email || !pixChave || !equipe || !tipo) {
  return NextResponse.json({ success: false, error: 'Campos obrigatórios faltando.' }, { status: 400 })
}
```

### Formatação de CPF e telefone (máscaras)

**Arquivo:** `src/lib/utils.ts`

```ts
export function formatCpf(value: string)   // → "000.000.000-00"
export function formatPhone(value: string) // → "(00) 00000-0000"
```

> **Nota:** as funções de máscara existem em `utils.ts` mas não são aplicadas no
> formulário de cadastro atual — os campos aceitam texto livre. Validação de formato
> (CPF válido, e-mail com @, etc.) é um ponto de melhoria para a próxima versão.

---

## 12. Função responsável por gravar os dados no Google Sheets

**Arquivo:** `src/lib/google-sheets.ts`

Todas as gravações usam a função interna `sheetWriteRow()`:

```ts
async function sheetWriteRow(sheetName: string, lastCol: string, row: string[]) {
  const existing = await sheetGet(`${sheetName}!A:A`)
  const nextRow  = existing.length + 1        // posição exata após última linha
  const sheets   = getSheetsClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${nextRow}:${lastCol}${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
  return nextRow
}
```

Funções públicas de escrita:

| Função | Aba | Colunas |
|---|---|---|
| `appendEvento(row)` | Eventos | A:O (15 colunas) |
| `appendInscricao(row)` | INSCRICOES | A:K (11 colunas) |
| `appendCheckInOut(row)` | CheckInOut | A:L (12 colunas) |
| `appendGerenciador(row)` | Gerenciadores | A:E (5 colunas) — via `sheetAppend` |

A autenticação com o Sheets é feita via **Service Account** (JSON na variável
de ambiente `GOOGLE_SERVICE_ACCOUNT_JSON`), não pelo token OAuth do gerenciador.

---

## 13. Função responsável pelo check-in e check-out

**Arquivo:** `src/app/api/checkin/route.ts` — handler `POST`:

Rota: `POST /api/checkin`

Body: `{ tipoRegistro: 'checkin'|'checkout', cpf, eventoId, latitude, longitude, accuracy }`

Fluxo:
1. Valida campos obrigatórios
2. Confirma que o evento existe (`getEventoById`)
3. Busca dados do freelancer pelo CPF+eventoId (`getInscricaoByCpfEvento`) para
   enriquecer o registro com nome, equipe e tipo
4. Chama `reverseGeocode(lat, lon)` → Nominatim → retorna endereço em texto
5. Grava o registro na aba `CheckInOut` via `appendCheckInOut(row)`
6. Retorna `{ id, tipoRegistro, timestamp, nome, localRegistro }`

Schema atual da aba CheckInOut (12 colunas):
`A:id | B:eventoId | C:cpf | D:nome | E:equipe | F:tipo | G:tipoRegistro | H:localRegistro | I:latitude | J:longitude | K:accuracy | L:timestamp`

As páginas de front-end que disparam essa API:
- Check-in: `src/app/checkin/[eventoId]/page.tsx`
- Check-out: `src/app/checkout/[eventoId]/page.tsx`

---

## 14. Fluxo de dados: tela → backend → planilha

```
CADASTRO DE FREELANCER
──────────────────────
[Tela] cadastro/[eventoId]/page.tsx
  └─ fetch POST /api/inscricoes
       ├─ Valida campos
       ├─ getEventoById() → lê aba Eventos no Sheets
       ├─ generateId()
       └─ appendInscricao(row) → sheetWriteRow('INSCRICOES', 'K', row)
              └─ sheets.values.update() → Google Sheets API v4

CRIAÇÃO DE EVENTO (gerenciador)
────────────────────────────────
[Tela] cadastrar-eventos/page.tsx
  └─ Server Action: criarEvento() [src/app/actions/eventos.ts]
       ├─ auth() → verifica sessão NextAuth (JWT)
       ├─ appendEvento(row) → sheetWriteRow('Eventos', 'O', row)
       │      └─ sheets.values.update() → Google Sheets API v4
       └─ getEventoById(id) → verifica se escrita foi persistida

CHECK-IN / CHECK-OUT
─────────────────────
[Tela] checkin/[eventoId]/page.tsx  ou  checkout/[eventoId]/page.tsx
  1. Usuário informa CPF
  2. Câmera captura foto (armazenada localmente como base64 — não salva no Sheets)
  3. GPS captura lat/lon
  └─ fetch POST /api/checkin
       ├─ getEventoById() → confirma evento
       ├─ getInscricaoByCpfEvento() → busca nome/equipe/tipo do freelancer
       ├─ reverseGeocode(lat, lon) → Nominatim → endereço texto
       └─ appendCheckInOut(row) → sheetWriteRow('CheckInOut', 'L', row)

LOGIN DO GERENCIADOR
─────────────────────
[Tela] gerenciador/login/page.tsx
  └─ signIn('google') [NextAuth]
       └─ Callback jwt():
            └─ getOrCreateGerenciador() [src/lib/gerenciadores.ts]
                 ├─ getGerenciadorByEmail() → busca na aba Gerenciadores
                 └─ (se novo) appendGerenciador() → escreve na aba Gerenciadores
                 token.managerId ← id do gerenciador na planilha
```

---

## 15. Estrutura das abas no Google Sheets

### Eventos (A:O — 15 colunas)
`id | titulo | descricao | data | horaInicio | horaFim | local | endereco | latitude | longitude | equipes(JSON) | valorHora(vazio) | status | gerenciadorId | criadoEm`

### INSCRICOES (A:K — 11 colunas)
`id | eventoId | nome | cpf | telefone | email | pixTipo | pixChave | equipe | tipo | criadoEm`

### CheckInOut (A:L — 12 colunas)
`id | eventoId | cpf | nome | equipe | tipo | tipoRegistro | localRegistro | latitude | longitude | accuracy | timestamp`

### Gerenciadores (A:E — 5 colunas)
`id | nome | email | status | criadoEm`

> **Importante:** Os nomes de aba são case-sensitive para a API do Sheets.
> Não usar acentos ou cedilha nos nomes das abas.

---

## 16. Variáveis de ambiente necessárias

Ver `.env.local.example` para o template completo. As variáveis obrigatórias são:

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AUTH_SECRET
NEXTAUTH_URL
GOOGLE_SHEETS_ID
GOOGLE_SERVICE_ACCOUNT_JSON
```
