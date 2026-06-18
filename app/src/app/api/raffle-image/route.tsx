import { NextResponse } from 'next/server'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { getAllNumbers, getConfig, getImageCache, setImageCache } from '@/lib/kv'
import type { NumbersMap } from '@/lib/types'
import { readFileSync } from 'fs'
import { join } from 'path'

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
        <div
          style={{
            width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9',
            backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 32 }}>🎗️</span>
        </div>

        <span style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginTop: 10, textAlign: 'center' }}>
          {config.name}
        </span>
        <span style={{ fontSize: 13, color: '#64748b', marginTop: 2, textAlign: 'center' }}>
          Beneficiaria: {config.beneficiary}
        </span>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'center' }}>
          {config.prizes.map((p) => (
            <div key={p.position} style={{
              backgroundColor: '#fef2f2', borderRadius: 12, padding: '8px 14px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100,
            }}>
              <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{p.position}° Premio</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>${p.amount}</span>
            </div>
          ))}
        </div>

        <span style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Precio: ${config.ticketPrice}</span>

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
                      {num}{isReserved || isSold ? ' ❤️' : ''}
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
