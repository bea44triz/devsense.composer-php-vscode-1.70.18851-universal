export type EquipeNome = 'brigadistas' | 'segurancas' | 'limpeza'
export type TipoVaga  = 'coordenador' | 'freelancer'

export interface EquipeVaga {
  equipe:         EquipeNome
  tipo:           TipoVaga
  vagas:          number
  vagasOcupadas:  number
  valorDiaria?:   number
}

export interface Evento {
  id:           string
  titulo:       string
  descricao:    string
  data:         string
  horaInicio:   string
  horaFim:      string
  local:        string
  endereco:     string
  latitude?:    number
  longitude?:   number
  equipes:      EquipeVaga[]
  valorHora:    number
  status:       'aberto' | 'fechado' | 'cancelado'
  gerenciadorId: string
  createdAt:    string
}

export interface Inscricao {
  id:        string
  eventoId:  string
  nome:      string
  cpf:       string
  telefone:  string
  email:     string
  pixTipo:   string
  pixChave:  string
  equipe:    EquipeNome
  tipo:      TipoVaga
  criadoEm:  string
}

export interface CheckInOut {
  id:            string
  eventoId:      string
  cpf:           string
  nome:          string
  equipe:        string
  tipo:          string
  tipoRegistro:  'checkin' | 'checkout'
  latitude:      number
  longitude:     number
  accuracy?:     number
  timestamp:     string
}

export interface ApiResponse<T> {
  success:  boolean
  data?:    T
  error?:   string
  message?: string
}
