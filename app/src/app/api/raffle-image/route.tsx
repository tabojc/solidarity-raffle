import { NextResponse } from 'next/server'
import satori from 'satori'
import { getAllNumbers, getConfig, getImageCache, setImageCache } from '@/lib/kv'
import type { NumbersMap } from '@/lib/types'
import { readFileSync } from 'fs'
import { join } from 'path'

// Native modules (sharp, @resvg/resvg-js) are imported dynamically inside the
// handler so their native binary failures are caught by our try/catch and
// reported clearly instead of crashing the module load at import time.

const CELL = 49
const GAP = 2
const GRID_PADDING = 14

const FONT_NAME = 'Inter'

function loadFont() {
  return [
    { name: FONT_NAME, data: readFileSync(join(process.cwd(), 'public/fonts/Inter-Regular.ttf')).buffer as ArrayBuffer, weight: 400 as const, style: 'normal' as const },
    { name: FONT_NAME, data: readFileSync(join(process.cwd(), 'public/fonts/Inter-Bold.ttf')).buffer as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
  ]
}

function toRows(numbers: NumbersMap): { num: string; status: string }[][] {
  const entries = Object.entries(numbers).sort(([a], [b]) => a.localeCompare(b))
  const rows: { num: string; status: string }[][] = []
  for (let i = 0; i < 10; i++) {
    rows.push(entries.slice(i * 10, i * 10 + 10).map(([num, data]) => ({ num, status: data.status })))
  }
  return rows
}

export async function GET(request: Request) {
  const t0 = performance.now()

  // --- dynamic native module init ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Resvg: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharp: any
  try {
    ;({ Resvg } = await import('@resvg/resvg-js'))
    sharp = (await import('sharp')).default
  } catch (nativeErr) {
    const msg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr)
    console.error('[raffle-image] native module init failed:', nativeErr)
    return NextResponse.json({
      error: 'Image generation unavailable — native modules failed to load',
      detail: msg,
    }, { status: 500 })
  }
  // --- end native module init ---

  try {
    const refresh = new URL(request.url).searchParams.get('refresh') === '1'
    if (!refresh) {
      const cached = await getImageCache()
      if (cached) {
        const buf = Buffer.from(cached, 'base64')
        return new NextResponse(new Uint8Array(buf), {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
        })
      }
    }

    const [numbers, config] = await Promise.all([getAllNumbers(), getConfig()])
    if (!config) {
      return NextResponse.json({ error: 'Raffle not configured' }, { status: 500 })
    }
    const t1 = performance.now()
    console.log(`[raffle-image] data fetch: ${(t1 - t0).toFixed(0)}ms`)

    let heroBuf: Buffer | null = null
    if (config.heroImageUrl) {
      const filePath = join(process.cwd(), 'public', config.heroImageUrl.replace(/^\//, ''))
      try { heroBuf = readFileSync(filePath) } catch {
        console.error(`[raffle-image] hero file not found: ${filePath}`)
      }
    }

    const fonts = loadFont()
    const rows = toRows(numbers)

    const svg = await satori(
      <div
        style={{
          width: 540, height: 960, backgroundColor: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '24px 16px', fontFamily: FONT_NAME,
        }}
      >
        <div style={{ display: 'flex', gap: 14, marginTop: 10, alignSelf: 'flex-start' }}>
          <div style={{
            width: 200, height: 200, borderRadius: 100, backgroundColor: '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <span style={{ fontSize: 60, color: '#64748b' }}>🎗️</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
              {config.name}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Beneficiaria: {config.beneficiary}
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {config.prizes.map((p) => (
                <div key={p.position} style={{
                  backgroundColor: '#fef2f2', borderRadius: 12, padding: '6px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>{p.position}° Premio</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>${p.amount}</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#64748b' }}>Precio: ${config.ticketPrice}</span>
          </div>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: GAP, marginTop: 12,
          padding: GRID_PADDING, backgroundColor: '#f8fafc', borderRadius: 16, width: 508,
        }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: GAP }}>
              {row.map(({ num, status }) => {
                const isReserved = status === 'reserved'
                const isSold = status === 'sold'
                const bg = isSold ? '#dc2626' : isReserved ? '#f43f5e' : '#f1f5f9'
                const color = isReserved || isSold ? '#fff' : '#1e293b'
                return (
                  <div key={num} style={{
                    width: CELL, height: CELL, backgroundColor: bg, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color }}>
                      {num}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <span style={{ fontSize: 12, color: '#64748b', marginTop: 14, textAlign: 'center' }}>
          Métodos de pago: Transferencia, Pago Móvil, Zelle
        </span>

        <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, marginTop: 6, textAlign: 'center' }}>
          Sorteo: {config.drawDate} — {config.drawTime}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{config.lottery}</span>

        <span style={{ marginTop: 'auto', fontSize: 11, color: '#cbd5e1', paddingBottom: 4 }}>
          rifa-solidaria.vercel.app
        </span>
      </div>,
      { width: 540, height: 960, fonts },
    )
    const t2 = performance.now()
    console.log(`[raffle-image] satori: ${(t2 - t1).toFixed(0)}ms`)

    let pngBuffer = new Resvg(svg, { fitTo: { mode: 'width', value: 540 } }).render().asPng()
    const t3 = performance.now()
    console.log(`[raffle-image] resvg: ${(t3 - t2).toFixed(0)}ms`)

    if (heroBuf) {
      try {
        const circleSvg = Buffer.from('<svg><circle cx="100" cy="100" r="100" fill="white"/></svg>')
        const heroCircular = await sharp(heroBuf)
          .resize(200, 200, { fit: 'cover' })
          .composite([{ input: circleSvg, blend: 'dest-in' }])
          .png()
          .toBuffer()

        pngBuffer = await sharp(pngBuffer)
          .composite([{ input: heroCircular, top: 34, left: 16 }])
          .png()
          .toBuffer()
      } catch (heroErr) {
        console.error('[raffle-image] hero compositing failed, skipping:', heroErr)
      }
    }
    const t4 = performance.now()
    console.log(`[raffle-image] sharp: ${(t4 - t3).toFixed(0)}ms`)

    const base64 = pngBuffer.toString('base64')
    await setImageCache(base64)

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (error) {
    console.error('[raffle-image] Error generating raffle image:', error)
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json({
      error: msg,
      ...(stack ? { stack: stack.split('\n').slice(0, 6).join('\n') } : {}),
      t: performance.now() - t0,
    }, { status: 500 })
  }
}
