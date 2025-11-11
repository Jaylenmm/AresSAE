import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getPlayerStats } from '@/lib/nba-stats-service'

// Run this as a cron job to pre-cache stats
export async function POST(request: NextRequest) {
  const { players } = await request.json()
  
  if (!players || !Array.isArray(players)) {
    return NextResponse.json({ error: 'Players array required' }, { status: 400 })
  }
  
  const results = []
  
  for (const playerName of players) {
    try {
      console.log(`Caching stats for ${playerName}...`)
      const stats = await getPlayerStats(playerName, 5)
      
      if (stats) {
        // Store in Supabase
        await supabase
          .from('nba_player_stats_cache')
          .upsert({
            player_name: playerName.toLowerCase(),
            stats_data: stats,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'player_name'
          })
        
        results.push({ player: playerName, status: 'cached' })
      } else {
        results.push({ player: playerName, status: 'not_found' })
      }
    } catch (error) {
      results.push({ player: playerName, status: 'error' })
    }
  }
  
  return NextResponse.json({ results })
}
