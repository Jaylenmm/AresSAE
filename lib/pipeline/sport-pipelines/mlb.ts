import { fetchOdds, fetchPropsForEvent, getPropMarketsForSportKey, SPORT_KEYS } from '@/lib/odds-api'
import { upsertGame, upsertOdds, upsertPlayerProp } from '@/lib/pipeline/repository'
import { getBookmakerDisplayName } from '@/lib/bookmakers'
import { runPool } from '@/lib/pipeline/concurrency'

export async function runMLB() {
  const sport = 'MLB'
  const sportKey = SPORT_KEYS[sport as keyof typeof SPORT_KEYS]
  let gamesCreated = 0
  let oddsCreated = 0
  let propsCreated = 0

  const oddsData = await fetchOdds(sportKey)
  const gameIdMap = new Map<string, string>()

  for (const event of oddsData) {
    const game = await upsertGame({
      sport,
      espn_game_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      game_date: event.commence_time,
      status: 'scheduled'
    })
    if (!game) continue

    gameIdMap.set(event.id, game.id)
    gamesCreated++

    for (const bookmaker of event.bookmakers || []) {
      const spreads = bookmaker.markets?.find((m: any) => m.key === 'spreads')
      const totals = bookmaker.markets?.find((m: any) => m.key === 'totals')
      const h2h = bookmaker.markets?.find((m: any) => m.key === 'h2h')

      const displayName = getBookmakerDisplayName(bookmaker.key) || bookmaker.title

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

      await upsertOdds(oddsEntry, 'game_id,sportsbook,is_alternate')
      oddsCreated++
    }
  }

  // MLB props per saved event with a small pool
  const markets = getPropMarketsForSportKey(sportKey)
  const entries = Array.from(gameIdMap.entries())
  await runPool(entries, async ([eventId, gameId]) => {
    const resp = await fetchPropsForEvent(sportKey, eventId, markets)
    if (!resp?.ok) return
    const json = await resp.json()
    for (const bookmaker of json.bookmakers || []) {
      const displayName = getBookmakerDisplayName(bookmaker.key) || bookmaker.title
      for (const market of bookmaker.markets || []) {
        const isAlternate = market.key.includes('_alternate')
        const propType = market.key
          .replace('player_', '')
          .replace('batter_', '')
          .replace('pitcher_', '')
          .replace('_alternate', '')
          .replace(/_/g, ' ')
          .split(' ')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')

        const playerOutcomes = new Map<string, { over: any; under: any }>()
        for (const outcome of market.outcomes || []) {
          const playerName = outcome.description
          if (!playerName) continue
          if (!playerOutcomes.has(playerName)) playerOutcomes.set(playerName, { over: null, under: null })
          const pl = playerOutcomes.get(playerName)!
          if (outcome.name === 'Over') pl.over = outcome
          else if (outcome.name === 'Under') pl.under = outcome
        }

        for (const [playerName, outcomes] of playerOutcomes) {
          const line = outcomes.over?.point || outcomes.under?.point
          if (!line) continue
          await upsertPlayerProp({
            game_id: gameId,
            player_name: playerName,
            prop_type: propType,
            line: line,
            over_odds: outcomes.over?.price || null,
            under_odds: outcomes.under?.price || null,
            sportsbook: displayName,
            is_alternate: isAlternate,
            updated_at: new Date().toISOString()
          }, 'game_id,player_name,prop_type,sportsbook,line,is_alternate')
          propsCreated++
        }
      }
    }
  }, 4)

  return { games: gamesCreated, odds: oddsCreated, props: propsCreated }
}
