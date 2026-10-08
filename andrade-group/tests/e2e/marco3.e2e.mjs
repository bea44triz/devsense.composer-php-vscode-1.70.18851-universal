// E2E do Marco 3 — Usuários e Permissões pela interface real, sem SQL manual, na pilha local de tests/e2e/stack.sh.
// Conceder acesso a um usuário já cadastrado → papel/permissão → vincular a um evento como coordenador →
// o coordenador só vê aquele evento → revogar acesso → o usuário perde a empresa inteira.
// Uso: PLAYWRIGHT_DIR=$(npm root -g)/playwright SHOTS=/tmp/shots node tests/e2e/marco3.e2e.mjs
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_DIR ?? 'playwright')
const APP = process.env.APP_URL ?? 'http://localhost:3200'
const SHOTS = process.env.SHOTS ?? '/var/tmp/erp-e2e/shots'
fs.mkdirSync(SHOTS, { recursive: true })
const sql = (q) => execSync(`psql -X -At -d erp_e2e -c ${JSON.stringify(q)}`, { env: process.env }).toString().trim()

const results = []
async function step(name, fn) {
  try { await fn(); results.push(['PASSOU', name]); console.log('PASSOU', name) }
  catch (e) { results.push(['FALHOU', name, e.message.split('\n')[0]]); console.log('FALHOU', name, '→', e.message.split('\n')[0]); throw e }
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const desktop = { viewport: { width: 1280, height: 900 }, permissions: ['geolocation'], geolocation: { latitude: -15.7801, longitude: -47.9292 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }
async function login(email, opts = desktop) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  await page.goto(`${APP}/entrar?next=/`)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('senha-teste')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByText('Operação de hoje').waitFor()
  return { ctx, page }
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
let eventId = ''

try {
  const { page: d } = await login('dono@061mktg.test')
  await step('1 dono (empresa.admin) cria um evento na 061 para atribuir depois', async () => {
    await d.goto(`${APP}/eventos/novo`)
    await d.getByLabel('Código *').fill('EV-U3')
    await d.getByLabel('Nome do evento *').fill('Evento do Marco 3')
    await d.getByRole('combobox', { name: 'Cliente' }).selectOption({ label: 'Cliente Exemplo' })
    await d.getByRole('combobox', { name: 'Centro de custo' }).selectOption({ label: 'CC-061-01 — Eventos' })
    await d.getByLabel('Data *').fill(today)
    await d.getByRole('button', { name: 'Estou no local' }).click()
    await d.getByText('Localização definida').waitFor()
    await d.getByRole('button', { name: 'Próximo: operação' }).click()
    await d.getByLabel('Equipe / função').nth(0).fill('Segurança')
    await d.getByLabel('Quantidade').nth(0).fill('1')
    await d.getByLabel('Valor (R$)').nth(0).fill('100')
    await d.getByRole('button', { name: 'Criar evento' }).click()
    await d.getByText('Evento criado. Os links').waitFor()
    eventId = d.url().split('/eventos/')[1].split('?')[0]
    assert.ok(eventId, 'id do evento não capturado da URL')
  })

  await step('2 Administração > Usuários e Permissões: busca usuário já cadastrado (ainda sem empresa)', async () => {
    await d.goto(`${APP}/administracao/usuarios`)
    await d.getByRole('button', { name: 'Conceder acesso' }).click()
    await d.getByPlaceholder('E-mail do usuário').fill('novocoord@061.test')
    await d.getByRole('button', { name: 'Buscar' }).click()
    await d.getByText('novocoord@061.test').first().waitFor()
  })
  await step('3 concede o papel Coordenador / Líder', async () => {
    await d.getByLabel('Papel').selectOption({ label: 'Coordenador / Líder (só operações atribuídas)' })
    await d.getByRole('button', { name: 'Conceder acesso' }).last().click()
    await d.getByText('novocoord@061.test').first().waitFor() // voltou pra lista
    await d.getByText('Coordenador / Líder').first().waitFor()
    await d.screenshot({ path: `${SHOTS}/m3-01-usuarios.png`, fullPage: true })
  })
  await step('4 vincula o usuário ao evento como coordenador', async () => {
    await d.getByText('novocoord@061.test').first().click()
    await d.getByRole('button', { name: /Eventos e Pontos Fixos/ }).click()
    await d.getByRole('button', { name: 'Vincular a evento ou ponto fixo' }).click()
    await d.getByLabel('Evento ou ponto fixo').selectOption({ label: 'Evento do Marco 3 — EV-U3' })
    await d.getByRole('button', { name: 'Vincular' }).click()
    await d.getByText('Evento do Marco 3').waitFor()
    await d.keyboard.press('Escape').catch(() => {})
    await d.locator('body').click({ position: { x: 5, y: 5 } }) // fecha o modal clicando fora
  })
  assert.equal(sql(`select role from operation_members where operation_id='${eventId}' and user_id=(select id from auth.users where email='novocoord@061.test')`), 'coordenador')

  await step('5 o coordenador vê só o evento atribuído', async () => {
    const { ctx, page: coord } = await login('novocoord@061.test')
    await coord.goto(`${APP}/eventos`)
    await coord.getByText('Evento do Marco 3').waitFor()
    const count = await coord.getByText('Congresso', { exact: false }).count()
    assert.equal(count, 0, 'não deveria ver eventos de outros donos')
    await coord.screenshot({ path: `${SHOTS}/m3-02-coordenador-eventos.png`, fullPage: true })
    await ctx.close()
  })

  await step('6 revoga o acesso do usuário à empresa', async () => {
    await d.goto(`${APP}/administracao/usuarios`)
    await d.getByText('novocoord@061.test').first().click()
    await d.getByRole('button', { name: 'Revogar acesso' }).click()
    await d.getByText('novocoord@061.test').waitFor({ state: 'detached' }).catch(() => {})
  })
  assert.equal(sql(`select count(*) from company_users where user_id=(select id from auth.users where email='novocoord@061.test')`), '0')

  await step('7 usuário revogado perde a empresa inteira (sem vínculo nenhum)', async () => {
    const ctx = await browser.newContext(desktop)
    const coord = await ctx.newPage()
    await coord.goto(`${APP}/entrar?next=/`)
    await coord.getByLabel('E-mail').fill('novocoord@061.test')
    await coord.getByLabel('Senha').fill('senha-teste')
    await coord.getByRole('button', { name: 'Entrar' }).click()
    await coord.getByText('Nenhuma empresa vinculada').waitFor()
    await ctx.close()
  })

  await step('8 coordenador restrito (sem usuarios.gerenciar) não acessa a tela de Usuários', async () => {
    const { ctx, page: carlos } = await login('carlos@andrade.test')
    await carlos.goto(`${APP}/administracao/usuarios`)
    await carlos.getByText('Sem permissão').waitFor()
    await ctx.close()
  })
} finally {
  await browser.close()
  const bad = results.filter((r) => r[0] === 'FALHOU').length
  console.log(`\n${results.length - bad}/${results.length} etapas passaram`)
  process.exitCode = bad ? 1 : 0
}
