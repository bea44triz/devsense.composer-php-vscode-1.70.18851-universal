export interface Freelancer {
  id: string
  nome: string
  cpf: string
  telefone: string
  email: string
  documentoUrl?: string
  dataCadastro: string
  status: 'ativo' | 'inativo' | 'pendente'
}

export interface Evento {
  id: string
  titulo: string
  descricao: string
  data: string
  horaInicio: string
  horaFim: string
  local: string
  endereco: string
  vagasTotal: number
  vagasOcupadas: number
  valorHora: number
  status: 'aberto' | 'fechado' | 'cancelado'
  createdAt: string
}

export interface Inscricao {
  id: string
  eventoId: string
  freelancerId: string
  freelancerNome: string
  status: 'confirmado' | 'lista_espera' | 'cancelado'
  posicaoListaEspera?: number
  createdAt: string
}

export interface CheckInOut {
  id: string
  eventoId: string
  freelancerId: string
  freelancerNome: string
  tipo: 'checkin' | 'checkout'
  latitude: number
  longitude: number
  fotoUrl?: string
  timestamp: string
  validado: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
