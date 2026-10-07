// Gateway LOCAL que imita a API do Supabase para testes ponta a ponta, sem nenhum serviço remoto.
//   /rest/v1/*     → PostgREST real (RLS e funções do banco valem de verdade)
//   /auth/v1/*     → login por senha com usuários de teste, emitindo JWT HS256 (mesmo segredo do PostgREST)
//   /storage/v1/*  → upload/remoção/URL assinada gravando em disco (bucket privado simulado)
// Uso: JWT_SECRET=... PGRST_URL=http://127.0.0.1:3001 USERS_JSON='[{"id":"..","email":"..","password":".."}]' node fake-supabase-gateway.mjs
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PORT ?? 54321)
const SECRET = process.env.JWT_SECRET
const PGRST = process.env.PGRST_URL ?? 'http://127.0.0.1:3001'
const USERS = JSON.parse(process.env.USERS_JSON ?? '[]')
const STORE = process.env.STORAGE_DIR ?? '/var/tmp/fake-storage'
if (!SECRET) throw new Error('JWT_SECRET obrigatório')

const b64u = (b) => Buffer.from(b).toString('base64url')
export function sign(payload) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64u(JSON.stringify(payload))
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
function verify(token) {
  const [h, p, s] = String(token ?? '').split('.')
  if (!h || !p || !s) return null
  if (crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString())
  return claims.exp && claims.exp < Date.now() / 1000 ? null : claims
}
const bearer = (req) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, prefer, range, x-client-info, accept-profile, content-profile, x-upsert, cache-control',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'content-range, content-location',
}
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body)
  res.writeHead(status, { ...CORS, ...(isBuf ? {} : { 'Content-Type': 'application/json' }), ...headers })
  res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body))
}
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))) })

function session(u) {
  const now = Math.floor(Date.now() / 1000)
  const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  return {
    access_token: sign({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
    token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `rt-${u.id}`, user,
  }
}

async function auth(req, res, url) {
  const p = url.pathname.replace('/auth/v1', '')
  if (p === '/token' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString() || '{}')
    let u
    if (url.searchParams.get('grant_type') === 'refresh_token') u = USERS.find((x) => `rt-${x.id}` === body.refresh_token)
    else u = USERS.find((x) => x.email === String(body.email).toLowerCase() && x.password === body.password)
    if (!u) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' })
    return send(res, 200, session(u))
  }
  if (p === '/user') {
    const c = verify(bearer(req))
    const u = c && USERS.find((x) => x.id === c.sub)
    if (!u) return send(res, 401, { msg: 'invalid JWT', code: 'bad_jwt' })
    return send(res, 200, session(u).user)
  }
  if (p === '/logout') return send(res, 204)
  return send(res, 404, { msg: 'not implemented in fake gateway' })
}

async function storage(req, res, url) {
  const p = decodeURIComponent(url.pathname.replace('/storage/v1', ''))
  const role = verify(bearer(req))?.role
  let m
  if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'POST') {
    if (!role) return send(res, 401, { message: 'unauthorized' })
    const t = sign({ obj: `${m[1]}/${m[2]}`, exp: Math.floor(Date.now() / 1000) + 600 })
    return send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=${t}` })
  }
  if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
    const c = verify(url.searchParams.get('token'))
    if (!c || c.obj !== `${m[1]}/${m[2]}`) return send(res, 400, { message: 'invalid signature' })
    const f = path.join(STORE, m[1], m[2])
    return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), { 'Content-Type': 'image/jpeg' }) : send(res, 404, { message: 'not found' })
  }
  if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/)) && (req.method === 'POST' || req.method === 'PUT')) {
    if (role !== 'service_role') return send(res, 403, { message: 'only service_role uploads in this test' })
    const f = path.join(STORE, m[1], m[2])
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, await readBody(req))
    return send(res, 200, { Key: `${m[1]}/${m[2]}`, Id: crypto.randomUUID() })
  }
  if ((m = p.match(/^\/object\/([^/]+)$/)) && req.method === 'DELETE') {
    const body = JSON.parse((await readBody(req)).toString() || '{}')
    for (const name of body.prefixes ?? []) fs.rmSync(path.join(STORE, m[1], name), { force: true })
    return send(res, 200, [])
  }
  return send(res, 404, { message: 'not implemented in fake gateway' })
}

async function rest(req, res, url) {
  const target = PGRST + url.pathname.replace('/rest/v1', '') + url.search
  const headers = {}
  for (const [k, v] of Object.entries(req.headers)) if (!['host', 'apikey', 'connection', 'content-length'].includes(k)) headers[k] = v
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req)
  const r = await fetch(target, { method: req.method, headers, body })
  const out = Buffer.from(await r.arrayBuffer())
  const pass = {}
  for (const k of ['content-type', 'content-range', 'preference-applied']) { const v = r.headers.get(k); if (v) pass[k] = v }
  res.writeHead(r.status, { ...CORS, ...pass })
  res.end(out)
}

http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      // preflight: libera os cabeçalhos pedidos pelo supabase-js (x-supabase-api-version etc.)
      return send(res, 204, undefined, { 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? CORS['Access-Control-Allow-Headers'] })
    }
    const url = new URL(req.url, `http://localhost:${PORT}`)
    if (url.pathname.startsWith('/rest/v1')) return await rest(req, res, url)
    if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url)
    if (url.pathname.startsWith('/storage/v1')) return await storage(req, res, url)
    send(res, 404, { message: 'unknown path' })
  } catch (e) {
    console.error(e)
    send(res, 500, { message: String(e) })
  }
}).listen(PORT, () => console.log(`fake supabase gateway on :${PORT}`))
