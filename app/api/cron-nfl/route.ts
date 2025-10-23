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
  const start = Number(url.searchParams.get('start') || 0)
  const window = Number(url.searchParams.get('window') || 12)
  const resp = await fetch(`${origin}/api/collect-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sport: 'NFL',
      skipAlternates: true,
      skipProps: true,
      startHoursAhead: isFinite(start) && start >= 0 ? start : 0,
      windowHours: isFinite(window) && window > 0 ? window : 12,
      bookmakerKeys: ['pinnacle', 'circa']
    })
  })
  const data = await resp.json().catch(() => ({}))
  return NextResponse.json({ success: true, sport: 'NFL', details: data?.details || data || {} })
}
