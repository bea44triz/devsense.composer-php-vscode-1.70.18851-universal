# Roteiro de demonstração

Ambiente **100% local** (Postgres + PostgREST + simulador de Auth/Storage), sem Supabase remoto.

## Subir / resetar / parar

```bash
npm run demo         # sobe tudo: migrations + seed + PostgREST + Next. Mostra a URL e os logins ao final.
npm run demo:reset   # limpa só o banco (mantém tudo no ar) — use entre ensaios ou se algo travar
npm run demo:stop    # derruba a pilha local
```

`npm run demo` libera sozinho as portas 3200/3001/54321 se estiverem ocupadas por uma execução anterior — não precisa matar processo manualmente. Os dois comandos **recusam rodar** se detectarem qualquer indício de ambiente remoto ou de produção (`NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` apontando para `*.supabase.co`, ou `NODE_ENV=production`) — nesse caso abortam com uma mensagem clara, sem alterar nada.

## Acesso

| | |
|---|---|
| **URL** | http://localhost:3200 |
| **Login (coordenador)** | `demo@061.test` |
| **Senha** | `senha-teste` |
| **Login (financeiro)** | `financeiro.demo@061.test` / `senha-teste` |

O login do coordenador tem permissão para: criar evento, criar equipes, confirmar/recusar freelancer, acompanhar presença, encerrar evento, validar fechamento e enviar ao financeiro. O login do financeiro só enxerga e gerencia Contas a Pagar (mostra que o financeiro não precisa — nem consegue — mexer na operação).

## Dados já preparados (depois do `demo:reset`)

- **Empresa:** 061 Eventos (ambiente local de teste)
- **Cliente:** Cliente Demonstração
- **Centro de custo:** CC-DEMO — Demonstração
- **Nenhum evento criado** — você cria ao vivo no passo 4.

Dados fictícios válidos para usar na hora (mesmo padrão usado nos testes automatizados):

| Campo | Valor |
|---|---|
| CPF do freelancer | `123.456.789-09` |
| Nome | Freelancer Demonstração |
| Celular | `(61) 98765-4321` |
| E-mail | `freelancer@exemplo.com` |
| Tipo de PIX | CPF |
| Chave PIX | `123.456.789-09` (mesmo CPF) |

## Roteiro (passo a passo)

1. Abrir `http://localhost:3200/entrar`, logar com `demo@061.test` / `senha-teste`.
2. A Home abre em "Operação de hoje" — mostre que está vazia (nenhum evento ainda).
3. Clicar **Novo evento**.
4. Etapa 1 — preencher:
   - Código: `EV-DEMO`
   - Nome: `Evento Demonstração`
   - Cliente: **Cliente Demonstração**
   - Centro de custo: **CC-DEMO — Demonstração**
   - Data: hoje
   - Local: `Centro de Eventos`
   - Clicar **Estou no local** (usa o GPS do navegador — ver seção abaixo)
   - Clicar **Próximo: operação**
5. Etapa 2 — equipe **Segurança**: Quantidade `5`, Valor `200`, Entrada `18:00`, Saída `02:00`.
6. Clicar **+ equipe** e criar **Recepção**: Quantidade `3`, Valor `180`, Entrada `17:00`, Saída `23:00`.
7. Mostrar, antes de salvar: **8 profissionais** e **custo previsto R$ 1.540,00** (recalcula ao vivo a cada valor digitado).
8. Clicar **Criar evento**.
9. Abre o evento criado — mostre a mensagem de sucesso e os links já prontos.
10. Apontar os KPIs no topo: Necessários, Inscritos, Confirmados, Presentes, Vagas, Previsto, Confirmado, Validado.
11. Na aba **Visão Geral**, mostrar o quadro **"Previsão de gastos do evento"** — Previsto / Confirmado / Validado, por equipe e total (todos em R$ 1.540,00 / R$ 0,00 / R$ 0,00 neste ponto, antes de qualquer confirmação).
12. Na aba **Equipes**, no card **Segurança**, clicar **Copiar link**.
13. Abrir esse link numa aba anônima (ou outro navegador) — simula o celular do freelancer.
14. Preencher a inscrição com os dados fictícios acima e clicar **Quero participar** (ou **Enviar inscrição**). Mostrar a mensagem **"Cadastro recebido com sucesso"**.
15. Voltar para a aba do coordenador, ir em **Profissionais** — o freelancer aparece como **Aguardando**.
16. Clicar **Confirmar**.
17. Voltar em **Visão Geral** — o **Custo confirmado** no quadro de previsão subiu para refletir esse profissional (R$ 200,00 na linha Segurança).
18. Na aba **Equipes** (ou **Visão Geral**), copiar o **link de Check-in**.
19. Abrir esse link (mesma aba anônima do freelancer): informar o CPF, confirmar "Sou eu", tirar a foto, permitir a localização e confirmar chegada. Mostrar **"Check-in realizado com sucesso"**.
20. Voltar para o coordenador, aba **Presença** — mostra o horário de chegada e se ficou dentro/fora do raio do local.
21. No mesmo link do freelancer (ou pelo link de Check-out do evento), fazer o **check-out**. Mostrar a saída registrada na aba Presença.
22. Como coordenador, clicar **Encerrar evento**.
23. O evento muda para **"Aguardando fechamento"** — clicar para abrir o fechamento.
24. Na linha do freelancer, marcar **Trabalhou: Sim**.
25. Conferir o **valor final** calculado (diária × quantidade + adicional − desconto).
26. Voltar à **Visão Geral** — o **Custo validado** agora reflete esse valor.
27. Clicar **Enviar para financeiro**.
28. Ir em **Contas a Pagar** (menu lateral, ou aba **Financeiro** do evento).
29. Conferir na linha gerada: Nome, CPF, PIX, Tipo de PIX, Valor, Código do evento, Evento, Data, Centro de custo — tudo preenchido automaticamente, sem redigitar nada.
30. Tentar enviar ao financeiro de novo (botão no evento, ou reabrir o fechamento) — o sistema recusa com uma mensagem clara.
31. Mostrar que o total em Contas a Pagar **não duplicou**.

## Câmera e GPS

A demonstração roda com o **navegador de verdade** do computador — câmera e localização são reais, não simulados.

- **Antes de começar**, abra uma vez `http://localhost:3200` e deixe o navegador perguntar por câmera/localização num teste rápido de check-in, para já aceitar as permissões (ícone de cadeado → Permissões do site → Câmera e Localização → **Permitir**). Durante a demo ao vivo isso evita a interrupção do pop-up de permissão na frente da plateia.
- **Sem webcam disponível:** o navegador ainda assim abre o pedido de câmera; se não houver nenhuma, ele falha o passo da foto. Nesse caso, apresente a partir de um notebook com webcam, ou peça para o Chrome usar uma câmera virtual (OBS Virtual Camera, por exemplo) antes de começar.
- **Localização não disponível ou imprecisa:** em notebook sem GPS, o navegador usa geolocalização por Wi-Fi/IP, que funciona mas pode ficar longe do endereço real do evento — por isso o sistema mostra "dentro/fora do raio" sem bloquear o check-in. Para a demo, isso é esperado e pode até ser usado para mostrar o aviso "fora do raio".
- Em ambiente de apresentação (projetor, rede diferente), teste a câmera e o GPS **antes** de subir ao palco, não durante.

## Cuidados durante a apresentação

- Use duas abas (ou um navegador normal + uma aba anônima) para alternar entre "coordenador" e "freelancer" sem precisar logar e deslogar.
- Se algo sair do roteiro no meio da demo, `npm run demo:reset` recria o banco do zero em segundos sem precisar reiniciar o Next nem o navegador — as abas abertas só precisam recarregar a página.
- O evento e o freelancer são criados ao vivo; nada precisa ser desfeito manualmente entre uma demonstração e outra — é só rodar `demo:reset`.
