-- Marco 2 — segurança (Super Admin, escopo do coordenador, PIX, links públicos), eventos de vários dias,
-- cadastros e fluxo completo de Ponto Fixo. Roda numa transação e desfaz tudo no fim (ROLLBACK).
-- CPFs sintéticos (gerados pelo algoritmo), e-mails fictícios.
BEGIN;
CREATE TEMP TABLE r (test text, expected text, got text, pass boolean);
CREATE TEMP TABLE ctx (k text PRIMARY KEY, v text);
GRANT ALL ON r, ctx TO authenticated, anon, service_role;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
CREATE FUNCTION pg_temp.as_anon(ip text DEFAULT '10.0.0.1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"anon"}', false), set_config('request.headers', json_build_object('x-forwarded-for', ip)::text, false) $$;
CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false) $$;
CREATE FUNCTION pg_temp.c(k text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM ctx WHERE ctx.k = $1 $$;
CREATE FUNCTION pg_temp.cpf(base text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE d int[]; s int; r int; i int;
BEGIN
  d := string_to_array(base, NULL)::int[];
  s := 0; FOR i IN 1..9 LOOP s := s + d[i] * (11 - i); END LOOP; r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF; d := d || r;
  s := 0; FOR i IN 1..10 LOOP s := s + d[i] * (12 - i); END LOOP; r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF; d := d || r;
  RETURN array_to_string(d, '');
END $$;

-- ===== S) Super Admin só por concessão explícita =====
INSERT INTO auth.users(id, email) VALUES
 ('00000000-0000-0000-0000-0000000000f1', 'gestor@061.test'), ('00000000-0000-0000-0000-0000000000f2', 'coordA@061.test'),
 ('00000000-0000-0000-0000-0000000000f3', 'coordB@061.test'), ('00000000-0000-0000-0000-0000000000f4', 'financeiro@061.test'),
 ('00000000-0000-0000-0000-0000000000f5', 'gestor@andrade.test'), ('00000000-0000-0000-0000-0000000000f6', 'carlos@andrade.test'),
 ('00000000-0000-0000-0000-0000000000f7', 'financeiro@andrade.test'), ('00000000-0000-0000-0000-0000000000f8', 'gestor@mktg.test'),
 ('00000000-0000-0000-0000-0000000000f9', 'outro.coord@andrade.test');
INSERT INTO r SELECT 'S1 primeiros usuários cadastrados NÃO viram Super Admin', '0', count(*)::text, count(*) = 0 FROM platform_admins;
INSERT INTO r SELECT 'S2 perfis criados no cadastro', '9', count(*)::text, count(*) = 9 FROM profiles WHERE email LIKE '%.test';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO platform_admins(user_id) VALUES ('00000000-0000-0000-0000-0000000000f1');
  INSERT INTO r VALUES ('S3 usuário comum se promove a Super Admin', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('S3 usuário comum se promove a Super Admin', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
RESET ROLE;

INSERT INTO company_users(company_id, user_id) VALUES
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1'), ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f2'),
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f3'), ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f4'),
 ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f5'), ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f6'),
 ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f7'), ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f8'),
 ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f9');
INSERT INTO company_user_permissions(company_id, user_id, permission) VALUES
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1', 'operacao.gerenciar'),
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1', 'operacao.todos'),
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f2', 'operacao.gerenciar'),
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f3', 'operacao.gerenciar'),
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f4', 'financeiro.gerenciar'),
 ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f5', 'operacao.gerenciar'),
 ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f5', 'operacao.todos'),
 ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f6', 'operacao.gerenciar'),
 ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f7', 'financeiro.gerenciar'),
 ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f8', 'operacao.gerenciar'),
 ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000f8', 'operacao.todos'),
 ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f9', 'operacao.gerenciar');

-- ===== C) Cadastros reais =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f2'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO clientes_evento(company_id, razao_social) VALUES ('c0000000-0000-0000-0000-000000000002', 'Cliente do coordenador');
  INSERT INTO r VALUES ('C1 coordenador (sem visão total) cadastra cliente', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C1 coordenador (sem visão total) cadastra cliente', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1'); SET ROLE authenticated;
WITH x AS (INSERT INTO clientes_evento(company_id, tipo_pessoa, razao_social, nome_fantasia, documento)
  VALUES ('c0000000-0000-0000-0000-000000000002', 'PJ', 'Cliente Alfa Ltda', 'Alfa', '11.222.333/0001-81') RETURNING id) INSERT INTO ctx SELECT 'cli061', id::text FROM x;
WITH x AS (INSERT INTO centros_custo(company_id, codigo, nome) VALUES ('c0000000-0000-0000-0000-000000000002', 'CC-EV', 'Eventos') RETURNING id) INSERT INTO ctx SELECT 'cc061', id::text FROM x;
INSERT INTO r SELECT 'C2 documento do cliente gravado só com dígitos', '11222333000181', documento, documento = '11222333000181' FROM clientes_evento WHERE id = pg_temp.c('cli061')::uuid;
DO $$ BEGIN
  INSERT INTO clientes_evento(company_id, razao_social, documento) VALUES ('c0000000-0000-0000-0000-000000000002', 'Doc ruim', '11.222.333/0001-80');
  INSERT INTO r VALUES ('C3 CNPJ inválido no cliente', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C3 CNPJ inválido no cliente', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'CPF/CNPJ inválido%'); END $$;
DO $$ BEGIN
  INSERT INTO centros_custo(company_id, codigo, nome, origem) VALUES ('c0000000-0000-0000-0000-000000000002', 'X', 'X', 'planilha');
  INSERT INTO r VALUES ('C4 origem de centro de custo fora de interno/conta_azul/importacao', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C4 origem de centro de custo fora de interno/conta_azul/importacao', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f8'); SET ROLE authenticated;
INSERT INTO r SELECT 'C5 MKTG vê clientes/centros de custo da 061', '0', ((SELECT count(*) FROM clientes_evento) + (SELECT count(*) FROM centros_custo))::text,
  ((SELECT count(*) FROM clientes_evento) + (SELECT count(*) FROM centros_custo)) = 0;
DO $$ BEGIN
  PERFORM event_create('c0000000-0000-0000-0000-000000000003', jsonb_build_object('code','MK1','name','MKTG usa CC da 061','event_date', local_today()::text,'centro_custo_id', pg_temp.c('cc061')),
    '[{"name":"Apoio","quantity":1}]');
  INSERT INTO r VALUES ('C6 evento da MKTG com centro de custo da 061', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C6 evento da MKTG com centro de custo da 061', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
RESET ROLE;

-- ===== E) Escopo do coordenador: A não vê evento de B =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1'); SET ROLE authenticated;
INSERT INTO ctx SELECT 'evA', event_create('c0000000-0000-0000-0000-000000000002',
  jsonb_build_object('code','EV-A','name','Evento do A','event_date', local_today()::text,'cliente_evento_id', pg_temp.c('cli061'),'centro_custo_id', pg_temp.c('cc061')),
  '[{"name":"Segurança","quantity":2,"rate":180}]')::text;
INSERT INTO ctx SELECT 'evB', event_create('c0000000-0000-0000-0000-000000000002',
  jsonb_build_object('code','EV-B','name','Evento do B','event_date', local_today()::text), '[{"name":"Recepção","quantity":2,"rate":160}]')::text;
SELECT operation_member_set(pg_temp.c('evA')::uuid, '00000000-0000-0000-0000-0000000000f2', 'coordenador');
SELECT operation_member_set(pg_temp.c('evB')::uuid, '00000000-0000-0000-0000-0000000000f3', 'coordenador');
INSERT INTO ctx SELECT 'tokA', invite_token FROM event_teams WHERE event_id = pg_temp.c('evA')::uuid;
INSERT INTO ctx SELECT 'tokB', invite_token FROM event_teams WHERE event_id = pg_temp.c('evB')::uuid;
INSERT INTO ctx SELECT 'inA', checkin_token FROM events WHERE id = pg_temp.c('evA')::uuid;
INSERT INTO ctx SELECT 'inB', checkin_token FROM events WHERE id = pg_temp.c('evB')::uuid;
INSERT INTO r SELECT 'E1 gestor com operacao.todos vê os dois eventos', '2', count(*)::text, count(*) = 2 FROM events;
INSERT INTO r SELECT 'E2 evento guarda cliente e centro de custo cadastrados', 'Alfa|CC-EV — Eventos', client_name || '|' || cost_center,
  cliente_evento_id = pg_temp.c('cli061')::uuid AND centro_custo_id = pg_temp.c('cc061')::uuid FROM events WHERE id = pg_temp.c('evA')::uuid;
RESET ROLE;
-- inscrições e confirmação (uma pessoa em cada evento)
SELECT pg_temp.as_anon('10.0.0.2'); SET ROLE anon;
SELECT public_invite_register(pg_temp.c('tokA'), jsonb_build_object('cpf', pg_temp.cpf('123456789'), 'full_name','Pessoa Do A','phone','61987650011','email','pa@exemplo.com','pix_type','email','pix_key','pa@exemplo.com'));
SELECT public_invite_register(pg_temp.c('tokB'), jsonb_build_object('cpf', pg_temp.cpf('223456789'), 'full_name','Pessoa Do B','phone','61987650012','email','pb@exemplo.com','pix_type','email','pix_key','pb@exemplo.com'));
RESET ROLE;
UPDATE event_participants SET status = 'confirmado';
SET ROLE service_role;
SELECT record_presence(pg_temp.c('inA'), pg_temp.cpf('123456789'), NULL, NULL, NULL, NULL, 'x/a.jpg');
SELECT record_presence(pg_temp.c('inB'), pg_temp.cpf('223456789'), NULL, NULL, NULL, NULL, 'x/b.jpg');
RESET ROLE;

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f2'); SET ROLE authenticated;
INSERT INTO r SELECT 'E3 coordenador A lista só o evento dele', 'Evento do A', string_agg(name, ','), string_agg(name, ',') = 'Evento do A' FROM events;
INSERT INTO r SELECT 'E4 coordenador A consulta o evento B pelo ID', '0', count(*)::text, count(*) = 0 FROM events WHERE id = pg_temp.c('evB')::uuid;
INSERT INTO r SELECT 'E5 coordenador A vê equipes/participantes/presença do evento B', '0',
  ((SELECT count(*) FROM event_teams WHERE event_id = pg_temp.c('evB')::uuid) + (SELECT count(*) FROM event_participants WHERE event_id = pg_temp.c('evB')::uuid)
   + (SELECT count(*) FROM attendance a WHERE a.photo_path = 'x/b.jpg'))::text,
  ((SELECT count(*) FROM event_teams WHERE event_id = pg_temp.c('evB')::uuid) + (SELECT count(*) FROM event_participants WHERE event_id = pg_temp.c('evB')::uuid)
   + (SELECT count(*) FROM attendance a WHERE a.photo_path = 'x/b.jpg')) = 0;
INSERT INTO r SELECT 'E6 coordenador A vê só a pessoa do seu evento', 'Pessoa Do A', string_agg(full_name, ','), string_agg(full_name, ',') = 'Pessoa Do A' FROM people;
INSERT INTO r SELECT 'E7 coordenador A vê participante + presença do próprio evento', '2',
  ((SELECT count(*) FROM event_participants) + (SELECT count(*) FROM attendance))::text, ((SELECT count(*) FROM event_participants) + (SELECT count(*) FROM attendance)) = 2;
DO $$ DECLARE n int; BEGIN
  UPDATE event_participants SET days = 9 WHERE event_id = pg_temp.c('evB')::uuid; GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO r VALUES ('E8 coordenador A altera participante do evento B', '0 linhas', n || ' linhas', n = 0);
END $$;
DO $$ BEGIN
  PERFORM event_finish(pg_temp.c('evB')::uuid);
  INSERT INTO r VALUES ('E9 coordenador A encerra o evento B', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('E9 coordenador A encerra o evento B', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Sem permissão%'); END $$;
DO $$ BEGIN
  PERFORM operation_member_set(pg_temp.c('evB')::uuid, '00000000-0000-0000-0000-0000000000f2', 'coordenador');
  INSERT INTO r VALUES ('E10 coordenador A se vincula ao evento B', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('E10 coordenador A se vincula ao evento B', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
DO $$ BEGIN
  PERFORM rotate_link('inscricao', (SELECT id FROM event_teams LIMIT 1));  -- só vê a equipe do A
  INSERT INTO ctx SELECT 'tokA_old', pg_temp.c('tokA');
  INSERT INTO r VALUES ('E11 coordenador A gera novo link da própria equipe', 'aceito', 'aceito', true);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('E11 coordenador A gera novo link da própria equipe', 'aceito', 'recusado: ' || SQLERRM, false); END $$;
INSERT INTO ctx SELECT 'evA2', event_create('c0000000-0000-0000-0000-000000000002',
  jsonb_build_object('code','EV-A2','name','Criado pelo A','event_date', local_today()::text), '[{"name":"Apoio","quantity":1}]')::text;
INSERT INTO r SELECT 'E12 coordenador que cria evento passa a vê-lo', '2', count(*)::text, count(*) = 2 FROM events;
INSERT INTO r SELECT 'E13 PIX completo inacessível por SELECT', 'negado', 'permitido', false
  WHERE has_column_privilege('authenticated', 'public.people', 'pix_key', 'SELECT');
INSERT INTO r SELECT 'E13 PIX completo inacessível por SELECT', 'negado', 'negado', true
  WHERE NOT has_column_privilege('authenticated', 'public.people', 'pix_key', 'SELECT');
INSERT INTO r SELECT 'E14 coordenador vê PIX mascarado', 'pa•••@exemplo.com / sem acesso completo', pix_key || ' / ' || full_access::text,
  pix_key = 'pa•••@exemplo.com' AND NOT full_access FROM person_pix((SELECT id FROM people LIMIT 1));
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f3'); SET ROLE authenticated;
INSERT INTO r SELECT 'E15 coordenador B não vê o evento A', 'Evento do B', string_agg(name, ','), string_agg(name, ',') = 'Evento do B' FROM events;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f4'); SET ROLE authenticated;
INSERT INTO r SELECT 'E16 financeiro (sem operação) não vê eventos', '0', count(*)::text, count(*) = 0 FROM events;
INSERT INTO r SELECT 'E17 financeiro vê PIX completo', 'pa@exemplo.com', pix_key, pix_key = 'pa@exemplo.com' AND full_access
  FROM person_pix((SELECT id FROM people WHERE full_name = 'Pessoa Do A'));
RESET ROLE;

-- ===== L) Links públicos =====
INSERT INTO r SELECT 'L1 tokens com 64 caracteres', '64/64/64', length(invite_token) || '/' || length(e.checkin_token) || '/' || length(e.checkout_token),
  length(invite_token) = 64 AND length(e.checkin_token) = 64 FROM event_teams t JOIN events e ON e.id = t.event_id WHERE t.event_id = pg_temp.c('evB')::uuid;
SELECT pg_temp.as_anon('10.0.0.3'); SET ROLE anon;
INSERT INTO r SELECT 'L2 link antigo revogado deixa de funcionar', 'null', coalesce(public_invite_info(pg_temp.c('tokA_old'))::text, 'null'),
  public_invite_info(pg_temp.c('tokA_old')) IS NULL;
INSERT INTO r SELECT 'L3 consulta de inscrição não revela nome/telefone/e-mail', 'sem dados pessoais', x::text,
  NOT (x ? 'first_name' OR x ? 'phone_hint' OR x ? 'email_hint') AND (x->>'found')::boolean
  FROM (SELECT public_invite_lookup(pg_temp.c('tokB'), pg_temp.cpf('223456789')) x) s;
INSERT INTO r SELECT 'L4 presença: CPF inexistente e não confirmado têm a mesma resposta', '{"found": false}',
  a::text || ' = ' || b::text, a = b FROM (SELECT public_presence_lookup(pg_temp.c('inB'), pg_temp.cpf('999456789')) a,
                                                   public_presence_lookup(pg_temp.c('inB'), pg_temp.cpf('123456789')) b) s;
DO $$ BEGIN
  PERFORM count(*) FROM public_link_attempts;
  INSERT INTO r VALUES ('L5 anon lê o registro de tentativas', 'negado', 'permitido', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('L5 anon lê o registro de tentativas', 'negado', 'negado', true); END $$;
RESET ROLE;
-- varredura de CPFs a partir de um IP: bloqueia depois de 15 "não encontrado"
SELECT pg_temp.as_anon('10.6.6.6'); SET ROLE anon;
DO $$ DECLARE i int; x jsonb; BEGIN
  FOR i IN 1..15 LOOP x := public_invite_lookup(pg_temp.c('tokB'), pg_temp.cpf(lpad((300000000 + i)::text, 9, '0'))); END LOOP;
  x := public_invite_lookup(pg_temp.c('tokB'), pg_temp.cpf('223456789'));
  INSERT INTO r VALUES ('L6 varredura de CPFs bloqueada no IP (mesmo para CPF existente)', '{"blocked": true}', x::text, (x->>'blocked')::boolean);
END $$;
RESET ROLE;
SELECT pg_temp.as_anon('10.7.7.7'); SET ROLE anon;
INSERT INTO r SELECT 'L7 outro IP continua funcionando', 'found', x::text, (x->>'found')::boolean
  FROM (SELECT public_invite_lookup(pg_temp.c('tokB'), pg_temp.cpf('223456789')) x) s;
RESET ROLE;
INSERT INTO r SELECT 'L8 tentativas registradas sem CPF nem token em claro', '0', count(*)::text, count(*) = 0
  FROM public_link_attempts WHERE cpf_hash = pg_temp.cpf('223456789') OR token_hash = pg_temp.c('tokB') OR ip LIKE '%' || pg_temp.cpf('223456789') || '%';
INSERT INTO r SELECT 'L9 bloqueio registrado para auditoria', '>=1', count(*)::text, count(*) >= 1 FROM public_link_attempts WHERE outcome = 'bloqueado' AND ip = '10.6.6.6';
SELECT pg_temp.as_service(); SET ROLE service_role;
INSERT INTO r SELECT 'L10 servidor informa IP real ao checar (/api/presenca)', 'true', public_link_check('presenca', pg_temp.c('inB'), pg_temp.cpf('223456789'), '200.1.2.3')::text,
  public_link_check('presenca', pg_temp.c('inB'), pg_temp.cpf('223456789'), '200.1.2.3');
RESET ROLE;
INSERT INTO r SELECT 'L11 IP vindo do servidor gravado', '200.1.2.3', max(ip), max(ip) = '200.1.2.3' FROM public_link_attempts WHERE ip = '200.1.2.3';
SELECT pg_temp.as_anon('10.8.8.8'); SET ROLE anon;
DO $$ BEGIN
  PERFORM public_link_check('presenca', pg_temp.c('inB'), '1', '1.1.1.1');
  INSERT INTO r VALUES ('L12 anon chama a checagem do servidor (e forja IP)', 'negado', 'permitido', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('L12 anon chama a checagem do servidor (e forja IP)', 'negado', 'negado', true); END $$;
RESET ROLE;

-- ===== M) Evento de vários dias =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1'); SET ROLE authenticated;
INSERT INTO ctx SELECT 'evM', event_create('c0000000-0000-0000-0000-000000000002',
  jsonb_build_object('code','EV-M','name','Feira 3 dias','event_date', (local_today() - 1)::text, 'end_date', (local_today() + 1)::text),
  '[{"name":"Promotores","quantity":2,"rate":150}]')::text;
DO $$ BEGIN
  PERFORM event_create('c0000000-0000-0000-0000-000000000002', jsonb_build_object('code','EV-X','name','Datas trocadas','event_date', local_today()::text, 'end_date', (local_today() - 2)::text),
    '[{"name":"Apoio","quantity":1}]');
  INSERT INTO r VALUES ('M1 data final antes da inicial', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('M1 data final antes da inicial', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'A data final%'); END $$;
RESET ROLE;
INSERT INTO ctx SELECT 'tokM', invite_token FROM event_teams WHERE event_id = pg_temp.c('evM')::uuid;
INSERT INTO ctx SELECT 'inM', checkin_token FROM events WHERE id = pg_temp.c('evM')::uuid;
INSERT INTO ctx SELECT 'outM', checkout_token FROM events WHERE id = pg_temp.c('evM')::uuid;
SELECT pg_temp.as_anon('10.0.0.4'); SET ROLE anon;
SELECT public_invite_register(pg_temp.c('tokM'), jsonb_build_object('cpf', pg_temp.cpf('323456789'), 'full_name','Promotor Tres Dias','phone','61987650021','email','p3@exemplo.com','pix_type','cpf','pix_key', pg_temp.cpf('323456789')));
SELECT public_invite_register(pg_temp.c('tokM'), jsonb_build_object('cpf', pg_temp.cpf('423456789'), 'full_name','Promotor Noturno','phone','61987650022','email','pn@exemplo.com','pix_type','cpf','pix_key', pg_temp.cpf('423456789')));
RESET ROLE;
UPDATE event_participants SET status = 'confirmado' WHERE event_id = pg_temp.c('evM')::uuid;
-- dia anterior (registro histórico): turno completo do primeiro; o segundo saiu à meia-noite sem check-out
INSERT INTO attendance(company_id, participant_id, kind, work_date, recorded_at)
SELECT ep.company_id, ep.id, k, local_today() - 1, now() - interval '1 day'
FROM event_participants ep JOIN people p ON p.id = ep.person_id CROSS JOIN unnest(ARRAY['checkin', 'checkout']) k
WHERE ep.event_id = pg_temp.c('evM')::uuid AND p.full_name = 'Promotor Tres Dias';
INSERT INTO attendance(company_id, participant_id, kind, work_date, recorded_at)
SELECT ep.company_id, ep.id, 'checkin', local_today() - 1, now() - interval '20 hours'
FROM event_participants ep JOIN people p ON p.id = ep.person_id WHERE ep.event_id = pg_temp.c('evM')::uuid AND p.full_name = 'Promotor Noturno';
SET ROLE service_role;
INSERT INTO r SELECT 'M2 segundo dia: check-in na mesma inscrição', (local_today())::text, x->>'work_date', (x->>'work_date')::date = local_today()
  FROM (SELECT record_presence(pg_temp.c('inM'), pg_temp.cpf('323456789'), NULL, NULL, NULL, NULL, 'x/m1.jpg') x) s;
DO $$ BEGIN
  PERFORM record_presence(pg_temp.c('inM'), pg_temp.cpf('323456789'), NULL, NULL, NULL, NULL, 'x/m2.jpg');
  INSERT INTO r VALUES ('M3 segundo check-in no mesmo dia', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('M3 segundo check-in no mesmo dia', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Check-in de hoje%'); END $$;
INSERT INTO r SELECT 'M4 check-out do noturno fecha o turno de ontem', (local_today() - 1)::text, x->>'work_date', (x->>'work_date')::date = local_today() - 1
  FROM (SELECT record_presence(pg_temp.c('outM'), pg_temp.cpf('423456789'), NULL, NULL, NULL, NULL, 'x/m3.jpg') x) s;
INSERT INTO r SELECT 'M5 check-out de hoje do primeiro', (local_today())::text, x->>'work_date', (x->>'work_date')::date = local_today()
  FROM (SELECT record_presence(pg_temp.c('outM'), pg_temp.cpf('323456789'), NULL, NULL, NULL, NULL, 'x/m4.jpg') x) s;
RESET ROLE;
INSERT INTO r SELECT 'M6 uma inscrição com presença em 2 dias', '1 inscrição / 4 registros', count(DISTINCT a.participant_id) || ' inscrição / ' || count(*) || ' registros',
  count(DISTINCT a.participant_id) = 1 AND count(*) = 4
  FROM attendance a JOIN event_participants ep ON ep.id = a.participant_id JOIN people p ON p.id = ep.person_id WHERE p.full_name = 'Promotor Tres Dias';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f1'); SET ROLE authenticated;
SELECT event_finish(pg_temp.c('evM')::uuid);
INSERT INTO r SELECT 'M7 fechamento calcula diárias validadas pelos dias com check-in', 'Noturno=1 · Tres Dias=2',
  string_agg(split_part(p.full_name, ' ', 2) || '=' || ep.days::int, ' · ' ORDER BY p.full_name),
  string_agg(ep.days::int::text, ',' ORDER BY p.full_name) = '1,2'
  FROM event_participants ep JOIN people p ON p.id = ep.person_id WHERE ep.event_id = pg_temp.c('evM')::uuid;
INSERT INTO r SELECT 'M8 valor final com 2 diárias', '300.00', final_amount::text, final_amount = 300
  FROM event_participants ep JOIN people p ON p.id = ep.person_id WHERE p.full_name = 'Promotor Tres Dias';
RESET ROLE;

-- ===== F) Fornecedores =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f5'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO fornecedores(company_id, razao_social, pix_type, pix_key) VALUES ('c0000000-0000-0000-0000-000000000001', 'Ruim', 'cnpj', '11.222.333/0001-80');
  INSERT INTO r VALUES ('F1 fornecedor com PIX inválido', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('F1 fornecedor com PIX inválido', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Chave PIX%'); END $$;
WITH x AS (INSERT INTO fornecedores(company_id, razao_social, nome_fantasia, documento, telefone, email, pix_type, pix_key, servico)
  VALUES ('c0000000-0000-0000-0000-000000000001', 'Buffet Bom Ltda', 'Buffet Bom', '11.222.333/0001-81', '(61) 3333-4444', 'contato@buffet.test', 'cnpj', '11.222.333/0001-81', 'Buffet')
  RETURNING id) INSERT INTO ctx SELECT 'forn', id::text FROM x;
INSERT INTO r SELECT 'F2 fornecedor gravado com PIX normalizado e mascarado', '•••0181', pix_key_masked, pix_key_masked = '•••0181' AND has_pix FROM fornecedores;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f8'); SET ROLE authenticated;
INSERT INTO r SELECT 'F3 MKTG não vê fornecedor do Andrade', '0', count(*)::text, count(*) = 0 FROM fornecedores;
RESET ROLE;

-- ===== P) Ponto Fixo completo (Grupo Andrade) =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f5'); SET ROLE authenticated;
WITH x AS (INSERT INTO clientes_evento(company_id, razao_social, nome_fantasia, documento)
  VALUES ('c0000000-0000-0000-0000-000000000001', 'Construtora X S.A.', 'Construtora X', NULL) RETURNING id) INSERT INTO ctx SELECT 'cliAnd', id::text FROM x;
WITH x AS (INSERT INTO centros_custo(company_id, codigo, nome) VALUES ('c0000000-0000-0000-0000-000000000001', 'CC-OBRAS', 'Obras') RETURNING id) INSERT INTO ctx SELECT 'ccAnd', id::text FROM x;
INSERT INTO ctx SELECT 'pf', fixed_post_create('c0000000-0000-0000-0000-000000000001', jsonb_build_object(
  'code','PF-OBRAX','name','Obra X','cliente_evento_id', pg_temp.c('cliAnd'),'centro_custo_id', pg_temp.c('ccAnd'),
  'category','Segurança','subcategory','Segurança de Obras','location','Obra Residencial X','responsavel_user_id','00000000-0000-0000-0000-0000000000f6'))::text;
-- 5 profissionais (um deles com CPF começando por zero)
DO $$ DECLARE i int; pid uuid; BEGIN
  FOR i IN 1..5 LOOP
    pid := person_upsert('c0000000-0000-0000-0000-000000000001', jsonb_build_object(
      'cpf', pg_temp.cpf(CASE WHEN i = 1 THEN '012345679' ELSE (500000000 + i)::text END),
      'full_name', 'Seguranca ' || chr(64 + i) || ' Teste', 'phone', '6198765' || lpad(i::text, 4, '0'),
      'pix_type', 'cpf', 'pix_key', pg_temp.cpf(CASE WHEN i = 1 THEN '012345679' ELSE (500000000 + i)::text END), 'main_role', 'Segurança'));
    INSERT INTO fixed_post_members(company_id, fixed_post_id, person_id, role, start_date, monthly_rate)
    VALUES ('c0000000-0000-0000-0000-000000000001', pg_temp.c('pf')::uuid, pid, 'Segurança', '2026-09-01', 2000 + i * 100);
  END LOOP;
END $$;
INSERT INTO r SELECT 'P1 person_upsert não duplica CPF', 'mesmo id',
  CASE WHEN person_upsert('c0000000-0000-0000-0000-000000000001', jsonb_build_object('cpf', pg_temp.cpf('012345679'))) = (SELECT id FROM people WHERE cpf = pg_temp.cpf('012345679')) THEN 'mesmo id' ELSE 'outro' END,
  person_upsert('c0000000-0000-0000-0000-000000000001', jsonb_build_object('cpf', pg_temp.cpf('012345679'))) = (SELECT id FROM people WHERE cpf = pg_temp.cpf('012345679'));
DO $$ BEGIN
  INSERT INTO fixed_post_members(company_id, fixed_post_id, person_id, start_date, monthly_rate)
  VALUES ('c0000000-0000-0000-0000-000000000001', pg_temp.c('pf')::uuid, (SELECT id FROM people WHERE cpf = pg_temp.cpf('012345679')), '2026-09-01', 1);
  INSERT INTO r VALUES ('P2 mesma pessoa alocada 2x ativa no mesmo ponto', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('P2 mesma pessoa alocada 2x ativa no mesmo ponto', 'recusado', 'recusado', true); END $$;
RESET ROLE;
-- Carlos (responsável, perfil restrito) conduz a competência
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f6'); SET ROLE authenticated;
INSERT INTO r SELECT 'P3 responsável restrito vê o ponto fixo atribuído', 'Obra X', string_agg(name, ','), string_agg(name, ',') = 'Obra X' FROM fixed_posts;
INSERT INTO ctx SELECT 'per', fixed_post_open_period(pg_temp.c('pf')::uuid, '2026-10-15')::text;
INSERT INTO r SELECT 'P4 competência Outubro/2026 aberta com 5 profissionais', '2026-10-01 / 5', p.competence || ' / ' || count(i.*),
  p.competence = '2026-10-01' AND count(i.*) = 5 FROM fixed_post_periods p JOIN fixed_post_period_items i ON i.period_id = p.id GROUP BY p.competence;
INSERT INTO r SELECT 'P5 reabrir a mesma competência não duplica', '5', count(*)::text, count(*) = 5
  FROM fixed_post_period_items WHERE period_id = fixed_post_open_period(pg_temp.c('pf')::uuid, '2026-10-01');
-- A: 2 faltas → desconto 140; B: adicional 300; C: desconto 50 + adicional 50
UPDATE fixed_post_period_items SET absences = 2, discount = 140, notes = '2 faltas' WHERE person_id = (SELECT id FROM people WHERE full_name = 'Seguranca A Teste');
UPDATE fixed_post_period_items SET addition = 300, notes = 'Hora extra' WHERE person_id = (SELECT id FROM people WHERE full_name = 'Seguranca B Teste');
UPDATE fixed_post_period_items SET discount = 50, addition = 50 WHERE person_id = (SELECT id FROM people WHERE full_name = 'Seguranca C Teste');
DO $$ BEGIN
  PERFORM fixed_post_validate_period(pg_temp.c('per')::uuid);
  INSERT INTO r VALUES ('P6 validar com profissionais não conferidos', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('P6 validar com profissionais não conferidos', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Confira todos%'); END $$;
UPDATE fixed_post_period_items SET status = 'conferido' WHERE period_id = pg_temp.c('per')::uuid;
DO $$ BEGIN
  PERFORM fixed_post_send_period(pg_temp.c('per')::uuid);
  INSERT INTO r VALUES ('P7 enviar sem validar', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('P7 enviar sem validar', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Valide%'); END $$;
SELECT fixed_post_validate_period(pg_temp.c('per')::uuid);
DO $$ DECLARE n int; BEGIN
  UPDATE fixed_post_period_items SET addition = 999 WHERE period_id = pg_temp.c('per')::uuid; GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO r VALUES ('P8 alterar valores após validar', '0 linhas', n || ' linhas', n = 0);
END $$;
INSERT INTO r SELECT 'P9 valores finais', 'A 1960 · B 2500 · C 2300 · D 2400 · E 2500',
  string_agg(split_part(p.full_name, ' ', 2) || ' ' || i.final_amount::int, ' · ' ORDER BY p.full_name),
  string_agg(i.final_amount::int::text, ',' ORDER BY p.full_name) = '1960,2500,2300,2400,2500'
  FROM fixed_post_period_items i JOIN people p ON p.id = i.person_id WHERE i.period_id = pg_temp.c('per')::uuid;
INSERT INTO r SELECT 'P10 enviar ao financeiro gera exatamente 5 contas a pagar', '5', x::text, x = 5 FROM (SELECT fixed_post_send_period(pg_temp.c('per')::uuid) x) s;
DO $$ BEGIN
  PERFORM fixed_post_send_period(pg_temp.c('per')::uuid);
  INSERT INTO r VALUES ('P11 reenviar a competência', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('P11 reenviar a competência', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Competência já enviada%'); END $$;
RESET ROLE;
INSERT INTO r SELECT 'P12 sem duplicidade (5 lançamentos no total do ponto)', '5', count(*)::text, count(*) = 5 FROM payables WHERE operation_id = pg_temp.c('pf')::uuid;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f7'); SET ROLE authenticated;
INSERT INTO r SELECT 'P13 financeiro recebe tudo sem redigitar',
  'Seguranca A Teste|' || pg_temp.cpf('012345679') || '|cpf|' || pg_temp.cpf('012345679') || '|1960.00|Grupo Andrade|PF-OBRAX|Obra X|2026-10-01|CC-OBRAS — Obras|PONTO_FIXO',
  concat_ws('|', payee_name, payee_document, pix_type, pix_key, amount, (SELECT name FROM companies WHERE id = company_id), op_code, op_name, competence, cost_center, origin),
  concat_ws('|', payee_name, payee_document, pix_type, pix_key, amount, op_code, op_name, competence, cost_center, origin)
    = 'Seguranca A Teste|' || pg_temp.cpf('012345679') || '|cpf|' || pg_temp.cpf('012345679') || '|1960.00|PF-OBRAX|Obra X|2026-10-01|CC-OBRAS — Obras|PONTO_FIXO'
  FROM payables WHERE payee_name = 'Seguranca A Teste';
INSERT INTO r SELECT 'P14 CPF com zero à esquerda preservado no lançamento', '11 dígitos começando com 0', payee_document,
  length(payee_document) = 11 AND left(payee_document, 1) = '0' FROM payables WHERE payee_name = 'Seguranca A Teste';
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f9'); SET ROLE authenticated;
INSERT INTO r SELECT 'P15 coordenador restrito sem vínculo não vê o ponto fixo', '0',
  ((SELECT count(*) FROM fixed_posts) + (SELECT count(*) FROM fixed_post_members) + (SELECT count(*) FROM fixed_post_periods) + (SELECT count(*) FROM fixed_post_period_items))::text,
  ((SELECT count(*) FROM fixed_posts) + (SELECT count(*) FROM fixed_post_members) + (SELECT count(*) FROM fixed_post_periods) + (SELECT count(*) FROM fixed_post_period_items)) = 0;
DO $$ BEGIN
  PERFORM fixed_post_open_period(pg_temp.c('pf')::uuid, '2026-11-01');
  INSERT INTO r VALUES ('P16 coordenador sem vínculo abre competência', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('P16 coordenador sem vínculo abre competência', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Sem permissão%'); END $$;
RESET ROLE;
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000f8'); SET ROLE authenticated;
INSERT INTO r SELECT 'P17 usuário da MKTG não vê o ponto fixo do Andrade', '0', ((SELECT count(*) FROM fixed_posts) + (SELECT count(*) FROM payables WHERE origin = 'PONTO_FIXO'))::text,
  ((SELECT count(*) FROM fixed_posts) + (SELECT count(*) FROM payables WHERE origin = 'PONTO_FIXO')) = 0;
RESET ROLE;

SELECT set_config('request.jwt.claims', '', false), set_config('request.headers', '', false);
SELECT CASE WHEN pass THEN 'PASSOU' ELSE 'FALHOU' END AS resultado, test, expected, left(got, 110) AS obtido FROM r;
ROLLBACK;
