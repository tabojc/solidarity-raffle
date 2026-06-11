import { NextResponse } from 'next/server'
import { getAllNumbers, reserveNumber } from '@/lib/kv'

export async function GET() {
  const numbers = await getAllNumbers()
  return NextResponse.json(numbers, {
    headers: { 'access-control-allow-origin': '*' },
  })
}

export async function POST(request: Request) {
  let body: { num?: string; reservedBy?: string }

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
