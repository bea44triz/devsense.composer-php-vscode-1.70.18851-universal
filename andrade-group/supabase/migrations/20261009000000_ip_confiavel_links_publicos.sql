-- Marco 3 — correção do risco de IP falsificável no limite de tentativas dos links públicos.
-- Antes: request_ip() usava o 1º item de X-Forwarded-For — exatamente o valor que o PRÓPRIO visitante pode mandar.
-- Agora: usa o ÚLTIMO item da lista, isto é, o IP que o proxy confiável (Kong, na frente do PostgREST) anexou ao
-- receber a conexão — item que o visitante não controla. Mesma lógica no app (src/app/api/presenca/route.ts).
-- Pressuposto: há exatamente 1 proxy confiável na frente (o gateway do Supabase). Se o ambiente final tiver mais
-- proxies confiáveis em cadeia, ajustar a contagem aqui (ver docs/STAGING.md).
CREATE OR REPLACE FUNCTION public.request_ip(_override text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE h json; claims json; v_xff text; v_parts text[];
BEGIN
  BEGIN claims := nullif(current_setting('request.jwt.claims', true), '')::json; EXCEPTION WHEN OTHERS THEN claims := NULL; END;
  IF _override IS NOT NULL AND claims->>'role' = 'service_role' THEN RETURN left(_override, 64); END IF;
  BEGIN h := nullif(current_setting('request.headers', true), '')::json; EXCEPTION WHEN OTHERS THEN h := NULL; END;
  v_xff := h->>'x-forwarded-for';
  IF v_xff IS NOT NULL THEN
    v_parts := regexp_split_to_array(v_xff, '\s*,\s*');
    v_xff := nullif(btrim(v_parts[array_upper(v_parts, 1)]), '');  -- último item: anexado pelo proxy confiável, não pelo visitante
  END IF;
  RETURN left(coalesce(v_xff, h->>'cf-connecting-ip', h->>'x-real-ip', 'desconhecido'), 64);
END $$;
