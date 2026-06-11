import { NextResponse } from 'next/server'
import { getAllNumbers } from '@/lib/kv'

function isAuthorized(request: Request): boolean {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  return token === process.env.ADMIN_TOKEN
}

function formatDate(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toCsv(numbers: Record<string, { status: string; reservedBy: string | null; reservedAt: number | null; confirmedAt: number | null }>): string {
  const header = 'Numero,Estado,ReservadoPor,ReservadoEl,ConfirmadoEl'
  const rows = Object.entries(numbers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([num, data]) => {
      const estado = data.status === 'available' ? 'disponible'
        : data.status === 'reserved' ? 'reservado'
        : 'vendido'
      return `${num},${estado},${data.reservedBy ?? ''},${formatDate(data.reservedAt)},${formatDate(data.confirmedAt)}`
    })
  return [header, ...rows].join('\n')
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const numbers = await getAllNumbers()
  const csv = toCsv(numbers)

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv',
      'content-disposition': 'attachment; filename="rifa-solidaria.csv"',
    },
  })
}
