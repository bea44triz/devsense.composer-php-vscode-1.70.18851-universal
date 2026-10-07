-- Testes de isolamento da Fase 1. Criam dados sintéticos e os removem ao final.
-- Execução: psql -v ON_ERROR_STOP=1 -f supabase/tests/isolation_fase1.sql
CREATE TEMP TABLE r (test text, expected text, got text, pass boolean);
GRANT ALL ON r TO authenticated;

-- usuários de teste: UUIDs sintéticos (vínculos não dependem de auth.users)

UPDATE companies SET cnpj='11111111000111' WHERE id='c0000000-0000-0000-0000-000000000001';
UPDATE companies SET cnpj='22222222000122' WHERE id='c0000000-0000-0000-0000-000000000002';
UPDATE companies SET cnpj='33333333000133' WHERE id='c0000000-0000-0000-0000-000000000003';

INSERT INTO company_users(company_id,user_id) VALUES
 ('c0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1'),
 ('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a2'),
 ('c0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a3'),
 ('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a4'),
 ('c0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a4'),
 ('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a6'),
 ('c0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a6');
INSERT INTO company_user_permissions
SELECT cu.company_id, cu.user_id, p::app_permission FROM company_users cu
CROSS JOIN unnest(ARRAY['bancos.gerenciar','financeiro.gerenciar','operacao.gerenciar']) p
WHERE cu.user_id::text LIKE '00000000-0000-0000-0000-0000000000a%';
INSERT INTO company_user_permissions VALUES
 ('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a4','consolidado.ver'),
 ('c0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a4','consolidado.ver'),
 ('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a6','consolidado.ver');
INSERT INTO group_memberships VALUES ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a5','admin');

-- dados de teste (descartados no ROLLBACK)
INSERT INTO bank_accounts(id,company_id,bank_name,agency,account_number,holder_name,holder_document) VALUES
 ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','TESTE','0001','1','Andrade','11111111000111'),
 ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','TESTE','0001','2','061','22222222000122'),
 ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003','TESTE','0001','3','MKTG','33333333000133');
INSERT INTO operations(id,company_id,type,name) VALUES
 ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','PONTO_FIXO','T'),
 ('d0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','EVENTO','T'),
 ('d0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003','EVENTO','T');
INSERT INTO payables(company_id,operation_id,bank_account_id,description,amount) VALUES
 ('c0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','T',1),
 ('c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','T',1),
 ('c0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000003','T',1);

CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, false);
$$;

-- ===== A) Andrade tenta tenant 061/MKTG =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); SET ROLE authenticated;
INSERT INTO r SELECT 'A1 Andrade -> URL gestao061mktg.erp.com.br','0', count(*)::text, count(*)=0 FROM resolve_tenant('gestao061mktg.erp.com.br');
INSERT INTO r SELECT 'A2 Andrade -> slug gestao061mktg','0', count(*)::text, count(*)=0 FROM resolve_tenant('', 'gestao061mktg');
INSERT INTO r SELECT 'A3 Andrade lista grupos (só o próprio)','1', count(*)::text, count(*)=1 FROM client_groups;
INSERT INTO r SELECT 'A4 Andrade enxerga empresas 061/MKTG','0', count(*)::text, count(*)=0 FROM companies WHERE group_id='a0000000-0000-0000-0000-000000000002';
INSERT INTO r SELECT 'A5 Andrade vê contas/lançamentos de 061/MKTG','0', (SELECT count(*) FROM bank_accounts WHERE company_id<>'c0000000-0000-0000-0000-000000000001')+(SELECT count(*) FROM payables WHERE company_id<>'c0000000-0000-0000-0000-000000000001'), ((SELECT count(*) FROM bank_accounts WHERE company_id<>'c0000000-0000-0000-0000-000000000001')+(SELECT count(*) FROM payables WHERE company_id<>'c0000000-0000-0000-0000-000000000001'))=0;
INSERT INTO r SELECT 'A6 Andrade -> próprio tenant','1', count(*)::text, count(*)=1 FROM resolve_tenant('andrade.erp.com.br');
RESET ROLE;

-- ===== B) 061 tenta tenant Andrade =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2'); SET ROLE authenticated;
INSERT INTO r SELECT 'B1 061 -> URL andrade.erp.com.br','0', count(*)::text, count(*)=0 FROM resolve_tenant('andrade.erp.com.br');
INSERT INTO r SELECT 'B2 061 vê dados Andrade','0', (SELECT count(*) FROM companies WHERE group_id='a0000000-0000-0000-0000-000000000001')+(SELECT count(*) FROM bank_accounts WHERE company_id='c0000000-0000-0000-0000-000000000001'), ((SELECT count(*) FROM companies WHERE group_id='a0000000-0000-0000-0000-000000000001')+(SELECT count(*) FROM bank_accounts WHERE company_id='c0000000-0000-0000-0000-000000000001'))=0;
-- ===== C) somente 061 -> 0 MKTG =====
INSERT INTO r SELECT 'C1 só-061: registros MKTG (empresa+contas+operações+lançamentos)','0',
  (SELECT count(*) FROM companies WHERE id='c0000000-0000-0000-0000-000000000003')+(SELECT count(*) FROM bank_accounts WHERE company_id='c0000000-0000-0000-0000-000000000003')+(SELECT count(*) FROM operations WHERE company_id='c0000000-0000-0000-0000-000000000003')+(SELECT count(*) FROM payables WHERE company_id='c0000000-0000-0000-0000-000000000003'),
  ((SELECT count(*) FROM companies WHERE id='c0000000-0000-0000-0000-000000000003')+(SELECT count(*) FROM bank_accounts WHERE company_id='c0000000-0000-0000-0000-000000000003')+(SELECT count(*) FROM operations WHERE company_id='c0000000-0000-0000-0000-000000000003')+(SELECT count(*) FROM payables WHERE company_id='c0000000-0000-0000-0000-000000000003'))=0;
INSERT INTO r SELECT 'C2 só-061: consolidado disponível','false', can_view_consolidated('a0000000-0000-0000-0000-000000000002')::text, NOT can_view_consolidated('a0000000-0000-0000-0000-000000000002');
DO $$ BEGIN
  INSERT INTO bank_accounts(company_id,bank_name,agency,account_number,holder_name,holder_document) VALUES ('c0000000-0000-0000-0000-000000000003','X','1','1','MKTG','33333333000133');
  INSERT INTO r VALUES ('C3 só-061 cria conta na MKTG','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C3 só-061 cria conta na MKTG','recusado','recusado: '||SQLERRM,true); END $$;
DO $$ BEGIN
  INSERT INTO bank_accounts(company_id,bank_name,agency,account_number,holder_name,holder_document) VALUES ('c0000000-0000-0000-0000-000000000002','X','1','1','Outro','12345678000100');
  INSERT INTO r VALUES ('C4 titular divergente sem justificativa','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C4 titular divergente sem justificativa','recusado','recusado: '||SQLERRM,true); END $$;
DO $$ BEGIN
  INSERT INTO bank_accounts(company_id,bank_name,agency,account_number,holder_name,holder_document,mismatch_justification) VALUES ('c0000000-0000-0000-0000-000000000002','X','1','1','Outro','12345678000100','sócio');
  INSERT INTO r VALUES ('C5 divergente c/ justificativa, sem permissão de exceção','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C5 divergente c/ justificativa, sem permissão de exceção','recusado','recusado: '||SQLERRM,true); END $$;
RESET ROLE;
INSERT INTO company_user_permissions VALUES ('c0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a2','bancos.aceitar_divergencia');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2'); SET ROLE authenticated;
DO $$ DECLARE f boolean; BEGIN
  INSERT INTO bank_accounts(company_id,bank_name,agency,account_number,holder_name,holder_document,mismatch_justification) VALUES ('c0000000-0000-0000-0000-000000000002','X','1','1','Outro','12345678000100','conta do sócio') RETURNING holder_mismatch INTO f;
  INSERT INTO r VALUES ('C6 divergente c/ justificativa + permissão → aceita com flag','aceito+flag','aceito, flag='||f, f);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C6 divergente c/ justificativa + permissão → aceita com flag','aceito+flag','recusado: '||SQLERRM,false); END $$;
RESET ROLE;
UPDATE companies SET block_bank_holder_mismatch=true WHERE id='c0000000-0000-0000-0000-000000000002';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2'); SET ROLE authenticated;
DO $$ BEGIN
  INSERT INTO bank_accounts(company_id,bank_name,agency,account_number,holder_name,holder_document,mismatch_justification) VALUES ('c0000000-0000-0000-0000-000000000002','X','1','1','Outro','12345678000100','conta do sócio');
  INSERT INTO r VALUES ('C7 empresa configurada p/ bloqueio total','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('C7 empresa configurada p/ bloqueio total','recusado','recusado: '||SQLERRM,true); END $$;
RESET ROLE;
UPDATE companies SET block_bank_holder_mismatch=false WHERE id='c0000000-0000-0000-0000-000000000002';

-- ===== D) somente MKTG -> 0 061 =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3'); SET ROLE authenticated;
INSERT INTO r SELECT 'D1 só-MKTG: registros 061','0',
  (SELECT count(*) FROM companies WHERE id='c0000000-0000-0000-0000-000000000002')+(SELECT count(*) FROM bank_accounts WHERE company_id='c0000000-0000-0000-0000-000000000002')+(SELECT count(*) FROM operations WHERE company_id='c0000000-0000-0000-0000-000000000002')+(SELECT count(*) FROM payables WHERE company_id='c0000000-0000-0000-0000-000000000002'),
  ((SELECT count(*) FROM companies WHERE id='c0000000-0000-0000-0000-000000000002')+(SELECT count(*) FROM bank_accounts WHERE company_id='c0000000-0000-0000-0000-000000000002')+(SELECT count(*) FROM operations WHERE company_id='c0000000-0000-0000-0000-000000000002')+(SELECT count(*) FROM payables WHERE company_id='c0000000-0000-0000-0000-000000000002'))=0;
RESET ROLE;

-- ===== E) proprietário com dois vínculos =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a4'); SET ROLE authenticated;
INSERT INTO r SELECT 'E1 owner vê empresas 061 e MKTG','2', count(*)::text, count(*)=2 FROM companies;
INSERT INTO r SELECT 'E2 owner vê contas das duas','2', count(*)::text, count(*)=2 FROM bank_accounts WHERE bank_name='TESTE';
INSERT INTO r SELECT 'E3 owner pode ver consolidado','true', can_view_consolidated('a0000000-0000-0000-0000-000000000002')::text, can_view_consolidated('a0000000-0000-0000-0000-000000000002');
-- ===== G) conta MKTG em lançamento 061 =====
DO $$ BEGIN
  INSERT INTO payables(company_id,operation_id,bank_account_id,description,amount) VALUES ('c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000003','T',1);
  INSERT INTO r VALUES ('G1 conta MKTG paga lançamento 061','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('G1 conta MKTG paga lançamento 061','recusado','recusado: '||SQLERRM,true); END $$;
DO $$ BEGIN
  INSERT INTO payables(company_id,operation_id,description,amount) VALUES ('c0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000003','T',1);
  INSERT INTO r VALUES ('G2 lançamento 061 em operação MKTG','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('G2 lançamento 061 em operação MKTG','recusado','recusado: '||SQLERRM,true); END $$;
DO $$ BEGIN
  UPDATE payables SET bank_account_id='b0000000-0000-0000-0000-000000000003' WHERE company_id='c0000000-0000-0000-0000-000000000002';
  INSERT INTO r VALUES ('G3 trocar banco do lançamento 061 p/ conta MKTG','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('G3 trocar banco do lançamento 061 p/ conta MKTG','recusado','recusado: '||SQLERRM,true); END $$;
DO $$ BEGIN
  UPDATE bank_accounts SET company_id='c0000000-0000-0000-0000-000000000002' WHERE id='b0000000-0000-0000-0000-000000000003';
  INSERT INTO r VALUES ('G4 mover conta MKTG para 061','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('G4 mover conta MKTG para 061','recusado','recusado: '||SQLERRM,true); END $$;
RESET ROLE;

-- ===== F) admin de grupo sem vínculo =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a5'); SET ROLE authenticated;
INSERT INTO r SELECT 'F1 admin de grupo: dados operacionais (contas+operações+lançamentos)','0', (SELECT count(*) FROM bank_accounts)+(SELECT count(*) FROM operations)+(SELECT count(*) FROM payables), ((SELECT count(*) FROM bank_accounts)+(SELECT count(*) FROM operations)+(SELECT count(*) FROM payables))=0;
INSERT INTO r SELECT 'F2 admin de grupo: consolidado','false', can_view_consolidated('a0000000-0000-0000-0000-000000000002')::text, NOT can_view_consolidated('a0000000-0000-0000-0000-000000000002');
INSERT INTO r SELECT 'F3 admin de grupo vê Andrade','0', count(*)::text, count(*)=0 FROM client_groups WHERE slug='andrade';
RESET ROLE;

-- ===== H) consolidado parcial / somente leitura =====
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a6'); SET ROLE authenticated;
INSERT INTO r SELECT 'H1 consolidado.ver só na 061 → consolidado','false', can_view_consolidated('a0000000-0000-0000-0000-000000000002')::text, NOT can_view_consolidated('a0000000-0000-0000-0000-000000000002');
DO $$ BEGIN
  INSERT INTO payables(company_id,description,amount) VALUES (NULL,'T',1);
  INSERT INTO r VALUES ('H2 gravação sem empresa (modo consolidado)','recusado','aceito',false);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('H2 gravação sem empresa (modo consolidado)','recusado','recusado: '||SQLERRM,true); END $$;
RESET ROLE;


-- limpeza (dados de teste removidos)
DELETE FROM payables WHERE description='T';
DELETE FROM operations WHERE id::text LIKE 'd0000000-%';
DELETE FROM bank_accounts WHERE id::text LIKE 'b0000000-%' OR bank_name='X';
DELETE FROM company_users WHERE user_id::text LIKE '00000000-0000-0000-0000-0000000000a%';
DELETE FROM group_memberships WHERE user_id::text LIKE '00000000-0000-0000-0000-0000000000a%';
UPDATE companies SET cnpj=NULL;
DELETE FROM audit_log WHERE table_name IN ('payables','operations','bank_accounts','company_users','company_user_permissions','group_memberships') OR (table_name='companies' AND action='UPDATE');
SELECT set_config('request.jwt.claims','',false);
SELECT CASE WHEN pass THEN 'PASSOU' ELSE 'FALHOU' END AS resultado, test, expected, left(got,90) AS obtido FROM r;
