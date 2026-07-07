import { NextResponse } from 'next/server'

// Rota substituída por /api/inscricoes com vínculo a evento e equipe
export async function GET() {
  return NextResponse.json({ success: true, data: [] })
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Use /api/inscricoes para registrar.' },
    { status: 410 }
  )
}
