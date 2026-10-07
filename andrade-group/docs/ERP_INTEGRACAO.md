# ERP Operacional de Eventos e Pontos Fixos — Integração Andrade × Lovable

> **A** = projeto Andrade atual (este repositório, Next.js).
> **B** = código exportado do Lovable (TanStack Start + Supabase), analisado a partir do ZIP.
>
> Auditoria feita sobre o código real, não sobre o resumo do Lovable. As migrations do B foram aplicadas em um
> Postgres 16 local, com um shim mínimo do Supabase, e `supabase/tests/isolation_fase1.sql` passou **28/28**.

## 1. Tabela comparativa

| Área | A — Andrade atual | B — Lovable | Decisão final |
|---|---|---|---|
| Stack | Next.js 16 (App Router), React 19, Tailwind 4 | TanStack Start + Vite + shadcn/ui, Cloudflare/nitro | **Manter Next.js (A).** Nada de converter para TanStack Start. Do B entram lógica, SQL e regras, sem o framework |
| Build | `tsc`, `next build` OK | `vite build` passa depois de remover o `overrides.rolldown` (o `npm install` quebra com ele). `tsc` estrito falha em 4 pontos de `eventos.index`/`eventos.novo` (`exactOptionalPropertyTypes`, `noImplicitReturns`). São tipos, não lógica | Código do B aproveitável; os erros não afetam o que será portado |
| Auth | NextAuth + Google, só para "gerenciador"; qualquer conta Google vira gerenciador ativo | Supabase Auth (e-mail/senha). O primeiro usuário vira Super Admin (trigger) | **Supabase Auth** no ERP novo. NextAuth fica só nas telas legadas até o corte. Trocar o "primeiro usuário = Super Admin" por seed explícito antes de produção |
| Banco | Google Sheets (4 abas) | Supabase Postgres com RLS em todas as tabelas | **Supabase (B)**. Sheets fica só no legado até o corte |
| Tenant | Inexistente | `client_groups.domains/slug`, `resolve_tenant` (não revela outros tenants), `my_tenants`, `?tenant=` em dev | **Manter B** (pronto para `andrade.…` e `gestao061mktg.…`) |
| Empresas | Inexistente | `companies` (grupo, CNPJ, cor, bloqueio de titular divergente), FK `(id, group_id)` | **Manter B** |
| Permissões | Nenhuma (só "logado") | `company_users` + `company_user_permissions` (enum), `group_memberships` só governança, `has_company_permission`, `can_view_consolidated` | **Manter B.** Escopo por evento (coordenador vê só seus eventos) fica para um marco seguinte |
| Contas bancárias | — | `bank_accounts` com FK `(id, company_id)`, titular divergente com justificativa, permissão e bloqueio | **Manter B** |
| Integridade entre empresas | — | FKs compostas `(x_id, company_id)` em tudo, `company_id` imutável (trigger) | **Manter B**, é a principal proteção |
| Eventos | Aba `Eventos` com equipes em JSON; criação em 1 tela; endereço com autocomplete (Nominatim) | `operations` (supertipo EVENTO/PONTO_FIXO) + `events` + `event_teams`; criação em 2 etapas; tokens de check-in/out | **Modelo do B + UX do A**: cadastro em 2 etapas, cards, autocomplete de endereço do A |
| Equipes | Slug, label com acento, vagas, diária | `event_teams` (quantidade, valor, coordenador, horário, `invite_token`) | **B**. A equipe é identificada pelo token, então o slug do A deixa de ser chave |
| Pessoas | Dados repetidos em cada inscrição | `people` por empresa, `unique(company_id, cpf)` | **B (por empresa).** Atende "freelancers próprios, compartilháveis só por regra explícita" |
| Inscrição | `/cadastro/[eventoId]?equipe=&tipo=`: validações completas, "Indisponível", revalidação no servidor | `/i/:token` + `public_invite_info/lookup/register` (SECURITY DEFINER, anon). Cadastro ≠ contratação (`aguardando`) | **RPCs do B, corrigidas** (ver 3) **+ visual e validações do A** |
| Confirmação | — | Trigger de capacidade só conta `confirmado` | **B + trava `FOR UPDATE`** |
| Presença | `/checkin` e `/checkout`: CPF → foto → GPS. **Foto não era salva**; CPF não conferido | `/p/:token` + `record_presence` (só `service_role`) + server fn que salva a foto no bucket privado; distância/raio por haversine; check-out exige check-in | **B**, server fn vira Route Handler do Next. Fluxo e visual do A |
| Storage | — | Bucket `presence-photos` com política de leitura por empresa; o bucket **não é criado** na migration | **B + migration que cria o bucket privado** |
| Fechamento | — | `worked/days/rate/addition/discount` → `final_amount` gerado; `event_send_to_finance` gera `payables` sem duplicar | **B + etapa "Aguardando fechamento"** (encerrar evento antes de validar) |
| Pontos Fixos | — | Tabelas completas (posto, membros, competência, itens) + `fixed_post_open_period` / `fixed_post_send_period`. **Sem tela** | **B no banco**; telas no Marco 2 |
| Financeiro | — | `payables` com snapshot (nome, documento, PIX, código, operação, data, centro de custo), `origin`, FKs compostas; status enum | **B.** Tela Contas a Pagar no Marco 1 só lista; aprovar/pagar no Marco 3 |
| Auditoria | — | `audit_log` genérico por trigger | **Manter B** |
| Interface | Mobile-first, cards, âmbar, bottom nav — mais próxima do produto | Corporativa/financeira, sidebar densa | **Evoluir A**: home operacional, cards grandes de evento, data/local em destaque, progresso de equipe |
| Testes | Testes ad hoc das rotas (emulador do Sheets) | `isolation_fase1.sql` (A–H) + vitest de regras | **Manter os dois**, adaptados; novo teste SQL do fluxo vertical |

## 2. Mapa do banco (B → final)

| Objeto Lovable | Final | Decisão |
|---|---|---|
| `platform_admins`, `profiles`, `client_groups`, `companies`, `group_memberships`, `company_users`, `company_user_permissions` | mesmos | **MANTER** |
| `bank_accounts` + `bank_accounts_validate` | mesmos | **MANTER** |
| `operations` (supertipo) | mesmo | **MANTER** |
| `payables` | mesmo | **MANTER** (status e campos de aprovação/pagamento evoluem no Marco 3) |
| `audit_log` + `audit_row`, `lock_company_id` | mesmos | **MANTER** |
| `people` | mesmo | **MANTER** |
| `events`, `event_teams`, `event_participants`, `attendance` | mesmos | **MANTER** + correções em 0002 |
| `fixed_posts`, `fixed_post_members`, `fixed_post_periods`, `fixed_post_period_items` | mesmos | **MANTER** (telas no Marco 2) |
| `client_name`, `cost_center`, `manager_name`, `coordinator_name` (texto livre) | Tabelas `clientes`/`centros_custo` e responsável como usuário | **ALTERAR depois** (Marco 3/4). No Marco 1 continuam texto |
| RPC `resolve_tenant`, `my_tenants`, `my_company_context`, `can_view_consolidated`, `add_company_user` | mesmas | **MANTER** |
| RPC `public_invite_info` | mesma | **MANTER** |
| RPC `public_invite_lookup` | mesma | **MANTER** (risco de enumeração anotado em 4) |
| RPC `public_invite_register` | redefinida em 0002 | **ALTERAR**: valida CPF/celular/e-mail/PIX no banco, normaliza PIX, trava a equipe |
| Trigger `event_participants_capacity` | redefinido em 0002 | **ALTERAR**: `FOR UPDATE` na equipe (sem corrida pela última vaga) |
| RPC `public_presence_info/lookup`, `record_presence`, `presence_photo_company` | mesmas | **MANTER** |
| RPC `event_send_to_finance` | redefinida em 0002 | **ALTERAR**: exige evento "aguardando_fechamento" |
| — | `event_finish(_event_id)` | **NOVO**: encerra a presença e abre o fechamento |
| RPC `fixed_post_*` | mesmas | **MANTER** |
| `handle_new_user` (1º usuário = Super Admin) | mesmo por ora | **ALTERAR antes de produção** (seed explícito) |
| Política `presence_photos_read` | mesma + bucket criado em 0002 | **MANTER** |
| `drizzle/` (journal/snapshots) | `supabase/migrations/*.sql` | **DESCARTAR** o Drizzle; as migrations SQL viram a fonte |

## 3. O que permanece, entra e sai

**Permanece do Andrade:** Next.js, layout e componentes mobile-first, validações (`lib/utils.ts`), máscaras, autocomplete de endereço, fluxo câmera → GPS e todas as telas legadas (Sheets) até o corte validado.

**Incorporado do Lovable:**
- migrations 0000/0001;
- teste de isolamento;
- `environment-rules`, `tenant`, `environment` (provider), `ops`, `ops-data`;
- lógica das páginas `/i/:token` e `/p/:token`;
- server fn de presença (vira Route Handler);
- cadastro em 2 etapas;
- `LinkActions` (copiar, compartilhar, QR).

**Descartado do Lovable:** TanStack Start/Router, shadcn completo, `integrations/lovable`, `auth-middleware`/`cron-auth`, Drizzle, layout e menu financeiros, telas Empresas/Usuários/Contas no visual do Lovable (serão refeitas no visual do A quando forem priorizadas).

**Reconstruído:** Home operacional, lista de eventos (cards | lista), página do evento (abas), painel de presença por equipe, fechamento operacional, Contas a Pagar, Pontos Fixos (Marco 2), perfil do profissional.

## 4. Riscos encontrados no B

| Risco | Severidade | Tratamento |
|---|---|---|
| `public_invite_register` validava só o tamanho do CPF; PIX, celular e e-mail sem validação no banco | Alta | **Corrigido em 0002** |
| Corrida na última vaga (contagem sem trava) | Média | **Corrigido em 0002** (`FOR UPDATE` na equipe) |
| `public_invite_lookup` revela o primeiro nome e dicas de contato de quem tem cadastro na empresa, sabendo só o CPF | Média (LGPD) | Mantido para "Encontramos seu cadastro". **Pendente:** limite de tentativas por IP/CPF |
| Qualquer pessoa com o CPF pode trocar o PIX de um cadastro existente pelo link | Média | B já marca `pix_updated_publicly_at` e o lançamento nasce **pendente de validação**. Mantido |
| 1º usuário vira Super Admin | Alta em produção | Trocar por seed explícito antes do deploy |
| Bucket `presence-photos` não criado na migration | Média | **Corrigido em 0002** |
| `attendance` único por participante e tipo: evento de vários dias não suporta vários check-ins | Baixa (evento é de 1 data) | Anotado |
| Coordenador vê todos os eventos da empresa | Média | Escopo por evento num marco seguinte |

## 5. Arquitetura final

```
Next.js (andrade-group)
├─ ERP novo (Supabase Auth, client components + supabase-js, RLS)
│   /entrar  /  /eventos  /eventos/novo  /eventos/[id]  /eventos/[id]/fechamento
│   /financeiro/contas-a-pagar  /pontos-fixos (Marco 2)  …
├─ Páginas públicas (sem login, RPCs SECURITY DEFINER com token)
│   /i/[token]  inscrição      /p/[token]  check-in/out
├─ Route Handler /api/presenca → service_role SÓ no servidor (foto no Storage + record_presence)
└─ Legado (Sheets + NextAuth), intacto até o corte:
    /gerenciador/*  /cadastrar-eventos  /cadastro/[eventoId]  /checkin/[eventoId]  /checkout/[eventoId]

Supabase: supabase/migrations/*.sql (fonte única) · RLS · FKs compostas · Storage privado
Testes:   supabase/tests/isolation_fase1.sql · supabase/tests/marco1_fluxo_evento.sql
```

- O `service_role` só existe em `SUPABASE_SERVICE_ROLE_KEY`, lido em `src/lib/supabase/admin.ts` (com `server-only`).
- O navegador usa só a chave publicável.

## 6. Plano de implementação

| Marco | Entrega |
|---|---|
| **1 — Evento vertical** | Criar evento → equipes → links → inscrição → confirmação → check-in → check-out → encerrar → validar → gerar contas a pagar |
| 2 — Ponto Fixo vertical | Criar ponto → alocar → abrir competência → ajustar → validar → enviar ao financeiro |
| 3 — Financeiro | Conferir, corrigir, aprovar, escolher conta bancária, agendar, pagar, comprovante |
| 4 — Cadastros e governança | Clientes, centros de custo, categorias, perfil do profissional, escopo do coordenador, telas admin no visual novo |
| 5 — Corte do legado | Migrar dados do Sheets (staging), redirecionar links antigos, desligar NextAuth/Sheets |

**Regras de trabalho:**
- Push só na branch de trabalho autorizada; nada de merge, release, deploy, DNS ou alteração no Supabase de produção sem autorização.
- Migrations são testadas em Postgres local com `supabase/tests/local/supabase_shim.sql`.
- Antes de aplicar no remoto: `supabase db lint` / advisors e os testes de RLS no staging.

## 7. Marco 1 — como configurar e testar

### Variáveis de ambiente (ERP novo)
| Variável | Onde | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador + servidor | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador | chave **publicável** (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | usada apenas em `/api/presenca` (`src/lib/supabase/admin.ts`, protegido por `server-only`) |

As variáveis do legado (`GOOGLE_*`, `AUTH_SECRET`, `NEXTAUTH_URL`) continuam valendo para `/gerenciador/*`. Sem as variáveis do Supabase, o ERP mostra um aviso e o legado segue funcionando.

### Primeiro acesso (depois de aplicar as migrations)
Ainda não há tela de usuários (Marco 4). Primeiro Super Admin, vínculos e permissões: ver `docs/STAGING.md` §3.

### Testes
| Teste | Comando | Resultado no Marco 1 |
|---|---|---|
| Migrations + isolamento + fluxo SQL | `PGHOST=… PGPORT=… PGUSER=… supabase/tests/local/run.sh` | 28/28 isolamento · 45/45 fluxo |
| Concorrência da última vaga | duas sessões confirmando ao mesmo tempo | só 1 confirmada; a outra recebe "Equipe completa" |
| E2E pela interface | `tests/e2e/stack.sh` e depois `node tests/e2e/marco1.e2e.mjs` | 19/19 etapas |

**Sobre o E2E:**
- Roda uma pilha 100% local: Postgres + PostgREST real + um gateway que imita Auth e Storage.
- **Valida:** telas, RLS, RPCs e a regra de não expor o `service_role`.
- **Não valida:** o GoTrue nem o Storage reais do Supabase. Para isso é preciso o staging.

## 8. Marco 2 — segurança, cadastros e Pontos Fixos

Aplicação e validação no staging: **`docs/STAGING.md`**.

### Migrations novas
| Arquivo | Conteúdo |
|---|---|
| `20261008000000_permissao_operacao_todos.sql` | permissão `operacao.todos` (gestor vê todas as operações da empresa) |
| `20261008000100_seguranca_escopo_links.sql` | Super Admin só por concessão explícita (com auditoria); `operation_members` (responsável/coordenador/líder por evento ou ponto fixo); RLS com escopo em operações, eventos, equipes, participantes, presença, pontos fixos, competências, itens, contas a pagar, pessoas e fotos; tokens de 64 hex + `rotate_link`; `public_link_attempts` com limite por IP/CPF e respostas genéricas |
| `20261008000200_cadastros_multidia_pontos_fixos.sql` | `clientes_evento`, `centros_custo` (origem interno/conta_azul/importacao), `fornecedores`; PIX só mascarado no SELECT (`has_pix`, `pix_key_masked`; integral só via `person_pix`/`fornecedor_pix` com permissão financeira); eventos com `end_date`, presença por **dia** (`work_date`) sem nova inscrição; fechamento conta dias com check-in; fluxo de Ponto Fixo (criar, alocar, abrir/validar/reabrir/enviar competência) |
| `20261008000300_endurecimento_privilegios.sql` | `anon` sem privilégio em tabelas, lista explícita de funções executáveis, sem TRUNCATE/TRIGGER/REFERENCES para `authenticated`, privilégios padrão revogados |

### Regras de acesso
- **Coordenador** (`operacao.gerenciar` sem `operacao.todos`): só operações em que está em `operation_members` —
  lista, abrir por ID, equipes, profissionais, presença, fotos, fechamento e contas a pagar dessas operações. Quem cria
  um evento/ponto fixo vira responsável automaticamente.
- **Gestor** (`operacao.todos`) e `empresa.admin`: todas as operações da empresa; definem os responsáveis.
- **Financeiro**: `financeiro.gerenciar` vê todas as contas da empresa; `financeiro.ver` só das operações do seu escopo.
- **Cadastros** (clientes, centros de custo, fornecedores): escrita para gestor/admin/financeiro; leitura para quem opera.

### Telas
Pontos Fixos (lista em cards, novo, página com Resumo · Profissionais · Competências · Financeiro · Documentos ·
Histórico), Pessoas/Freelancers (lista com CPF parcialmente oculto + perfil com Dados · Eventos · Pontos Fixos ·
Presença · Financeiro · Documentos), Fornecedores, Clientes, Centros de Custo; responsáveis no resumo do evento;
"Novo link" (revogação) nas equipes e na presença; seletor de dia na presença de eventos de vários dias.

### Testes
| Teste | Comando | Resultado |
|---|---|---|
| SQL (migrations do zero + isolamento + Marco 1 + Marco 2 + checagens) | `PGHOST=… PGPORT=… PGUSER=… supabase/tests/local/run.sh` | 28/28 · 45/45 · 66/66 · 11/11 |
| E2E Marco 1 | `tests/e2e/stack.sh` → `node tests/e2e/marco1.e2e.mjs` | 19/19 |
| E2E Marco 2 (Obra X, 5 profissionais, Out/2026 → 5 contas a pagar) | `tests/e2e/reset-db.sh` → `node tests/e2e/marco2.e2e.mjs` | 11/11 |
| Staging (Auth + Storage reais) | `node tests/staging/validar-staging.mjs` | ensaiado localmente 16/16 sem Storage; **pendente no staging** |
