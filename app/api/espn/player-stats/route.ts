// app/api/espn/player-stats/route.ts - FIXED ROSTER PARSING

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
    
    const teamsUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams`
    const teamsRes = await fetch(teamsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    
    if (!teamsRes.ok) {
      throw new Error(`Teams fetch failed: ${teamsRes.status}`)
    }
    
    const teamsData = await teamsRes.json()
    const teams = teamsData.sports?.[0]?.leagues?.[0]?.teams || []
    
    console.log(`Searching ${teams.length} teams...`)
    
    let foundPlayer: any = null
    const nameLower = playerName.toLowerCase().trim()
    
    for (const teamWrapper of teams) {
      const team = teamWrapper.team
      if (!team?.id) continue
      
      try {
        const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${team.id}/roster`
        const rosterRes = await fetch(rosterUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(3000)
        })
        
        if (!rosterRes.ok) continue
        
        const rosterData = await rosterRes.json()
        
        // FIXED: Athletes are nested under position groups
        const athleteGroups = rosterData.athletes || []
        
        for (const group of athleteGroups) {
          const athletes = group.items || []
          
          for (const athlete of athletes) {
            const fullName = (athlete.fullName || '').toLowerCase()
            const displayName = (athlete.displayName || '').toLowerCase()
            
            if (fullName.includes(nameLower) || displayName.includes(nameLower)) {
              foundPlayer = {
                id: athlete.id,
                name: athlete.displayName || athlete.fullName,
                team: team.displayName,
                position: group.position || ''
              }
              break
            }
          }
          
          if (foundPlayer) break
        }
        
        if (foundPlayer) break
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