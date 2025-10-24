// lib/espn-stats.ts

const ESPN_BASE_URL = 'https://site.web.api.espn.com/apis/common/v3/sports'

export interface PlayerGameStats {
  gameId: string
  date: string
  opponent: string
  stats: Record<string, number>
  result: string // W or L
}

export interface PlayerSeasonStats {
  recentGames: PlayerGameStats[]
  seasonAverages: Record<string, number>
}

/**
 * Search for a player by name to get their ESPN ID
 */
export async function searchPlayer(playerName: string, sport: 'football' | 'basketball' | 'baseball'): Promise<string | null> {
  try {
    const sportLeague = getSportLeague(sport)
    const searchUrl = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(playerName)}&sport=${sportLeague.sport}`
    
    const response = await fetch(searchUrl)
    if (!response.ok) return null
    
    const data = await response.json()
    
    // Look for athlete in results
    const athletes = data.results?.filter((r: any) => r.type === 'athlete') || []
    if (athletes.length === 0) return null
    
    // Return first match's ID
    return athletes[0].athlete?.id || null
  } catch (error) {
    console.error('Error searching for player:', error)
    return null
  }
}

/**
 * Fetch player game log (last N games)
 */
export async function fetchPlayerGameLog(
  playerId: string, 
  sport: 'football' | 'basketball' | 'baseball',
  season?: number
): Promise<PlayerGameStats[]> {
  try {
    const { sport: sportKey, league } = getSportLeague(sport)
    const currentSeason = season || new Date().getFullYear()
    
    const url = `${ESPN_BASE_URL}/${sportKey}/${league}/athletes/${playerId}/gamelog?season=${currentSeason}`
    
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`ESPN API error: ${response.status}`)
      return []
    }
    
    const data = await response.json()
    
    // Parse the game log
    const games: PlayerGameStats[] = []
    const events = data.events || []
    
    for (const event of events.slice(0, 10)) { // Get last 10 games
      const game = event.game || {}
      const stats = event.stats || {}
      
      games.push({
        gameId: game.id || '',
        date: game.date || '',
        opponent: getOpponentName(event),
        stats: parseStats(stats),
        result: game.result || 'N/A'
      })
    }
    
    return games
  } catch (error) {
    console.error('Error fetching game log:', error)
    return []
  }
}

/**
 * Fetch player season statistics
 */
export async function fetchPlayerStats(
  playerId: string,
  sport: 'football' | 'basketball' | 'baseball',
  season?: number
): Promise<Record<string, number>> {
  try {
    const { sport: sportKey, league } = getSportLeague(sport)
    const currentSeason = season || new Date().getFullYear()
    
    const url = `${ESPN_BASE_URL}/${sportKey}/${league}/athletes/${playerId}/stats?season=${currentSeason}`
    
    const response = await fetch(url)
    if (!response.ok) return {}
    
    const data = await response.json()
    
    // Parse season averages
    const seasonStats = data.statistics?.[0]?.stats || {}
    return parseStats(seasonStats)
  } catch (error) {
    console.error('Error fetching player stats:', error)
    return {}
  }
}

/**
 * Get comprehensive player data (game log + season stats)
 */
export async function getPlayerPerformance(
  playerName: string,
  sport: 'football' | 'basketball' | 'baseball',
  propType?: string
): Promise<PlayerSeasonStats | null> {
  try {
    // First, search for player ID
    const playerId = await searchPlayer(playerName, sport)
    if (!playerId) {
      console.error(`Could not find player: ${playerName}`)
      return null
    }
    
    // Fetch game log and season stats in parallel
    const [gameLog, seasonStats] = await Promise.all([
      fetchPlayerGameLog(playerId, sport),
      fetchPlayerStats(playerId, sport)
    ])
    
    return {
      recentGames: gameLog,
      seasonAverages: seasonStats
    }
  } catch (error) {
    console.error('Error getting player performance:', error)
    return null
  }
}

/**
 * Helper: Map sport to ESPN sport/league keys
 */
function getSportLeague(sport: 'football' | 'basketball' | 'baseball'): { sport: string, league: string } {
  const mapping = {
    football: { sport: 'football', league: 'nfl' },
    basketball: { sport: 'basketball', league: 'nba' },
    baseball: { sport: 'baseball', league: 'mlb' }
  }
  return mapping[sport]
}

/**
 * Helper: Extract opponent name from event
 */
function getOpponentName(event: any): string {
  const competition = event.game?.competition || event.competition
  if (!competition) return 'Unknown'
  
  const competitors = competition.competitors || []
  // Find the opponent (not the player's team)
  const opponent = competitors.find((c: any) => !c.homeAway || c.homeAway !== 'home')
  return opponent?.team?.abbreviation || opponent?.team?.displayName || 'Unknown'
}

/**
 * Helper: Parse stats object into clean key-value pairs
 */
function parseStats(stats: any): Record<string, number> {
  const parsed: Record<string, number> = {}
  
  if (Array.isArray(stats)) {
    stats.forEach((stat: any) => {
      if (stat.name && stat.value !== undefined) {
        parsed[stat.name] = parseFloat(stat.value) || 0
      }
    })
  } else if (typeof stats === 'object') {
    Object.keys(stats).forEach(key => {
      const value = stats[key]
      if (typeof value === 'number') {
        parsed[key] = value
      } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
        parsed[key] = parseFloat(value)
      }
    })
  }
  
  return parsed
}

/**
 * Helper: Map prop type to stat key
 */
export function mapPropTypeToStatKey(propType: string): string {
  const mapping: Record<string, string> = {
    // Football
    'player_pass_yds': 'passingYards',
    'player_pass_tds': 'passingTouchdowns',
    'player_pass_completions': 'completions',
    'player_rush_yds': 'rushingYards',
    'player_rush_attempts': 'rushingAttempts',
    'player_receptions': 'receptions',
    'player_reception_yds': 'receivingYards',
    
    // Basketball
    'player_points': 'points',
    'player_rebounds': 'rebounds',
    'player_assists': 'assists',
    'player_threes': 'threePointFieldGoalsMade',
    'player_blocks': 'blocks',
    'player_steals': 'steals',
    
    // Baseball
    'batter_home_runs': 'homeRuns',
    'batter_hits': 'hits',
    'batter_rbis': 'RBIs',
    'pitcher_strikeouts': 'strikeouts'
  }
  
  return mapping[propType] || propType
}
