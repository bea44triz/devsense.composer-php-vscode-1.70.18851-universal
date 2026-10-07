import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatCpf(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .slice(0, 14)
}

export function formatPhone(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
    .slice(0, 15)
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(isoDate))
}

export function vagasDisponiveis(total: number, ocupadas: number) {
  return Math.max(0, total - ocupadas)
}

// ── Validation ─────────────────────────────────────────────────────────────────

/** Strip non-digits from CPF/phone strings. Always returns a string (never a number). */
export function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

/** Numeric value of the digit at position i (avoids Number()/parseInt on the document). */
function digitAt(d: string, i: number): number {
  return d.charCodeAt(i) - 48
}

/** Returns true for structurally and algorithmically valid CPFs */
export function isValidCpf(cpf: string): boolean {
  const d = onlyDigits(cpf)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false  // all same digits (e.g. 111.111.111-11)

  let sum = 0
  for (let i = 0; i < 9; i++) sum += digitAt(d, i) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  if (rem !== digitAt(d, 9)) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += digitAt(d, i) * (11 - i)
  rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  return rem === digitAt(d, 10)
}

/** Returns true for structurally and algorithmically valid CNPJs */
export function isValidCnpj(cnpj: string): boolean {
  const d = onlyDigits(cnpj)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false  // all same digits

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) sum += digitAt(d, i) * w1[i]
  let rem = sum % 11
  if (rem < 2) rem = 0; else rem = 11 - rem
  if (rem !== digitAt(d, 12)) return false

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) sum += digitAt(d, i) * w2[i]
  rem = sum % 11
  if (rem < 2) rem = 0; else rem = 11 - rem
  return rem === digitAt(d, 13)
}

/** DDD (2 digits, no zero) + 8 digits (fixo) or 9 digits starting with 9 (celular) */
export function isValidPhone(phone: string): boolean {
  return /^[1-9]{2}(?:9\d{8}|[2-8]\d{7})$/.test(onlyDigits(phone))
}

/** Celular: DDD (2 digits, no zero) + 9 digits starting with 9 = 11 total */
export function isValidCelular(phone: string): boolean {
  return /^[1-9]{2}9\d{8}$/.test(onlyDigits(phone))
}

/** Basic e-mail format check */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export const PIX_TIPOS_VALIDOS = ['cpf', 'cnpj', 'celular', 'email', 'aleatoria'] as const
export type PixTipo = typeof PIX_TIPOS_VALIDOS[number]

export function isPixTipo(tipo: unknown): tipo is PixTipo {
  return typeof tipo === 'string' && (PIX_TIPOS_VALIDOS as readonly string[]).includes(tipo)
}

/** PIX key validation per type. Unknown types are rejected. */
export function isValidPixKey(chave: string, tipo: string): boolean {
  const v = String(chave ?? '').trim()
  if (!v) return false
  switch (tipo) {
    case 'cpf':       return isValidCpf(v)
    case 'cnpj':      return isValidCnpj(v)
    case 'celular':   return isValidCelular(v)
    case 'email':     return isValidEmail(v)
    case 'aleatoria': return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    default:          return false
  }
}

/**
 * Normalize a PIX key for storage: digits-only for numeric types,
 * lowercase+trim for email/UUID.
 */
export function normalizePixKey(chave: string, tipo: string): string {
  switch (tipo) {
    case 'cpf':
    case 'cnpj':
    case 'celular':   return onlyDigits(chave)
    case 'email':     return chave.trim().toLowerCase()
    case 'aleatoria': return chave.trim().toLowerCase()
    default:          return String(chave ?? '').trim()
  }
}

/** Trim and collapse internal whitespace, keeping accents/case (display label). */
export function normalizeLabel(label: string): string {
  return String(label ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Convert a display label into a URL-safe slug for use as an equipe key.
 * "  Recepção  VIP " -> "recepcao_vip". Returns '' when nothing usable remains.
 */
export function makeSlug(label: string): string {
  return normalizeLabel(label)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ── Inscrições: status ──────────────────────────────────────────────────────────
// Coluna L (status) da aba Inscricoes. Linhas antigas não têm status → contam como ativas.
// Um cancelamento futuro só precisa gravar 'cancelada' nessa coluna.
export const STATUS_INSCRICAO_ATIVOS = ['', 'ativa', 'confirmada'] as const

export function isInscricaoAtiva(status: string | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  return (STATUS_INSCRICAO_ATIVOS as readonly string[]).includes(s)
}

/** Returns true when the string has at least two words (nome + sobrenome) */
export function hasFullName(nome: string): boolean {
  return nome.trim().split(/\s+/).filter(Boolean).length >= 2
}
