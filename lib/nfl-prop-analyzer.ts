// lib/nfl-prop-analyzer.ts
// Simple NFL player prop analyzer using BallDontLie game logs.

import type { ParsedBet } from './bet-parser'

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

export async function analyzeNflProp(bet: ParsedBet): Promise<NflPropAnalysis | null> {
  if (!bet.player || !bet.propType || !bet.line || !bet.selection) {
    return null
  }

  const params = new URLSearchParams({
    player: bet.player,
    propType: bet.propType,
    line: String(bet.line),
    selection: String(bet.selection),
  })

  const response = await fetch(`/api/nfl-prop-analysis?${params.toString()}`)
  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data as NflPropAnalysis
}
