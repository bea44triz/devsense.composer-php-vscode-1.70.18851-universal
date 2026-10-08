-- Marco 3 — Usuários e Permissões pela interface, e correção do IP confiável nos links públicos.
-- Roda numa transação e desfaz tudo no fim (ROLLBACK).
BEGIN;
CREATE TEMP TABLE r (test text, expected text, got text, pass boolean);
CREATE TEMP TABLE ctx (k text PRIMARY KEY, v text);
GRANT ALL ON r, ctx TO authenticated, anon, service_role;
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
CREATE FUNCTION pg_temp.as_anon(xff text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"anon"}', false), set_config('request.headers', json_build_object('x-forwarded-for', xff)::text, false) $$;
CREATE FUNCTION pg_temp.c(k text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM ctx WHERE ctx.k = $1 $$;

-- ===== I) IP confiável (último item de X-Forwarded-For, não o primeiro) =====
SELECT pg_temp.as_anon('203.0.113.9');
INSERT INTO r SELECT 'I1 um só IP no cabeçalho', '203.0.113.9', request_ip(), request_ip() = '203.0.113.9';
SELECT pg_temp.as_anon('203.0.113.9, 10.0.0.1');
INSERT INTO r SELECT 'I2 visitante forja o 1º item; usa o último (anexado pelo proxy)', '10.0.0.1', request_ip(), request_ip() = '10.0.0.1';
SELECT pg_temp.as_anon(' 1.2.3.4 , 5.6.7.8 , 9.9.9.9 ');
INSERT INTO r SELECT 'I3 cadeia com vários proxies: usa o último, com espaços tolerados', '9.9.9.9', request_ip(), request_ip() = '9.9.9.9';
SELECT set_config('request.headers', '', false);

-- ===== U) Usuários e Permissões =====
INSERT INTO auth.users(id, email) VALUES
 ('00000000-0000-0000-0000-0000000000e1', 'admin061@u3.test'),   -- empresa.admin na 061
 ('00000000-0000-0000-0000-0000000000e2', 'coord061@u3.test'),   -- coordenador restrito, sem usuarios.gerenciar
 ('00000000-0000-0000-0000-0000000000e3', 'novo@u3.test');       -- já tem conta (perfil, via handle_new_user) mas ainda sem empresa nenhuma
-- '...000ff': nunca passou por auth.users, não tem profiles — simula quem ainda não criou conta nenhuma
INSERT INTO company_users(company_id, user_id) VALUES
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1'),
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e2');
INSERT INTO company_user_permissions(company_id, user_id, permission) VALUES
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1', 'empresa.admin'),
 ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e2', 'operacao.gerenciar');
DELETE FROM company_users WHERE user_id = '00000000-0000-0000-0000-0000000000e3'; -- profiles existe (trigger), sem empresa

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000e2'); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM user_lookup_by_email('c0000000-0000-0000-0000-000000000002', 'novo@u3.test');
  INSERT INTO r VALUES ('U1 coordenador (sem usuarios.gerenciar) busca usuário', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('U1 coordenador (sem usuarios.gerenciar) busca usuário', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
RESET ROLE;

SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000e1'); SET ROLE authenticated;
INSERT INTO r SELECT 'U2 admin da empresa encontra usuário já cadastrado (sem vínculo ainda)', 'novo@u3.test|f',
  (email || '|' || already_linked::text), email = 'novo@u3.test' AND already_linked = false
  FROM user_lookup_by_email('c0000000-0000-0000-0000-000000000002', 'NOVO@U3.TEST');
INSERT INTO r SELECT 'U3 usuário sem conta ainda não aparece na busca', '0 linhas', count(*)::text, count(*) = 0
  FROM user_lookup_by_email('c0000000-0000-0000-0000-000000000002', 'naoexiste@andrade.test');

SELECT company_user_set_access('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e3', true, ARRAY['operacao.gerenciar']::app_permission[]);
INSERT INTO r SELECT 'U4 conceder acesso + permissão numa chamada só', 'operacao.gerenciar',
  (SELECT string_agg(permission::text, ',') FROM company_user_permissions WHERE company_id = 'c0000000-0000-0000-0000-000000000002' AND user_id = '00000000-0000-0000-0000-0000000000e3'),
  (SELECT string_agg(permission::text, ',') FROM company_user_permissions WHERE company_id = 'c0000000-0000-0000-0000-000000000002' AND user_id = '00000000-0000-0000-0000-0000000000e3') = 'operacao.gerenciar';
SELECT company_user_set_access('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e3', true, ARRAY['operacao.gerenciar','operacao.todos']::app_permission[]);
INSERT INTO r SELECT 'U5 trocar o conjunto de permissões substitui (não acumula)', 'operacao.gerenciar,operacao.todos',
  (SELECT string_agg(permission::text, ',' ORDER BY permission) FROM company_user_permissions WHERE company_id = 'c0000000-0000-0000-0000-000000000002' AND user_id = '00000000-0000-0000-0000-0000000000e3'),
  (SELECT string_agg(permission::text, ',' ORDER BY permission) FROM company_user_permissions WHERE company_id = 'c0000000-0000-0000-0000-000000000002' AND user_id = '00000000-0000-0000-0000-0000000000e3') = 'operacao.gerenciar,operacao.todos';

DO $$ BEGIN
  PERFORM company_user_set_access('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000e3', true, ARRAY['operacao.gerenciar']::app_permission[]);
  INSERT INTO r VALUES ('U6 admin da 061 concede acesso na MKTG (empresa errada)', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('U6 admin da 061 concede acesso na MKTG (empresa errada)', 'recusado', 'recusado: ' || SQLERRM, true); END $$;
DO $$ BEGIN
  PERFORM company_user_set_access('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000ff', true, '{}'::app_permission[]);
  INSERT INTO r VALUES ('U7 conceder acesso a usuário sem conta', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('U7 conceder acesso a usuário sem conta', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE 'Usuário não encontrado%'); END $$;

INSERT INTO r SELECT 'U8 lista de usuários da empresa traz o papel concedido', 'operacao.gerenciar,operacao.todos',
  (SELECT string_agg(up::text, ',' ORDER BY up) FROM unnest((SELECT permissions FROM users_admin_list('c0000000-0000-0000-0000-000000000002') WHERE user_id = '00000000-0000-0000-0000-0000000000e3')) up),
  (SELECT string_agg(up::text, ',' ORDER BY up) FROM unnest((SELECT permissions FROM users_admin_list('c0000000-0000-0000-0000-000000000002') WHERE user_id = '00000000-0000-0000-0000-0000000000e3')) up) = 'operacao.gerenciar,operacao.todos';

SELECT company_user_revoke('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e3');
INSERT INTO r SELECT 'U9 revogar remove o vínculo com a empresa', '0', count(*)::text, count(*) = 0
  FROM company_users WHERE company_id = 'c0000000-0000-0000-0000-000000000002' AND user_id = '00000000-0000-0000-0000-0000000000e3';
INSERT INTO r SELECT 'U10 revogar também apaga as permissões (cascata)', '0', count(*)::text, count(*) = 0
  FROM company_user_permissions WHERE company_id = 'c0000000-0000-0000-0000-000000000002' AND user_id = '00000000-0000-0000-0000-0000000000e3';
DO $$ BEGIN
  PERFORM company_user_revoke('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1');
  INSERT INTO r VALUES ('U11 admin tenta revogar o próprio acesso', 'recusado', 'aceito', false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('U11 admin tenta revogar o próprio acesso', 'recusado', 'recusado: ' || SQLERRM, SQLERRM LIKE '%próprio acesso%'); END $$;
RESET ROLE;

-- Ninguém ganha permissão operacional automaticamente ao entrar no grupo (sem vínculo de empresa = sem company_users)
INSERT INTO r SELECT 'U12 usuário recém-cadastrado, sem vínculo, não tem nenhuma empresa', '0', count(*)::text, count(*) = 0
  FROM company_users WHERE user_id = '00000000-0000-0000-0000-0000000000e3';

SELECT set_config('request.jwt.claims', '', false);
SELECT CASE WHEN pass THEN 'PASSOU' ELSE 'FALHOU' END AS resultado, test, expected, left(got, 160) AS obtido FROM r;
ROLLBACK;
