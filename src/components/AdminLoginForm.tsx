import type { KeyboardEvent } from 'react'
import styles from '../Admin.module.css'

interface AdminLoginFormProps {
    password: string
    setPassword: (val: string) => void
    handleLogin: () => void
    message: string
}

export default function AdminLoginForm({
    password,
    setPassword,
    handleLogin,
    message
}: AdminLoginFormProps) {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleLogin()
        }
    }

    return (
        <div className={styles.adminLoginContainer}>
            <h1>🔒 관리자 로그인</h1>
            <div className={styles.card}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>비밀번호</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="비밀번호 입력"
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            fontSize: '16px',
                            border: '1px solid var(--input-border)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-main)',
                            outline: 'none'
                        }}
                    />
                </div>
                <button className={styles.btnPrimary} onClick={handleLogin} style={{ width: '100%' }}>
                    로그인
                </button>
                {message && <p className={styles.msgError}>{message}</p>}
            </div>
        </div>
    )
}
