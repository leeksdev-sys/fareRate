import { useState, useCallback, useEffect } from 'react'
import styles from './App.module.css'
import type { Rate, Region, Company } from './types'
import { API_BASE, formatRegion } from './utils'
import SearchBox from './components/SearchBox'
import RateResult from './components/RateResult'
import RateOptions from './components/RateOptions'

interface AppProps {
  port: string
}

export default function App({ port }: AppProps) {
  const [query, setQuery] = useState<string>('')
  const [suggestions, setSuggestions] = useState<Region[]>([])
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
  const [rates, setRates] = useState<Rate[]>([])
  const [hazardous, setHazardous] = useState<boolean>(false)
  const [oneWay, setOneWay] = useState<boolean>(false)
  const [overweight, setOverweight] = useState<number>(0)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [companyQuery, setCompanyQuery] = useState<string>('')
  const [companySuggestions, setCompanySuggestions] = useState<Company[]>([])
  const [companyActiveIndex, setCompanyActiveIndex] = useState<number>(-1)

  const searchRegion = useCallback(
    async (q: string) => {
      if (q.length < 1) {
        setSuggestions([])
        return
      }
      try {
        const res = await fetch(
          `${API_BASE}/api/search/region?q=${encodeURIComponent(q)}&port=${encodeURIComponent(port)}`
        )
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const data: Region[] = await res.json()
        setSuggestions(data)
      } catch (err) {
        console.error('지역 검색 실패:', err)
        setSuggestions([])
      }
    },
    [port]
  )

  useEffect(() => {
    if (selectedRegion) return
    const timer = setTimeout(() => searchRegion(query), 150)
    return () => clearTimeout(timer)
  }, [query, searchRegion, selectedRegion])

  const searchCompany = useCallback(async (q: string) => {
    if (q.length < 1) {
      setCompanySuggestions([])
      return
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/companies/search?q=${encodeURIComponent(q)}`
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data: Company[] = await res.json()
      setCompanySuggestions(data)
    } catch (err) {
      console.error('업체 검색 실패:', err)
      setCompanySuggestions([])
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchCompany(companyQuery), 150)
    return () => clearTimeout(timer)
  }, [companyQuery, searchCompany])

  const fetchRates = useCallback(
    async (region: Region) => {
      try {
        const params = new URLSearchParams({
          port,
          sido: region.sido,
          sigungu: region.sigungu,
          eupmyeondong: region.eupmyeondong,
        })
        const res = await fetch(`${API_BASE}/api/rates?${params}`)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const data: Rate[] = await res.json()
        setRates(data)
      } catch (err) {
        console.error('운임 조회 실패:', err)
        setRates([])
      }
    },
    [port]
  )

  const selectCompany = (company: Company) => {
    setCompanySuggestions([])
    setCompanyActiveIndex(-1)
    setCompanyQuery(company.name)
    const region = {
      sido: company.sido,
      sigungu: company.sigungu,
      eupmyeondong: company.eupmyeondong,
    }
    setSelectedRegion(region)
    setQuery(formatRegion(region))
    fetchRates(region)
  }

  const selectRegion = (region: Region) => {
    setSelectedRegion(region)
    setQuery(formatRegion(region))
    setSuggestions([])
    setActiveIndex(-1)
    fetchRates(region)
  }

  const calcRate = (base: number): string => {
    let rate = base
    if (hazardous) rate *= 1.3
    if (overweight > 0) rate *= 1 + overweight * 0.1
    if (oneWay) rate *= 0.5
    return Math.round(rate).toLocaleString()
  }

  const handleReset = () => {
    setQuery('')
    setCompanyQuery('')
    setSelectedRegion(null)
    setRates([])
    setSuggestions([])
    setCompanySuggestions([])
    setActiveIndex(-1)
    setCompanyActiveIndex(-1)
    setHazardous(false)
    setOneWay(false)
    setOverweight(0)
  }

  const rateColor = (): string => {
    if (hazardous || overweight > 0) return '#dc2626'
    return '#2563eb'
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <a href="/" className={styles.btnBack}>← 기점 선택</a>
          <h1>🚢 {port}</h1>
        </div>
        <a href="/admin" className={styles.btnAdmin}>⚙️ 관리자</a>
      </div>

      <SearchBox<Company>
        label="업체명 검색"
        placeholder="업체명 입력"
        query={companyQuery}
        setQuery={(val) => {
          setCompanyQuery(val)
          setSelectedRegion(null)
          setRates([])
          setCompanyActiveIndex(() => -1)
          if (val === '') setCompanySuggestions([])
        }}
        suggestions={companySuggestions}
        activeIndex={companyActiveIndex}
        setActiveIndex={setCompanyActiveIndex}
        onSelect={selectCompany}
        renderSuggestion={(c) => `${c.name} (${formatRegion(c)})`}
        onBlur={() =>
          setTimeout(() => {
            setCompanySuggestions([])
            setCompanyActiveIndex(() => -1)
          }, 200)
        }
      />

      <SearchBox<Region>
        label="행선지 검색"
        placeholder="시/도, 시/군/구, 읍/면/동 입력"
        query={query}
        setQuery={(val) => {
          setQuery(val)
          setSelectedRegion(null)
          setRates([])
          setActiveIndex(() => -1)
        }}
        suggestions={suggestions}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        onSelect={selectRegion}
        renderSuggestion={formatRegion}
        autoFocus
      />

      {rates.length > 0 && selectedRegion && (
        <>
          <RateResult
            region={selectedRegion}
            rate={rates[0]}
            rateColor={rateColor()}
            ft40Price={calcRate(rates[0].ft40_round)}
            ft20Price={calcRate(rates[0].ft20_round)}
          />

          <RateOptions
            oneWay={oneWay}
            setOneWay={setOneWay}
            hazardous={hazardous}
            setHazardous={setHazardous}
            overweight={overweight}
            setOverweight={setOverweight}
          />

          <button className={styles.btnReset} onClick={handleReset}>
            🔄 검색 초기화
          </button>
        </>
      )}
    </div>
  )
}
