-- Endurecimento de privilégios (equivalente ao que os advisors do Supabase cobram).
-- No Supabase, tudo que é criado no schema public recebe privilégios padrão para anon e authenticated.
-- O RLS impede a leitura das linhas, mas aqui removemos também os privilégios desnecessários:
--  · anon não acessa nenhuma tabela; executa apenas as 5 RPCs públicas dos links
--  · authenticated: sem TRUNCATE/TRIGGER/REFERENCES; executa só as funções da allowlist
--  · funções de uso exclusivo do servidor ficam só com service_role
-- Esta migration é idempotente e deve ficar por último; ao criar funções novas, inclua-as na allowlist.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- PIX completo nunca por SELECT (os privilégios padrão do Supabase reconcederiam a tabela inteira)
REVOKE SELECT ON public.people, public.fornecedores FROM authenticated;
GRANT SELECT (id, company_id, full_name, cpf, phone, email, pix_type, main_role, status, pix_updated_publicly_at, created_at, has_pix, pix_key_masked)
  ON public.people TO authenticated;
GRANT SELECT (id, company_id, razao_social, nome_fantasia, documento, telefone, email, pix_type, servico, status, created_at, has_pix, pix_key_masked)
  ON public.fornecedores TO authenticated;
-- tentativas e auditoria: só leitura (políticas decidem quem)
REVOKE INSERT, UPDATE, DELETE ON public.public_link_attempts, public.audit_log, public.platform_admins FROM authenticated;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

DO $$
DECLARE f text;
  -- links públicos (sem login)
  anon_ok text[] := ARRAY['public_invite_info', 'public_invite_lookup', 'public_invite_register', 'public_presence_info', 'public_presence_lookup'];
  -- usuário logado: funções usadas pelas políticas RLS, pelos defaults/triggers e as RPCs das telas
  auth_ok text[] := ARRAY[
    'is_platform_admin', 'has_company_access', 'has_company_permission', 'is_group_admin', 'has_group_access', 'can_view_consolidated',
    'shares_scope_with', 'can_manage_company_users', 'in_operation_scope', 'can_see_operation', 'can_manage_operation',
    'can_see_participant', 'can_see_period', 'can_see_person', 'can_read_registry', 'can_manage_registry',
    'resolve_tenant', 'my_tenants', 'my_company_context', 'add_company_user',
    'event_create', 'event_update_refs', 'event_finish', 'event_send_to_finance', 'rotate_link',
    'fixed_post_create', 'fixed_post_open_period', 'fixed_post_validate_period', 'fixed_post_reopen_period', 'fixed_post_send_period',
    'operation_member_set', 'operation_members_list', 'company_assignable_users', 'person_pix', 'fornecedor_pix', 'person_upsert',
    'only_digits', 'is_valid_cpf', 'is_valid_cnpj', 'is_valid_celular', 'is_valid_email', 'is_valid_pix', 'normalize_pix',
    'team_name_key', 'new_link_token', 'local_today', 'hash_text', 'cc_label',
    'public_invite_info', 'public_invite_lookup', 'public_invite_register', 'public_presence_info', 'public_presence_lookup'];
  r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' LOOP
    IF r.proname = ANY (anon_ok) THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig); END IF;
    IF r.proname = ANY (auth_ok) THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig); END IF;
  END LOOP;
END $$;

-- Objetos criados depois por este papel não ganham EXECUTE automático para anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
