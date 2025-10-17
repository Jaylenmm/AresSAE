import { NextRequest, NextResponse } from 'next/server'

const SPORT_PATH_MAP: { [key: string]: string } = {
  'basketball': 'basketball/nba',
  'football': 'football/nfl',
  'baseball': 'baseball/mlb'
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const playerId = searchParams.get('playerId')
    const sport = searchParams.get('sport') || 'basketball'
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!playerId) {
      return NextResponse.json([])
    }

    const sportPath = SPORT_PATH_MAP[sport]
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/${sportPath}/athletes/${playerId}/overview`
    
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json([])
    
    const data = await res.json()
    const games: any[] = []
    
    // Get from last5Games or recentGames
    const recentGames = data.lastFiveGames || data.recentGames || []
    
    for (const game of recentGames.slice(0, limit)) {
      const stats: { [key: string]: number } = {}
      
      if (game.statistics) {
        game.statistics.forEach((stat: any) => {
          const name = stat.name.toLowerCase().replace(/\s+/g, '_')
          const value = parseFloat(stat.value || '0')
          if (!isNaN(value)) stats[name] = value
        })
      }
      
      games.push({
        date: game.gameDate || '',
        opponent: game.opponent?.displayName || '',
        result: game.gameResult || '',
        stats
      })
    }
    
    console.log(`✅ ${games.length} games, sample stats:`, games[0]?.stats ? Object.keys(games[0].stats) : 'none')
    return NextResponse.json(games)
    
  } catch (error) {
    return NextResponse.json([])
  }
}