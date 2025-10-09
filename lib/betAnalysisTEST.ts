// ===== FIXED: lib/betAnalysisTEST.ts =====

import { OddsData, PlayerProp } from './types'
import { analyzeGameBet as comprehensiveGameAnalysis, analyzePlayerProp as comprehensivePlayerAnalysis } from './analysis-engine'
import type { ComprehensiveBetAnalysis } from './analysis-engine'
import { 
  fetchNBAPlayerStats, 
  fetchNFLPlayerStats, 
  fetchMLBPlayerStats, 
  fetchPlayerGameLog,
  mapPropTypeToStatName,
  extractStatValues
} from './espn-apiTEST'

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
  
  // NFL/CFB props
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
  
  // MLB props - FIXED
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
 * MAIN EXPORT: Analyze player props WITH ESPN stats
 * PRODUCTION-READY with proper error handling
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
  
  // ===== STEP 1: Determine Sport from Prop Type =====
  const sport = getSportFromPropType(bet.propType)
  
  if (!sport) {
    console.warn(`⚠️ Could not determine sport from prop type: ${bet.propType}`)
    console.log(`📊 Falling back to odds-only analysis`)
    
    const analysis = await comprehensivePlayerAnalysis(
      playerProps,
      bet.player,
      bet.propType,
      selection,
      undefined
    )
    
    const result = convertToLegacyFormat(analysis)
    result.reasoning = `[Data: Market odds only - Unknown sport] ${result.reasoning}`
    return result
  }
  
  console.log(`🏈 Detected sport: ${sport.toUpperCase()}`)
  
  // ===== STEP 2: Try ESPN Stats (FREE) =====
  let historicalData: { seasonStats: number[]; last5Games: number[] } | undefined
  
  try {
    console.log(`📊 Fetching ESPN stats for ${bet.player}...`)
    
    let playerStats = null
    let season = 2025
    
    // Fetch stats for the correct sport
    if (sport === 'basketball') {
      playerStats = await fetchNBAPlayerStats(bet.player, 2025)
    } else if (sport === 'football') {
      playerStats = await fetchNFLPlayerStats(bet.player, 2024)
      season = 2024
    } else if (sport === 'baseball') {
      playerStats = await fetchMLBPlayerStats(bet.player, 2024)
      season = 2024
    }
    
    if (playerStats && playerStats.playerId) {
      console.log(`✅ Found ${sport.toUpperCase()} stats for ${playerStats.playerName}`)
      
      const statName = mapPropTypeToStatName(bet.propType)
      
      // Try to get game logs, but don't fail if unavailable
      let gameLogs: any[] = []
      try {
        gameLogs = await fetchPlayerGameLog(playerStats.playerId, sport, season, 10)
      } catch (error) {
        console.log(`Game logs unavailable, using season stats only`)
      }
      
      if (gameLogs.length > 0) {
        const allValues = extractStatValues(gameLogs, statName)
        const last5Values = allValues.slice(0, 5)
        
        if (allValues.length > 0) {
          historicalData = {
            seasonStats: allValues,
            last5Games: last5Values
          }
          console.log(`📈 Using ${allValues.length} games of ESPN data`)
        } else {
          console.warn(`⚠️ ESPN stats found but no values for ${statName}`)
        }
      } else {
        // Use season average as fallback
        const seasonValue = playerStats.stats[statName]
        if (seasonValue && !isNaN(seasonValue)) {
          historicalData = {
            seasonStats: [seasonValue],
            last5Games: [seasonValue]
          }
          console.log(`📊 Using season average: ${seasonValue} ${statName}`)
        } else {
          console.warn(`⚠️ No game logs available for ${playerStats.playerName}`)
        }
      }
    } else {
      console.log(`⚠️ No ESPN stats found for ${bet.player} in ${sport}`)
    }
  } catch (error) {
    console.error('ESPN stats fetch failed:', error)
  }
  
  // ===== STEP 3: Run Analysis =====
  console.log(`🔬 Running comprehensive analysis...`)
  
  const analysis = await comprehensivePlayerAnalysis(
    playerProps,
    bet.player,
    bet.propType,
    selection,
    historicalData
  )
  
  // Add data source info to reasoning
  let dataSource = 'Market odds only'
  if (historicalData) {
    if (historicalData.seasonStats.length >= 5) {
      dataSource = `ESPN ${sport} stats (${historicalData.seasonStats.length} games)`
    } else if (historicalData.seasonStats.length > 0) {
      dataSource = `ESPN ${sport} stats (${historicalData.seasonStats.length} games - limited data)`
    }
  }
  
  console.log(`✅ Analysis complete using: ${dataSource}\n`)
  
  const result = convertToLegacyFormat(analysis)
  result.reasoning = `[Data: ${dataSource}] ${result.reasoning}`
  
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
    
    // Determine sport and fetch stats
    const sport = getSportFromPropType(bet.propType || '')
    let historicalData: { seasonStats: number[]; last5Games: number[] } | undefined
    
    if (sport) {
      try {
        let playerStats = null
        let season = 2025
        
        if (sport === 'basketball') {
          playerStats = await fetchNBAPlayerStats(bet.player || '', 2025)
        } else if (sport === 'football') {
          playerStats = await fetchNFLPlayerStats(bet.player || '', 2024)
          season = 2024
        } else if (sport === 'baseball') {
          playerStats = await fetchMLBPlayerStats(bet.player || '', 2024)
          season = 2024
        }
        
        if (playerStats && playerStats.playerId) {
          const statName = mapPropTypeToStatName(bet.propType || '')
          const gameLogs = await fetchPlayerGameLog(playerStats.playerId, sport, season, 10)
          
          if (gameLogs.length > 0) {
            const allValues = extractStatValues(gameLogs, statName)
            const last5Values = allValues.slice(0, 5)
            
            if (allValues.length > 0) {
              historicalData = {
                seasonStats: allValues,
                last5Games: last5Values
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching stats for comprehensive analysis:', error)
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