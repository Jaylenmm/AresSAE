import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchOdds, fetchPlayerProps, SPORT_KEYS } from '@/lib/odds-api'
import { getTop25NCAAFTeams, isTop25Team } from '@/lib/espn-api'

export const maxDuration = 300

type SportResult = { games: number; odds: number; props: number; error?: string };

const BOOKMAKER_NAMES: Record<string, string> = {
  'draftkings': 'DraftKings',
  'fanduel': 'FanDuel',
  'betmgm': 'BetMGM',
  'caesars': 'Caesars',
  'betrivers': 'BetRivers',
  'pointsbetus': 'PointsBet',
  'espnbet': 'ESPN BET',
  'wynnbet': 'WynnBet',
  'bovada': 'Bovada',
  'mybookieag': 'MyBookie',
  'betus': 'BetUS',
  'lowvig': 'LowVig',
  'betonlineag': 'BetOnline',
  'superbook': 'SuperBook',
  'unibet_us': 'Unibet',
  'pinnacle': 'Pinnacle',
  'bookmaker': 'Bookmaker',
  'circa': 'Circa'
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  
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

  const { data: runRecord } = await supabase
    .from('cron_runs')
    .insert({
      run_date: today,
      started_at: new Date().toISOString(),
      status: 'running'
    })
    .select()
    .single()

  type SportResult = { games: number; odds: number; props: number; error?: string };
  type Results = {
    NFL: SportResult;
    NBA: SportResult;
    MLB: SportResult;
    NCAAF: SportResult;
    featuredPicks?: { success: boolean; generated: number; error?: string };
    errors: string[];
  };

  const results: Results = {
    NFL: { games: 0, odds: 0, props: 0 },
    NBA: { games: 0, odds: 0, props: 0 },
    MLB: { games: 0, odds: 0, props: 0 },
    NCAAF: { games: 0, odds: 0, props: 0 },
    errors: []
  }

  try {
    for (const sport of ['NFL', 'NBA', 'MLB', 'NCAAF']) {
      try {
        const result = await collectSportData(sport)
        if (sport === 'NFL' || sport === 'NBA' || sport === 'MLB' || sport === 'NCAAF') {
          results[sport] = result
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.errors.push(`${sport}: ${errorMsg}`)
        if (sport === 'NFL' || sport === 'NBA' || sport === 'MLB' || sport === 'NCAAF') {
          results[sport].error = errorMsg
        }
      }
    }

    try {
      const { generateFeaturedPicks } = await import('@/lib/generateFeaturedPicks')
      const pickResults = await generateFeaturedPicks()
      
      results.featuredPicks = {
        success: pickResults.success,
        generated: pickResults.picksGenerated,
        error: pickResults.error
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      results.errors.push(`Featured picks: ${errorMsg}`)
    }

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

async function collectSportData(sport: string): Promise<SportResult> {
  const sportKey = SPORT_KEYS[sport as keyof typeof SPORT_KEYS]
  
  if (!sportKey) {
    throw new Error(`Invalid sport: ${sport}`)
  }
  
  let gamesCreated = 0
  let oddsCreated = 0
  let propsCreated = 0

  let top25Teams: string[] = []
  if (sport === 'NCAAF') {
    top25Teams = await getTop25NCAAFTeams()
  }

  const oddsData = await fetchOdds(sportKey)
  const gameIdMap = new Map<string, string>()

  for (const event of oddsData) {
    if (sport === 'NCAAF') {
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

    for (const bookmaker of event.bookmakers || []) {
      const spreads = bookmaker.markets?.find((m: any) => m.key === 'spreads')
      const totals = bookmaker.markets?.find((m: any) => m.key === 'totals')
      const h2h = bookmaker.markets?.find((m: any) => m.key === 'h2h')
      const altSpreads = bookmaker.markets?.find((m: any) => m.key === 'alternate_spreads')
      const altTotals = bookmaker.markets?.find((m: any) => m.key === 'alternate_totals')

      const displayName = BOOKMAKER_NAMES[bookmaker.key] || bookmaker.title

      const oddsEntry: any = {
        game_id: game.id,
        sportsbook: displayName,
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

      if (altSpreads?.outcomes) {
        const altSpreadsByLine = new Map<number, { home: any, away: any }>()
        
        altSpreads.outcomes.forEach((outcome: any) => {
          const line = Math.abs(outcome.point)
          if (!altSpreadsByLine.has(line)) {
            altSpreadsByLine.set(line, { home: null, away: null })
          }
          const pair = altSpreadsByLine.get(line)!
          if (outcome.name === event.home_team) {
            pair.home = outcome
          } else {
            pair.away = outcome
          }
        })

        for (const [line, { home, away }] of altSpreadsByLine) {
          if (home && away) {
            await supabase
              .from('odds_data')
              .upsert({
                game_id: game.id,
                sportsbook: displayName,
                spread_home: home.point,
                spread_away: away.point,
                spread_home_odds: home.price,
                spread_away_odds: away.price,
                is_alternate: true,
                updated_at: new Date().toISOString()
              }, { onConflict: 'game_id,sportsbook,spread_home,total' })
            
            oddsCreated++
          }
        }
      }

      if (altTotals?.outcomes) {
        const altTotalsByLine = new Map<number, { over: any, under: any }>()
        
        altTotals.outcomes.forEach((outcome: any) => {
          const line = outcome.point
          if (!altTotalsByLine.has(line)) {
            altTotalsByLine.set(line, { over: null, under: null })
          }
          const pair = altTotalsByLine.get(line)!
          if (outcome.name === 'Over') {
            pair.over = outcome
          } else {
            pair.under = outcome
          }
        })

        for (const [line, { over, under }] of altTotalsByLine) {
          if (over && under) {
            await supabase
              .from('odds_data')
              .upsert({
                game_id: game.id,
                sportsbook: displayName,
                total: over.point,
                over_odds: over.price,
                under_odds: under.price,
                is_alternate: true,
                updated_at: new Date().toISOString()
              }, { onConflict: 'game_id,sportsbook,spread_home,total' })
            
            oddsCreated++
          }
        }
      }
    }
  }

  const propsData = await fetchPlayerProps(sportKey)
  
  for (const eventData of propsData) {
    const gameId = gameIdMap.get(eventData.id)
    if (!gameId) continue

    for (const bookmaker of eventData.bookmakers || []) {
      const displayName = BOOKMAKER_NAMES[bookmaker.key] || bookmaker.title

      for (const market of bookmaker.markets || []) {
        const isAlternate = market.key.includes('_alternate')
        
        const propType = market.key
          .replace('player_', '')
          .replace('batter_', '')
          .replace('pitcher_', '')
          .replace('_alternate', '')
          .replace(/_/g, ' ')
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')

        const playerOutcomes = new Map<string, { over: any, under: any }>()
        
        for (const outcome of market.outcomes || []) {
          const playerName = outcome.description
          if (!playerName) continue
          
          if (!playerOutcomes.has(playerName)) {
            playerOutcomes.set(playerName, { over: null, under: null })
          }
          
          const player = playerOutcomes.get(playerName)!
          if (outcome.name === 'Over') {
            player.over = outcome
          } else if (outcome.name === 'Under') {
            player.under = outcome
          }
        }

        for (const [playerName, outcomes] of playerOutcomes) {
          const line = outcomes.over?.point || outcomes.under?.point
          if (!line) continue

          await supabase
            .from('player_props')
            .upsert({
              game_id: gameId,
              player_name: playerName,
              prop_type: propType,
              line: line,
              over_odds: outcomes.over?.price || null,
              under_odds: outcomes.under?.price || null,
              sportsbook: displayName,
              is_alternate: isAlternate,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'game_id,player_name,prop_type,sportsbook,line'
            })

          propsCreated++
        }
      }
    }
  }

  return { games: gamesCreated, odds: oddsCreated, props: propsCreated }
}