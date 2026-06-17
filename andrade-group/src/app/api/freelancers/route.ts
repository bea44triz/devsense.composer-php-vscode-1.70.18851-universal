import { NextRequest, NextResponse } from 'next/server'
import { appendFreelancer, getFreelancers, getFreelancerByCpf } from '@/lib/google-sheets'
import { generateId } from '@/lib/utils'

export async function GET() {
  try {
    const rows = await getFreelancers()
    const freelancers = rows.slice(1).map((r) => ({
      id: r[0], nome: r[1], cpf: r[2], telefone: r[3],
      email: r[4], pix: r[5], documentoUrl: r[6],
      dataCadastro: r[7], status: r[8],
    }))
    return NextResponse.json({ success: true, data: freelancers })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro ao buscar freelancers.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const nome = formData.get('nome') as string
    const cpf = formData.get('cpf') as string
    const telefone = formData.get('telefone') as string
    const email = formData.get('email') as string
    const pix = formData.get('pix') as string
    const documento = formData.get('documento') as File | null

    if (!nome || !cpf || !telefone || !email || !pix) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    const existente = await getFreelancerByCpf(cpf)
    if (existente) {
      return NextResponse.json({ success: false, error: 'CPF já cadastrado.' }, { status: 409 })
    }

    // Em produção: fazer upload do documento no Google Drive ou S3 e salvar a URL
    const documentoUrl = documento ? `pendente:${documento.name}` : ''

    const id = generateId()
    const row = [id, nome, cpf, telefone, email, pix, documentoUrl, new Date().toISOString(), 'pendente']
    await appendFreelancer(row)

    return NextResponse.json({ success: true, data: { id, nome, status: 'pendente' } }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ success: false, error: 'Erro interno ao cadastrar.' }, { status: 500 })
  }
}
