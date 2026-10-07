import {
  LayoutDashboard, CalendarDays, Briefcase, Contact, Truck, Wallet, Banknote, FileBarChart, FolderOpen,
  Building2, Users, Target, Tags, Landmark, ShieldCheck, History, type LucideIcon,
} from 'lucide-react'

export interface NavItem { label: string; icon: LucideIcon; href: string; soon?: boolean }
export interface NavSection { title: string; items: NavItem[]; emphasis: 'primary' | 'secondary' | 'tertiary' }

/** Operação em primeiro plano; financeiro e administração recebem o resultado. */
export const NAV: NavSection[] = [
  { title: 'Início', emphasis: 'primary', items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/' }] },
  { title: 'Operação', emphasis: 'primary', items: [
    { label: 'Eventos', icon: CalendarDays, href: '/eventos' },
    { label: 'Pontos Fixos', icon: Briefcase, href: '/em-breve/pontos-fixos', soon: true },
    { label: 'Pessoas / Freelancers', icon: Contact, href: '/em-breve/pessoas', soon: true },
    { label: 'Fornecedores', icon: Truck, href: '/em-breve/fornecedores', soon: true },
  ] },
  { title: 'Financeiro', emphasis: 'secondary', items: [
    { label: 'Contas a Pagar', icon: Wallet, href: '/financeiro/contas-a-pagar' },
    { label: 'Pagamentos', icon: Banknote, href: '/em-breve/pagamentos', soon: true },
  ] },
  { title: 'Gestão', emphasis: 'secondary', items: [
    { label: 'Relatórios', icon: FileBarChart, href: '/em-breve/relatorios', soon: true },
    { label: 'Documentos', icon: FolderOpen, href: '/em-breve/documentos', soon: true },
  ] },
  { title: 'Administração', emphasis: 'tertiary', items: [
    { label: 'Empresas', icon: Building2, href: '/em-breve/empresas', soon: true },
    { label: 'Usuários e Permissões', icon: Users, href: '/em-breve/usuarios', soon: true },
    { label: 'Centros de Custo', icon: Target, href: '/em-breve/centros-de-custo', soon: true },
    { label: 'Categorias', icon: Tags, href: '/em-breve/categorias', soon: true },
    { label: 'Contas Bancárias', icon: Landmark, href: '/em-breve/contas-bancarias', soon: true },
    { label: 'Auditoria', icon: ShieldCheck, href: '/em-breve/auditoria', soon: true },
    { label: 'Sistema anterior (planilha)', icon: History, href: '/gerenciador/eventos' },
  ] },
]

export const SOON: Record<string, { title: string; when: string; text: string }> = {
  'pontos-fixos': { title: 'Pontos Fixos', when: 'Marco 2', text: 'Postos, alocação de profissionais, competência mensal e envio ao financeiro. O banco já está pronto.' },
  pessoas: { title: 'Pessoas / Freelancers', when: 'Marco 2', text: 'Perfil do profissional com dados, eventos, pontos fixos, presença, financeiro e documentos.' },
  fornecedores: { title: 'Fornecedores', when: 'Marco 4', text: 'Cadastro por empresa e lançamentos com origem fornecedor.' },
  pagamentos: { title: 'Pagamentos', when: 'Marco 3', text: 'Aprovação, escolha da conta bancária da empresa, agendamento, baixa e comprovante.' },
  relatorios: { title: 'Relatórios', when: 'Marco 3', text: 'Pagamentos por evento, ponto fixo, competência, empresa e banco (Excel/CSV/PDF).' },
  documentos: { title: 'Documentos', when: 'Marco 4', text: 'Arquivos privados por empresa.' },
  empresas: { title: 'Empresas', when: 'Marco 4', text: 'Já existe no banco (com CNPJ e regra de titular de conta).' },
  usuarios: { title: 'Usuários e Permissões', when: 'Marco 4', text: 'Vínculos por empresa e permissões. Até lá, vínculos são feitos pelo administrador da plataforma.' },
  'centros-de-custo': { title: 'Centros de Custo', when: 'Marco 4', text: 'Hoje o centro de custo é informado no evento e segue para o lançamento.' },
  categorias: { title: 'Categorias', when: 'Marco 4', text: 'Categorias financeiras por empresa.' },
  'contas-bancarias': { title: 'Contas Bancárias', when: 'Marco 3', text: 'Já existe no banco, protegida por empresa (uma conta nunca paga lançamento de outra empresa).' },
  auditoria: { title: 'Auditoria', when: 'Marco 4', text: 'O banco já registra criação, alteração e exclusão; a tela de consulta vem depois.' },
}
