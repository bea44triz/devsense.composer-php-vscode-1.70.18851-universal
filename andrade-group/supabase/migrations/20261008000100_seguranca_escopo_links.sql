-- Segurança antes do staging:
--  1. Super Admin só por concessão explícita (fim do "primeiro usuário vira Super Admin")
--  2. Escopo por operação: coordenador/líder/responsável só vê eventos e pontos fixos vinculados a ele
--  3. Links públicos: tokens fortes, revogação, janela de validade, limite de tentativas,
--     mensagens genéricas e registro das tentativas

-- ===================== 1. SUPER ADMIN EXPLÍCITO =====================
-- Cadastro de usuário só cria o perfil. Super Admin é concedido manualmente por quem tem acesso
-- privilegiado ao banco (SQL Editor / service_role) — ver docs/STAGING.md.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (NEW.id, lower(NEW.email), NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
-- authenticated/anon nunca gravam em platform_admins (só SELECT do próprio registro); registra concessões
REVOKE INSERT, UPDATE, DELETE ON public.platform_admins FROM authenticated, anon;
CREATE TRIGGER audit_platform_admins AFTER INSERT OR UPDATE OR DELETE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.audit_row();

-- ===================== 2. ESCOPO POR OPERAÇÃO =====================
CREATE TYPE public.operation_role AS ENUM ('responsavel', 'coordenador', 'lider');

-- Vínculo explícito operação (evento ou ponto fixo) → usuário. O usuário precisa estar vinculado à empresa.
CREATE TABLE public.operation_members (
  operation_id uuid NOT NULL,
  company_id   uuid NOT NULL,
  user_id      uuid NOT NULL,
  role         public.operation_role NOT NULL DEFAULT 'coordenador',
  created_by   uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operation_id, user_id),
  FOREIGN KEY (operation_id, company_id) REFERENCES public.operations(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY (company_id, user_id) REFERENCES public.company_users(company_id, user_id) ON DELETE CASCADE
);
CREATE INDEX operation_members_user_idx ON public.operation_members(user_id, operation_id);
GRANT SELECT ON public.operation_members TO authenticated;
GRANT ALL ON public.operation_members TO service_role;
ALTER TABLE public.operation_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lock_company_om BEFORE UPDATE ON public.operation_members FOR EACH ROW EXECUTE FUNCTION public.lock_company_id();
CREATE TRIGGER audit_operation_members AFTER INSERT OR UPDATE OR DELETE ON public.operation_members FOR EACH ROW EXECUTE FUNCTION public.audit_row();

-- A operação está no escopo do usuário? (todas, se tiver operacao.todos; senão só as vinculadas)
CREATE OR REPLACE FUNCTION public.in_operation_scope(_op uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_company_permission(_company, 'operacao.todos')
      OR (_op IS NOT NULL AND public.has_company_access(_company) AND EXISTS (
            SELECT 1 FROM public.operation_members m
            WHERE m.operation_id = _op AND m.company_id = _company AND m.user_id = auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.can_see_operation(_op uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.has_company_permission(_company, 'operacao.ver') OR public.has_company_permission(_company, 'operacao.gerenciar'))
     AND public.in_operation_scope(_op, _company)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_operation(_op uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_company_permission(_company, 'operacao.gerenciar') AND public.in_operation_scope(_op, _company)
$$;

-- Atalhos para tabelas que só conhecem participante / competência
CREATE OR REPLACE FUNCTION public.can_see_participant(_participant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_participants ep
                 WHERE ep.id = _participant AND public.can_see_operation(ep.event_id, ep.company_id))
$$;
CREATE OR REPLACE FUNCTION public.can_see_period(_period uuid, _manage boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.fixed_post_periods p
                 WHERE p.id = _period AND CASE WHEN _manage THEN public.can_manage_operation(p.fixed_post_id, p.company_id)
                                               ELSE public.can_see_operation(p.fixed_post_id, p.company_id) END)
$$;

-- Pessoa visível: quem vê todas as operações, o financeiro gestor, ou quem tem a pessoa numa operação do seu escopo
CREATE OR REPLACE FUNCTION public.can_see_person(_person uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ((public.has_company_permission(_company, 'operacao.ver') OR public.has_company_permission(_company, 'operacao.gerenciar'))
          AND public.has_company_permission(_company, 'operacao.todos'))
      OR public.has_company_permission(_company, 'financeiro.gerenciar')
      OR EXISTS (SELECT 1 FROM public.event_participants ep
                 WHERE ep.person_id = _person AND ep.company_id = _company AND public.can_see_operation(ep.event_id, _company))
      OR EXISTS (SELECT 1 FROM public.fixed_post_members fm
                 WHERE fm.person_id = _person AND fm.company_id = _company AND public.can_see_operation(fm.fixed_post_id, _company))
$$;

REVOKE EXECUTE ON FUNCTION public.in_operation_scope, public.can_see_operation, public.can_manage_operation,
  public.can_see_participant, public.can_see_period, public.can_see_person FROM public, anon;
GRANT EXECUTE ON FUNCTION public.in_operation_scope, public.can_see_operation, public.can_manage_operation,
  public.can_see_participant, public.can_see_period, public.can_see_person TO authenticated, service_role;

-- operation_members: vê quem vê a operação; só quem gere TODAS as operações atribui pessoas (via RPC)
CREATE POLICY om_select ON public.operation_members FOR SELECT TO authenticated
  USING (public.can_see_operation(operation_id, company_id));

-- Políticas reescritas com escopo
DROP POLICY op_select ON public.operations;  DROP POLICY op_write ON public.operations;  DROP POLICY op_update ON public.operations;
CREATE POLICY op_select ON public.operations FOR SELECT TO authenticated USING (public.can_see_operation(id, company_id));
-- criação direta só para quem gere todas as operações (as telas usam event_create/fixed_post_create, que vinculam o criador)
CREATE POLICY op_insert ON public.operations FOR INSERT TO authenticated
  WITH CHECK (public.has_company_permission(company_id, 'operacao.gerenciar') AND public.has_company_permission(company_id, 'operacao.todos'));
CREATE POLICY op_update ON public.operations FOR UPDATE TO authenticated
  USING (public.can_manage_operation(id, company_id)) WITH CHECK (public.can_manage_operation(id, company_id));

DROP POLICY ev_select ON public.events;  DROP POLICY ev_insert ON public.events;  DROP POLICY ev_update ON public.events;
CREATE POLICY ev_select ON public.events FOR SELECT TO authenticated USING (public.can_see_operation(id, company_id));
CREATE POLICY ev_insert ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.has_company_permission(company_id, 'operacao.gerenciar') AND public.has_company_permission(company_id, 'operacao.todos'));
CREATE POLICY ev_update ON public.events FOR UPDATE TO authenticated
  USING (public.can_manage_operation(id, company_id)) WITH CHECK (public.can_manage_operation(id, company_id));

DROP POLICY et_select ON public.event_teams;  DROP POLICY et_write ON public.event_teams;
CREATE POLICY et_select ON public.event_teams FOR SELECT TO authenticated USING (public.can_see_operation(event_id, company_id));
CREATE POLICY et_write ON public.event_teams FOR ALL TO authenticated
  USING (public.can_manage_operation(event_id, company_id)) WITH CHECK (public.can_manage_operation(event_id, company_id));

DROP POLICY ep_select ON public.event_participants;  DROP POLICY ep_insert ON public.event_participants;  DROP POLICY ep_update ON public.event_participants;
CREATE POLICY ep_select ON public.event_participants FOR SELECT TO authenticated USING (public.can_see_operation(event_id, company_id));
CREATE POLICY ep_insert ON public.event_participants FOR INSERT TO authenticated WITH CHECK (public.can_manage_operation(event_id, company_id));
CREATE POLICY ep_update ON public.event_participants FOR UPDATE TO authenticated
  USING (public.can_manage_operation(event_id, company_id)) WITH CHECK (public.can_manage_operation(event_id, company_id));

DROP POLICY att_select ON public.attendance;
CREATE POLICY att_select ON public.attendance FOR SELECT TO authenticated USING (public.can_see_participant(participant_id));

DROP POLICY fp_select ON public.fixed_posts;  DROP POLICY fp_insert ON public.fixed_posts;  DROP POLICY fp_update ON public.fixed_posts;
CREATE POLICY fp_select ON public.fixed_posts FOR SELECT TO authenticated USING (public.can_see_operation(id, company_id));
CREATE POLICY fp_insert ON public.fixed_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_company_permission(company_id, 'operacao.gerenciar') AND public.has_company_permission(company_id, 'operacao.todos'));
CREATE POLICY fp_update ON public.fixed_posts FOR UPDATE TO authenticated
  USING (public.can_manage_operation(id, company_id)) WITH CHECK (public.can_manage_operation(id, company_id));

DROP POLICY fpm_select ON public.fixed_post_members;  DROP POLICY fpm_insert ON public.fixed_post_members;  DROP POLICY fpm_update ON public.fixed_post_members;
CREATE POLICY fpm_select ON public.fixed_post_members FOR SELECT TO authenticated USING (public.can_see_operation(fixed_post_id, company_id));
CREATE POLICY fpm_insert ON public.fixed_post_members FOR INSERT TO authenticated WITH CHECK (public.can_manage_operation(fixed_post_id, company_id));
CREATE POLICY fpm_update ON public.fixed_post_members FOR UPDATE TO authenticated
  USING (public.can_manage_operation(fixed_post_id, company_id)) WITH CHECK (public.can_manage_operation(fixed_post_id, company_id));

DROP POLICY fpp_select ON public.fixed_post_periods;  DROP POLICY fpp_insert ON public.fixed_post_periods;  DROP POLICY fpp_update ON public.fixed_post_periods;
CREATE POLICY fpp_select ON public.fixed_post_periods FOR SELECT TO authenticated USING (public.can_see_operation(fixed_post_id, company_id));
-- competência só muda de status pelas RPCs (abrir/validar/reabrir/enviar)

DROP POLICY fpi_select ON public.fixed_post_period_items;  DROP POLICY fpi_insert ON public.fixed_post_period_items;  DROP POLICY fpi_update ON public.fixed_post_period_items;
CREATE POLICY fpi_select ON public.fixed_post_period_items FOR SELECT TO authenticated USING (public.can_see_period(period_id));
CREATE POLICY fpi_update ON public.fixed_post_period_items FOR UPDATE TO authenticated
  USING (public.can_see_period(period_id, true) AND EXISTS (SELECT 1 FROM public.fixed_post_periods p WHERE p.id = period_id AND p.status = 'aberta'))
  WITH CHECK (public.can_see_period(period_id, true));

DROP POLICY pay_select ON public.payables;
-- financeiro gestor vê todos os lançamentos da empresa; quem só "vê financeiro" vê os das operações do seu escopo
CREATE POLICY pay_select ON public.payables FOR SELECT TO authenticated USING (
  public.has_company_permission(company_id, 'financeiro.gerenciar')
  OR (public.has_company_permission(company_id, 'financeiro.ver') AND public.in_operation_scope(operation_id, company_id)));

DROP POLICY people_select ON public.people;  DROP POLICY people_update ON public.people;
CREATE POLICY people_select ON public.people FOR SELECT TO authenticated USING (public.can_see_person(id, company_id));
CREATE POLICY people_update ON public.people FOR UPDATE TO authenticated
  USING (public.has_company_permission(company_id, 'operacao.gerenciar') AND public.can_see_person(id, company_id))
  WITH CHECK (public.has_company_permission(company_id, 'operacao.gerenciar'));

-- Fotos de presença: pasta <empresa>/<evento>/arquivo.jpg → só quem vê aquele evento
DROP POLICY presence_photos_read ON storage.objects;
CREATE POLICY presence_photos_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'presence-photos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  AND public.can_see_operation(((storage.foldername(name))[2])::uuid, ((storage.foldername(name))[1])::uuid));

-- RPCs de responsáveis -------------------------------------------------------
-- Usuários da empresa que podem ser atribuídos (somente para quem gere todas as operações)
CREATE OR REPLACE FUNCTION public.company_assignable_users(_company_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, coalesce(p.full_name, p.email), p.email
  FROM public.company_users cu JOIN public.profiles p ON p.id = cu.user_id
  WHERE cu.company_id = _company_id AND cu.active
    AND public.has_company_permission(_company_id, 'operacao.gerenciar')
    AND public.has_company_permission(_company_id, 'operacao.todos')
  ORDER BY 2
$$;

CREATE OR REPLACE FUNCTION public.operation_members_list(_op uuid)
RETURNS TABLE (user_id uuid, full_name text, email text, role public.operation_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id, coalesce(p.full_name, p.email), p.email, m.role
  FROM public.operation_members m JOIN public.profiles p ON p.id = m.user_id
  WHERE m.operation_id = _op AND public.can_see_operation(m.operation_id, m.company_id)
  ORDER BY m.role, 2
$$;

CREATE OR REPLACE FUNCTION public.operation_member_set(_op uuid, _user uuid, _role public.operation_role, _remove boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.operations WHERE id = _op;
  IF v_company IS NULL OR NOT (public.has_company_permission(v_company, 'operacao.gerenciar')
                               AND public.has_company_permission(v_company, 'operacao.todos')) THEN
    RAISE EXCEPTION 'Sem permissão para definir responsáveis.' USING ERRCODE = '42501'; END IF;
  IF _remove THEN
    DELETE FROM public.operation_members WHERE operation_id = _op AND user_id = _user;
  ELSE
    INSERT INTO public.operation_members(operation_id, company_id, user_id, role) VALUES (_op, v_company, _user, _role)
    ON CONFLICT (operation_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.company_assignable_users, public.operation_members_list, public.operation_member_set FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_assignable_users, public.operation_members_list, public.operation_member_set TO authenticated;

-- ===================== 3. LINKS PÚBLICOS =====================
-- 3.1 Tokens fortes: 64 caracteres hex (≈244 bits aleatórios), no lugar dos 16 do Lovable
CREATE OR REPLACE FUNCTION public.new_link_token()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;
ALTER TABLE public.event_teams ALTER COLUMN invite_token SET DEFAULT public.new_link_token();
ALTER TABLE public.events ALTER COLUMN checkin_token SET DEFAULT public.new_link_token();
ALTER TABLE public.events ALTER COLUMN checkout_token SET DEFAULT public.new_link_token();
UPDATE public.event_teams SET invite_token = public.new_link_token();
UPDATE public.events SET checkin_token = public.new_link_token(), checkout_token = public.new_link_token();

-- 3.2 Revogação: gera link novo (o antigo deixa de funcionar na hora)
CREATE OR REPLACE FUNCTION public.rotate_link(_kind text, _id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_event uuid; v_tok text := public.new_link_token();
BEGIN
  IF _kind = 'inscricao' THEN
    SELECT company_id, event_id INTO v_company, v_event FROM public.event_teams WHERE id = _id;
  ELSE
    SELECT company_id, id INTO v_company, v_event FROM public.events WHERE id = _id;
  END IF;
  IF v_company IS NULL OR NOT public.can_manage_operation(v_event, v_company) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF _kind = 'inscricao' THEN UPDATE public.event_teams SET invite_token = v_tok WHERE id = _id;
  ELSIF _kind = 'checkin' THEN UPDATE public.events SET checkin_token = v_tok WHERE id = _id;
  ELSIF _kind = 'checkout' THEN UPDATE public.events SET checkout_token = v_tok WHERE id = _id;
  ELSE RAISE EXCEPTION 'Tipo de link inválido.' USING ERRCODE = 'P0001'; END IF;
  RETURN v_tok;
END $$;
REVOKE EXECUTE ON FUNCTION public.rotate_link FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rotate_link TO authenticated;

-- 3.3 Tentativas nos links públicos: limite + auditoria (sem guardar CPF ou token em claro)
CREATE TABLE public.public_link_attempts (
  id         bigserial PRIMARY KEY,
  kind       text NOT NULL,          -- inscricao_consulta | inscricao | presenca_consulta | presenca
  company_id uuid,
  token_hash text NOT NULL,
  cpf_hash   text,
  ip         text NOT NULL,
  outcome    text NOT NULL,          -- ok | nao_encontrado | bloqueado | erro
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pla_ip_idx ON public.public_link_attempts(ip, created_at);
CREATE INDEX pla_cpf_idx ON public.public_link_attempts(cpf_hash, created_at);
GRANT SELECT ON public.public_link_attempts TO authenticated;
GRANT ALL ON public.public_link_attempts TO service_role;
ALTER TABLE public.public_link_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY pla_select ON public.public_link_attempts FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR (company_id IS NOT NULL AND public.has_company_permission(company_id, 'auditoria.ver')));

CREATE OR REPLACE FUNCTION public.hash_text(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(sha256(convert_to(coalesce(_t, ''), 'UTF8')), 'hex')
$$;

-- IP do visitante: vem dos cabeçalhos repassados pela API; só o service_role (servidor) pode informá-lo
CREATE OR REPLACE FUNCTION public.request_ip(_override text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE h json; claims json;
BEGIN
  BEGIN claims := nullif(current_setting('request.jwt.claims', true), '')::json; EXCEPTION WHEN OTHERS THEN claims := NULL; END;
  IF _override IS NOT NULL AND claims->>'role' = 'service_role' THEN RETURN left(_override, 64); END IF;
  BEGIN h := nullif(current_setting('request.headers', true), '')::json; EXCEPTION WHEN OTHERS THEN h := NULL; END;
  RETURN left(coalesce(nullif(btrim(split_part(h->>'x-forwarded-for', ',', 1)), ''), h->>'cf-connecting-ip', h->>'x-real-ip', 'desconhecido'), 64);
END $$;

-- Limites (janela de 10 min). Num evento muitos profissionais saem pelo MESMO IP (Wi-Fi do local, CGNAT da
-- operadora), então o teto geral por IP é alto; a proteção contra varredura de CPFs é a contagem de
-- "não encontrado" por IP e o limite por CPF.
--   300 tentativas por IP · 15 CPFs não encontrados por IP · 12 tentativas por CPF
CREATE OR REPLACE FUNCTION public.link_rate_limited(_ip text, _cpf_hash text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.public_link_attempts WHERE ip = _ip AND created_at > now() - interval '10 minutes') >= 300
      OR (SELECT count(*) FROM public.public_link_attempts WHERE ip = _ip AND outcome = 'nao_encontrado' AND created_at > now() - interval '10 minutes') >= 15
      OR (_cpf_hash IS NOT NULL AND (SELECT count(*) FROM public.public_link_attempts WHERE cpf_hash = _cpf_hash AND created_at > now() - interval '10 minutes') >= 12)
$$;

CREATE OR REPLACE FUNCTION public.link_log(_kind text, _company uuid, _token text, _cpf text, _ip text, _outcome text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.public_link_attempts(kind, company_id, token_hash, cpf_hash, ip, outcome)
  VALUES (_kind, _company, public.hash_text(_token), CASE WHEN _cpf IS NULL THEN NULL ELSE public.hash_text(public.only_digits(_cpf)) END, _ip, _outcome)
$$;

-- Usado pelo servidor (/api/presenca) antes de gravar: registra e diz se está liberado
CREATE OR REPLACE FUNCTION public.public_link_check(_kind text, _token text, _cpf text, _ip text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ip text := public.request_ip(_ip); v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.events WHERE checkin_token = _token OR checkout_token = _token;
  IF public.link_rate_limited(v_ip, public.hash_text(public.only_digits(_cpf))) THEN
    PERFORM public.link_log(_kind, v_company, _token, _cpf, v_ip, 'bloqueado'); RETURN false;
  END IF;
  PERFORM public.link_log(_kind, v_company, _token, _cpf, v_ip, 'tentativa');
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.public_link_check, public.link_log, public.link_rate_limited, public.request_ip FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_link_check TO service_role;
GRANT EXECUTE ON FUNCTION public.hash_text TO authenticated, service_role;

-- 3.4 Consultas públicas com limite e respostas genéricas
-- Inscrição: só diz se há cadastro nesta empresa (sem nome, telefone ou e-mail) e a situação no evento
DROP FUNCTION public.public_invite_lookup(text, text);
CREATE FUNCTION public.public_invite_lookup(_token text, _cpf text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; p record; v_status text; v_ip text := public.request_ip(); v_cpf text := public.only_digits(_cpf);
BEGIN
  SELECT * INTO t FROM public.event_teams WHERE invite_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF public.link_rate_limited(v_ip, public.hash_text(v_cpf)) THEN
    PERFORM public.link_log('inscricao_consulta', t.company_id, _token, v_cpf, v_ip, 'bloqueado');
    RETURN jsonb_build_object('blocked', true);
  END IF;
  SELECT id, pix_key IS NOT NULL AS has_pix INTO p FROM public.people WHERE company_id = t.company_id AND cpf = v_cpf;
  PERFORM public.link_log('inscricao_consulta', t.company_id, _token, v_cpf, v_ip, CASE WHEN p.id IS NULL THEN 'nao_encontrado' ELSE 'ok' END);
  IF p.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT status INTO v_status FROM public.event_participants WHERE event_id = t.event_id AND person_id = p.id;
  RETURN jsonb_build_object('found', true, 'has_pix', p.has_pix, 'participation_status', v_status);
END $$;

-- Presença: só confirma participação CONFIRMADA; nome mascarado ("Ana T."); mesma resposta para "não existe" e "não confirmado"
DROP FUNCTION public.public_presence_lookup(text, text);
CREATE FUNCTION public.public_presence_lookup(_token text, _cpf text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; r record; v_ip text := public.request_ip(); v_cpf text := public.only_digits(_cpf); v_name text;
BEGIN
  SELECT * INTO e FROM public.events WHERE checkin_token = _token OR checkout_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF public.link_rate_limited(v_ip, public.hash_text(v_cpf)) THEN
    PERFORM public.link_log('presenca_consulta', e.company_id, _token, v_cpf, v_ip, 'bloqueado');
    RETURN jsonb_build_object('blocked', true);
  END IF;
  SELECT ep.id, p.full_name, t.name AS team_name INTO r
  FROM public.event_participants ep JOIN public.people p ON p.id = ep.person_id JOIN public.event_teams t ON t.id = ep.team_id
  WHERE ep.event_id = e.id AND p.cpf = v_cpf AND ep.status = 'confirmado';
  PERFORM public.link_log('presenca_consulta', e.company_id, _token, v_cpf, v_ip, CASE WHEN r.id IS NULL THEN 'nao_encontrado' ELSE 'ok' END);
  IF r.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  v_name := split_part(r.full_name, ' ', 1) || CASE WHEN position(' ' IN r.full_name) > 0
            THEN ' ' || left(split_part(r.full_name, ' ', array_length(string_to_array(r.full_name, ' '), 1)), 1) || '.' ELSE '' END;
  RETURN jsonb_build_object('found', true, 'name', v_name, 'team', r.team_name, 'status', 'confirmado');
END $$;

REVOKE EXECUTE ON FUNCTION public.public_invite_lookup, public.public_presence_lookup FROM public;
GRANT EXECUTE ON FUNCTION public.public_invite_lookup, public.public_presence_lookup TO anon, authenticated;
