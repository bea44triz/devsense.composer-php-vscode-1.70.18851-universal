import { google } from 'googleapis'
import { isInscricaoAtiva, onlyDigits } from '@/lib/utils'

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
// valueInputOption RAW: o Sheets grava cada string exatamente como enviada, como TEXTO —
// sem interpretar como número, data ou fórmula. "01234567890" continua "01234567890"
// e nenhum caractere artificial (como apóstrofo) é inserido no conteúdo.
// LIMITAÇÃO: ler A:A e depois gravar em nextRow não é atômico (ver MAPA_DO_PROJETO.md §9).
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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: 'FORMATTED_VALUE',  // sempre string; células RAW de texto voltam idênticas
  })
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
//                  G:pixTipo | H:pixChave | I:equipe | J:tipo | K:criadoEm | L:status
// L:status — 'ativa' | 'confirmada' | 'cancelada'. Vazio (linhas antigas) = ativa.

/**
 * Remove o apóstrofo inicial que versões anteriores enviavam com USER_ENTERED.
 * Nesse modo o Sheets não guarda o apóstrofo no valor, mas uma célula editada
 * manualmente ou gravada em RAW com "'" o teria literalmente — a API nunca o devolve.
 */
function cleanText(v: string | undefined): string {
  return String(v ?? '').replace(/^'/, '')
}

/** Normaliza CPF/telefone/pixChave de uma linha lida da aba Inscricoes. */
function cleanInscricaoRow(r: string[]): string[] {
  const out = [...r]
  out[3] = cleanText(r[3])  // cpf
  out[4] = cleanText(r[4])  // telefone
  out[7] = cleanText(r[7])  // pixChave
  return out
}

export async function getInscricoesByEvento(eventoId: string) {
  const rows = await sheetGet('Inscricoes!A:L')
  return rows.filter(r => r[1] === eventoId).map(cleanInscricaoRow)
}

/** Inscrições que ocupam vaga (ativas/confirmadas) para uma equipe+tipo. */
export function contarPreenchidas(inscricoes: string[][], equipe: string, tipo: string): number {
  return inscricoes.filter(r => r[8] === equipe && r[9] === tipo && isInscricaoAtiva(r[11])).length
}

export async function getInscricaoByCpfEvento(cpf: string, eventoId: string) {
  // Compara somente dígitos, como string — nunca Number(), que perderia o zero à esquerda.
  const cpfDigits = onlyDigits(cpf)
  const rows = await getInscricoesByEvento(eventoId)
  return rows.find(r => onlyDigits(r[3]) === cpfDigits && isInscricaoAtiva(r[11])) ?? null
}

export async function appendInscricao(row: string[]) {
  // row: [id, eventoId, nome, cpf, telefone, email, pixTipo, pixChave, equipe, tipo, criadoEm, status]
  // Todos os valores são strings; RAW em sheetWriteRow preserva zeros à esquerda sem prefixo.
  return sheetWriteRow('Inscricoes', 'L', row)
}

// ── Check-in / Check-out ───────────────────────────────────────────────────────
// Aba: CheckInOut | A:id | B:eventoId | C:cpf | D:nome | E:equipe | F:tipo |
//                  G:tipoRegistro | H:latitude | I:longitude | J:accuracy | K:timestamp

export async function appendCheckInOut(row: string[]) {
  // row: [id, eventoId, cpf, nome, equipe, tipo, tipoRegistro, localRegistro, lat, lon, accuracy, timestamp]
  // CPF já chega normalizado (11 dígitos, string); RAW preserva zeros à esquerda sem prefixo.
  return sheetWriteRow('CheckInOut', 'L', row)
}

export async function getCheckInOutByEvento(eventoId: string) {
  const rows = await sheetGet('CheckInOut!A:L')
  return rows.filter(r => r[1] === eventoId)
}
