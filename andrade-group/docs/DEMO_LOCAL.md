# Modo demonstração local (sem Supabase, sem PostgreSQL, sem Docker, sem WSL)

Este é o modo para **abrir e demonstrar o ERP no seu computador agora**, sem configurar nenhum
banco de dados. Ele é independente do `npm run demo` (que já existia e sobe uma pilha local real de
Postgres + PostgREST) — aquele continua funcionando exatamente como antes, para quem já tem esse
ambiente configurado. Este modo novo não exige nada disso.

## Como abrir

```bash
npm install          # uma vez só
npm run dev:demo
```

Abra **http://localhost:3000**.

Para zerar os dados de teste sem derrubar o servidor:

```bash
npm run dev:demo:reset
```

## Logins

| Papel | E-mail | Senha |
|---|---|---|
| Coordenador (operação) | `demo@061.test` | `senha-teste` |
| Financeiro | `financeiro.demo@061.test` | `senha-teste` |

O coordenador cria e gerencia eventos, equipes, presença e fechamento. O financeiro só enxerga e
confere Contas a Pagar — exatamente a separação de papéis do ERP real.

## O que muda em relação ao modo real

Em produção (ou com `npm run dev` normal), o ERP continua 100% Supabase: cliente Postgres via
`@supabase/supabase-js`, RLS, Auth por e-mail/senha, Storage para fotos de presença. Nada disso foi
alterado.

O modo demo troca só a **camada de dados**, em dois pontos de entrada já existentes no código:

- `src/lib/supabase/client.ts` (`getSupabase()`, usado no navegador)
- `src/lib/supabase/admin.ts` (`getSupabaseAdmin()`, usado só por `src/app/api/presenca/route.ts`)

Quando `ERP_DEMO_MODE=true` (variável só de servidor) e `NEXT_PUBLIC_ERP_DEMO_MODE=true` (mesma
variável, visível também no navegador), essas duas funções devolvem um cliente local
(`src/lib/demo/mock-client.ts` no navegador, chamadas diretas em `src/app/api/presenca/route.ts`) em
vez de criar uma conexão real com `@supabase/supabase-js`. Nenhuma tela foi reconstruída: as mesmas
páginas, os mesmos componentes e as mesmas funções de `src/lib/erp/*-data.ts` continuam rodando sem
alteração — elas só passam a falar com um "banco" local.

Esse banco local vive em `src/lib/demo/`:

- `store.server.ts` — os dados em memória (eventos, equipes, pessoas, contas a pagar etc.), com
  persistência em `.demo-data/db.json` (gitignored) para sobreviver a reinícios do servidor.
- `query.server.ts` — reimplementa, para as tabelas que o app lê/grava, o mínimo necessário do
  PostgREST (`select`, `eq`, `in`, `like/ilike`, `order`, `update`, `insert`).
- `rpcs.server.ts` — reimplementa em TypeScript as funções do Postgres (`event_create`,
  `event_send_to_finance`, `public_invite_register`, `record_presence`, `fixed_post_send_period` etc.)
  que o app chama via `.rpc(...)`.
- `src/app/api/demo/route.ts` — a rota que o cliente do navegador chama no lugar do Supabase remoto
  (por isso duas abas — gestor e freelancer — enxergam os mesmos dados ao vivo, como aconteceria
  contra um Supabase de verdade).

## Segurança

- `ERP_DEMO_MODE`/`NEXT_PUBLIC_ERP_DEMO_MODE` só existem quando você roda `npm run dev:demo` — o
  script (`scripts/dev-demo.mjs`) as define antes de subir `next dev` e nunca grava nada em disco.
- Dupla trava: mesmo que essas variáveis vazem para um ambiente de produção por engano, o modo demo
  **nunca** ativa quando `NODE_ENV==='production'` (checado em `src/lib/demo/config.ts`, em todo
  ponto de entrada do modo demo, e validado manualmente: `next build && next start` com as duas
  variáveis presentes volta a exigir Supabase de verdade).
- Nenhuma chave do Supabase real é lida ou usada neste modo — `scripts/dev-demo.mjs` zera as
  variáveis `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_URL`/
  `SUPABASE_SERVICE_ROLE_KEY` no processo que ele sobe, mesmo que existam num `.env.local`.
- Os dados ficam só em `.demo-data/db.json`, local, nunca enviados a um serviço externo.

## Câmera e GPS

Os links públicos de check-in/check-out (`/p/[token]`) continuam pedindo câmera e localização reais
do navegador. Quando não há webcam/GPS disponível (ou para agilizar o ensaio), aparecem dois botões
extras, **só em modo demo** e claramente identificados:

- **"Simular foto (modo demo)"** — gera uma imagem local, sem usar a câmera.
- **"Simular localização (modo demo)"** — usa as coordenadas do evento (com uma pequena variação),
  sem usar o GPS do navegador.

Esses dois botões não existem fora do modo demo (`isDemoModeClient()` é sempre `false` em produção).

## Limitações desta simulação

- **Usuários e Permissões**: o modo demo já vem com os dois usuários acima; não há envio de convite
  por e-mail — "Conceder acesso" só encontra e-mails que já existem no modo demo.
- **Pontos Fixos / Fornecedores / Clientes / Centros de Custo**: as telas e os cálculos funcionam
  (abrir competência, validar, enviar ao financeiro), mas o cadastro inicial da demo não vem com
  nenhum ponto fixo nem fornecedor de exemplo — crie-os pela própria tela, como um evento.
- Validações de negócio foram portadas da base mais importantes (CPF, celular, e-mail, PIX,
  capacidade de equipe, duplicidade de fechamento), mas o conjunto completo de regras do banco real
  (muito mais amplo — rate limiting de IP, RLS linha a linha, auditoria) não foi replicado; não é
  necessário para demonstrar o produto.
- Multiempresa/consolidado: o modo demo tem só uma empresa (não demonstra o seletor de ambiente nem
  a visão consolidada).

## Roteiro sugerido

1. Entrar como coordenador.
2. Criar um evento com uma equipe (ex.: Segurança, quantidade 2, valor 200).
3. Copiar o link de inscrição da equipe (aba Equipes → "QR Code", a URL aparece embaixo do QR).
4. Abrir esse link numa aba anônima e se inscrever com um CPF válido (ex.: `123.456.789-09`).
5. Voltar à aba do coordenador → Profissionais → Confirmar.
6. Visão Geral → conferir que o "Custo confirmado" subiu.
7. Presença → copiar o link de check-in, abrir na aba do freelancer, usar os botões "Simular foto" e
   "Simular localização", confirmar chegada. Repetir com o link de check-out.
8. Como coordenador: Encerrar evento → Fechamento → marcar "Trabalhou: Sim" → Salvar → Enviar para
   financeiro.
9. Contas a Pagar: conferir nome, CPF, PIX, valor, código e data já preenchidos. Tentar enviar de
   novo: o sistema recusa, sem duplicar.

Esse roteiro foi validado de ponta a ponta com dois navegadores simultâneos (coordenador e
freelancer em contextos separados) antes desta entrega.
