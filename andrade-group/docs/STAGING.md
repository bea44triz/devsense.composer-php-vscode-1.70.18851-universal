# Staging — como aplicar e validar (Marco 1 + Marco 2)

> **Regra:** tudo aqui é para o projeto Supabase de **STAGING**. Nada deve ser aplicado no Supabase de produção sem
> nova autorização. O script de validação aborta se `STAGING_CONFIRM` não bater com o projeto da URL ou se a URL for a
> de produção (`PRODUCTION_REF`).

## 1. Migrations — ordem e dependências

Aplicar **nesta ordem**, cada arquivo numa transação própria:

| # | Arquivo | O que faz | Depende de |
|---|---|---|---|
| 1 | `20260701000000_fase1_base_multitenant.sql` | grupos, empresas (Grupo Andrade, 061, MKTG), usuários, permissões, `platform_admins`, auditoria, RLS base | `auth.users` (Supabase) |
| 2 | `20260701000100_mvp_operacional.sql` | operações, eventos, equipes, pessoas, inscrições, presença, ponto fixo, contas a pagar | 1 |
| 3 | `20261007000000_marco1_correcoes_evento.sql` | validações CPF/celular/e-mail/PIX, vaga com lock, encerramento, envio ao financeiro, **bucket privado** `presence-photos` | 2 e o schema `storage` |
| 4 | `20261008000000_permissao_operacao_todos.sql` | só `ALTER TYPE … ADD VALUE 'operacao.todos'` | 1 |
| 5 | `20261008000100_seguranca_escopo_links.sql` | Super Admin só por concessão, responsáveis por operação (`operation_members`), RLS com escopo, links fortes + limite de tentativas | 4 (**precisa estar commitada antes**: o novo valor do enum é usado aqui) |
| 6 | `20261008000200_cadastros_multidia_pontos_fixos.sql` | clientes, centros de custo, fornecedores, PIX mascarado, eventos de vários dias, fluxo de Ponto Fixo | 5 |
| 7 | `20261008000300_endurecimento_privilegios.sql` | tira privilégios padrão do `anon`/`authenticated`, lista explícita de funções executáveis | 6 (tem de ser a última) |

Reprodutível do zero: o mesmo conjunto é aplicado num banco vazio a cada execução de `supabase/tests/local/run.sh` e de
`tests/e2e/stack.sh` (Postgres 16 + `supabase/tests/local/supabase_shim.sql`, que imita `auth`, `storage` e os
privilégios padrão do Supabase).

### Como aplicar no staging
Opção A — Supabase CLI (o projeto vinculado tem de ser o de staging):
```bash
supabase link --project-ref <REF_DO_STAGING>
supabase db push            # aplica só o que ainda não está em supabase_migrations.schema_migrations
supabase migration list     # conferir: as 7 migrations aparecem em Local e Remote
```
Opção B — `psql` com a connection string do staging (Settings → Database):
```bash
for m in supabase/migrations/*.sql; do psql "$STAGING_DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$m" || break; done
```

## 2. Verificações depois de aplicar

1. **Checagens estáticas** (somente leitura):
   `psql "$STAGING_DB_URL" -X -f supabase/tests/security_checks.sql` → 11/11
   (RLS em todas as tabelas, `anon` sem privilégio em tabela, SECURITY DEFINER com `search_path` fixo, funções
   executáveis pelo `anon` só as 5 públicas, PIX fora do SELECT, bucket privado…).
2. **Advisors** (Dashboard → Advisors → Security e Performance). Esperado:
   - Security: nenhum "RLS disabled", nenhum "Function search_path mutable", nenhuma tabela exposta ao `anon`.
     Avisos de SECURITY DEFINER em funções RPC são intencionais (todas checam permissão dentro e têm `search_path`).
   - Performance: avisos de índice em FK pouco usada podem aparecer; não bloqueiam.
3. **Auth → URL Configuration**: Site URL e Redirect URLs com o domínio do preview de staging.
4. **Auth → Providers → Email**: confirmar que "Allow new users to sign up" está como desejado. Mesmo aberto, um
   usuário novo **não ganha nenhum acesso** (sem empresa, sem permissão, sem Super Admin).

## 3. Primeiro Super Admin (staging e produção)

Ninguém vira Super Admin automaticamente — nem o primeiro usuário. A concessão é sempre explícita, feita por quem tem
acesso ao banco (SQL Editor / `psql` como `postgres`), e fica registrada em `audit_log`:

```sql
-- 1) crie o usuário em Authentication → Users (com e-mail confirmado)
-- 2) conceda:
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = lower('<email do super admin>')
ON CONFLICT DO NOTHING;
-- conferir
SELECT u.email, pa.created_at FROM public.platform_admins pa JOIN auth.users u ON u.id = pa.user_id;
```
Para revogar: `DELETE FROM public.platform_admins WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('<email>'));`

- Pelo app ou pela API **não é possível** se promover: `authenticated` não tem INSERT/UPDATE/DELETE em `platform_admins`.
- Super Admin **não lê dados operacionais** de nenhuma empresa sem vínculo; para operar numa empresa ele precisa ser
  vinculado a ela como qualquer usuário.
- Em **produção**, fazer o mesmo comando apenas quando a produção for autorizada, com o e-mail definitivo.

Vincular um usuário a uma empresa (enquanto a tela de usuários não existe):
```sql
INSERT INTO public.company_users (company_id, user_id) SELECT '<id da empresa>', id FROM auth.users WHERE lower(email) = lower('<email>');
INSERT INTO public.company_user_permissions (company_id, user_id, permission)
SELECT '<id da empresa>', id, unnest(ARRAY['operacao.gerenciar']::public.app_permission[]) FROM auth.users WHERE lower(email) = lower('<email>');
```
Permissões: `operacao.gerenciar` (coordenador: só eventos/pontos fixos em que é responsável) · `operacao.todos` (gestor:
vê todas as operações da empresa e define responsáveis) · `financeiro.ver` / `financeiro.gerenciar` · `consolidado.ver`
· `empresa.admin` (tudo na empresa). Empresas: Grupo Andrade `c0000000-…-0001`, 061 `…-0002`, MKTG `…-0003`.

## 4. Validação com Auth e Storage reais

### 4.1 Usuários de teste
Criar em Authentication → Users (Add user → "Auto Confirm User"), todos com a mesma senha de teste:

| Papel | E-mail | Vínculo (`tests/staging/grants.sql`) |
|---|---|---|
| Super Admin | `stg.superadmin@staging.test` | `platform_admins`, sem empresa |
| Grupo Andrade | `stg.andrade@staging.test` | Andrade: operação + todas |
| Só 061 (gestor) | `stg.gestor061@staging.test` | 061: operação + todas |
| Só MKTG | `stg.mktg@staging.test` | MKTG: operação + todas |
| Dono 061/MKTG | `stg.dono@staging.test` | 061 e MKTG: admin + consolidado |
| Coordenador A | `stg.coorda@staging.test` | 061: operação (restrito) |
| Coordenador B | `stg.coordb@staging.test` | 061: operação (restrito) |
| Financeiro | `stg.financeiro@staging.test` | 061: financeiro.gerenciar |

Depois rodar `tests/staging/grants.sql` no SQL Editor do staging (idempotente).

### 4.2 Script automático
```bash
STAGING_SUPABASE_URL=https://<ref>.supabase.co STAGING_ANON_KEY=<anon/publishable> \
STAGING_SERVICE_ROLE_KEY=<service_role do STAGING> STAGING_PASSWORD=<senha de teste> \
STAGING_CONFIRM=<ref> PRODUCTION_REF=<ref de produção> \
node tests/staging/validar-staging.mjs
```
Usa a chave publicável e o login real de cada usuário (como o app). A `service_role` só serve para subir e apagar o
arquivo de teste do Storage, na máquina de quem roda — nunca vai para o navegador. Verifica:

- A1 login real dos 8 usuários · A2 gestor cria 2 eventos (STG-…-A/B) e atribui coordenador A e B
- B1–B5 coordenador A × B: lista, abrir por ID, participantes, equipes, presença; não consegue se atribuir
- C1–C5 Andrade e MKTG não veem a 061; dono vê; Super Admin sem vínculo não lê dados; ninguém se promove
- D1 PIX integral nunca sai por SELECT; só pela RPC `person_pix` para quem tem permissão financeira
- E1 `anon` não lê nenhuma tabela · E2 token falso → resposta genérica · E3 **IP do limite de tentativas não falsificável**
- F1–F6 Storage: bucket privado, upload em `<empresa>/<evento>/arquivo.jpg`, URL assinada para quem vê o evento,
  negado para outro coordenador / outra empresa / anônimo / URL pública, usuário não grava nem apaga, exclusão pelo servidor

Ensaio local (sem Storage, que o gateway local não aplica RLS): `tests/e2e/stack.sh`, depois
`psql -d erp_e2e -f tests/staging/grants.sql` e o script com `STAGING_SUPABASE_URL=http://localhost:54321
STAGING_CONFIRM=local --sem-storage` → 16/16.

**Se E3 falhar** (o proxy do Supabase repassa o `X-Forwarded-For` enviado pelo cliente): criar uma migration trocando a
ordem em `public.request_ip()` para o cabeçalho que o staging mostrar como confiável (ver
`SELECT ip FROM public_link_attempts ORDER BY id DESC LIMIT 5` após um acesso real) e rodar de novo.

### 4.3 Roteiro manual na interface (preview apontando para o staging)
Com cada usuário da tabela acima, no navegador e no celular:
1. Super Admin: entra, não vê dados de empresa nenhuma.
2. Andrade: só Grupo Andrade, sem seletor de outras empresas.
3. Só 061 / só MKTG: só a própria empresa.
4. Dono: alterna 061/MKTG e o consolidado é somente leitura.
5. Coordenador A: vê só o evento A (lista, link direto do B dá "não encontrado", presença e fechamento só do A).
6. Financeiro: Contas a Pagar com Nome, CPF, PIX, tipo, valor, empresa, operação, competência e centro de custo.
7. Links públicos `/i/<token>` e `/p/<token>` no celular: inscrição, check-in com foto e GPS, foto aparecendo para o
   coordenador do evento.
8. Ponto Fixo "Obra X" (roteiro do Marco 2) de ponta a ponta com o usuário Andrade.

## 5. Variáveis de ambiente do app (preview de staging)

| Variável | Onde | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador + servidor | URL do **staging** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador | chave publicável do staging |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** (Preview, nunca `NEXT_PUBLIC_`) | usada só em `/api/presenca` (`src/lib/supabase/admin.ts`, `server-only`) |

`/api/presenca` lê o IP do visitante do primeiro item de `x-forwarded-for`. Na Vercel esse cabeçalho é definido pela
própria borda; em outro provedor, confirmar que o proxy sobrescreve o valor enviado pelo cliente.

## 6. Limpeza dos dados de teste (opcional, só staging)
```sql
BEGIN;
CREATE TEMP TABLE stg_ev ON COMMIT DROP AS SELECT id FROM public.events WHERE code LIKE 'STG-%';
DELETE FROM public.attendance         WHERE participant_id IN (SELECT id FROM public.event_participants WHERE event_id IN (SELECT id FROM stg_ev));
DELETE FROM public.event_participants WHERE event_id IN (SELECT id FROM stg_ev);
DELETE FROM public.event_teams        WHERE event_id IN (SELECT id FROM stg_ev);
DELETE FROM public.operation_members  WHERE operation_id IN (SELECT id FROM stg_ev);
DELETE FROM public.events             WHERE id IN (SELECT id FROM stg_ev);
DELETE FROM public.operations         WHERE id IN (SELECT id FROM stg_ev);
DELETE FROM public.people             WHERE email LIKE '%@staging.test';
COMMIT;
```
Os usuários de teste podem ser removidos em Authentication → Users.
