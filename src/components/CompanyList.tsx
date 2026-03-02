import type { Company } from '../types'
import styles from '../Admin.module.css'

interface CompanyListProps {
    companies: Company[]
    handleEdit: (company: Company) => void
    handleDelete: (id: number) => void
}

export default function CompanyList({
    companies,
    handleEdit,
    handleDelete
}: CompanyListProps) {
    return (
        <div className={styles.card}>
            <h2>업체 목록 ({companies.length}개)</h2>
            {companies.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>등록된 업체가 없습니다.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {companies.map((c: Company) => (
                        <div key={c.id} className={styles.companyCard}>
                            <div className={styles.companyInfo}>
                                <span className={styles.companyName}>{c.name}</span>
                                <span className={styles.companyAddr}>
                                    {c.sido} {c.sigungu} {c.eupmyeondong}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button
                                    className={`${styles.btnTable} ${styles.btnEdit}`}
                                    onClick={() => handleEdit(c)}
                                >
                                    수정
                                </button>
                                <button
                                    className={`${styles.btnTable} ${styles.btnDelete}`}
                                    onClick={() => handleDelete(c.id)}
                                >
                                    삭제
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
