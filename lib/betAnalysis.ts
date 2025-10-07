// ===== COMPLETE: lib/betAnalysis.ts =====

import { OddsData, PlayerProp } from './types'
import { analyzeGameBet as comprehensiveGameAnalysis, analyzePlayerProp as comprehensivePlayerAnalysis } from './analysis-engine'
import type { ComprehensiveBetAnalysis } from './analysis-engine'
import { fetchNBAPlayerStats, fetchNFLPlayerStats, fetchMLBPlayerStats, fetchPlayerGameLog, mapPropTypeToStatName, extractStatValues } from './espn-api'

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
 * MAIN EXPORT: Analyze player props with ESPN stats
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
  
  // Try to fetch ESPN stats for enhanced analysis
  let historicalData: { seasonStats: number[]; last5Games: number[] } | undefined
  
  try {
    console.log(`Fetching ESPN stats for ${bet.player}...`)
    
    // Try NBA first, then NFL, then MLB (postseason priority!)
    let playerStats = await fetchNBAPlayerStats(bet.player)
    let sport: 'basketball' | 'football' | 'baseball' = 'basketball'
    let season = 2025
    
    if (!playerStats) {
      playerStats = await fetchNFLPlayerStats(bet.player)
      sport = 'football'
      season = 2024
    }
    
    if (!playerStats) {
      playerStats = await fetchMLBPlayerStats(bet.player)
      sport = 'baseball'
      season = 2024
    }
    
    if (playerStats && playerStats.playerId) {
      console.log(`✅ Found ${sport.toUpperCase()} stats for ${playerStats.playerName}`)
      
      // Get the stat name that matches the prop type
      const statName = mapPropTypeToStatName(bet.propType)
      
      // Get recent game log
      const gameLogs = await fetchPlayerGameLog(
        playerStats.playerId,
        sport,
        season,
        10 // Last 10 games for season stats
      )
      
      if (gameLogs.length > 0) {
        const allValues = extractStatValues(gameLogs, statName)
        const last5Values = allValues.slice(0, 5)
        
        if (allValues.length > 0) {
          historicalData = {
            seasonStats: allValues,
            last5Games: last5Values
          }
          console.log(`📊 Using ${allValues.length} games of historical data for ${sport}`)
        }
      }
    } else {
      console.log(`⚠️ No ESPN stats found for ${bet.player}, using odds-only analysis`)
    }
  } catch (error) {
    console.error('Error fetching ESPN stats:', error)
    // Continue with analysis even if stats fetch fails
  }
  
  // Run comprehensive analysis with historical data if available
  const analysis = await comprehensivePlayerAnalysis(
    playerProps,
    bet.player,
    bet.propType,
    selection,
    historicalData
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