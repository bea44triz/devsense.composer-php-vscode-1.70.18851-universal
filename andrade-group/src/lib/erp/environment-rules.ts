// Portado do projeto Lovable (src/lib/environment-rules.ts) — regras puras do ambiente (empresa/consolidado).
export type Permission =
  | "empresa.admin" | "usuarios.gerenciar"
  | "bancos.ver" | "bancos.gerenciar" | "bancos.aceitar_divergencia"
  | "financeiro.ver" | "financeiro.gerenciar"
  | "operacao.ver" | "operacao.gerenciar"
  | "consolidado.ver" | "auditoria.ver";

export const PERMISSION_LABELS: Record<Permission, string> = {
  "empresa.admin": "Administrador da empresa",
  "usuarios.gerenciar": "Gerenciar usuários",
  "bancos.ver": "Ver contas bancárias",
  "bancos.gerenciar": "Gerenciar contas bancárias",
  "bancos.aceitar_divergencia": "Aceitar titular divergente",
  "financeiro.ver": "Ver financeiro",
  "financeiro.gerenciar": "Gerenciar financeiro",
  "operacao.ver": "Ver operação",
  "operacao.gerenciar": "Gerenciar operação",
  "consolidado.ver": "Ver consolidado",
  "auditoria.ver": "Ver auditoria",
};

export interface CompanyCtx {
  company_id: string;
  name: string;
  color: string | null;
  permissions: Permission[];
}

export type Environment = { mode: "company"; companyId: string } | { mode: "consolidated" };

export function hasPerm(c: CompanyCtx | undefined, p: Permission): boolean {
  if (!c) return false;
  return c.permissions.includes("empresa.admin") || c.permissions.includes(p);
}

/** Consolidado exige vínculo com todas as empresas do grupo (>=2) e consolidado.ver em cada uma. */
export function canSeeConsolidated(companies: CompanyCtx[], groupCompanyCount: number): boolean {
  return (
    groupCompanyCount >= 2 &&
    companies.length === groupCompanyCount &&
    companies.every((c) => c.permissions.includes("consolidado.ver"))
  );
}

/** Gravação só é possível com uma empresa concreta selecionada. */
export function canWrite(env: Environment | null): env is { mode: "company"; companyId: string } {
  return env?.mode === "company";
}

export function envColorVar(color: string | null | undefined, consolidated = false): string {
  if (consolidated) return "var(--env-consolidated)";
  if (color === "andrade" || color === "e061" || color === "mktg") return `var(--env-${color})`;
  return "var(--env-default)";
}
