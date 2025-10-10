import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchOdds, fetchPlayerProps, SPORT_KEYS } from '@/lib/odds-api'
import { getTop25NCAAFTeams, isTop25Team } from '@/lib/espn-api'

export async function POST(request: Request) {
  const { sport } = await request.json()
  
  if (!sport || !SPORT_KEYS[sport as keyof typeof SPORT_KEYS]) {
    return NextResponse.json({ error: 'Invalid sport' }, { status: 400 })
  }

  try {
    const sportKey = SPORT_KEYS[sport as keyof typeof SPORT_KEYS]

    // Fetch Top 25 NCAAF teams if needed
    let top25Teams: string[] = []
    if (sport === 'NCAAF') {
      console.log('Fetching Top 25 rankings for NCAAF filtering...')
      top25Teams = await getTop25NCAAFTeams()
      console.log(`Found ${top25Teams.length} ranked teams`)
    }

    // Fetch regular odds
    const oddsData = await fetchOdds(sportKey)

    let gamesCreated = 0
    let oddsCreated = 0
    let propsCreated = 0
    let propErrors = 0
    const gameIdMap = new Map<string, string>()

    // Process games and odds
    for (const event of oddsData) {
      // NCAAF filtering BEFORE upsert
      if (sport === 'NCAAF') {
        const homeIsTop25 = isTop25Team(event.home_team, top25Teams)
        const awayIsTop25 = isTop25Team(event.away_team, top25Teams)
        
        if (!homeIsTop25 && !awayIsTop25) {
          console.log(`⏭️  Skipping ${event.away_team} @ ${event.home_team} (not Top 25)`)
          continue
        }
        
        console.log(`✅ Including ${event.away_team} @ ${event.home_team} (Top 25 game)`)
      }

      // FIXED: Remove ignoreDuplicates and use .select() instead of .single()
      const { data: games, error: gameError } = await supabase
        .from('games')
        .upsert({
          sport: sport,
          espn_game_id: event.id,
          home_team: event.home_team,
          away_team: event.away_team,
          game_date: event.commence_time,
          status: 'scheduled'
        }, { 
          onConflict: 'espn_game_id'
        })
        .select()

      if (gameError || !games || games.length === 0) {
        console.error('Error upserting game:', gameError)
        continue
      }

      const game = games[0]
      gameIdMap.set(event.id, game.id)
      gamesCreated++

      // Store odds from each bookmaker
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
    console.log('🔍 Fetching player props...')
    
    // ADDED: If no new games, populate map from existing games
    if (gameIdMap.size === 0) {
      console.log('📋 No new games - loading existing games to map props')
      const { data: existingGames } = await supabase
        .from('games')
        .select('id, espn_game_id')
        .eq('sport', sport)
        .gte('game_date', new Date().toISOString())
      
      if (existingGames) {
        existingGames.forEach(g => {
          if (g.espn_game_id) {
            gameIdMap.set(g.espn_game_id, g.id)
          }
        })
        console.log(`📋 Loaded ${gameIdMap.size} existing games into map`)
      }
    }
    
    const propsData = await fetchPlayerProps(sportKey)
    
    console.log('📦 Props data received:', propsData.length, 'events')
    
    // Process player props
    for (const eventData of propsData) {
      console.log('🎮 Processing event:', eventData.id)
      
      const gameId = gameIdMap.get(eventData.id)
      
      if (!gameId) {
        console.log(`❌ No game found for event ${eventData.id}`)
        console.log('Available game IDs in map:', Array.from(gameIdMap.keys()))
        continue
      }

      console.log(`✅ Found game ID: ${gameId}`)

      if (!eventData.bookmakers || eventData.bookmakers.length === 0) {
        console.log('⚠️ No bookmakers in event data')
        continue
      }

      for (const bookmaker of eventData.bookmakers) {
        console.log(`📚 Processing bookmaker: ${bookmaker.key}`)
        
        if (!bookmaker.markets || bookmaker.markets.length === 0) {
          console.log('⚠️ No markets for this bookmaker')
          continue
        }

        for (const market of bookmaker.markets) {
          console.log(`📊 Processing market: ${market.key}`)
          
          // Clean up prop type name
          const propType = market.key
            .replace('player_', '')
            .replace('batter_', '')
            .replace('pitcher_', '')
            .replace(/_/g, ' ')
            .split(' ')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

          if (!market.outcomes || market.outcomes.length === 0) {
            console.log('⚠️ No outcomes for this market')
            continue
          }

          console.log(`Found ${market.outcomes.length} outcomes in ${market.key}`)

          // Group outcomes by player (description field)
          const playerOutcomes = new Map<string, { over: any, under: any }>()
          
          for (const outcome of market.outcomes) {
            const playerName = outcome.description
            
            if (!playerName) {
              console.log('⚠️ Skipping - no description field')
              continue
            }
            
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

          // Now save each player with BOTH over and under odds
          for (const [playerName, outcomes] of playerOutcomes) {
            try {
              // Use the line from either over or under (they should be the same)
              const line = outcomes.over?.point || outcomes.under?.point
              
              if (!line) {
                console.log(`⚠️ No line found for ${playerName}`)
                continue
              }

              const propData = {
                game_id: gameId,
                player_name: playerName,
                prop_type: propType,
                line: line,
                over_odds: outcomes.over?.price || null,
                under_odds: outcomes.under?.price || null,
                sportsbook: bookmaker.key,
                updated_at: new Date().toISOString()
              }

              console.log('💾 Saving prop with BOTH sides:', propData)

              const { data, error } = await supabase
                .from('player_props')
                .upsert(propData, {
                  onConflict: 'game_id,player_name,prop_type,sportsbook'
                })
                .select()

              if (error) {
                console.error('❌ Error saving prop:', error)
                propErrors++
              } else {
                console.log('✅ Prop saved successfully with both odds')
                propsCreated++
              }
            } catch (propError) {
              console.error('❌ Exception while processing prop:', propError)
              propErrors++
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `✅ Created ${gamesCreated} games, ${oddsCreated} odds entries, ${propsCreated} player props (${propErrors} errors)`,
      details: {
        games: gamesCreated,
        odds: oddsCreated,
        props: propsCreated,
        propErrors: propErrors
      }
    })
  } catch (error) {
    console.error('Data collection error:', error)
    return NextResponse.json({ 
      error: 'Failed to collect data',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}