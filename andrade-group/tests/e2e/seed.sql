-- Dados de teste do E2E (banco local descartável). E-mails fictícios, CPFs sintéticos.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'authenticator';
  END IF;
END $$;
GRANT anon, authenticated, service_role TO authenticator;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000aa00', 'admin@plataforma.test'),   -- Super Admin (concedido explicitamente abaixo; sem vínculo de dados)
  ('00000000-0000-0000-0000-00000000aa01', 'lider@061.test'),          -- operação + financeiro (leitura) na 061
  ('00000000-0000-0000-0000-00000000aa02', 'operacao@mktg.test'),      -- operação só na MKTG
  ('00000000-0000-0000-0000-00000000aa03', 'dono@061mktg.test'),       -- 061 + MKTG com consolidado
  ('00000000-0000-0000-0000-00000000aa04', 'lider@andrade.test'),      -- operação no Grupo Andrade (restrito)
  ('00000000-0000-0000-0000-00000000aa05', 'gestor@andrade.test'),     -- gestor Andrade: operação + todas as operações
  ('00000000-0000-0000-0000-00000000aa06', 'carlos@andrade.test'),     -- coordenador Andrade (restrito; responsável do ponto fixo)
  ('00000000-0000-0000-0000-00000000aa07', 'financeiro@andrade.test'), -- financeiro Andrade
  ('00000000-0000-0000-0000-00000000aa08', 'outro.coord@andrade.test');-- coordenador Andrade sem vínculo ao ponto fixo
INSERT INTO platform_admins (user_id) VALUES ('00000000-0000-0000-0000-00000000aa00');
UPDATE profiles SET full_name = 'Carlos Coordenador' WHERE id = '00000000-0000-0000-0000-00000000aa06';
UPDATE profiles SET full_name = 'Gestor Andrade' WHERE id = '00000000-0000-0000-0000-00000000aa05';

INSERT INTO company_users (company_id, user_id) VALUES
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa02'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa03'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa03'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa04'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa05'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa06'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa07'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa08');
INSERT INTO company_user_permissions VALUES
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01', 'operacao.gerenciar'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01', 'financeiro.ver'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa02', 'operacao.gerenciar'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa03', 'empresa.admin'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa03', 'consolidado.ver'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa03', 'empresa.admin'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa03', 'consolidado.ver'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa04', 'operacao.gerenciar'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa05', 'operacao.gerenciar'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa05', 'operacao.todos'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa06', 'operacao.gerenciar'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa07', 'financeiro.gerenciar'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa08', 'operacao.gerenciar');

-- cadastros da 061 usados no roteiro do Marco 1 (o líder não tem permissão de cadastrar)
INSERT INTO clientes_evento (company_id, razao_social, nome_fantasia, documento) VALUES
  ('c0000000-0000-0000-0000-000000000002', 'Cliente Exemplo Ltda', 'Cliente Exemplo', '11222333000181');
INSERT INTO centros_custo (company_id, codigo, nome) VALUES ('c0000000-0000-0000-0000-000000000002', 'CC-061-01', 'Eventos');

-- usuários do roteiro de staging (tests/staging), só para ensaiar o script localmente; vínculos vêm de tests/staging/grants.sql
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000bb00', 'stg.superadmin@staging.test'),
  ('00000000-0000-0000-0000-00000000bb01', 'stg.andrade@staging.test'),
  ('00000000-0000-0000-0000-00000000bb02', 'stg.gestor061@staging.test'),
  ('00000000-0000-0000-0000-00000000bb03', 'stg.mktg@staging.test'),
  ('00000000-0000-0000-0000-00000000bb04', 'stg.dono@staging.test'),
  ('00000000-0000-0000-0000-00000000bb05', 'stg.coorda@staging.test'),
  ('00000000-0000-0000-0000-00000000bb06', 'stg.coordb@staging.test'),
  ('00000000-0000-0000-0000-00000000bb07', 'stg.financeiro@staging.test');
