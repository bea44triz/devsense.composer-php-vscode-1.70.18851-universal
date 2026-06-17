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
