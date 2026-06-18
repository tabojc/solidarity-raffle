import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { confirmNumber, undoConfirmNumber, cancelReservation, renameNumber } from '@/lib/kv'
import { rateLimit } from '@/lib/rate-limit'

function isAuthorized(request: Request): boolean {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  return token === process.env.ADMIN_TOKEN
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ num: string }> }
) {
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

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'access-control-allow-origin': '*' } }
    )
  }

  const { num } = await params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'undo') {
    const result = await undoConfirmNumber(num)
    if (!result) {
      return NextResponse.json(
        { error: 'Number is not sold' },
        { status: 409, headers: { 'access-control-allow-origin': '*' } }
      )
    }
    return NextResponse.json(result, {
      headers: { 'access-control-allow-origin': '*' },
    })
  }

  if (action === 'cancel') {
    const result = await cancelReservation(num)
    if (!result) {
      return NextResponse.json(
        { error: 'Number is not reserved' },
        { status: 409, headers: { 'access-control-allow-origin': '*' } }
      )
    }
    return NextResponse.json(result, {
      headers: { 'access-control-allow-origin': '*' },
    })
  }

  if (action === 'rename') {
    let body: { reservedBy?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: { 'access-control-allow-origin': '*' } }
      )
    }
    if (!body.reservedBy) {
      return NextResponse.json(
        { error: 'reservedBy is required' },
        { status: 400, headers: { 'access-control-allow-origin': '*' } }
      )
    }
    const result = await renameNumber(num, body.reservedBy)
    if (!result) {
      return NextResponse.json(
        { error: 'Number is available' },
        { status: 409, headers: { 'access-control-allow-origin': '*' } }
      )
    }
    return NextResponse.json(result, {
      headers: { 'access-control-allow-origin': '*' },
    })
  }

  const result = await confirmNumber(num)

  if (!result) {
    return NextResponse.json(
      { error: 'Number is not reserved' },
      { status: 409, headers: { 'access-control-allow-origin': '*' } }
    )
  }

  return NextResponse.json(result, {
    headers: { 'access-control-allow-origin': '*' },
  })
}
