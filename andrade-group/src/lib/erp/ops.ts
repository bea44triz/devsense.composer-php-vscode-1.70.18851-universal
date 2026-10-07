// Regras e rótulos do módulo operacional (Eventos / Pontos Fixos). Portado do projeto Lovable (src/lib/ops.ts).

export type EventStatus = "planejamento" | "inscricoes_abertas" | "em_andamento" | "aguardando_fechamento" | "fechado" | "cancelado";
export type ParticipantStatus = "inscrito" | "aguardando" | "confirmado" | "lista_espera" | "recusado" | "cancelado";
export type DisplayEventStatus =
  | "Planejamento" | "Inscrições abertas" | "Equipe incompleta" | "Pronto"
  | "Em andamento" | "Encerrado" | "Em fechamento" | "Fechado" | "Cancelado";

export const PARTICIPANT_LABEL: Record<ParticipantStatus, string> = {
  inscrito: "Inscrito",
  aguardando: "Aguardando confirmação",
  confirmado: "Confirmado",
  lista_espera: "Lista de espera",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

export const TEAM_SUGGESTIONS = [
  "Segurança", "Recepção", "Promotores", "Limpeza", "Coordenadores", "Apoio", "Produção",
  "Brigadistas", "Motoristas", "Montagem", "Fotografia", "Libras", "Outros",
];

export interface TeamCounts { quantity: number; confirmed: number }

/** Status exibido do evento combinando status gravado, data e preenchimento das equipes. */
export function displayEventStatus(
  status: EventStatus,
  eventDate: string,
  teams: TeamCounts[],
  today: string = todayISO(),
): DisplayEventStatus {
  if (status === "cancelado") return "Cancelado";
  if (status === "fechado") return "Fechado";
  if (status === "aguardando_fechamento") return "Em fechamento";
  if (status === "em_andamento") return eventDate < today ? "Encerrado" : "Em andamento";
  if (eventDate < today) return "Encerrado";
  if (status === "planejamento") return "Planejamento";
  if (teams.length === 0) return "Planejamento";
  const complete = teams.every((t) => t.confirmed >= t.quantity);
  if (complete) return "Pronto";
  if (eventDate === today) return "Equipe incompleta";
  return "Inscrições abertas";
}

export function statusTone(s: DisplayEventStatus): "muted" | "info" | "warning" | "success" | "danger" {
  switch (s) {
    case "Pronto": case "Fechado": return "success";
    case "Equipe incompleta": case "Em fechamento": case "Encerrado": return "warning";
    case "Em andamento": case "Inscrições abertas": return "info";
    case "Cancelado": return "danger";
    default: return "muted";
  }
}

/** Valor final de um profissional do evento (espelha a coluna gerada no banco). */
export function participantFinal(p: { worked: boolean | null; days: number; rate: number; addition: number; discount: number }): number {
  if (!p.worked) return 0;
  return Math.round((p.days * p.rate + p.addition - p.discount) * 100) / 100;
}

/** Valor final de um item de competência do Ponto Fixo (espelha a coluna gerada). */
export function periodItemFinal(i: { base_amount: number; addition: number; discount: number }): number {
  return Math.round((i.base_amount + i.addition - i.discount) * 100) / 100;
}

export function brl(v: number | string | null | undefined): string {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function fmtTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

export function fmtCompetence(d: string): string {
  const [y, m] = d.split("-");
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${months[Number(m) - 1]}/${y}`;
}

export function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const MONTHS_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "2026-10-15" → { day: "15", month: "OUT", weekday: "qui" } para o bloco de data dos cards. */
export function dateParts(d: string): { day: string; month: string; weekday: string } {
  const [y, m, day] = d.slice(0, 10).split("-");
  const wd = new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return { day: day ?? "", month: MONTHS_SHORT[Number(m) - 1] ?? "", weekday: wd };
}

/** Ocupação 0–100 para barras de progresso (nunca passa de 100). */
export function pct(part: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0;
}

export function todayISO(now: Date = new Date()): string {
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60000).toISOString().slice(0, 10);
}
