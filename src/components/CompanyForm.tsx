import styles from '../Admin.module.css'

interface CompanyFormProps {
    editingId: number | null
    form: { name: string; sido: string; sigungu: string; eupmyeondong: string }
    setForm: (form: { name: string; sido: string; sigungu: string; eupmyeondong: string }) => void
    handleSave: () => void
    resetForm: () => void
    message: string
}

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '16px',
    border: '1px solid var(--input-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--input-bg)',
    color: 'var(--text-main)',
    outline: 'none',
    marginBottom: '12px',
} as const

const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
} as const

export default function CompanyForm({
    editingId,
    form,
    setForm,
    handleSave,
    resetForm,
    message
}: CompanyFormProps) {
    const isError = message.startsWith('오류:')

    const clearRegion = () => {
        setForm({ ...form, sido: '', sigungu: '', eupmyeondong: '' })
    }

    return (
        <div className={styles.card}>
            <h2>{editingId ? '업체 수정' : '업체 추가'}</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            <div>
                <label style={labelStyle}>업체명 *</label>
                <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="업체명"
                    style={inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}>시도 *</label>
                <input
                    type="text"
                    value={form.sido}
                    onChange={(e) => setForm({ ...form, sido: e.target.value })}
                    placeholder="예: 경기도"
                    style={inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}>시군구</label>
                <input
                    type="text"
                    value={form.sigungu}
                    onChange={(e) => setForm({ ...form, sigungu: e.target.value })}
                    placeholder="예: 안양시 만안구"
                    style={inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}>읍면동</label>
                <input
                    type="text"
                    value={form.eupmyeondong}
                    onChange={(e) => setForm({ ...form, eupmyeondong: e.target.value })}
                    placeholder="예: 박달동"
                    style={inputStyle}
                />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="submit" className={styles.btnPrimary}>
                    {editingId ? '수정 저장' : '추가'}
                </button>
                {editingId && (
                    <button type="button" className={styles.btnSecondary} onClick={resetForm}>
                        취소
                    </button>
                )}
            </div>
            </form>
            {message && (
                <div style={{ marginTop: '8px' }}>
                    <p className={isError ? styles.msgError : styles.msgSuccess}>{message}</p>
                    {isError && message.includes('행정구역') && (
                        <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={clearRegion}
                            style={{ marginTop: '6px', fontSize: '0.85rem' }}
                        >
                            🗑️ 지역 입력 초기화
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
