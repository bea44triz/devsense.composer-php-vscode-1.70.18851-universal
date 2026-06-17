import { google } from 'googleapis'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}')
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export async function getSheetsClient() {
  const auth = getAuth()
  return google.sheets({ version: 'v4', auth })
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
  return rows.find((r) => r[2] === cpf) ?? null
}

// ── Eventos ────────────────────────────────────────────────────────────────────

export async function appendEvento(row: string[]) {
  const sheets = await getSheetsClient()
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Eventos!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

export async function getEventos() {
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Eventos!A:L',
  })
  return res.data.values ?? []
}

export async function getEventoById(id: string) {
  const rows = await getEventos()
  return rows.find((r) => r[0] === id) ?? null
}

export async function updateVagasOcupadas(eventoId: string, novoValor: number) {
  const rows = await getEventos()
  const rowIndex = rows.findIndex((r) => r[0] === eventoId)
  if (rowIndex === -1) throw new Error('Evento não encontrado')
  // column H (index 7) = vagasOcupadas, sheet row = rowIndex + 1 (1-based)
  const sheets = await getSheetsClient()
  return sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Eventos!H${rowIndex + 1}`,
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
  return rows.filter((r) => r[1] === eventoId)
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
  return rows.filter((r) => r[1] === eventoId)
}
