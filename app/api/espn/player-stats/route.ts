// app/api/espn/player-stats/route.ts

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2'
const ESPN_CORE_URL = 'http://sports.core.api.espn.com/v2/sports'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const playerName = searchParams.get('player')
    const sport = searchParams.get('sport') || 'basketball'
    const season = parseInt(searchParams.get('season') || '2025')

    if (!playerName) {
      return NextResponse.json({ error: 'Player name required' }, { status: 400 })
    }

    // Step 1: Search for player
    const league = sport === 'basketball' ? 'nba' : sport === 'football' ? 'nfl' : 'mlb'
    const searchUrl = `${ESPN_BASE_URL}/sports/${sport}/${league}/athletes`
    
    const searchResponse = await axios.get(searchUrl, {
      params: { limit: 10 },
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    })
    
    const athletes = searchResponse.data.athletes || []
    const nameLower = playerName.toLowerCase()
    
    const found = athletes.find((athlete: any) => {
      const fullName = athlete.fullName?.toLowerCase() || ''
      const displayName = athlete.displayName?.toLowerCase() || ''
      return fullName.includes(nameLower) || displayName.includes(nameLower) || 
             nameLower.includes(fullName) || nameLower.includes(displayName)
    })
    
    if (!found) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const playerId = found.id
    console.log(`✅ Found player: ${found.displayName} (ID: ${playerId})`)

    // Step 2: Fetch player stats
    const sportPath = sport === 'basketball' ? 'basketball' : sport === 'football' ? 'football' : 'baseball'
    const playerUrl = `${ESPN_CORE_URL}/${sportPath}/leagues/${league}/seasons/${season}/athletes/${playerId}`
    const statsUrl = `${playerUrl}/statistics/0`
    
    const [playerResponse, statsResponse] = await Promise.all([
      axios.get(playerUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      }),
      axios.get(statsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      }).catch(() => null)
    ])
    
    const playerData = playerResponse.data
    const statsData = statsResponse?.data
    
    // Parse stats
    const stats: { [key: string]: number } = {}
    
    if (statsData?.splits?.categories) {
      statsData.splits.categories.forEach((category: any) => {
        category.stats?.forEach((stat: any) => {
          const statName = stat.name?.toLowerCase().replace(/\s+/g, '_')
          if (statName && typeof stat.value === 'number') {
            stats[statName] = stat.value
          }
        })
      })
    }
    
    return NextResponse.json({
      playerId,
      playerName: playerData.displayName || playerName,
      teamName: playerData.team?.displayName || '',
      position: playerData.position?.abbreviation || '',
      gamesPlayed: stats.games_played || 0,
      stats
    })
  } catch (error: any) {
    console.error('ESPN API error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch player stats', details: error.message },
      { status: 500 }
    )
  }
}