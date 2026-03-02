import type { Rate, Region } from '../types'
import styles from './RateResult.module.css'

interface RateResultProps {
    region: Region
    rate: Rate
    rateColor: string
    ft40Price: string
    ft20Price: string
}

export default function RateResult({
    region,
    rate,
    rateColor,
    ft40Price,
    ft20Price
}: RateResultProps) {
    return (
        <div className={styles.resultCard}>
            <h2>
                {region.sido} {region.sigungu} {region.eupmyeondong}
            </h2>
            <p className={styles.distance}>거리: {rate.distance_km}km</p>
            <p className={styles.rateLabel}>안전운임</p>
            <div className={styles.rateRow}>
                <div className={styles.rateItem}>
                    <span className={styles.rateSize}>40FT</span>
                    <span className={styles.ratePrice} style={{ color: rateColor }}>{ft40Price}원</span>
                </div>
                <div className={styles.rateDivider} />
                <div className={styles.rateItem}>
                    <span className={styles.rateSize}>20FT</span>
                    <span className={styles.ratePrice} style={{ color: rateColor }}>{ft20Price}원</span>
                </div>
            </div>
        </div>
    )
}
