// ===== COMPLETE: lib/betAnalysis.ts =====

import { OddsData, PlayerProp } from './types'
import { analyzeGameBet as comprehensiveGameAnalysis, analyzePlayerProp as comprehensivePlayerAnalysis } from './analysis-engine'
import type { ComprehensiveBetAnalysis } from './analysis-engine'

/**
 * Legacy interface for backwards compatibility
 */
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

interface LegacyAnalysisResult {
  has_edge: boolean
  ev_percentage: number
  hit_probability: number
  recommendation_score: number
  reasoning: string
  best_book: string
  best_odds: number
}

/**
 * MAIN EXPORT: Analyze game bets (spread, moneyline, total)
 */
export async function analyzeGameBet(
  bet: BetSelection,
  allOdds: OddsData[]
): Promise<LegacyAnalysisResult> {
  
  // Determine bet type and selection
  let betType: 'spread' | 'moneyline' | 'total'
  let selection: 'home' | 'away' | 'over' | 'under'
  
  if (bet.type === 'spread') {
    betType = 'spread'
    selection = bet.selection.toLowerCase().includes('home') ? 'home' : 'away'
  } else if (bet.type === 'moneyline') {
    betType = 'moneyline'
    selection = bet.selection.toLowerCase().includes('home') ? 'home' : 'away'
  } else {
    betType = 'total'
    selection = bet.selection.toLowerCase().includes('over') ? 'over' : 'under'
  }
  
  // Run comprehensive analysis
  const analysis = await comprehensiveGameAnalysis(allOdds, betType, selection)
  
  // Convert to legacy format
  return convertToLegacyFormat(analysis)
}

/**
 * MAIN EXPORT: Analyze player props with ESPN stats (graceful fallback to odds-only)
 */
export async function analyzePlayerProp(
  bet: BetSelection,
  playerProps: PlayerProp[]
): Promise<LegacyAnalysisResult> {
  
  if (!bet.player || !bet.propType) {
    return {
      has_edge: false,
      ev_percentage: 0,
      hit_probability: 50,
      recommendation_score: 0,
      reasoning: 'Invalid player prop bet selection',
      best_book: bet.sportsbook,
      best_odds: bet.odds
    }
  }
  
  const selection = bet.selection.toLowerCase().includes('over') ? 'over' : 'under'
  
  // ESPN stats disabled for now - using odds-only analysis
  let historicalData: { seasonStats: number[]; last5Games: number[] } | undefined
  
  // ALWAYS run comprehensive analysis with odds data
  const analysis = await comprehensivePlayerAnalysis(
    playerProps,
    bet.player,
    bet.propType,
    selection,
    historicalData // undefined = odds-only analysis
  )
  
  // Convert to legacy format
  return convertToLegacyFormat(analysis)
}

/**
 * NEW EXPORT: Get full comprehensive analysis
 */
export async function getComprehensiveAnalysis(
  bet: BetSelection,
  allOdds?: OddsData[],
  playerProps?: PlayerProp[]
): Promise<ComprehensiveBetAnalysis> {
  
  if (bet.type === 'player_prop' && playerProps) {
    const selection = bet.selection.toLowerCase().includes('over') ? 'over' : 'under'
    return comprehensivePlayerAnalysis(
      playerProps,
      bet.player || '',
      bet.propType || '',
      selection
    )
  } else if (allOdds) {
    let betType: 'spread' | 'moneyline' | 'total'
    let selection: 'home' | 'away' | 'over' | 'under'
    
    if (bet.type === 'spread') {
      betType = 'spread'
      selection = bet.selection.toLowerCase().includes('home') ? 'home' : 'away'
    } else if (bet.type === 'moneyline') {
      betType = 'moneyline'
      selection = bet.selection.toLowerCase().includes('home') ? 'home' : 'away'
    } else {
      betType = 'total'
      selection = bet.selection.toLowerCase().includes('over') ? 'over' : 'under'
    }
    
    return comprehensiveGameAnalysis(allOdds, betType, selection)
  }
  
  // Fallback
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
    bestBook: bet.sportsbook,
    bestOdds: bet.odds,
    potentialSavings: 0,
    marketEfficiency: 50,
    marketOpportunities: [],
    kellySizing: {
      recommended: 0,
      percentage: 0
    },
    reasoning: ['Insufficient data for analysis'],
    warnings: [],
    hitProbability: 50,
    impliedProbability: 50
  }
}

/**
 * Helper: Convert comprehensive analysis to legacy format
 */
function convertToLegacyFormat(analysis: ComprehensiveBetAnalysis): LegacyAnalysisResult {
  // Convert recommendation to score (0-100)
  let score = 0
  if (analysis.recommendation === 'strong_bet') {
    score = 85
  } else if (analysis.recommendation === 'bet') {
    score = 70
  } else if (analysis.recommendation === 'lean') {
    score = 55
  } else {
    score = 30
  }
  
  // Combine reasoning into single string
  const reasoning = [
    ...analysis.reasoning,
    ...analysis.warnings
  ].join(' | ')
  
  return {
    has_edge: analysis.hasEdge,
    ev_percentage: analysis.edgePercent,
    hit_probability: analysis.hitProbability,
    recommendation_score: score,
    reasoning,
    best_book: analysis.bestBook,
    best_odds: analysis.bestOdds
  }
}

/**
 * Helper: Calculate American odds to decimal
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1
  } else {
    return (100 / Math.abs(americanOdds)) + 1
  }
}

/**
 * Helper: Calculate implied probability from American odds
 */
export function getImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return (100 / (americanOdds + 100)) * 100
  } else {
    return (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100
  }
}