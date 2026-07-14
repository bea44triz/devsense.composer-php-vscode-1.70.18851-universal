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
    case 'telefone':  return isValidPhone(v)
    case 'email':     return isValidEmail(v)
    case 'aleatoria': return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    default:          return v.length > 0
  }
}

/** Returns true when the string has at least two words (nome + sobrenome) */
export function hasFullName(nome: string): boolean {
  return nome.trim().split(/\s+/).filter(Boolean).length >= 2
}
