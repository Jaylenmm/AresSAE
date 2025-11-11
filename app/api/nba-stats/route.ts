import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 5

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player')
  
  if (!playerName) {
    return NextResponse.json({ error: 'Player name required' }, { status: 400 })
  }
  
  try {
    const cacheKey = playerName.toLowerCase()
    
    // Read from Supabase cache
    const { data, error } = await supabase
      .from('nba_player_stats_cache')
      .select('stats_data, updated_at')
      .eq('player_name', cacheKey)
      .single()
    
    if (error || !data) {
      console.log(`❌ No cached stats for ${playerName}`)
      return NextResponse.json({ 
        error: 'Player stats not available. Stats are updated periodically.' 
      }, { status: 404 })
    }
    
    // Check if data is stale (older than 24 hours)
    const updatedAt = new Date(data.updated_at)
    const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceUpdate > 24) {
      console.log(`⚠️  Stats for ${playerName} are ${Math.floor(hoursSinceUpdate)} hours old`)
    }
    
    console.log(`✅ Loaded cached stats for ${playerName}`)
    return NextResponse.json(data.stats_data)
    
  } catch (error: any) {
    console.error('Error fetching cached stats:', error?.message || error)
    return NextResponse.json({ 
      error: 'Failed to fetch stats' 
    }, { status: 500 })
  }
}
