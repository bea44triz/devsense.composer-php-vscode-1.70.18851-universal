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

export async function sheetAppend(range: string, row: string[]) {
  const sheets = getSheetsClient()
  return sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

// Writes a row at an explicit row number (bypasses append table-detection).
// RAW mode stores strings exactly as sent, preserving leading zeros in CPF, phone, etc.
async function sheetWriteRow(sheetName: string, lastCol: string, row: string[]) {
  const existing = await sheetGet(`${sheetName}!A:A`)
  const nextRow  = existing.length + 1
  const sheets   = getSheetsClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${nextRow}:${lastCol}${nextRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  })
  return nextRow
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
// Aba: Gerenciadores | id | nome | email | status | criadoEm

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

// ── Eventos ────────────────────────────────────────────────────────────────────
// Aba: Eventos | A:id | B:titulo | C:descricao | D:data | E:horaInicio | F:horaFim |
//               G:local | H:endereco | I:latitude | J:longitude | K:equipes(JSON) |
//               L:valorHora | M:status | N:gerenciadorId | O:criadoEm

export async function getEventos() {
  return sheetGet('Eventos!A:O')
}

export async function getEventoById(id: string) {
  const rows = await getEventos()
  return rows.find(r => r[0] === id) ?? null
}

export async function getEventosByGerenciador(gerenciadorId: string) {
  const rows = await getEventos()
  return rows.filter(r => r[13] === gerenciadorId)
}

export async function appendEvento(row: string[]) {
  return sheetWriteRow('Eventos', 'O', row)
}

// ── Inscrições ─────────────────────────────────────────────────────────────────
// Aba: Inscricoes | A:id | B:eventoId | C:nome | D:cpf | E:telefone | F:email |
//                  G:pixTipo | H:pixChave | I:equipe | J:tipo | K:criadoEm

export async function getInscricoesByEvento(eventoId: string) {
  const rows = await sheetGet('Inscricoes!A:K')
  return rows.filter(r => r[1] === eventoId)
}

export async function getInscricaoByCpfEvento(cpf: string, eventoId: string) {
  const rows = await sheetGet('Inscricoes!A:K')
  // Normalise both sides to digits-only to handle formatting differences
  const cpfDigits = cpf.replace(/\D/g, '')
  return rows.find(r => (r[3]?.replace(/\D/g, '') ?? '') === cpfDigits && r[1] === eventoId) ?? null
}

export async function appendInscricao(row: string[]) {
  // row: [id, eventoId, nome, cpf, telefone, email, pixTipo, pixChave, equipe, tipo, criadoEm]
  // RAW mode in sheetWriteRow preserves leading zeros without any prefix.
  return sheetWriteRow('Inscricoes', 'K', row)
}

// ── Check-in / Check-out ───────────────────────────────────────────────────────
// Aba: CheckInOut | A:id | B:eventoId | C:cpf | D:nome | E:equipe | F:tipo |
//                  G:tipoRegistro | H:latitude | I:longitude | J:accuracy | K:timestamp

export async function appendCheckInOut(row: string[]) {
  // row: [id, eventoId, cpf, nome, equipe, tipo, tipoRegistro, localRegistro, lat, lon, accuracy, timestamp]
  // RAW mode in sheetWriteRow preserves leading zeros without any prefix.
  return sheetWriteRow('CheckInOut', 'L', row)
}

export async function getCheckInOutByEvento(eventoId: string) {
  const rows = await sheetGet('CheckInOut!A:L')
  return rows.filter(r => r[1] === eventoId)
}
