import { NextResponse } from 'next/server'

// Rota substituída por /api/inscricoes
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Use /api/inscricoes para registrar.' },
    { status: 410 }
  )
}
