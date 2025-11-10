import { NextRequest, NextResponse } from 'next/server'
import { getPlayerStats } from '@/lib/nba-stats-service'

// Cache stats for 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Vercel timeout is 10s for hobby plan, 60s for pro
export const maxDuration = 10

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
    
    // Race against timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 8000)
    )
    
    const stats = await Promise.race([
      getPlayerStats(playerName, 5),
      timeoutPromise
    ]) as any
    
    if (!stats) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    
    // Cache the result
    cache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    })
    
    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Error fetching NBA stats:', error?.message || error)
    
    if (error?.message === 'Request timeout') {
      return NextResponse.json({ 
        error: 'NBA stats service timeout - try again' 
      }, { status: 504 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch stats' 
    }, { status: 500 })
  }
}
