/**
 * Google Sheets client — always uses the app's Service Account.
 *
 * The service account email must have Editor access to the spreadsheet.
 * Individual managers authenticate via Google OAuth (for identity only);
 * their personal Google tokens are never used to access the sheet.
 */
import { google } from 'googleapis'

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID!

function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}')
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

// ── Generic helpers ────────────────────────────────────────────────────────────

export async function sheetAppend(range: string, row: string[]) {
  const sheets = getSheetsClient()
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

export async function sheetGet(range: string): Promise<string[][]> {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range })
  return (res.data.values ?? []) as string[][]
}

export async function sheetUpdate(range: string, value: string | number) {
  const sheets = getSheetsClient()
  return sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })
}

// ── Gerenciadores ──────────────────────────────────────────────────────────────
// Aba: Gerenciadores | Colunas: id | nome | email | status | criadoEm

export async function getGerenciadores() {
  return sheetGet('Gerenciadores!A:E')
}

export async function getGerenciadorByEmail(email: string) {
  const rows = await getGerenciadores()
  return rows.find(r => r[2]?.toLowerCase() === email.toLowerCase()) ?? null
}

export async function appendGerenciador(row: string[]) {
  return sheetAppend('Gerenciadores!A:E', row)
}

// ── Freelancers ────────────────────────────────────────────────────────────────
// Aba: Freelancers | Colunas: id | nome | cpf | telefone | email | pix | documentoUrl | criadoEm | status

export async function getFreelancers() {
  return sheetGet('Freelancers!A:I')
}

export async function getFreelancerByCpf(cpf: string) {
  const rows = await getFreelancers()
  return rows.find(r => r[2] === cpf) ?? null
}

export async function appendFreelancer(row: string[]) {
  return sheetAppend('Freelancers!A:I', row)
}

// ── Eventos ────────────────────────────────────────────────────────────────────
// Aba: Eventos | Colunas: id | titulo | descricao | data | horaInicio | horaFim |
//               local | endereco | vagasTotal | vagasOcupadas | valorHora | status | gerenciadorId | criadoEm

export async function getEventos() {
  return sheetGet('Eventos!A:N')
}

export async function getEventoById(id: string) {
  const rows = await getEventos()
  return rows.find(r => r[0] === id) ?? null
}

export async function appendEvento(row: string[]) {
  return sheetAppend('Eventos!A:N', row)
}

export async function updateVagasOcupadas(eventoId: string, novoValor: number) {
  const rows = await getEventos()
  const idx  = rows.findIndex(r => r[0] === eventoId)
  if (idx === -1) throw new Error('Evento não encontrado')
  return sheetUpdate(`Eventos!J${idx + 1}`, novoValor)
}

// ── Inscrições ─────────────────────────────────────────────────────────────────

export async function getInscricoesByEvento(eventoId: string) {
  const rows = await sheetGet('Inscricoes!A:H')
  return rows.filter(r => r[1] === eventoId)
}

export async function appendInscricao(row: string[]) {
  return sheetAppend('Inscricoes!A:H', row)
}

// ── Check-in / Check-out ───────────────────────────────────────────────────────

export async function appendCheckInOut(row: string[]) {
  return sheetAppend('CheckInOut!A:J', row)
}

export async function getCheckInOutByEvento(eventoId: string) {
  const rows = await sheetGet('CheckInOut!A:J')
  return rows.filter(r => r[1] === eventoId)
}
