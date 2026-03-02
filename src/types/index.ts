export interface Rate {
    id: number
    sido: string
    sigungu: string
    eupmyeondong: string
    distance_km: number
    ft40_round: number
    ft20_round: number
}

export interface Region {
    sido: string
    sigungu: string
    eupmyeondong: string
}

export interface Company {
    id: number
    name: string
    sido: string
    sigungu: string
    eupmyeondong: string
}

export interface PortItem {
    port: string
}
