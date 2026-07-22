import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock único de KV — vitest hojea todos los vi.mock al tope del archivo,
// así que tener dos del mismo módulo hace que el segundo pise al primero.
const mockCancelReservation = vi.fn()
const mockConfirmNumber = vi.fn()

vi.mock('@/lib/kv', () => ({
  cancelReservation: mockCancelReservation,
  confirmNumber: mockConfirmNumber,
  undoConfirmNumber: vi.fn(),
  renameNumber: vi.fn(),
  getAllNumbers: vi.fn(),
  getNumber: vi.fn(),
  reserveNumber: vi.fn(),
  adminReserveNumber: vi.fn(),
  getConfig: vi.fn(),
  clearImageCache: vi.fn(),
  getImageCache: vi.fn(),
  setImageCache: vi.fn(),
}))

const ADMIN_TOKEN = 'smoke-test-token-abc-123'

beforeAll(() => {
  process.env.ADMIN_TOKEN = ADMIN_TOKEN
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/numbers/[num]?action=cancel — smoke', () => {
  it('rechaza cancel sin token (401)', async () => {
    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      'http://localhost/api/numbers/05?action=cancel',
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '05' }) })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
    expect(mockCancelReservation).not.toHaveBeenCalled()
  })

  it('rechaza cancel con token inválido (401)', async () => {
    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      'http://localhost/api/numbers/05?token=wrong&action=cancel',
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '05' }) })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
    expect(mockCancelReservation).not.toHaveBeenCalled()
  })

  it('cancela un número reservado con token válido (200)', async () => {
    const cancelled = {
      status: 'available' as const,
      reservedBy: null,
      reservedAt: null,
      confirmedAt: null,
    }
    mockCancelReservation.mockResolvedValue(cancelled)

    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      `http://localhost/api/numbers/01?token=${ADMIN_TOKEN}&action=cancel`,
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '01' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(cancelled)
    expect(mockCancelReservation).toHaveBeenCalledWith('01')
  })

  it('devuelve 409 si el número no está reservado', async () => {
    mockCancelReservation.mockResolvedValue(null)

    const { PUT } = await import('@/app/api/numbers/[num]/route')
    const request = new NextRequest(
      `http://localhost/api/numbers/00?token=${ADMIN_TOKEN}&action=cancel`,
      { method: 'PUT' }
    )
    const response = await PUT(request, { params: Promise.resolve({ num: '00' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Number is not reserved')
    expect(mockCancelReservation).toHaveBeenCalledWith('00')
  })

  it('no se confunde con action=confirm (sin action param)', async () => {
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

    expect(response.status).toBe(200)
    expect(mockCancelReservation).not.toHaveBeenCalled()
    expect(mockConfirmNumber).toHaveBeenCalledWith('01')
  })
})
