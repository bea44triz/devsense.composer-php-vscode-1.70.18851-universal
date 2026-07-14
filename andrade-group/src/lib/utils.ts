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

/** Strip non-digits from CPF/phone strings */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Returns true for structurally and algorithmically valid CPFs */
export function isValidCpf(cpf: string): boolean {
  const d = onlyDigits(cpf)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false  // all same digits (e.g. 111.111.111-11)

  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  if (rem !== Number(d[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i)
  rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  return rem === Number(d[10])
}

/** Returns true for structurally and algorithmically valid CNPJs */
export function isValidCnpj(cnpj: string): boolean {
  const d = onlyDigits(cnpj)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false  // all same digits

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * w1[i]
  let rem = sum % 11
  if (rem < 2) rem = 0; else rem = 11 - rem
  if (rem !== Number(d[12])) return false

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) sum += Number(d[i]) * w2[i]
  rem = sum % 11
  if (rem < 2) rem = 0; else rem = 11 - rem
  return rem === Number(d[13])
}

/** DDD (2 digits) + 8 or 9 digits = 10 or 11 total */
export function isValidPhone(phone: string): boolean {
  const d = onlyDigits(phone)
  return d.length === 10 || d.length === 11
}

/** Basic e-mail format check */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

/** PIX key validation per type */
export function isValidPixKey(chave: string, tipo: string): boolean {
  const v = chave.trim()
  if (!v) return false
  switch (tipo) {
    case 'cpf':       return isValidCpf(v)
    case 'cnpj':      return isValidCnpj(v)
    case 'celular': {
      const d = onlyDigits(v)
      return d.length === 11  // DDD (2) + 9 digits
    }
    case 'email':     return isValidEmail(v)
    case 'aleatoria': return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    default:          return v.length > 0
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
    default:          return chave.trim()
  }
}

/**
 * Convert a display label into a URL-safe slug for use as an equipe key.
 * Uses explicit \u escapes to avoid file-encoding ambiguity in the regex.
 */
export function makeSlug(label: string): string {
  return label
    .normalize('NFD')
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/** Returns true when the string has at least two words (nome + sobrenome) */
export function hasFullName(nome: string): boolean {
  return nome.trim().split(/\s+/).filter(Boolean).length >= 2
}
