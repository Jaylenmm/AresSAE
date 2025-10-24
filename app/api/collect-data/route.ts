import { NextResponse } from 'next/server'

export const maxDuration = 300
import { supabase } from '@/lib/supabase'
import { fetchOdds, fetchAlternateOdds, fetchPropsForEvent, getPropMarketsForSportKey, SPORT_KEYS } from '@/lib/odds-api'
import { getTop25NCAAFTeams, isTop25Team } from '@/lib/espn-api'

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
  'circa': 'Circa',
  'circasports': 'Circa'
}

// Default bookmaker sets
const SOCIAL_BOOK_KEYS = [
  'draftkings',
  'fanduel',
  'caesars',
  'betmgm',
  'bet365',
  'fanatics',
  'espnbet'
]

const SHARP_BOOK_KEYS = [
  'pinnacle',
  'circa'
]

const DEFAULT_ODDS_BOOK_KEYS = [...SOCIAL_BOOK_KEYS, ...SHARP_BOOK_KEYS]

// Curated list of supported sportsbooks for props collection (v2)
const SUPPORTED_PROP_BOOKS = [
  // social
  'draftkings',
  'fanduel',
  'betmgm',
  'caesars',
  'espnbet',
  // sharp (where available via API)
  'pinnacle',
  'circa'
]



export async function POST(request: Request) {
  const { sport, skipAlternates = false, skipProps = false, bookmakerKeys, hoursAhead, startHoursAhead = 0, windowHours, propsFromDb = true } = await request.json()
  
  if (!sport || !SPORT_KEYS[sport as keyof typeof SPORT_KEYS]) {
    return NextResponse.json({ error: 'Invalid sport' }, { status: 400 })
  }

  try {
    const sportKey = SPORT_KEYS[sport as keyof typeof SPORT_KEYS]
    let gamesCreated = 0
    let oddsCreated = 0
    let propsCreated = 0

    let top25Teams: string[] = []
    if (sport === 'NCAAF') {
      top25Teams = await getTop25NCAAFTeams()
    }

    const oddsData = await fetchOdds(sportKey)
    const gameIdMap = new Map<string, string>()

    // Optional time window filter
    const now = Date.now()
    const lower = Math.max(0, Number(startHoursAhead || 0)) * 3600000 + now
    const upper = typeof windowHours === 'number' && windowHours > 0
      ? lower + windowHours * 3600000
      : (hoursAhead ? now + hoursAhead * 3600000 : null)

    for (const event of oddsData) {
      const t = new Date(event.commence_time).getTime()
      if (isFinite(t)) {
        if (t < lower) continue
        if (upper && t >= upper) continue
      }
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

      // Store standard odds
      const allBooks = event.bookmakers || []
      const activeKeys = Array.isArray(bookmakerKeys) && bookmakerKeys.length > 0
        ? bookmakerKeys
        : DEFAULT_ODDS_BOOK_KEYS
      const filteredBooks = allBooks.filter((b: any) => {
        const key = b.key === 'circasports' ? 'circa' : b.key
        return activeKeys.includes(key)
      })
      for (const bookmaker of filteredBooks) {
        const spreads = bookmaker.markets?.find((m: any) => m.key === 'spreads')
        const totals = bookmaker.markets?.find((m: any) => m.key === 'totals')
        const h2h = bookmaker.markets?.find((m: any) => m.key === 'h2h')

        const displayName = BOOKMAKER_NAMES[bookmaker.key] || bookmaker.title
        const bookKey = bookmaker.key

        const nowIso = new Date().toISOString()

        if (spreads?.outcomes) {
          const homeSpread = spreads.outcomes.find((o: any) => o.name === event.home_team)
          const awaySpread = spreads.outcomes.find((o: any) => o.name === event.away_team)
          if (homeSpread && awaySpread) {
            const del = await supabase
              .from('odds_data_v2')
              .delete()
              .eq('game_id', game.id)
              .eq('book_key', bookKey)
              .eq('market', 'spread')
            if (del.error) {
              console.error('Supabase delete v2 spread error:', del.error)
            }
            const ins = await supabase
              .from('odds_data_v2')
              .insert({
                game_id: game.id,
                book_key: bookKey,
                book_name: displayName,
                market: 'spread',
                spread_home: homeSpread.point,
                spread_away: awaySpread.point,
                spread_home_odds: homeSpread.price,
                spread_away_odds: awaySpread.price,
                updated_at: nowIso
              })
            if (ins.error) {
              console.error('Supabase insert v2 spread error:', ins.error)
            }
          }
        }

        if (totals?.outcomes) {
          const over = totals.outcomes.find((o: any) => o.name === 'Over')
          const under = totals.outcomes.find((o: any) => o.name === 'Under')
          if (over && under) {
            const del = await supabase
              .from('odds_data_v2')
              .delete()
              .eq('game_id', game.id)
              .eq('book_key', bookKey)
              .eq('market', 'total')
            if (del.error) {
              console.error('Supabase delete v2 total error:', del.error)
            }
            const ins = await supabase
              .from('odds_data_v2')
              .insert({
                game_id: game.id,
                book_key: bookKey,
                book_name: displayName,
                market: 'total',
                line: over.point,
                over_odds: over.price,
                under_odds: under.price,
                updated_at: nowIso
              })
            if (ins.error) {
              console.error('Supabase insert v2 total error:', ins.error)
            }
          }
        }

        if (h2h?.outcomes) {
          const homeML = h2h.outcomes.find((o: any) => o.name === event.home_team)
          const awayML = h2h.outcomes.find((o: any) => o.name === event.away_team)
          if (homeML && awayML) {
            const del = await supabase
              .from('odds_data_v2')
              .delete()
              .eq('game_id', game.id)
              .eq('book_key', bookKey)
              .eq('market', 'moneyline')
            if (del.error) {
              console.error('Supabase delete v2 moneyline error:', del.error)
            }
            const ins = await supabase
              .from('odds_data_v2')
              .insert({
                game_id: game.id,
                book_key: bookKey,
                book_name: displayName,
                market: 'moneyline',
                moneyline_home: homeML.price,
                moneyline_away: awayML.price,
                updated_at: nowIso
              })
            if (ins.error) {
              console.error('Supabase insert v2 moneyline error:', ins.error)
            }
          }
        }
        oddsCreated++
      }

      // Fetch alternate markets for this specific event
      if (!skipAlternates) {
      const alternateData = await fetchAlternateOdds(sportKey, event.id)

      for (const bookmaker of alternateData.bookmakers || []) {
        const altSpreads = bookmaker.markets?.find((m: any) => m.key === 'alternate_spreads')
        const altTotals = bookmaker.markets?.find((m: any) => m.key === 'alternate_totals')
        const displayName = BOOKMAKER_NAMES[bookmaker.key] || bookmaker.title
        const bookKey = bookmaker.key

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
              const del = await supabase
                .from('odds_data_v2')
                .delete()
                .eq('game_id', game.id)
                .eq('book_key', bookKey)
                .eq('market', 'alt_spread')
                .eq('line', Math.abs(home.point))
              if (del.error) {
                console.error('Supabase delete v2 alt_spread error:', del.error)
              }
              const ins = await supabase
                .from('odds_data_v2')
                .insert({
                  game_id: game.id,
                  book_key: bookKey,
                  book_name: displayName,
                  market: 'alt_spread',
                  line: Math.abs(home.point),
                  spread_home: home.point,
                  spread_away: away.point,
                  spread_home_odds: home.price,
                  spread_away_odds: away.price,
                  updated_at: new Date().toISOString()
                })
              if (ins.error) {
                console.error('Supabase insert v2 alt_spread error:', ins.error)
              }
              
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
              const del = await supabase
                .from('odds_data_v2')
                .delete()
                .eq('game_id', game.id)
                .eq('book_key', bookKey)
                .eq('market', 'alt_total')
                .eq('line', over.point)
              if (del.error) {
                console.error('Supabase delete v2 alt_total error:', del.error)
              }
              const ins = await supabase
                .from('odds_data_v2')
                .insert({
                  game_id: game.id,
                  book_key: bookKey,
                  book_name: displayName,
                  market: 'alt_total',
                  line: over.point,
                  over_odds: over.price,
                  under_odds: under.price,
                  updated_at: new Date().toISOString()
                })
              if (ins.error) {
                console.error('Supabase insert v2 alt_total error:', ins.error)
              }
              
              oddsCreated++
            }
          }
        }
      }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Fetch player props
    if (!skipProps) {
    const propMarkets = getPropMarketsForSportKey(sportKey)
    // Either use DB games (ignoring any time slicing), or fall back to the games we just saved
    let entries: Array<[string, string]> = []
    if (propsFromDb) {
      const { data: dbGames, error: dbErr } = await supabase
        .from('games')
        .select('id, espn_game_id, status, sport')
        .eq('sport', sport)
        .eq('status', 'scheduled')
      if (dbErr) {
        console.error('Supabase load games for props error:', dbErr)
      } else {
        entries = (dbGames || [])
          .filter((g: any) => g.espn_game_id)
          .map((g: any) => [g.espn_game_id as string, g.id as string])
      }
    }
    if (entries.length === 0) {
      entries = Array.from(gameIdMap.entries())
    }
    // Lightweight cache cleanup: drop stale props older than 10 days
    try {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      const cleanup = await supabase
        .from('player_props_v2')
        .delete()
        .lt('updated_at', tenDaysAgo)
      if (cleanup.error) {
        // Table may not exist yet; ignore
      }
    } catch {}

    let idx = 0
    const concurrency = 3

    async function processOne(eventId: string, gameId: string) {
      try {
        const resp = await fetchPropsForEvent(sportKey, eventId, propMarkets)
        if (!resp.ok) return
        const json = await resp.json()

        // Use curated supported books list for props v2 unless explicitly overridden
        const activeKeys = Array.isArray(bookmakerKeys) && bookmakerKeys.length > 0
          ? bookmakerKeys
          : SUPPORTED_PROP_BOOKS

        const filteredByActive = (json.bookmakers || []).filter((b: any) => {
          const key = b.key === 'circasports' ? 'circa' : b.key
          return activeKeys.includes(key)
        })

        const shouldFallbackToSocial = filteredByActive.length === 0 && activeKeys.every((k: string) => ['pinnacle','circa'].includes(k))

        const filteredBooksForProps = shouldFallbackToSocial
          ? (json.bookmakers || []).filter((b: any) => {
              const key = b.key === 'circasports' ? 'circa' : b.key
              return SUPPORTED_PROP_BOOKS.includes(key)
            })
          : filteredByActive

        for (const bookmaker of filteredBooksForProps) {
          const displayName = BOOKMAKER_NAMES[bookmaker.key] || bookmaker.title

          const ONE_SIDED_MARKETS = new Set<string>([
            'batter_home_runs',
            'player_anytime_td'
          ])

          for (const market of bookmaker.markets || []) {
            const isAlternate = market.key.includes('_alternate')
            const rawMarketKey = market.key.replace('_alternate', '')

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

              // Normalize Yes/No to Over/Under for anytime TD market
              const outcomeName = outcome.name
              let normalizedName = outcomeName
              if (rawMarketKey === 'player_anytime_td') {
                if (outcomeName === 'Yes') normalizedName = 'Over'
                else if (outcomeName === 'No') normalizedName = 'Under'
              }

              const player = playerOutcomes.get(playerName)!
              if (normalizedName === 'Over') {
                player.over = outcome
              } else if (normalizedName === 'Under') {
                player.under = outcome
              }
            }

            for (const [playerName, outcomes] of playerOutcomes) {
              // Case 1: Curated one-sided markets (allow Over-only)
              if (ONE_SIDED_MARKETS.has(rawMarketKey)) {
                if (!outcomes.over) continue
                let line: number | null = typeof outcomes.over.point === 'number' ? outcomes.over.point : null
                // For anytime TD, provider often omits a line; use synthetic 0
                if (rawMarketKey === 'player_anytime_td' && line === null) line = 0
                if (line === null) continue
                if (typeof outcomes.over.price !== 'number') continue

                await supabase
                  .from('player_props_v2')
                  .upsert({
                    game_id: gameId,
                    player_name: playerName,
                    prop_type: propType,
                    line: line,
                    over_odds: outcomes.over.price,
                    under_odds: outcomes.under ? outcomes.under.price ?? null : null,
                    sportsbook: displayName,
                    is_alternate: isAlternate,
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'game_id,player_name,prop_type,sportsbook,line,is_alternate'
                  })

                propsCreated++
                continue
              }

              // Case 2: Standard two-sided markets
              // Allow partial markets (only Over or only Under) for ALL sports
              if (!outcomes.over || !outcomes.under) {
                const point = (outcomes.over?.point ?? outcomes.under?.point)
                let line: number | null = typeof point === 'number' ? point : null
                if (rawMarketKey === 'player_anytime_td' && line === null) line = 0
                if (line === null) continue
                const overOdds = typeof outcomes.over?.price === 'number' ? outcomes.over!.price : null
                const underOdds = typeof outcomes.under?.price === 'number' ? outcomes.under!.price : null

                await supabase
                  .from('player_props_v2')
                  .upsert({
                    game_id: gameId,
                    player_name: playerName,
                    prop_type: propType,
                    line: line,
                    over_odds: overOdds,
                    under_odds: underOdds,
                    sportsbook: displayName,
                    is_alternate: isAlternate,
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'game_id,player_name,prop_type,sportsbook,line,is_alternate'
                  })

                propsCreated++
                continue
              }
              const overPoint = outcomes.over.point
              const underPoint = outcomes.under.point
              const line = typeof overPoint === 'number' ? overPoint : (typeof underPoint === 'number' ? underPoint : null)
              if (line === null) continue
              if (typeof outcomes.over.price !== 'number' || typeof outcomes.under.price !== 'number') continue

              await supabase
                .from('player_props_v2')
                .upsert({
                  game_id: gameId,
                  player_name: playerName,
                  prop_type: propType,
                  line: line,
                  over_odds: outcomes.over.price,
                  under_odds: outcomes.under.price,
                  sportsbook: displayName,
                  is_alternate: isAlternate,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'game_id,player_name,prop_type,sportsbook,line,is_alternate'
                })

              propsCreated++
            }
          }
        }
        await new Promise(r => setTimeout(r, 100));
      } catch (_) {
        return
      }
    }

    async function worker() {
      while (true) {
        const i = idx++
        if (i >= entries.length) break
        const [eventId, gameId] = entries[i]
        await processOne(eventId, gameId)
      }
    }

    await Promise.all(new Array(concurrency).fill(0).map(() => worker()));
    }

    return NextResponse.json({ 
      success: true, 
      message: `✅ Created ${gamesCreated} games, ${oddsCreated} odds entries, ${propsCreated} player props`,
      details: {
        games: gamesCreated,
        odds: oddsCreated,
        props: propsCreated
      }
    });
  } catch (error) {
    console.error('Data collection error:', error)
    return NextResponse.json({ 
      error: 'Failed to collect data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}