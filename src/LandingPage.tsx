import styles from './LandingPage.module.css'

const REGIONS = [
  {
    id: 'uwicd',
    name: '의왕ICD',
    description: '경기도 의왕시 내륙컨테이너기지',
    tripType: '왕복',
    active: true,
  },
  {
    id: 'incheon-new',
    name: '인천신항',
    description: '인천광역시 연수구 신항',
    tripType: '왕복',
    active: true,
  },
  {
    id: 'incheon',
    name: '인천항',
    description: '인천광역시 중구 북항',
    tripType: '왕복',
    active: true,
  },
  {
    id: 'busan-new',
    name: '부산신항',
    description: '부산광역시 강서구 신항 ↔ 의왕ICD',
    tripType: '편도',
    active: true,
  },
  {
    id: 'busan',
    name: '부산북항',
    description: '부산광역시 동구 북항 ↔ 의왕ICD',
    tripType: '편도',
    active: true,
  },
  {
    id: 'gwangyang',
    name: '광양항',
    description: '전라남도 광양시 ↔ 의왕ICD',
    tripType: '편도',
    active: true,
  },
]

export default function LandingPage() {
  const handleRegionClick = (region: (typeof REGIONS)[0]) => {
    if (region.active) {
      window.location.assign(`/${region.id}`)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>SoftSheet</div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.hero}>www.softsheet.org</h1>
        <p className={styles.notice}>
          본 안전운임조회는 의왕ICD를 기점으로 하는 조회서비스입니다.
          <br />
          기타 다른 기점은 추후 업데이트 예정입니다.
        </p>
        <div className={styles.grid}>
          {REGIONS.map((region) => (
            <button
              key={region.id}
              className={`${styles.card} ${region.active ? styles.active : styles.inactive}`}
              onClick={() => handleRegionClick(region)}
              disabled={!region.active}
            >
              <span className={styles.cardLabel}>
                {region.active ? 'ACTIVE' : 'COMING SOON'}
              </span>
              <span className={styles.cardName}>{region.name}</span>
              <span className={styles.cardDesc}>{region.description}</span>
              {region.active && (
                <span className={region.tripType === '편도' ? styles.badgeOneway : styles.badgeRound}>
                  {region.tripType}
                </span>
              )}
            </button>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>softsheet.org</footer>
    </div>
  )
}
