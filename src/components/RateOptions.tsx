import styles from './RateOptions.module.css'

interface RateOptionsProps {
    oneWay: boolean
    setOneWay: (val: boolean) => void
    hazardous: boolean
    setHazardous: (val: boolean) => void
    overweight: number
    setOverweight: (fn: (v: number) => number) => void
}

export default function RateOptions({
    oneWay,
    setOneWay,
    hazardous,
    setHazardous,
    overweight,
    setOverweight,
}: RateOptionsProps) {
    return (
        <div className={styles.options}>
            <label>
                <input
                    type="checkbox"
                    checked={oneWay}
                    onChange={(e) => setOneWay(e.target.checked)}
                />
                편도 운임
            </label>
            <label>
                <input
                    type="checkbox"
                    checked={hazardous}
                    onChange={(e) => setHazardous(e.target.checked)}
                />
                위험물 할증 (+30%)
            </label>
            <div className={styles.overweightRow}>
                <span className={styles.overweightLabel}>중량초과 (+{overweight * 10}%)</span>
                <div className={styles.overweightControls}>
                    <button
                        className={styles.btnWeight}
                        onClick={() => setOverweight((v: number) => Math.max(0, v - 1))}
                    >
                        －
                    </button>
                    <span className={styles.overweightValue}>{overweight}톤</span>
                    <button
                        className={styles.btnWeight}
                        onClick={() => setOverweight((v: number) => v + 1)}
                    >
                        ＋
                    </button>
                </div>
            </div>
        </div>
    )
}
