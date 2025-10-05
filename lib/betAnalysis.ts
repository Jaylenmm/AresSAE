// ===== REPLACE /lib/betAnalysis.ts WITH THIS UNIFIED VERSION =====

import { OddsData, PlayerProp } from './types'

interface BetSelection {
  type: 'spread' | 'moneyline' | 'total' | 'player_prop'
  team?: string
  player?: string
  propType?: string
  selection: string
  line?: number | string
  odds: number
  sportsbook: string
  game_id?: string
}

interface AnalysisResult {
  ev_percentage: number
  has_edge: boolean
  hit_probability: number
  recommendation_score: number
  reasoning: string
  best_book: string
  best_odds: number
  comparison_odds: { sportsbook: string; odds: number }[]
}

// Sharp books that set the market
const SHARP_BOOKS = ['pinnacle', 'betonlineag', 'bookmaker']

// Historical hit rates by situation
const HIT_RATES = {
  'home_favorite_small': 0.58,      // Home favorites -3 or less
  'road_underdog_large': 0.55,      // Road underdogs +7 or more
  'total_weather': 0.56,            // Totals with weather factors
  'sharp_edge': 0.57,               // When sharp books disagree with public
  'default': 0.52                   // Standard 50/50 bet
}

// Convert American odds to decimal
function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1
  } else {
    return (100 / Math.abs(american)) + 1
  }
}

// Convert American odds to implied probability
function oddsToImpliedProbability(american: number): number {
  if (american > 0) {
    return 100 / (american + 100)
  } else {
    return Math.abs(american) / (Math.abs(american) + 100)
  }
}

// Calculate no-vig probability (true odds)
function calculateNoVigProbability(odds1: number, odds2: number): number {
  const prob1 = oddsToImpliedProbability(odds1)
  const prob2 = oddsToImpliedProbability(odds2)
  const totalProb = prob1 + prob2
  
  // Remove the vig to get true probability
  return prob1 / totalProb
}

// Calculate Expected Value (EV)
function calculateEV(odds: number, trueProbability: number): number {
  const decimalOdds = americanToDecimal(odds)
  const ev = (trueProbability * (decimalOdds - 1)) - ((1 - trueProbability) * 1)
  return ev * 100 // Return as percentage
}

// Detect sharp vs public line discrepancies (YOUR ORIGINAL LOGIC)
function detectSharpEdge(allOdds: OddsData[], betType: 'spread' | 'total'): {
  hasSharpEdge: boolean
  sharpLine: number
  publicLine: number
  lineDiscrepancy: number
  sharpBook: string
  bestPublicBook: string
} | null {
  const sharpOdds = allOdds.find(o => SHARP_BOOKS.includes(o.sportsbook.toLowerCase()))
  const publicOdds = allOdds.filter(o => !SHARP_BOOKS.includes(o.sportsbook.toLowerCase()))

  if (!sharpOdds || publicOdds.length === 0) return null

  let bestPublicBook = publicOdds[0]
  let maxDiscrepancy = 0
  let sharpLine = 0
  let bestPublicLine = 0

  if (betType === 'spread') {
    sharpLine = sharpOdds.spread_home || 0
    
    for (const book of publicOdds) {
      const discrepancy = Math.abs((book.spread_home || 0) - sharpLine)
      if (discrepancy > maxDiscrepancy) {
        maxDiscrepancy = discrepancy
        bestPublicBook = book
        bestPublicLine = book.spread_home || 0
      }
    }
  } else if (betType === 'total') {
    sharpLine = sharpOdds.total || 0
    
    for (const book of publicOdds) {
      const discrepancy = Math.abs((book.total || 0) - sharpLine)
      if (discrepancy > maxDiscrepancy) {
        maxDiscrepancy = discrepancy
        bestPublicBook = book
        bestPublicLine = book.total || 0
      }
    }
  }

  return {
    hasSharpEdge: maxDiscrepancy >= 0.5,
    sharpLine,
    publicLine: bestPublicLine,
    lineDiscrepancy: maxDiscrepancy,
    sharpBook: sharpOdds.sportsbook,
    bestPublicBook: bestPublicBook.sportsbook
  }
}

// Find best odds across all sportsbooks
function findBestOdds(allOdds: { sportsbook: string; odds: number }[]): { 
  best_book: string
  best_odds: number
  comparison_odds: { sportsbook: string; odds: number }[]
} {
  if (allOdds.length === 0) {
    return { best_book: 'N/A', best_odds: 0, comparison_odds: [] }
  }

  // Sort by highest odds (best value for bettor)
  const sorted = [...allOdds].sort((a, b) => {
    const decimalA = americanToDecimal(a.odds)
    const decimalB = americanToDecimal(b.odds)
    return decimalB - decimalA
  })

  return {
    best_book: sorted[0].sportsbook,
    best_odds: sorted[0].odds,
    comparison_odds: sorted
  }
}

// Determine hit rate based on bet characteristics
function estimateHitRate(
  betType: string,
  line: number | undefined,
  isHome: boolean,
  hasSharpEdge: boolean
): number {
  if (hasSharpEdge) return HIT_RATES.sharp_edge

  if (betType === 'spread') {
    const absLine = Math.abs(line || 0)
    if (isHome && absLine <= 3) return HIT_RATES.home_favorite_small
    if (!isHome && absLine >= 7) return HIT_RATES.road_underdog_large
  }

  if (betType === 'total') {
    // Could add weather/pace logic here in future
    return HIT_RATES.total_weather
  }

  return HIT_RATES.default
}

// MAIN ANALYSIS FUNCTION FOR GAME BETS
export function analyzeGameBet(
  bet: BetSelection,
  allGameOdds: OddsData[]
): AnalysisResult {
  // Collect all odds for this bet type across sportsbooks
  const oddsComparison: { sportsbook: string; odds: number }[] = []
  const oppositeOdds: number[] = []
  let betLine: number | undefined

  allGameOdds.forEach(bookOdds => {
    if (bet.type === 'spread') {
      if (bet.selection.includes('home')) {
        betLine = bookOdds.spread_home
        if (bookOdds.spread_home_odds) {
          oddsComparison.push({ sportsbook: bookOdds.sportsbook, odds: bookOdds.spread_home_odds })
        }
        if (bookOdds.spread_away_odds) {
          oppositeOdds.push(bookOdds.spread_away_odds)
        }
      } else {
        betLine = bookOdds.spread_away
        if (bookOdds.spread_away_odds) {
          oddsComparison.push({ sportsbook: bookOdds.sportsbook, odds: bookOdds.spread_away_odds })
        }
        if (bookOdds.spread_home_odds) {
          oppositeOdds.push(bookOdds.spread_home_odds)
        }
      }
    } else if (bet.type === 'moneyline') {
      if (bet.selection.includes('home')) {
        if (bookOdds.moneyline_home) {
          oddsComparison.push({ sportsbook: bookOdds.sportsbook, odds: bookOdds.moneyline_home })
        }
        if (bookOdds.moneyline_away) {
          oppositeOdds.push(bookOdds.moneyline_away)
        }
      } else {
        if (bookOdds.moneyline_away) {
          oddsComparison.push({ sportsbook: bookOdds.sportsbook, odds: bookOdds.moneyline_away })
        }
        if (bookOdds.moneyline_home) {
          oppositeOdds.push(bookOdds.moneyline_home)
        }
      }
    } else if (bet.type === 'total') {
      betLine = bookOdds.total
      if (bet.selection === 'over') {
        if (bookOdds.over_odds) {
          oddsComparison.push({ sportsbook: bookOdds.sportsbook, odds: bookOdds.over_odds })
        }
        if (bookOdds.under_odds) {
          oppositeOdds.push(bookOdds.under_odds)
        }
      } else {
        if (bookOdds.under_odds) {
          oddsComparison.push({ sportsbook: bookOdds.sportsbook, odds: bookOdds.under_odds })
        }
        if (bookOdds.over_odds) {
          oppositeOdds.push(bookOdds.over_odds)
        }
      }
    }
  })

  // Find best odds
  const { best_book, best_odds, comparison_odds } = findBestOdds(oddsComparison)

  // Detect sharp vs public edge (YOUR ORIGINAL LOGIC)
  let sharpEdgeData = null
  if (bet.type === 'spread' || bet.type === 'total') {
    sharpEdgeData = detectSharpEdge(allGameOdds, bet.type)
  }

  // Calculate no-vig probability
  const avgOppositeOdds = oppositeOdds.length > 0
    ? oppositeOdds.reduce((a, b) => a + b, 0) / oppositeOdds.length
    : -110

  const trueProbability = calculateNoVigProbability(best_odds, avgOppositeOdds)
  const impliedProbability = oddsToImpliedProbability(best_odds)
  
  // Calculate EV
  let ev = calculateEV(best_odds, trueProbability)
  
  // Boost EV if sharp edge detected (YOUR ORIGINAL LOGIC)
  if (sharpEdgeData?.hasSharpEdge) {
    const sharpBoost = sharpEdgeData.lineDiscrepancy * 2
    ev += sharpBoost
  }

  // Check for edge
  const avgOdds = oddsComparison.reduce((sum, o) => sum + o.odds, 0) / oddsComparison.length
  const hasMarketEdge = best_odds > avgOdds
  const hasSharpEdge = sharpEdgeData?.hasSharpEdge || false
  const hasEdge = hasMarketEdge || hasSharpEdge || ev > 0

  // Determine hit probability
  const isHome = bet.selection.includes('home')
  const baseHitRate = estimateHitRate(bet.type, betLine, isHome, hasSharpEdge)
  
  // Adjust hit rate based on EV and edge
  let hitProbability = baseHitRate
  if (ev > 5) hitProbability += 0.03
  if (hasSharpEdge) hitProbability += 0.02
  hitProbability = Math.min(0.65, hitProbability) // Cap at 65%

  // Calculate recommendation score (0-100)
  let recommendationScore = 50
  
  // EV contribution
  if (ev > 5) recommendationScore += 25
  else if (ev > 3) recommendationScore += 15
  else if (ev > 1) recommendationScore += 8
  else if (ev > 0) recommendationScore += 3
  
  // Edge contribution
  if (hasSharpEdge) recommendationScore += 15
  if (hasMarketEdge) recommendationScore += 10
  
  // Hit probability contribution
  if (hitProbability > 0.60) recommendationScore += 10
  else if (hitProbability > 0.55) recommendationScore += 7
  else if (hitProbability > 0.52) recommendationScore += 4

  recommendationScore = Math.min(100, recommendationScore)

  // Generate reasoning (ENHANCED WITH YOUR LOGIC)
  let reasoning = ''
  
  if (sharpEdgeData?.hasSharpEdge) {
    reasoning = `🔥 SHARP EDGE DETECTED: ${sharpEdgeData.bestPublicBook} offering ${sharpEdgeData.publicLine} while ${sharpEdgeData.sharpBook} at ${sharpEdgeData.sharpLine}. ${sharpEdgeData.lineDiscrepancy.toFixed(1)} point discrepancy. `
  }

  if (ev > 5 && hasEdge && hitProbability > 0.55) {
    reasoning += `STRONG PLAY: Excellent ${ev.toFixed(1)}% EV with ${(hitProbability * 100).toFixed(1)}% hit probability. Best odds at ${best_book}.`
  } else if (ev > 2 && hasEdge) {
    reasoning += `✅ SOLID PLAY: Good value with ${ev.toFixed(1)}% EV. ${best_book} offering best price.`
  } else if (ev > 0) {
    reasoning += `⚠️ SLIGHT EDGE: Minimal ${ev.toFixed(1)}% EV. Consider as part of larger strategy.`
  } else if (hasMarketEdge) {
    reasoning += `📊 MARKET OPPORTUNITY: ${best_book} has better odds than average (${ev.toFixed(1)}% EV).`
  } else {
    reasoning += `❌ PASS: Negative ${ev.toFixed(1)}% EV. Lines are efficient. No clear advantage.`
  }

  return {
    ev_percentage: parseFloat(ev.toFixed(2)),
    has_edge: hasEdge,
    hit_probability: parseFloat((hitProbability * 100).toFixed(1)),
    recommendation_score: Math.round(recommendationScore),
    reasoning,
    best_book,
    best_odds,
    comparison_odds
  }
}

// ANALYZE PLAYER PROP
export function analyzePlayerProp(
  bet: BetSelection,
  allProps: PlayerProp[]
): AnalysisResult {
  // Find all instances of this prop across sportsbooks
  const relevantProps = allProps.filter(p => 
    p.player_name === bet.player &&
    p.prop_type === bet.propType &&
    Math.abs(p.line - Number(bet.line)) < 0.5
  )

  const oddsComparison: { sportsbook: string; odds: number }[] = []
  const oppositeOdds: number[] = []

  relevantProps.forEach(prop => {
    if (bet.selection === 'over') {
      if (prop.over_odds) oddsComparison.push({ sportsbook: prop.sportsbook, odds: prop.over_odds })
      if (prop.under_odds) oppositeOdds.push(prop.under_odds)
    } else {
      if (prop.under_odds) oddsComparison.push({ sportsbook: prop.sportsbook, odds: prop.under_odds })
      if (prop.over_odds) oppositeOdds.push(prop.over_odds)
    }
  })

  const { best_book, best_odds, comparison_odds } = findBestOdds(oddsComparison)

  // Calculate probabilities
  const avgOppositeOdds = oppositeOdds.length > 0
    ? oppositeOdds.reduce((a, b) => a + b, 0) / oppositeOdds.length
    : -110

  const trueProbability = calculateNoVigProbability(best_odds, avgOppositeOdds)
  const ev = calculateEV(best_odds, trueProbability)
  
  const avgOdds = oddsComparison.reduce((sum, o) => sum + o.odds, 0) / oddsComparison.length
  const hasEdge = best_odds > avgOdds || ev > 0

  // Calculate recommendation score
  let recommendationScore = 50
  if (ev > 5) recommendationScore += 25
  else if (ev > 3) recommendationScore += 15
  else if (ev > 1) recommendationScore += 8
  else if (ev > 0) recommendationScore += 3

  if (hasEdge) recommendationScore += 15
  if (trueProbability > 0.55) recommendationScore += 10

  recommendationScore = Math.min(100, recommendationScore)

  // Generate reasoning
  const propDisplay = `${bet.player} ${bet.selection} ${bet.line} ${bet.propType}`
  let reasoning = ''
  
  if (ev > 5 && hasEdge && trueProbability > 0.55) {
    reasoning = `🔥 STRONG PROP: ${propDisplay} shows ${ev.toFixed(1)}% EV with ${(trueProbability * 100).toFixed(1)}% hit probability. ${best_book} has best price.`
  } else if (ev > 2 && hasEdge) {
    reasoning = `✅ SOLID PROP: ${propDisplay} with ${ev.toFixed(1)}% positive EV at ${best_book}.`
  } else if (ev > 0) {
    reasoning = `⚠️ MARGINAL: ${propDisplay} shows slight ${ev.toFixed(1)}% edge but low confidence.`
  } else {
    reasoning = `❌ PASS: ${propDisplay} has negative ${ev.toFixed(1)}% EV. Look for better spots.`
  }

  return {
    ev_percentage: parseFloat(ev.toFixed(2)),
    has_edge: hasEdge,
    hit_probability: parseFloat((trueProbability * 100).toFixed(1)),
    recommendation_score: Math.round(recommendationScore),
    reasoning,
    best_book,
    best_odds,
    comparison_odds
  }
}