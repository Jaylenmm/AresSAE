// lib/bet-matcher.ts
// Match parsed bets against database

import { supabase } from './supabase'
import { ParsedBet } from './bet-parser'
import { distance } from 'fastest-levenshtein'

export interface MatchedBet extends ParsedBet {
  gameId?: string
  propId?: string
  matchConfidence: number
  dbTeam1?: string
  dbTeam2?: string
  dbPlayer?: string
}

/**
 * Calculate string similarity (0-1)
 */
function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1.0
  return 1 - distance(str1.toLowerCase(), str2.toLowerCase()) / maxLen
}

/**
 * Match parsed bet against database
 */
export async function matchBetToDatabase(bet: ParsedBet): Promise<MatchedBet> {
  if (bet.type === 'player_prop') {
    return await matchPlayerProp(bet)
  } else {
    return await matchGameBet(bet)
  }
}

/**
 * Match player prop to database
 */
async function matchPlayerProp(bet: ParsedBet): Promise<MatchedBet> {
  if (!bet.player) {
    return { ...bet, matchConfidence: 0 }
  }

  // Search for player in props
  const { data: props } = await supabase
    .from('player_props_v2')
    .select('*')
    .ilike('player_name', `%${bet.player}%`)
    .limit(10)

  if (!props || props.length === 0) {
    return { ...bet, matchConfidence: 0 }
  }

  // Find best match
  let bestMatch = props[0]
  let bestScore = 0

  for (const prop of props) {
    const nameScore = similarity(bet.player, prop.player_name)
    let typeScore = 1.0
    
    if (bet.propType) {
      typeScore = prop.prop_type === bet.propType ? 1.0 : 0.5
    }

    let lineScore = 1.0
    if (bet.line !== undefined && prop.line !== undefined) {
      const lineDiff = Math.abs(bet.line - prop.line)
      lineScore = lineDiff <= 1 ? 1.0 : lineDiff <= 3 ? 0.8 : 0.5
    }

    const totalScore = (nameScore * 0.5) + (typeScore * 0.3) + (lineScore * 0.2)
    
    if (totalScore > bestScore) {
      bestScore = totalScore
      bestMatch = prop
    }
  }

  return {
    ...bet,
    propId: bestMatch.id,
    gameId: bestMatch.game_id,
    dbPlayer: bestMatch.player_name,
    propType: bestMatch.prop_type,
    line: bestMatch.line,
    matchConfidence: bestScore
  }
}

/**
 * Match game bet to database
 */
async function matchGameBet(bet: ParsedBet): Promise<MatchedBet> {
  if (!bet.team1 && !bet.team2) {
    return { ...bet, matchConfidence: 0 }
  }

  // Search for games with these teams
  const searchTerm = bet.team1 || bet.team2 || ''
  
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%`)
    .gte('game_date', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
    .limit(10)

  if (!games || games.length === 0) {
    return { ...bet, matchConfidence: 0 }
  }

  // Find best match
  let bestMatch = games[0]
  let bestScore = 0

  for (const game of games) {
    let score = 0
    let matches = 0

    if (bet.team1) {
      const homeScore = similarity(bet.team1, game.home_team)
      const awayScore = similarity(bet.team1, game.away_team)
      score += Math.max(homeScore, awayScore)
      matches++
    }

    if (bet.team2) {
      const homeScore = similarity(bet.team2, game.home_team)
      const awayScore = similarity(bet.team2, game.away_team)
      score += Math.max(homeScore, awayScore)
      matches++
    }

    const avgScore = matches > 0 ? score / matches : 0

    if (avgScore > bestScore) {
      bestScore = avgScore
      bestMatch = game
    }
  }

  return {
    ...bet,
    gameId: bestMatch.id,
    dbTeam1: bestMatch.away_team,
    dbTeam2: bestMatch.home_team,
    matchConfidence: bestScore
  }
}

/**
 * Match multiple bets in batch
 */
export async function matchBetsToDatabase(bets: ParsedBet[]): Promise<MatchedBet[]> {
  const matched: MatchedBet[] = []
  
  for (const bet of bets) {
    try {
      const matchedBet = await matchBetToDatabase(bet)
      matched.push(matchedBet)
    } catch (error) {
      console.error('Error matching bet:', error)
      matched.push({ ...bet, matchConfidence: 0 })
    }
  }

  return matched
}
