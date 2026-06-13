import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import type { NumbersMap } from '@/lib/types'

const mockGetAllNumbers = vi.fn()

vi.mock('@/lib/kv', () => ({
  getAllNumbers: mockGetAllNumbers,
  reserveNumber: vi.fn(),
  adminReserveNumber: vi.fn(),
  confirmNumber: vi.fn(),
  undoConfirmNumber: vi.fn(),
  getNumber: vi.fn(),
  getConfig: vi.fn(),
}))

const ADMIN_TOKEN = 'test-admin-token-456'

beforeAll(() => {
  process.env.ADMIN_TOKEN = ADMIN_TOKEN
})

beforeEach(() => {
  vi.clearAllMocks()
})

const mockNumbers: NumbersMap = {
  '00': { status: 'available', reservedBy: null, reservedAt: null, confirmedAt: null },
  '01': {
    status: 'reserved',
    reservedBy: 'Juan',
    reservedAt: 1718100000000,
    confirmedAt: null,
  },
  '02': {
    status: 'sold',
    reservedBy: 'María',
    reservedAt: 1718090000000,
    confirmedAt: 1718100000000,
  },
}

describe('GET /api/export', () => {
  it('returns CSV with all numbers', async () => {
    mockGetAllNumbers.mockResolvedValue(mockNumbers)

    const { GET } = await import('@/app/api/export/route')
    const request = new Request(
      `http://localhost/api/export?token=${ADMIN_TOKEN}`
    )
    const response = await GET(request)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv')
    expect(response.headers.get('content-disposition')).toContain('.csv')

    const lines = text.trim().split('\n')
    expect(lines[0]).toBe('Numero,Estado,ReservadoPor,ReservadoEl,ConfirmadoEl')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain('00,disponible')
    expect(lines[2]).toContain('01,reservado,Juan')
    expect(lines[3]).toContain('02,vendido,María')
  })

  it('returns 401 without valid token', async () => {
    const { GET } = await import('@/app/api/export/route')
    const request = new Request('http://localhost/api/export')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
