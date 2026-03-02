import { Hono } from 'hono'
import { cors } from 'hono/cors'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ADMIN_PASSWORD: string
}

interface CompanyBody {
  adminPassword: string
  name: string
  sido: string
  sigungu?: string
  eupmyeondong?: string
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

const app = new Hono<{ Bindings: Env }>()

app.use('/api/*', cors())

// ─── Admin 인증 미들웨어 (POST/PUT/DELETE) ───────────────
app.use('/api/admin/*', async (c, next) => {
  if (c.req.method === 'GET') return next()
  try {
    const body = await c.req.json<{ adminPassword?: string }>()
    if (!body.adminPassword || body.adminPassword !== c.env.ADMIN_PASSWORD) {
      return c.json({ error: '인증 실패' }, 401)
    }
  } catch {
    return c.json({ error: '잘못된 요청 형식' }, 400)
  }
  return next()
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