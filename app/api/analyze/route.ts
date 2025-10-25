import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { analyzeBet, BetOption, BookmakerOdds } from '@/lib/analysis-engine'

export async function POST(request: Request) {
  const { gameId, betType = 'spread', propId } = await request.json()

  if (!gameId && !propId) {
    return NextResponse.json({ error: 'Game ID or Prop ID required' }, { status: 400 })
  }

  try {
    if (propId) {
      return await analyzePlayerPropBet(propId)
    }
    return await analyzeGameBetByType(gameId, betType)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

async function analyzeGameBetByType(gameId: string, betType: string) {
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  // Prefer v2 odds aggregation first
  const { data: v2 } = await supabase
    .from('odds_data_v2')
    .select('*')
    .eq('game_id', gameId)
  let oddsData: any[] | null = null
  if (v2 && v2.length > 0) {
    const byBook: Record<string, any> = {}
    for (const row of v2) {
      if (!row || !['spread','total','moneyline'].includes(row.market)) continue
      const book = (row.book_name || row.book_key) as string
      if (!byBook[book]) byBook[book] = { sportsbook: book, game_id: gameId }
      const agg = byBook[book]
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
    oddsData = Object.values(byBook)
  }

  if (!oddsData || oddsData.length === 0) {
    return NextResponse.json({ error: 'No odds data available' }, { status: 404 })
  }

  // Transform odds data to BookmakerOdds format
  const bookmakers: BookmakerOdds[] = oddsData.map(odds => ({
    key: odds.sportsbook,
    title: odds.sportsbook,
    lastUpdate: odds.updated_at || new Date().toISOString(),
    markets: [
      {
        key: 'spreads',
        outcomes: [
          { name: 'home', price: odds.spread_home_odds || -110, point: odds.spread_home },
          { name: 'away', price: odds.spread_away_odds || -110, point: odds.spread_away }
        ]
      },
      {
        key: 'totals',
        outcomes: [
          { name: 'Over', price: odds.over_odds || -110, point: odds.total },
          { name: 'Under', price: odds.under_odds || -110, point: odds.total }
        ]
      },
      {
        key: 'h2h',
        outcomes: [
          { name: game.home_team, price: odds.moneyline_home || -110 },
          { name: game.away_team, price: odds.moneyline_away || -110 }
        ]
      }
    ]
  }))

  let analyses: any[] = []

  if (betType === 'spread' || betType === 'all') {
    const homeSpreadBet: BetOption = {
      id: `${gameId}-spread-home`,
      betType: 'spreads',
      market: 'spreads',
      selection: 'home',
      line: oddsData[0]?.spread_home,
      odds: oddsData[0]?.spread_home_odds || -110,
      sportsbook: oddsData[0]?.sportsbook,
      eventId: gameId
    }

    const homeSpreadAnalysis = analyzeBet(homeSpreadBet, bookmakers)

    analyses.push({
      bet_identifier: `${gameId}-spread-home`,
      game_id: gameId,
      bet_type: 'spread',
      selection: `${game.home_team} ${homeSpreadAnalysis.bestOdds > 0 ? '+' : ''}${oddsData[0]?.spread_home}`,
      ev_percentage: homeSpreadAnalysis.expectedValue,
      has_edge: homeSpreadAnalysis.edge > 0,
      hit_probability: homeSpreadAnalysis.confidence,
      recommendation_score: homeSpreadAnalysis.confidence,
      reasoning: homeSpreadAnalysis.reasons.join('. '),
      best_book: homeSpreadAnalysis.bestSportsbook,
      best_odds: homeSpreadAnalysis.bestOdds
    })

    const awaySpreadBet: BetOption = {
      id: `${gameId}-spread-away`,
      betType: 'spreads',
      market: 'spreads',
      selection: 'away',
      line: oddsData[0]?.spread_away,
      odds: oddsData[0]?.spread_away_odds || -110,
      sportsbook: oddsData[0]?.sportsbook,
      eventId: gameId
    }

    const awaySpreadAnalysis = analyzeBet(awaySpreadBet, bookmakers)

    analyses.push({
      bet_identifier: `${gameId}-spread-away`,
      game_id: gameId,
      bet_type: 'spread',
      selection: `${game.away_team} ${awaySpreadAnalysis.bestOdds > 0 ? '+' : ''}${oddsData[0]?.spread_away}`,
      ev_percentage: awaySpreadAnalysis.expectedValue,
      has_edge: awaySpreadAnalysis.edge > 0,
      hit_probability: awaySpreadAnalysis.confidence,
      recommendation_score: awaySpreadAnalysis.confidence,
      reasoning: awaySpreadAnalysis.reasons.join('. '),
      best_book: awaySpreadAnalysis.bestSportsbook,
      best_odds: awaySpreadAnalysis.bestOdds
    })
  }

  if (betType === 'total' || betType === 'all') {
    const overBet: BetOption = {
      id: `${gameId}-total-over`,
      betType: 'totals',
      market: 'totals',
      selection: 'Over',
      line: oddsData[0]?.total,
      odds: oddsData[0]?.over_odds || -110,
      sportsbook: oddsData[0]?.sportsbook,
      eventId: gameId
    }

    const overAnalysis = analyzeBet(overBet, bookmakers)

    analyses.push({
      bet_identifier: `${gameId}-total-over`,
      game_id: gameId,
      bet_type: 'total',
      selection: `Over ${oddsData[0]?.total}`,
      ev_percentage: overAnalysis.expectedValue,
      has_edge: overAnalysis.edge > 0,
      hit_probability: overAnalysis.confidence,
      recommendation_score: overAnalysis.confidence,
      reasoning: overAnalysis.reasons.join('. '),
      best_book: overAnalysis.bestSportsbook,
      best_odds: overAnalysis.bestOdds
    })

    const underBet: BetOption = {
      id: `${gameId}-total-under`,
      betType: 'totals',
      market: 'totals',
      selection: 'Under',
      line: oddsData[0]?.total,
      odds: oddsData[0]?.under_odds || -110,
      sportsbook: oddsData[0]?.sportsbook,
      eventId: gameId
    }

    const underAnalysis = analyzeBet(underBet, bookmakers)

    analyses.push({
      bet_identifier: `${gameId}-total-under`,
      game_id: gameId,
      bet_type: 'total',
      selection: `Under ${oddsData[0]?.total}`,
      ev_percentage: underAnalysis.expectedValue,
      has_edge: underAnalysis.edge > 0,
      hit_probability: underAnalysis.confidence,
      recommendation_score: underAnalysis.confidence,
      reasoning: underAnalysis.reasons.join('. '),
      best_book: underAnalysis.bestSportsbook,
      best_odds: underAnalysis.bestOdds
    })
  }

  if (betType === 'moneyline' || betType === 'all') {
    const homeMLBet: BetOption = {
      id: `${gameId}-moneyline-home`,
      betType: 'h2h',
      market: 'h2h',
      selection: game.home_team,
      odds: oddsData[0]?.moneyline_home || -110,
      sportsbook: oddsData[0]?.sportsbook,
      eventId: gameId
    }

    const homeMLAnalysis = analyzeBet(homeMLBet, bookmakers)

    analyses.push({
      bet_identifier: `${gameId}-moneyline-home`,
      game_id: gameId,
      bet_type: 'moneyline',
      selection: game.home_team,
      ev_percentage: homeMLAnalysis.expectedValue,
      has_edge: homeMLAnalysis.edge > 0,
      hit_probability: homeMLAnalysis.confidence,
      recommendation_score: homeMLAnalysis.confidence,
      reasoning: homeMLAnalysis.reasons.join('. '),
      best_book: homeMLAnalysis.bestSportsbook,
      best_odds: homeMLAnalysis.bestOdds
    })

    const awayMLBet: BetOption = {
      id: `${gameId}-moneyline-away`,
      betType: 'h2h',
      market: 'h2h',
      selection: game.away_team,
      odds: oddsData[0]?.moneyline_away || -110,
      sportsbook: oddsData[0]?.sportsbook,
      eventId: gameId
    }

    const awayMLAnalysis = analyzeBet(awayMLBet, bookmakers)

    analyses.push({
      bet_identifier: `${gameId}-moneyline-away`,
      game_id: gameId,
      bet_type: 'moneyline',
      selection: game.away_team,
      ev_percentage: awayMLAnalysis.expectedValue,
      has_edge: awayMLAnalysis.edge > 0,
      hit_probability: awayMLAnalysis.confidence,
      recommendation_score: awayMLAnalysis.confidence,
      reasoning: awayMLAnalysis.reasons.join('. '),
      best_book: awayMLAnalysis.bestSportsbook,
      best_odds: awayMLAnalysis.bestOdds
    })
  }

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

async function analyzePlayerPropBet(propId: string) {
  // Prefer v2 for props; fallback to legacy
  let { data: mainProp } = await supabase
    .from('player_props_v2')
    .select('*')
    .eq('id', propId)
    .maybeSingle()

  if (!mainProp) {
    return NextResponse.json({ error: 'Prop not found' }, { status: 404 })
  }

  let { data: allProps } = await supabase
    .from('player_props_v2')
    .select('*')
    .eq('game_id', mainProp.game_id)
    .eq('player_name', mainProp.player_name)
    .eq('prop_type', mainProp.prop_type)

  if (!allProps || allProps.length === 0) {
    return NextResponse.json({ error: 'No prop data available' }, { status: 404 })
  }

  // Transform to BookmakerOdds format
  const bookmakers: BookmakerOdds[] = allProps.map(prop => ({
    key: prop.sportsbook,
    title: prop.sportsbook,
    lastUpdate: prop.updated_at || new Date().toISOString(),
    markets: [{
      key: 'player_prop',
      outcomes: [
        { name: 'Over', price: prop.over_odds || -110, point: prop.line, description: prop.player_name },
        { name: 'Under', price: prop.under_odds || -110, point: prop.line, description: prop.player_name }
      ]
    }]
  }))

  const overBet: BetOption = {
    id: `${propId}-over`,
    betType: 'player_prop',
    market: 'player_prop',
    selection: 'Over',
    line: mainProp.line,
    odds: mainProp.over_odds || -110,
    sportsbook: mainProp.sportsbook,
    playerName: mainProp.player_name,
    eventId: mainProp.game_id
  }

  const overAnalysis = analyzeBet(overBet, bookmakers)

  const underBet: BetOption = {
    id: `${propId}-under`,
    betType: 'player_prop',
    market: 'player_prop',
    selection: 'Under',
    line: mainProp.line,
    odds: mainProp.under_odds || -110,
    sportsbook: mainProp.sportsbook,
    playerName: mainProp.player_name,
    eventId: mainProp.game_id
  }

  const underAnalysis = analyzeBet(underBet, bookmakers)

  const analyses = [
    {
      bet_identifier: `${propId}-over`,
      game_id: mainProp.game_id,
      bet_type: 'player_prop',
      selection: `${mainProp.player_name} Over ${mainProp.line} ${mainProp.prop_type}`,
      ev_percentage: overAnalysis.expectedValue,
      has_edge: overAnalysis.edge > 0,
      hit_probability: overAnalysis.confidence,
      recommendation_score: overAnalysis.confidence,
      reasoning: overAnalysis.reasons.join('. '),
      best_book: overAnalysis.bestSportsbook,
      best_odds: overAnalysis.bestOdds
    },
    {
      bet_identifier: `${propId}-under`,
      game_id: mainProp.game_id,
      bet_type: 'player_prop',
      selection: `${mainProp.player_name} Under ${mainProp.line} ${mainProp.prop_type}`,
      ev_percentage: underAnalysis.expectedValue,
      has_edge: underAnalysis.edge > 0,
      hit_probability: underAnalysis.confidence,
      recommendation_score: underAnalysis.confidence,
      reasoning: underAnalysis.reasons.join('. '),
      best_book: underAnalysis.bestSportsbook,
      best_odds: underAnalysis.bestOdds
    }
  ]

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