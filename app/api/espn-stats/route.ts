import { NextRequest, NextResponse } from 'next/server'
import { getNFLPlayerStats, getMLBPlayerStats, getNHLPlayerStats } from '@/lib/espn-stats-service'

export const maxDuration = 15

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player')
  const sport = searchParams.get('sport') // 'nfl', 'mlb', or 'nhl'
  
  if (!playerName || !sport) {
    return NextResponse.json({ 
      error: 'Player name and sport required' 
    }, { status: 400 })
  }
  
  try {
    console.log(`Fetching ${sport.toUpperCase()} stats for ${playerName}...`)
    
    let stats = null
    
    switch (sport.toLowerCase()) {
      case 'nfl':
      case 'football':
        stats = await getNFLPlayerStats(playerName)
        break
      case 'mlb':
      case 'baseball':
        stats = await getMLBPlayerStats(playerName)
        break
      case 'nhl':
      case 'hockey':
        stats = await getNHLPlayerStats(playerName)
        break
      default:
        return NextResponse.json({ 
          error: `Unsupported sport: ${sport}` 
        }, { status: 400 })
    }
    
    if (!stats) {
      return NextResponse.json({ 
        error: 'Player not found' 
      }, { status: 404 })
    }
    
    console.log(`✅ Successfully fetched ${sport.toUpperCase()} stats for ${playerName}`)
    return NextResponse.json(stats)
    
  } catch (error: any) {
    console.error(`Error fetching ${sport} stats:`, error?.message || error)
    return NextResponse.json({ 
      error: 'Failed to fetch stats',
      details: error?.message 
    }, { status: 500 })
  }
}
