// lib/nfl-prop-analyzer.ts
// Simple NFL player prop analyzer using BallDontLie game logs.

import type { ParsedBet } from './bet-parser'
import { getNflPlayerGameLogs, searchNflPlayer } from './balldontlie-nfl'

export interface NflPropAnalysis {
  recommendation: 'bet' | 'pass' | 'lean_bet' | 'lean_pass'
  confidence: number
  edge: number
  reasoning: string[]
  warnings: string[]
  stats: {
    seasonMedian: number
    last5Median: number
    hitRate: number
  }
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export async function analyzeNflProp(bet: ParsedBet): Promise<NflPropAnalysis | null> {
  if (!bet.player || !bet.propType || !bet.line || !bet.selection) {
    return null
  }

  // For now we rely on the player name from the slip and take the first match.
  const players = await searchNflPlayer(bet.player)
  if (!players.length) {
    return null
  }

  const player = players[0]

  // Fetch recent game logs; exact field mapping will depend on how
  // BallDontLie structures NFL stats. For v1 assume we get numeric
  // values for the requested prop type under a single "value" field.
  const logs = await getNflPlayerGameLogs({ playerId: player.id, limit: 25 })
  if (!logs.length) {
    return null
  }

  const values = logs.map(l => l.value).filter(v => typeof v === 'number')
  if (!values.length) {
    return null
  }

  const seasonMedian = median(values)
  const last5Median = median(values.slice(0, 5))

  const line = bet.line as number
  const selection = bet.selection as 'over' | 'under'

  const hits = values.filter(v =>
    selection === 'over' ? v > line : v < line
  ).length
  const hitRate = values.length ? (hits / values.length) * 100 : 0

  const reasoning: string[] = []
  const warnings: string[] = []

  const medDiff = seasonMedian - line
  if (selection === 'over') {
    if (medDiff > 0) {
      reasoning.push(`Season median (${seasonMedian.toFixed(1)}) is ${medDiff.toFixed(1)} above the line`)
    } else {
      warnings.push(`Season median (${seasonMedian.toFixed(1)}) is ${Math.abs(medDiff).toFixed(1)} below the line`)
    }
  } else {
    if (medDiff < 0) {
      reasoning.push(`Season median (${seasonMedian.toFixed(1)}) is ${Math.abs(medDiff).toFixed(1)} below the line`)
    } else {
      warnings.push(`Season median (${seasonMedian.toFixed(1)}) is ${Math.abs(medDiff).toFixed(1)} above the line`)
    }
  }

  reasoning.push(`Recent form: last 5 median is ${last5Median.toFixed(1)}`)
  reasoning.push(`Hit rate at this line: ${hitRate.toFixed(0)}% over the last ${values.length} games`)

  // Very simple recommendation for v1
  let recommendation: NflPropAnalysis['recommendation'] = 'pass'
  let confidence = 50
  let edge = 0

  if (hitRate >= 60 && Math.abs(medDiff) >= 3) {
    recommendation = 'bet'
    confidence = 70
  } else if (hitRate >= 55) {
    recommendation = 'lean_bet'
    confidence = 60
  } else if (hitRate <= 35) {
    recommendation = 'lean_pass'
    confidence = 60
  } else if (hitRate <= 25) {
    recommendation = 'pass'
    confidence = 70
  }

  return {
    recommendation,
    confidence,
    edge,
    reasoning,
    warnings,
    stats: {
      seasonMedian,
      last5Median,
      hitRate,
    },
  }
}
