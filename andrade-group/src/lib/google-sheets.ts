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
  return sheetAppend('Eventos!A:O', row)
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
  return rows.find(r => r[3] === cpf && r[1] === eventoId) ?? null
}

export async function appendInscricao(row: string[]) {
  return sheetAppend('Inscricoes!A:K', row)
}

// ── Check-in / Check-out ───────────────────────────────────────────────────────
// Aba: CheckInOut | A:id | B:eventoId | C:cpf | D:nome | E:equipe | F:tipo |
//                  G:tipoRegistro | H:latitude | I:longitude | J:accuracy | K:timestamp

export async function appendCheckInOut(row: string[]) {
  return sheetAppend('CheckInOut!A:K', row)
}

export async function getCheckInOutByEvento(eventoId: string) {
  const rows = await sheetGet('CheckInOut!A:K')
  return rows.filter(r => r[1] === eventoId)
}
