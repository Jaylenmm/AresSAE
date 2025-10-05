import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchOdds, fetchPlayerProps, SPORT_KEYS } from '@/lib/odds-api'
import { getTop25CFBTeams, isTop25Team } from '@/lib/espn-api'

export const maxDuration = 300 // 5 minutes max execution

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (security)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if we've already run today (prevent duplicate runs)
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  
  const { data: lastRun } = await supabase
    .from('cron_runs')
    .select('run_date, completed_at')
    .eq('run_date', today)
    .eq('status', 'completed')
    .single()

  if (lastRun) {
    return NextResponse.json({ 
      message: 'Already ran today',
      lastRun: lastRun.completed_at,
      skipped: true
    })
  }

  // Create run record
  const { data: runRecord } = await supabase
    .from('cron_runs')
    .insert({
      run_date: today,
      started_at: new Date().toISOString(),
      status: 'running'
    })
    .select()
    .single()

  type SportResult = { games: number; odds: number; props: number };
  type Results = {
    NFL: SportResult;
    NBA: SportResult;
    CFB: SportResult;
    errors: string[];
  };

  const results: Results = {
    NFL: { games: 0, odds: 0, props: 0 },
    NBA: { games: 0, odds: 0, props: 0 },
    CFB: { games: 0, odds: 0, props: 0 },
    errors: []
  }

  try {
    // Collect data for each sport
    for (const sport of ['NFL', 'NBA', 'CFB']) {
      try {
        const result = await collectSportData(sport)
        results[sport as keyof Omit<Results, 'errors'>] = result
      } catch (error) {
        results.errors.push(`${sport}: ${error}`)
      }
    }

    // Mark run as completed
    await supabase
      .from('cron_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        results: results
      })
      .eq('id', runRecord?.id)

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      results 
    })
  } catch (error) {
    // Mark run as failed
    await supabase
      .from('cron_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: String(error)
      })
      .eq('id', runRecord?.id)

    return NextResponse.json({ 
      success: false, 
      error: String(error)
    }, { status: 500 })
  }
}

async function collectSportData(sport: string) {
  const sportKey = SPORT_KEYS[sport as keyof typeof SPORT_KEYS]
  let gamesCreated = 0
  let oddsCreated = 0
  let propsCreated = 0

  // Get Top 25 for CFB
  let top25Teams: string[] = []
  if (sport === 'CFB') {
    top25Teams = await getTop25CFBTeams()
  }

  // Fetch odds
  const oddsData = await fetchOdds(sportKey)
  const gameIdMap = new Map<string, string>()

  for (const event of oddsData) {
    // CFB filtering
    if (sport === 'CFB') {
      const homeIsTop25 = isTop25Team(event.home_team, top25Teams)
      const awayIsTop25 = isTop25Team(event.away_team, top25Teams)
      if (!homeIsTop25 && !awayIsTop25) continue
    }

    const { data: game } = await supabase
      .from('games')
      .upsert({
        sport: sport,
        espn_game_id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        game_date: event.commence_time,
        status: 'scheduled'
      }, { 
        onConflict: 'espn_game_id',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (!game) continue

    gameIdMap.set(event.id, game.id)
    gamesCreated++

    // Store odds
    for (const bookmaker of event.bookmakers || []) {
      const spreads = bookmaker.markets?.find((m: any) => m.key === 'spreads')
      const totals = bookmaker.markets?.find((m: any) => m.key === 'totals')
      const h2h = bookmaker.markets?.find((m: any) => m.key === 'h2h')

      const oddsEntry: any = {
        game_id: game.id,
        sportsbook: bookmaker.key,
        updated_at: new Date().toISOString()
      }

      if (spreads?.outcomes) {
        const homeSpread = spreads.outcomes.find((o: any) => o.name === event.home_team)
        const awaySpread = spreads.outcomes.find((o: any) => o.name === event.away_team)
        if (homeSpread && awaySpread) {
          oddsEntry.spread_home = homeSpread.point
          oddsEntry.spread_away = awaySpread.point
          oddsEntry.spread_home_odds = homeSpread.price
          oddsEntry.spread_away_odds = awaySpread.price
        }
      }

      if (totals?.outcomes) {
        const over = totals.outcomes.find((o: any) => o.name === 'Over')
        const under = totals.outcomes.find((o: any) => o.name === 'Under')
        if (over && under) {
          oddsEntry.total = over.point
          oddsEntry.over_odds = over.price
          oddsEntry.under_odds = under.price
        }
      }

      if (h2h?.outcomes) {
        const homeML = h2h.outcomes.find((o: any) => o.name === event.home_team)
        const awayML = h2h.outcomes.find((o: any) => o.name === event.away_team)
        if (homeML && awayML) {
          oddsEntry.moneyline_home = homeML.price
          oddsEntry.moneyline_away = awayML.price
        }
      }

      await supabase
        .from('odds_data')
        .upsert(oddsEntry, { onConflict: 'game_id,sportsbook' })

      oddsCreated++
    }
  }

  // Fetch player props
  const propsData = await fetchPlayerProps(sportKey)
  
  for (const eventData of propsData) {
    const gameId = gameIdMap.get(eventData.id)
    if (!gameId) continue

    for (const bookmaker of eventData.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        const propType = market.key
          .replace('player_', '')
          .replace('batter_', '')
          .replace('pitcher_', '')
          .replace(/_/g, ' ')
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

        for (const outcome of market.outcomes || []) {
          if (!outcome.description) continue

          const isOver = outcome.name === 'Over'
          
          await supabase
            .from('player_props')
            .upsert({
              game_id: gameId,
              player_name: outcome.description,
              prop_type: propType,
              line: outcome.point,
              over_odds: isOver ? outcome.price : null,
              under_odds: !isOver ? outcome.price : null,
              sportsbook: bookmaker.key,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'game_id,player_name,prop_type,sportsbook'
            })

          propsCreated++
        }
      }
    }
  }

  return { games: gamesCreated, odds: oddsCreated, props: propsCreated }
}