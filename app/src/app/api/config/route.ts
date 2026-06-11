import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/kv'

export async function GET() {
  const config = await getConfig()
  if (!config) {
    return NextResponse.json(
      { error: 'Config not found' },
      { status: 404, headers: { 'access-control-allow-origin': '*' } }
    )
  }
  return NextResponse.json(config, {
    headers: { 'access-control-allow-origin': '*' },
  })
}
