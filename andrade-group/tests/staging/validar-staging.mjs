// Validação com Auth e Storage REAIS do Supabase — rodar SOMENTE contra o projeto de STAGING.
// Usa a chave publicável (anon) + login de cada usuário de teste, como o app faz. A chave service_role só é usada
// aqui, na máquina de quem roda o teste, para subir/apagar o arquivo de teste do Storage — nunca vai para o frontend.
//
// Pré-requisitos (docs/STAGING.md): migrations aplicadas, usuários de teste criados no Auth, tests/staging/grants.sql rodado.
//
//   STAGING_SUPABASE_URL=https://<ref>.supabase.co  STAGING_ANON_KEY=...  STAGING_SERVICE_ROLE_KEY=...
//   STAGING_PASSWORD=<senha dos usuários de teste>   STAGING_CONFIRM=<ref>   [PRODUCTION_REF=<ref de produção>]
//   node tests/staging/validar-staging.mjs [--sem-storage]
//
// Cria dois eventos de teste na 061 (código STG-<execução>-A/B) com uma inscrição sintética em cada. Não apaga
// eventos (não há exclusão pelo app); a limpeza opcional está em docs/STAGING.md.
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.STAGING_SUPABASE_URL ?? ''
const ANON = process.env.STAGING_ANON_KEY ?? ''
const SERVICE = process.env.STAGING_SERVICE_ROLE_KEY ?? ''
const PASSWORD = process.env.STAGING_PASSWORD ?? ''
const DOMAIN = process.env.STAGING_EMAIL_DOMAIN ?? 'staging.test'
const WITH_STORAGE = !process.argv.includes('--sem-storage')

// ---- trava contra rodar no projeto errado ----
const host = (() => { try { return new URL(URL_).hostname } catch { return '' } })()
const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : host === 'localhost' || host === '127.0.0.1' ? 'local' : ''
if (!ref || !ANON || !PASSWORD) { console.error('Defina STAGING_SUPABASE_URL, STAGING_ANON_KEY e STAGING_PASSWORD.'); process.exit(2) }
if (process.env.STAGING_CONFIRM !== ref) { console.error(`Confirme o projeto: STAGING_CONFIRM=${ref}`); process.exit(2) }
if (process.env.PRODUCTION_REF && process.env.PRODUCTION_REF === ref) { console.error('Este é o projeto de PRODUÇÃO. Abortado.'); process.exit(2) }
if (WITH_STORAGE && !SERVICE) { console.error('Para o teste de Storage defina STAGING_SERVICE_ROLE_KEY (ou use --sem-storage).'); process.exit(2) }

const C061 = 'c0000000-0000-0000-0000-000000000002'
const RUN = new Date().toISOString().replace(/\D/g, '').slice(2, 14)
const PAPEIS = ['superadmin', 'andrade', 'gestor061', 'mktg', 'dono', 'coordA', 'coordB', 'financeiro']
const email = (p) => `stg.${p.toLowerCase()}@${DOMAIN}`
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const anon = createClient(URL_, ANON, opts)

const results = []
async function check(name, fn) {
  try { await fn(); results.push([true, name]); console.log(`PASSOU ${name}`) }
  catch (e) { results.push([false, name]); console.log(`FALHOU ${name} → ${e.message}`) }
}
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data }

const users = {}
async function login(p) {
  const c = createClient(URL_, ANON, opts)
  const { data, error } = await c.auth.signInWithPassword({ email: email(p), password: PASSWORD })
  if (error) throw new Error(`login ${email(p)}: ${error.message}`)
  users[p] = { c, id: data.user.id }
  return users[p]
}

function cpf(base) {
  const d = base.split('').map(Number)
  for (const len of [9, 10]) { let s = 0; for (let i = 0; i < len; i++) s += d[i] * (len + 1 - i); const r = (s * 10) % 11; d.push(r === 10 ? 0 : r) }
  return d.join('')
}
const todaySP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const visibleEvents = async (c, ids) => ok(await c.from('events').select('id').in('id', ids)).map((r) => r.id).sort()

// ---------------------------------------------------------------------------------------------------------------
await check('A1 login real (Supabase Auth) dos 8 usuários de teste', async () => { for (const p of PAPEIS) await login(p) })
if (Object.keys(users).length < PAPEIS.length) { console.log('\nSem os usuários não dá para seguir. Veja docs/STAGING.md.'); process.exit(1) }
const { gestor061, coordA, coordB } = users

// dados do teste: dois eventos da 061, A atribuído ao coordenador A e B ao coordenador B
let evA, evB
await check('A2 gestor 061 (todas as operações) cria 2 eventos e atribui um coordenador a cada', async () => {
  const mk = async (s) => ok(await gestor061.c.rpc('event_create', { _company_id: C061,
    _event: { code: `STG-${RUN}-${s}`, name: `Teste staging ${s}`, event_date: todaySP, end_date: todaySP, location: 'Staging' },
    _teams: [{ name: 'Segurança', quantity: 2, rate: 150 }] }))
  evA = await mk('A'); evB = await mk('B')
  ok(await gestor061.c.rpc('operation_member_set', { _op: evA, _user: coordA.id, _role: 'coordenador' }))
  ok(await gestor061.c.rpc('operation_member_set', { _op: evB, _user: coordB.id, _role: 'coordenador' }))
  const teams = ok(await gestor061.c.from('event_teams').select('event_id, invite_token').in('event_id', [evA, evB]))
  for (const [i, t] of teams.entries()) {
    const c = cpf(`7${RUN.slice(-7)}${i}`)
    ok(await anon.rpc('public_invite_register', { _token: t.invite_token, _data: { cpf: c, full_name: `Pessoa Staging ${i}`, phone: '61987654321', email: `pessoa${i}.${RUN}@${DOMAIN}`, pix_type: 'cpf', pix_key: c } }))
  }
})
if (!evA || !evB) { console.log('\nSem os eventos de teste não dá para seguir.'); process.exit(1) }

await check('B1 coordenador A lista só o evento A', async () => assert.deepEqual(await visibleEvents(coordA.c, [evA, evB]), [evA]))
await check('B2 coordenador A não abre o evento B pelo ID', async () => assert.equal(ok(await coordA.c.from('events').select('id').eq('id', evB).maybeSingle()), null))
await check('B3 coordenador A não vê participantes nem presença do evento B', async () => {
  assert.equal(ok(await coordA.c.from('event_participants').select('id').eq('event_id', evB)).length, 0)
  assert.equal(ok(await coordA.c.from('event_participants').select('id').eq('event_id', evA)).length, 1)
  const partB = ok(await gestor061.c.from('event_participants').select('id').eq('event_id', evB)).map((r) => r.id)
  assert.equal(partB.length, 1)
  assert.equal(ok(await coordA.c.from('event_participants').select('id').in('id', partB)).length, 0)
  assert.equal(ok(await coordA.c.from('attendance').select('id').in('participant_id', partB)).length, 0)
  assert.equal(ok(await coordA.c.from('event_teams').select('id').eq('event_id', evB)).length, 0)
})
await check('B4 coordenador B lista só o evento B (e não o A pelo ID)', async () => {
  assert.deepEqual(await visibleEvents(coordB.c, [evA, evB]), [evB])
  assert.equal(ok(await coordB.c.from('event_participants').select('id').eq('event_id', evA)).length, 0)
})
await check('B5 coordenador não consegue se atribuir a outro evento', async () => {
  const { error } = await coordA.c.rpc('operation_member_set', { _op: evB, _user: coordA.id, _role: 'coordenador' })
  assert.ok(error, 'deveria recusar')
  const { error: e2 } = await coordA.c.from('operation_members').insert({ operation_id: evB, company_id: C061, user_id: coordA.id, role: 'coordenador' })
  assert.ok(e2, 'insert direto deveria ser recusado')
})
await check('C1 Grupo Andrade não vê nada da 061', async () => {
  assert.deepEqual(await visibleEvents(users.andrade.c, [evA, evB]), [])
  assert.equal(ok(await users.andrade.c.from('people').select('id').eq('company_id', C061)).length, 0)
})
await check('C2 usuário só MKTG não vê nada da 061', async () => assert.deepEqual(await visibleEvents(users.mktg.c, [evA, evB]), []))
await check('C3 dono 061/MKTG vê os dois eventos', async () => assert.deepEqual(await visibleEvents(users.dono.c, [evA, evB]), [evA, evB].sort()))
await check('C4 Super Admin sem vínculo não lê dados operacionais', async () => {
  assert.equal(ok(await users.superadmin.c.rpc('is_platform_admin')), true)
  assert.deepEqual(await visibleEvents(users.superadmin.c, [evA, evB]), [])
})
await check('C5 ninguém se promove a Super Admin', async () => {
  const { error } = await coordA.c.from('platform_admins').insert({ user_id: coordA.id })
  assert.ok(error, 'deveria recusar')
})
await check('D1 financeiro: PIX integral não sai por SELECT (nem para o gestor); só pela RPC com permissão', async () => {
  for (const p of ['financeiro', 'gestor061']) {
    const { error } = await users[p].c.from('people').select('pix_key').limit(1)
    assert.ok(error, `${p} leu pix_key direto`)
  }
  const person = ok(await gestor061.c.from('event_participants').select('person_id').eq('event_id', evA).single()).person_id
  const fin = ok(await users.financeiro.c.rpc('person_pix', { _person: person }))
  const ges = ok(await gestor061.c.rpc('person_pix', { _person: person }))
  assert.equal(fin[0]?.full_access, true, 'financeiro deveria ter acesso completo')
  assert.equal(ges[0]?.full_access, false, 'gestor sem permissão financeira deveria ver mascarado')
  assert.notEqual(ges[0]?.pix_key, fin[0]?.pix_key)
})
await check('E1 anon não lê nenhuma tabela', async () => {
  const tables = ['attendance', 'audit_log', 'bank_accounts', 'centros_custo', 'client_groups', 'clientes_evento', 'companies',
    'company_user_permissions', 'company_users', 'event_participants', 'event_teams', 'events', 'fixed_post_members',
    'fixed_post_period_items', 'fixed_post_periods', 'fixed_posts', 'fornecedores', 'group_memberships', 'operation_members',
    'operations', 'payables', 'people', 'platform_admins', 'profiles', 'public_link_attempts']
  const leaks = []
  for (const t of tables) { const { data, error } = await anon.from(t).select('*').limit(1); if (!error && data?.length) leaks.push(t) }
  assert.deepEqual(leaks, [])
})
await check('E2 link público com token falso: mensagem genérica, sem dados', async () => {
  const fake = '0'.repeat(64)
  const { data, error } = await anon.rpc('public_invite_info', { _token: fake })
  assert.ok(error || !data || (Array.isArray(data) && data.length === 0), 'não deveria retornar dados')
  const { error: e2 } = await anon.rpc('record_presence', { _token: fake, _cpf: '00000000000', _lat: 0, _lng: 0, _accuracy: 1, _address: '', _photo_path: 'x' })
  assert.ok(e2, 'record_presence não pode ser chamada pelo anon')
})

await check('E3 IP do limite de tentativas não é falsificável pelo cabeçalho X-Forwarded-For', async () => {
  // request_ip() usa o ÚLTIMO item de X-Forwarded-For (anexado pelo proxy confiável do Supabase ao repassar a
  // conexão), não o 1º (o que o visitante manda). Um cliente que force o cabeçalho só consegue acrescentar um
  // item à esquerda; o item da direita continua sendo o que o proxy observou de verdade.
  const forged = `203.0.113.${Number(RUN.slice(-2)) % 250 + 1}`
  const spoof = createClient(URL_, ANON, { ...opts, global: { headers: { 'x-forwarded-for': forged } } })
  const token = ok(await gestor061.c.from('event_teams').select('invite_token').eq('event_id', evA).single()).invite_token
  ok(await spoof.rpc('public_invite_lookup', { _token: token, _cpf: cpf(`6${RUN.slice(-8)}`) }))
  const last = ok(await users.superadmin.c.from('public_link_attempts').select('ip').order('id', { ascending: false }).limit(1))
  assert.ok(last.length === 1, 'tentativa não registrada')
  if (last[0].ip === forged) {
    if (ref === 'local') { console.log('  (aviso: pilha local sem proxy de borda — o gateway fake repassa o cabeçalho sem anexar nada; no staging real isto precisa passar)'); return }
    throw new Error(`o banco gravou o IP enviado pelo cliente (${forged}) — o proxy do Supabase não está anexando o IP real, ou TRUSTED_PROXY_HOPS precisa de ajuste`)
  }
})

if (WITH_STORAGE) {
  const service = createClient(URL_, SERVICE, opts)
  const path = `${C061}/${evA}/stg-${RUN}.jpg`
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP////////////////////////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64')
  const canRead = async (c) => { const { data, error } = await c.storage.from('presence-photos').createSignedUrl(path, 60); return !error && !!data?.signedUrl }
  await check('F1 bucket presence-photos existe e é privado', async () => assert.equal(ok(await service.storage.getBucket('presence-photos')).public, false))
  await check('F2 upload no caminho <empresa>/<evento>/arquivo.jpg', async () => ok(await service.storage.from('presence-photos').upload(path, jpeg, { contentType: 'image/jpeg' })))
  await check('F3 coordenador do evento gera URL assinada e baixa a foto', async () => {
    const { data } = await coordA.c.storage.from('presence-photos').createSignedUrl(path, 60)
    assert.ok(data?.signedUrl, 'sem URL assinada')
    assert.equal((await fetch(data.signedUrl)).status, 200)
  })
  await check('F4 negado: coordenador de outro evento, outra empresa, MKTG e anônimo', async () => {
    for (const [n, c] of [['coordB', coordB.c], ['andrade', users.andrade.c], ['mktg', users.mktg.c], ['anon', anon]]) assert.equal(await canRead(c), false, `${n} leu a foto`)
    const pub = service.storage.from('presence-photos').getPublicUrl(path).data.publicUrl
    assert.notEqual((await fetch(pub)).status, 200, 'URL pública não pode funcionar em bucket privado')
  })
  await check('F5 usuário logado não grava nem apaga no bucket', async () => {
    const { error } = await gestor061.c.storage.from('presence-photos').upload(`${C061}/${evA}/intruso-${RUN}.jpg`, jpeg, { contentType: 'image/jpeg' })
    assert.ok(error, 'upload pelo usuário deveria ser recusado')
    await gestor061.c.storage.from('presence-photos').remove([path])
    assert.equal(await canRead(coordA.c), true, 'o arquivo não pode ter sido apagado pelo usuário')
  })
  await check('F6 exclusão pelo servidor remove a foto', async () => {
    ok(await service.storage.from('presence-photos').remove([path]))
    assert.equal(await canRead(coordA.c), false)
  })
}

const passed = results.filter(([p]) => p).length
console.log(`\n${passed}/${results.length} verificações passaram · eventos de teste: STG-${RUN}-A / STG-${RUN}-B`)
process.exit(passed === results.length ? 0 : 1)
