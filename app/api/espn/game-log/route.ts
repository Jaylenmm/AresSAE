// app/api/espn/game-log/route.ts

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const ESPN_CORE_URL = 'http://sports.core.api.espn.com/v2/sports'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const playerId = searchParams.get('playerId')
    const sport = searchParams.get('sport') || 'basketball'
    const season = parseInt(searchParams.get('season') || '2025')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const league = sport === 'basketball' ? 'nba' : sport === 'football' ? 'nfl' : 'mlb'
    const sportPath = sport === 'basketball' ? 'basketball' : sport === 'football' ? 'football' : 'baseball'
    const eventLogUrl = `${ESPN_CORE_URL}/${sportPath}/leagues/${league}/seasons/${season}/athletes/${playerId}/eventlog`
    
    const response = await axios.get(eventLogUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    })
    
    const events = response.data.events || []
    const gameLogs = []
    
    for (const event of events.slice(0, limit)) {
      try {
        const eventUrl = event.$ref
        const eventResponse = await axios.get(eventUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
          }
        })
        const eventData = eventResponse.data
        
        const stats: { [key: string]: number } = {}
        
        if (eventData.statistics?.categories) {
          eventData.statistics.categories.forEach((category: any) => {
            category.stats?.forEach((stat: any) => {
              const statName = stat.name?.toLowerCase().replace(/\s+/g, '_')
              if (statName && typeof stat.value === 'number') {
                stats[statName] = stat.value
              }
            })
          })
        }
        
        gameLogs.push({
          date: eventData.date || '',
          opponent: eventData.opponent?.displayName || 'Unknown',
          result: eventData.didWin ? 'W' : 'L',
          stats
        })
      } catch (err) {
        console.error('Error fetching individual game:', err)
        continue
      }
    }
    
    return NextResponse.json(gameLogs)
  } catch (error: any) {
    console.error('ESPN Game Log API error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch game log', details: error.message },
      { status: 500 }
    )
  }
}