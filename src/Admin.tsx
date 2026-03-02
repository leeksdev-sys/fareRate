import { useState, useEffect } from 'react'
import type { Company } from './types'
import { API_BASE } from './utils'
import styles from './Admin.module.css'
import AdminLoginForm from './components/AdminLoginForm'
import CompanyForm from './components/CompanyForm'
import CompanyList from './components/CompanyList'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', sido: '', sigungu: '', eupmyeondong: '' })
  const [message, setMessage] = useState('')

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
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        setAuthed(true)
        setMessage('')
      } else {
        setMessage('비밀번호가 올바르지 않습니다.')
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, ...form }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        setMessage(editingId ? '수정 완료!' : '추가 완료!')
        resetForm()
        loadCompanies()
      } else {
        setMessage('오류: ' + data.error)
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
    try {
      const res = await fetch(`${API_BASE}/api/admin/companies/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        setMessage('삭제 완료!')
        loadCompanies()
      } else {
        setMessage('삭제 실패: ' + data.error)
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
        <a href="/" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← 메인으로
        </a>
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