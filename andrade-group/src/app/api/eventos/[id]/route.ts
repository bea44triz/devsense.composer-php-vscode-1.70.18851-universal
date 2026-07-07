import { NextRequest, NextResponse } from 'next/server'
import { getEventoById } from '@/lib/google-sheets'
import { rowToEvento } from '@/app/api/eventos/route'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const row = await getEventoById(id)
    if (!row) return NextResponse.json({ success: false, error: 'Evento não encontrado.' }, { status: 404 })
    return NextResponse.json({ success: true, data: rowToEvento(row) })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao buscar evento.' }, { status: 500 })
  }
}
