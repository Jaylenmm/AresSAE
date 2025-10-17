// lib/alternate-line-probability.ts

import { BookmakerOdds } from './analysis-engine'
import { removeVig } from './odds-calculations'

/**
 * Sport-specific adjustment rates for line movement
 * These represent probability change per unit of line movement
 */
const LINE_ADJUSTMENT_RATES: Record<string, Record<string, number>> = {
  'NFL': {
    'Pass Yds': 0.01,           // 1% per yard
    'Pass Tds': 0.08,           // 8% per TD
    'Pass Completions': 0.02,   // 2% per completion
    'Rush Yds': 0.015,          // 1.5% per yard
    'Rush Attempts': 0.025,     // 2.5% per attempt
    'Receptions': 0.03,         // 3% per reception
    'Reception Yds': 0.015,     // 1.5% per yard
    'Pass Interceptions': 0.10, // 10% per INT
    // Game lines
    'spread': 0.03,             // 3% per point
    'total': 0.02               // 2% per point
  },
  'NBA': {
    'Points': 0.02,             // 2% per point
    'Rebounds': 0.04,           // 4% per rebound
    'Assists': 0.04,            // 4% per assist
    'Threes': 0.08,             // 8% per three
    'Blocks': 0.10,             // 10% per block
    'Steals': 0.10,             // 10% per steal
    'Points Rebounds Assists': 0.015,  // 1.5% per PRA point
    'Points Rebounds': 0.02,    // 2% per PR point
    'Points Assists': 0.02,     // 2% per PA point
    // Game lines
    'spread': 0.025,            // 2.5% per point
    'total': 0.015              // 1.5% per point
  },
  'MLB': {
    'Home Runs': 0.15,          // 15% per HR
    'Hits': 0.06,               // 6% per hit
    'Total Bases': 0.04,        // 4% per base
    'Rbis': 0.08,               // 8% per RBI
    'Runs Scored': 0.08,        // 8% per run
    'Strikeouts': 0.05,         // 5% per K (batter)
    'Pitcher Strikeouts': 0.04, // 4% per K (pitcher)
    'Hits Allowed': 0.05,       // 5% per hit
    'Earned Runs': 0.10,        // 10% per ER
    // Game lines
    'spread': 0.04,             // 4% per run
    'total': 0.03               // 3% per run
  },
  'NCAAF': {
    'Pass Yds': 0.01,
    'Pass Tds': 0.08,
    'Rush Yds': 0.015,
    'Receptions': 0.03,
    'Reception Yds': 0.015,
    'spread': 0.03,
    'total': 0.02
  }
}

interface SharpConsensus {
  line: number
  trueProbability: number
  source: 'sharp' | 'soft'
  confidence: number
}

/**
 * Find the sharp consensus line and probability
 * Falls back to soft books if sharp data unavailable
 */
export function findSharpConsensus(
  sport: string,
  propType: string,
  playerName: string | undefined,
  selection: 'over' | 'under' | 'spread' | 'home' | 'away',
  allBookmakers: BookmakerOdds[]
): SharpConsensus | null {
  
  const sharpBooks = ['pinnacle', 'betonline', 'bookmaker', 'circa']
  
  // Try sharp books first
  const sharpData = allBookmakers.filter(b => 
    sharpBooks.some(sharp => b.key.toLowerCase().includes(sharp))
  )
  
  if (sharpData.length > 0) {
    const consensus = calculateConsensus(sharpData, propType, playerName, selection, sport)
    if (consensus) {
      return { ...consensus, source: 'sharp', confidence: 90 }
    }
  }
  
  // Fallback to soft books
  console.warn('⚠️ No sharp odds available - using soft book consensus')
  const softData = allBookmakers.filter(b => 
    !sharpBooks.some(sharp => b.key.toLowerCase().includes(sharp))
  )
  
  if (softData.length > 0) {
    const consensus = calculateConsensus(softData, propType, playerName, selection, sport)
    if (consensus) {
      return { ...consensus, source: 'soft', confidence: 60 }
    }
  }
  
  return null
}

/**
 * Calculate consensus from available bookmakers
 */
function calculateConsensus(
  bookmakers: BookmakerOdds[],
  propType: string,
  playerName: string | undefined,
  selection: 'over' | 'under' | 'spread' | 'home' | 'away',
  sport: string
): { line: number; trueProbability: number } | null {
  
  const lines: { line: number; overOdds: number; underOdds: number }[] = []
  
  // Collect all lines and odds from markets
  for (const book of bookmakers) {
    for (const market of book.markets) {
      // Find outcomes for this selection
      const outcomes = market.outcomes
      
      if (playerName) {
        // Player prop - find matching player
        const playerOutcomes = outcomes.filter(o => o.description === playerName)
        const over = playerOutcomes.find(o => o.name === 'Over')
        const under = playerOutcomes.find(o => o.name === 'Under')
        
        if (over && under && over.point && over.price && under.price) {
          lines.push({
            line: over.point,
            overOdds: over.price,
            underOdds: under.price
          })
        }
      } else {
        // Game line - find Over/Under or spread
        const over = outcomes.find(o => o.name === 'Over')
        const under = outcomes.find(o => o.name === 'Under')
        
        if (over && under && over.point && over.price && under.price) {
          lines.push({
            line: over.point,
            overOdds: over.price,
            underOdds: under.price
          })
        }
      }
    }
  }
  
  if (lines.length === 0) return null
  
  // Find most common line (mode)
  const lineFrequency = new Map<number, number>()
  lines.forEach(l => {
    lineFrequency.set(l.line, (lineFrequency.get(l.line) || 0) + 1)
  })
  
  let consensusLine = 0
  let maxFreq = 0
  lineFrequency.forEach((freq, line) => {
    if (freq > maxFreq) {
      maxFreq = freq
      consensusLine = line
    }
  })
  
  // Get odds for consensus line and remove vig
  const consensusOdds = lines.find(l => l.line === consensusLine)
  if (!consensusOdds) return null
  
  const { prob1, prob2 } = removeVig(consensusOdds.overOdds, consensusOdds.underOdds)
  
  const trueProbability = selection === 'over' ? prob1 : prob2
  
  return { line: consensusLine, trueProbability }
}

/**
 * Adjust probability for a different line using linear adjustment
 */
export function adjustProbabilityForLine(
  sport: string,
  propType: string,
  baseLine: number,
  baseProb: number,
  targetLine: number,
  selection: 'over' | 'under' | 'spread' | 'home' | 'away'
): number {
  
  const lineDiff = targetLine - baseLine
  
  if (lineDiff === 0) return baseProb
  
  // Get adjustment rate for this prop type
  const sportRates = LINE_ADJUSTMENT_RATES[sport]
  if (!sportRates) {
    console.warn(`No adjustment rates for sport: ${sport}`)
    return baseProb
  }
  
  const rate = sportRates[propType] || sportRates['spread'] || 0.02 // default 2%
  
  // For "over" bets: higher line = lower probability
  // For "under" bets: higher line = higher probability
  let adjustment = 0
  
  if (selection === 'over') {
    adjustment = -lineDiff * rate  // Higher line = harder = lower prob
  } else if (selection === 'under') {
    adjustment = lineDiff * rate   // Higher line = easier = higher prob
  } else if (selection === 'spread') {
    // Spread adjustment is symmetric
    adjustment = -Math.abs(lineDiff) * rate
  }
  
  const adjustedProb = baseProb + adjustment
  
  // Clamp between 5% and 95%
  return Math.max(0.05, Math.min(0.95, adjustedProb))
}

/**
 * Adjust confidence based on distance from consensus
 */
export function adjustConfidenceForAlternateLine(
  baseConfidence: number,
  lineDifference: number,
  source: 'sharp' | 'soft'
): number {
  
  let confidence = baseConfidence
  
  // Reduce confidence for lines far from consensus
  const distancePenalty = Math.abs(lineDifference) * 2 // -2 per unit away
  confidence -= distancePenalty
  
  // Reduce further if using soft book consensus
  if (source === 'soft') {
    confidence -= 10
  }
  
  return Math.max(20, Math.min(100, confidence))
}

/**
 * Main function: Get adjusted probability and confidence for alternate line
 * This integrates with your existing analysis engine
 */
export function getAlternateLineAdjustments(
  sport: string,
  propType: string,
  playerName: string | undefined,
  selectedLine: number,
  selection: 'over' | 'under' | 'spread' | 'home' | 'away',
  allBookmakers: BookmakerOdds[]
): {
  adjustedProbability: number
  adjustedConfidence: number
  consensusLine: number | null
  lineDifference: number
  source: 'sharp' | 'soft' | null
  probabilityAdjustment: number
} | null {
  
  // Find sharp consensus
  const consensus = findSharpConsensus(sport, propType, playerName, selection, allBookmakers)
  
  if (!consensus) {
    console.warn('⚠️ No consensus found for alternate line adjustment')
    return null
  }
  
  // If analyzing consensus line, no adjustment needed
  if (Math.abs(selectedLine - consensus.line) < 0.1) {
    return {
      adjustedProbability: consensus.trueProbability,
      adjustedConfidence: consensus.confidence,
      consensusLine: consensus.line,
      lineDifference: 0,
      source: consensus.source,
      probabilityAdjustment: 0
    }
  }
  
  // Adjust probability for alternate line
  const adjustedProb = adjustProbabilityForLine(
    sport,
    propType,
    consensus.line,
    consensus.trueProbability,
    selectedLine,
    selection
  )
  
  const lineDiff = selectedLine - consensus.line
  const probAdjustment = adjustedProb - consensus.trueProbability
  
  // Adjust confidence
  const adjustedConf = adjustConfidenceForAlternateLine(
    consensus.confidence,
    lineDiff,
    consensus.source
  )
  
  console.log(`📊 Alternate Line Adjustment:`)
  console.log(`  Consensus: ${consensus.line} at ${(consensus.trueProbability * 100).toFixed(1)}%`)
  console.log(`  Selected: ${selectedLine}`)
  console.log(`  Adjusted Probability: ${(adjustedProb * 100).toFixed(1)}%`)
  console.log(`  Confidence: ${adjustedConf}%`)
  
  return {
    adjustedProbability: adjustedProb,
    adjustedConfidence: adjustedConf,
    consensusLine: consensus.line,
    lineDifference: lineDiff,
    source: consensus.source,
    probabilityAdjustment: probAdjustment
  }
}