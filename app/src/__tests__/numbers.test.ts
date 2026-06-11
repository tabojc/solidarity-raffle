import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NumbersMap } from '@/lib/types'

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

const mockGetAllNumbers = vi.fn()
const mockGetNumber = vi.fn()
const mockReserveNumber = vi.fn()
const mockConfirmNumber = vi.fn()
const mockGetConfig = vi.fn()

vi.mock('@/lib/kv', () => ({
  getAllNumbers: mockGetAllNumbers,
  getNumber: mockGetNumber,
  reserveNumber: mockReserveNumber,
  confirmNumber: mockConfirmNumber,
  getConfig: mockGetConfig,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/numbers', () => {
  it('returns all numbers as JSON', async () => {
    mockGetAllNumbers.mockResolvedValue(mockNumbers)

    const { GET } = await import('@/app/api/numbers/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(body).toEqual(mockNumbers)
    expect(mockGetAllNumbers).toHaveBeenCalledOnce()
  })

  it('includes CORS headers for public access', async () => {
    mockGetAllNumbers.mockResolvedValue(mockNumbers)

    const { GET } = await import('@/app/api/numbers/route')
    const response = await GET()

    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('POST /api/numbers', () => {
  it('reserves an available number', async () => {
    const reserved = {
      status: 'reserved' as const,
      reservedBy: 'Juan',
      reservedAt: 1718100000000,
      confirmedAt: null,
    }
    mockReserveNumber.mockResolvedValue(reserved)

    const { POST } = await import('@/app/api/numbers/route')
    const request = new Request('http://localhost/api/numbers', {
      method: 'POST',
      body: JSON.stringify({ num: '05', reservedBy: 'Juan' }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(reserved)
    expect(mockReserveNumber).toHaveBeenCalledWith('05', 'Juan')
  })

  it('returns 400 if num is missing', async () => {
    const { POST } = await import('@/app/api/numbers/route')
    const request = new Request('http://localhost/api/numbers', {
      method: 'POST',
      body: JSON.stringify({ reservedBy: 'Juan' }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('returns 409 if number is already reserved', async () => {
    mockReserveNumber.mockResolvedValue(null)

    const { POST } = await import('@/app/api/numbers/route')
    const request = new Request('http://localhost/api/numbers', {
      method: 'POST',
      body: JSON.stringify({ num: '01' }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(409)
  })
})
