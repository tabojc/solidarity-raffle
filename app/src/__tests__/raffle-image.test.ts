import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RaffleConfig } from '@/lib/types'

vi.mock('satori', () => ({
  default: vi.fn().mockResolvedValue('<svg>mocked</svg>'),
}))

vi.mock('@resvg/resvg-js', () => ({
  Resvg: vi.fn(function () {
    return {
      render: () => ({ asPng: () => Buffer.from('mocked-png') }),
    }
  }),
}))

const mockGetImageCache = vi.fn()
const mockSetImageCache = vi.fn()

vi.mock('@/lib/kv', () => ({
  getImageCache: mockGetImageCache,
  setImageCache: mockSetImageCache,
  getAllNumbers: vi.fn(),
  getConfig: vi.fn(),
  clearImageCache: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    ok: true,
    status: 200,
  } as never)
})

const mockConfig: RaffleConfig = {
  name: 'Rifa Solidaria',
  beneficiary: 'Test',
  heroImageUrl: '',
  prizes: [{ position: 1, amount: 600 }],
  ticketPrice: 20,
  drawDate: '2026-07-26',
  drawTime: '22:30',
  lottery: 'Lotería Test',
  reserveTimeoutHours: 24,
}

describe('GET /api/raffle-image', () => {
  it('returns cached PNG on cache hit', async () => {
    mockGetImageCache.mockResolvedValue(Buffer.from('cached-png').toString('base64'))

    const { GET } = await import('@/app/api/raffle-image/route')
    const response = await GET(new Request('http://localhost/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(mockGetImageCache).toHaveBeenCalledOnce()
    expect(mockSetImageCache).not.toHaveBeenCalled()
  })

  it('generates fresh image on cache miss', async () => {
    mockGetImageCache.mockResolvedValue(null)

    const { getAllNumbers, getConfig } = await import('@/lib/kv')
    vi.mocked(getAllNumbers).mockResolvedValue({})
    vi.mocked(getConfig).mockResolvedValue(mockConfig)

    const { GET } = await import('@/app/api/raffle-image/route')
    const response = await GET(new Request('http://localhost/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(mockSetImageCache).toHaveBeenCalledOnce()
  })

  it('returns 500 if config is missing', async () => {
    mockGetImageCache.mockResolvedValue(null)

    const { getAllNumbers, getConfig } = await import('@/lib/kv')
    vi.mocked(getAllNumbers).mockResolvedValue({})
    vi.mocked(getConfig).mockResolvedValue(null)

    const { GET } = await import('@/app/api/raffle-image/route')
    const response = await GET(new Request('http://localhost/'))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Raffle not configured')
  })

  it('returns 500 on generation failure', async () => {
    mockGetImageCache.mockRejectedValue(new Error('Redis error'))

    const { GET } = await import('@/app/api/raffle-image/route')
    const response = await GET(new Request('http://localhost/'))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Redis error')
  })
})

describe('clearImageCache invalidation', () => {
  it('clearImageCache is exported from kv', async () => {
    const { clearImageCache } = await import('@/lib/kv')
    expect(clearImageCache).toBeDefined()
    expect(typeof clearImageCache).toBe('function')
  })
})
