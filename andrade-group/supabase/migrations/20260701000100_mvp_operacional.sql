-- ===================== PESSOAS =====================
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  full_name text NOT NULL,
  cpf text NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
  phone text,
  email text,
  pix_type text CHECK (pix_type IN ('cpf','cnpj','celular','email','aleatoria')),
  pix_key text,
  main_role text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','bloqueado')),
  pix_updated_publicly_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, cpf),
  UNIQUE (id, company_id)
);
GRANT SELECT, INSERT, UPDATE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY people_select ON public.people FOR SELECT TO authenticated USING (
  public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar')
  OR public.has_company_permission(company_id,'financeiro.ver') OR public.has_company_permission(company_id,'financeiro.gerenciar'));
CREATE POLICY people_insert ON public.people FOR INSERT TO authenticated WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY people_update ON public.people FOR UPDATE TO authenticated
  USING (public.has_company_permission(company_id,'operacao.gerenciar')) WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));

-- ===================== EVENTOS =====================
CREATE TABLE public.events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  client_name text,
  cost_center text,
  event_date date NOT NULL,
  start_time time,
  end_time time,
  location text,
  address text,
  latitude double precision,
  longitude double precision,
  radius_m integer NOT NULL DEFAULT 300,
  manager_name text,
  notes text,
  show_rate boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'inscricoes_abertas'
    CHECK (status IN ('planejamento','inscricoes_abertas','em_andamento','aguardando_fechamento','fechado','cancelado')),
  checkin_token text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text,'-',''),1,16),
  checkout_token text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text,'-',''),1,16),
  closed_at timestamptz,
  closed_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, code),
  FOREIGN KEY (id, company_id) REFERENCES public.operations(id, company_id)
);
GRANT SELECT, INSERT, UPDATE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ev_select ON public.events FOR SELECT TO authenticated USING (
  public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY ev_insert ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY ev_update ON public.events FOR UPDATE TO authenticated
  USING (public.has_company_permission(company_id,'operacao.gerenciar')) WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));

CREATE TABLE public.event_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  event_id uuid NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  rate numeric(12,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  coordinator_name text,
  start_time time,
  end_time time,
  registrations_open boolean NOT NULL DEFAULT true,
  invite_token text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text,'-',''),1,16),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  FOREIGN KEY (event_id, company_id) REFERENCES public.events(id, company_id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_teams TO authenticated;
GRANT ALL ON public.event_teams TO service_role;
ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY et_select ON public.event_teams FOR SELECT TO authenticated USING (
  public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY et_write ON public.event_teams FOR ALL TO authenticated
  USING (public.has_company_permission(company_id,'operacao.gerenciar')) WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));

CREATE TABLE public.event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  event_id uuid NOT NULL,
  team_id uuid NOT NULL,
  person_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('inscrito','aguardando','confirmado','lista_espera','recusado','cancelado')),
  worked boolean,
  days numeric(6,2) NOT NULL DEFAULT 1,
  rate numeric(12,2) NOT NULL DEFAULT 0,
  addition numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  final_amount numeric(12,2) GENERATED ALWAYS AS (CASE WHEN worked THEN round(days*rate + addition - discount, 2) ELSE 0 END) STORED,
  validation_notes text,
  validated_at timestamptz,
  validated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (event_id, person_id),
  FOREIGN KEY (event_id, company_id) REFERENCES public.events(id, company_id),
  FOREIGN KEY (team_id, company_id) REFERENCES public.event_teams(id, company_id),
  FOREIGN KEY (person_id, company_id) REFERENCES public.people(id, company_id)
);
GRANT SELECT, INSERT, UPDATE ON public.event_participants TO authenticated;
GRANT ALL ON public.event_participants TO service_role;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY ep_select ON public.event_participants FOR SELECT TO authenticated USING (
  public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY ep_insert ON public.event_participants FOR INSERT TO authenticated WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY ep_update ON public.event_participants FOR UPDATE TO authenticated
  USING (public.has_company_permission(company_id,'operacao.gerenciar')) WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));

CREATE OR REPLACE FUNCTION public.event_participants_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q int; c int;
BEGIN
  IF NEW.status = 'confirmado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmado' OR OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
    SELECT quantity INTO q FROM public.event_teams WHERE id = NEW.team_id;
    SELECT count(*) INTO c FROM public.event_participants WHERE team_id = NEW.team_id AND status = 'confirmado' AND id <> NEW.id;
    IF c >= q THEN RAISE EXCEPTION 'Equipe completa: todas as % vagas já estão confirmadas.', q USING ERRCODE = 'P0001'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = NEW.event_id AND e.status = 'fechado')
     AND (NEW.worked, NEW.days, NEW.rate, NEW.addition, NEW.discount, NEW.status) IS DISTINCT FROM (OLD.worked, OLD.days, OLD.rate, OLD.addition, OLD.discount, OLD.status) THEN
    RAISE EXCEPTION 'Evento fechado: participação não pode ser alterada.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ep_capacity BEFORE INSERT OR UPDATE ON public.event_participants FOR EACH ROW EXECUTE FUNCTION public.event_participants_capacity();

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('checkin','checkout')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  address text,
  distance_m double precision,
  inside_radius boolean,
  photo_path text,
  UNIQUE (participant_id, kind),
  FOREIGN KEY (participant_id, company_id) REFERENCES public.event_participants(id, company_id)
);
GRANT SELECT ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY att_select ON public.attendance FOR SELECT TO authenticated USING (
  public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));

-- ===================== PONTOS FIXOS =====================
CREATE TABLE public.fixed_posts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  client_name text,
  category text,
  location text,
  manager_name text,
  cost_center text,
  planned_headcount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','encerrado')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, code),
  FOREIGN KEY (id, company_id) REFERENCES public.operations(id, company_id)
);
CREATE TABLE public.fixed_post_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  fixed_post_id uuid NOT NULL,
  person_id uuid NOT NULL,
  role text,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  monthly_rate numeric(12,2) NOT NULL CHECK (monthly_rate >= 0),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  FOREIGN KEY (fixed_post_id, company_id) REFERENCES public.fixed_posts(id, company_id),
  FOREIGN KEY (person_id, company_id) REFERENCES public.people(id, company_id)
);
CREATE TABLE public.fixed_post_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  fixed_post_id uuid NOT NULL,
  competence date NOT NULL CHECK (extract(day FROM competence) = 1),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','validada','enviada')),
  validated_at timestamptz,
  validated_by uuid,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (fixed_post_id, competence),
  FOREIGN KEY (fixed_post_id, company_id) REFERENCES public.fixed_posts(id, company_id)
);
CREATE TABLE public.fixed_post_period_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  period_id uuid NOT NULL,
  member_id uuid NOT NULL,
  person_id uuid NOT NULL,
  base_amount numeric(12,2) NOT NULL DEFAULT 0,
  absences integer NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  addition numeric(12,2) NOT NULL DEFAULT 0,
  final_amount numeric(12,2) GENERATED ALWAYS AS (round(base_amount + addition - discount, 2)) STORED,
  notes text,
  UNIQUE (id, company_id),
  UNIQUE (period_id, member_id),
  FOREIGN KEY (period_id, company_id) REFERENCES public.fixed_post_periods(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id, company_id) REFERENCES public.fixed_post_members(id, company_id),
  FOREIGN KEY (person_id, company_id) REFERENCES public.people(id, company_id)
);
GRANT SELECT, INSERT, UPDATE ON public.fixed_posts, public.fixed_post_members, public.fixed_post_periods, public.fixed_post_period_items TO authenticated;
GRANT ALL ON public.fixed_posts, public.fixed_post_members, public.fixed_post_periods, public.fixed_post_period_items TO service_role;
ALTER TABLE public.fixed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_post_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_post_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_post_period_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY fp_select ON public.fixed_posts FOR SELECT TO authenticated USING (public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fp_insert ON public.fixed_posts FOR INSERT TO authenticated WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fp_update ON public.fixed_posts FOR UPDATE TO authenticated USING (public.has_company_permission(company_id,'operacao.gerenciar')) WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpm_select ON public.fixed_post_members FOR SELECT TO authenticated USING (public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpm_insert ON public.fixed_post_members FOR INSERT TO authenticated WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpm_update ON public.fixed_post_members FOR UPDATE TO authenticated USING (public.has_company_permission(company_id,'operacao.gerenciar')) WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpp_select ON public.fixed_post_periods FOR SELECT TO authenticated USING (public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpp_insert ON public.fixed_post_periods FOR INSERT TO authenticated WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpp_update ON public.fixed_post_periods FOR UPDATE TO authenticated USING (public.has_company_permission(company_id,'operacao.gerenciar') AND status <> 'enviada') WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpi_select ON public.fixed_post_period_items FOR SELECT TO authenticated USING (public.has_company_permission(company_id,'operacao.ver') OR public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpi_insert ON public.fixed_post_period_items FOR INSERT TO authenticated WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));
CREATE POLICY fpi_update ON public.fixed_post_period_items FOR UPDATE TO authenticated
  USING (public.has_company_permission(company_id,'operacao.gerenciar') AND EXISTS (SELECT 1 FROM public.fixed_post_periods p WHERE p.id = period_id AND p.status = 'aberta'))
  WITH CHECK (public.has_company_permission(company_id,'operacao.gerenciar'));

-- ===================== CONTAS A PAGAR: origem operacional =====================
ALTER TABLE public.payables
  ADD COLUMN origin text NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('EVENTO','PONTO_FIXO','FORNECEDOR','MANUAL')),
  ADD COLUMN person_id uuid,
  ADD COLUMN event_participant_id uuid UNIQUE,
  ADD COLUMN period_item_id uuid UNIQUE,
  ADD COLUMN payee_name text,
  ADD COLUMN payee_document text,
  ADD COLUMN pix_type text,
  ADD COLUMN pix_key text,
  ADD COLUMN op_code text,
  ADD COLUMN op_name text,
  ADD COLUMN ref_date date,
  ADD COLUMN competence date,
  ADD COLUMN cost_center text,
  ADD COLUMN paid_at timestamptz,
  ADD COLUMN scheduled_for date;
ALTER TABLE public.payables
  ADD CONSTRAINT payables_person_fk FOREIGN KEY (person_id, company_id) REFERENCES public.people(id, company_id),
  ADD CONSTRAINT payables_participant_fk FOREIGN KEY (event_participant_id, company_id) REFERENCES public.event_participants(id, company_id),
  ADD CONSTRAINT payables_period_item_fk FOREIGN KEY (period_item_id, company_id) REFERENCES public.fixed_post_period_items(id, company_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['people','events','event_teams','event_participants','attendance','fixed_posts','fixed_post_members','fixed_post_periods','fixed_post_period_items'] LOOP
    EXECUTE format('CREATE TRIGGER trg_lock_company_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.lock_company_id()', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.audit_row()', t);
  END LOOP;
END $$;

-- ===================== RPCs PÚBLICAS (links) =====================
CREATE OR REPLACE FUNCTION public.public_invite_info(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'team_name', t.name, 'event_name', e.name, 'event_code', e.code, 'company_name', c.name, 'company_color', c.color,
    'event_date', e.event_date, 'start_time', coalesce(t.start_time, e.start_time), 'end_time', coalesce(t.end_time, e.end_time),
    'location', e.location, 'address', e.address,
    'rate', CASE WHEN e.show_rate THEN t.rate END,
    'open', t.registrations_open AND e.status IN ('planejamento','inscricoes_abertas','em_andamento'),
    'vacancies', greatest(t.quantity - (SELECT count(*) FROM public.event_participants p WHERE p.team_id = t.id AND p.status = 'confirmado'), 0))
  FROM public.event_teams t JOIN public.events e ON e.id = t.event_id JOIN public.companies c ON c.id = t.company_id
  WHERE t.invite_token = _token
$$;

CREATE OR REPLACE FUNCTION public.public_invite_lookup(_token text, _cpf text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; p record; v_status text;
BEGIN
  SELECT * INTO t FROM public.event_teams WHERE invite_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.people WHERE company_id = t.company_id AND cpf = regexp_replace(_cpf,'\D','','g');
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT status INTO v_status FROM public.event_participants WHERE event_id = t.event_id AND person_id = p.id;
  RETURN jsonb_build_object('found', true,
    'first_name', split_part(p.full_name,' ',1),
    'phone_hint', CASE WHEN p.phone IS NOT NULL THEN '(**) *****-' || right(p.phone,4) END,
    'email_hint', CASE WHEN p.email IS NOT NULL THEN left(p.email,2) || '***@' || split_part(p.email,'@',2) END,
    'pix_type', p.pix_type,
    'has_pix', p.pix_key IS NOT NULL,
    'participation_status', v_status);
END $$;

CREATE OR REPLACE FUNCTION public.public_invite_register(_token text, _data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; e record; v_cpf text; v_person uuid; v_status text; v_conf int; v_existing record;
BEGIN
  SELECT * INTO t FROM public.event_teams WHERE invite_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE='P0001'; END IF;
  SELECT * INTO e FROM public.events WHERE id = t.event_id;
  IF NOT t.registrations_open OR e.status NOT IN ('planejamento','inscricoes_abertas','em_andamento') THEN
    RAISE EXCEPTION 'Inscrições encerradas para esta equipe.' USING ERRCODE='P0001'; END IF;
  v_cpf := regexp_replace(coalesce(_data->>'cpf',''),'\D','','g');
  IF length(v_cpf) <> 11 THEN RAISE EXCEPTION 'CPF inválido.' USING ERRCODE='P0001'; END IF;

  SELECT id INTO v_person FROM public.people WHERE company_id = t.company_id AND cpf = v_cpf;
  IF v_person IS NULL THEN
    IF coalesce(trim(_data->>'full_name'),'') = '' OR position(' ' in trim(_data->>'full_name')) = 0 THEN
      RAISE EXCEPTION 'Informe o nome completo.' USING ERRCODE='P0001'; END IF;
    INSERT INTO public.people(company_id, full_name, cpf, phone, email, pix_type, pix_key, main_role)
    VALUES (t.company_id, trim(_data->>'full_name'), v_cpf, nullif(regexp_replace(coalesce(_data->>'phone',''),'\D','','g'),''),
            nullif(lower(trim(coalesce(_data->>'email',''))),''), nullif(_data->>'pix_type',''), nullif(trim(coalesce(_data->>'pix_key','')),''), t.name)
    RETURNING id INTO v_person;
  ELSE
    UPDATE public.people SET
      phone = coalesce(nullif(regexp_replace(coalesce(_data->>'phone',''),'\D','','g'),''), phone),
      email = coalesce(nullif(lower(trim(coalesce(_data->>'email',''))),''), email),
      pix_updated_publicly_at = CASE WHEN nullif(trim(coalesce(_data->>'pix_key','')),'') IS NOT NULL
                                       AND trim(_data->>'pix_key') IS DISTINCT FROM pix_key THEN now() ELSE pix_updated_publicly_at END,
      pix_type = coalesce(nullif(_data->>'pix_type',''), pix_type),
      pix_key = coalesce(nullif(trim(coalesce(_data->>'pix_key','')),''), pix_key)
    WHERE id = v_person;
  END IF;

  SELECT * INTO v_existing FROM public.event_participants WHERE event_id = t.event_id AND person_id = v_person;
  IF FOUND THEN
    RETURN jsonb_build_object('status', v_existing.status, 'already', true);
  END IF;
  SELECT count(*) INTO v_conf FROM public.event_participants WHERE team_id = t.id AND status = 'confirmado';
  v_status := CASE WHEN v_conf >= t.quantity THEN 'lista_espera' ELSE 'aguardando' END;
  INSERT INTO public.event_participants(company_id, event_id, team_id, person_id, status, rate)
  VALUES (t.company_id, t.event_id, t.id, v_person, v_status, t.rate);
  RETURN jsonb_build_object('status', v_status, 'already', false);
END $$;

CREATE OR REPLACE FUNCTION public.public_presence_info(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('kind', CASE WHEN e.checkin_token = _token THEN 'checkin' ELSE 'checkout' END,
    'event_name', e.name, 'event_code', e.code, 'company_name', c.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time, 'location', e.location, 'address', e.address,
    'has_coords', e.latitude IS NOT NULL, 'radius_m', e.radius_m,
    'event_lat', e.latitude, 'event_lng', e.longitude,
    'open', e.status NOT IN ('fechado','cancelado','aguardando_fechamento'))
  FROM public.events e JOIN public.companies c ON c.id = e.company_id
  WHERE e.checkin_token = _token OR e.checkout_token = _token
$$;

CREATE OR REPLACE FUNCTION public.public_presence_lookup(_token text, _cpf text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; v_kind text; r record;
BEGIN
  SELECT * INTO e FROM public.events WHERE checkin_token = _token OR checkout_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_kind := CASE WHEN e.checkin_token = _token THEN 'checkin' ELSE 'checkout' END;
  SELECT ep.id, ep.status, p.full_name, t.name AS team_name,
    (SELECT recorded_at FROM public.attendance a WHERE a.participant_id = ep.id AND a.kind = 'checkin') AS checkin_at,
    (SELECT recorded_at FROM public.attendance a WHERE a.participant_id = ep.id AND a.kind = 'checkout') AS checkout_at
  INTO r FROM public.event_participants ep JOIN public.people p ON p.id = ep.person_id JOIN public.event_teams t ON t.id = ep.team_id
  WHERE ep.event_id = e.id AND p.cpf = regexp_replace(_cpf,'\D','','g');
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  RETURN jsonb_build_object('found', true, 'kind', v_kind, 'name', r.full_name, 'team', r.team_name, 'status', r.status,
    'checkin_at', r.checkin_at, 'checkout_at', r.checkout_at);
END $$;

CREATE OR REPLACE FUNCTION public.record_presence(_token text, _cpf text, _lat double precision, _lng double precision,
  _accuracy double precision, _address text, _photo_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; v_kind text; ep record; v_dist double precision; v_inside boolean;
BEGIN
  SELECT * INTO e FROM public.events WHERE checkin_token = _token OR checkout_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE='P0001'; END IF;
  IF e.status IN ('fechado','cancelado','aguardando_fechamento') THEN RAISE EXCEPTION 'Presença encerrada para este evento.' USING ERRCODE='P0001'; END IF;
  v_kind := CASE WHEN e.checkin_token = _token THEN 'checkin' ELSE 'checkout' END;
  SELECT ep2.* INTO ep FROM public.event_participants ep2 JOIN public.people p ON p.id = ep2.person_id
  WHERE ep2.event_id = e.id AND p.cpf = regexp_replace(_cpf,'\D','','g');
  IF NOT FOUND THEN RAISE EXCEPTION 'Participação não encontrada para este CPF.' USING ERRCODE='P0001'; END IF;
  IF ep.status <> 'confirmado' THEN RAISE EXCEPTION 'Sua participação ainda não foi confirmada pelo coordenador.' USING ERRCODE='P0001'; END IF;
  IF v_kind = 'checkout' AND NOT EXISTS (SELECT 1 FROM public.attendance WHERE participant_id = ep.id AND kind = 'checkin') THEN
    RAISE EXCEPTION 'Faça o check-in antes do check-out.' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.attendance WHERE participant_id = ep.id AND kind = v_kind) THEN
    RAISE EXCEPTION 'Registro já realizado.' USING ERRCODE='P0001'; END IF;
  IF e.latitude IS NOT NULL AND _lat IS NOT NULL THEN
    v_dist := 2 * 6371000 * asin(sqrt(power(sin(radians(_lat - e.latitude)/2),2)
      + cos(radians(e.latitude)) * cos(radians(_lat)) * power(sin(radians(_lng - e.longitude)/2),2)));
    v_inside := v_dist <= e.radius_m;
  END IF;
  INSERT INTO public.attendance(company_id, participant_id, kind, latitude, longitude, accuracy_m, address, distance_m, inside_radius, photo_path)
  VALUES (e.company_id, ep.id, v_kind, _lat, _lng, _accuracy, _address, v_dist, v_inside, _photo_path);
  IF v_kind = 'checkin' AND e.status IN ('planejamento','inscricoes_abertas') THEN
    UPDATE public.events SET status = 'em_andamento' WHERE id = e.id;
  END IF;
  RETURN jsonb_build_object('kind', v_kind, 'distance_m', v_dist, 'inside_radius', v_inside, 'recorded_at', now());
END $$;

CREATE OR REPLACE FUNCTION public.presence_photo_company(_token text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.events WHERE checkin_token = _token OR checkout_token = _token
$$;

REVOKE EXECUTE ON FUNCTION public.public_invite_info, public.public_invite_lookup, public.public_invite_register,
  public.public_presence_info, public.public_presence_lookup FROM public;
GRANT EXECUTE ON FUNCTION public.public_invite_info, public.public_invite_lookup, public.public_invite_register,
  public.public_presence_info, public.public_presence_lookup TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_presence, public.presence_photo_company FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_presence, public.presence_photo_company TO service_role;

-- ===================== FECHAMENTO -> FINANCEIRO =====================
CREATE OR REPLACE FUNCTION public.event_send_to_finance(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; n int;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT public.has_company_permission(e.company_id,'operacao.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE='42501'; END IF;
  IF e.status = 'fechado' THEN RAISE EXCEPTION 'Evento já enviado ao financeiro.' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = _event_id AND status = 'confirmado' AND worked IS NULL) THEN
    RAISE EXCEPTION 'Valide todos os profissionais confirmados (trabalhou ou não) antes de enviar.' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.payables(company_id, operation_id, description, amount, due_date, status, origin, person_id, event_participant_id,
    payee_name, payee_document, pix_type, pix_key, op_code, op_name, ref_date, cost_center)
  SELECT ep.company_id, e.id, 'Evento ' || e.code || ' — ' || t.name || ' — ' || p.full_name, ep.final_amount, NULL,
    (CASE WHEN p.pix_key IS NULL OR p.pix_updated_publicly_at IS NOT NULL THEN 'pendente_validacao' ELSE 'a_pagar' END)::public.payable_status,
    'EVENTO', p.id, ep.id, p.full_name, p.cpf, p.pix_type, p.pix_key, e.code, e.name, e.event_date, e.cost_center
  FROM public.event_participants ep JOIN public.people p ON p.id = ep.person_id JOIN public.event_teams t ON t.id = ep.team_id
  WHERE ep.event_id = _event_id AND ep.status = 'confirmado' AND ep.worked AND ep.final_amount > 0
  ON CONFLICT (event_participant_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.events SET status = 'fechado', closed_at = now(), closed_by = auth.uid() WHERE id = _event_id;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.fixed_post_open_period(_fixed_post_id uuid, _competence date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f record; v_id uuid; v_comp date := date_trunc('month', _competence)::date;
BEGIN
  SELECT * INTO f FROM public.fixed_posts WHERE id = _fixed_post_id;
  IF NOT FOUND OR NOT public.has_company_permission(f.company_id,'operacao.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_id FROM public.fixed_post_periods WHERE fixed_post_id = f.id AND competence = v_comp;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.fixed_post_periods(company_id, fixed_post_id, competence) VALUES (f.company_id, f.id, v_comp) RETURNING id INTO v_id;
  INSERT INTO public.fixed_post_period_items(company_id, period_id, member_id, person_id, base_amount)
  SELECT m.company_id, v_id, m.id, m.person_id, m.monthly_rate FROM public.fixed_post_members m
  WHERE m.fixed_post_id = f.id AND m.status = 'ativo' AND m.start_date <= (v_comp + interval '1 month - 1 day')::date
    AND (m.end_date IS NULL OR m.end_date >= v_comp);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fixed_post_send_period(_period_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record; f record; n int;
BEGIN
  SELECT * INTO pr FROM public.fixed_post_periods WHERE id = _period_id;
  IF NOT FOUND OR NOT public.has_company_permission(pr.company_id,'operacao.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE='42501'; END IF;
  IF pr.status = 'enviada' THEN RAISE EXCEPTION 'Competência já enviada.' USING ERRCODE='P0001'; END IF;
  IF pr.status <> 'validada' THEN RAISE EXCEPTION 'Valide a competência antes de enviar.' USING ERRCODE='P0001'; END IF;
  SELECT * INTO f FROM public.fixed_posts WHERE id = pr.fixed_post_id;
  INSERT INTO public.payables(company_id, operation_id, description, amount, status, origin, person_id, period_item_id,
    payee_name, payee_document, pix_type, pix_key, op_code, op_name, competence, cost_center)
  SELECT i.company_id, f.id, 'Ponto Fixo ' || f.code || ' — ' || to_char(pr.competence,'MM/YYYY') || ' — ' || p.full_name, i.final_amount,
    (CASE WHEN p.pix_key IS NULL OR p.pix_updated_publicly_at IS NOT NULL THEN 'pendente_validacao' ELSE 'a_pagar' END)::public.payable_status,
    'PONTO_FIXO', p.id, i.id, p.full_name, p.cpf, p.pix_type, p.pix_key, f.code, f.name, pr.competence, f.cost_center
  FROM public.fixed_post_period_items i JOIN public.people p ON p.id = i.person_id
  WHERE i.period_id = _period_id AND i.final_amount > 0
  ON CONFLICT (period_item_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.fixed_post_periods SET status = 'enviada', sent_at = now() WHERE id = _period_id;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.event_send_to_finance, public.fixed_post_open_period, public.fixed_post_send_period FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_send_to_finance, public.fixed_post_open_period, public.fixed_post_send_period TO authenticated;

CREATE POLICY presence_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'presence-photos' AND (
    public.has_company_permission(((storage.foldername(name))[1])::uuid, 'operacao.ver')
    OR public.has_company_permission(((storage.foldername(name))[1])::uuid, 'operacao.gerenciar')));
