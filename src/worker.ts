import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ADMIN_PASSWORD: string
  ALLOWED_ORIGINS?: string
  ADMIN_TOKEN_SECRET?: string
}

interface CompanyBody {
  name: string
  sido: string
  sigungu?: string
  eupmyeondong?: string
}

interface Variables {
  adminLoginVerified?: boolean
}

interface AdminRateState {
  windowStart: number
  requestCount: number
  failedCount: number
  blockedUntil: number
}

const DEFAULT_ALLOWED_ORIGINS = [
  'https://softsheet.org',
  'https://www.softsheet.org',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

const ADMIN_WINDOW_MS = 60_000
const ADMIN_MAX_REQUESTS_PER_WINDOW = 30
const ADMIN_MAX_FAILED_ATTEMPTS = 8
const ADMIN_LOCKOUT_MS = 10 * 60_000
const ADMIN_RATE_STATE = new Map<string, AdminRateState>()
const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 8

function parseAllowedOrigins(raw?: string): Set<string> {
  if (!raw) return new Set(DEFAULT_ALLOWED_ORIGINS)

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return origins.length > 0 ? new Set(origins) : new Set(DEFAULT_ALLOWED_ORIGINS)
}

function getClientIp(c: Context<{ Bindings: Env; Variables: Variables }>): string {
  const cfIp = c.req.header('cf-connecting-ip')
  if (cfIp) return cfIp

  const forwardedFor = c.req.header('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()

  return 'unknown'
}

function getTokenSecret(env: Env): string {
  return env.ADMIN_TOKEN_SECRET?.trim() || env.ADMIN_PASSWORD
}

function base64UrlEncodeFromString(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecodeToString(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return atob(padded)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function signToken(secret: string, payloadB64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
  const signatureHex = toHex(new Uint8Array(signed))
  return base64UrlEncodeFromString(signatureHex)
}

async function createAdminToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now,
    exp: now + ADMIN_TOKEN_TTL_SECONDS,
  }
  const payloadB64 = base64UrlEncodeFromString(JSON.stringify(payload))
  const signature = await signToken(getTokenSecret(env), payloadB64)
  return `${payloadB64}.${signature}`
}

async function verifyAdminToken(env: Env, token: string): Promise<boolean> {
  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return false

  const expectedSignature = await signToken(getTokenSecret(env), payloadB64)
  if (!timingSafeEqual(signature, expectedSignature)) return false

  try {
    const payloadText = base64UrlDecodeToString(payloadB64)
    const payload = JSON.parse(payloadText) as { exp?: number }
    if (!payload.exp || typeof payload.exp !== 'number') return false
    return payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

function getAdminRateState(ip: string, now: number): AdminRateState {
  const state = ADMIN_RATE_STATE.get(ip)
  if (!state) {
    const initialState: AdminRateState = {
      windowStart: now,
      requestCount: 0,
      failedCount: 0,
      blockedUntil: 0,
    }
    ADMIN_RATE_STATE.set(ip, initialState)
    return initialState
  }

  if (now - state.windowStart >= ADMIN_WINDOW_MS) {
    state.windowStart = now
    state.requestCount = 0
  }

  return state
}

// ─── 공통: 지역 WHERE 절 빌더 ───────────────────────────
function buildRegionWhere(
  sido: string,
  sigungu?: string,
  eupmyeondong?: string
): { clause: string; params: string[] } {
  const params: string[] = [sido]
  let clause = 'sido = ?'
  if (sigungu) {
    clause += ' AND sigungu = ?'
    params.push(sigungu)
  }
  if (eupmyeondong) {
    clause += ' AND eupmyeondong = ?'
    params.push(eupmyeondong)
  }
  return { clause, params }
}

// ─── 공통: 행정구역 유효성 검증 ──────────────────────────
async function validateRegion(
  db: D1Database,
  sido: string,
  sigungu?: string,
  eupmyeondong?: string
): Promise<boolean> {
  const { clause, params } = buildRegionWhere(sido, sigungu, eupmyeondong)
  const result = await db.prepare(
    `SELECT COUNT(*) as cnt FROM freight_rates WHERE ${clause}`
  ).bind(...params).first<{ cnt: number }>()
  return !!result && result.cnt > 0
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('/api/*', async (c, next) => {
  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS)

  return cors({
    origin: (origin) => {
      if (!origin) return ''
      return allowedOrigins.has(origin) ? origin : ''
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })(c, next)
})

app.use('/api/admin/*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'OPTIONS') return next()

  const origin = c.req.header('origin')
  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS)

  if (!origin || !allowedOrigins.has(origin)) {
    return c.json({ error: '허용되지 않은 요청 출처입니다.' }, 403)
  }

  return next()
})

// ─── Admin 인증 미들웨어 (POST/PUT/DELETE) ───────────────
app.use('/api/admin/*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'OPTIONS') return next()

  const now = Date.now()
  const ip = getClientIp(c)
  const rateState = getAdminRateState(ip, now)

  if (rateState.blockedUntil > now) {
    const retryAfter = Math.ceil((rateState.blockedUntil - now) / 1000)
    c.header('Retry-After', retryAfter.toString())
    return c.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429)
  }

  rateState.requestCount += 1
  if (rateState.requestCount > ADMIN_MAX_REQUESTS_PER_WINDOW) {
    c.header('Retry-After', Math.ceil(ADMIN_WINDOW_MS / 1000).toString())
    return c.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429)
  }

  const isLogin = c.req.path === '/api/admin/login'

  if (isLogin) {
    try {
      const body = await c.req.json<{ adminPassword?: string }>()
      const effectivePassword = c.env.ADMIN_PASSWORD

      if (!effectivePassword) {
        return c.json({ error: '서버 인증 설정이 누락되었습니다.' }, 500)
      }

      if (!body.adminPassword || body.adminPassword.trim() !== effectivePassword) {
        rateState.failedCount += 1
        if (rateState.failedCount >= ADMIN_MAX_FAILED_ATTEMPTS) {
          rateState.failedCount = 0
          rateState.blockedUntil = now + ADMIN_LOCKOUT_MS
          c.header('Retry-After', Math.ceil(ADMIN_LOCKOUT_MS / 1000).toString())
        }
        return c.json({ error: '인증 실패' }, 401)
      }

      rateState.failedCount = 0
      c.set('adminLoginVerified', true)
      return next()
    } catch {
      return c.json({ error: '잘못된 요청 형식' }, 400)
    }
  }

  const authHeader = c.req.header('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : ''

  if (!token) {
    return c.json({ error: '인증 토큰이 필요합니다.' }, 401)
  }

  const isValidToken = await verifyAdminToken(c.env, token)
  if (!isValidToken) {
    rateState.failedCount += 1
    if (rateState.failedCount >= ADMIN_MAX_FAILED_ATTEMPTS) {
      rateState.failedCount = 0
      rateState.blockedUntil = now + ADMIN_LOCKOUT_MS
      c.header('Retry-After', Math.ceil(ADMIN_LOCKOUT_MS / 1000).toString())
    }
    return c.json({ error: '유효하지 않은 인증 토큰입니다.' }, 401)
  }

  rateState.failedCount = 0
  return next()
})

// ─── 관리자 로그인 검증 ──────────────────────────────────
app.post('/api/admin/login', async (c) => {
  if (!c.get('adminLoginVerified')) {
    return c.json({ error: '인증 실패' }, 401)
  }

  const token = await createAdminToken(c.env)
  return c.json({ success: true, token, expiresIn: ADMIN_TOKEN_TTL_SECONDS })
})

// ─── 관리자 로그인 검증 ──────────────────────────────────
app.post('/api/admin/login', async (c) => {
  // 미들웨어에서 이미 인증 완료
  return c.json({ success: true })
})

// ─── 항구 목록 ───────────────────────────────────────────
app.get('/api/ports', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT DISTINCT port FROM freight_rates ORDER BY port'
  ).all()
  return c.json(results)
})

// ─── 지역 검색 ───────────────────────────────────────────
app.get('/api/search/region', async (c) => {
  const q = c.req.query('q') ?? ''
  const port = c.req.query('port') ?? ''

  if (!q || !port) return c.json([])

  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT sido, sigungu, eupmyeondong
    FROM freight_rates
    WHERE port = ?
      AND (sido LIKE ? OR sigungu LIKE ? OR eupmyeondong LIKE ?)
    ORDER BY sido, sigungu, eupmyeondong
    LIMIT 20
  `).bind(port, `%${q}%`, `%${q}%`, `%${q}%`).all()

  return c.json(results)
})

// ─── 운임 조회 ───────────────────────────────────────────
app.get('/api/rates', async (c) => {
  const port = c.req.query('port') ?? ''
  const sido = c.req.query('sido') ?? ''
  const sigungu = c.req.query('sigungu') ?? ''
  const eupmyeondong = c.req.query('eupmyeondong') ?? ''

  if (!port || !sido) return c.json([])

  const { clause, params } = buildRegionWhere(sido, sigungu, eupmyeondong)
  const query = `SELECT * FROM freight_rates WHERE port = ? AND ${clause} LIMIT 1`

  const { results } = await c.env.DB.prepare(query).bind(port, ...params).all()
  return c.json(results)
})

// ─── 업체 전체 목록 ──────────────────────────────────────
app.get('/api/companies', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, sido, sigungu, eupmyeondong FROM companies ORDER BY name'
  ).all()
  return c.json(results)
})

// ─── 업체 검색 (자동완성) ────────────────────────────────
app.get('/api/companies/search', async (c) => {
  const q = c.req.query('q') ?? ''
  if (!q) return c.json([])

  const { results } = await c.env.DB.prepare(
    'SELECT id, name, sido, sigungu, eupmyeondong FROM companies WHERE name LIKE ? ORDER BY name LIMIT 10'
  ).bind(`%${q}%`).all()
  return c.json(results)
})

// ─── 업체 추가 ───────────────────────────────────────────
app.post('/api/admin/companies', async (c) => {
  const body = await c.req.json() as CompanyBody

  if (!body.name || !body.sido) {
    return c.json({ error: '업체명과 시도는 필수입니다.' }, 400)
  }

  // 행정구역 유효성 검증
  const validRegion = await validateRegion(c.env.DB, body.sido, body.sigungu, body.eupmyeondong)
  if (!validRegion) {
    return c.json({ error: '존재하지 않는 행정구역입니다. 시도/시군구/읍면동을 확인해주세요.' }, 400)
  }

  // 중복 체크
  const existing = await c.env.DB.prepare(
    'SELECT id FROM companies WHERE name = ?'
  ).bind(body.name).first()
  if (existing) return c.json({ error: '이미 존재하는 업체명입니다.' }, 409)

  await c.env.DB.prepare(
    'INSERT INTO companies (name, sido, sigungu, eupmyeondong) VALUES (?, ?, ?, ?)'
  ).bind(body.name, body.sido, body.sigungu ?? '', body.eupmyeondong ?? '').run()

  return c.json({ success: true })
})

// ─── 업체 수정 ───────────────────────────────────────────
app.put('/api/admin/companies/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as CompanyBody

  // 행정구역 유효성 검증
  const validRegion = await validateRegion(c.env.DB, body.sido, body.sigungu, body.eupmyeondong)
  if (!validRegion) {
    return c.json({ error: '존재하지 않는 행정구역입니다. 시도/시군구/읍면동을 확인해주세요.' }, 400)
  }

  await c.env.DB.prepare(
    'UPDATE companies SET name = ?, sido = ?, sigungu = ?, eupmyeondong = ? WHERE id = ?'
  ).bind(body.name, body.sido, body.sigungu ?? '', body.eupmyeondong ?? '', id).run()

  return c.json({ success: true })
})

// ─── 업체 삭제 ───────────────────────────────────────────
app.delete('/api/admin/companies/:id', async (c) => {
  const id = c.req.param('id')

  await c.env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── Fallback: React SPA ─────────────────────────────────
app.get('/manifest.json', async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.url)
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})

app.get('*', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/'
  const response = await c.env.ASSETS.fetch(url.toString())
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})

export default app