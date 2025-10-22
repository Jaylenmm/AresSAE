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
  'circa': 'Circa'
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
        : SOCIAL_BOOK_KEYS
      const filteredBooks = allBooks.filter((b: any) => activeKeys.includes(b.key))
      for (const bookmaker of filteredBooks) {
        const spreads = bookmaker.markets?.find((m: any) => m.key === 'spreads')
        const totals = bookmaker.markets?.find((m: any) => m.key === 'totals')
        const h2h = bookmaker.markets?.find((m: any) => m.key === 'h2h')

        const displayName = BOOKMAKER_NAMES[bookmaker.key] || bookmaker.title

        const oddsEntry: any = {
          game_id: game.id,
          sportsbook: displayName,
          updated_at: new Date().toISOString(),
          is_alternate: false
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

        const hasAny = (
          oddsEntry.spread_home !== undefined ||
          oddsEntry.spread_away !== undefined ||
          oddsEntry.spread_home_odds !== undefined ||
          oddsEntry.spread_away_odds !== undefined ||
          oddsEntry.total !== undefined ||
          oddsEntry.over_odds !== undefined ||
          oddsEntry.under_odds !== undefined ||
          oddsEntry.moneyline_home !== undefined ||
          oddsEntry.moneyline_away !== undefined
        )
        if (!hasAny) {
          continue
        }

        // Ensure idempotency without ON CONFLICT by delete-then-insert for baseline rows
        const { error: delErr } = await supabase
          .from('odds_data')
          .delete()
          .eq('game_id', game.id)
          .eq('sportsbook', displayName)
          .eq('is_alternate', false)
        if (delErr) {
          console.error('Supabase delete baseline odds_data error:', {
            message: delErr.message,
            details: (delErr as any).details,
            hint: (delErr as any).hint,
            code: (delErr as any).code,
          })
          // proceed to try insert anyway
        }

        const { error: insErr } = await supabase
          .from('odds_data')
          .insert(oddsEntry)
        if (insErr) {
          console.error('Supabase insert baseline odds_data error:', {
            message: insErr.message,
            details: (insErr as any).details,
            hint: (insErr as any).hint,
            code: (insErr as any).code,
          })
          continue
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
              const { error: altErr } = await supabase
                .from('odds_data')
                .insert({
                  game_id: game.id,
                  sportsbook: displayName,
                  spread_home: home.point,
                  spread_away: away.point,
                  spread_home_odds: home.price,
                  spread_away_odds: away.price,
                  is_alternate: true,
                  updated_at: new Date().toISOString()
                })
              if (altErr) {
                // Ignore duplicate violations from unique indexes; log others
                if ((altErr as any).code !== '23505') {
                  console.error('Supabase insert alt spread error:', {
                    message: altErr.message,
                    details: (altErr as any).details,
                    hint: (altErr as any).hint,
                    code: (altErr as any).code,
                  })
                }
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
              const { error: altTotErr } = await supabase
                .from('odds_data')
                .insert({
                  game_id: game.id,
                  sportsbook: displayName,
                  total: over.point,
                  over_odds: over.price,
                  under_odds: under.price,
                  is_alternate: true,
                  updated_at: new Date().toISOString()
                })
              if (altTotErr) {
                if ((altTotErr as any).code !== '23505') {
                  console.error('Supabase insert alt total error:', {
                    message: altTotErr.message,
                    details: (altTotErr as any).details,
                    hint: (altTotErr as any).hint,
                    code: (altTotErr as any).code,
                  })
                }
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
    let idx = 0
    const concurrency = 3

    async function processOne(eventId: string, gameId: string) {
      try {
        const resp = await fetchPropsForEvent(sportKey, eventId, propMarkets)
        if (!resp.ok) return
        const json = await resp.json()

        const activeKeys = Array.isArray(bookmakerKeys) && bookmakerKeys.length > 0
          ? bookmakerKeys
          : SOCIAL_BOOK_KEYS
        for (const bookmaker of (json.bookmakers || []).filter((b: any) => activeKeys.includes(b.key))) {
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