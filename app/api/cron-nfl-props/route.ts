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
    body: JSON.stringify({
      sport: 'NFL',
      skipAlternates: true,
      skipProps: false,
      hoursAhead: 12,
      bookmakerKeys: ['draftkings', 'fanduel', 'betmgm', 'caesars', 'espnbet']
    })
  })
  const data = await resp.json().catch(() => ({}))
  return NextResponse.json({ success: true, sport: 'NFL', phase: 'props', details: data?.details || data || {} })
}
