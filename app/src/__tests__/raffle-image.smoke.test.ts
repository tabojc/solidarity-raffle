import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { RaffleConfig } from '@/lib/types'

// Only mock KV — let satori / resvg / sharp run for real
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
})

function buildMockNumbers() {
  const numbers: Record<string, { status: string; reservedBy: string | null; reservedAt: number | null; confirmedAt: number | null }> = {}
  for (let i = 0; i < 100; i++) {
    const key = i.toString().padStart(2, '0')
    numbers[key] = { status: 'available', reservedBy: null, reservedAt: null, confirmedAt: null }
  }
  // Mark a few as reserved/sold to verify they render differently
  numbers['00'] = { status: 'reserved', reservedBy: 'Test User', reservedAt: Date.now(), confirmedAt: null }
  numbers['01'] = { status: 'sold', reservedBy: 'Buyer', reservedAt: Date.now(), confirmedAt: Date.now() }
  numbers['42'] = { status: 'reserved', reservedBy: 'Deep Thought', reservedAt: Date.now(), confirmedAt: null }
  return numbers
}

const mockConfig: RaffleConfig = {
  name: 'Rifa Solidaria — Test',
  beneficiary: 'Test Beneficiary',
  heroImageUrl: '',
  prizes: [
    { position: 1, amount: 600 },
    { position: 2, amount: 400 },
  ],
  ticketPrice: 20,
  drawDate: '2026-07-26',
  drawTime: '22:30',
  lottery: 'Lotería Test',
  reserveTimeoutHours: 24,
}

describe('GET /api/raffle-image — smoke', () => {
  it('generates a real PNG with satori + resvg', async () => {
    mockGetImageCache.mockResolvedValue(null)

    const { getAllNumbers, getConfig } = await import('@/lib/kv')
    vi.mocked(getAllNumbers).mockResolvedValue(buildMockNumbers())
    vi.mocked(getConfig).mockResolvedValue(mockConfig)

    const { GET } = await import('@/app/api/raffle-image/route')
    const response = await GET(new Request('http://localhost/api/raffle-image?refresh=1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')

    const blob = await response.blob()
    const buffer = Buffer.from(await blob.arrayBuffer())

    // Validar que sea un PNG real
    expect(buffer[0]).toBe(0x89) // PNG magic byte
    expect(buffer[1]).toBe(0x50) // P
    expect(buffer[2]).toBe(0x4e) // N
    expect(buffer[3]).toBe(0x47) // G
    expect(buffer.length).toBeGreaterThan(1000) // at least 1KB

    // Guardar a disco para inspección visual
    const outputDir = join(process.cwd(), '.smoke-output')
    mkdirSync(outputDir, { recursive: true })
    const outputPath = join(outputDir, 'raffle-image-smoke.png')
    writeFileSync(outputPath, buffer)
    console.log(`\n  ✅ Imagen guardada: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`)

    expect(mockSetImageCache).toHaveBeenCalledOnce()
  }, 30_000) // generous timeout for real rendering

  it('generates image with hero compositing', async () => {
    mockGetImageCache.mockResolvedValue(null)

    const { getAllNumbers, getConfig } = await import('@/lib/kv')
    vi.mocked(getAllNumbers).mockResolvedValue(buildMockNumbers())
    vi.mocked(getConfig).mockResolvedValue({
      ...mockConfig,
      heroImageUrl: '/hero-test.jpg',
    })

    // Create a tiny test image as hero
    const testHeroDir = join(process.cwd(), 'public')
    mkdirSync(testHeroDir, { recursive: true })
    const testHeroPath = join(testHeroDir, 'hero-test.jpg')
    // Generate a minimal valid JPEG
    const { default: sharp } = await import('sharp')
    const testHeroBuf = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).jpeg().toBuffer()
    writeFileSync(testHeroPath, testHeroBuf)

    try {
      const { GET } = await import('@/app/api/raffle-image/route')
      const response = await GET(new Request('http://localhost/api/raffle-image?refresh=1'))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')

      const blob = await response.blob()
      const buffer = Buffer.from(await blob.arrayBuffer())

      expect(buffer[0]).toBe(0x89)
      expect(buffer.length).toBeGreaterThan(1000)

      const outputDir = join(process.cwd(), '.smoke-output')
      mkdirSync(outputDir, { recursive: true })
      const outputPath = join(outputDir, 'raffle-image-hero.png')
      writeFileSync(outputPath, buffer)
      console.log(`\n  ✅ Imagen con hero guardada: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`)
    } finally {
      // Cleanup test hero
      try { const rm = await import('fs/promises'); await rm.rm(testHeroPath) } catch {}
    }
  }, 30_000)
})
