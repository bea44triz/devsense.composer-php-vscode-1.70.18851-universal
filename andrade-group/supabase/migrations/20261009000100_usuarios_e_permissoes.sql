-- Marco 3 — Usuários e Permissões pela interface (sem SQL manual).
-- company_users/company_user_permissions já tinham RLS de escrita direta (can_manage_company_users); o que faltava
-- era: (1) achar um usuário já cadastrado pelo e-mail sem abrir profiles para todo mundo, e (2) fazer os vínculos
-- de empresa + papel + operações como uma operação só, auditável e validada no banco.

-- 1) Buscar usuário por e-mail, só para quem já administra aquela empresa (ou é admin do grupo/Super Admin).
--    Não existe "convite por e-mail" ainda (precisa de SMTP configurado no projeto); a pessoa precisa já ter
--    se cadastrado (tela /entrar) com o papel "Consulta" antes de ganhar qualquer acesso.
CREATE OR REPLACE FUNCTION public.user_lookup_by_email(_company_id uuid, _email text)
RETURNS TABLE (user_id uuid, email text, full_name text, already_linked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_company_users(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar usuários desta empresa.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.full_name, EXISTS (SELECT 1 FROM public.company_users cu WHERE cu.company_id = _company_id AND cu.user_id = p.id)
    FROM public.profiles p WHERE p.email = lower(btrim(_email));
END $$;
REVOKE EXECUTE ON FUNCTION public.user_lookup_by_email FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_lookup_by_email TO authenticated;

-- 2) Lista de usuários da empresa com empresa(s)/papéis/permissões/operações atribuídas, para a tela de Administração.
CREATE OR REPLACE FUNCTION public.users_admin_list(_company_id uuid)
RETURNS TABLE (
  user_id uuid, email text, full_name text, active boolean,
  permissions public.app_permission[], operations_count bigint, is_platform_admin boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_company_users(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver usuários desta empresa.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT cu.user_id, p.email, p.full_name, cu.active,
           coalesce((SELECT array_agg(cup.permission ORDER BY cup.permission) FROM public.company_user_permissions cup
                     WHERE cup.company_id = cu.company_id AND cup.user_id = cu.user_id), '{}'),
           (SELECT count(*) FROM public.operation_members om WHERE om.company_id = cu.company_id AND om.user_id = cu.user_id),
           EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = cu.user_id)
    FROM public.company_users cu JOIN public.profiles p ON p.id = cu.user_id
    WHERE cu.company_id = _company_id
    ORDER BY p.full_name NULLS LAST, p.email;
END $$;
REVOKE EXECUTE ON FUNCTION public.users_admin_list FROM public, anon;
GRANT EXECUTE ON FUNCTION public.users_admin_list TO authenticated;

-- 3) Operações (eventos/pontos fixos) atribuídas a um usuário nesta empresa — para a aba de vínculos do usuário.
CREATE OR REPLACE FUNCTION public.user_operations_list(_company_id uuid, _user_id uuid)
RETURNS TABLE (operation_id uuid, type public.operation_type, code text, name text, role public.operation_role, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_company_users(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT o.id, o.type, coalesce(e.code, fp.code), o.name, om.role, o.status
    FROM public.operation_members om JOIN public.operations o ON o.id = om.operation_id
    LEFT JOIN public.events e ON e.id = o.id LEFT JOIN public.fixed_posts fp ON fp.id = o.id
    WHERE om.company_id = _company_id AND om.user_id = _user_id
    ORDER BY o.created_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.user_operations_list FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_operations_list TO authenticated;

-- 4) Conceder/editar acesso de um usuário a uma empresa: ativo/inativo + conjunto de permissões, tudo de uma vez.
--    Não concede nem revoga Super Admin (platform_admins é à parte, fora do alcance desta função).
CREATE OR REPLACE FUNCTION public.company_user_set_access(_company_id uuid, _user_id uuid, _active boolean, _permissions public.app_permission[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_company_users(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar usuários desta empresa.' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.company_users (company_id, user_id, active) VALUES (_company_id, _user_id, coalesce(_active, true))
    ON CONFLICT (company_id, user_id) DO UPDATE SET active = coalesce(_active, true);
  DELETE FROM public.company_user_permissions WHERE company_id = _company_id AND user_id = _user_id
    AND permission <> ALL (coalesce(_permissions, '{}'));
  INSERT INTO public.company_user_permissions (company_id, user_id, permission)
    SELECT _company_id, _user_id, x FROM unnest(coalesce(_permissions, '{}')) AS x
    ON CONFLICT DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.company_user_set_access FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_user_set_access TO authenticated;

-- 5) Revogar todo o acesso do usuário à empresa (remove permissões e vínculos de operação em cascata).
CREATE OR REPLACE FUNCTION public.company_user_revoke(_company_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_company_users(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar usuários desta empresa.' USING ERRCODE = '42501'; END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode revogar o seu próprio acesso.' USING ERRCODE = 'P0001'; END IF;
  DELETE FROM public.company_users WHERE company_id = _company_id AND user_id = _user_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.company_user_revoke FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_user_revoke TO authenticated;
