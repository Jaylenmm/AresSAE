// ===== CLEAN: lib/espn-apiTEST.ts =====

import axios from 'axios'
import { getFromCache, cacheHistoricalData, generatePlayerPropCacheKey } from './cache-managerTEST'

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