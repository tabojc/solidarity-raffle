export type NumberStatus = 'available' | 'reserved' | 'sold'

export interface RaffleNumber {
  status: NumberStatus
  reservedBy: string | null
  reservedAt: number | null
  confirmedAt: number | null
}

export interface RaffleConfig {
  name: string
  beneficiary: string
  prizes: { position: number; amount: number }[]
  ticketPrice: number
  drawDate: string
  drawTime: string
  lottery: string
  reserveTimeoutHours: number
}

export type NumbersMap = Record<string, RaffleNumber>
