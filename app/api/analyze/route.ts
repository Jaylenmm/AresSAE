import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { analyzeGameBet, analyzePlayerProp } from '@/lib/betAnalysis'

export async function POST(request: Request) {
  const { gameId, betType = 'spread', propId } = await request.json()

  // Validate input
  if (!gameId && !propId) {
    return NextResponse.json({ error: 'Game ID or Prop ID required' }, { status: 400 })
  }

  try {
    // PLAYER PROP ANALYSIS
    if (propId) {
      return await analyzePlayerPropBet(propId)
    }

    // GAME BET ANALYSIS
    return await analyzeGameBetByType(gameId, betType)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

// Analyze game bets (spread, moneyline, total)
async function analyzeGameBetByType(gameId: string, betType: string) {
  // Get game
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  // Get odds from multiple sportsbooks
  const { data: oddsData } = await supabase
    .from('odds_data')
    .select('*')
    .eq('game_id', gameId)

  if (!oddsData || oddsData.length === 0) {
    return NextResponse.json({ error: 'No odds data available' }, { status: 404 })
  }

  // Analyze based on bet type
  let analyses: any[] = []

  if (betType === 'spread' || betType === 'all') {
    // Analyze home spread
    const homeSpreadBet = {
      type: 'spread' as const,
      team: game.home_team,
      selection: 'home',
      line: oddsData[0]?.spread_home,
      odds: oddsData[0]?.spread_home_odds || -110,
      sportsbook: oddsData[0]?.sportsbook,
      game_id: gameId
    }

    const homeSpreadAnalysis = analyzeGameBet(homeSpreadBet, oddsData)

    analyses.push({
      bet_identifier: `${gameId}-spread-home`,
      game_id: gameId,
      bet_type: 'spread',
      selection: `${game.home_team} ${homeSpreadAnalysis.best_odds > 0 ? '+' : ''}${oddsData[0]?.spread_home}`,
      ev_percentage: homeSpreadAnalysis.ev_percentage,
      has_edge: homeSpreadAnalysis.has_edge,
      hit_probability: homeSpreadAnalysis.hit_probability,
      recommendation_score: homeSpreadAnalysis.recommendation_score,
      reasoning: homeSpreadAnalysis.reasoning,
      best_book: homeSpreadAnalysis.best_book,
      best_odds: homeSpreadAnalysis.best_odds
    })

    // Analyze away spread
    const awaySpreadBet = {
      type: 'spread' as const,
      team: game.away_team,
      selection: 'away',
      line: oddsData[0]?.spread_away,
      odds: oddsData[0]?.spread_away_odds || -110,
      sportsbook: oddsData[0]?.sportsbook,
      game_id: gameId
    }

    const awaySpreadAnalysis = analyzeGameBet(awaySpreadBet, oddsData)

    analyses.push({
      bet_identifier: `${gameId}-spread-away`,
      game_id: gameId,
      bet_type: 'spread',
      selection: `${game.away_team} ${awaySpreadAnalysis.best_odds > 0 ? '+' : ''}${oddsData[0]?.spread_away}`,
      ev_percentage: awaySpreadAnalysis.ev_percentage,
      has_edge: awaySpreadAnalysis.has_edge,
      hit_probability: awaySpreadAnalysis.hit_probability,
      recommendation_score: awaySpreadAnalysis.recommendation_score,
      reasoning: awaySpreadAnalysis.reasoning,
      best_book: awaySpreadAnalysis.best_book,
      best_odds: awaySpreadAnalysis.best_odds
    })
  }

  if (betType === 'total' || betType === 'all') {
    // Analyze over
    const overBet = {
      type: 'total' as const,
      selection: 'over',
      line: oddsData[0]?.total,
      odds: oddsData[0]?.over_odds || -110,
      sportsbook: oddsData[0]?.sportsbook,
      game_id: gameId
    }

    const overAnalysis = analyzeGameBet(overBet, oddsData)

    analyses.push({
      bet_identifier: `${gameId}-total-over`,
      game_id: gameId,
      bet_type: 'total',
      selection: `Over ${oddsData[0]?.total}`,
      ev_percentage: overAnalysis.ev_percentage,
      has_edge: overAnalysis.has_edge,
      hit_probability: overAnalysis.hit_probability,
      recommendation_score: overAnalysis.recommendation_score,
      reasoning: overAnalysis.reasoning,
      best_book: overAnalysis.best_book,
      best_odds: overAnalysis.best_odds
    })

    // Analyze under
    const underBet = {
      type: 'total' as const,
      selection: 'under',
      line: oddsData[0]?.total,
      odds: oddsData[0]?.under_odds || -110,
      sportsbook: oddsData[0]?.sportsbook,
      game_id: gameId
    }

    const underAnalysis = analyzeGameBet(underBet, oddsData)

    analyses.push({
      bet_identifier: `${gameId}-total-under`,
      game_id: gameId,
      bet_type: 'total',
      selection: `Under ${oddsData[0]?.total}`,
      ev_percentage: underAnalysis.ev_percentage,
      has_edge: underAnalysis.has_edge,
      hit_probability: underAnalysis.hit_probability,
      recommendation_score: underAnalysis.recommendation_score,
      reasoning: underAnalysis.reasoning,
      best_book: underAnalysis.best_book,
      best_odds: underAnalysis.best_odds
    })
  }

  if (betType === 'moneyline' || betType === 'all') {
    // Analyze home moneyline
    const homeMLBet = {
      type: 'moneyline' as const,
      team: game.home_team,
      selection: 'home',
      odds: oddsData[0]?.moneyline_home || -110,
      sportsbook: oddsData[0]?.sportsbook,
      game_id: gameId
    }

    const homeMLAnalysis = analyzeGameBet(homeMLBet, oddsData)

    analyses.push({
      bet_identifier: `${gameId}-moneyline-home`,
      game_id: gameId,
      bet_type: 'moneyline',
      selection: game.home_team,
      ev_percentage: homeMLAnalysis.ev_percentage,
      has_edge: homeMLAnalysis.has_edge,
      hit_probability: homeMLAnalysis.hit_probability,
      recommendation_score: homeMLAnalysis.recommendation_score,
      reasoning: homeMLAnalysis.reasoning,
      best_book: homeMLAnalysis.best_book,
      best_odds: homeMLAnalysis.best_odds
    })

    // Analyze away moneyline
    const awayMLBet = {
      type: 'moneyline' as const,
      team: game.away_team,
      selection: 'away',
      odds: oddsData[0]?.moneyline_away || -110,
      sportsbook: oddsData[0]?.sportsbook,
      game_id: gameId
    }

    const awayMLAnalysis = analyzeGameBet(awayMLBet, oddsData)

    analyses.push({
      bet_identifier: `${gameId}-moneyline-away`,
      game_id: gameId,
      bet_type: 'moneyline',
      selection: game.away_team,
      ev_percentage: awayMLAnalysis.ev_percentage,
      has_edge: awayMLAnalysis.has_edge,
      hit_probability: awayMLAnalysis.hit_probability,
      recommendation_score: awayMLAnalysis.recommendation_score,
      reasoning: awayMLAnalysis.reasoning,
      best_book: awayMLAnalysis.best_book,
      best_odds: awayMLAnalysis.best_odds
    })
  }

  // Save all analyses to database
  const { data: savedAnalyses, error } = await supabase
    .from('market_analysis')
    .upsert(analyses, { onConflict: 'bet_identifier' })
    .select()

  if (error) {
    console.error('Database save error:', error)
  }

  return NextResponse.json({ 
    analyses: savedAnalyses || analyses,
    game: {
      home_team: game.home_team,
      away_team: game.away_team,
      game_date: game.game_date
    }
  })
}

// Analyze player prop bets
async function analyzePlayerPropBet(propId: string) {
  // Get the specific prop
  const { data: mainProp } = await supabase
    .from('player_props')
    .select('*')
    .eq('id', propId)
    .single()

  if (!mainProp) {
    return NextResponse.json({ error: 'Prop not found' }, { status: 404 })
  }

  // Get all props for this player/game to compare across sportsbooks
  const { data: allProps } = await supabase
    .from('player_props')
    .select('*')
    .eq('game_id', mainProp.game_id)
    .eq('player_name', mainProp.player_name)
    .eq('prop_type', mainProp.prop_type)

  if (!allProps || allProps.length === 0) {
    return NextResponse.json({ error: 'No prop data available' }, { status: 404 })
  }

  // Analyze over
  const overBet = {
    type: 'player_prop' as const,
    player: mainProp.player_name,
    propType: mainProp.prop_type,
    selection: 'over',
    line: mainProp.line,
    odds: mainProp.over_odds || -110,
    sportsbook: mainProp.sportsbook,
    game_id: mainProp.game_id
  }

  const overAnalysis = analyzePlayerProp(overBet, allProps)

  // Analyze under
  const underBet = {
    type: 'player_prop' as const,
    player: mainProp.player_name,
    propType: mainProp.prop_type,
    selection: 'under',
    line: mainProp.line,
    odds: mainProp.under_odds || -110,
    sportsbook: mainProp.sportsbook,
    game_id: mainProp.game_id
  }

  const underAnalysis = analyzePlayerProp(underBet, allProps)

  const analyses = [
    {
      bet_identifier: `${propId}-over`,
      game_id: mainProp.game_id,
      bet_type: 'player_prop',
      selection: `${mainProp.player_name} Over ${mainProp.line} ${mainProp.prop_type}`,
      ev_percentage: overAnalysis.ev_percentage,
      has_edge: overAnalysis.has_edge,
      hit_probability: overAnalysis.hit_probability,
      recommendation_score: overAnalysis.recommendation_score,
      reasoning: overAnalysis.reasoning,
      best_book: overAnalysis.best_book,
      best_odds: overAnalysis.best_odds
    },
    {
      bet_identifier: `${propId}-under`,
      game_id: mainProp.game_id,
      bet_type: 'player_prop',
      selection: `${mainProp.player_name} Under ${mainProp.line} ${mainProp.prop_type}`,
      ev_percentage: underAnalysis.ev_percentage,
      has_edge: underAnalysis.has_edge,
      hit_probability: underAnalysis.hit_probability,
      recommendation_score: underAnalysis.recommendation_score,
      reasoning: underAnalysis.reasoning,
      best_book: underAnalysis.best_book,
      best_odds: underAnalysis.best_odds
    }
  ]

  // Save to database
  const { data: savedAnalyses, error } = await supabase
    .from('market_analysis')
    .upsert(analyses, { onConflict: 'bet_identifier' })
    .select()

  if (error) {
    console.error('Database save error:', error)
  }

  return NextResponse.json({ 
    analyses: savedAnalyses || analyses,
    prop: {
      player_name: mainProp.player_name,
      prop_type: mainProp.prop_type,
      line: mainProp.line
    }
  })
}