// ===== CREATE: lib/edge-detection.ts =====

/**
 * Edge Detection and +EV Analysis
 * Implements professional betting principles:
 * - 2-5% realistic edge expectations
 * - CLV (Closing Line Value) concepts
 * - Market efficiency analysis
 */

export interface EdgeAnalysis {
  hasEdge: boolean
  edgePercent: number // 2-5% is realistic, 10%+ is rare
  evDollars: number // Expected value per $100 wagered
  confidence: number // 0-100
  recommendation: 'bet' | 'pass' | 'strong_bet'
  reasoning: string[]
}

export interface LineShoppingResult {
  bestBook: string
  bestOdds: number
  worstOdds: number
  oddsRange: number
  potentialSavings: number // Dollars saved per $100 bet by shopping
  allLines: Array<{ book: string; odds: number }>
}

/**
 * Convert American odds to implied probability
 * Accounts for the juice/vig built into odds
 */
export function oddsToImpliedProbability(americanOdds: number, removeVig: boolean = false): number {
  let probability: number
  
  if (americanOdds > 0) {
    probability = 100 / (americanOdds + 100)
  } else {
    probability = Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
  }

  // If removing vig, adjust (typical 4-5% vig on sides)
  if (removeVig) {
    probability = probability * 0.975 // Approximate vig removal
  }

  return probability * 100
}

/**
 * Convert probability to American odds
 */
export function probabilityToOdds(probability: number): number {
  if (probability >= 50) {
    return Math.round(-1 * (probability / (100 - probability)) * 100)
  } else {
    return Math.round((100 - probability) / probability * 100)
  }
}

/**
 * Calculate Expected Value (EV)
 * EV = (Win% × Win Amount) - (Loss% × Loss Amount)
 */
export function calculateEV(
  trueProbability: number, // Your estimated probability (0-100)
  odds: number // American odds
): {
  evPercent: number
  evDollars: number // Per $100 bet
  isPositive: boolean
} {
  const winProbability = trueProbability / 100
  const lossProbability = 1 - winProbability
  
  let winAmount: number
  if (odds > 0) {
    winAmount = odds
  } else {
    winAmount = 100 / (Math.abs(odds) / 100)
  }
  
  const lossAmount = 100
  
  const ev = (winProbability * winAmount) - (lossProbability * lossAmount)
  const evPercent = (ev / 100) * 100
  
  return {
    evPercent: Math.round(evPercent * 100) / 100,
    evDollars: Math.round(ev * 100) / 100,
    isPositive: ev > 0
  }
}

/**
 * Detect edge by comparing true probability vs market odds
 * CRITICAL: Realistic edges are 2-5%, anything above 10% is suspicious
 */
export function detectEdge(
  trueProbability: number, // 0-100
  marketOdds: number, // American odds
  minEdgeThreshold: number = 2 // Minimum edge to recommend bet (%)
): EdgeAnalysis {
  const impliedProb = oddsToImpliedProbability(marketOdds, true)
  const edgePercent = trueProbability - impliedProb
  const ev = calculateEV(trueProbability, marketOdds)
  
  const reasoning: string[] = []
  let confidence = 0
  let recommendation: 'bet' | 'pass' | 'strong_bet' = 'pass'
  
  // Reality check: Edges above 10% are extremely rare
  if (edgePercent > 10) {
    reasoning.push(`⚠️ Edge of ${edgePercent.toFixed(1)}% is suspiciously high. Verify your analysis.`)
    confidence = 20 // Low confidence on unrealistic edges
  }
  
  // Realistic edge range: 2-5%
  if (edgePercent >= minEdgeThreshold && edgePercent <= 5) {
    recommendation = 'bet'
    confidence = 60 + Math.min(edgePercent * 5, 20) // 60-80 confidence
    reasoning.push(`✓ Realistic edge of ${edgePercent.toFixed(1)}% detected (${trueProbability.toFixed(1)}% true vs ${impliedProb.toFixed(1)}% implied)`)
    reasoning.push(`Expected value: +$${ev.evDollars.toFixed(2)} per $100 wagered`)
  }
  
  // Strong edge: 5-8%
  else if (edgePercent > 5 && edgePercent <= 8) {
    recommendation = 'strong_bet'
    confidence = 75 + Math.min((edgePercent - 5) * 5, 15) // 75-90 confidence
    reasoning.push(`✓ Strong edge of ${edgePercent.toFixed(1)}% - This is a premium opportunity`)
    reasoning.push(`EV: +$${ev.evDollars.toFixed(2)} per $100 (${ev.evPercent.toFixed(1)}% ROI)`)
  }
  
  // Small edge: 0-2%
  else if (edgePercent > 0 && edgePercent < minEdgeThreshold) {
    reasoning.push(`Edge of ${edgePercent.toFixed(1)}% is below threshold (need ${minEdgeThreshold}%+)`)
    confidence = 30
  }
  
  // No edge
  else {
    reasoning.push(`No edge detected. Market odds (${impliedProb.toFixed(1)}%) aligned with true probability (${trueProbability.toFixed(1)}%)`)
    confidence = 50
  }
  
  // Add context about realistic expectations
  if (edgePercent >= 2 && edgePercent <= 5) {
    reasoning.push(`Note: 2-5% edges are what professional bettors target. This is a solid opportunity.`)
  }
  
  return {
    hasEdge: edgePercent >= minEdgeThreshold,
    edgePercent: Math.round(edgePercent * 100) / 100,
    evDollars: ev.evDollars,
    confidence,
    recommendation,
    reasoning
  }
}

/**
 * Line shopping - Find best odds across multiple books
 * CRITICAL: Line shopping is the easiest way to add 1-2% to your edge
 */
export function shopLines(
  lines: Array<{ book: string; odds: number }>
): LineShoppingResult {
  if (lines.length === 0) {
    return {
      bestBook: '',
      bestOdds: 0,
      worstOdds: 0,
      oddsRange: 0,
      potentialSavings: 0,
      allLines: []
    }
  }
  
  // Sort to find best and worst odds
  const sorted = [...lines].sort((a, b) => {
    const aValue = a.odds > 0 ? a.odds : -100 / (a.odds / 100)
    const bValue = b.odds > 0 ? b.odds : -100 / (b.odds / 100)
    return bValue - aValue // Higher value = better odds
  })
  
  const bestLine = sorted[0]
  const worstLine = sorted[sorted.length - 1]
  
  // Calculate potential savings per $100 bet
  const bestProb = oddsToImpliedProbability(bestLine.odds, true)
  const worstProb = oddsToImpliedProbability(worstLine.odds, true)
  const probDiff = worstProb - bestProb
  
  // Convert probability difference to dollar value
  const potentialSavings = Math.round(probDiff * 100) / 100
  
  return {
    bestBook: bestLine.book,
    bestOdds: bestLine.odds,
    worstOdds: worstLine.odds,
    oddsRange: Math.abs(bestLine.odds - worstLine.odds),
    potentialSavings: Math.abs(potentialSavings),
    allLines: sorted
  }
}

/**
 * Detect steam moves (sharp money moving lines)
 * Indicates where sharp bettors are placing action
 */
export function detectSteamMove(
  openingLine: number,
  currentLine: number,
  lineMovementPercent: number = 2 // % movement threshold
): {
  isSteamMove: boolean
  direction: 'toward_favorite' | 'toward_underdog' | 'none'
  magnitude: number
  reasoning: string
} {
  const movement = Math.abs(currentLine - openingLine)
  const movementPercent = (movement / Math.abs(openingLine)) * 100
  
  if (movementPercent < lineMovementPercent) {
    return {
      isSteamMove: false,
      direction: 'none',
      magnitude: movementPercent,
      reasoning: `Line movement of ${movementPercent.toFixed(1)}% is not significant`
    }
  }
  
  const direction = currentLine < openingLine ? 'toward_favorite' : 'toward_underdog'
  
  const reasoning = direction === 'toward_favorite'
    ? `Line moved ${movement} points toward favorite (${openingLine} → ${currentLine}). Sharp money on favorite.`
    : `Line moved ${movement} points toward underdog (${openingLine} → ${currentLine}). Sharp money on underdog.`
  
  return {
    isSteamMove: true,
    direction,
    magnitude: movementPercent,
    reasoning
  }
}

/**
 * Market efficiency check - compare multiple books for consensus
 * Efficient markets have tight spreads, inefficient markets have opportunities
 */
export function analyzeMarketEfficiency(
  lines: Array<{ book: string; odds: number; isSharp: boolean }>
): {
  isEfficient: boolean
  efficiency: number // 0-100, higher = more efficient
  opportunities: string[]
  reasoning: string
} {
  if (lines.length < 3) {
    return {
      isEfficient: true,
      efficiency: 50,
      opportunities: [],
      reasoning: 'Insufficient books to analyze market efficiency'
    }
  }

  const sharpLines = lines.filter(l => l.isSharp).map(l => l.odds)
  const softLines = lines.filter(l => !l.isSharp).map(l => l.odds)
  
  // Calculate spread (range) in odds
  const allOdds = lines.map(l => l.odds)
  const maxOdds = Math.max(...allOdds)
  const minOdds = Math.min(...allOdds)
  const spread = maxOdds - minOdds
  
  // Calculate standard deviation of odds
  const mean = allOdds.reduce((sum, odd) => sum + odd, 0) / allOdds.length
  const variance = allOdds.reduce((sum, odd) => sum + Math.pow(odd - mean, 2), 0) / allOdds.length
  const stdDev = Math.sqrt(variance)
  
  // Efficiency score (lower spread and std dev = more efficient)
  const spreadScore = Math.max(0, 100 - (spread / 2))
  const consistencyScore = Math.max(0, 100 - (stdDev * 5))
  const efficiency = (spreadScore + consistencyScore) / 2
  
  const opportunities: string[] = []
  const isEfficient = efficiency > 70
  
  if (!isEfficient) {
    if (spread > 20) {
      opportunities.push(`Wide ${spread}-point spread indicates market disagreement`)
    }
    
    if (sharpLines.length > 0 && softLines.length > 0) {
      const sharpAvg = sharpLines.reduce((sum, odd) => sum + odd, 0) / sharpLines.length
      const softAvg = softLines.reduce((sum, odd) => sum + odd, 0) / softLines.length
      const divergence = Math.abs(sharpAvg - softAvg)
      
      if (divergence > 15) {
        opportunities.push(`Sharp/soft divergence of ${divergence.toFixed(0)} points - potential mispricing`)
      }
    }
  }
  
  const reasoning = isEfficient
    ? `Market is efficient with ${spread}-point spread and ${stdDev.toFixed(1)} std dev. Books are aligned.`
    : `Market shows inefficiency (${efficiency.toFixed(0)}/100 efficiency score). ${opportunities.join('. ')}`
  
  return {
    isEfficient,
    efficiency: Math.round(efficiency),
    opportunities,
    reasoning
  }
}

/**
 * Kelly Criterion - Calculate optimal bet sizing
 * Conservative approach uses fractional Kelly (1/4 or 1/2)
 */
export function calculateKellyCriterion(
  trueProbability: number, // 0-100
  odds: number, // American odds
  fraction: number = 0.25 // Use 1/4 Kelly for conservative sizing
): {
  fullKelly: number // % of bankroll
  fractionalKelly: number // % of bankroll (recommended)
  recommendedBet: number // Actual bet size for $1000 bankroll
  reasoning: string
} {
  const p = trueProbability / 100 // Win probability
  const q = 1 - p // Loss probability
  
  let b: number // Odds as decimal multiplier
  if (odds > 0) {
    b = odds / 100
  } else {
    b = 100 / Math.abs(odds)
  }
  
  // Kelly formula: f = (bp - q) / b
  const fullKelly = ((b * p) - q) / b
  const fractionalKelly = fullKelly * fraction
  
  // Cap at reasonable limits (never bet more than 5% of bankroll)
  const cappedKelly = Math.min(Math.max(fractionalKelly, 0), 0.05)
  
  // Calculate recommended bet for $1000 bankroll
  const recommendedBet = Math.round(cappedKelly * 1000)
  
  let reasoning = ''
  if (fullKelly <= 0) {
    reasoning = 'No edge detected - Kelly criterion suggests no bet'
  } else if (fullKelly > 0.15) {
    reasoning = `Full Kelly of ${(fullKelly * 100).toFixed(1)}% is aggressive. Using ${fraction * 100}% fractional Kelly = ${(cappedKelly * 100).toFixed(1)}% of bankroll.`
  } else {
    reasoning = `Recommended ${(cappedKelly * 100).toFixed(1)}% of bankroll using ${fraction * 100}% fractional Kelly.`
  }
  
  return {
    fullKelly: Math.round(fullKelly * 1000) / 10, // As percentage
    fractionalKelly: Math.round(cappedKelly * 1000) / 10, // As percentage
    recommendedBet,
    reasoning
  }
}

/**
 * Closing Line Value (CLV) - Compare bet odds to closing line
 * Positive CLV is the #1 indicator of long-term profitability
 */
export function calculateCLV(
  betOdds: number, // Odds when bet was placed
  closingOdds: number // Odds at game start
): {
  clv: number // Percentage CLV
  isPositive: boolean
  reasoning: string
} {
  const betProb = oddsToImpliedProbability(betOdds, true)
  const closingProb = oddsToImpliedProbability(closingOdds, true)
  
  const clv = betProb - closingProb
  const isPositive = clv > 0
  
  const reasoning = isPositive
    ? `Positive CLV of ${clv.toFixed(2)}%! You bet at better odds than the closing line.`
    : `Negative CLV of ${clv.toFixed(2)}%. The closing line was more favorable.`
  
  return {
    clv: Math.round(clv * 100) / 100,
    isPositive,
    reasoning
  }
}