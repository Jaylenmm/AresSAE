// app/api/player-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPlayerPerformance, searchPlayer } from '@/lib/espn-stats'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const playerName = searchParams.get('player')
    const sport = searchParams.get('sport') as 'football' | 'basketball' | 'baseball'
    
    if (!playerName || !sport) {
      return NextResponse.json(
        { error: 'Missing player name or sport' },
        { status: 400 }
      )
    }
    
    // Check cache first
    const { data: cachedPlayer } = await supabase
      .from('player_espn_ids')
      .select('espn_id')
      .eq('player_name', playerName)
      .eq('sport', sport)
      .single()
    
    let espnId = cachedPlayer?.espn_id
    
    // If not cached, search for player
    if (!espnId) {
      espnId = await searchPlayer(playerName, sport)
      
      if (espnId) {
        // Cache the result
        await supabase
          .from('player_espn_ids')
          .upsert({
            player_name: playerName,
            espn_id: espnId,
            sport: sport,
            updated_at: new Date().toISOString()
          })
      } else {
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 }
        )
      }
    }
    
    // Fetch player performance data
    const performance = await getPlayerPerformance(playerName, sport)
    
    if (!performance) {
      return NextResponse.json(
        { error: 'Could not fetch player stats' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      playerName,
      sport,
      espnId,
      ...performance
    })
    
  } catch (error) {
    console.error('Error in player-stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
