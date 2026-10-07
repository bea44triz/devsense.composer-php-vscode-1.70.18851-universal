-- Cadastros reais, PIX protegido, eventos de vários dias e fluxo completo de Pontos Fixos.
--  1. clientes_evento (cliente contratante da operação ≠ grupo cliente do ERP) e centros_custo, por empresa
--  2. fornecedores (≠ pessoas/freelancers)
--  3. PIX nunca exposto por SELECT: colunas mascaradas + RPC que só mostra a chave para quem tem permissão financeira
--  4. Eventos de vários dias: presença por inscrição + dia + tipo; diárias validadas = dias com check-in
--  5. Fotos em <empresa>/<evento>/…
--  6. Pontos Fixos: criar, alocar, competência (faltas/descontos/adicionais/status), validar, enviar ao financeiro
-- Convenção: a coluna da empresa se chama company_id em todas as tabelas (equivale a empresa_id).

CREATE OR REPLACE FUNCTION public.local_today()
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date
$$;
GRANT EXECUTE ON FUNCTION public.local_today TO anon, authenticated, service_role;

-- Quem cuida de cadastros: gestor da operação com visão total, ou financeiro gestor (empresa.admin cobre os dois)
CREATE OR REPLACE FUNCTION public.can_manage_registry(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.has_company_permission(_company, 'operacao.gerenciar') AND public.has_company_permission(_company, 'operacao.todos'))
      OR public.has_company_permission(_company, 'financeiro.gerenciar')
$$;
CREATE OR REPLACE FUNCTION public.can_read_registry(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_company_permission(_company, 'operacao.ver') OR public.has_company_permission(_company, 'operacao.gerenciar')
      OR public.has_company_permission(_company, 'financeiro.ver') OR public.has_company_permission(_company, 'financeiro.gerenciar')
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_registry, public.can_read_registry FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_registry, public.can_read_registry TO authenticated, service_role;

-- Documento (CPF/CNPJ) válido quando informado; grava só dígitos
CREATE OR REPLACE FUNCTION public.normalize_document()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.documento := nullif(public.only_digits(NEW.documento), '');
  IF NEW.documento IS NOT NULL AND NOT (public.is_valid_cpf(NEW.documento) OR public.is_valid_cnpj(NEW.documento)) THEN
    RAISE EXCEPTION 'CPF/CNPJ inválido.' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END $$;

-- ===================== 1. CLIENTES E CENTROS DE CUSTO =====================
CREATE TABLE public.clientes_evento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  tipo_pessoa   text NOT NULL DEFAULT 'PJ' CHECK (tipo_pessoa IN ('PF', 'PJ')),
  razao_social  text NOT NULL CHECK (btrim(razao_social) <> ''),
  nome_fantasia text,
  documento     text,
  telefone      text,
  email         text,
  status        text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id)
);
CREATE UNIQUE INDEX clientes_evento_doc_uq ON public.clientes_evento(company_id, documento) WHERE documento IS NOT NULL;

CREATE TABLE public.centros_custo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  codigo      text NOT NULL CHECK (btrim(codigo) <> ''),
  nome        text NOT NULL CHECK (btrim(nome) <> ''),
  origem      text NOT NULL DEFAULT 'interno' CHECK (origem IN ('interno', 'conta_azul', 'importacao')),
  id_externo  text,
  status      text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_by  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, codigo)
);
CREATE UNIQUE INDEX centros_custo_externo_uq ON public.centros_custo(company_id, origem, id_externo) WHERE id_externo IS NOT NULL;

-- ===================== 2. FORNECEDORES =====================
CREATE TABLE public.fornecedores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  razao_social  text NOT NULL CHECK (btrim(razao_social) <> ''),
  nome_fantasia text,
  documento     text,
  telefone      text,
  email         text,
  pix_type      text CHECK (pix_type IN ('cpf', 'cnpj', 'celular', 'email', 'aleatoria')),
  pix_key       text,
  servico       text,
  status        text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  has_pix        boolean GENERATED ALWAYS AS (coalesce(pix_key, '') <> '') STORED,
  pix_key_masked text GENERATED ALWAYS AS (
    CASE WHEN coalesce(pix_key, '') = '' THEN NULL
         WHEN pix_type = 'email' THEN left(pix_key, 2) || '•••@' || split_part(pix_key, '@', 2)
         ELSE '•••' || right(pix_key, 4) END) STORED,
  UNIQUE (id, company_id),
  CHECK ((pix_type IS NULL) = (pix_key IS NULL))
);
CREATE UNIQUE INDEX fornecedores_doc_uq ON public.fornecedores(company_id, documento) WHERE documento IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fornecedores_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.pix_key IS NOT NULL THEN
    IF NOT public.is_valid_pix(NEW.pix_type, NEW.pix_key) THEN RAISE EXCEPTION 'Chave PIX inválida para o tipo selecionado.' USING ERRCODE = 'P0001'; END IF;
    NEW.pix_key := public.normalize_pix(NEW.pix_type, NEW.pix_key);
  END IF;
  IF NEW.email IS NOT NULL AND NOT public.is_valid_email(NEW.email) THEN RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = 'P0001'; END IF;
  NEW.telefone := nullif(public.only_digits(NEW.telefone), '');
  RETURN NEW;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['clientes_evento', 'centros_custo', 'fornecedores'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%1$s TO authenticated; GRANT ALL ON public.%1$s TO service_role', t);
    EXECUTE format('ALTER TABLE public.%1$s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %1$s_select ON public.%1$s FOR SELECT TO authenticated USING (public.can_read_registry(company_id))', t);
    EXECUTE format('CREATE POLICY %1$s_insert ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.can_manage_registry(company_id))', t);
    EXECUTE format('CREATE POLICY %1$s_update ON public.%1$s FOR UPDATE TO authenticated USING (public.can_manage_registry(company_id)) WITH CHECK (public.can_manage_registry(company_id))', t);
    EXECUTE format('CREATE TRIGGER trg_lock_company_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.lock_company_id()', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.audit_row()', t);
  END LOOP;
END $$;
CREATE TRIGGER trg_doc_clientes BEFORE INSERT OR UPDATE ON public.clientes_evento FOR EACH ROW EXECUTE FUNCTION public.normalize_document();
CREATE TRIGGER trg_doc_fornecedores BEFORE INSERT OR UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.normalize_document();
CREATE TRIGGER trg_fornecedores_validate BEFORE INSERT OR UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.fornecedores_validate();
-- a chave PIX do fornecedor não sai por SELECT (ver fornecedor_pix)
REVOKE SELECT ON public.fornecedores FROM authenticated;
GRANT SELECT (id, company_id, razao_social, nome_fantasia, documento, telefone, email, pix_type, servico, status, created_at, has_pix, pix_key_masked)
  ON public.fornecedores TO authenticated;

-- ===================== 3. PIX DAS PESSOAS =====================
ALTER TABLE public.people
  ADD COLUMN has_pix boolean GENERATED ALWAYS AS (coalesce(pix_key, '') <> '') STORED,
  ADD COLUMN pix_key_masked text GENERATED ALWAYS AS (
    CASE WHEN coalesce(pix_key, '') = '' THEN NULL
         WHEN pix_type = 'email' THEN left(pix_key, 2) || '•••@' || split_part(pix_key, '@', 2)
         ELSE '•••' || right(pix_key, 4) END) STORED;
REVOKE SELECT ON public.people FROM authenticated;
GRANT SELECT (id, company_id, full_name, cpf, phone, email, pix_type, main_role, status, pix_updated_publicly_at, created_at, has_pix, pix_key_masked)
  ON public.people TO authenticated;

-- Chave completa só para quem tem permissão financeira (financeiro.ver/gerenciar ou empresa.admin); os demais recebem mascarada
CREATE OR REPLACE FUNCTION public.person_pix(_person uuid)
RETURNS TABLE (pix_type text, pix_key text, full_access boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.pix_type,
         CASE WHEN public.has_company_permission(p.company_id, 'financeiro.ver') OR public.has_company_permission(p.company_id, 'financeiro.gerenciar')
              THEN p.pix_key ELSE p.pix_key_masked END,
         public.has_company_permission(p.company_id, 'financeiro.ver') OR public.has_company_permission(p.company_id, 'financeiro.gerenciar')
  FROM public.people p WHERE p.id = _person AND public.can_see_person(p.id, p.company_id)
$$;
CREATE OR REPLACE FUNCTION public.fornecedor_pix(_fornecedor uuid)
RETURNS TABLE (pix_type text, pix_key text, full_access boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.pix_type,
         CASE WHEN public.has_company_permission(f.company_id, 'financeiro.ver') OR public.has_company_permission(f.company_id, 'financeiro.gerenciar')
              THEN f.pix_key ELSE f.pix_key_masked END,
         public.has_company_permission(f.company_id, 'financeiro.ver') OR public.has_company_permission(f.company_id, 'financeiro.gerenciar')
  FROM public.fornecedores f WHERE f.id = _fornecedor AND public.can_read_registry(f.company_id)
$$;
REVOKE EXECUTE ON FUNCTION public.person_pix, public.fornecedor_pix FROM public, anon;
GRANT EXECUTE ON FUNCTION public.person_pix, public.fornecedor_pix TO authenticated;

-- Cadastro de pessoa pela equipe interna (alocação em ponto fixo), com as mesmas validações do link público
CREATE OR REPLACE FUNCTION public.person_upsert(_company_id uuid, _data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cpf text := public.only_digits(_data->>'cpf'); v_id uuid;
        v_name text := regexp_replace(btrim(coalesce(_data->>'full_name', '')), '\s+', ' ', 'g');
        v_phone text := nullif(public.only_digits(_data->>'phone'), ''); v_email text := nullif(lower(btrim(coalesce(_data->>'email', ''))), '');
        v_pt text := nullif(_data->>'pix_type', ''); v_pk text := nullif(btrim(coalesce(_data->>'pix_key', '')), '');
BEGIN
  IF NOT public.has_company_permission(_company_id, 'operacao.gerenciar') THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_valid_cpf(v_cpf) THEN RAISE EXCEPTION 'CPF inválido.' USING ERRCODE = 'P0001'; END IF;
  IF v_phone IS NOT NULL AND NOT public.is_valid_celular(v_phone) THEN RAISE EXCEPTION 'Celular inválido.' USING ERRCODE = 'P0001'; END IF;
  IF v_email IS NOT NULL AND NOT public.is_valid_email(v_email) THEN RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = 'P0001'; END IF;
  IF (v_pt IS NULL) <> (v_pk IS NULL) THEN RAISE EXCEPTION 'Informe o tipo e a chave PIX.' USING ERRCODE = 'P0001'; END IF;
  IF v_pk IS NOT NULL THEN
    IF NOT public.is_valid_pix(v_pt, v_pk) THEN RAISE EXCEPTION 'Chave PIX inválida para o tipo selecionado.' USING ERRCODE = 'P0001'; END IF;
    v_pk := public.normalize_pix(v_pt, v_pk);
  END IF;
  SELECT id INTO v_id FROM public.people WHERE company_id = _company_id AND cpf = v_cpf;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;  -- não duplica: CPF já cadastrado nesta empresa
  IF position(' ' IN v_name) = 0 THEN RAISE EXCEPTION 'Informe nome e sobrenome.' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.people(company_id, full_name, cpf, phone, email, pix_type, pix_key, main_role)
  VALUES (_company_id, v_name, v_cpf, v_phone, v_email, v_pt, v_pk, nullif(btrim(_data->>'main_role'), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.person_upsert FROM public, anon;
GRANT EXECUTE ON FUNCTION public.person_upsert TO authenticated;

-- ===================== 4. EVENTOS: CADASTROS + VÁRIOS DIAS =====================
ALTER TABLE public.events
  ADD COLUMN end_date date,
  ADD COLUMN cliente_evento_id uuid,
  ADD COLUMN centro_custo_id uuid,
  ADD CONSTRAINT events_end_date_ck CHECK (end_date IS NULL OR end_date >= event_date),
  ADD CONSTRAINT events_cliente_fk FOREIGN KEY (cliente_evento_id, company_id) REFERENCES public.clientes_evento(id, company_id),
  ADD CONSTRAINT events_centro_custo_fk FOREIGN KEY (centro_custo_id, company_id) REFERENCES public.centros_custo(id, company_id);
COMMENT ON COLUMN public.events.client_name IS 'Legado (texto). Usar cliente_evento_id.';
COMMENT ON COLUMN public.events.cost_center IS 'Cópia do centro de custo (código — nome) para exibição; a referência é centro_custo_id.';

ALTER TABLE public.payables
  ADD COLUMN centro_custo_id uuid,
  ADD CONSTRAINT payables_centro_custo_fk FOREIGN KEY (centro_custo_id, company_id) REFERENCES public.centros_custo(id, company_id);

-- Presença: inscrição + dia + tipo (um check-in e um check-out por dia, sem nova inscrição)
ALTER TABLE public.attendance ADD COLUMN work_date date;
UPDATE public.attendance SET work_date = (recorded_at AT TIME ZONE 'America/Sao_Paulo')::date;
ALTER TABLE public.attendance ALTER COLUMN work_date SET NOT NULL;
ALTER TABLE public.attendance DROP CONSTRAINT attendance_participant_id_kind_key;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_participant_day_kind_key UNIQUE (participant_id, work_date, kind);

CREATE OR REPLACE FUNCTION public.cc_label(_cc uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT codigo || ' — ' || nome FROM public.centros_custo WHERE id = _cc
$$;

DROP FUNCTION public.event_create(uuid, jsonb, jsonb);
CREATE FUNCTION public.event_create(_company_id uuid, _event jsonb, _teams jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := gen_random_uuid(); v_code text; v_name text; tm jsonb; v_keys text[] := '{}'; v_key text;
        v_cli uuid := nullif(_event->>'cliente_evento_id', '')::uuid; v_cc uuid := nullif(_event->>'centro_custo_id', '')::uuid;
        v_start date; v_end date;
BEGIN
  IF _company_id IS NULL OR NOT public.has_company_permission(_company_id, 'operacao.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para criar eventos nesta empresa.' USING ERRCODE = '42501'; END IF;
  v_code := btrim(coalesce(_event->>'code', ''));
  v_name := regexp_replace(btrim(coalesce(_event->>'name', '')), '\s+', ' ', 'g');
  IF v_code = '' OR v_name = '' OR coalesce(_event->>'event_date', '') = '' THEN
    RAISE EXCEPTION 'Informe código, nome e data do evento.' USING ERRCODE = 'P0001'; END IF;
  v_start := (_event->>'event_date')::date;
  v_end := coalesce(nullif(_event->>'end_date', '')::date, v_start);
  IF v_end < v_start THEN RAISE EXCEPTION 'A data final não pode ser anterior à data inicial.' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE company_id = _company_id AND code = v_code) THEN
    RAISE EXCEPTION 'Já existe um evento com o código %.', v_code USING ERRCODE = 'P0001'; END IF;
  IF v_cli IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clientes_evento WHERE id = v_cli AND company_id = _company_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'Cliente inválido para esta empresa.' USING ERRCODE = 'P0001'; END IF;
  IF v_cc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.centros_custo WHERE id = v_cc AND company_id = _company_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'Centro de custo inválido para esta empresa.' USING ERRCODE = 'P0001'; END IF;
  IF jsonb_typeof(_teams) <> 'array' OR jsonb_array_length(_teams) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos uma equipe/função.' USING ERRCODE = 'P0001'; END IF;
  FOR tm IN SELECT * FROM jsonb_array_elements(_teams) LOOP
    v_key := public.team_name_key(tm->>'name');
    IF v_key = '' THEN RAISE EXCEPTION 'Informe o nome de todas as equipes.' USING ERRCODE = 'P0001'; END IF;
    IF v_key = ANY (v_keys) THEN RAISE EXCEPTION 'Equipe duplicada: %.', btrim(tm->>'name') USING ERRCODE = 'P0001'; END IF;
    IF coalesce((tm->>'quantity')::int, 0) <= 0 THEN RAISE EXCEPTION 'Informe a quantidade de %.', btrim(tm->>'name') USING ERRCODE = 'P0001'; END IF;
    IF coalesce((tm->>'rate')::numeric, 0) < 0 THEN RAISE EXCEPTION 'Valor inválido em %.', btrim(tm->>'name') USING ERRCODE = 'P0001'; END IF;
    v_keys := v_keys || v_key;
  END LOOP;

  INSERT INTO public.operations(id, company_id, type, name) VALUES (v_id, _company_id, 'EVENTO', v_name);
  INSERT INTO public.events(id, company_id, code, name, cliente_evento_id, centro_custo_id, client_name, cost_center,
    event_date, end_date, start_time, end_time, location, address, latitude, longitude, radius_m, manager_name, notes, show_rate)
  VALUES (v_id, _company_id, v_code, v_name, v_cli, v_cc,
    (SELECT coalesce(nome_fantasia, razao_social) FROM public.clientes_evento WHERE id = v_cli), public.cc_label(v_cc),
    v_start, v_end, nullif(_event->>'start_time', '')::time, nullif(_event->>'end_time', '')::time,
    nullif(btrim(_event->>'location'), ''), nullif(btrim(_event->>'address'), ''),
    nullif(_event->>'latitude', '')::double precision, nullif(_event->>'longitude', '')::double precision,
    coalesce(nullif(_event->>'radius_m', '')::int, 300), nullif(btrim(_event->>'manager_name'), ''),
    nullif(btrim(_event->>'notes'), ''), coalesce((_event->>'show_rate')::boolean, true));
  INSERT INTO public.event_teams(company_id, event_id, name, quantity, rate, coordinator_name, start_time, end_time)
  SELECT _company_id, v_id, regexp_replace(btrim(x.t->>'name'), '\s+', ' ', 'g'), (x.t->>'quantity')::int,
         coalesce((x.t->>'rate')::numeric, 0), nullif(btrim(x.t->>'coordinator_name'), ''),
         nullif(x.t->>'start_time', '')::time, nullif(x.t->>'end_time', '')::time
  FROM jsonb_array_elements(_teams) AS x(t);
  -- quem cria fica responsável (senão um coordenador restrito não enxergaria o próprio evento)
  INSERT INTO public.operation_members(operation_id, company_id, user_id, role) VALUES (v_id, _company_id, auth.uid(), 'responsavel')
  ON CONFLICT DO NOTHING;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.event_create FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_create TO authenticated;

-- Atualiza cliente / centro de custo / data final de um evento (respeita escopo)
CREATE OR REPLACE FUNCTION public.event_update_refs(_event_id uuid, _cliente uuid, _cc uuid, _end_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT public.can_manage_operation(e.id, e.company_id) THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF e.status IN ('fechado', 'cancelado') THEN RAISE EXCEPTION 'Evento fechado.' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.events SET cliente_evento_id = _cliente, centro_custo_id = _cc,
    client_name = (SELECT coalesce(nome_fantasia, razao_social) FROM public.clientes_evento WHERE id = _cliente AND company_id = e.company_id),
    cost_center = public.cc_label(_cc), end_date = coalesce(_end_date, e.event_date)
  WHERE id = _event_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.event_update_refs FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_update_refs TO authenticated;

-- Encerrar: "trabalhou" e diárias vêm da presença (dias distintos com check-in)
CREATE OR REPLACE FUNCTION public.event_finish(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_operation(e.id, e.company_id) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF e.status NOT IN ('planejamento', 'inscricoes_abertas', 'em_andamento') THEN
    RAISE EXCEPTION 'Evento já encerrado.' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.event_participants ep SET worked = true,
    days = (SELECT count(DISTINCT a.work_date) FROM public.attendance a WHERE a.participant_id = ep.id AND a.kind = 'checkin')
  WHERE ep.event_id = _event_id AND ep.status = 'confirmado' AND ep.worked IS NULL
    AND EXISTS (SELECT 1 FROM public.attendance a WHERE a.participant_id = ep.id AND a.kind = 'checkin');
  UPDATE public.events SET status = 'aguardando_fechamento' WHERE id = _event_id;
END $$;

CREATE OR REPLACE FUNCTION public.event_send_to_finance(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; n int;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_operation(e.id, e.company_id) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF e.status = 'fechado' THEN RAISE EXCEPTION 'Evento já enviado ao financeiro.' USING ERRCODE = 'P0001'; END IF;
  IF e.status <> 'aguardando_fechamento' THEN RAISE EXCEPTION 'Encerre o evento antes de enviar ao financeiro.' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = _event_id AND status = 'confirmado' AND worked IS NULL) THEN
    RAISE EXCEPTION 'Valide todos os profissionais confirmados (trabalhou ou não) antes de enviar.' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.payables(company_id, operation_id, description, amount, due_date, status, origin, person_id, event_participant_id,
    payee_name, payee_document, pix_type, pix_key, op_code, op_name, ref_date, cost_center, centro_custo_id)
  SELECT ep.company_id, e.id, 'Evento ' || e.code || ' — ' || t.name || ' — ' || p.full_name, ep.final_amount, NULL,
    (CASE WHEN p.pix_key IS NULL OR p.pix_updated_publicly_at IS NOT NULL THEN 'pendente_validacao' ELSE 'a_pagar' END)::public.payable_status,
    'EVENTO', p.id, ep.id, p.full_name, p.cpf, p.pix_type, p.pix_key, e.code, e.name, e.event_date,
    coalesce(public.cc_label(e.centro_custo_id), e.cost_center), e.centro_custo_id
  FROM public.event_participants ep JOIN public.people p ON p.id = ep.person_id JOIN public.event_teams t ON t.id = ep.team_id
  WHERE ep.event_id = _event_id AND ep.status = 'confirmado' AND ep.worked AND ep.final_amount > 0
  ON CONFLICT (event_participant_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.events SET status = 'fechado', closed_at = now(), closed_by = auth.uid() WHERE id = _event_id;
  RETURN n;
END $$;

-- ===================== 5. LINKS PÚBLICOS (vários dias + validade) =====================
-- Inscrição aberta até o último dia do evento
CREATE OR REPLACE FUNCTION public.public_invite_info(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'team_name', t.name, 'event_name', e.name, 'event_code', e.code, 'company_name', c.name, 'company_color', c.color,
    'event_date', e.event_date, 'end_date', coalesce(e.end_date, e.event_date),
    'start_time', coalesce(t.start_time, e.start_time), 'end_time', coalesce(t.end_time, e.end_time),
    'location', e.location, 'address', e.address,
    'rate', CASE WHEN e.show_rate THEN t.rate END,
    'open', t.registrations_open AND e.status IN ('planejamento', 'inscricoes_abertas', 'em_andamento')
            AND coalesce(e.end_date, e.event_date) >= public.local_today(),
    'vacancies', greatest(t.quantity - (SELECT count(*) FROM public.event_participants p WHERE p.team_id = t.id AND p.status = 'confirmado'), 0))
  FROM public.event_teams t JOIN public.events e ON e.id = t.event_id JOIN public.companies c ON c.id = t.company_id
  WHERE t.invite_token = _token
$$;

CREATE OR REPLACE FUNCTION public.public_invite_register(_token text, _data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; e record; v_cpf text; v_person uuid; v_status text; v_conf int; v_existing record;
        v_name text; v_phone text; v_email text; v_pix_type text; v_pix_key text; v_old_pix text; v_ip text := public.request_ip();
BEGIN
  SELECT * INTO t FROM public.event_teams WHERE invite_token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO e FROM public.events WHERE id = t.event_id;
  IF NOT t.registrations_open OR e.status NOT IN ('planejamento', 'inscricoes_abertas', 'em_andamento')
     OR coalesce(e.end_date, e.event_date) < public.local_today() THEN
    RAISE EXCEPTION 'Inscrições encerradas para esta equipe.' USING ERRCODE = 'P0001'; END IF;

  v_cpf      := public.only_digits(_data->>'cpf');
  IF public.link_rate_limited(v_ip, public.hash_text(v_cpf)) THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' USING ERRCODE = 'P0001'; END IF;
  v_name     := regexp_replace(btrim(coalesce(_data->>'full_name', '')), '\s+', ' ', 'g');
  v_phone    := nullif(public.only_digits(_data->>'phone'), '');
  v_email    := nullif(lower(btrim(coalesce(_data->>'email', ''))), '');
  v_pix_type := nullif(_data->>'pix_type', '');
  v_pix_key  := nullif(btrim(coalesce(_data->>'pix_key', '')), '');

  IF NOT public.is_valid_cpf(v_cpf) THEN RAISE EXCEPTION 'CPF inválido.' USING ERRCODE = 'P0001'; END IF;
  IF v_phone IS NOT NULL AND NOT public.is_valid_celular(v_phone) THEN RAISE EXCEPTION 'Celular inválido. Informe DDD + 9 dígitos.' USING ERRCODE = 'P0001'; END IF;
  IF v_email IS NOT NULL AND NOT public.is_valid_email(v_email) THEN RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = 'P0001'; END IF;
  IF (v_pix_type IS NULL) <> (v_pix_key IS NULL) THEN RAISE EXCEPTION 'Informe o tipo e a chave PIX.' USING ERRCODE = 'P0001'; END IF;
  IF v_pix_key IS NOT NULL THEN
    IF NOT public.is_valid_pix(v_pix_type, v_pix_key) THEN RAISE EXCEPTION 'Chave PIX inválida para o tipo selecionado.' USING ERRCODE = 'P0001'; END IF;
    v_pix_key := public.normalize_pix(v_pix_type, v_pix_key);
  END IF;

  SELECT id, pix_key INTO v_person, v_old_pix FROM public.people WHERE company_id = t.company_id AND cpf = v_cpf;
  IF v_person IS NULL THEN
    IF position(' ' IN v_name) = 0 THEN RAISE EXCEPTION 'Informe nome e sobrenome.' USING ERRCODE = 'P0001'; END IF;
    IF v_phone IS NULL THEN RAISE EXCEPTION 'Informe o celular.' USING ERRCODE = 'P0001'; END IF;
    IF v_email IS NULL THEN RAISE EXCEPTION 'Informe o e-mail.' USING ERRCODE = 'P0001'; END IF;
    IF v_pix_key IS NULL THEN RAISE EXCEPTION 'Informe o tipo e a chave PIX.' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.people(company_id, full_name, cpf, phone, email, pix_type, pix_key, main_role)
    VALUES (t.company_id, v_name, v_cpf, v_phone, v_email, v_pix_type, v_pix_key, t.name)
    RETURNING id INTO v_person;
  ELSE
    UPDATE public.people SET
      phone = coalesce(v_phone, phone), email = coalesce(v_email, email),
      pix_updated_publicly_at = CASE WHEN v_pix_key IS NOT NULL AND v_pix_key IS DISTINCT FROM v_old_pix THEN now() ELSE pix_updated_publicly_at END,
      pix_type = coalesce(v_pix_type, pix_type), pix_key = coalesce(v_pix_key, pix_key)
    WHERE id = v_person;
  END IF;

  SELECT * INTO v_existing FROM public.event_participants WHERE event_id = t.event_id AND person_id = v_person;
  IF FOUND THEN
    PERFORM public.link_log('inscricao', t.company_id, _token, v_cpf, v_ip, 'ok');
    RETURN jsonb_build_object('status', v_existing.status, 'already', true);
  END IF;
  SELECT count(*) INTO v_conf FROM public.event_participants WHERE team_id = t.id AND status = 'confirmado';
  v_status := CASE WHEN v_conf >= t.quantity THEN 'lista_espera' ELSE 'aguardando' END;
  INSERT INTO public.event_participants(company_id, event_id, team_id, person_id, status, rate)
  VALUES (t.company_id, t.event_id, t.id, v_person, v_status, t.rate);
  PERFORM public.link_log('inscricao', t.company_id, _token, v_cpf, v_ip, 'ok');
  RETURN jsonb_build_object('status', v_status, 'already', false);
END $$;

-- Presença aberta só do primeiro dia ao dia seguinte ao último (turnos que viram a noite)
CREATE OR REPLACE FUNCTION public.public_presence_info(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('kind', CASE WHEN e.checkin_token = _token THEN 'checkin' ELSE 'checkout' END,
    'event_name', e.name, 'event_code', e.code, 'company_name', c.name, 'event_date', e.event_date,
    'end_date', coalesce(e.end_date, e.event_date), 'today', public.local_today(),
    'start_time', e.start_time, 'end_time', e.end_time, 'location', e.location, 'address', e.address,
    'has_coords', e.latitude IS NOT NULL, 'radius_m', e.radius_m, 'event_lat', e.latitude, 'event_lng', e.longitude,
    'open', e.status NOT IN ('fechado', 'cancelado', 'aguardando_fechamento')
            AND public.local_today() BETWEEN e.event_date AND coalesce(e.end_date, e.event_date) + 1)
  FROM public.events e JOIN public.companies c ON c.id = e.company_id
  WHERE e.checkin_token = _token OR e.checkout_token = _token
$$;

-- Lookup com a situação do dia: check-in de hoje feito? há turno aberto para check-out?
CREATE OR REPLACE FUNCTION public.public_presence_lookup(_token text, _cpf text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; r record; v_ip text := public.request_ip(); v_cpf text := public.only_digits(_cpf); v_name text;
        v_today date := public.local_today(); v_in_today boolean; v_open date;
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
  v_in_today := EXISTS (SELECT 1 FROM public.attendance WHERE participant_id = r.id AND work_date = v_today AND kind = 'checkin');
  SELECT a.work_date INTO v_open FROM public.attendance a
  WHERE a.participant_id = r.id AND a.kind = 'checkin'
    AND NOT EXISTS (SELECT 1 FROM public.attendance b WHERE b.participant_id = r.id AND b.work_date = a.work_date AND b.kind = 'checkout')
  ORDER BY a.work_date DESC LIMIT 1;
  RETURN jsonb_build_object('found', true, 'name', v_name, 'team', r.team_name, 'status', 'confirmado',
    'checkin_today', v_in_today, 'open_shift', v_open);
END $$;

DROP FUNCTION public.record_presence(text, text, double precision, double precision, double precision, text, text);
CREATE FUNCTION public.record_presence(_token text, _cpf text, _lat double precision, _lng double precision,
  _accuracy double precision, _address text, _photo_path text, _client_ip text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; v_kind text; ep record; v_dist double precision; v_inside boolean; v_today date := public.local_today(); v_wd date;
BEGIN
  SELECT * INTO e FROM public.events WHERE checkin_token = _token OR checkout_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE = 'P0001'; END IF;
  IF e.status IN ('fechado', 'cancelado', 'aguardando_fechamento') THEN RAISE EXCEPTION 'Presença encerrada para este evento.' USING ERRCODE = 'P0001'; END IF;
  v_kind := CASE WHEN e.checkin_token = _token THEN 'checkin' ELSE 'checkout' END;
  SELECT ep2.* INTO ep FROM public.event_participants ep2 JOIN public.people p ON p.id = ep2.person_id
  WHERE ep2.event_id = e.id AND p.cpf = public.only_digits(_cpf) AND ep2.status = 'confirmado';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível localizar uma participação confirmada para este CPF neste evento.' USING ERRCODE = 'P0001'; END IF;

  IF v_kind = 'checkin' THEN
    IF v_today NOT BETWEEN e.event_date AND coalesce(e.end_date, e.event_date) THEN
      RAISE EXCEPTION 'Check-in disponível somente nos dias do evento.' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.attendance WHERE participant_id = ep.id AND work_date = v_today AND kind = 'checkin') THEN
      RAISE EXCEPTION 'Check-in de hoje já registrado.' USING ERRCODE = 'P0001'; END IF;
    v_wd := v_today;
  ELSE
    -- check-out fecha o turno aberto mais recente (pode ser de ontem, em turno que vira a noite)
    SELECT a.work_date INTO v_wd FROM public.attendance a
    WHERE a.participant_id = ep.id AND a.kind = 'checkin'
      AND NOT EXISTS (SELECT 1 FROM public.attendance b WHERE b.participant_id = ep.id AND b.work_date = a.work_date AND b.kind = 'checkout')
    ORDER BY a.work_date DESC LIMIT 1;
    IF v_wd IS NULL THEN RAISE EXCEPTION 'Faça o check-in antes do check-out.' USING ERRCODE = 'P0001'; END IF;
    IF v_today > v_wd + 1 THEN RAISE EXCEPTION 'Turno expirado. Procure o coordenador.' USING ERRCODE = 'P0001'; END IF;
  END IF;

  IF e.latitude IS NOT NULL AND _lat IS NOT NULL THEN
    v_dist := 2 * 6371000 * asin(sqrt(power(sin(radians(_lat - e.latitude) / 2), 2)
      + cos(radians(e.latitude)) * cos(radians(_lat)) * power(sin(radians(_lng - e.longitude) / 2), 2)));
    v_inside := v_dist <= e.radius_m;
  END IF;
  INSERT INTO public.attendance(company_id, participant_id, kind, work_date, latitude, longitude, accuracy_m, address, distance_m, inside_radius, photo_path)
  VALUES (e.company_id, ep.id, v_kind, v_wd, _lat, _lng, _accuracy, _address, v_dist, v_inside, _photo_path);
  PERFORM public.link_log('presenca', e.company_id, _token, _cpf, public.request_ip(_client_ip), 'ok');
  IF v_kind = 'checkin' AND e.status IN ('planejamento', 'inscricoes_abertas') THEN
    UPDATE public.events SET status = 'em_andamento' WHERE id = e.id;
  END IF;
  RETURN jsonb_build_object('kind', v_kind, 'work_date', v_wd, 'distance_m', v_dist, 'inside_radius', v_inside, 'recorded_at', now());
END $$;

-- Pasta da foto: <empresa>/<evento>
CREATE OR REPLACE FUNCTION public.presence_photo_folder(_token text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id::text || '/' || id::text FROM public.events WHERE checkin_token = _token OR checkout_token = _token
$$;

REVOKE EXECUTE ON FUNCTION public.public_invite_info, public.public_invite_register, public.public_presence_info, public.public_presence_lookup FROM public;
GRANT EXECUTE ON FUNCTION public.public_invite_info, public.public_invite_register, public.public_presence_info, public.public_presence_lookup TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_presence, public.presence_photo_folder FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_presence, public.presence_photo_folder TO service_role;
REVOKE EXECUTE ON FUNCTION public.event_finish, public.event_send_to_finance FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_finish, public.event_send_to_finance TO authenticated;

-- ===================== 6. PONTOS FIXOS =====================
ALTER TABLE public.fixed_posts
  ADD COLUMN subcategory text,
  ADD COLUMN address text,
  ADD COLUMN start_date date,
  ADD COLUMN notes text,
  ADD COLUMN cliente_evento_id uuid,
  ADD COLUMN centro_custo_id uuid,
  ADD CONSTRAINT fixed_posts_cliente_fk FOREIGN KEY (cliente_evento_id, company_id) REFERENCES public.clientes_evento(id, company_id),
  ADD CONSTRAINT fixed_posts_centro_custo_fk FOREIGN KEY (centro_custo_id, company_id) REFERENCES public.centros_custo(id, company_id);
ALTER TABLE public.fixed_post_period_items
  ADD COLUMN status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conferido'));
-- a mesma pessoa não fica alocada duas vezes, ativa, no mesmo ponto
CREATE UNIQUE INDEX fixed_post_members_active_uq ON public.fixed_post_members(fixed_post_id, person_id) WHERE status = 'ativo';
ALTER TABLE public.fixed_post_members ADD CONSTRAINT fpm_dates_ck CHECK (end_date IS NULL OR end_date >= start_date);

CREATE OR REPLACE FUNCTION public.fixed_post_create(_company_id uuid, _data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := gen_random_uuid(); v_code text := btrim(coalesce(_data->>'code', ''));
        v_name text := regexp_replace(btrim(coalesce(_data->>'name', '')), '\s+', ' ', 'g');
        v_cli uuid := nullif(_data->>'cliente_evento_id', '')::uuid; v_cc uuid := nullif(_data->>'centro_custo_id', '')::uuid;
        v_resp uuid := nullif(_data->>'responsavel_user_id', '')::uuid;
BEGIN
  IF _company_id IS NULL OR NOT public.has_company_permission(_company_id, 'operacao.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para criar pontos fixos nesta empresa.' USING ERRCODE = '42501'; END IF;
  IF v_code = '' OR v_name = '' THEN RAISE EXCEPTION 'Informe código e nome do ponto fixo.' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.fixed_posts WHERE company_id = _company_id AND code = v_code) THEN
    RAISE EXCEPTION 'Já existe um ponto fixo com o código %.', v_code USING ERRCODE = 'P0001'; END IF;
  IF v_cli IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clientes_evento WHERE id = v_cli AND company_id = _company_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'Cliente inválido para esta empresa.' USING ERRCODE = 'P0001'; END IF;
  IF v_cc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.centros_custo WHERE id = v_cc AND company_id = _company_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'Centro de custo inválido para esta empresa.' USING ERRCODE = 'P0001'; END IF;
  IF v_resp IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.company_users WHERE company_id = _company_id AND user_id = v_resp AND active) THEN
    RAISE EXCEPTION 'Responsável não pertence a esta empresa.' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.operations(id, company_id, type, name) VALUES (v_id, _company_id, 'PONTO_FIXO', v_name);
  INSERT INTO public.fixed_posts(id, company_id, code, name, cliente_evento_id, centro_custo_id, client_name, cost_center,
    category, subcategory, location, address, manager_name, planned_headcount, start_date, notes)
  VALUES (v_id, _company_id, v_code, v_name, v_cli, v_cc,
    (SELECT coalesce(nome_fantasia, razao_social) FROM public.clientes_evento WHERE id = v_cli), public.cc_label(v_cc),
    nullif(btrim(_data->>'category'), ''), nullif(btrim(_data->>'subcategory'), ''),
    nullif(btrim(_data->>'location'), ''), nullif(btrim(_data->>'address'), ''),
    coalesce((SELECT coalesce(full_name, email) FROM public.profiles WHERE id = v_resp), nullif(btrim(_data->>'manager_name'), '')),
    coalesce(nullif(_data->>'planned_headcount', '')::int, 0),
    coalesce(nullif(_data->>'start_date', '')::date, public.local_today()), nullif(btrim(_data->>'notes'), ''));
  INSERT INTO public.operation_members(operation_id, company_id, user_id, role) VALUES (v_id, _company_id, auth.uid(), 'responsavel')
  ON CONFLICT DO NOTHING;
  IF v_resp IS NOT NULL THEN
    INSERT INTO public.operation_members(operation_id, company_id, user_id, role) VALUES (v_id, _company_id, v_resp, 'responsavel')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_id;
END $$;

-- Abre a competência com os profissionais ativos no mês; se já existir e estiver aberta, inclui quem foi alocado depois
CREATE OR REPLACE FUNCTION public.fixed_post_open_period(_fixed_post_id uuid, _competence date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f record; v_id uuid; v_status text; v_comp date := date_trunc('month', _competence)::date;
BEGIN
  SELECT * INTO f FROM public.fixed_posts WHERE id = _fixed_post_id;
  IF NOT FOUND OR NOT public.can_manage_operation(f.id, f.company_id) THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF f.status <> 'ativo' THEN RAISE EXCEPTION 'Ponto fixo não está ativo.' USING ERRCODE = 'P0001'; END IF;
  SELECT id, status INTO v_id, v_status FROM public.fixed_post_periods WHERE fixed_post_id = f.id AND competence = v_comp FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.fixed_post_periods(company_id, fixed_post_id, competence) VALUES (f.company_id, f.id, v_comp) RETURNING id INTO v_id;
    v_status := 'aberta';
  END IF;
  IF v_status = 'aberta' THEN
    INSERT INTO public.fixed_post_period_items(company_id, period_id, member_id, person_id, base_amount)
    SELECT m.company_id, v_id, m.id, m.person_id, m.monthly_rate FROM public.fixed_post_members m
    WHERE m.fixed_post_id = f.id AND m.status = 'ativo' AND m.start_date <= (v_comp + interval '1 month - 1 day')::date
      AND (m.end_date IS NULL OR m.end_date >= v_comp)
    ON CONFLICT (period_id, member_id) DO NOTHING;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fixed_post_validate_period(_period_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record;
BEGIN
  SELECT * INTO pr FROM public.fixed_post_periods WHERE id = _period_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_operation(pr.fixed_post_id, pr.company_id) THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF pr.status <> 'aberta' THEN RAISE EXCEPTION 'Competência já validada.' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fixed_post_period_items WHERE period_id = _period_id) THEN
    RAISE EXCEPTION 'Competência sem profissionais.' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.fixed_post_period_items WHERE period_id = _period_id AND status <> 'conferido') THEN
    RAISE EXCEPTION 'Confira todos os profissionais antes de validar.' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.fixed_post_period_items WHERE period_id = _period_id AND final_amount < 0) THEN
    RAISE EXCEPTION 'Há valor final negativo. Revise descontos.' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.fixed_post_periods SET status = 'validada', validated_at = now(), validated_by = auth.uid() WHERE id = _period_id;
END $$;

CREATE OR REPLACE FUNCTION public.fixed_post_reopen_period(_period_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record;
BEGIN
  SELECT * INTO pr FROM public.fixed_post_periods WHERE id = _period_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_operation(pr.fixed_post_id, pr.company_id) THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF pr.status <> 'validada' THEN RAISE EXCEPTION 'Só é possível reabrir competência validada e ainda não enviada.' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.fixed_post_periods SET status = 'aberta', validated_at = NULL, validated_by = NULL WHERE id = _period_id;
END $$;

CREATE OR REPLACE FUNCTION public.fixed_post_send_period(_period_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record; f record; n int;
BEGIN
  SELECT * INTO pr FROM public.fixed_post_periods WHERE id = _period_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_operation(pr.fixed_post_id, pr.company_id) THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF pr.status = 'enviada' THEN RAISE EXCEPTION 'Competência já enviada.' USING ERRCODE = 'P0001'; END IF;
  IF pr.status <> 'validada' THEN RAISE EXCEPTION 'Valide a competência antes de enviar.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO f FROM public.fixed_posts WHERE id = pr.fixed_post_id;
  INSERT INTO public.payables(company_id, operation_id, description, amount, status, origin, person_id, period_item_id,
    payee_name, payee_document, pix_type, pix_key, op_code, op_name, competence, cost_center, centro_custo_id)
  SELECT i.company_id, f.id, 'Ponto Fixo ' || f.code || ' — ' || to_char(pr.competence, 'MM/YYYY') || ' — ' || p.full_name, i.final_amount,
    (CASE WHEN p.pix_key IS NULL OR p.pix_updated_publicly_at IS NOT NULL THEN 'pendente_validacao' ELSE 'a_pagar' END)::public.payable_status,
    'PONTO_FIXO', p.id, i.id, p.full_name, p.cpf, p.pix_type, p.pix_key, f.code, f.name, pr.competence,
    coalesce(public.cc_label(f.centro_custo_id), f.cost_center), f.centro_custo_id
  FROM public.fixed_post_period_items i JOIN public.people p ON p.id = i.person_id
  WHERE i.period_id = _period_id AND i.final_amount > 0
  ON CONFLICT (period_item_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.fixed_post_periods SET status = 'enviada', sent_at = now() WHERE id = _period_id;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.fixed_post_create, public.fixed_post_open_period, public.fixed_post_validate_period,
  public.fixed_post_reopen_period, public.fixed_post_send_period FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fixed_post_create, public.fixed_post_open_period, public.fixed_post_validate_period,
  public.fixed_post_reopen_period, public.fixed_post_send_period TO authenticated;
