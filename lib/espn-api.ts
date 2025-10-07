import axios from 'axios'

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2'
const ESPN_CORE_URL = 'http://sports.core.api.espn.com/v2/sports'

// ===== CFB Rankings (existing code) =====

export async function getTop25CFBTeams() {
  try {
    const response = await axios.get(
      `${ESPN_BASE_URL}/sports/football/college-football/rankings`
    )
    
    const apPoll = response.data.rankings.find(
      (r: any) => r.name === 'AP Top 25' || r.shortName === 'AP'
    )
    
    if (!apPoll || !apPoll.ranks) {
      console.error('AP Poll not found in rankings')
      return []
    }

    const top25Teams = apPoll.ranks.map((rank: any) => {
      return rank.team?.displayName || rank.team?.name || ''
    }).filter(Boolean)

    console.log('📊 Top 25 CFB Teams:', top25Teams)
    return top25Teams
  } catch (error) {
    console.error('Error fetching CFB rankings:', error)
    return []
  }
}

export function isTop25Team(teamName: string, top25List: string[]): boolean {
  const normalizedTeam = teamName.toLowerCase().trim()
  
  return top25List.some(ranked => {
    const normalizedRanked = ranked.toLowerCase().trim()
    return normalizedRanked.includes(normalizedTeam) || normalizedTeam.includes(normalizedRanked)
  })
}

// ===== Player Stats Functions (NEW) =====

export interface PlayerSeasonStats {
  playerId: string
  playerName: string
  teamName: string
  position: string
  gamesPlayed: number
  stats: {
    [key: string]: number // e.g., points: 25.3, rebounds: 10.2
  }
}

export interface PlayerGameLog {
  date: string
  opponent: string
  result: string // W or L
  stats: {
    [key: string]: number
  }
}

/**
 * Search for a player by name and return their ESPN athlete ID
 */
export async function searchPlayer(playerName: string, sport: 'basketball' | 'football' = 'basketball'): Promise<string | null> {
  try {
    const league = sport === 'basketball' ? 'nba' : 'nfl'
    const url = `${ESPN_BASE_URL}/sports/${sport}/${league}/athletes`
    
    const response = await axios.get(url, {
      params: { limit: 5 }
    })
    
    // Search through athletes
    const athletes = response.data.athletes || []
    const nameLower = playerName.toLowerCase()
    
    const found = athletes.find((athlete: any) => {
      const fullName = athlete.fullName?.toLowerCase() || ''
      const displayName = athlete.displayName?.toLowerCase() || ''
      return fullName.includes(nameLower) || displayName.includes(nameLower) || 
             nameLower.includes(fullName) || nameLower.includes(displayName)
    })
    
    if (found) {
      console.log(`✅ Found player: ${found.displayName} (ID: ${found.id})`)
      return found.id
    }
    
    console.log(`❌ Player not found: ${playerName}`)
    return null
  } catch (error) {
    console.error('Error searching for player:', error)
    return null
  }
}

/**
 * Fetch NBA player season stats
 */
export async function fetchNBAPlayerStats(
  playerName: string,
  season: number = 2025
): Promise<PlayerSeasonStats | null> {
  try {
    // First, search for the player
    const playerId = await searchPlayer(playerName, 'basketball')
    if (!playerId) return null
    
    // Fetch player details and stats
    const playerUrl = `${ESPN_CORE_URL}/basketball/leagues/nba/seasons/${season}/athletes/${playerId}`
    const statsUrl = `${playerUrl}/statistics/0`
    
    const [playerResponse, statsResponse] = await Promise.all([
      axios.get(playerUrl),
      axios.get(statsUrl).catch(() => null) // Stats might not be available
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
    
    return {
      playerId,
      playerName: playerData.displayName || playerName,
      teamName: playerData.team?.displayName || '',
      position: playerData.position?.abbreviation || '',
      gamesPlayed: stats.games_played || 0,
      stats
    }
  } catch (error) {
    console.error(`Error fetching NBA stats for ${playerName}:`, error)
    return null
  }
}

/**
 * Fetch NFL player season stats
 */
export async function fetchNFLPlayerStats(
  playerName: string,
  season: number = 2024
): Promise<PlayerSeasonStats | null> {
  try {
    const playerId = await searchPlayer(playerName, 'football')
    if (!playerId) return null
    
    const playerUrl = `${ESPN_CORE_URL}/football/leagues/nfl/seasons/${season}/athletes/${playerId}`
    const statsUrl = `${playerUrl}/statistics/0`
    
    const [playerResponse, statsResponse] = await Promise.all([
      axios.get(playerUrl),
      axios.get(statsUrl).catch(() => null)
    ])
    
    const playerData = playerResponse.data
    const statsData = statsResponse?.data
    
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
    
    return {
      playerId,
      playerName: playerData.displayName || playerName,
      teamName: playerData.team?.displayName || '',
      position: playerData.position?.abbreviation || '',
      gamesPlayed: stats.games_played || 0,
      stats
    }
  } catch (error) {
    console.error(`Error fetching NFL stats for ${playerName}:`, error)
    return null
  }
}

/**
 * Fetch MLB player season stats (CRITICAL for postseason!)
 */
export async function fetchMLBPlayerStats(
  playerName: string,
  season: number = 2024
): Promise<PlayerSeasonStats | null> {
  try {
    // Search for MLB player
    const searchUrl = `${ESPN_BASE_URL}/sports/baseball/mlb/athletes`
    const searchResponse = await axios.get(searchUrl, { params: { limit: 5 } })
    
    const athletes = searchResponse.data.athletes || []
    const nameLower = playerName.toLowerCase()
    
    const found = athletes.find((athlete: any) => {
      const fullName = athlete.fullName?.toLowerCase() || ''
      const displayName = athlete.displayName?.toLowerCase() || ''
      return fullName.includes(nameLower) || displayName.includes(nameLower) || 
             nameLower.includes(fullName) || nameLower.includes(displayName)
    })
    
    if (!found) {
      console.log(`❌ MLB player not found: ${playerName}`)
      return null
    }
    
    const playerId = found.id
    console.log(`✅ Found MLB player: ${found.displayName} (ID: ${playerId})`)
    
    const playerUrl = `${ESPN_CORE_URL}/baseball/leagues/mlb/seasons/${season}/athletes/${playerId}`
    const statsUrl = `${playerUrl}/statistics/0`
    
    const [playerResponse, statsResponse] = await Promise.all([
      axios.get(playerUrl),
      axios.get(statsUrl).catch(() => null)
    ])
    
    const playerData = playerResponse.data
    const statsData = statsResponse?.data
    
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
    
    return {
      playerId,
      playerName: playerData.displayName || playerName,
      teamName: playerData.team?.displayName || '',
      position: playerData.position?.abbreviation || '',
      gamesPlayed: stats.games_played || 0,
      stats
    }
  } catch (error) {
    console.error(`Error fetching MLB stats for ${playerName}:`, error)
    return null
  }
}

/**
 * Fetch player's recent game log (last N games)
 */
export async function fetchPlayerGameLog(
  playerId: string,
  sport: 'basketball' | 'football' | 'baseball',
  season: number = 2025,
  limit: number = 5
): Promise<PlayerGameLog[]> {
  try {
    const league = sport === 'basketball' ? 'nba' : 'nfl'
    const eventLogUrl = `${ESPN_CORE_URL}/${sport}/leagues/${league}/seasons/${season}/athletes/${playerId}/eventlog`
    
    const response = await axios.get(eventLogUrl)
    const events = response.data.events || []
    
    const gameLogs: PlayerGameLog[] = []
    
    for (const event of events.slice(0, limit)) {
      try {
        // Fetch event details
        const eventUrl = event.$ref
        const eventResponse = await axios.get(eventUrl)
        const eventData = eventResponse.data
        
        // Parse stats from the event
        const stats: { [key: string]: number } = {}
        
        if (eventData.statistics?.categories) {
          eventData.statistics.categories.forEach((category: any) => {
            category.stats?.forEach((stat: any) => {
              const statName = stat.name?.toLowerCase().replace(/\s+/g, '_')
              if (statName && typeof stat.value === 'number') {
                stats[statName] = stat.value
              }
            })
          })
        }
        
        gameLogs.push({
          date: eventData.date || '',
          opponent: eventData.opponent?.displayName || 'Unknown',
          result: eventData.didWin ? 'W' : 'L',
          stats
        })
      } catch (err) {
        console.error('Error fetching individual game:', err)
        continue
      }
    }
    
    return gameLogs
  } catch (error) {
    console.error('Error fetching game log:', error)
    return []
  }
}

/**
 * Helper: Map prop type to ESPN stat name
 */
export function mapPropTypeToStatName(propType: string): string {
  const mapping: { [key: string]: string } = {
    // NBA
    'player_points': 'points',
    'Points': 'points',
    'player_rebounds': 'rebounds',
    'Rebounds': 'rebounds',
    'player_assists': 'assists',
    'Assists': 'assists',
    'player_threes': 'three_point_field_goals_made',
    'Threes': 'three_point_field_goals_made',
    'player_blocks': 'blocks',
    'Blocks': 'blocks',
    'player_steals': 'steals',
    'Steals': 'steals',
    
    // NFL
    'player_pass_yds': 'passing_yards',
    'Pass Yds': 'passing_yards',
    'player_pass_tds': 'passing_touchdowns',
    'Pass Tds': 'passing_touchdowns',
    'player_rush_yds': 'rushing_yards',
    'Rush Yds': 'rushing_yards',
    'player_rush_tds': 'rushing_touchdowns',
    'Rush Tds': 'rushing_touchdowns',
    'player_receptions': 'receptions',
    'Receptions': 'receptions',
    'player_reception_yds': 'receiving_yards',
    'Reception Yds': 'receiving_yards'
  }
  
  return mapping[propType] || propType.toLowerCase().replace(/\s+/g, '_')
}

/**
 * Extract stat values from game logs for analysis
 */
export function extractStatValues(
  gameLogs: PlayerGameLog[],
  statName: string
): number[] {
  return gameLogs
    .map(log => log.stats[statName])
    .filter(val => typeof val === 'number' && !isNaN(val))
}