import type { Region } from './types'

export const API_BASE = import.meta.env.VITE_API_BASE || ''

export function formatRegion(r: Region): string {
  return `${r.sido} ${r.sigungu} ${r.eupmyeondong}`
}
