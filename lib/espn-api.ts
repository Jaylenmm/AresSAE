import axios from 'axios'

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2'

// ===== CFB Rankings (existing code - unchanged) =====

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

// ===== Player Stats Functions (UPDATED TO USE API ROUTES) =====

export interface PlayerSeasonStats {
  playerId: string
  playerName: string
  teamName: string
  position: string
  gamesPlayed: number
  stats: {
    [key: string]: number
  }
}

export interface PlayerGameLog {
  date: string
  opponent: string
  result: string
  stats: {
    [key: string]: number
  }
}

/**
 * Fetch NBA player season stats via API route
 */
export async function fetchNBAPlayerStats(
  playerName: string,
  season: number = 2025
): Promise<PlayerSeasonStats | null> {
  try {
    const response = await axios.get('/api/espn/player-stats', {
      params: {
        player: playerName,
        sport: 'basketball',
        season
      }
    })
    
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`❌ NBA player not found: ${playerName}`)
    } else {
      console.error(`Error fetching NBA stats for ${playerName}:`, error.message)
    }
    return null
  }
}

/**
 * Fetch NFL player season stats via API route
 */
export async function fetchNFLPlayerStats(
  playerName: string,
  season: number = 2024
): Promise<PlayerSeasonStats | null> {
  try {
    const response = await axios.get('/api/espn/player-stats', {
      params: {
        player: playerName,
        sport: 'football',
        season
      }
    })
    
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`❌ NFL player not found: ${playerName}`)
    } else {
      console.error(`Error fetching NFL stats for ${playerName}:`, error.message)
    }
    return null
  }
}

/**
 * Fetch MLB player season stats via API route
 */
export async function fetchMLBPlayerStats(
  playerName: string,
  season: number = 2024
): Promise<PlayerSeasonStats | null> {
  try {
    const response = await axios.get('/api/espn/player-stats', {
      params: {
        player: playerName,
        sport: 'baseball',
        season
      }
    })
    
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`❌ MLB player not found: ${playerName}`)
    } else {
      console.error(`Error fetching MLB stats for ${playerName}:`, error.message)
    }
    return null
  }
}

/**
 * Fetch player's recent game log via API route
 */
export async function fetchPlayerGameLog(
  playerId: string,
  sport: 'basketball' | 'football' | 'baseball',
  season: number = 2025,
  limit: number = 10
): Promise<PlayerGameLog[]> {
  try {
    const response = await axios.get('/api/espn/game-log', {
      params: {
        playerId,
        sport,
        season,
        limit
      }
    })
    
    return response.data
  } catch (error: any) {
    console.error('Error fetching game log:', error.message)
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