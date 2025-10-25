import { supabase } from './supabase'
import { analyzeBet, BetOption, AnalysisResult } from './analysis-engine'
import { Game, OddsData, PlayerProp } from './types'
import { transformGameToAnalysisFormat, transformPlayerPropsToAnalysisFormat } from './supabase-adapter'

interface FeaturedPickData {
  sport: string
  game_id: string
  game_info: string
  pick_type: string
  selection: string
  line: number | null
  odds: number
  sportsbook: string
  confidence: number
  hit_probability: number
  ev_percentage: number
  has_edge: boolean
  reasoning: string
  bet_details: any
  expires_at: string
}

/**
 * Main function to generate all featured picks across all sports
 * Should be called by daily cron job
 */
export async function generateFeaturedPicks(): Promise<{ success: boolean; picksGenerated: number; error?: string }> {
  console.log('🎯 Starting featured picks generation...')
  
  try {
    // Delete old/expired picks
    await supabase
      .from('featured_picks')
      .delete()
      .lt('expires_at', new Date().toISOString())
    
    // Fetch all upcoming games across all sports
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .gte('game_date', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // Show games up to 4 hours after start
      .order('game_date', { ascending: true })
    
    if (gamesError) throw gamesError
    if (!games || games.length === 0) {
      console.log('⚠️ No upcoming games found')
      return { success: true, picksGenerated: 0 }
    }
    
    console.log(`📊 Found ${games.length} upcoming games`)
    
    const gameIds = games.map(g => g.id)
    
    // Fetch all odds (v2-first)
    let { data: allOdds, error: oddsError } = await supabase
      .from('odds_data_v2')
      .select('*')
      .in('game_id', gameIds)
    if (oddsError) throw oddsError

    if (!allOdds || allOdds.length === 0) {
      // Aggregate odds_data_v2 into legacy shape per book
      const { data: v2 } = await supabase
        .from('odds_data_v2')
        .select('*')
        .in('game_id', gameIds)
      const byGameBook = new Map<string, any>()
      for (const row of (v2 || [])) {
        if (!row || !['spread','total','moneyline'].includes(row.market)) continue
        const key = `${row.game_id}::${row.book_name || row.book_key}`
        if (!byGameBook.has(key)) {
          byGameBook.set(key, { game_id: row.game_id, sportsbook: (row.book_name || row.book_key) })
        }
        const agg = byGameBook.get(key)
        if (row.market === 'spread') {
          agg.spread_home = row.spread_home
          agg.spread_away = row.spread_away
          agg.spread_home_odds = row.spread_home_odds
          agg.spread_away_odds = row.spread_away_odds
        } else if (row.market === 'total') {
          agg.total = row.line
          agg.over_odds = row.over_odds
          agg.under_odds = row.under_odds
        } else if (row.market === 'moneyline') {
          agg.moneyline_home = row.moneyline_home
          agg.moneyline_away = row.moneyline_away
        }
      }
      allOdds = Array.from(byGameBook.values()) as any
    }
    
    // Fetch all player props (v2-first)
    let { data: allProps, error: propsError } = await supabase
      .from('player_props_v2')
      .select('*')
      .in('game_id', gameIds)
    if (propsError) throw propsError
    
    console.log(`📈 Analyzing ${allOdds?.length || 0} odds entries and ${allProps?.length || 0} props`)
    
    const qualifyingPicks: FeaturedPickData[] = []
    
    // Analyze game bets (spreads, totals, moneylines)
    if (allOdds && allOdds.length > 0) {
      for (const game of games) {
        const gameOdds = allOdds.filter(o => o.game_id === game.id)
        if (gameOdds.length === 0) continue
        
        // Transform game data once for this game
        const gameData = transformGameToAnalysisFormat(game, gameOdds)
        
        // Analyze spreads
        await analyzeSpreadBets(game, gameOdds, gameData.bookmakers, qualifyingPicks)
        
        // Analyze totals
        await analyzeTotalBets(game, gameOdds, gameData.bookmakers, qualifyingPicks)
        
        // Analyze moneylines
        await analyzeMoneylineBets(game, gameOdds, gameData.bookmakers, qualifyingPicks)
      }
    }
    
    // Analyze player props
    if (allProps && allProps.length > 0) {
      await analyzePlayerProps(games, allProps, qualifyingPicks)
    }
    
    console.log(`✅ Found ${qualifyingPicks.length} qualifying picks`)
    
    // Save to database
    if (qualifyingPicks.length > 0) {
      const { error: insertError } = await supabase
        .from('featured_picks')
        .insert(qualifyingPicks)
      
      if (insertError) throw insertError
      
      console.log(`💾 Saved ${qualifyingPicks.length} picks to database`)
    }
    
    return { success: true, picksGenerated: qualifyingPicks.length }
    
  } catch (error) {
    console.error('❌ Error generating featured picks:', error)
    return { 
      success: false, 
      picksGenerated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Helper to convert analysis result to featured pick format
 */
function convertAnalysisToFeaturedPick(
  analysis: AnalysisResult,
  game: Game,
  pickType: string,
  selection: string,
  line: number | null,
  betDetails: any
): FeaturedPickData {
  return {
    sport: game.sport,
    game_id: game.id,
    game_info: `${game.away_team} @ ${game.home_team}`,
    pick_type: pickType,
    selection,
    line,
    odds: analysis.bestOdds,
    sportsbook: analysis.bestSportsbook,
    confidence: analysis.confidence,
    hit_probability: analysis.confidence / 100, // Convert confidence to 0-1 probability
    ev_percentage: analysis.expectedValue ?? 0,
    has_edge: (analysis.edge ?? 0) > 0,
    reasoning: formatReasoning(analysis),
    bet_details: betDetails,
    expires_at: game.game_date
  }
}

/**
 * Format analysis reasoning for display
 */
function formatReasoning(analysis: AnalysisResult): string {
  const parts: string[] = []
  
  if (analysis.reasons.length > 0) {
    parts.push(...analysis.reasons)
  }
  
  if (analysis.warnings.length > 0) {
    parts.push(...analysis.warnings)
  }
  
  parts.push(`Market: ${analysis.marketEfficiency}`)
  parts.push(`Sharp Consensus: ${analysis.sharpConsensus}`)
  
  return parts.join(' | ')
}

/**
 * Analyze spread bets for a game
 */
async function analyzeSpreadBets(
  game: Game, 
  gameOdds: OddsData[],
  bookmakers: any[],
  qualifyingPicks: FeaturedPickData[]
) {
  // Home spread
  if (gameOdds.some(o => o.spread_home && o.spread_home_odds)) {
    const bestHomeSpread = gameOdds.reduce((best, curr) => {
      if (!curr.spread_home_odds) return best
      if (!best.spread_home_odds) return curr
      return Math.abs(curr.spread_home_odds) < Math.abs(best.spread_home_odds) ? curr : best
    })
    
    try {
      const betOption: BetOption = {
        id: `spread-home-${game.id}`,
        betType: 'spreads',
        market: 'spreads',
        selection: game.home_team,
        line: bestHomeSpread.spread_home!,
        odds: bestHomeSpread.spread_home_odds!,
        sportsbook: bestHomeSpread.sportsbook,
        eventId: game.id,
        sport: game.sport
      }
      
      const analysis = analyzeBet(betOption, bookmakers)
      
      if (meetsQualificationCriteria(analysis)) {
        const pick = convertAnalysisToFeaturedPick(
          analysis,
          game,
          'spread',
          `${game.home_team} ${bestHomeSpread.spread_home! > 0 ? '+' : ''}${bestHomeSpread.spread_home}`,
          bestHomeSpread.spread_home ?? null,
          {
            game,
            type: 'spread',
            team: game.home_team,
            line: bestHomeSpread.spread_home
          }
        )
        qualifyingPicks.push(pick)
      }
    } catch (error) {
      console.error('Error analyzing home spread:', error)
    }
  }
  
  // Away spread
  if (gameOdds.some(o => o.spread_away && o.spread_away_odds)) {
    const bestAwaySpread = gameOdds.reduce((best, curr) => {
      if (!curr.spread_away_odds) return best
      if (!best.spread_away_odds) return curr
      return Math.abs(curr.spread_away_odds) < Math.abs(best.spread_away_odds) ? curr : best
    })
    
    try {
      const betOption: BetOption = {
        id: `spread-away-${game.id}`,
        betType: 'spreads',
        market: 'spreads',
        selection: game.away_team,
        line: bestAwaySpread.spread_away!,
        odds: bestAwaySpread.spread_away_odds!,
        sportsbook: bestAwaySpread.sportsbook,
        eventId: game.id,
        sport: game.sport
      }
      
      const analysis = analyzeBet(betOption, bookmakers)
      
      if (meetsQualificationCriteria(analysis)) {
        const pick = convertAnalysisToFeaturedPick(
          analysis,
          game,
          'spread',
          `${game.away_team} ${bestAwaySpread.spread_away! > 0 ? '+' : ''}${bestAwaySpread.spread_away}`,
          bestAwaySpread.spread_away ?? null,
          {
            game,
            type: 'spread',
            team: game.away_team,
            line: bestAwaySpread.spread_away
          }
        )
        qualifyingPicks.push(pick)
      }
    } catch (error) {
      console.error('Error analyzing away spread:', error)
    }
  }
}

/**
 * Analyze total bets for a game
 */
async function analyzeTotalBets(
  game: Game,
  gameOdds: OddsData[],
  bookmakers: any[],
  qualifyingPicks: FeaturedPickData[]
) {
  // Over
  if (gameOdds.some(o => o.total && o.over_odds)) {
    const bestOver = gameOdds.reduce((best, curr) => {
      if (!curr.over_odds) return best
      if (!best.over_odds) return curr
      return Math.abs(curr.over_odds) < Math.abs(best.over_odds) ? curr : best
    })
    
    try {
      const betOption: BetOption = {
        id: `total-over-${game.id}`,
        betType: 'totals',
        market: 'totals',
        selection: 'Over',
        line: bestOver.total!,
        odds: bestOver.over_odds!,
        sportsbook: bestOver.sportsbook,
        eventId: game.id,
        sport: game.sport
      }
      
      const analysis = analyzeBet(betOption, bookmakers)
      
      if (meetsQualificationCriteria(analysis)) {
        const pick = convertAnalysisToFeaturedPick(
          analysis,
          game,
          'total',
          `Over ${bestOver.total}`,
          bestOver.total ?? null,
          {
            game,
            type: 'total',
            selection: 'over',
            line: bestOver.total
          }
        )
        qualifyingPicks.push(pick)
      }
    } catch (error) {
      console.error('Error analyzing over:', error)
    }
  }
  
  // Under
  if (gameOdds.some(o => o.total && o.under_odds)) {
    const bestUnder = gameOdds.reduce((best, curr) => {
      if (!curr.under_odds) return best
      if (!best.under_odds) return curr
      return Math.abs(curr.under_odds) < Math.abs(best.under_odds) ? curr : best
    })
    
    try {
      const betOption: BetOption = {
        id: `total-under-${game.id}`,
        betType: 'totals',
        market: 'totals',
        selection: 'Under',
        line: bestUnder.total!,
        odds: bestUnder.under_odds!,
        sportsbook: bestUnder.sportsbook,
        eventId: game.id,
        sport: game.sport
      }
      
      const analysis = analyzeBet(betOption, bookmakers)
      
      if (meetsQualificationCriteria(analysis)) {
        const pick = convertAnalysisToFeaturedPick(
          analysis,
          game,
          'total',
          `Under ${bestUnder.total}`,
          bestUnder.total ?? null,
          {
            game,
            type: 'total',
            selection: 'under',
            line: bestUnder.total
          }
        )
        qualifyingPicks.push(pick)
      }
    } catch (error) {
      console.error('Error analyzing under:', error)
    }
  }
}

/**
 * Analyze moneyline bets for a game
 */
async function analyzeMoneylineBets(
  game: Game,
  gameOdds: OddsData[],
  bookmakers: any[],
  qualifyingPicks: FeaturedPickData[]
) {
  // Home ML
  if (gameOdds.some(o => o.moneyline_home)) {
    const bestHomeML = gameOdds.reduce((best, curr) => {
      if (!curr.moneyline_home) return best
      if (!best.moneyline_home) return curr
      return curr.moneyline_home > best.moneyline_home ? curr : best
    })
    
    try {
      const betOption: BetOption = {
        id: `ml-home-${game.id}`,
        betType: 'h2h',
        market: 'h2h',
        selection: game.home_team,
        odds: bestHomeML.moneyline_home!,
        sportsbook: bestHomeML.sportsbook,
        eventId: game.id,
        sport: game.sport
      }
      
      const analysis = analyzeBet(betOption, bookmakers)
      
      if (meetsQualificationCriteria(analysis)) {
        const pick = convertAnalysisToFeaturedPick(
          analysis,
          game,
          'moneyline',
          `${game.home_team} ML`,
          null,
          {
            game,
            type: 'moneyline',
            team: game.home_team
          }
        )
        qualifyingPicks.push(pick)
      }
    } catch (error) {
      console.error('Error analyzing home ML:', error)
    }
  }
  
  // Away ML
  if (gameOdds.some(o => o.moneyline_away)) {
    const bestAwayML = gameOdds.reduce((best, curr) => {
      if (!curr.moneyline_away) return best
      if (!best.moneyline_away) return curr
      return curr.moneyline_away > best.moneyline_away ? curr : best
    })
    
    try {
      const betOption: BetOption = {
        id: `ml-away-${game.id}`,
        betType: 'h2h',
        market: 'h2h',
        selection: game.away_team,
        odds: bestAwayML.moneyline_away!,
        sportsbook: bestAwayML.sportsbook,
        eventId: game.id,
        sport: game.sport
      }
      
      const analysis = analyzeBet(betOption, bookmakers)
      
      if (meetsQualificationCriteria(analysis)) {
        const pick = convertAnalysisToFeaturedPick(
          analysis,
          game,
          'moneyline',
          `${game.away_team} ML`,
          null,
          {
            game,
            type: 'moneyline',
            team: game.away_team
          }
        )
        qualifyingPicks.push(pick)
      }
    } catch (error) {
      console.error('Error analyzing away ML:', error)
    }
  }
}

/**
 * Analyze player props
 */
async function analyzePlayerProps(
  games: Game[],
  allProps: PlayerProp[],
  qualifyingPicks: FeaturedPickData[]
) {
  // Group props by game
  const propsByGame = new Map<string, PlayerProp[]>()
  for (const prop of allProps) {
    if (!propsByGame.has(prop.game_id)) {
      propsByGame.set(prop.game_id, [])
    }
    propsByGame.get(prop.game_id)!.push(prop)
  }
  
  // Analyze each game's props
  for (const [gameId, props] of propsByGame) {
    const game = games.find(g => g.id === gameId)
    if (!game) continue
    
    // Transform props data once for this game
    const propsBookmakers = transformPlayerPropsToAnalysisFormat(game, props)
    
    // Group by player to avoid duplicates
    const analyzedPlayers = new Set<string>()
    
    for (const prop of props) {
      const playerKey = `${prop.player_name}-${prop.prop_type}`
      
      // Skip if already analyzed this player/prop combo
      if (analyzedPlayers.has(playerKey)) continue
      analyzedPlayers.add(playerKey)
      
      // Analyze over
      if (prop.over_odds) {
        try {
          const betOption: BetOption = {
            id: `prop-over-${prop.id}`,
            betType: 'player_prop',
            market: prop.prop_type,
            selection: 'Over',
            line: prop.line,
            odds: prop.over_odds,
            sportsbook: prop.sportsbook,
            playerName: prop.player_name,
            eventId: game.id,
            sport: game.sport
          }
          
          const analysis = analyzeBet(betOption, propsBookmakers)
          
          if (meetsQualificationCriteria(analysis)) {
            const pick = convertAnalysisToFeaturedPick(
              analysis,
              game,
              'player_prop',
              `${prop.player_name} Over ${prop.line} ${prop.prop_type}`,
              prop.line,
              {
                game,
                prop,
                type: 'player_prop',
                player: prop.player_name,
                propType: prop.prop_type,
                selection: 'over'
              }
            )
            pick.game_info = `${prop.player_name} - ${game.away_team} @ ${game.home_team}`
            qualifyingPicks.push(pick)
          }
        } catch (error) {
          console.error(`Error analyzing ${prop.player_name} over:`, error)
        }
      }
      
      // Analyze under
      if (prop.under_odds) {
        try {
          const betOption: BetOption = {
            id: `prop-under-${prop.id}`,
            betType: 'player_prop',
            market: prop.prop_type,
            selection: 'Under',
            line: prop.line,
            odds: prop.under_odds,
            sportsbook: prop.sportsbook,
            playerName: prop.player_name,
            eventId: game.id,
            sport: game.sport
          }
          
          const analysis = analyzeBet(betOption, propsBookmakers)
          
          if (meetsQualificationCriteria(analysis)) {
            const pick = convertAnalysisToFeaturedPick(
              analysis,
              game,
              'player_prop',
              `${prop.player_name} Under ${prop.line} ${prop.prop_type}`,
              prop.line,
              {
                game,
                prop,
                type: 'player_prop',
                player: prop.player_name,
                propType: prop.prop_type,
                selection: 'under'
              }
            )
            pick.game_info = `${prop.player_name} - ${game.away_team} @ ${game.home_team}`
            qualifyingPicks.push(pick)
          }
        } catch (error) {
          console.error(`Error analyzing ${prop.player_name} under:`, error)
        }
      }
    }
  }
}

/**
 * Check if bet meets qualification criteria
 * Priority: confidence >= 40 (REQUIRED)
 */
function meetsQualificationCriteria(analysis: AnalysisResult): boolean {
  // Only requirement: confidence >= 40
  if (analysis.confidence < 40) {
    return false
  }
  
  // Passed minimum requirement
  return true
}

/**
 * Calculate priority score for sorting picks
 * Higher score = better pick
 */
function calculatePriorityScore(analysis: AnalysisResult): number {
  let score = analysis.confidence // Base score from confidence
  
  // Bonus points for positive EV (up to +20)
  if (analysis.expectedValue && analysis.expectedValue > 0) {
    score += Math.min(analysis.expectedValue * 2, 20)
  }
  
  // Bonus points for having edge (+10)
  if (analysis.edge && analysis.edge > 0) {
    score += 10
  }
  
  return score
}