import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (token && token === process.env.ADMIN_TOKEN) {
    return NextResponse.json({ valid: true }, {
      headers: { 'access-control-allow-origin': '*' },
    })
  }

  return NextResponse.json(
    { valid: false, error: 'Token inválido' },
    {
      status: 401,
      headers: { 'access-control-allow-origin': '*' },
    }
  )
}
