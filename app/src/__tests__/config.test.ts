import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RaffleConfig } from '@/lib/types'

const mockGetConfig = vi.fn()

vi.mock('@/lib/kv', () => ({
  getConfig: mockGetConfig,
  getAllNumbers: vi.fn(),
  reserveNumber: vi.fn(),
  adminReserveNumber: vi.fn(),
  confirmNumber: vi.fn(),
  undoConfirmNumber: vi.fn(),
  cancelReservation: vi.fn(),
  getNumber: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const mockConfig: RaffleConfig = {
  name: 'Rifa Solidaria',
  beneficiary: '[Beneficiary Name]',
  heroImageUrl: '',
  prizes: [
    { position: 1, amount: 600 },
    { position: 2, amount: 400 },
  ],
  ticketPrice: 20,
  drawDate: '2026-07-26',
  drawTime: '22:30',
  lottery: 'Lotería Táchira A y B',
  reserveTimeoutHours: 24,
}

describe('GET /api/config', () => {
  it('returns raffle config as JSON', async () => {
    mockGetConfig.mockResolvedValue(mockConfig)

    const { GET } = await import('@/app/api/config/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(body).toEqual(mockConfig)
    expect(mockGetConfig).toHaveBeenCalledOnce()
  })

  it('returns 404 if no config found', async () => {
    mockGetConfig.mockResolvedValue(null)

    const { GET } = await import('@/app/api/config/route')
    const response = await GET()

    expect(response.status).toBe(404)
  })
})
