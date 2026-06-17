import { google } from 'googleapis'
import { auth } from '@/auth'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!

/**
 * Builds a Sheets client authenticated with the current admin session's
 * OAuth access_token.  Falls back to a service account if GOOGLE_SERVICE_ACCOUNT_JSON
 * is configured (useful for background jobs or read-only public API routes).
 */
async function getSheetsClient() {
  // Try OAuth token from admin session first
  const session = await auth()
  if (session?.access_token) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2.setCredentials({ access_token: session.access_token })
    return google.sheets({ version: 'v4', auth: oauth2 })
  }

  // Fallback: service account (for server-side data reads that don't need admin context)
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (saJson) {
    const credentials = JSON.parse(saJson)
    const saAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    return google.sheets({ version: 'v4', auth: saAuth })
  }

  throw new Error(
    'No Google auth available: admin must be logged in, or GOOGLE_SERVICE_ACCOUNT_JSON must be set.'
  )
}

// ── Freelancers ────────────────────────────────────────────────────────────────

export async function appendFreelancer(row: string[]) {
  const sheets = await getSheetsClient()
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Freelancers!A:I',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

export async function getFreelancers() {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Freelancers!A:I',
  })
  return res.data.values ?? []
}

export async function getFreelancerByCpf(cpf: string) {
  const rows = await getFreelancers()
  return rows.find(r => r[2] === cpf) ?? null
}

// ── Eventos ────────────────────────────────────────────────────────────────────

export async function appendEvento(row: string[]) {
  const sheets = await getSheetsClient()
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Eventos!A:M',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

export async function getEventos() {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Eventos!A:M',
  })
  return res.data.values ?? []
}

export async function getEventoById(id: string) {
  const rows = await getEventos()
  return rows.find(r => r[0] === id) ?? null
}

export async function updateVagasOcupadas(eventoId: string, novoValor: number) {
  const rows = await getEventos()
  const idx  = rows.findIndex(r => r[0] === eventoId)
  if (idx === -1) throw new Error('Evento não encontrado')
  const sheets = await getSheetsClient()
  return sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Eventos!H${idx + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[novoValor]] },
  })
}

// ── Inscrições ─────────────────────────────────────────────────────────────────

export async function appendInscricao(row: string[]) {
  const sheets = await getSheetsClient()
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Inscricoes!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

export async function getInscricoesByEvento(eventoId: string) {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Inscricoes!A:H',
  })
  const rows = res.data.values ?? []
  return rows.filter(r => r[1] === eventoId)
}

// ── Check-in / Check-out ───────────────────────────────────────────────────────

export async function appendCheckInOut(row: string[]) {
  const sheets = await getSheetsClient()
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'CheckInOut!A:J',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

export async function getCheckInOutByEvento(eventoId: string) {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'CheckInOut!A:J',
  })
  const rows = res.data.values ?? []
  return rows.filter(r => r[1] === eventoId)
}
