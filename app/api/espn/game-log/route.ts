// app/api/espn/game-log/route.ts

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const playerId = searchParams.get('playerId')
    const sport = searchParams.get('sport') || 'basketball'

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const sportPath = sport === 'basketball' ? 'basketball/nba' : 
                     sport === 'football' ? 'football/nfl' : 'baseball/mlb'
    
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/athletes/${playerId}/gamelog`
    
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    
    if (!res.ok) {
      console.log(`Game log fetch failed: ${res.status}`)
      return NextResponse.json([])
    }
    
    const data = await res.json()
    const events = data.events || []
    const games: any[] = []
    
    for (const event of events.slice(0, 10)) {
      const stats: { [key: string]: number } = {};
      
      (event.statistics || []).forEach((category: any) => {
        (category.stats || []).forEach((stat: any) => {
          const name = (stat.name || '').toLowerCase().replace(/\s+/g, '_')
          const value = parseFloat(stat.value)
          if (name && !isNaN(value)) {
            stats[name] = value
          }
        })
      })
      
      games.push({
        date: event.gameDate || event.date || '',
        opponent: event.competition?.opponent?.displayName || 'Unknown',
        result: event.competition?.result || '',
        stats
      })
    }
    
    console.log(`Retrieved ${games.length} game logs for player ${playerId}`)
    return NextResponse.json(games)
    
  } catch (error: any) {
    console.error('Game log error:', error.message)
    return NextResponse.json([])
  }
}