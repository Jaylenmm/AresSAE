import { NextRequest, NextResponse } from 'next/server'
import { getPlayerStats } from '@/lib/nba-stats-service'

// Cache stats for 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player')
  
  if (!playerName) {
    return NextResponse.json({ error: 'Player name required' }, { status: 400 })
  }
  
  // Check cache
  const cacheKey = playerName.toLowerCase()
  const cached = cache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`✅ Cache hit for ${playerName}`)
    return NextResponse.json(cached.data)
  }
  
  try {
    console.log(`Fetching NBA stats for ${playerName}...`)
    const stats = await getPlayerStats(playerName, 5)
    
    if (!stats) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    
    // Cache the result
    cache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    })
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching NBA stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
