import 'next-auth'

declare module 'next-auth' {
  interface Session {
    managerId:     string
    managerStatus: string   // 'ativo' | 'pendente' | 'suspenso'
  }
}
