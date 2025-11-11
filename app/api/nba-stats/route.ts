import { NextRequest, NextResponse } from 'next/server'
import { getPlayerStats } from '@/lib/nba-stats-service'

export const maxDuration = 10

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player')
  
  if (!playerName) {
    return NextResponse.json({ error: 'Player name required' }, { status: 400 })
  }
  
  try {
    console.log(`Fetching NBA stats for ${playerName} via Vercel function...`)
    
    const stats = await getPlayerStats(playerName, 5)
    
    if (!stats) {
      return NextResponse.json({ 
        error: 'Player not found' 
      }, { status: 404 })
    }
    
    console.log(`✅ Successfully fetched stats for ${playerName}`)
    return NextResponse.json(stats)
    
  } catch (error: any) {
    console.error('Error fetching NBA stats:', error?.message || error)
    return NextResponse.json({ 
      error: 'Failed to fetch stats',
      details: error?.message 
    }, { status: 500 })
  }
}
