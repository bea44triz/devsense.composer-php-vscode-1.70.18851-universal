-- Dados de teste do E2E (banco local descartável). E-mails fictícios, CPFs sintéticos.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'authenticator';
  END IF;
END $$;
GRANT anon, authenticated, service_role TO authenticator;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000aa00', 'admin@plataforma.test'),   -- 1º usuário = Super Admin (sem vínculo de dados)
  ('00000000-0000-0000-0000-00000000aa01', 'lider@061.test'),          -- operação + financeiro (leitura) na 061
  ('00000000-0000-0000-0000-00000000aa02', 'operacao@mktg.test'),      -- operação só na MKTG
  ('00000000-0000-0000-0000-00000000aa03', 'dono@061mktg.test'),       -- 061 + MKTG com consolidado
  ('00000000-0000-0000-0000-00000000aa04', 'lider@andrade.test');      -- operação no Grupo Andrade

INSERT INTO company_users (company_id, user_id) VALUES
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa02'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa03'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa03'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa04');
INSERT INTO company_user_permissions VALUES
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01', 'operacao.gerenciar'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01', 'financeiro.ver'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa02', 'operacao.gerenciar'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa03', 'empresa.admin'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa03', 'consolidado.ver'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa03', 'empresa.admin'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa03', 'consolidado.ver'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa04', 'operacao.gerenciar');
