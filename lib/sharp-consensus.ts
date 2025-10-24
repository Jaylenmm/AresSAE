// lib/sharp-consensus.ts
// Build synthetic sharp consensus for player props from multiple sharp-ish books

export const SHARP_PROP_BOOKS = [
  'fanduel',
  'betonlineag', 
  'lowvig',
  'draftkings'
]

export const SOFT_PROP_BOOKS = [
  'betmgm',
  'caesars',
  'espnbet'
]

// Book weights for consensus calculation (higher = sharper)
const BOOK_WEIGHTS: Record<string, number> = {
  'fanduel': 1.0,      // Sharpest
  'betonlineag': 0.9,  // Very sharp
  'lowvig': 0.85,      // Sharp
  'draftkings': 0.75   // Reasonably efficient
}

interface PropOdds {
  sportsbook: string
  line: number
  over_odds: number | null
  under_odds: number | null
}

interface SharpConsensus {
  line: number
  over_odds: number
  under_odds: number
  sharp_over_prob: number
  sharp_under_prob: number
  books_used: string[]
  confidence: number  // 0-1, based on agreement between books
}

/**
 * Convert American odds to implied probability (no vig)
 */
export function oddsToProb(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100)
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
  }
}

/**
 * Convert probability to American odds
 */
export function probToOdds(prob: number): number {
  if (prob >= 0.5) {
    return Math.round(-100 * prob / (1 - prob))
  } else {
    return Math.round(100 * (1 - prob) / prob)
  }
}

/**
 * Remove vig from two-sided market to get true probabilities
 */
export function removeVig(overOdds: number, underOdds: number): { overProb: number, underProb: number } {
  const overImplied = oddsToProb(overOdds)
  const underImplied = oddsToProb(underOdds)
  const totalImplied = overImplied + underImplied
  
  // Normalize to remove vig
  return {
    overProb: overImplied / totalImplied,
    underProb: underImplied / totalImplied
  }
}

/**
 * Build sharp consensus from multiple sharp-ish books
 * Returns weighted average of no-vig probabilities
 */
export function buildSharpConsensus(props: PropOdds[]): SharpConsensus | null {
  // Filter to sharp books only
  const sharpProps = props.filter(p => SHARP_PROP_BOOKS.includes(p.sportsbook.toLowerCase()))
  
  if (sharpProps.length === 0) {
    return null
  }
  
  // Group by line (most props should have same line across books)
  const lineGroups = new Map<number, PropOdds[]>()
  sharpProps.forEach(prop => {
    if (!lineGroups.has(prop.line)) {
      lineGroups.set(prop.line, [])
    }
    lineGroups.get(prop.line)!.push(prop)
  })
  
  // Use the line with most sharp books
  let bestLine = 0
  let bestLineProps: PropOdds[] = []
  lineGroups.forEach((propsAtLine, line) => {
    if (propsAtLine.length > bestLineProps.length) {
      bestLine = line
      bestLineProps = propsAtLine
    }
  })
  
  if (bestLineProps.length === 0) {
    return null
  }
  
  // Calculate weighted average of no-vig probabilities
  let totalOverProb = 0
  let totalUnderProb = 0
  let totalWeight = 0
  const booksUsed: string[] = []
  
  bestLineProps.forEach(prop => {
    if (prop.over_odds !== null && prop.under_odds !== null) {
      const weight = BOOK_WEIGHTS[prop.sportsbook.toLowerCase()] || 0.5
      const { overProb, underProb } = removeVig(prop.over_odds, prop.under_odds)
      
      totalOverProb += overProb * weight
      totalUnderProb += underProb * weight
      totalWeight += weight
      booksUsed.push(prop.sportsbook)
    }
  })
  
  if (totalWeight === 0) {
    return null
  }
  
  const consensusOverProb = totalOverProb / totalWeight
  const consensusUnderProb = totalUnderProb / totalWeight
  
  // Calculate confidence based on agreement (lower std dev = higher confidence)
  const overProbs = bestLineProps
    .filter(p => p.over_odds !== null && p.under_odds !== null)
    .map(p => removeVig(p.over_odds!, p.under_odds!).overProb)
  
  const avgOverProb = overProbs.reduce((a, b) => a + b, 0) / overProbs.length
  const variance = overProbs.reduce((sum, p) => sum + Math.pow(p - avgOverProb, 2), 0) / overProbs.length
  const stdDev = Math.sqrt(variance)
  
  // Confidence: 1.0 when stdDev = 0, decreases as books disagree
  // Typical stdDev for props is 0.01-0.05
  const confidence = Math.max(0, 1 - (stdDev * 20))
  
  return {
    line: bestLine,
    over_odds: probToOdds(consensusOverProb),
    under_odds: probToOdds(consensusUnderProb),
    sharp_over_prob: consensusOverProb,
    sharp_under_prob: consensusUnderProb,
    books_used: booksUsed,
    confidence: confidence
  }
}

/**
 * Calculate edge for a soft book against sharp consensus
 */
export function calculatePropEdge(
  softOverOdds: number,
  softUnderOdds: number,
  sharpConsensus: SharpConsensus
): {
  over_edge: number
  under_edge: number
  over_ev: number
  under_ev: number
  recommendation: 'over' | 'under' | 'none'
} {
  const { overProb: softOverProb, underProb: softUnderProb } = removeVig(softOverOdds, softUnderOdds)
  
  // Edge = true probability - implied probability
  const overEdge = sharpConsensus.sharp_over_prob - softOverProb
  const underEdge = sharpConsensus.sharp_under_prob - softUnderProb
  
  // EV = (true_prob * payout) - (1 - true_prob)
  const overPayout = softOverOdds > 0 ? softOverOdds / 100 : 100 / Math.abs(softOverOdds)
  const underPayout = softUnderOdds > 0 ? softUnderOdds / 100 : 100 / Math.abs(softUnderOdds)
  
  const overEV = (sharpConsensus.sharp_over_prob * overPayout) - (1 - sharpConsensus.sharp_over_prob)
  const underEV = (sharpConsensus.sharp_under_prob * underPayout) - (1 - sharpConsensus.sharp_under_prob)
  
  // Recommend side with positive EV and edge > 2%
  let recommendation: 'over' | 'under' | 'none' = 'none'
  if (overEV > 0 && overEdge > 0.02) {
    recommendation = 'over'
  } else if (underEV > 0 && underEdge > 0.02) {
    recommendation = 'under'
  }
  
  return {
    over_edge: overEdge,
    under_edge: underEdge,
    over_ev: overEV,
    under_ev: underEV,
    recommendation
  }
}
