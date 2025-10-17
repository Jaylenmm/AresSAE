// ===== FIXED: lib/betAnalysis.ts =====

import { OddsData, PlayerProp } from './types'
import { analyzeGameBet as comprehensiveGameAnalysis, analyzePlayerProp as comprehensivePlayerAnalysis } from './analysis-engineOLD'
import type { ComprehensiveBetAnalysis } from './analysis-engineOLD'
import { 
  fetchNBAPlayerStats, 
  fetchNFLPlayerStats, 
  fetchMLBPlayerStats,
  mapPropTypeToStatName
} from './espn-api'

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
 * Determine sport from prop type
 */
function getSportFromPropType(propType: string): 'basketball' | 'football' | 'baseball' | null {
  const lowerProp = propType.toLowerCase().replace(/\s+/g, '_')
  
  // NFL/NCAAF props
  if (lowerProp.includes('pass') || lowerProp.includes('rush') || 
      lowerProp.includes('reception') || lowerProp.includes('tackle') ||
      lowerProp.includes('sack') || lowerProp.includes('interception') ||
      lowerProp.includes('yds') || lowerProp.includes('yards') ||
      lowerProp.includes('td') || lowerProp.includes('touchdown')) {
    return 'football'
  }
  
  // NBA props
  if (lowerProp.includes('point') || lowerProp.includes('rebound') || 
      lowerProp.includes('assist') || lowerProp.includes('three') ||
      lowerProp.includes('block') || lowerProp.includes('steal')) {
    return 'basketball'
  }
  
  // MLB props
  if (lowerProp.includes('batter') || lowerProp.includes('pitcher') ||
      lowerProp.includes('home_run') || lowerProp.includes('homerun') ||
      lowerProp.includes('strikeout') || lowerProp.includes('hit') || 
      lowerProp.includes('rbi') || lowerProp.includes('run') ||
      lowerProp.includes('bases') || lowerProp.includes('earned') ||
      lowerProp.includes('walk')) {
    return 'baseball'
  }
  
  return null
}

/**
 * MAIN EXPORT: Analyze game bets (spread, moneyline, total)
 */
export async function analyzeGameBet(
  bet: BetSelection,
  allOdds: OddsData[]
): Promise<LegacyAnalysisResult> {
  
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
  
  const analysis = await comprehensiveGameAnalysis(allOdds, betType, selection)
  return convertToLegacyFormat(analysis)
}

/**
 * MAIN EXPORT: Analyze player props WITH ESPN season stats
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
  
  console.log(`\n🎯 Analyzing ${bet.player} ${bet.propType} ${selection}`)
  
  // ===== STEP 1: Determine Sport =====
  const sport = getSportFromPropType(bet.propType)
  
  if (!sport) {
    console.warn(`⚠️ Unknown sport for: ${bet.propType}`)
    const analysis = await comprehensivePlayerAnalysis(
      playerProps,
      bet.player,
      bet.propType,
      selection,
      undefined
    )
    const result = convertToLegacyFormat(analysis)
    result.reasoning = `[Data: Market odds only] ${result.reasoning}`
    return result
  }
  
  console.log(`🏈 Sport: ${sport.toUpperCase()}`)
  
  // ===== STEP 2: Get Season Stats =====
  let historicalData: { seasonStats: number[]; last5Games: number[] } | undefined
  let playerAverage: number | undefined
  
  try {
    console.log(`📊 Fetching season stats...`)
    
    let playerStats = null
    
    if (sport === 'basketball') {
      playerStats = await fetchNBAPlayerStats(bet.player, 2025)
    } else if (sport === 'football') {
      playerStats = await fetchNFLPlayerStats(bet.player, 2024)
    } else if (sport === 'baseball') {
      playerStats = await fetchMLBPlayerStats(bet.player, 2024)
    }
    
    if (playerStats?.playerId) {
      console.log(`✅ Found stats for ${playerStats.playerName}`)
      
      const statName = mapPropTypeToStatName(bet.propType)
      playerAverage = playerStats.stats[statName]
      
      if (playerAverage && !isNaN(playerAverage)) {
        historicalData = {
          seasonStats: [playerAverage],
          last5Games: [playerAverage]
        }
        console.log(`📈 Season avg: ${playerAverage.toFixed(1)} ${statName}`)
      } else {
        console.log(`⚠️ No ${statName} found. Available:`, Object.keys(playerStats.stats).slice(0, 5).join(', '))
      }
    } else {
      console.log(`⚠️ Player not found`)
    }
  } catch (error) {
    console.error('Stats error:', error)
  }
  
  // ===== STEP 3: Run Analysis =====
  console.log(`🔬 Analyzing...`)
  
  const analysis = await comprehensivePlayerAnalysis(
    playerProps,
    bet.player,
    bet.propType,
    selection,
    historicalData
  )
  
  // Add data source
  let dataSource = 'Market odds only'
  if (historicalData && playerAverage) {
    dataSource = `ESPN ${sport} avg: ${playerAverage.toFixed(1)}`
  }
  
  console.log(`✅ Complete: ${dataSource}\n`)
  
  const result = convertToLegacyFormat(analysis)
  result.reasoning = `[${dataSource}] ${result.reasoning}`
  
  return result
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
    const sport = getSportFromPropType(bet.propType || '')
    let historicalData: { seasonStats: number[]; last5Games: number[] } | undefined
    
    if (sport) {
      try {
        let playerStats = null
        
        if (sport === 'basketball') {
          playerStats = await fetchNBAPlayerStats(bet.player || '', 2025)
        } else if (sport === 'football') {
          playerStats = await fetchNFLPlayerStats(bet.player || '', 2024)
        } else if (sport === 'baseball') {
          playerStats = await fetchMLBPlayerStats(bet.player || '', 2024)
        }
        
        if (playerStats?.playerId) {
          const statName = mapPropTypeToStatName(bet.propType || '')
          const avg = playerStats.stats[statName]
          
          if (avg && !isNaN(avg)) {
            historicalData = {
              seasonStats: [avg],
              last5Games: [avg]
            }
          }
        }
      } catch (error) {
        console.error('Stats error:', error)
      }
    }
    
    return comprehensivePlayerAnalysis(
      playerProps,
      bet.player || '',
      bet.propType || '',
      selection,
      historicalData
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
    reasoning: ['Insufficient data'],
    warnings: [],
    hitProbability: 50,
    impliedProbability: 50
  }
}

/**
 * Helper: Convert to legacy format
 */
function convertToLegacyFormat(analysis: ComprehensiveBetAnalysis): LegacyAnalysisResult {
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
  
  const reasoning = [
    ...analysis.reasoning.map(r => r.replace(/[^\w\s\-+%.,:;()?!]/g, '')),
    ...analysis.warnings.map(w => w.replace(/[^\w\s\-+%.,:;()?!]/g, ''))
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

export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1
  } else {
    return (100 / Math.abs(americanOdds)) + 1
  }
}

export function getImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return (100 / (americanOdds + 100)) * 100
  } else {
    return (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100
  }
}