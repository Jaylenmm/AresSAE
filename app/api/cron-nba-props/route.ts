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
  const window = Number(url.searchParams.get('window') || 48)
  const booksParam = url.searchParams.get('books') || ''
  const books = booksParam
    ? booksParam.split(',').map(s => s.trim()).filter(Boolean)
    : ['fanduel', 'betonlineag', 'lowvig', 'draftkings', 'betmgm', 'caesars', 'espnbet']  // Sharp-ish + soft for consensus
  const resp = await fetch(`${origin}/api/collect-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sport: 'NBA',
      skipAlternates: true,
      skipProps: false,
      startHoursAhead: isFinite(start) && start >= 0 ? start : 0,
      windowHours: isFinite(window) && window > 0 ? window : 48,
      bookmakerKeys: books
    })
  })
  const data = await resp.json().catch(() => ({}))
  return NextResponse.json({ success: true, sport: 'NBA', phase: 'props', details: data?.details || data || {} })
}
