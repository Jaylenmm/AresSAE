// lib/edge-detectionTEST.ts
// NEW: Sharp consensus line matching with ±2 range tolerance

import { BookmakerOdds } from './analysis-engine'

const SHARP_BOOKMAKERS = ['pinnacle', 'betonline', 'bookmaker', 'circa', 'circasports']

function isSharpBook(bookmakerKey: string): boolean {
  const normalized = bookmakerKey.toLowerCase().replace(/\s+/g, '')
  return SHARP_BOOKMAKERS.some(sharp => normalized.includes(sharp))
}

export interface SharpConsensus {
  odds: number
  opposingOdds: number | null
  sportsbook: string
  line: number
  lineDistance: number // How far from user's requested line
  confidence: number // Base confidence (100 for exact match, reduced for distance)
}

/**
 * Find sharp consensus odds at or near the user's requested line
 * Tolerance: ±2 from requested line
 * Preference: Closest line to user's selection
 */
export function findSharpConsensus(
  market: string,
  selection: string,
  requestedLine: number | undefined,
  playerName: string | undefined,
  allBookmakerData: BookmakerOdds[]
): SharpConsensus | null {
  
  const sharpBookOdds: Array<{
    sportsbook: string
    odds: number
    opposingOdds: number | null
    line: number
    distance: number
  }> = []

  // Collect all sharp book odds
  for (const bookmaker of allBookmakerData) {
    if (!isSharpBook(bookmaker.key)) continue

    const marketData = bookmaker.markets.find(m => m.key === market)
    if (!marketData) continue

    // Find matching outcome
    const outcome = marketData.outcomes.find(o => {
      const matchesName = o.name === selection
      const matchesPlayer = !playerName || o.description === playerName
      
      // Check line matching with ±2 tolerance
      if (requestedLine === undefined) {
        return matchesName && matchesPlayer
      }
      
      const outcomeLine = o.point ?? 0
      const lineDistance = Math.abs(outcomeLine - requestedLine)
      
      return matchesName && matchesPlayer && lineDistance <= 2
    })

    if (!outcome) continue

    // Find opposing odds from same bookmaker
    let opposingOdds: number | null = null
    const opposingOutcome = marketData.outcomes.find(o => {
      const samePlayer = !playerName || o.description === playerName
      const sameLine = (o.point ?? 0) === (outcome.point ?? 0)
      const opposingSide = o.name !== selection
      return samePlayer && sameLine && opposingSide
    })
    
    if (opposingOutcome) {
      opposingOdds = opposingOutcome.price
    }

    const outcomeLine = outcome.point ?? requestedLine ?? 0
    const lineDistance = requestedLine !== undefined 
      ? Math.abs(outcomeLine - requestedLine) 
      : 0

    sharpBookOdds.push({
      sportsbook: bookmaker.key,
      odds: outcome.price,
      opposingOdds,
      line: outcomeLine,
      distance: lineDistance
    })
  }

  if (sharpBookOdds.length === 0) {
    return null
  }

  // Sort by line distance (closest first), then by odds quality (Pinnacle first)
  sharpBookOdds.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance
    }
    // Prefer Pinnacle if distance is equal
    if (a.sportsbook.includes('pinnacle')) return -1
    if (b.sportsbook.includes('pinnacle')) return 1
    return 0
  })

  const best = sharpBookOdds[0]

  // Calculate confidence penalty for line distance
  // Exact match: 100% confidence
  // 1 line away: -3% confidence
  // 2 lines away: -5% confidence
  let confidencePenalty = 0
  if (best.distance === 1) confidencePenalty = 3
  if (best.distance === 2) confidencePenalty = 5

  return {
    odds: best.odds,
    opposingOdds: best.opposingOdds,
    sportsbook: best.sportsbook,
    line: best.line,
    lineDistance: best.distance,
    confidence: 100 - confidencePenalty
  }
}

/**
 * Get display name for bookmaker
 */
export function getBookmakerDisplayName(key: string): string {
  const names: Record<string, string> = {
    'pinnacle': 'Pinnacle',
    'betonline': 'BetOnline',
    'betonlineag': 'BetOnline',
    'bookmaker': 'Bookmaker',
    'circa': 'Circa Sports',
    'circasports': 'Circa Sports',
    'draftkings': 'DraftKings',
    'fanduel': 'FanDuel',
    'betmgm': 'BetMGM',
    'caesars': 'Caesars',
    'williamhill_us': 'Caesars'
  }
  

  const normalized = key.toLowerCase()
  return names[normalized] || key 
}