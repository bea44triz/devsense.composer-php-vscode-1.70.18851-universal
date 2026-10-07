// E2E do Marco 1 pela interface real (Next + PostgREST + RLS), rodando na pilha local de tests/e2e/stack.sh.
// Criar evento → equipes → links → inscrição → confirmação → check-in → check-out → encerrar → validar → contas a pagar
// + isolamento entre empresas pela interface.
// Uso: PLAYWRIGHT_DIR=$(npm root -g)/playwright SHOTS=/tmp/shots node tests/e2e/marco1.e2e.mjs
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_DIR ?? 'playwright')
const APP = process.env.APP_URL ?? 'http://localhost:3200'
const SHOTS = process.env.SHOTS ?? '/var/tmp/erp-e2e/shots'
fs.mkdirSync(SHOTS, { recursive: true })
const VENUE = { latitude: -15.7801, longitude: -47.9292 }
const sql = (q) => execSync(`psql -X -At -d erp_e2e -c ${JSON.stringify(q)}`, { env: process.env }).toString().trim()

const results = []
async function step(name, fn) {
  try { await fn(); results.push(['PASSOU', name]); console.log('PASSOU', name) }
  catch (e) { results.push(['FALHOU', name, e.message.split('\n')[0]]); console.log('FALHOU', name, '→', e.message.split('\n')[0]); throw e }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
})
const desktop = { viewport: { width: 1280, height: 860 }, permissions: ['geolocation', 'camera'], geolocation: VENUE, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['geolocation', 'camera'], geolocation: VENUE, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }

async function login(ctx, email) {
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  await page.goto(`${APP}/entrar?next=/`)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('senha-teste')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByText('Operação de hoje').waitFor()
  return page
}

let eventId = ''
// o banco e o navegador usam o dia de São Paulo
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

try {
  // ── 1. Líder da 061 cria o evento ─────────────────────────────────────────
  const lider = await browser.newContext(desktop)
  const lp = await login(lider, 'lider@061.test')
  await step('1.1 login do líder e Home operacional', async () => {
    await lp.getByText('Nenhum evento hoje').waitFor()
    await lp.screenshot({ path: `${SHOTS}/01-home-vazia.png` })
  })
  await step('1.2 criar evento em 2 etapas (evento → operação)', async () => {
    await lp.getByRole('link', { name: 'Novo evento' }).first().click()
    await lp.getByLabel('Código *').fill('EV-E2E')
    await lp.getByLabel('Nome do evento *').fill('Congresso XPTO')
    await lp.getByRole('combobox', { name: 'Cliente' }).selectOption({ label: 'Cliente Exemplo' })
    await lp.getByRole('combobox', { name: 'Centro de custo' }).selectOption({ label: 'CC-061-01 — Eventos' })
    await lp.getByLabel('Data *').fill(today)
    await lp.getByLabel('Início').fill('08:00')
    await lp.getByLabel('Fim').fill('18:00')
    await lp.getByLabel('Local').fill('Centro de Convenções')
    await lp.getByLabel('Responsável').fill('Carlos')
    await lp.getByRole('button', { name: 'Estou no local' }).click()
    await lp.getByText('Localização definida').waitFor()
    await lp.screenshot({ path: `${SHOTS}/02-novo-evento-etapa1.png`, fullPage: true })
    await lp.getByRole('button', { name: 'Próximo: operação' }).click()
    // a etapa 2 abre com uma equipe vazia; preenchemos e adicionamos outra pela sugestão
    const nomes = lp.getByLabel('Equipe / função')
    await nomes.nth(0).fill('Segurança')
    await lp.getByLabel('Quantidade').nth(0).fill('1')
    await lp.getByLabel('Valor (R$)').nth(0).fill('180')
    await lp.getByLabel('Coordenador').nth(0).fill('Carlos')
    await lp.getByRole('button', { name: '+ Recepção' }).click()
    await lp.getByLabel('Quantidade').nth(1).fill('2')
    await lp.getByLabel('Valor (R$)').nth(1).fill('160')
    await lp.getByText('3 profissionais').waitFor()
    await lp.getByText('R$ 500,00').waitFor()
    await lp.screenshot({ path: `${SHOTS}/03-novo-evento-etapa2.png`, fullPage: true })
    await lp.getByRole('button', { name: 'Criar evento' }).click()
    await lp.getByText('Evento criado. Os links').waitFor()
    eventId = lp.url().split('/eventos/')[1].split('?')[0]
    await lp.screenshot({ path: `${SHOTS}/04-evento-equipes-links.png`, fullPage: true })
  })
  await step('1.3 links gerados (inscrição por equipe + check-in/out)', async () => {
    assert.equal(sql(`select count(*) from event_teams where event_id='${eventId}' and invite_token is not null`), '2')
    assert.equal(sql(`select (checkin_token is not null and checkout_token is not null)::text from events where id='${eventId}'`), 'true')
  })
  const tok = (name) => sql(`select invite_token from event_teams where event_id='${eventId}' and name='${name}'`)
  const tokIn = sql(`select checkin_token from events where id='${eventId}'`)
  const tokOut = sql(`select checkout_token from events where id='${eventId}'`)

  // ── 2. Freelancers se inscrevem pelo link (celular, sem login) ─────────────
  const pub = await browser.newContext(mobile)
  async function inscrever(token, p, shot) {
    const page = await pub.newPage()
    await page.goto(`${APP}/i/${token}`)
    await page.getByRole('button', { name: /QUERO PARTICIPAR|LISTA DE ESPERA/ }).click()
    await page.getByLabel('Seu CPF').fill(p.cpf)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Nome completo').fill(p.nome)
    await page.getByLabel('Celular / WhatsApp').fill(p.cel)
    await page.getByLabel('E-mail').fill(p.email)
    await page.getByRole('button', { name: p.pixLabel, exact: true }).click()
    await page.getByLabel('Chave PIX').fill(p.pix)
    if (shot) await page.screenshot({ path: `${SHOTS}/${shot}`, fullPage: true })
    await page.getByRole('button', { name: 'Enviar inscrição' }).click()
    await page.getByText('Inscrição recebida').waitFor()
    await page.close()
  }
  await step('2.1 validação no link: CPF inválido e PIX incompatível bloqueados', async () => {
    const page = await pub.newPage()
    await page.goto(`${APP}/i/${tok('Segurança')}`)
    await page.getByRole('button', { name: 'QUERO PARTICIPAR' }).click()
    await page.getByLabel('Seu CPF').fill('039.517.284-51')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByText('CPF inválido').waitFor()
    await page.getByLabel('Seu CPF').fill('039.517.284-50')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Nome completo').fill('Ana Teste')
    await page.getByLabel('Celular / WhatsApp').fill('61987654321')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByRole('button', { name: 'CPF', exact: true }).click()
    await page.getByLabel('Chave PIX').fill('111.111.111-11')
    await page.getByRole('button', { name: 'Enviar inscrição' }).click()
    await page.getByText('Chave PIX inválida').waitFor()
    await page.close()
  })
  await step('2.2 quatro inscrições (CPF com zero à esquerda preservado)', async () => {
    await inscrever(tok('Segurança'), { cpf: '039.517.284-50', nome: 'Ana Teste', cel: '61987654321', email: 'ana@exemplo.com', pixLabel: 'CPF', pix: '039.517.284-50' }, '05-inscricao-publica.png')
    await inscrever(tok('Segurança'), { cpf: '045.821.736-08', nome: 'Bruno Teste', cel: '61987650001', email: 'bruno@exemplo.com', pixLabel: 'Celular', pix: '(61) 98765-0001' })
    await inscrever(tok('Recepção'), { cpf: '000.000.019-10', nome: 'Carla Teste', cel: '61987650002', email: 'carla@exemplo.com', pixLabel: 'Aleatória', pix: '123E4567-E89B-12D3-A456-426614174000' })
    await inscrever(tok('Recepção'), { cpf: '071.834.562-26', nome: 'Davi Teste', cel: '61987650003', email: 'davi@exemplo.com', pixLabel: 'CNPJ', pix: '11.222.333/0001-81' })
    assert.equal(sql(`select cpf||'|'||pix_key from people where full_name='Ana Teste'`), '03951728450|03951728450')
    assert.equal(sql(`select pix_key from people where full_name='Carla Teste'`), '123e4567-e89b-12d3-a456-426614174000')
  })

  // ── 3. Líder confirma ──────────────────────────────────────────────────────
  await step('3.1 confirmar participação; vaga única da Segurança não aceita 2º', async () => {
    await lp.goto(`${APP}/eventos/${eventId}`)
    await lp.getByRole('button', { name: /Profissionais/ }).click()
    await lp.getByRole('button', { name: 'Todos' }).click()  // no filtro "Aguardando" o confirmado sai da lista
    const row = (n) => lp.locator('li').filter({ hasText: n })
    await row('Ana Teste').getByRole('button', { name: 'Confirmar' }).click()
    await row('Ana Teste').getByText('Confirmado').waitFor()
    await row('Bruno Teste').getByRole('button', { name: 'Confirmar' }).click()
    await lp.getByText('Equipe completa').waitFor()
    await row('Carla Teste').getByRole('button', { name: 'Confirmar' }).click()
    await row('Carla Teste').getByText('Confirmado').waitFor()
    await row('Davi Teste').getByRole('button', { name: 'Confirmar' }).click()
    await row('Davi Teste').getByText('Confirmado').waitFor()
    await row('Bruno Teste').getByRole('button', { name: 'Lista de espera' }).click()
    await row('Bruno Teste').getByText('Lista de espera').waitFor()
    await lp.screenshot({ path: `${SHOTS}/06-profissionais.png`, fullPage: true })
    assert.equal(sql(`select count(*) from event_participants where event_id='${eventId}' and status='confirmado'`), '3')
  })

  // ── 4. Presença pelo celular ───────────────────────────────────────────────
  async function presenca(token, cpf, geo, shot) {
    const ctx = await browser.newContext({ ...mobile, geolocation: geo })
    const page = await ctx.newPage()
    await page.goto(`${APP}/p/${token}`)
    await page.getByLabel('Seu CPF').fill(cpf)
    await page.getByRole('button', { name: 'Localizar participação' }).click()
    await page.getByRole('button', { name: 'Sou eu, continuar' }).click()
    const snap = page.getByRole('button', { name: 'Tirar foto' })
    await snap.waitFor(); await page.waitForFunction(() => !document.querySelector('button[disabled]')?.textContent?.includes('Tirar foto'))
    await snap.click()
    await page.getByRole('button', { name: 'Obter localização' }).click()
    if (shot) await page.screenshot({ path: `${SHOTS}/${shot}`, fullPage: true })
    await page.getByRole('button', { name: /Confirmar (chegada|saída)/ }).click()
    await page.getByText(/realizado/).waitFor()
    if (shot) await page.screenshot({ path: `${SHOTS}/${shot.replace('.png', '-ok.png')}`, fullPage: true })
    await ctx.close()
  }
  await step('4.1 check-in da Ana no local (foto + GPS salvos)', async () => {
    await presenca(tokIn, '039.517.284-50', VENUE, '07-checkin.png')
    assert.equal(sql(`select inside_radius::text from attendance a join event_participants ep on ep.id=a.participant_id join people p on p.id=ep.person_id where p.full_name='Ana Teste' and kind='checkin'`), 'true')
    const photo = sql(`select photo_path from attendance a join event_participants ep on ep.id=a.participant_id join people p on p.id=ep.person_id where p.full_name='Ana Teste' and kind='checkin'`)
    assert.ok(photo.startsWith('c0000000-0000-0000-0000-000000000002/'), 'foto na pasta da empresa')
    assert.ok(fs.existsSync(`/var/tmp/fake-storage/presence-photos/${photo}`), 'arquivo da foto gravado')
  })
  await step('4.2 check-in da Carla longe do local (registrado fora do raio)', async () => {
    await presenca(tokIn, '000.000.019-10', { latitude: -15.7951, longitude: -47.9392 })
    assert.equal(sql(`select inside_radius::text from attendance a join event_participants ep on ep.id=a.participant_id join people p on p.id=ep.person_id where p.full_name='Carla Teste'`), 'false')
  })
  await step('4.3 Bruno (lista de espera) não consegue check-in', async () => {
    const page = await pub.newPage()
    await page.goto(`${APP}/p/${tokIn}`)
    await page.getByLabel('Seu CPF').fill('045.821.736-08')
    await page.getByRole('button', { name: 'Localizar participação' }).click()
    await page.getByText('Não foi possível localizar uma participação confirmada').waitFor()
    await page.close()
  })
  await step('4.4 check-out da Ana', async () => {
    await presenca(tokOut, '039.517.284-50', VENUE)
    assert.equal(sql(`select count(*) from attendance where kind='checkout'`), '1')
  })
  await step('4.5 painel de presença por equipe', async () => {
    await lp.goto(`${APP}/eventos/${eventId}`)
    await lp.getByRole('button', { name: 'Presença' }).click()
    await lp.getByText('Confirmados que ainda não chegaram').waitFor()
    await lp.screenshot({ path: `${SHOTS}/08-presenca.png`, fullPage: true })
  })

  // ── 5. Encerrar, validar, enviar ao financeiro ─────────────────────────────
  await step('5.1 encerrar evento → aguardando fechamento', async () => {
    await lp.getByRole('button', { name: 'Encerrar evento' }).click()
    await lp.getByText('aguardando fechamento').first().waitFor()
    assert.equal(sql(`select status from events where id='${eventId}'`), 'aguardando_fechamento')
  })
  await step('5.2 fechamento: trabalhou, diárias, adicional, desconto → valor final', async () => {
    await lp.getByText('Fazer fechamento').click()
    await lp.getByText('Fechamento operacional').waitFor()
    const card = (n) => lp.locator('div.rounded-3xl').filter({ hasText: n }).filter({ has: lp.getByText('Trabalhou?') })
    await card('Ana Teste').getByLabel('Adicional').fill('20')
    await card('Ana Teste').getByRole('button', { name: 'Salvar' }).click()
    await card('Ana Teste').getByRole('button', { name: 'Salvar' }).waitFor({ state: 'detached' })
    await card('Carla Teste').getByLabel('Diárias').fill('2')
    await card('Carla Teste').getByLabel('Desconto').fill('10')
    await card('Carla Teste').getByRole('button', { name: 'Salvar' }).click()
    await card('Carla Teste').getByRole('button', { name: 'Salvar' }).waitFor({ state: 'detached' })
    await card('Davi Teste').getByRole('button', { name: 'Não', exact: true }).click()
    await card('Davi Teste').getByRole('button', { name: 'Salvar' }).click()
    await card('Davi Teste').getByRole('button', { name: 'Salvar' }).waitFor({ state: 'detached' })
    await card('Ana Teste').getByText('R$ 200,00').waitFor()
    await card('Carla Teste').getByText('R$ 310,00').waitFor()
    await lp.screenshot({ path: `${SHOTS}/09-fechamento.png`, fullPage: true })
  })
  await step('5.3 enviar ao financeiro gera as contas a pagar', async () => {
    await lp.getByRole('button', { name: 'Enviar para financeiro' }).click()
    await lp.getByText('Fechamento enviado ao financeiro').waitFor()
    assert.equal(sql(`select count(*) from payables where operation_id='${eventId}'`), '2')
    assert.equal(sql(`select payee_name||'|'||payee_document||'|'||pix_type||'|'||pix_key||'|'||amount||'|'||op_code||'|'||op_name||'|'||ref_date||'|'||cost_center||'|'||status from payables where payee_name='Ana Teste'`),
      `Ana Teste|03951728450|cpf|03951728450|200.00|EV-E2E|Congresso XPTO|${today}|CC-061-01 — Eventos|a_pagar`)
  })
  await step('5.4 Contas a Pagar mostra os dados sem redigitação', async () => {
    await lp.goto(`${APP}/financeiro/contas-a-pagar`)
    await lp.getByText('Ana Teste').waitFor()
    await lp.getByText('039.517.284-50').first().waitFor()
    await lp.getByText('R$ 310,00').waitFor()
    await lp.getByText('Total R$ 510,00').waitFor()
    await lp.screenshot({ path: `${SHOTS}/10-contas-a-pagar.png`, fullPage: true })
  })
  await step('5.5 Home e página do evento no celular', async () => {
    const m = await browser.newContext(mobile)
    const mp = await login(m, 'lider@061.test')
    await mp.screenshot({ path: `${SHOTS}/11-home-mobile.png`, fullPage: true })
    await mp.goto(`${APP}/eventos/${eventId}`)
    await mp.getByText('Congresso XPTO').first().waitFor()
    await mp.screenshot({ path: `${SHOTS}/12-evento-mobile.png`, fullPage: true })
    await m.close()
  })

  // ── 6. Isolamento pela interface ───────────────────────────────────────────
  await step('6.1 usuário só MKTG não vê o evento da 061 (nem pelo link direto)', async () => {
    const c = await browser.newContext(desktop)
    const p = await login(c, 'operacao@mktg.test')
    await p.goto(`${APP}/eventos`)
    await p.getByRole('button', { name: 'Todos' }).click()
    await p.getByText('Nenhum evento encontrado').waitFor()
    await p.goto(`${APP}/eventos/${eventId}`)
    await p.getByText('Evento não encontrado').waitFor()
    await c.close()
  })
  await step('6.2 Grupo Andrade não vê 061/MKTG e não tem seletor de outras empresas', async () => {
    const c = await browser.newContext(desktop)
    const p = await login(c, 'lider@andrade.test')
    assert.equal(await p.getByRole('button', { name: 'Trocar ambiente' }).count(), 0)
    await p.goto(`${APP}/eventos/${eventId}`)
    await p.getByText('Evento não encontrado').waitFor()
    const html = await p.content()
    assert.ok(!html.includes('MKTG') && !html.includes('061 Eventos'), 'nomes de outros clientes não aparecem')
    await c.close()
  })
  await step('6.3 dono 061/MKTG: consolidado mostra a empresa e é somente leitura', async () => {
    const c = await browser.newContext(desktop)
    const p = await login(c, 'dono@061mktg.test')
    await p.getByRole('button', { name: 'Trocar ambiente' }).click()
    await p.getByRole('button', { name: /Consolidado/ }).click()
    await p.getByText('somente consulta').waitFor()
    await p.goto(`${APP}/eventos`)
    await p.getByRole('button', { name: 'Todos' }).click()
    await p.getByText('061 Eventos').first().waitFor()
    assert.equal(await p.getByRole('link', { name: 'Novo evento' }).count(), 0)
    await p.screenshot({ path: `${SHOTS}/13-consolidado.png`, fullPage: true })
    await c.close()
  })
} finally {
  await browser.close()
  const bad = results.filter((r) => r[0] === 'FALHOU').length
  console.log(`\n${results.length - bad}/${results.length} etapas passaram`)
  process.exitCode = bad ? 1 : 0
}
