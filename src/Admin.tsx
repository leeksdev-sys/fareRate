import { useState, useEffect } from 'react'
import type { Company } from './types'
import { API_BASE } from './utils'
import styles from './Admin.module.css'
import AdminLoginForm from './components/AdminLoginForm'
import CompanyForm from './components/CompanyForm'
import CompanyList from './components/CompanyList'

const ADMIN_TOKEN_KEY = 'admin_token'

interface AdminApiResponse {
  success?: boolean
  token?: string
  error?: string
}

export default function Admin() {
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', sido: '', sigungu: '', eupmyeondong: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const savedToken = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (savedToken) {
      setToken(savedToken)
      setAuthed(true)
    }
  }, [])

  useEffect(() => {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
      return
    }
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  }, [token])

  const handleAuthExpired = () => {
    setAuthed(false)
    setToken('')
    setEditingId(null)
    setPassword('')
    setMessage('인증이 만료되었습니다. 다시 로그인해주세요.')
  }

  const handleLogout = () => {
    setAuthed(false)
    setToken('')
    setPassword('')
    setEditingId(null)
    setForm({ name: '', sido: '', sigungu: '', eupmyeondong: '' })
    setMessage('로그아웃되었습니다.')
  }

  const withAdminAuth = (headers?: HeadersInit): HeadersInit => ({
    ...(headers ?? {}),
    Authorization: `Bearer ${token}`,
  })

  const readApiResponse = async (res: Response): Promise<AdminApiResponse> => {
    try {
      return await res.json() as AdminApiResponse
    } catch {
      return {}
    }
  }

  const getRetryAfterText = (res: Response): string => {
    const retryAfter = res.headers.get('Retry-After')
    if (!retryAfter) return ''
    const seconds = Number(retryAfter)
    if (!Number.isFinite(seconds) || seconds <= 0) return ''
    return ` (${seconds}초 후 재시도)`
  }

  const getApiErrorMessage = (
    action: 'login' | 'save' | 'delete',
    res: Response,
    data: AdminApiResponse
  ): string => {
    if (res.status === 401) {
      return action === 'login'
        ? '비밀번호가 올바르지 않습니다.'
        : '인증이 만료되었습니다. 다시 로그인해주세요.'
    }
    if (res.status === 403) {
      return '허용되지 않은 환경에서 요청되었습니다. 관리자에게 문의해주세요.'
    }
    if (res.status === 429) {
      return `요청이 너무 많습니다. 잠시 후 다시 시도해주세요.${getRetryAfterText(res)}`
    }
    if (data.error) {
      if (action === 'delete') return `삭제 실패: ${data.error}`
      if (action === 'save') return `오류: ${data.error}`
      return data.error
    }
    if (action === 'delete') return '삭제 요청 처리 중 오류가 발생했습니다.'
    if (action === 'save') return '저장 요청 처리 중 오류가 발생했습니다.'
    return '로그인 처리 중 오류가 발생했습니다.'
  }

  const loadCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/companies`)
      if (!res.ok) throw new Error('업체 목록 로드 실패')
      const data: Company[] = await res.json()
      setCompanies(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (authed) loadCompanies()
  }, [authed])

  const handleLogin = async () => {
    if (!password) {
      setMessage('비밀번호를 입력하세요.')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password }),
      })
      const data = await readApiResponse(res)
      if (res.ok && data.success && data.token) {
        setToken(data.token)
        setAuthed(true)
        setPassword('')
        setMessage('')
      } else {
        setMessage(getApiErrorMessage('login', res, data))
      }
    } catch {
      setMessage('서버 연결에 실패했습니다.')
    }
  }

  const resetForm = () => {
    setForm({ name: '', sido: '', sigungu: '', eupmyeondong: '' })
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!token) {
      handleAuthExpired()
      return
    }

    if (!form.name || !form.sido) {
      setMessage('업체명과 시도는 필수입니다.')
      return
    }
    try {
      const url = editingId
        ? `${API_BASE}/api/admin/companies/${editingId}`
        : `${API_BASE}/api/admin/companies`
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: withAdminAuth({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(form),
      })
      const data = await readApiResponse(res)
      if (data.success) {
        setMessage(editingId ? '수정 완료!' : '추가 완료!')
        resetForm()
        loadCompanies()
      } else {
        if (res.status === 401) {
          handleAuthExpired()
          return
        }
        setMessage(getApiErrorMessage('save', res, data))
      }
    } catch (err) {
      setMessage('요청 중 오류 발생')
      console.error(err)
    }
  }

  const handleEdit = (company: Company) => {
    setEditingId(company.id)
    setForm({
      name: company.name,
      sido: company.sido,
      sigungu: company.sigungu,
      eupmyeondong: company.eupmyeondong,
    })
    setMessage('')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return
    if (!token) {
      handleAuthExpired()
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/companies/${id}`, {
        method: 'DELETE',
        headers: withAdminAuth(),
      })
      const data = await readApiResponse(res)
      if (data.success) {
        setMessage('삭제 완료!')
        loadCompanies()
      } else {
        if (res.status === 401) {
          handleAuthExpired()
          return
        }
        setMessage(getApiErrorMessage('delete', res, data))
      }
    } catch (err) {
      setMessage('삭제 요청 중 오류 발생')
      console.error(err)
    }
  }

  if (!authed) {
    return (
      <AdminLoginForm
        password={password}
        setPassword={setPassword}
        handleLogin={handleLogin}
        message={message}
      />
    )
  }

  return (
    <div className={styles.adminContainer}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'clamp(1.45rem, 6vw, 1.75rem)', marginBottom: '8px' }}>⚙️ 업체 관리</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← 메인으로
          </a>
          <button type="button" className={styles.btnSecondary} onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <CompanyForm
        editingId={editingId}
        form={form}
        setForm={setForm}
        handleSave={handleSave}
        resetForm={resetForm}
        message={message}
      />

      <CompanyList
        companies={companies}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
      />
    </div>
  )
}