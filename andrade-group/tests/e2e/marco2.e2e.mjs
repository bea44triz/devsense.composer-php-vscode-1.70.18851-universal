// E2E do Marco 2 pela interface real (Next + PostgREST + RLS) na pilha local de tests/e2e/stack.sh.
// Criar Ponto Fixo "Obra X" no Grupo Andrade → cliente → centro de custo → Segurança / Segurança de Obras →
// alocar 5 profissionais com valores mensais → abrir Outubro/2026 → falta/desconto/adicional → validar →
// enviar ao financeiro → exatamente 5 contas a pagar, sem duplicidade; + isolamento e escopo do coordenador.
// Uso: PLAYWRIGHT_DIR=$(npm root -g)/playwright SHOTS=/tmp/shots node tests/e2e/marco2.e2e.mjs
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

function cpf(base) { // CPF sintético válido a partir de 9 dígitos
  const d = base.split('').map(Number)
  for (const len of [9, 10]) { let s = 0; for (let i = 0; i < len; i++) s += d[i] * (len + 1 - i); const r = (s * 10) % 11; d.push(r === 10 ? 0 : r) }
  return d.join('')
}
const PROS = [
  { nome: 'Seguranca Alfa Teste', cpf: cpf('012345679'), valor: '2.100,00' },
  { nome: 'Seguranca Bravo Teste', cpf: cpf('500000002'), valor: '2200' },
  { nome: 'Seguranca Charlie Teste', cpf: cpf('500000003'), valor: '2300' },
  { nome: 'Seguranca Delta Teste', cpf: cpf('500000004'), valor: '2400' },
  { nome: 'Seguranca Echo Teste', cpf: cpf('500000005'), valor: '2500' },
]

const results = []
async function step(name, fn) {
  try { await fn(); results.push(['PASSOU', name]); console.log('PASSOU', name) }
  catch (e) { results.push(['FALHOU', name, e.message.split('\n')[0]]); console.log('FALHOU', name, '→', e.message.split('\n')[0]); throw e }
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const desktop = { viewport: { width: 1280, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }
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
let pfId = ''

try {
  const { page: g } = await login('gestor@andrade.test')
  await step('1 gestor do Grupo Andrade cadastra cliente e centro de custo', async () => {
    await g.goto(`${APP}/cadastros/clientes`)
    await g.getByRole('button', { name: 'Novo cliente' }).click()
    await g.getByLabel('Razão social').fill('Construtora X S.A.')
    await g.getByLabel('Nome fantasia').fill('Construtora X')
    await g.getByLabel('CNPJ').fill('11.222.333/0001-81')
    await g.getByRole('button', { name: 'Salvar cliente' }).click()
    await g.getByText('Construtora X', { exact: true }).waitFor()
    await g.goto(`${APP}/cadastros/centros-de-custo`)
    await g.getByRole('button', { name: 'Novo centro de custo' }).click()
    await g.getByLabel('Código').fill('CC-OBRAS')
    await g.getByLabel('Nome', { exact: true }).fill('Obras')
    await g.getByRole('button', { name: 'Salvar' }).click()
    await g.getByText('CC-OBRAS').waitFor()
  })
  await step('2 criar Ponto Fixo "Obra X" (cliente, centro de custo, Segurança / Segurança de Obras, responsável Carlos)', async () => {
    await g.goto(`${APP}/pontos-fixos`)
    await g.getByRole('link', { name: 'Novo ponto fixo' }).click()
    await g.getByLabel('Código *').fill('PF-OBRAX')
    await g.getByLabel('Nome *').fill('Obra X')
    await g.getByRole('combobox', { name: 'Cliente' }).selectOption({ label: 'Construtora X' })
    await g.getByRole('combobox', { name: 'Centro de custo' }).selectOption({ label: 'CC-OBRAS — Obras' })
    await g.getByLabel('Local').fill('Obra Residencial X')
    await g.getByLabel('Categoria', { exact: true }).fill('Segurança')
    await g.getByLabel('Subcategoria').fill('Segurança de Obras')
    await g.getByLabel('Responsável').selectOption({ label: 'Carlos Coordenador' })
    await g.screenshot({ path: `${SHOTS}/m2-01-novo-ponto-fixo.png`, fullPage: true })
    await g.getByRole('button', { name: 'Criar ponto fixo' }).click()
    await g.getByText('Ponto fixo criado.').waitFor()
    pfId = g.url().split('/pontos-fixos/')[1].split('?')[0]
    assert.equal(sql(`select client_name||'|'||cost_center||'|'||category||'|'||subcategory from fixed_posts where id='${pfId}'`), 'Construtora X|CC-OBRAS — Obras|Segurança|Segurança de Obras')
    assert.equal(sql(`select string_agg(p.email, ',' order by p.email) from operation_members m join profiles p on p.id=m.user_id where operation_id='${pfId}'`), 'carlos@andrade.test,gestor@andrade.test')
  })
  await step('3 alocar 5 profissionais com valor mensal', async () => {
    for (const p of PROS) {
      await g.getByRole('button', { name: 'Alocar profissional' }).click()
      await g.getByRole('button', { name: 'Cadastrar novo profissional' }).click()
      await g.getByLabel('Nome completo').fill(p.nome)
      await g.getByRole('textbox', { name: 'CPF' }).fill(p.cpf)
      await g.getByLabel('Celular').fill('61987650' + p.cpf.slice(-3))
      await g.getByRole('combobox', { name: 'Tipo PIX' }).selectOption('cpf')
      await g.getByRole('textbox', { name: 'Chave PIX' }).fill(p.cpf)
      await g.getByRole('button', { name: 'Cadastrar e selecionar' }).click()
      await g.getByLabel('Valor mensal (R$)').fill(p.valor)
      await g.getByRole('button', { name: 'Alocar', exact: true }).click()
      await g.getByRole('link', { name: p.nome }).waitFor()
    }
    await g.getByText('5 profissionais ativos').waitFor()
    await g.getByText('R$ 11.500,00').first().waitFor()
    await g.screenshot({ path: `${SHOTS}/m2-02-profissionais.png`, fullPage: true })
    assert.equal(sql(`select count(*) from fixed_post_members where fixed_post_id='${pfId}' and status='ativo'`), '5')
  })
  await step('4 abrir competência Outubro/2026 com os 5', async () => {
    await g.getByRole('button', { name: 'Competências' }).click()
    await g.getByLabel('Mês da competência').fill('2026-10')
    await g.getByRole('button', { name: 'Abrir competência' }).click()
    await g.getByText('Outubro/2026').first().waitFor()
    assert.equal(sql(`select count(*) from fixed_post_period_items i join fixed_post_periods p on p.id=i.period_id where p.fixed_post_id='${pfId}' and p.competence='2026-10-01'`), '5')
  })
  const card = (n) => g.locator('div.rounded-3xl').filter({ hasText: n }).filter({ has: g.getByText('Valor base') })
  await step('5 aplicar falta (com cálculo do desconto), adicional e desconto; conferir todos', async () => {
    await card('Seguranca Alfa').getByLabel('Faltas').fill('2')
    await card('Seguranca Alfa').getByRole('button', { name: 'Calcular desconto das faltas' }).click()
    await card('Seguranca Alfa').getByLabel('Observação').fill('2 faltas')
    await card('Seguranca Bravo').getByLabel('Adicionais').fill('300')
    await card('Seguranca Charlie').getByLabel('Descontos').fill('50')
    await card('Seguranca Charlie').getByLabel('Adicionais').fill('50')
    for (const p of PROS) {
      const c = card(p.nome.split(' ').slice(0, 2).join(' '))
      await c.getByRole('button', { name: 'Marcar como conferido' }).click()
      await c.getByRole('button', { name: 'Salvar' }).click()
      await c.getByRole('button', { name: 'Salvar' }).waitFor({ state: 'detached' })
    }
    await card('Seguranca Alfa').getByText('R$ 1.960,00').waitFor()   // 2100 − 2100/30×2
    await card('Seguranca Bravo').getByText('R$ 2.500,00').waitFor()
    await g.screenshot({ path: `${SHOTS}/m2-03-competencia.png`, fullPage: true })
  })
  await step('6 validar competência e enviar ao financeiro → 5 contas a pagar', async () => {
    await g.getByRole('button', { name: 'Validar competência' }).click()
    await g.getByRole('button', { name: 'Enviar para financeiro' }).click()
    await g.getByText('Competência enviada ao financeiro').waitFor()
    assert.equal(sql(`select count(*) from payables where operation_id='${pfId}'`), '5')
    await g.screenshot({ path: `${SHOTS}/m2-04-enviada.png`, fullPage: true })
  })
  await step('7 sem duplicidade: reenviar é recusado pelo banco e a tela não oferece de novo', async () => {
    assert.equal(await g.getByRole('button', { name: 'Enviar para financeiro' }).count(), 0)
    const per = sql(`select id from fixed_post_periods where fixed_post_id='${pfId}'`)
    let refused = false
    // como o gestor (autenticado, com permissão): a recusa tem de vir da regra de status, não de falta de permissão
    try {
      execSync(`psql -X -At -v ON_ERROR_STOP=1 -d erp_e2e`, { env: process.env, stdio: ['pipe', 'pipe', 'pipe'], input:
        `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000aa05","role":"authenticated"}';
         select fixed_post_send_period('${per}'); commit;` })
    } catch (e) { refused = true; assert.doesNotMatch(String(e.stderr), /Sem permiss/) }
    assert.ok(refused, 'segundo envio recusado')
    assert.equal(sql(`select count(*) from payables where operation_id='${pfId}'`), '5')
  })
  await step('8 financeiro recebe Nome, CPF, PIX, tipo, valor, empresa, ponto fixo, competência e centro de custo', async () => {
    const { ctx, page: f } = await login('financeiro@andrade.test')
    await f.goto(`${APP}/financeiro/contas-a-pagar`)
    await f.getByText('Seguranca Alfa Teste').waitFor()
    await f.getByText('012.345.679-70').first().waitFor()
    await f.getByText('R$ 1.960,00').waitFor()
    await f.getByText('Outubro/2026').first().waitFor()
    await f.getByText('CC-OBRAS — Obras').first().waitFor()
    await f.getByText('Total R$ 11.660,00').waitFor()
    await f.screenshot({ path: `${SHOTS}/m2-05-contas-a-pagar.png`, fullPage: true })
    assert.equal(sql(`select concat_ws('|', payee_name, payee_document, pix_type, pix_key, amount, (select name from companies c where c.id=company_id), op_name, competence, cost_center, origin) from payables where payee_name='Seguranca Alfa Teste'`),
      `Seguranca Alfa Teste|${PROS[0].cpf}|cpf|${PROS[0].cpf}|1960.00|Grupo Andrade|Obra X|2026-10-01|CC-OBRAS — Obras|PONTO_FIXO`)
    // financeiro vê o PIX completo no perfil; gestor (sem permissão financeira) só mascarado
    await f.goto(`${APP}/pessoas`)
    await f.getByText('Pessoas / Freelancers').first().waitFor()
    await ctx.close()
  })
  await step('9 Pessoas: CPF mascarado na lista e PIX mascarado para quem não é do financeiro', async () => {
    await g.goto(`${APP}/pessoas`)
    await g.getByText('Seguranca Alfa Teste').waitFor()
    await g.getByText('***.345.679-**').first().waitFor()
    await g.getByText('Seguranca Alfa Teste').click()
    await g.getByText('•••').first().waitFor()
    assert.equal(await g.getByRole('button', { name: 'mostrar' }).count(), 0)
    await g.screenshot({ path: `${SHOTS}/m2-06-perfil-pessoa.png`, fullPage: true })
  })
  await step('10 Carlos (responsável, perfil restrito) vê o ponto fixo; outro coordenador não vê nem pelo link', async () => {
    const { ctx: c1, page: carlos } = await login('carlos@andrade.test', mobile)
    await carlos.goto(`${APP}/pontos-fixos`)
    await carlos.getByText('Obra X').first().waitFor()
    await carlos.screenshot({ path: `${SHOTS}/m2-07-pontos-fixos-mobile.png`, fullPage: true })
    await c1.close()
    const { ctx: c2, page: outro } = await login('outro.coord@andrade.test')
    await outro.goto(`${APP}/pontos-fixos`)
    await outro.getByText('Nenhum ponto fixo').waitFor()
    await outro.goto(`${APP}/pontos-fixos/${pfId}`)
    await outro.getByText('Ponto fixo não encontrado').waitFor()
    await c2.close()
  })
  await step('11 usuário de outra empresa (MKTG) não vê o ponto fixo', async () => {
    const { ctx, page: m } = await login('operacao@mktg.test')
    await m.goto(`${APP}/pontos-fixos/${pfId}`)
    await m.getByText('Ponto fixo não encontrado').waitFor()
    await m.goto(`${APP}/pessoas`)
    await m.getByText('Nenhum profissional encontrado').waitFor()
    await ctx.close()
  })
} finally {
  await browser.close()
  const bad = results.filter((r) => r[0] === 'FALHOU').length
  console.log(`\n${results.length - bad}/${results.length} etapas passaram`)
  process.exitCode = bad ? 1 : 0
}
