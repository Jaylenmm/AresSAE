// ===== CREATE: lib/analysis-engine.ts =====

import { OddsData, PlayerProp } from './types'
import { isSharpBook, compareSharpVsSoft, getBookmakerDisplayName } from './bookmakers'
import { 
  analyzePlayerPropStats, 
  evaluatePlayerPropLine, 
  analyzeTotalWithUnderBias,
  detectPerformanceAnomaly,
  calculateMedian
} from './statistical-analysis'
import { 
  detectEdge, 
  shopLines, 
  analyzeMarketEfficiency,
  calculateKellyCriterion,
  oddsToImpliedProbability
} from './edge-detection'

/**
 * Comprehensive Bet Analysis Result
 */
export interface ComprehensiveBetAnalysis {
  // Core recommendation
  recommendation: 'strong_bet' | 'bet' | 'lean' | 'pass'
  confidence: number // 0-100
  
  // Edge analysis
  hasEdge: boolean
  edgePercent: number
  evDollars: number
  
  // Market analysis
  sharpVsSoft: {
    sharpConsensus: number | null
    softConsensus: number | null
    divergence: number
    edge: 'sharp' | 'soft' | 'neutral'
  }
  
  // Line shopping
  bestBook: string
  bestOdds: number
  potentialSavings: number
  
  // Market efficiency
  marketEfficiency: number
  marketOpportunities: string[]
  
  // Bet sizing
  kellySizing: {
    recommended: number // Dollars for $1000 bankroll
    percentage: number
  }
  
  // Reasoning breakdown
  reasoning: string[]
  warnings: string[]
  
  // Additional context
  hitProbability: number
  impliedProbability: number
}

/**
 * MAIN ANALYSIS FUNCTION: Analyze any game bet (spread, moneyline, total)
 */
export async function analyzeGameBet(
  allOdds: OddsData[],
  betType: 'spread' | 'moneyline' | 'total',
  selection: 'home' | 'away' | 'over' | 'under',
  gameContext?: {
    historicalTotals?: number[]
    recentForm?: { home: number[]; away: number[] }
  }
): Promise<ComprehensiveBetAnalysis> {
  
  const reasoning: string[] = []
  const warnings: string[] = []
  
  // Step 1: Extract relevant lines and classify books
  const lines = allOdds.map(odds => {
    let line: number
    let oddsValue: number | undefined
    
    if (betType === 'spread') {
      line = selection === 'home' ? (odds.spread_home || 0) : (odds.spread_away || 0)
      oddsValue = selection === 'home' ? odds.spread_home_odds : odds.spread_away_odds
    } else if (betType === 'moneyline') {
      line = 0
      oddsValue = selection === 'home' ? odds.moneyline_home : odds.moneyline_away
    } else { // total
      line = odds.total || 0
      oddsValue = selection === 'over' ? odds.over_odds : odds.under_odds
    }
    
    return {
      book: odds.sportsbook,
      line,
      odds: oddsValue || -110,
      isSharp: isSharpBook(odds.sportsbook)
    }
  }).filter(l => l.odds !== undefined)
  
  if (lines.length === 0) {
    return getDefaultAnalysis('No odds data available')
  }
  
  // Step 2: Line shopping - find best odds
  const lineShop = shopLines(lines.map(l => ({ book: l.book, odds: l.odds })))
  reasoning.push(`📊 Best odds: ${lineShop.bestBook} at ${lineShop.bestOdds > 0 ? '+' : ''}${lineShop.bestOdds}`)
  
  if (lineShop.potentialSavings > 1) {
    reasoning.push(`💰 Line shopping saves ${lineShop.potentialSavings.toFixed(1)}% vs worst book`)
  }
  
  // Step 3: Sharp vs Soft analysis
  const sharpSoft = compareSharpVsSoft(lines.map(l => ({ sportsbook: l.book, line: l.line })))
  let sharpVsSoftData = {
    sharpConsensus: null as number | null,
    softConsensus: null as number | null,
    divergence: 0,
    edge: 'neutral' as 'sharp' | 'soft' | 'neutral'
  }
  
  if (sharpSoft) {
    sharpVsSoftData = {
      sharpConsensus: sharpSoft.sharpConsensus,
      softConsensus: sharpSoft.softConsensus,
      divergence: sharpSoft.divergence,
      edge: sharpSoft.edge
    }
    
    if (sharpSoft.divergencePercent > 2) {
      reasoning.push(
        `🎯 Sharp books (${sharpSoft.sharpBooks.join(', ')}) at ${sharpSoft.sharpConsensus.toFixed(1)} ` +
        `vs soft books (${sharpSoft.softBooks.slice(0, 2).join(', ')}) at ${sharpSoft.softConsensus.toFixed(1)} ` +
        `(${sharpSoft.divergencePercent.toFixed(1)}% divergence)`
      )
      
      if (sharpSoft.edge !== 'neutral') {
        reasoning.push(`⚡ Edge detected on ${sharpSoft.edge === 'sharp' ? 'sharp side' : 'soft side'}`)
      }
    } else {
      reasoning.push(`📍 Sharp and soft books aligned - efficient market`)
    }
  }
  
  // Step 4: Market efficiency analysis
  const efficiency = analyzeMarketEfficiency(lines)
  reasoning.push(`🏪 Market efficiency: ${efficiency.efficiency}/100`)
  
  if (efficiency.opportunities.length > 0) {
    efficiency.opportunities.forEach((opp: string) => reasoning.push(`🔍 ${opp}`))
  }
  
  // Step 5: Estimate true probability
  let trueProbability = 50 // Default
  let hitProbability = 50
  
  if (betType === 'total' && gameContext?.historicalTotals) {
    // Use under bias analysis for totals
    const totalAnalysis = analyzeTotalWithUnderBias(
      lines[0].line,
      gameContext.historicalTotals
    )
    
    reasoning.push(`📉 Total analysis: ${totalAnalysis.reasoning}`)
    
    if (selection === totalAnalysis.recommendation) {
      trueProbability = 54.5 // Align with under bias
      hitProbability = totalAnalysis.confidence
    } else {
      trueProbability = 45.5
      hitProbability = 100 - totalAnalysis.confidence
    }
  } else {
    // Use market consensus with sharp/soft weighting
    const sharpWeight = 0.7
    const softWeight = 0.3
    
    if (sharpSoft && sharpSoft.sharpConsensus && sharpSoft.softConsensus) {
      const impliedProb = oddsToImpliedProbability(lineShop.bestOdds, true)
      
      // Adjust based on sharp/soft divergence
      if (sharpSoft.edge === 'sharp' && selection === 'home') {
        trueProbability = impliedProb + sharpSoft.divergencePercent * 0.5
      } else if (sharpSoft.edge === 'soft' && selection === 'away') {
        trueProbability = impliedProb + sharpSoft.divergencePercent * 0.5
      } else {
        trueProbability = impliedProb
      }
      
      hitProbability = trueProbability
    } else {
      trueProbability = oddsToImpliedProbability(lineShop.bestOdds, true)
      hitProbability = trueProbability
    }
  }
  
  // Step 6: Edge detection
  const edge = detectEdge(trueProbability, lineShop.bestOdds, 2)
  edge.reasoning.forEach((r: string) => reasoning.push(r))
  
  if (!edge.hasEdge) {
    warnings.push('⚠️ No statistically significant edge detected (need 2%+ edge)')
  }
  
  if (edge.edgePercent > 10) {
    warnings.push('⚠️ Edge seems unrealistically high - verify your analysis carefully')
  }
  
  // Step 7: Kelly sizing
  const kelly = calculateKellyCriterion(trueProbability, lineShop.bestOdds, 0.25)
  reasoning.push(`💵 ${kelly.reasoning}`)
  
  // Step 8: Final recommendation
  let recommendation: 'strong_bet' | 'bet' | 'lean' | 'pass' = 'pass'
  let confidence = edge.confidence
  
  if (edge.recommendation === 'strong_bet') {
    recommendation = 'strong_bet'
    confidence = Math.min(confidence + 10, 90)
  } else if (edge.recommendation === 'bet') {
    recommendation = 'bet'
  } else if (edge.edgePercent > 1 && edge.edgePercent < 2) {
    recommendation = 'lean'
    confidence = 45
  }
  
  // Boost confidence if sharp/soft divergence supports bet
  if (sharpSoft && sharpSoft.edge !== 'neutral' && sharpSoft.divergencePercent > 3) {
    confidence = Math.min(confidence + 5, 95)
    reasoning.push(`✓ Sharp/soft divergence supports this play`)
  }
  
  return {
    recommendation,
    confidence: Math.round(confidence),
    hasEdge: edge.hasEdge,
    edgePercent: edge.edgePercent,
    evDollars: edge.evDollars,
    sharpVsSoft: sharpVsSoftData,
    bestBook: lineShop.bestBook,
    bestOdds: lineShop.bestOdds,
    potentialSavings: lineShop.potentialSavings,
    marketEfficiency: efficiency.efficiency,
    marketOpportunities: efficiency.opportunities,
    kellySizing: {
      recommended: kelly.recommendedBet,
      percentage: kelly.fractionalKelly
    },
    reasoning,
    warnings,
    hitProbability: Math.round(hitProbability),
    impliedProbability: Math.round(oddsToImpliedProbability(lineShop.bestOdds, true))
  }
}

/**
 * MAIN ANALYSIS FUNCTION: Analyze player props
 */
export async function analyzePlayerProp(
  playerProps: PlayerProp[],
  playerName: string,
  propType: string,
  selection: 'over' | 'under',
  historicalData?: {
    seasonStats: number[]
    last5Games: number[]
  }
): Promise<ComprehensiveBetAnalysis> {
  
  const reasoning: string[] = []
  const warnings: string[] = []
  
  // Step 1: Get all lines for this prop
  const relevantProps = playerProps.filter(
    p => p.player_name === playerName && p.prop_type === propType
  )
  
  if (relevantProps.length === 0) {
    return getDefaultAnalysis('No prop data available for this player')
  }
  
  const propLine = relevantProps[0].line
  reasoning.push(`📊 Analyzing ${playerName} ${propType} ${selection} ${propLine}`)
  
  // Step 2: Line shopping
  const lines = relevantProps.map(prop => ({
    book: prop.sportsbook,
    odds: selection === 'over' ? (prop.over_odds || -110) : (prop.under_odds || -110)
  }))
  
  const lineShop = shopLines(lines)
  reasoning.push(`💰 Best odds: ${lineShop.bestBook} at ${lineShop.bestOdds > 0 ? '+' : ''}${lineShop.bestOdds}`)
  
  // Step 3: Statistical analysis using historical data
  let trueProbability = 50
  let hitProbability = 50
  
  if (historicalData && historicalData.seasonStats.length > 0) {
    const stats = analyzePlayerPropStats(historicalData.seasonStats, 5)
    reasoning.push(
      `📈 Season stats: Median ${stats.median.toFixed(1)}, ` +
      `Mean ${stats.mean.toFixed(1)} (${stats.sampleSize} games)`
    )
    
    // CRITICAL: Use median, not mean
    const evaluation = evaluatePlayerPropLine(propLine, stats)
    reasoning.push(`🎯 ${evaluation.reasoning}`)
    
    trueProbability = selection === 'over' ? evaluation.overProbability : evaluation.underProbability
    hitProbability = trueProbability
    
    // Check for performance anomalies
    if (historicalData.last5Games.length >= 3) {
      const anomaly = detectPerformanceAnomaly(historicalData.last5Games, stats.mean)
      if (anomaly.anomalyDetected) {
        warnings.push(`⚠️ ${anomaly.reasoning}`)
        
        // Adjust probability based on anomaly
        if (anomaly.type === 'decline' && selection === 'under') {
          trueProbability = Math.min(trueProbability + anomaly.severity, 65)
          reasoning.push(`Adjusted probability for recent decline trend`)
        } else if (anomaly.type === 'surge' && selection === 'over') {
          trueProbability = Math.min(trueProbability + anomaly.severity, 65)
          reasoning.push(`Adjusted probability for recent surge trend`)
        }
      }
    }
    
    // Strong signal if line is 10%+ away from median
    const lineVsMedian = ((propLine - stats.median) / stats.median) * 100
    if (Math.abs(lineVsMedian) > 10) {
      const direction = lineVsMedian > 0 ? 'above' : 'below'
      reasoning.push(
        `⚡ Line is ${Math.abs(lineVsMedian).toFixed(1)}% ${direction} median - ` +
        `significant mispricing potential`
      )
    }
  } else {
    warnings.push('⚠️ No historical data available - analysis based on market odds only')
    trueProbability = oddsToImpliedProbability(lineShop.bestOdds, true)
    hitProbability = trueProbability
  }
  
  // Step 4: Edge detection
  const edge = detectEdge(trueProbability, lineShop.bestOdds, 2)
  edge.reasoning.forEach((r: string) => reasoning.push(r))
  
  // Step 5: Market efficiency
  const efficiency = analyzeMarketEfficiency(
    relevantProps.map(p => ({
      book: p.sportsbook,
      odds: selection === 'over' ? (p.over_odds || -110) : (p.under_odds || -110),
      isSharp: isSharpBook(p.sportsbook)
    }))
  )
  
  reasoning.push(`🏪 Market efficiency: ${efficiency.efficiency}/100`)
  
  // Step 6: Kelly sizing
  const kelly = calculateKellyCriterion(trueProbability, lineShop.bestOdds, 0.25)
  reasoning.push(`💵 ${kelly.reasoning}`)
  
  // Step 7: Final recommendation
  let recommendation: 'strong_bet' | 'bet' | 'lean' | 'pass' = 'pass'
  let confidence = edge.confidence
  
  if (edge.recommendation === 'strong_bet') {
    recommendation = 'strong_bet'
  } else if (edge.recommendation === 'bet') {
    recommendation = 'bet'
  } else if (edge.edgePercent > 1 && edge.edgePercent < 2) {
    recommendation = 'lean'
    confidence = 45
  }
  
  return {
    recommendation,
    confidence: Math.round(confidence),
    hasEdge: edge.hasEdge,
    edgePercent: edge.edgePercent,
    evDollars: edge.evDollars,
    sharpVsSoft: {
      sharpConsensus: null,
      softConsensus: null,
      divergence: 0,
      edge: 'neutral'
    },
    bestBook: lineShop.bestBook,
    bestOdds: lineShop.bestOdds,
    potentialSavings: lineShop.potentialSavings,
    marketEfficiency: efficiency.efficiency,
    marketOpportunities: efficiency.opportunities,
    kellySizing: {
      recommended: kelly.recommendedBet,
      percentage: kelly.fractionalKelly
    },
    reasoning,
    warnings,
    hitProbability: Math.round(hitProbability),
    impliedProbability: Math.round(oddsToImpliedProbability(lineShop.bestOdds, true))
  }
}

/**
 * Helper: Default analysis when data is insufficient
 */
function getDefaultAnalysis(message: string): ComprehensiveBetAnalysis {
  return {
    recommendation: 'pass',
    confidence: 0,
    hasEdge: false,
    edgePercent: 0,
    evDollars: 0,
    sharpVsSoft: {
      sharpConsensus: null,
      softConsensus: null,
      divergence: 0,
      edge: 'neutral'
    },
    bestBook: '',
    bestOdds: -110,
    potentialSavings: 0,
    marketEfficiency: 50,
    marketOpportunities: [],
    kellySizing: {
      recommended: 0,
      percentage: 0
    },
    reasoning: [message],
    warnings: ['Insufficient data for analysis'],
    hitProbability: 50,
    impliedProbability: 50
  }
}