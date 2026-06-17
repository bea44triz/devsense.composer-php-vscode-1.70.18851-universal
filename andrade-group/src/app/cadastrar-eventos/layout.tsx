import { AdminSessionBar } from '@/components/auth/AdminSessionBar'

export default function CadastrarEventosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminSessionBar />
      {children}
    </>
  )
}
