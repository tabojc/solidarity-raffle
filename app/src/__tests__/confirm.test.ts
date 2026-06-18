import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetNumber = vi.fn()
const mockConfirmNumber = vi.fn()
const mockUndoConfirmNumber = vi.fn()

vi.mock('@/lib/kv', () => ({
  getNumber: mockGetNumber,
  confirmNumber: mockConfirmNumber,
  undoConfirmNumber: mockUndoConfirmNumber,
  cancelReservation: vi.fn(),
  getAllNumbers: vi.fn(),
  reserveNumber: vi.fn(),
  adminReserveNumber: vi.fn(),
  getConfig: vi.fn(),
}))

const ADMIN_TOKEN = 'test-admin-token-123'

beforeAll(() => {
  process.env.ADMIN_TOKEN = ADMIN_TOKEN
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/numbers/[num]', () => {
  it('confirms a reserved number with valid token', async () => {
    const confirmed = {
      status: 'sold' as const,
      reservedBy: 'Juan',
      reservedAt: 1718100000000,
      confirmedAt: 1718105000000,
    }
    mockConfirmNumber.mockResolvedValue(confirmed)

    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      `http://localhost/api/numbers/01?token=${ADMIN_TOKEN}`,
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '01' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(confirmed)
    expect(mockConfirmNumber).toHaveBeenCalledWith('01')
  })

  it('returns 401 without token', async () => {
    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest('http://localhost/api/numbers/01', {
      method: 'PUT',
    })
    const response = await PUT(request, { params: Promise.resolve({ num: '01' }) })

    expect(response.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      'http://localhost/api/numbers/01?token=wrong',
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '01' }) })

    expect(response.status).toBe(401)
  })

  it('returns 409 if number is not reserved', async () => {
    mockConfirmNumber.mockResolvedValue(null)

    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      `http://localhost/api/numbers/00?token=${ADMIN_TOKEN}`,
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '00' }) })

    expect(response.status).toBe(409)
  })

  it('undoes a sold number with action=undo', async () => {
    const undone = {
      status: 'reserved' as const,
      reservedBy: 'Juan',
      reservedAt: 1718100000000,
      confirmedAt: null,
    }
    mockUndoConfirmNumber.mockResolvedValue(undone)

    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      `http://localhost/api/numbers/01?token=${ADMIN_TOKEN}&action=undo`,
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '01' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(undone)
    expect(mockUndoConfirmNumber).toHaveBeenCalledWith('01')
  })

  it('returns 409 if undoing an unreserved number', async () => {
    mockUndoConfirmNumber.mockResolvedValue(null)

    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      `http://localhost/api/numbers/00?token=${ADMIN_TOKEN}&action=undo`,
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '00' }) })

    expect(response.status).toBe(409)
  })
})
