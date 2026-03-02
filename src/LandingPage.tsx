import styles from './LandingPage.module.css'

const REGIONS = [
  {
    id: 'uwicd',
    name: '의왕ICD',
    description: '경기도 의왕시 내륙컨테이너기지',
    active: true,
  },
  {
    id: 'busan',
    name: '부산항',
    description: '부산광역시 북항 / 신항',
    active: false,
  },
  {
    id: 'incheon',
    name: '인천항',
    description: '인천광역시 인천항',
    active: false,
  },
  {
    id: 'gwangyang',
    name: '광양항',
    description: '전라남도 광양시',
    active: false,
  },
]

export default function LandingPage() {
  const handleRegionClick = (region: (typeof REGIONS)[0]) => {
    if (region.active) {
      window.location.href = `/${region.id}`
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>SoftSheet</div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.hero}>www.softsheet.org</h1>
        <p className={styles.sub}>사무자동화 소프트시트</p>
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
            </button>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>softsheet.org</footer>
    </div>
  )
}
