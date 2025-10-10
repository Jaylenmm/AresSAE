// ===== CLEAN: lib/espn-api.ts =====

import axios from 'axios'
import { getFromCache, cacheHistoricalData, generatePlayerPropCacheKey } from './cache-manager'

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
    const cacheKey = generatePlayerPropCacheKey(playerName, 'season_stats_nba', season, 'season')
    const cached = await getFromCache(cacheKey)
    
    if (cached) {
      console.log(`Using cached NBA stats for ${playerName}`)
      return cached
    }
    
    console.log(`Fetching NBA stats for ${playerName}...`)
    
    const response = await axios.get('/api/espn/player-stats', {
      params: {
        player: playerName,
        sport: 'basketball',
        season
      },
      timeout: 10000
    })
    
    const stats = response.data
    
    if (stats && stats.playerId) {
      await cacheHistoricalData(cacheKey, stats, 1)
      console.log(`Fetched NBA stats for ${stats.playerName}`)
      return stats
    }
    
    return null
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`NBA player not found: ${playerName}`)
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
    const cacheKey = generatePlayerPropCacheKey(playerName, 'season_stats_nfl', season, 'season')
    const cached = await getFromCache(cacheKey)
    
    if (cached) {
      console.log(`Using cached NFL stats for ${playerName}`)
      return cached
    }
    
    console.log(`Fetching NFL stats for ${playerName}...`)
    
    const response = await axios.get('/api/espn/player-stats', {
      params: {
        player: playerName,
        sport: 'football',
        season
      },
      timeout: 10000
    })
    
    const stats = response.data
    
    if (stats && stats.playerId) {
      await cacheHistoricalData(cacheKey, stats, 1)
      console.log(`Fetched NFL stats for ${stats.playerName}`)
      return stats
    }
    
    return null
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`NFL player not found: ${playerName}`)
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
    const cacheKey = generatePlayerPropCacheKey(playerName, 'season_stats_mlb', season, 'season')
    const cached = await getFromCache(cacheKey)
    
    if (cached) {
      console.log(`Using cached MLB stats for ${playerName}`)
      return cached
    }
    
    console.log(`Fetching MLB stats for ${playerName}...`)
    
    const response = await axios.get('/api/espn/player-stats', {
      params: {
        player: playerName,
        sport: 'baseball',
        season
      },
      timeout: 10000
    })
    
    const stats = response.data
    
    if (stats && stats.playerId) {
      await cacheHistoricalData(cacheKey, stats, 1)
      console.log(`Fetched MLB stats for ${stats.playerName}`)
      return stats
    }
    
    return null
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`MLB player not found: ${playerName}`)
    } else {
      console.error(`Error fetching MLB stats for ${playerName}:`, error.message)
    }
    return null
  }
}

/**
 * Fetch player game log via API route
 */
export async function fetchPlayerGameLog(
  playerId: string,
  sport: 'basketball' | 'football' | 'baseball',
  season: number = 2025,
  limit: number = 10
): Promise<PlayerGameLog[]> {
  try {
    const cacheKey = `game_log_${playerId}_${sport}_${season}_${limit}`
    const cached = await getFromCache(cacheKey)
    
    if (cached) {
      console.log(`Using cached game log for player ${playerId}`)
      return cached
    }
    
    console.log(`Fetching game log for player ${playerId}...`)
    
    const response = await axios.get('/api/espn/game-log', {
      params: {
        playerId,
        sport,
        season,
        limit
      },
      timeout: 10000
    })
    
    const gameLogs = response.data
    
    await cacheHistoricalData(cacheKey, gameLogs, 0.25)
    
    console.log(`Fetched ${gameLogs.length} game logs`)
    return gameLogs
    
  } catch (error: any) {
    console.error('Error fetching game log:', error.message)
    return []
  }
}

/**
 * Fetch NCAAF Top 25 teams from ESPN API
 */
export async function getTop25NCAAFTeams(): Promise<string[]> {
  try {
    const cacheKey = 'ncaaf_top25_teams'
    const cached = await getFromCache(cacheKey)
    
    if (cached) {
      console.log('Using cached NCAAF Top 25')
      return cached
    }
    
    console.log('Fetching NCAAF Top 25 rankings...')
    
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings',
      { timeout: 10000 }
    )
    
    const rankings = response.data?.rankings || []
    const apPoll = rankings.find((r: any) => r.name === 'AP Top 25' || r.type === 'AP')
    
    if (!apPoll || !apPoll.ranks) {
      console.warn('AP Poll not found in rankings')
      return []
    }
    
    const top25Teams = apPoll.ranks.map((rank: any) => rank.team?.displayName || rank.team?.name).filter(Boolean)
    
    // Cache for 6 hours (rankings don't change often)
    await cacheHistoricalData(cacheKey, top25Teams, 6)
    
    console.log(`Fetched ${top25Teams.length} NCAAF Top 25 teams`)
    return top25Teams
    
  } catch (error: any) {
    console.error('Error fetching NCAAF Top 25:', error.message)
    return []
  }
}

/**
 * Check if a team is in the Top 25
 */
export function isTop25Team(teamName: string, top25List: string[]): boolean {
  if (!teamName || top25List.length === 0) return false
  
  // Normalize team name for comparison
  const normalizedTeam = teamName.toLowerCase().trim()
  
  return top25List.some(top25Team => {
    const normalizedTop25 = top25Team.toLowerCase().trim()
    
    // Exact match
    if (normalizedTop25 === normalizedTeam) return true
    
    // Partial match (handles cases like "Ohio State" vs "Ohio State Buckeyes")
    if (normalizedTop25.includes(normalizedTeam) || normalizedTeam.includes(normalizedTop25)) {
      return true
    }
    
    return false
  })
}

/**
 * Map prop type to ESPN stat name
 */
export function mapPropTypeToStatName(propType: string): string {
  const mapping: { [key: string]: string } = {
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
    'Reception Yds': 'receiving_yards',
    'batter_home_runs': 'home_runs',
    'pitcher_strikeouts': 'strikeouts'
  }
  
  return mapping[propType] || propType.toLowerCase().replace(/\s+/g, '_')
}

/**
 * Extract stat values from game logs
 */
export function extractStatValues(
  gameLogs: PlayerGameLog[],
  statName: string
): number[] {
  return gameLogs
    .map(log => log.stats[statName])
    .filter(val => typeof val === 'number' && !isNaN(val))
}