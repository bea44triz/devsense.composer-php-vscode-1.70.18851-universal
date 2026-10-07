// Portado do projeto Lovable (src/lib/tenant.ts). Inclui *.vercel.app como host de preview.
// Identificação do tenant esperado a partir do endereço acessado.
// Domínios de produção (ex.: andrade.erp.com.br) identificam o tenant;
// em ambientes de desenvolvimento/preview usa-se ?tenant=<slug>.
// O banco sempre confirma se o usuário tem acesso (resolve_tenant).

const DEV_HOST_PATTERNS = [/localhost/, /127\.0\.0\.1/, /\.vercel\.app$/, /\.lovable\.app$/, /\.lovableproject\.com$/, /\.lovable\.dev$/];

export function isDevHost(host: string): boolean {
  return DEV_HOST_PATTERNS.some((p) => p.test(host));
}

export type TenantHint = { kind: "domain"; host: string } | { kind: "slug"; slug: string } | { kind: "none" };

export function readTenantHint(host: string, search: string, stored: string | null): TenantHint {
  if (!isDevHost(host)) return { kind: "domain", host: host.toLowerCase() };
  const slug = new URLSearchParams(search).get("tenant") ?? stored;
  return slug ? { kind: "slug", slug } : { kind: "none" };
}

export const TENANT_STORAGE_KEY = "erp.tenant";
export const ENV_STORAGE_KEY = "erp.env";
