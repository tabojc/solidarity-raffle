import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAllNumbers, reserveNumber, adminReserveNumber } from '@/lib/kv'
import { rateLimit } from '@/lib/rate-limit'

export async function GET() {
  const numbers = await getAllNumbers()
  return NextResponse.json(numbers, {
    headers: { 'access-control-allow-origin': '*' },
  })
}

export async function POST(request: NextRequest) {
  let body: { num?: string; reservedBy?: string; adminToken?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: { 'access-control-allow-origin': '*' } }
    )
  }

  if (!body.num) {
    return NextResponse.json(
      { error: 'num is required' },
      { status: 400, headers: { 'access-control-allow-origin': '*' } }
    )
  }

  const isAdmin = body.adminToken && body.adminToken === process.env.ADMIN_TOKEN

  if (isAdmin) {
    if (!body.reservedBy) {
      return NextResponse.json(
        { error: 'reservedBy is required for admin reservation' },
        { status: 400, headers: { 'access-control-allow-origin': '*' } }
      )
    }
    const result = await adminReserveNumber(body.num, body.reservedBy)
    return NextResponse.json(result, {
      headers: { 'access-control-allow-origin': '*' },
    })
  }

  const ip = request.headers.get("x-forwarded-for") ?? "anonymous"
  const { allowed, retryAfter } = rateLimit(ip, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." },
      {
        status: 429,
        headers: {
          "retry-after": String(retryAfter),
          "access-control-allow-origin": "*",
        },
      }
    )
  }

  const result = await reserveNumber(body.num, body.reservedBy)
  if (!result) {
    return NextResponse.json(
      { error: 'Number is not available' },
      { status: 409, headers: { 'access-control-allow-origin': '*' } }
    )
  }

  return NextResponse.json(result, {
    headers: { 'access-control-allow-origin': '*' },
  })
}
