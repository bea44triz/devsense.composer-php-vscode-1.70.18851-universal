import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isValidCpf, onlyDigits } from '@/lib/utils'

// Registro público de check-in/check-out (portado da server fn do Lovable).
// O navegador nunca recebe o service_role: este handler
//  1. valida a entrada e aplica o limite de tentativas (public_link_check, com o IP real do visitante),
//  2. guarda a foto no bucket privado `presence-photos` em <empresa>/<evento>/<arquivo>.jpg,
//  3. chama `record_presence`, que só o service_role executa e que refaz todas as regras no banco.
const MAX_PHOTO = 3_000_000
const PREFIX = 'data:image/jpeg;base64,'

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'GestaoOperacional/1.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
    if (!r.ok) return null
    const j = await r.json()
    return typeof j?.display_name === 'string' ? j.display_name : null
  } catch {
    return null
  }
}

const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null)

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Requisição inválida.' }, { status: 400 }) }

  const token = typeof body.token === 'string' ? body.token : ''
  const cpf = onlyDigits(body.cpf)
  const photo = typeof body.photo === 'string' ? body.photo : ''
  const lat = num(body.lat, -90, 90)
  const lng = num(body.lng, -180, 180)
  const accuracy = num(body.accuracy, 0, 100_000)

  if (!/^[a-f0-9]{16,64}$/.test(token)) return NextResponse.json({ ok: false, error: 'Link inválido.' }, { status: 400 })
  if (!isValidCpf(cpf)) return NextResponse.json({ ok: false, error: 'CPF inválido.' }, { status: 422 })
  if (!photo.startsWith(PREFIX) || photo.length > MAX_PHOTO) return NextResponse.json({ ok: false, error: 'Foto inválida. Tire a foto novamente.' }, { status: 422 })
  if (lat === null || lng === null) return NextResponse.json({ ok: false, error: 'Localização obrigatória. Ative o GPS.' }, { status: 422 })

  let admin: ReturnType<typeof getSupabaseAdmin>
  try { admin = getSupabaseAdmin() } catch {
    return NextResponse.json({ ok: false, error: 'Registro de presença indisponível no momento.' }, { status: 503 })
  }

  // IP do visitante (o primeiro da cadeia do proxy/CDN); vai para o limite de tentativas e para a auditoria
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'desconhecido').trim().slice(0, 64)
  const { data: allowed, error: limitErr } = await admin.rpc('public_link_check', { _kind: 'presenca', _token: token, _cpf: cpf, _ip: ip })
  if (limitErr) return NextResponse.json({ ok: false, error: 'Registro de presença indisponível no momento.' }, { status: 503 })
  if (!allowed) return NextResponse.json({ ok: false, error: 'Muitas tentativas a partir desta conexão. Aguarde alguns minutos.' }, { status: 429 })

  const { data: folder } = await admin.rpc('presence_photo_folder', { _token: token })
  if (!folder) return NextResponse.json({ ok: false, error: 'Link inválido.' }, { status: 404 })

  const bytes = Buffer.from(photo.slice(PREFIX.length), 'base64')
  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const up = await admin.storage.from('presence-photos').upload(path, bytes, { contentType: 'image/jpeg' })
  if (up.error) {
    console.error('[presenca] upload', up.error.message)
    return NextResponse.json({ ok: false, error: 'Não foi possível salvar a foto. Tente novamente.' }, { status: 502 })
  }

  const address = await reverseGeocode(lat, lng)
  const { data, error } = await admin.rpc('record_presence', {
    _token: token, _cpf: cpf, _lat: lat, _lng: lng,
    _accuracy: accuracy as number, _address: address as string, _photo_path: path, _client_ip: ip,
  })
  if (error) {
    await admin.storage.from('presence-photos').remove([path])
    // mensagens de regra de negócio do banco (P0001) são seguras para mostrar
    return NextResponse.json({ ok: false, error: error.code === 'P0001' ? error.message : 'Não foi possível registrar.' }, { status: 409 })
  }
  return NextResponse.json({ ok: true, result: { ...(data as object), address } })
}
