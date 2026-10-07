-- Checagens estáticas de segurança (equivalente local aos advisors do Supabase). Somente leitura.
CREATE TEMP TABLE r (test text, expected text, got text, pass boolean);

INSERT INTO r SELECT 'K1 todas as tabelas de public com RLS ativo', 'nenhuma sem RLS', coalesce(string_agg(c.relname, ', '), 'nenhuma sem RLS'), count(*) = 0
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

INSERT INTO r SELECT 'K2 anon sem nenhum privilégio em tabelas de public', 'nenhum', coalesce(string_agg(DISTINCT table_name || ':' || privilege_type, ', '), 'nenhum'), count(*) = 0
FROM information_schema.role_table_grants WHERE grantee = 'anon' AND table_schema = 'public';

INSERT INTO r SELECT 'K3 authenticated sem TRUNCATE/TRIGGER/REFERENCES', 'nenhum', coalesce(string_agg(DISTINCT table_name || ':' || privilege_type, ', '), 'nenhum'), count(*) = 0
FROM information_schema.role_table_grants WHERE grantee = 'authenticated' AND table_schema = 'public' AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES');

INSERT INTO r SELECT 'K4 toda função SECURITY DEFINER com search_path fixo', 'todas', coalesce(string_agg(p.proname, ', '), 'todas'), count(*) = 0
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%');

INSERT INTO r SELECT 'K5 anon executa só as 5 RPCs públicas dos links', 'public_invite_info, public_invite_lookup, public_invite_register, public_presence_info, public_presence_lookup',
  string_agg(p.proname, ', ' ORDER BY p.proname),
  string_agg(p.proname, ', ' ORDER BY p.proname) = 'public_invite_info, public_invite_lookup, public_invite_register, public_presence_info, public_presence_lookup'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE');

INSERT INTO r SELECT 'K6 funções exclusivas do servidor fora do alcance de authenticated', 'nenhuma',
  coalesce(string_agg(p.proname, ', '), 'nenhuma'), count(*) = 0
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('record_presence', 'presence_photo_folder', 'presence_photo_company', 'public_link_check', 'link_log', 'link_rate_limited', 'request_ip', 'handle_new_user')
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

INSERT INTO r SELECT 'K7 chave PIX completa não legível por SELECT', 'negado',
  CASE WHEN has_column_privilege('authenticated', 'public.people', 'pix_key', 'SELECT') OR has_column_privilege('authenticated', 'public.fornecedores', 'pix_key', 'SELECT') THEN 'permitido' ELSE 'negado' END,
  NOT (has_column_privilege('authenticated', 'public.people', 'pix_key', 'SELECT') OR has_column_privilege('authenticated', 'public.fornecedores', 'pix_key', 'SELECT'));

INSERT INTO r SELECT 'K8 nenhuma política RLS para anon/public', 'nenhuma', coalesce(string_agg(tablename || '.' || policyname, ', '), 'nenhuma'), count(*) = 0
FROM pg_policies WHERE schemaname = 'public' AND (roles && ARRAY['anon', 'public']::name[]);

INSERT INTO r SELECT 'K9 bucket de fotos existe e é privado', 'privado', coalesce(max(CASE WHEN public THEN 'PÚBLICO' ELSE 'privado' END), 'inexistente'),
  count(*) = 1 AND NOT bool_or(public) FROM storage.buckets WHERE id = 'presence-photos';

INSERT INTO r SELECT 'K10 nenhuma política de leitura pública no Storage', 'nenhuma', coalesce(string_agg(policyname, ', '), 'nenhuma'), count(*) = 0
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND (roles && ARRAY['anon', 'public']::name[]);

INSERT INTO r SELECT 'K11 Super Admin não é concedido automaticamente no cadastro', 'sem regra de 1º usuário',
  CASE WHEN prosrc ILIKE '%platform_admins%' THEN 'ainda concede' ELSE 'sem regra de 1º usuário' END, prosrc NOT ILIKE '%platform_admins%'
FROM pg_proc WHERE proname = 'handle_new_user';

SELECT CASE WHEN pass THEN 'PASSOU' ELSE 'FALHOU' END AS resultado, test, expected, left(got, 160) AS obtido FROM r;
