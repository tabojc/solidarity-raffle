import { NextResponse } from 'next/server'
import { confirmNumber } from '@/lib/kv'

function isAuthorized(request: Request): boolean {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  return token === process.env.ADMIN_TOKEN
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ num: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'access-control-allow-origin': '*' } }
    )
  }

  const { num } = await params
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
