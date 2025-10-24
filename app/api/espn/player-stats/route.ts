// app/api/espn/player-stats/route.ts - SIMPLE SEARCH API VERSION

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const playerName = searchParams.get('player')
    const sport = searchParams.get('sport') || 'basketball'

    if (!playerName) {
      return NextResponse.json({ error: 'Player name required' }, { status: 400 })
    }

    console.log(`Searching for ${playerName} in ${sport}`)

    const sportPath = sport === 'basketball' ? 'basketball/nba' : 
                     sport === 'football' ? 'football/nfl' : 'baseball/mlb'
    
    // Use core API to get all athletes, then filter
    const athletesUrl = `https://sports.core.api.espn.com/v2/sports/${sportPath.split('/')[0]}/leagues/${sportPath.split('/')[1]}/athletes?limit=10000`
    
    const athletesRes = await fetch(athletesUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 } // Cache for 1 hour
    })
    
    if (!athletesRes.ok) {
      console.log(`Athletes fetch failed: ${athletesRes.status}`)
      return NextResponse.json({ error: 'Failed to fetch athletes' }, { status: 500 })
    }
    
    const athletesData = await athletesRes.json()
    const athletes = athletesData.items || []
    
    // Search for player by name
    const nameLower = playerName.toLowerCase().trim()
    let foundPlayer: any = null
    
    for (const athleteRef of athletes) {
      const athleteUrl = athleteRef.$ref
      if (!athleteUrl) continue
      
      try {
        const athleteRes = await fetch(athleteUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(2000)
        })
        
        if (!athleteRes.ok) continue
        
        const athlete = await athleteRes.json()
        const fullName = (athlete.fullName || '').toLowerCase()
        const displayName = (athlete.displayName || '').toLowerCase()
        
        if (fullName.includes(nameLower) || displayName.includes(nameLower) || nameLower.includes(fullName) || nameLower.includes(displayName)) {
          foundPlayer = {
            id: athlete.id,
            name: athlete.displayName || athlete.fullName,
            team: 'Unknown',
            position: athlete.position?.abbreviation || ''
          }
          break
        }
      } catch (err) {
        continue
      }
    }
    
    if (!foundPlayer) {
      console.log(`Player not found: ${playerName}`)
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    
    console.log(`Found: ${foundPlayer.name} (${foundPlayer.id})`)
    
    // Get stats
    const statsUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/athletes/${foundPlayer.id}/statistics`
    const statsRes = await fetch(statsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    
    const stats: { [key: string]: number } = {}
    
    if (statsRes.ok) {
      const statsData = await statsRes.json()
      const splits = statsData.splits?.categories || []
      
      splits.forEach((category: any) => {
        (category.stats || []).forEach((stat: any) => {
          const name = (stat.name || '').toLowerCase().replace(/\s+/g, '_')
          const value = parseFloat(stat.value)
          if (name && !isNaN(value)) {
            stats[name] = value
          }
        })
      })
    }
    
    console.log(`Retrieved ${Object.keys(stats).length} stats for ${foundPlayer.name}`)
    
    return NextResponse.json({
      playerId: foundPlayer.id,
      playerName: foundPlayer.name,
      teamName: foundPlayer.team,
      position: foundPlayer.position,
      gamesPlayed: stats.games_played || stats.gp || 0,
      stats
    })
    
  } catch (error: any) {
    console.error('ESPN API error:', error.message)
    return NextResponse.json(
      { error: 'Failed', details: error.message },
      { status: 500 }
    )
  }
}