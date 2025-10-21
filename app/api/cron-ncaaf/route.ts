import { NextResponse } from 'next/server'

export const maxDuration = 300

export async function GET(request: Request) {
  const url = new URL(request.url)
  const keyParam = url.searchParams.get('key')
  const authorized = keyParam && keyParam === process.env.CRON_SECRET
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = url.origin
  const resp = await fetch(`${origin}/api/collect-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sport: 'NCAAF' })
  })
  const data = await resp.json().catch(() => ({}))
  return NextResponse.json({ success: true, sport: 'NCAAF', details: data?.details || data || {} })
}
