import { supabase } from './supabase'
import { analyzeGameBet, analyzePlayerProp } from './betAnalysisTEST'
import { Game, OddsData, PlayerProp } from './types'

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
      .gte('game_date', new Date().toISOString())
      .order('game_date', { ascending: true })
    
    if (gamesError) throw gamesError
    if (!games || games.length === 0) {
      console.log('⚠️ No upcoming games found')
      return { success: true, picksGenerated: 0 }
    }
    
    console.log(`📊 Found ${games.length} upcoming games`)
    
    const gameIds = games.map(g => g.id)
    
    // Fetch all odds
    const { data: allOdds, error: oddsError } = await supabase
      .from('odds_data')
      .select('*')
      .in('game_id', gameIds)
    
    if (oddsError) throw oddsError
    
    // Fetch all player props
    const { data: allProps, error: propsError } = await supabase
      .from('player_props')
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
        
        // Analyze spreads
        await analyzeSpreadBets(game, gameOdds, qualifyingPicks)
        
        // Analyze totals
        await analyzeTotalBets(game, gameOdds, qualifyingPicks)
        
        // Analyze moneylines
        await analyzeMoneylineBets(game, gameOdds, qualifyingPicks)
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
 * Analyze spread bets for a game
 */
async function analyzeSpreadBets(
  game: Game, 
  gameOdds: OddsData[], 
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
      const analysis = await analyzeGameBet({
        type: 'spread',
        selection: 'home',
        team: game.home_team,
        line: bestHomeSpread.spread_home,
        odds: bestHomeSpread.spread_home_odds!,
        sportsbook: bestHomeSpread.sportsbook,
        game_id: game.id
      }, gameOdds)
      
      if (meetsQualificationCriteria(analysis)) {
        qualifyingPicks.push({
          sport: game.sport,
          game_id: game.id,
          game_info: `${game.away_team} @ ${game.home_team}`,
          pick_type: 'spread',
          selection: `${game.home_team} ${bestHomeSpread.spread_home! > 0 ? '+' : ''}${bestHomeSpread.spread_home}`,
          line: bestHomeSpread.spread_home ?? null,
          odds: analysis.best_odds,
          sportsbook: analysis.best_book,
          confidence: analysis.recommendation_score,
          hit_probability: analysis.hit_probability,
          ev_percentage: analysis.ev_percentage,
          has_edge: analysis.has_edge,
          reasoning: analysis.reasoning,
          bet_details: {
            game,
            type: 'spread',
            team: game.home_team,
            line: bestHomeSpread.spread_home
          },
          expires_at: game.game_date
        })
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
      const analysis = await analyzeGameBet({
        type: 'spread',
        selection: 'away',
        team: game.away_team,
        line: bestAwaySpread.spread_away,
        odds: bestAwaySpread.spread_away_odds!,
        sportsbook: bestAwaySpread.sportsbook,
        game_id: game.id
      }, gameOdds)
      
      if (meetsQualificationCriteria(analysis)) {
        qualifyingPicks.push({
          sport: game.sport,
          game_id: game.id,
          game_info: `${game.away_team} @ ${game.home_team}`,
          pick_type: 'spread',
          selection: `${game.away_team} ${bestAwaySpread.spread_away! > 0 ? '+' : ''}${bestAwaySpread.spread_away}`,
          line: bestAwaySpread.spread_away ?? null,
          odds: analysis.best_odds,
          sportsbook: analysis.best_book,
          confidence: analysis.recommendation_score,
          hit_probability: analysis.hit_probability,
          ev_percentage: analysis.ev_percentage,
          has_edge: analysis.has_edge,
          reasoning: analysis.reasoning,
          bet_details: {
            game,
            type: 'spread',
            team: game.away_team,
            line: bestAwaySpread.spread_away
          },
          expires_at: game.game_date
        })
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
      const analysis = await analyzeGameBet({
        type: 'total',
        selection: 'over',
        line: bestOver.total,
        odds: bestOver.over_odds!,
        sportsbook: bestOver.sportsbook,
        game_id: game.id
      }, gameOdds)
      
      if (meetsQualificationCriteria(analysis)) {
        qualifyingPicks.push({
          sport: game.sport,
          game_id: game.id,
          game_info: `${game.away_team} @ ${game.home_team}`,
          pick_type: 'total',
          selection: `Over ${bestOver.total}`,
          line: bestOver.total ?? null,
          odds: analysis.best_odds,
          sportsbook: analysis.best_book,
          confidence: analysis.recommendation_score,
          hit_probability: analysis.hit_probability,
          ev_percentage: analysis.ev_percentage,
          has_edge: analysis.has_edge,
          reasoning: analysis.reasoning,
          bet_details: {
            game,
            type: 'total',
            selection: 'over',
            line: bestOver.total
          },
          expires_at: game.game_date
        })
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
      const analysis = await analyzeGameBet({
        type: 'total',
        selection: 'under',
        line: bestUnder.total,
        odds: bestUnder.under_odds!,
        sportsbook: bestUnder.sportsbook,
        game_id: game.id
      }, gameOdds)
      
      if (meetsQualificationCriteria(analysis)) {
        qualifyingPicks.push({
          sport: game.sport,
          game_id: game.id,
          game_info: `${game.away_team} @ ${game.home_team}`,
          pick_type: 'total',
          selection: `Under ${bestUnder.total}`,
          line: bestUnder.total ?? null,
          odds: analysis.best_odds,
          sportsbook: analysis.best_book,
          confidence: analysis.recommendation_score,
          hit_probability: analysis.hit_probability,
          ev_percentage: analysis.ev_percentage,
          has_edge: analysis.has_edge,
          reasoning: analysis.reasoning,
          bet_details: {
            game,
            type: 'total',
            selection: 'under',
            line: bestUnder.total
          },
          expires_at: game.game_date
        })
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
      const analysis = await analyzeGameBet({
        type: 'moneyline',
        selection: 'home',
        team: game.home_team,
        odds: bestHomeML.moneyline_home!,
        sportsbook: bestHomeML.sportsbook,
        game_id: game.id
      }, gameOdds)
      
      if (meetsQualificationCriteria(analysis)) {
        qualifyingPicks.push({
          sport: game.sport,
          game_id: game.id,
          game_info: `${game.away_team} @ ${game.home_team}`,
          pick_type: 'moneyline',
          selection: `${game.home_team} ML`,
          line: null,
          odds: analysis.best_odds,
          sportsbook: analysis.best_book,
          confidence: analysis.recommendation_score,
          hit_probability: analysis.hit_probability,
          ev_percentage: analysis.ev_percentage,
          has_edge: analysis.has_edge,
          reasoning: analysis.reasoning,
          bet_details: {
            game,
            type: 'moneyline',
            team: game.home_team
          },
          expires_at: game.game_date
        })
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
      const analysis = await analyzeGameBet({
        type: 'moneyline',
        selection: 'away',
        team: game.away_team,
        odds: bestAwayML.moneyline_away!,
        sportsbook: bestAwayML.sportsbook,
        game_id: game.id
      }, gameOdds)
      
      if (meetsQualificationCriteria(analysis)) {
        qualifyingPicks.push({
          sport: game.sport,
          game_id: game.id,
          game_info: `${game.away_team} @ ${game.home_team}`,
          pick_type: 'moneyline',
          selection: `${game.away_team} ML`,
          line: null,
          odds: analysis.best_odds,
          sportsbook: analysis.best_book,
          confidence: analysis.recommendation_score,
          hit_probability: analysis.hit_probability,
          ev_percentage: analysis.ev_percentage,
          has_edge: analysis.has_edge,
          reasoning: analysis.reasoning,
          bet_details: {
            game,
            type: 'moneyline',
            team: game.away_team
          },
          expires_at: game.game_date
        })
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
  // Group props by player to avoid duplicates
  const analyzedPlayers = new Set<string>()
  
  for (const prop of allProps) {
    const playerKey = `${prop.player_name}-${prop.prop_type}`
    
    // Skip if already analyzed this player/prop combo
    if (analyzedPlayers.has(playerKey)) continue
    analyzedPlayers.add(playerKey)
    
    const game = games.find(g => g.id === prop.game_id)
    if (!game) continue
    
    const gameProps = allProps.filter(p => p.game_id === prop.game_id)
    
    // Analyze over
    if (prop.over_odds) {
      try {
        const analysis = await analyzePlayerProp({
          type: 'player_prop',
          player: prop.player_name,
          propType: prop.prop_type,
          selection: 'over',
          line: prop.line,
          odds: prop.over_odds,
          sportsbook: prop.sportsbook,
          game_id: prop.game_id
        }, gameProps)
        
        if (meetsQualificationCriteria(analysis)) {
          qualifyingPicks.push({
            sport: game.sport,
            game_id: game.id,
            game_info: `${prop.player_name} - ${game.away_team} @ ${game.home_team}`,
            pick_type: 'player_prop',
            selection: `${prop.player_name} Over ${prop.line} ${prop.prop_type}`,
            line: prop.line,
            odds: analysis.best_odds,
            sportsbook: analysis.best_book,
            confidence: analysis.recommendation_score,
            hit_probability: analysis.hit_probability,
            ev_percentage: analysis.ev_percentage,
            has_edge: analysis.has_edge,
            reasoning: analysis.reasoning,
            bet_details: {
              game,
              prop,
              type: 'player_prop',
              player: prop.player_name,
              propType: prop.prop_type,
              selection: 'over'
            },
            expires_at: game.game_date
          })
        }
      } catch (error) {
        console.error(`Error analyzing ${prop.player_name} over:`, error)
      }
    }
    
    // Analyze under
    if (prop.under_odds) {
      try {
        const analysis = await analyzePlayerProp({
          type: 'player_prop',
          player: prop.player_name,
          propType: prop.prop_type,
          selection: 'under',
          line: prop.line,
          odds: prop.under_odds,
          sportsbook: prop.sportsbook,
          game_id: prop.game_id
        }, gameProps)
        
        if (meetsQualificationCriteria(analysis)) {
          qualifyingPicks.push({
            sport: game.sport,
            game_id: game.id,
            game_info: `${prop.player_name} - ${game.away_team} @ ${game.home_team}`,
            pick_type: 'player_prop',
            selection: `${prop.player_name} Under ${prop.line} ${prop.prop_type}`,
            line: prop.line,
            odds: analysis.best_odds,
            sportsbook: analysis.best_book,
            confidence: analysis.recommendation_score,
            hit_probability: analysis.hit_probability,
            ev_percentage: analysis.ev_percentage,
            has_edge: analysis.has_edge,
            reasoning: analysis.reasoning,
            bet_details: {
              game,
              prop,
              type: 'player_prop',
              player: prop.player_name,
              propType: prop.prop_type,
              selection: 'under'
            },
            expires_at: game.game_date
          })
        }
      } catch (error) {
        console.error(`Error analyzing ${prop.player_name} under:`, error)
      }
    }
  }
}

/**
 * Check if bet meets qualification criteria
 * Priority: hit_probability >= 40%, ev_percentage > 0, best odds
 */
function meetsQualificationCriteria(analysis: any): boolean {
  return (
    analysis.hit_probability >= 40 &&
    analysis.ev_percentage > 0 &&
    analysis.has_edge
  )
}