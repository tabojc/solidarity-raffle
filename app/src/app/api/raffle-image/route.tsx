import { NextResponse } from 'next/server'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { getAllNumbers, getConfig, getImageCache, setImageCache } from '@/lib/kv'
import type { NumbersMap } from '@/lib/types'

const CELL = 49
const GAP = 2
const GRID_PADDING = 14
const FONT_URL = 'https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans'

let fontPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[]> | null = null

async function loadFont() {
  if (fontPromise) return fontPromise
  fontPromise = Promise.all([
    fetch(`${FONT_URL}/Geist-Regular.woff2`).then(r => r.arrayBuffer()),
    fetch(`${FONT_URL}/Geist-Bold.woff2`).then(r => r.arrayBuffer()),
  ]).then(([regular, bold]) => [
    { name: 'Geist Sans', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Geist Sans', data: bold, weight: 700 as const, style: 'normal' as const },
  ])
  return fontPromise
}

function toRows(numbers: NumbersMap): { num: string; status: string }[][] {
  const entries = Object.entries(numbers).sort(([a], [b]) => a.localeCompare(b))
  const rows: { num: string; status: string }[][] = []
  for (let i = 0; i < 10; i++) {
    rows.push(entries.slice(i * 10, i * 10 + 10).map(([num, data]) => ({ num, status: data.status })))
  }
  return rows
}

export async function GET() {
  try {
    const cached = await getImageCache()
    if (cached) {
      const buf = Buffer.from(cached, 'base64')
      return new NextResponse(new Uint8Array(buf), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
      })
    }

    const [numbers, config] = await Promise.all([getAllNumbers(), getConfig()])
    if (!config) {
      return NextResponse.json({ error: 'Raffle not configured' }, { status: 500 })
    }

    const fonts = await loadFont()
    const rows = toRows(numbers)

    const svg = await satori(
      <div
        style={{
          width: 540, height: 960, backgroundColor: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '24px 16px', fontFamily: 'Geist Sans',
        }}
      >
        <div
          style={{
            width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9',
            backgroundImage: config.heroImageUrl ? `url(${config.heroImageUrl})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}
        >
          {!config.heroImageUrl && <span style={{ fontSize: 32 }}>🎗️</span>}
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 10, textAlign: 'center' }}>
          {config.name}
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2, textAlign: 'center' }}>
          Beneficiaria: {config.beneficiary}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'center' }}>
          {config.prizes.map((p) => (
            <div key={p.position} style={{
              backgroundColor: '#fef2f2', borderRadius: 12, padding: '8px 14px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100,
            }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{p.position}° Premio</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>${p.amount}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Precio: ${config.ticketPrice}</div>

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
                    fontSize: 18, fontWeight: 700, color,
                  }}>
                    {num}
                    {(isReserved || isSold) && <span style={{ fontSize: 14, marginLeft: 1 }}>❤️</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#64748b', marginTop: 14, textAlign: 'center' }}>
          Métodos de pago: Transferencia, Pago Móvil, Zelle
        </div>

        <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, marginTop: 6, textAlign: 'center' }}>
          Sorteo: {config.drawDate} — {config.drawTime}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{config.lottery}</div>

        <div style={{ marginTop: 'auto', fontSize: 11, color: '#cbd5e1', paddingBottom: 4 }}>
          rifa-solidaria.vercel.app
        </div>
      </div>,
      { width: 540, height: 960, fonts },
    )

    const pngBuffer = new Resvg(svg, { fitTo: { mode: 'width', value: 540 } }).render().asPng()
    const base64 = pngBuffer.toString('base64')
    void setImageCache(base64)

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (error) {
    console.error('Error generating raffle image:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
