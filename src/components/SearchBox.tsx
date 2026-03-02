import type { KeyboardEvent, Dispatch, SetStateAction } from 'react'
import styles from './SearchBox.module.css'

interface SearchBoxProps<T> {
    label: string
    placeholder: string
    query: string
    setQuery: (value: string) => void
    suggestions: T[]
    activeIndex: number
    setActiveIndex: Dispatch<SetStateAction<number>>
    onSelect: (item: T) => void
    renderSuggestion: (item: T) => React.ReactNode
    onBlur?: () => void
    autoFocus?: boolean
}

export default function SearchBox<T>({
    label,
    placeholder,
    query,
    setQuery,
    suggestions,
    activeIndex,
    setActiveIndex,
    onSelect,
    renderSuggestion,
    onBlur,
    autoFocus
}: SearchBoxProps<T>) {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (suggestions.length > 0) {
                const idx = activeIndex >= 0 ? activeIndex : 0
                onSelect(suggestions[idx])
            }
        } else if (e.key === 'Tab') {
            if (suggestions.length > 0) {
                e.preventDefault()
                const idx = activeIndex >= 0 ? activeIndex : 0
                onSelect(suggestions[idx])
            }
        }
    }

    return (
        <div className={styles.searchBox}>
            <label>{label}</label>
            <input
                type="text"
                placeholder={placeholder}
                value={query}
                autoFocus={autoFocus}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={onBlur}
                onKeyDown={handleKeyDown}
            />
            {suggestions.length > 0 && (
                <ul className={styles.suggestions}>
                    {suggestions.map((item, i) => (
                        <li
                            key={i}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                onSelect(item)
                            }}
                            className={i === activeIndex ? styles.active : ''}
                        >
                            {renderSuggestion(item)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
