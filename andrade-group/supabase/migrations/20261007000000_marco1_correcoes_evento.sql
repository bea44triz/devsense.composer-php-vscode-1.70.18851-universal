-- Marco 1 — Evento vertical: correções sobre a base do Lovable (0000/0001).
--  1. Validadores no banco (CPF, CNPJ, celular, e-mail, PIX) — mesmas regras de src/lib/utils.ts
--  2. public_invite_register: valida e normaliza tudo no banco e trava a equipe
--  3. Capacidade: trava a linha da equipe antes de contar confirmados (sem corrida na última vaga)
--  4. Fluxo do evento: event_finish (encerra presença → aguardando_fechamento) antes de enviar ao financeiro
--  5. Bucket privado das fotos de presença

-- ===================== 1. VALIDADORES =====================
CREATE OR REPLACE FUNCTION public.only_digits(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(coalesce(_t, ''), '\D', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.is_valid_cpf(_cpf text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := public.only_digits(_cpf); s int; r int; i int;
BEGIN
  IF length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0; FOR i IN 1..9 LOOP s := s + substr(d, i, 1)::int * (11 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  IF r <> substr(d, 10, 1)::int THEN RETURN false; END IF;
  s := 0; FOR i IN 1..10 LOOP s := s + substr(d, i, 1)::int * (12 - i); END LOOP;
  r := (s * 10) % 11; IF r = 10 THEN r := 0; END IF;
  RETURN r = substr(d, 11, 1)::int;
END $$;

CREATE OR REPLACE FUNCTION public.is_valid_cnpj(_cnpj text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := public.only_digits(_cnpj); w1 int[] := '{5,4,3,2,9,8,7,6,5,4,3,2}'; w2 int[] := '{6,5,4,3,2,9,8,7,6,5,4,3,2}';
        s int; r int; i int;
BEGIN
  IF length(d) <> 14 OR d ~ '^(\d)\1{13}$' THEN RETURN false; END IF;
  s := 0; FOR i IN 1..12 LOOP s := s + substr(d, i, 1)::int * w1[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF r <> substr(d, 13, 1)::int THEN RETURN false; END IF;
  s := 0; FOR i IN 1..13 LOOP s := s + substr(d, i, 1)::int * w2[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  RETURN r = substr(d, 14, 1)::int;
END $$;

-- Celular: DDD sem zero + 9 dígitos começando com 9
CREATE OR REPLACE FUNCTION public.is_valid_celular(_phone text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT public.only_digits(_phone) ~ '^[1-9]{2}9[0-9]{8}$'
$$;

CREATE OR REPLACE FUNCTION public.is_valid_email(_email text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT btrim(coalesce(_email, '')) ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
$$;

CREATE OR REPLACE FUNCTION public.is_valid_pix(_tipo text, _chave text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _tipo
    WHEN 'cpf'       THEN public.is_valid_cpf(_chave)
    WHEN 'cnpj'      THEN public.is_valid_cnpj(_chave)
    WHEN 'celular'   THEN public.is_valid_celular(_chave)
    WHEN 'email'     THEN public.is_valid_email(_chave)
    WHEN 'aleatoria' THEN btrim(coalesce(_chave, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ELSE false END
$$;

-- Chave PIX gravada limpa: só dígitos (cpf/cnpj/celular) ou minúsculas (email/aleatória). Sempre texto.
CREATE OR REPLACE FUNCTION public.normalize_pix(_tipo text, _chave text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _tipo IN ('cpf', 'cnpj', 'celular') THEN public.only_digits(_chave)
              ELSE lower(btrim(coalesce(_chave, ''))) END
$$;

GRANT EXECUTE ON FUNCTION public.only_digits, public.is_valid_cpf, public.is_valid_cnpj, public.is_valid_celular,
  public.is_valid_email, public.is_valid_pix, public.normalize_pix TO anon, authenticated, service_role;

-- ===================== 2. INSCRIÇÃO PÚBLICA =====================
CREATE OR REPLACE FUNCTION public.public_invite_register(_token text, _data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; e record; v_cpf text; v_person uuid; v_status text; v_conf int; v_existing record;
        v_name text; v_phone text; v_email text; v_pix_type text; v_pix_key text; v_old_pix text;
BEGIN
  -- trava a equipe: inscrições simultâneas no mesmo link são serializadas
  SELECT * INTO t FROM public.event_teams WHERE invite_token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO e FROM public.events WHERE id = t.event_id;
  IF NOT t.registrations_open OR e.status NOT IN ('planejamento', 'inscricoes_abertas', 'em_andamento') THEN
    RAISE EXCEPTION 'Inscrições encerradas para esta equipe.' USING ERRCODE = 'P0001';
  END IF;

  v_cpf      := public.only_digits(_data->>'cpf');
  v_name     := regexp_replace(btrim(coalesce(_data->>'full_name', '')), '\s+', ' ', 'g');
  v_phone    := nullif(public.only_digits(_data->>'phone'), '');
  v_email    := nullif(lower(btrim(coalesce(_data->>'email', ''))), '');
  v_pix_type := nullif(_data->>'pix_type', '');
  v_pix_key  := nullif(btrim(coalesce(_data->>'pix_key', '')), '');

  IF NOT public.is_valid_cpf(v_cpf) THEN RAISE EXCEPTION 'CPF inválido.' USING ERRCODE = 'P0001'; END IF;
  IF v_phone IS NOT NULL AND NOT public.is_valid_celular(v_phone) THEN
    RAISE EXCEPTION 'Celular inválido. Informe DDD + 9 dígitos.' USING ERRCODE = 'P0001'; END IF;
  IF v_email IS NOT NULL AND NOT public.is_valid_email(v_email) THEN
    RAISE EXCEPTION 'E-mail inválido.' USING ERRCODE = 'P0001'; END IF;
  IF (v_pix_type IS NULL) <> (v_pix_key IS NULL) THEN
    RAISE EXCEPTION 'Informe o tipo e a chave PIX.' USING ERRCODE = 'P0001'; END IF;
  IF v_pix_key IS NOT NULL THEN
    IF NOT public.is_valid_pix(v_pix_type, v_pix_key) THEN
      RAISE EXCEPTION 'Chave PIX inválida para o tipo selecionado.' USING ERRCODE = 'P0001'; END IF;
    v_pix_key := public.normalize_pix(v_pix_type, v_pix_key);
  END IF;

  SELECT id, pix_key INTO v_person, v_old_pix FROM public.people WHERE company_id = t.company_id AND cpf = v_cpf;
  IF v_person IS NULL THEN
    -- cadastro novo: todos os dados financeiros obrigatórios
    IF position(' ' IN v_name) = 0 THEN  -- nome já normalizado: um espaço = pelo menos 2 palavras
      RAISE EXCEPTION 'Informe nome e sobrenome.' USING ERRCODE = 'P0001'; END IF;
    IF v_phone IS NULL THEN RAISE EXCEPTION 'Informe o celular.' USING ERRCODE = 'P0001'; END IF;
    IF v_email IS NULL THEN RAISE EXCEPTION 'Informe o e-mail.' USING ERRCODE = 'P0001'; END IF;
    IF v_pix_key IS NULL THEN RAISE EXCEPTION 'Informe o tipo e a chave PIX.' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.people(company_id, full_name, cpf, phone, email, pix_type, pix_key, main_role)
    VALUES (t.company_id, v_name, v_cpf, v_phone, v_email, v_pix_type, v_pix_key, t.name)
    RETURNING id INTO v_person;
  ELSE
    -- cadastro existente: atualiza só o que foi informado; troca de PIX pelo link fica marcada
    UPDATE public.people SET
      phone = coalesce(v_phone, phone),
      email = coalesce(v_email, email),
      pix_updated_publicly_at = CASE WHEN v_pix_key IS NOT NULL AND v_pix_key IS DISTINCT FROM v_old_pix
                                     THEN now() ELSE pix_updated_publicly_at END,
      pix_type = coalesce(v_pix_type, pix_type),
      pix_key  = coalesce(v_pix_key, pix_key)
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

-- ===================== 3. CAPACIDADE COM TRAVA =====================
CREATE OR REPLACE FUNCTION public.event_participants_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q int; c int;
BEGIN
  IF NEW.status = 'confirmado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmado' OR OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
    -- trava a equipe: duas confirmações simultâneas não ultrapassam a quantidade
    SELECT quantity INTO q FROM public.event_teams WHERE id = NEW.team_id FOR UPDATE;
    SELECT count(*) INTO c FROM public.event_participants WHERE team_id = NEW.team_id AND status = 'confirmado' AND id <> NEW.id;
    IF c >= q THEN RAISE EXCEPTION 'Equipe completa: todas as % vagas já estão confirmadas.', q USING ERRCODE = 'P0001'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = NEW.event_id AND e.status = 'fechado')
     AND (NEW.worked, NEW.days, NEW.rate, NEW.addition, NEW.discount, NEW.status) IS DISTINCT FROM (OLD.worked, OLD.days, OLD.rate, OLD.addition, OLD.discount, OLD.status) THEN
    RAISE EXCEPTION 'Evento fechado: participação não pode ser alterada.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

-- ===================== 4. FLUXO: ENCERRAR → FECHAMENTO → FINANCEIRO =====================
-- Encerra a presença do evento e abre o fechamento operacional.
-- "Trabalhou?" vem pré-preenchido como sim para quem fez check-in; o líder confirma ou ajusta.
CREATE OR REPLACE FUNCTION public.event_finish(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_company_permission(e.company_id, 'operacao.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF e.status NOT IN ('planejamento', 'inscricoes_abertas', 'em_andamento') THEN
    RAISE EXCEPTION 'Evento já encerrado.' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.event_participants ep SET worked = true
  WHERE ep.event_id = _event_id AND ep.status = 'confirmado' AND ep.worked IS NULL
    AND EXISTS (SELECT 1 FROM public.attendance a WHERE a.participant_id = ep.id AND a.kind = 'checkin');
  UPDATE public.events SET status = 'aguardando_fechamento' WHERE id = _event_id;
END $$;

CREATE OR REPLACE FUNCTION public.event_send_to_finance(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; n int;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_company_permission(e.company_id, 'operacao.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF e.status = 'fechado' THEN RAISE EXCEPTION 'Evento já enviado ao financeiro.' USING ERRCODE = 'P0001'; END IF;
  IF e.status <> 'aguardando_fechamento' THEN
    RAISE EXCEPTION 'Encerre o evento antes de enviar ao financeiro.' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = _event_id AND status = 'confirmado' AND worked IS NULL) THEN
    RAISE EXCEPTION 'Valide todos os profissionais confirmados (trabalhou ou não) antes de enviar.' USING ERRCODE = 'P0001'; END IF;
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

REVOKE EXECUTE ON FUNCTION public.event_finish, public.event_send_to_finance FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_finish, public.event_send_to_finance TO authenticated;

-- ===================== 5. STORAGE =====================
INSERT INTO storage.buckets (id, name, public) VALUES ('presence-photos', 'presence-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ===================== 6. CRIAÇÃO ATÔMICA DO EVENTO =====================
-- Cria operação + evento + equipes numa única transação (sem registros órfãos se algo falhar).
-- Tokens de inscrição (por equipe) e de presença (check-in/out) são gerados pelos defaults das tabelas.
CREATE OR REPLACE FUNCTION public.team_name_key(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(translate(btrim(regexp_replace(coalesce(_name, ''), '\s+', ' ', 'g')),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
$$;

CREATE OR REPLACE FUNCTION public.event_create(_company_id uuid, _event jsonb, _teams jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := gen_random_uuid(); v_code text; v_name text; tm jsonb; v_keys text[] := '{}'; v_key text;
BEGIN
  IF _company_id IS NULL OR NOT public.has_company_permission(_company_id, 'operacao.gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para criar eventos nesta empresa.' USING ERRCODE = '42501'; END IF;
  v_code := btrim(coalesce(_event->>'code', ''));
  v_name := regexp_replace(btrim(coalesce(_event->>'name', '')), '\s+', ' ', 'g');
  IF v_code = '' OR v_name = '' OR coalesce(_event->>'event_date', '') = '' THEN
    RAISE EXCEPTION 'Informe código, nome e data do evento.' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE company_id = _company_id AND code = v_code) THEN
    RAISE EXCEPTION 'Já existe um evento com o código %.', v_code USING ERRCODE = 'P0001'; END IF;
  IF jsonb_typeof(_teams) <> 'array' OR jsonb_array_length(_teams) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos uma equipe/função.' USING ERRCODE = 'P0001'; END IF;
  FOR tm IN SELECT * FROM jsonb_array_elements(_teams) LOOP
    v_key := public.team_name_key(tm->>'name');
    IF v_key = '' THEN RAISE EXCEPTION 'Informe o nome de todas as equipes.' USING ERRCODE = 'P0001'; END IF;
    IF v_key = ANY (v_keys) THEN RAISE EXCEPTION 'Equipe duplicada: %.', btrim(tm->>'name') USING ERRCODE = 'P0001'; END IF;
    IF coalesce((tm->>'quantity')::int, 0) <= 0 THEN
      RAISE EXCEPTION 'Informe a quantidade de %.', btrim(tm->>'name') USING ERRCODE = 'P0001'; END IF;
    IF coalesce((tm->>'rate')::numeric, 0) < 0 THEN
      RAISE EXCEPTION 'Valor inválido em %.', btrim(tm->>'name') USING ERRCODE = 'P0001'; END IF;
    v_keys := v_keys || v_key;
  END LOOP;

  INSERT INTO public.operations(id, company_id, type, name) VALUES (v_id, _company_id, 'EVENTO', v_name);
  INSERT INTO public.events(id, company_id, code, name, client_name, cost_center, event_date, start_time, end_time,
    location, address, latitude, longitude, radius_m, manager_name, notes, show_rate)
  VALUES (v_id, _company_id, v_code, v_name,
    nullif(btrim(_event->>'client_name'), ''), nullif(btrim(_event->>'cost_center'), ''),
    (_event->>'event_date')::date, nullif(_event->>'start_time', '')::time, nullif(_event->>'end_time', '')::time,
    nullif(btrim(_event->>'location'), ''), nullif(btrim(_event->>'address'), ''),
    nullif(_event->>'latitude', '')::double precision, nullif(_event->>'longitude', '')::double precision,
    coalesce(nullif(_event->>'radius_m', '')::int, 300), nullif(btrim(_event->>'manager_name'), ''),
    nullif(btrim(_event->>'notes'), ''), coalesce((_event->>'show_rate')::boolean, true));
  INSERT INTO public.event_teams(company_id, event_id, name, quantity, rate, coordinator_name, start_time, end_time)
  SELECT _company_id, v_id, regexp_replace(btrim(x.t->>'name'), '\s+', ' ', 'g'), (x.t->>'quantity')::int,
         coalesce((x.t->>'rate')::numeric, 0), nullif(btrim(x.t->>'coordinator_name'), ''),
         nullif(x.t->>'start_time', '')::time, nullif(x.t->>'end_time', '')::time
  FROM jsonb_array_elements(_teams) AS x(t);
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.event_create FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_create TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_name_key TO authenticated, service_role;
