
-- ===================== ENUMS =====================
CREATE TYPE public.group_role AS ENUM ('owner','admin');
CREATE TYPE public.app_permission AS ENUM (
  'empresa.admin','usuarios.gerenciar',
  'bancos.ver','bancos.gerenciar','bancos.aceitar_divergencia',
  'financeiro.ver','financeiro.gerenciar',
  'operacao.ver','operacao.gerenciar',
  'consolidado.ver','auditoria.ver'
);
CREATE TYPE public.operation_type AS ENUM ('EVENTO','PONTO_FIXO');
CREATE TYPE public.payable_status AS ENUM ('pendente_validacao','a_pagar','aprovado','agendado','pago','cancelado');

-- ===================== PLATAFORMA =====================
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  domains text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_groups TO authenticated;
GRANT ALL ON public.client_groups TO service_role;
ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.client_groups(id) ON DELETE RESTRICT,
  name text NOT NULL,
  legal_name text,
  cnpj text,
  color text,
  block_bank_holder_mismatch boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, group_id)
);
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Governança do grupo (NÃO concede acesso a dados operacionais)
CREATE TABLE public.group_memberships (
  group_id uuid NOT NULL REFERENCES public.client_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.group_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_memberships TO authenticated;
GRANT ALL ON public.group_memberships TO service_role;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

-- empresas_usuarios: vínculo operacional explícito
CREATE TABLE public.company_users (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_users TO authenticated;
GRANT ALL ON public.company_users TO service_role;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_user_permissions (
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission public.app_permission NOT NULL,
  PRIMARY KEY (company_id, user_id, permission),
  FOREIGN KEY (company_id, user_id) REFERENCES public.company_users(company_id, user_id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, DELETE ON public.company_user_permissions TO authenticated;
GRANT ALL ON public.company_user_permissions TO service_role;
ALTER TABLE public.company_user_permissions ENABLE ROW LEVEL SECURITY;

-- ===================== FUNÇÕES DE SEGURANÇA =====================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.has_company_access(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users cu JOIN public.companies c ON c.id = cu.company_id
    WHERE cu.company_id = _company_id AND cu.user_id = auth.uid() AND cu.active AND c.active)
$$;

CREATE OR REPLACE FUNCTION public.has_company_permission(_company_id uuid, _perm public.app_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_company_access(_company_id) AND EXISTS (
    SELECT 1 FROM public.company_user_permissions p
    WHERE p.company_id = _company_id AND p.user_id = auth.uid()
      AND (p.permission = _perm OR p.permission = 'empresa.admin'))
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_memberships
                 WHERE group_id = _group_id AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.has_group_access(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin() OR public.is_group_admin(_group_id) OR EXISTS (
    SELECT 1 FROM public.company_users cu JOIN public.companies c ON c.id = cu.company_id
    WHERE c.group_id = _group_id AND cu.user_id = auth.uid() AND cu.active)
$$;

-- Consolidado: vínculo + consolidado.ver em TODAS as empresas ativas do grupo (mín. 2)
CREATE OR REPLACE FUNCTION public.can_view_consolidated(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.companies WHERE group_id = _group_id AND active) >= 2
     AND NOT EXISTS (
       SELECT 1 FROM public.companies c
       WHERE c.group_id = _group_id AND c.active
         AND NOT EXISTS (
           SELECT 1 FROM public.company_users cu
           JOIN public.company_user_permissions p ON p.company_id = cu.company_id AND p.user_id = cu.user_id
           WHERE cu.company_id = c.id AND cu.user_id = auth.uid() AND cu.active
             AND p.permission = 'consolidado.ver'))
$$;

CREATE OR REPLACE FUNCTION public.shares_scope_with(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE (EXISTS (SELECT 1 FROM public.company_users WHERE company_id = c.id AND user_id = _user)
        OR EXISTS (SELECT 1 FROM public.group_memberships WHERE group_id = c.group_id AND user_id = _user))
      AND (public.is_group_admin(c.group_id) OR public.has_company_permission(c.id, 'usuarios.gerenciar')))
$$;

-- Tenant: resolve pelo domínio ou slug; só retorna se o usuário tiver acesso
-- (resposta idêntica para "não existe" e "sem acesso" → não revela tenants)
CREATE OR REPLACE FUNCTION public.resolve_tenant(_host text, _slug text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name, g.slug FROM public.client_groups g
  WHERE g.active
    AND ((_slug IS NOT NULL AND g.slug = _slug) OR (_slug IS NULL AND lower(_host) = ANY (g.domains)))
    AND public.has_group_access(g.id)
  LIMIT 1
$$;

-- Tenants acessíveis (para quando o domínio não estiver mapeado, ex: preview)
CREATE OR REPLACE FUNCTION public.my_tenants()
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name, g.slug FROM public.client_groups g
  WHERE g.active AND public.has_group_access(g.id) ORDER BY g.name
$$;

-- Contexto do usuário dentro de um tenant
CREATE OR REPLACE FUNCTION public.my_company_context(_group_id uuid)
RETURNS TABLE (company_id uuid, name text, color text, permissions public.app_permission[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.color,
    COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}')
  FROM public.companies c
  JOIN public.company_users cu ON cu.company_id = c.id AND cu.user_id = auth.uid() AND cu.active
  LEFT JOIN public.company_user_permissions p ON p.company_id = c.id AND p.user_id = auth.uid()
  WHERE c.group_id = _group_id AND c.active
  GROUP BY c.id, c.name, c.color ORDER BY c.name
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin, public.has_company_access, public.has_company_permission,
  public.is_group_admin, public.has_group_access, public.can_view_consolidated, public.shares_scope_with,
  public.resolve_tenant, public.my_tenants, public.my_company_context FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin, public.has_company_access, public.has_company_permission,
  public.is_group_admin, public.has_group_access, public.can_view_consolidated, public.shares_scope_with,
  public.resolve_tenant, public.my_tenants, public.my_company_context TO authenticated;

-- ===================== POLÍTICAS (governança) =====================
CREATE POLICY "pa_self" ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_scope_with(id));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "groups_select" ON public.client_groups FOR SELECT TO authenticated
  USING (public.has_group_access(id));
CREATE POLICY "groups_insert" ON public.client_groups FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());
CREATE POLICY "groups_update" ON public.client_groups FOR UPDATE TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_group_admin(group_id) OR public.has_company_access(id));
CREATE POLICY "companies_insert" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin() OR public.is_group_admin(group_id));
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR public.is_group_admin(group_id) OR public.has_company_permission(id,'empresa.admin'))
  WITH CHECK (public.is_platform_admin() OR public.is_group_admin(group_id) OR public.has_company_permission(id,'empresa.admin'));

CREATE POLICY "gm_select" ON public.group_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_admin(group_id) OR public.is_platform_admin());
CREATE POLICY "gm_write" ON public.group_memberships FOR ALL TO authenticated
  USING (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.group_memberships m WHERE m.group_id = group_memberships.group_id AND m.user_id = auth.uid() AND m.role = 'owner'))
  WITH CHECK (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.group_memberships m WHERE m.group_id = group_memberships.group_id AND m.user_id = auth.uid() AND m.role = 'owner'));

CREATE OR REPLACE FUNCTION public.can_manage_company_users(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin()
      OR public.is_group_admin((SELECT group_id FROM public.companies WHERE id = _company_id))
      OR public.has_company_permission(_company_id, 'usuarios.gerenciar')
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_company_users FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_company_users TO authenticated;

CREATE POLICY "cu_select" ON public.company_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_company_users(company_id));
CREATE POLICY "cu_write" ON public.company_users FOR ALL TO authenticated
  USING (public.can_manage_company_users(company_id)) WITH CHECK (public.can_manage_company_users(company_id));

CREATE POLICY "cup_select" ON public.company_user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_company_users(company_id));
CREATE POLICY "cup_write" ON public.company_user_permissions FOR ALL TO authenticated
  USING (public.can_manage_company_users(company_id)) WITH CHECK (public.can_manage_company_users(company_id));

-- ===================== CONTAS BANCÁRIAS =====================
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  bank_code text,
  bank_name text NOT NULL,
  agency text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL DEFAULT 'corrente',
  holder_name text NOT NULL,
  holder_document text NOT NULL,
  pix_key text,
  holder_mismatch boolean NOT NULL DEFAULT false,
  mismatch_justification text,
  mismatch_accepted_by uuid,
  mismatch_accepted_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id)
);
GRANT SELECT, INSERT, UPDATE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ba_select" ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.has_company_permission(company_id,'bancos.ver') OR public.has_company_permission(company_id,'bancos.gerenciar'));
CREATE POLICY "ba_insert" ON public.bank_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_company_permission(company_id,'bancos.gerenciar'));
CREATE POLICY "ba_update" ON public.bank_accounts FOR UPDATE TO authenticated
  USING (public.has_company_permission(company_id,'bancos.gerenciar'))
  WITH CHECK (public.has_company_permission(company_id,'bancos.gerenciar'));

CREATE OR REPLACE FUNCTION public.bank_accounts_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cnpj text; v_block boolean;
BEGIN
  SELECT regexp_replace(coalesce(cnpj,''),'\D','','g'), block_bank_holder_mismatch
    INTO v_cnpj, v_block FROM public.companies WHERE id = NEW.company_id;
  NEW.holder_document := regexp_replace(NEW.holder_document,'\D','','g');
  NEW.holder_mismatch := (v_cnpj = '' OR NEW.holder_document <> v_cnpj);
  IF NEW.holder_mismatch THEN
    IF v_block THEN
      RAISE EXCEPTION 'Titular da conta diverge do CNPJ da empresa e esta empresa bloqueia divergências.' USING ERRCODE = 'P0001';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.holder_document IS DISTINCT FROM OLD.holder_document
       OR NEW.mismatch_justification IS DISTINCT FROM OLD.mismatch_justification THEN
      IF coalesce(btrim(NEW.mismatch_justification),'') = '' THEN
        RAISE EXCEPTION 'Justificativa obrigatória para titular divergente.' USING ERRCODE = 'P0001';
      END IF;
      IF NOT public.has_company_permission(NEW.company_id,'bancos.aceitar_divergencia') THEN
        RAISE EXCEPTION 'Sem permissão para aceitar titular divergente.' USING ERRCODE = '42501';
      END IF;
      NEW.mismatch_accepted_by := auth.uid();
      NEW.mismatch_accepted_at := now();
    END IF;
  ELSE
    NEW.mismatch_justification := NULL; NEW.mismatch_accepted_by := NULL; NEW.mismatch_accepted_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bank_accounts_validate BEFORE INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.bank_accounts_validate();

-- ===================== OPERAÇÕES (EVENTO / PONTO_FIXO) — esqueleto =====================
CREATE TABLE public.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  type public.operation_type NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id)
);
GRANT SELECT, INSERT, UPDATE ON public.operations TO authenticated;
GRANT ALL ON public.operations TO service_role;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_select" ON public.operations FOR SELECT TO authenticated
  USING (public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY "op_write" ON public.operations FOR INSERT TO authenticated
  WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY "op_update" ON public.operations FOR UPDATE TO authenticated
  USING (public.has_company_permission(company_id,'operacao.gerenciar'))
  WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));

-- ===================== CONTAS A PAGAR — esqueleto com FKs compostas =====================
CREATE TABLE public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  operation_id uuid,
  bank_account_id uuid,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  due_date date,
  status public.payable_status NOT NULL DEFAULT 'pendente_validacao',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (operation_id, company_id) REFERENCES public.operations(id, company_id),
  FOREIGN KEY (bank_account_id, company_id) REFERENCES public.bank_accounts(id, company_id)
);
GRANT SELECT, INSERT, UPDATE ON public.payables TO authenticated;
GRANT ALL ON public.payables TO service_role;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_select" ON public.payables FOR SELECT TO authenticated
  USING (public.has_company_permission(company_id,'financeiro.ver') OR public.has_company_permission(company_id,'financeiro.gerenciar'));
CREATE POLICY "pay_insert" ON public.payables FOR INSERT TO authenticated
  WITH CHECK (public.has_company_permission(company_id,'financeiro.gerenciar'));
CREATE POLICY "pay_update" ON public.payables FOR UPDATE TO authenticated
  USING (public.has_company_permission(company_id,'financeiro.gerenciar'))
  WITH CHECK (public.has_company_permission(company_id,'financeiro.gerenciar'));

-- company_id imutável em registros operacionais
CREATE OR REPLACE FUNCTION public.lock_company_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'A empresa de um registro não pode ser alterada.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lock_company_ba BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.lock_company_id();
CREATE TRIGGER trg_lock_company_op BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.lock_company_id();
CREATE TRIGGER trg_lock_company_pay BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.lock_company_id();

-- ===================== AUDITORIA =====================
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  action text NOT NULL,
  record_id text,
  company_id uuid,
  group_id uuid,
  user_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin()
      OR (company_id IS NOT NULL AND public.has_company_permission(company_id,'auditoria.ver'))
      OR (company_id IS NULL AND group_id IS NOT NULL AND public.is_group_admin(group_id)));

CREATE OR REPLACE FUNCTION public.audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; o jsonb; v_company uuid; v_group uuid; v_id text;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  o := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_id := coalesce(r->>'id', o->>'id', r->>'user_id', o->>'user_id');
  v_company := coalesce(r->>'company_id', o->>'company_id')::uuid;
  IF TG_TABLE_NAME = 'companies' THEN v_company := v_id::uuid; END IF;
  v_group := coalesce(r->>'group_id', o->>'group_id')::uuid;
  IF v_group IS NULL AND v_company IS NOT NULL THEN
    SELECT group_id INTO v_group FROM public.companies WHERE id = v_company;
  END IF;
  INSERT INTO public.audit_log(table_name, action, record_id, company_id, group_id, user_id, old_data, new_data)
  VALUES (TG_TABLE_NAME, TG_OP, v_id, v_company, v_group, auth.uid(), o, r);
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_group_memberships AFTER INSERT OR UPDATE OR DELETE ON public.group_memberships FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_company_users AFTER INSERT OR UPDATE OR DELETE ON public.company_users FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_company_user_permissions AFTER INSERT OR DELETE ON public.company_user_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_bank_accounts AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_operations AFTER INSERT OR UPDATE OR DELETE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_payables AFTER INSERT OR UPDATE OR DELETE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.audit_row();

-- ===================== CADASTRO / BOOTSTRAP =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (NEW.id, lower(NEW.email), NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  -- primeiro usuário da plataforma vira Super Admin
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins) THEN
    INSERT INTO public.platform_admins(user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Vincular usuário (já cadastrado) a uma empresa por e-mail
CREATE OR REPLACE FUNCTION public.add_company_user(_company_id uuid, _email text, _permissions public.app_permission[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; p public.app_permission;
BEGIN
  IF NOT public.can_manage_company_users(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_user FROM public.profiles WHERE email = lower(btrim(_email));
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado. Peça para a pessoa criar a conta primeiro.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.company_users(company_id, user_id) VALUES (_company_id, v_user)
    ON CONFLICT (company_id, user_id) DO UPDATE SET active = true;
  FOREACH p IN ARRAY coalesce(_permissions, '{}') LOOP
    INSERT INTO public.company_user_permissions VALUES (_company_id, v_user, p) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN v_user;
END $$;
REVOKE EXECUTE ON FUNCTION public.add_company_user FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_company_user TO authenticated;

-- ===================== SEED (somente grupos e empresas) =====================
INSERT INTO public.client_groups (id, name, slug, domains) VALUES
  ('a0000000-0000-0000-0000-000000000001','Grupo Andrade','andrade','{andrade.erp.com.br}'),
  ('a0000000-0000-0000-0000-000000000002','Grupo 061/MKTG','gestao061mktg','{gestao061mktg.erp.com.br}');
INSERT INTO public.companies (id, group_id, name, color) VALUES
  ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Grupo Andrade','andrade'),
  ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','061 Eventos','e061'),
  ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002','MKTG','mktg');
