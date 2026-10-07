-- Vínculos dos usuários de TESTE do staging. Rodar SOMENTE no projeto de staging (SQL Editor ou psql).
-- Pré-requisito: os 8 usuários abaixo já criados em Authentication → Users (com "Auto Confirm User").
-- Para usar outro domínio de e-mail, troque 'staging.test' na primeira linha do CTE.
-- Idempotente: pode rodar de novo sem duplicar nada.
BEGIN;

CREATE TEMP TABLE stg_users ON COMMIT DROP AS
SELECT v.papel, v.email, u.id AS user_id
FROM (VALUES
  ('superadmin', 'stg.superadmin@staging.test'),
  ('andrade',    'stg.andrade@staging.test'),
  ('gestor061',  'stg.gestor061@staging.test'),
  ('mktg',       'stg.mktg@staging.test'),
  ('dono',       'stg.dono@staging.test'),
  ('coordA',     'stg.coorda@staging.test'),
  ('coordB',     'stg.coordb@staging.test'),
  ('financeiro', 'stg.financeiro@staging.test')
) AS v(papel, email)
LEFT JOIN auth.users u ON lower(u.email) = v.email;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM stg_users WHERE user_id IS NULL) THEN
    RAISE EXCEPTION 'Crie antes no Auth: %', (SELECT string_agg(email, ', ') FROM stg_users WHERE user_id IS NULL);
  END IF;
END $$;

-- Super Admin: concessão explícita (nenhum usuário vira Super Admin sozinho)
INSERT INTO public.platform_admins (user_id) SELECT user_id FROM stg_users WHERE papel = 'superadmin' ON CONFLICT DO NOTHING;

-- empresas: 1 = Grupo Andrade · 2 = 061 Eventos · 3 = MKTG
INSERT INTO public.company_users (company_id, user_id)
SELECT c.company_id::uuid, s.user_id FROM stg_users s JOIN (VALUES
  ('andrade',    'c0000000-0000-0000-0000-000000000001'),
  ('gestor061',  'c0000000-0000-0000-0000-000000000002'),
  ('mktg',       'c0000000-0000-0000-0000-000000000003'),
  ('dono',       'c0000000-0000-0000-0000-000000000002'),
  ('dono',       'c0000000-0000-0000-0000-000000000003'),
  ('coordA',     'c0000000-0000-0000-0000-000000000002'),
  ('coordB',     'c0000000-0000-0000-0000-000000000002'),
  ('financeiro', 'c0000000-0000-0000-0000-000000000002')
) AS c(papel, company_id) ON c.papel = s.papel
ON CONFLICT DO NOTHING;

INSERT INTO public.company_user_permissions (company_id, user_id, permission)
SELECT c.company_id::uuid, s.user_id, c.perm::public.app_permission FROM stg_users s JOIN (VALUES
  ('andrade',    'c0000000-0000-0000-0000-000000000001', 'operacao.gerenciar'),
  ('andrade',    'c0000000-0000-0000-0000-000000000001', 'operacao.todos'),
  ('gestor061',  'c0000000-0000-0000-0000-000000000002', 'operacao.gerenciar'),
  ('gestor061',  'c0000000-0000-0000-0000-000000000002', 'operacao.todos'),
  ('mktg',       'c0000000-0000-0000-0000-000000000003', 'operacao.gerenciar'),
  ('mktg',       'c0000000-0000-0000-0000-000000000003', 'operacao.todos'),
  ('dono',       'c0000000-0000-0000-0000-000000000002', 'empresa.admin'),
  ('dono',       'c0000000-0000-0000-0000-000000000002', 'consolidado.ver'),
  ('dono',       'c0000000-0000-0000-0000-000000000003', 'empresa.admin'),
  ('dono',       'c0000000-0000-0000-0000-000000000003', 'consolidado.ver'),
  ('coordA',     'c0000000-0000-0000-0000-000000000002', 'operacao.gerenciar'),
  ('coordB',     'c0000000-0000-0000-0000-000000000002', 'operacao.gerenciar'),
  ('financeiro', 'c0000000-0000-0000-0000-000000000002', 'financeiro.gerenciar')
) AS c(papel, company_id, perm) ON c.papel = s.papel
ON CONFLICT DO NOTHING;

SELECT papel, email, user_id FROM stg_users ORDER BY papel;
COMMIT;
