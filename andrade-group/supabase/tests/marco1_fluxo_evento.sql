-- Marco 1 — fluxo vertical do evento, executado como os papéis reais (authenticated / anon / service_role).
-- Criar evento → equipes → links → inscrição → confirmação → check-in → check-out → encerrar → validar → contas a pagar
-- Tudo roda dentro de uma transação e é desfeito no final (ROLLBACK).
-- CPFs usados são sintéticos, gerados pelo algoritmo (não pertencem a pessoas reais).
BEGIN;
CREATE TEMP TABLE r (test text, expected text, got text, pass boolean);
GRANT ALL ON r TO authenticated, anon, service_role;
CREATE TEMP TABLE ctx (k text PRIMARY KEY, v text);
GRANT ALL ON ctx TO authenticated, anon, service_role;

CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"anon"}', false) $$;
CREATE FUNCTION pg_temp.c(k text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM ctx WHERE ctx.k = $1 $$;

-- u1: operação + financeiro (leitura) na 061 · u2: operação na MKTG
INSERT INTO company_users(company_id, user_id) VALUES
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1'),
 ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b2');
INSERT INTO company_user_permissions VALUES
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'operacao.gerenciar'),
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'financeiro.ver'),
 ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b2', 'operacao.gerenciar');

-- cadastros da 061 (feitos pelo administrador)
INSERT INTO clientes_evento(id, company_id, razao_social, documento) VALUES ('d1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Cliente X Ltda', '11.222.333/0001-81');
INSERT INTO centros_custo(id, company_id, codigo, nome) VALUES ('d2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'CC-01', 'Eventos corporativos');

-- ===== 1) Criar evento e equipes (líder da 061) =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM event_create('c0000000-0000-0000-0000-000000000002',
    '{"code":"EV-T0","name":"Dup","event_date":"2026-12-01"}',
    '[{"name":"Recepção","quantity":2,"rate":160},{"name":" recepcao ","quantity":1,"rate":160}]');
  INSERT INTO r VALUES ('1.2 equipe duplicada (Recepção / recepcao)', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('1.2 equipe duplicada (Recepção / recepcao)', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Equipe duplicada%'); END $$;
DO $$ BEGIN
  PERFORM event_create('c0000000-0000-0000-0000-000000000002', '{"code":"EV-T0","name":"Sem equipe","event_date":"2026-12-01"}', '[]');
  INSERT INTO r VALUES ('1.3 evento sem equipe', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('1.3 evento sem equipe', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Adicione%'); END $$;
DO $$ BEGIN
  PERFORM event_create('c0000000-0000-0000-0000-000000000003', '{"code":"EV-X","name":"Intruso","event_date":"2026-12-01"}', '[{"name":"Apoio","quantity":1}]');
  INSERT INTO r VALUES ('1.4 líder da 061 cria evento na MKTG', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('1.4 líder da 061 cria evento na MKTG', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Sem permissão%'); END $$;
INSERT INTO ctx SELECT 'ev1', event_create('c0000000-0000-0000-0000-000000000002',
  jsonb_build_object('code','EV-T1','name','Congresso  Teste','cliente_evento_id','d1000000-0000-0000-0000-000000000001','centro_custo_id','d2000000-0000-0000-0000-000000000001',
    'event_date', local_today()::text,'start_time','08:00','end_time','18:00','location','Centro de Convenções',
    'latitude','-15.7801','longitude','-47.9292','radius_m','300','manager_name','Carlos'),
  '[{"name":"Segurança","quantity":1,"rate":180,"coordinator_name":"Carlos","start_time":"18:00","end_time":"02:00"},
    {"name":"Recepção","quantity":2,"rate":160,"coordinator_name":"Maria"}]')::text;
DO $$ BEGIN
  PERFORM event_create('c0000000-0000-0000-0000-000000000002', '{"code":"EV-T1","name":"Repetido","event_date":"2026-12-01"}', '[{"name":"Apoio","quantity":1}]');
  INSERT INTO r VALUES ('1.5 código de evento repetido na empresa', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('1.5 código de evento repetido na empresa', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Já existe%'); END $$;
INSERT INTO r SELECT '1.6 evento criado com 2 equipes, custo previsto 500', 'Congresso Teste/2/500',
  e.name || '/' || count(t.*) || '/' || sum(t.quantity * t.rate)::int,
  e.name = 'Congresso Teste' AND count(t.*) = 2 AND sum(t.quantity * t.rate) = 500
FROM events e JOIN event_teams t ON t.event_id = e.id WHERE e.id = pg_temp.c('ev1')::uuid GROUP BY e.name;
INSERT INTO ctx SELECT 'tok_seg', invite_token FROM event_teams WHERE name = 'Segurança';
INSERT INTO ctx SELECT 'tok_rec', invite_token FROM event_teams WHERE name = 'Recepção';
INSERT INTO ctx SELECT 'tok_in', checkin_token FROM events WHERE id = pg_temp.c('ev1')::uuid;
INSERT INTO ctx SELECT 'tok_out', checkout_token FROM events WHERE id = pg_temp.c('ev1')::uuid;
-- segundo evento (para testar presença cruzada entre eventos)
INSERT INTO ctx SELECT 'ev2', event_create('c0000000-0000-0000-0000-000000000002',
  jsonb_build_object('code','EV-T2','name','Outro evento','event_date', local_today()::text), '[{"name":"Apoio","quantity":1}]')::text;
INSERT INTO ctx SELECT 'tok_in2', checkin_token FROM events WHERE id = pg_temp.c('ev2')::uuid;
INSERT INTO r SELECT '1.1 links gerados (2 inscrição + check-in + check-out)', '4', count(*)::text, count(*) = 4 FROM ctx WHERE k IN ('tok_seg','tok_rec','tok_in','tok_out');
RESET ROLE;

-- ===== 2) Inscrição pública (anon) =====
SELECT pg_temp.as_anon(); SET ROLE anon;
INSERT INTO r SELECT '2.1 info do link: aberto, 1 vaga, valor 180', 'true/1/180',
  (i->>'open') || '/' || (i->>'vacancies') || '/' || (i->>'rate')::numeric::int,
  (i->>'open')::boolean AND (i->>'vacancies')::int = 1 AND (i->>'rate')::numeric = 180
FROM (SELECT public_invite_info(pg_temp.c('tok_seg')) i) x;
DO $$ BEGIN
  PERFORM public_invite_register(pg_temp.c('tok_seg'), '{"cpf":"039.517.284-51","full_name":"Ana Teste","phone":"61987654321","email":"a@exemplo.com","pix_type":"email","pix_key":"a@exemplo.com"}');
  INSERT INTO r VALUES ('2.2 CPF com dígito errado', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('2.2 CPF com dígito errado', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'CPF%'); END $$;
DO $$ BEGIN
  PERFORM public_invite_register(pg_temp.c('tok_seg'), '{"cpf":"03951728450","full_name":"Ana Teste","phone":"61987654321","email":"a@exemplo.com","pix_type":"cpf","pix_key":"111.111.111-11"}');
  INSERT INTO r VALUES ('2.3 PIX CPF inválido', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('2.3 PIX CPF inválido', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Chave PIX%'); END $$;
DO $$ BEGIN
  PERFORM public_invite_register(pg_temp.c('tok_seg'), '{"cpf":"03951728450","full_name":"Ana Teste","phone":"6133334444","email":"a@exemplo.com","pix_type":"email","pix_key":"a@exemplo.com"}');
  INSERT INTO r VALUES ('2.4 celular fixo (sem 9)', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('2.4 celular fixo (sem 9)', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Celular%'); END $$;
DO $$ BEGIN
  PERFORM public_invite_register(pg_temp.c('tok_seg'), '{"cpf":"03951728450","full_name":"Ana","phone":"61987654321","email":"a@exemplo.com","pix_type":"email","pix_key":"a@exemplo.com"}');
  INSERT INTO r VALUES ('2.5 nome sem sobrenome', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('2.5 nome sem sobrenome', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Informe nome%'); END $$;
DO $$ BEGIN
  PERFORM public_invite_register(pg_temp.c('tok_seg'), '{"cpf":"03951728450","full_name":"Ana Teste","phone":"61987654321","email":"sem-arroba","pix_type":"email","pix_key":"a@exemplo.com"}');
  INSERT INTO r VALUES ('2.6 e-mail inválido', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('2.6 e-mail inválido', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'E-mail%'); END $$;
-- inscrições válidas: Ana e Bruno na Segurança (1 vaga); Carla e Davi na Recepção (2 vagas)
INSERT INTO r SELECT '2.7 Ana inscrita (aguardando)', 'aguardando', x->>'status', x->>'status' = 'aguardando'
FROM (SELECT public_invite_register(pg_temp.c('tok_seg'), '{"cpf":"039.517.284-50","full_name":"  Ana   Teste ","phone":"(61) 98765-4321","email":"Ana@Exemplo.com","pix_type":"cpf","pix_key":"039.517.284-50"}') x) s;
INSERT INTO r SELECT '2.8 Bruno inscrito (aguardando)', 'aguardando', x->>'status', x->>'status' = 'aguardando'
FROM (SELECT public_invite_register(pg_temp.c('tok_seg'), '{"cpf":"04582173608","full_name":"Bruno Teste","phone":"61987650001","email":"b@exemplo.com","pix_type":"celular","pix_key":"(61) 98765-0001"}') x) s;
SELECT public_invite_register(pg_temp.c('tok_rec'), '{"cpf":"00000001910","full_name":"Carla Teste","phone":"61987650002","email":"c@exemplo.com","pix_type":"aleatoria","pix_key":"123E4567-E89B-12D3-A456-426614174000"}');
SELECT public_invite_register(pg_temp.c('tok_rec'), '{"cpf":"07183456226","full_name":"Davi Teste","phone":"61987650003","email":"d@exemplo.com","pix_type":"cnpj","pix_key":"11.222.333/0001-81"}');
INSERT INTO r SELECT '2.9 nova inscrição da Ana no mesmo evento', 'já inscrita', x->>'already', (x->>'already')::boolean
FROM (SELECT public_invite_register(pg_temp.c('tok_seg'), '{"cpf":"03951728450"}') x) s;
DO $$ BEGIN
  PERFORM count(*) FROM people;
  INSERT INTO r VALUES ('2.10 anon lê tabela people', 'negado', 'permitido', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('2.10 anon lê tabela people', 'negado', 'negado: ' || SQLERRM, true); END $$;
RESET ROLE;
INSERT INTO r SELECT '2.11 dados gravados limpos (CPF com zero, PIX normalizado, nome normalizado)',
  '03951728450|03951728450|Ana Teste|ana@exemplo.com|61987654321',
  cpf || '|' || pix_key || '|' || full_name || '|' || email || '|' || phone,
  (cpf, pix_key, full_name, email, phone) = ('03951728450', '03951728450', 'Ana Teste', 'ana@exemplo.com', '61987654321')
FROM people WHERE cpf = '03951728450';
INSERT INTO r SELECT '2.12 PIX aleatória e CNPJ normalizados', '123e4567-e89b-12d3-a456-426614174000|11222333000181',
  string_agg(pix_key, '|' ORDER BY cpf), string_agg(pix_key, '|' ORDER BY cpf) = '123e4567-e89b-12d3-a456-426614174000|11222333000181'
FROM people WHERE cpf IN ('00000001910', '07183456226');

-- ===== 3) Confirmação pelo líder =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
UPDATE event_participants SET status = 'confirmado' WHERE person_id = (SELECT id FROM people WHERE cpf = '03951728450');
DO $$ BEGIN
  UPDATE event_participants SET status = 'confirmado' WHERE person_id = (SELECT id FROM people WHERE cpf = '04582173608');
  INSERT INTO r VALUES ('3.1 confirmar 2º na Segurança (1 vaga)', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('3.1 confirmar 2º na Segurança (1 vaga)', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Equipe completa%'); END $$;
UPDATE event_participants SET status = 'lista_espera' WHERE person_id = (SELECT id FROM people WHERE cpf = '04582173608');
UPDATE event_participants SET status = 'confirmado' WHERE team_id = (SELECT id FROM event_teams WHERE name = 'Recepção');
INSERT INTO r SELECT '3.2 confirmados no evento', '3', count(*)::text, count(*) = 3 FROM event_participants WHERE event_id = pg_temp.c('ev1')::uuid AND status = 'confirmado';
RESET ROLE;
SELECT pg_temp.as_anon(); SET ROLE anon;
INSERT INTO r SELECT '3.3 link da Segurança mostra 0 vagas', '0', i->>'vacancies', (i->>'vacancies')::int = 0
FROM (SELECT public_invite_info(pg_temp.c('tok_seg')) i) x;
-- ===== 4) Presença =====
DO $$ BEGIN
  PERFORM record_presence(pg_temp.c('tok_in'), '03951728450', -15.7801, -47.9292, 10, 'x', 'p.jpg');
  INSERT INTO r VALUES ('4.1 anon chama record_presence direto', 'negado', 'permitido', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('4.1 anon chama record_presence direto', 'negado', 'negado: ' || SQLERRM, true); END $$;
INSERT INTO r SELECT '4.2 lookup check-in acha a Ana confirmada (nome mascarado)', 'Ana T./confirmado', (l->>'name') || '/' || (l->>'status'), l->>'name' = 'Ana T.' AND l->>'status' = 'confirmado'
FROM (SELECT public_presence_lookup(pg_temp.c('tok_in'), '039.517.284-50') l) x;
RESET ROLE;
SET ROLE service_role;  -- equivalente ao Route Handler /api/presenca
INSERT INTO r SELECT '4.3 check-in da Ana no local', 'checkin dentro do raio', (x->>'kind') || ' ' || (x->>'inside_radius'), (x->>'inside_radius')::boolean
FROM (SELECT record_presence(pg_temp.c('tok_in'), '03951728450', -15.7802, -47.9293, 8, 'Centro', 'c2/a.jpg') x) s;
INSERT INTO r SELECT '4.4 check-in da Carla a ~2 km (registrado fora do raio)', 'false', x->>'inside_radius', NOT (x->>'inside_radius')::boolean
FROM (SELECT record_presence(pg_temp.c('tok_in'), '00000001910', -15.7951, -47.9392, 15, 'Longe', 'c2/c.jpg') x) s;
DO $$ BEGIN
  PERFORM record_presence(pg_temp.c('tok_in'), '04582173608', -15.7801, -47.9292, 10, 'x', 'c2/b.jpg');
  INSERT INTO r VALUES ('4.5 check-in de quem não está confirmado (lista de espera)', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('4.5 check-in de quem não está confirmado (lista de espera)', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
DO $$ BEGIN
  PERFORM record_presence(pg_temp.c('tok_out'), '07183456226', -15.7801, -47.9292, 10, 'x', 'c2/d.jpg');
  INSERT INTO r VALUES ('4.6 check-out sem check-in', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('4.6 check-out sem check-in', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Faça o check-in%'); END $$;
DO $$ BEGIN
  PERFORM record_presence(pg_temp.c('tok_in2'), '03951728450', -15.7801, -47.9292, 10, 'x', 'c2/a2.jpg');
  INSERT INTO r VALUES ('4.7 Ana usa o link de presença de OUTRO evento', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('4.7 Ana usa o link de presença de OUTRO evento', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Não foi possível localizar%'); END $$;
DO $$ BEGIN
  PERFORM record_presence(pg_temp.c('tok_in'), '03951728450', -15.7801, -47.9292, 10, 'x', 'c2/a3.jpg');
  INSERT INTO r VALUES ('4.8 segundo check-in da Ana no mesmo dia', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('4.8 segundo check-in da Ana no mesmo dia', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Check-in de hoje já registrado%'); END $$;
INSERT INTO r SELECT '4.9 check-out da Ana', 'checkout', x->>'kind', x->>'kind' = 'checkout'
FROM (SELECT record_presence(pg_temp.c('tok_out'), '03951728450', -15.7801, -47.9292, 9, 'Centro', 'c2/a4.jpg') x) s;
INSERT INTO r SELECT '4.10 evento passou a "em andamento" no 1º check-in', 'em_andamento', status, status = 'em_andamento'
FROM events WHERE id = pg_temp.c('ev1')::uuid;
RESET ROLE;

-- ===== 5) Encerrar, validar e enviar ao financeiro =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM event_send_to_finance(pg_temp.c('ev1')::uuid);
  INSERT INTO r VALUES ('5.1 enviar ao financeiro sem encerrar', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('5.1 enviar ao financeiro sem encerrar', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Encerre o evento%'); END $$;
SELECT event_finish(pg_temp.c('ev1')::uuid);
INSERT INTO r SELECT '5.2 encerrado: aguardando fechamento', 'aguardando_fechamento', status, status = 'aguardando_fechamento'
FROM events WHERE id = pg_temp.c('ev1')::uuid;
INSERT INTO r SELECT '5.3 "trabalhou" pré-marcado para quem fez check-in', 'Ana+Carla=true, Davi=null',
  string_agg(p.full_name || '=' || coalesce(ep.worked::text, 'null'), ', ' ORDER BY p.full_name),
  bool_and(CASE WHEN p.cpf IN ('03951728450', '00000001910') THEN ep.worked ELSE ep.worked IS NULL END)
FROM event_participants ep JOIN people p ON p.id = ep.person_id WHERE ep.event_id = pg_temp.c('ev1')::uuid AND ep.status = 'confirmado';
DO $$ BEGIN
  PERFORM event_send_to_finance(pg_temp.c('ev1')::uuid);
  INSERT INTO r VALUES ('5.4 enviar com profissional sem validação', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('5.4 enviar com profissional sem validação', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Valide todos%'); END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN
  PERFORM record_presence(pg_temp.c('tok_in'), '07183456226', -15.7801, -47.9292, 10, 'x', 'c2/d2.jpg');
  INSERT INTO r VALUES ('5.5 check-in após encerramento', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('5.5 check-in após encerramento', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Presença encerrada%'); END $$;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1'); SET ROLE authenticated;
-- validação: Ana 1 diária + R$ 20 adicional; Carla 2 diárias − R$ 10 desconto; Davi não trabalhou
UPDATE event_participants SET days = 1, addition = 20 WHERE person_id = (SELECT id FROM people WHERE cpf = '03951728450');
UPDATE event_participants SET days = 2, discount = 10 WHERE person_id = (SELECT id FROM people WHERE cpf = '00000001910');
UPDATE event_participants SET worked = false WHERE person_id = (SELECT id FROM people WHERE cpf = '07183456226');
INSERT INTO r SELECT '5.6 valor final = diária × qtd + adicional − desconto', 'Ana 200 · Carla 310 · Davi 0',
  string_agg(p.full_name || ' ' || ep.final_amount::int, ' · ' ORDER BY p.full_name),
  string_agg(ep.final_amount::int::text, ',' ORDER BY p.full_name) = '200,310,0'
FROM event_participants ep JOIN people p ON p.id = ep.person_id WHERE ep.event_id = pg_temp.c('ev1')::uuid AND ep.status = 'confirmado';
INSERT INTO r SELECT '5.7 contas a pagar geradas', '2', x::text, x = 2 FROM (SELECT event_send_to_finance(pg_temp.c('ev1')::uuid) x) s;
INSERT INTO r SELECT '5.8 lançamento com dados da operação (sem redigitar)',
  'Ana Teste|03951728450|cpf|03951728450|200.00|EV-T1|Congresso Teste|061|EVENTO|a_pagar',
  concat_ws('|', payee_name, payee_document, pix_type, pix_key, amount, op_code, op_name,
            (SELECT name FROM companies WHERE id = company_id), origin, status),
  concat_ws('|', payee_name, payee_document, pix_type, pix_key, amount, op_code, op_name, origin, status)
    = 'Ana Teste|03951728450|cpf|03951728450|200.00|EV-T1|Congresso Teste|EVENTO|a_pagar'
    AND ref_date = local_today() AND cost_center = 'CC-01 — Eventos corporativos' AND centro_custo_id = 'd2000000-0000-0000-0000-000000000001' AND company_id = 'c0000000-0000-0000-0000-000000000002'
FROM payables WHERE payee_document = '03951728450';
DO $$ BEGIN
  PERFORM event_send_to_finance(pg_temp.c('ev1')::uuid);
  INSERT INTO r VALUES ('5.9 reenviar ao financeiro', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('5.9 reenviar ao financeiro', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Evento já enviado%'); END $$;
DO $$ BEGIN
  UPDATE event_participants SET addition = 999 WHERE person_id = (SELECT id FROM people WHERE cpf = '03951728450');
  INSERT INTO r VALUES ('5.10 alterar valor após fechamento', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('5.10 alterar valor após fechamento', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Evento fechado%'); END $$;
INSERT INTO r SELECT '5.11 sem duplicidade de lançamentos', '2', count(*)::text, count(*) = 2 FROM payables WHERE operation_id = pg_temp.c('ev1')::uuid;
RESET ROLE;

-- ===== 6) Isolamento do fluxo =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2'); SET ROLE authenticated;
INSERT INTO r SELECT '6.1 usuário MKTG vê evento/pessoas/presença/lançamentos da 061', '0',
  ((SELECT count(*) FROM events) + (SELECT count(*) FROM people) + (SELECT count(*) FROM attendance) + (SELECT count(*) FROM payables))::text,
  ((SELECT count(*) FROM events) + (SELECT count(*) FROM people) + (SELECT count(*) FROM attendance) + (SELECT count(*) FROM payables)) = 0;
DO $$ BEGIN
  INSERT INTO event_teams(company_id, event_id, name, quantity) VALUES ('c0000000-0000-0000-0000-000000000002', pg_temp.c('ev1')::uuid, 'Intrusa', 1);
  INSERT INTO r VALUES ('6.2 usuário MKTG cria equipe no evento da 061', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('6.2 usuário MKTG cria equipe no evento da 061', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
DO $$ BEGIN
  INSERT INTO event_teams(company_id, event_id, name, quantity) VALUES ('c0000000-0000-0000-0000-000000000003', pg_temp.c('ev1')::uuid, 'Intrusa', 1);
  INSERT INTO r VALUES ('6.3 equipe "da MKTG" pendurada em evento da 061', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('6.3 equipe "da MKTG" pendurada em evento da 061', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '', false);
SELECT CASE WHEN pass THEN 'PASSOU' ELSE 'FALHOU' END AS resultado, test, expected, left(got, 100) AS obtido FROM r;
ROLLBACK;
