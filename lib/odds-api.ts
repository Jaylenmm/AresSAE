const API_KEY = process.env.THE_ODDS_API_KEY
const BASE_URL = 'https://api.the-odds-api.com/v4'

export const SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'MLB': 'baseball_mlb',
  'CFB': 'americanfootball_ncaaf'
}

// Fetch game odds (works normally)
export async function fetchOdds(sportKey: string) {
  try {
    const response = await fetch(
      `${BASE_URL}/sports/${sportKey}/odds?` + new URLSearchParams({
        apiKey: API_KEY!,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american'
      })
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching odds:', error)
    return []
  }
}

// CORRECT way to fetch player props - TWO STEP PROCESS
export async function fetchPlayerProps(sportKey: string) {
  try {
    // STEP 1: Get event IDs (FREE - no credit cost)
    console.log('Step 1: Fetching event IDs...')
    const eventsResponse = await fetch(
      `${BASE_URL}/sports/${sportKey}/events?apiKey=${API_KEY}`
    )
    
    if (!eventsResponse.ok) {
      throw new Error(`Events fetch failed: ${eventsResponse.status}`)
    }
    
    const events = await eventsResponse.json()
    console.log(`Found ${events.length} events`)
    
    if (events.length === 0) return []
    
    // Determine prop markets for this sport
    let propMarkets: string[] = []
    if (sportKey === 'americanfootball_nfl' || sportKey === 'americanfootball_ncaaf') {
      propMarkets = ['player_pass_yds', 'player_pass_tds', 'player_rush_yds']
    } else if (sportKey === 'basketball_nba') {
      propMarkets = ['player_points', 'player_rebounds', 'player_assists']
    } else if (sportKey === 'baseball_mlb') {
      propMarkets = ['batter_home_runs', 'pitcher_strikeouts']
    }
    
    if (propMarkets.length === 0) return []
    
    // STEP 2: Query each event individually for player props
    console.log('Step 2: Fetching player props for each event...')
    const allPropsData = []
    
    // Limit to first 5 events to save credits during testing
    for (const event of events.slice(0, 5)) {
      try {
        console.log(`Fetching props for event: ${event.id}`)
        
        const propsResponse = await fetch(
          `${BASE_URL}/sports/${sportKey}/events/${event.id}/odds?` + new URLSearchParams({
            apiKey: API_KEY!,
            regions: 'us',
            markets: propMarkets.join(','),
            oddsFormat: 'american'
          })
        )
        
        if (!propsResponse.ok) {
          console.error(`Props fetch failed for ${event.id}: ${propsResponse.status}`)
          continue
        }
        
        const propsData = await propsResponse.json()
        
        // Add event metadata to response
        allPropsData.push({
          id: event.id,
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          bookmakers: propsData.bookmakers || []
        })
        
        console.log(`Got ${propsData.bookmakers?.length || 0} bookmakers for event ${event.id}`)
        
        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error fetching props for event ${event.id}:`, error)
        continue
      }
    }
    
    console.log(`Total events with props: ${allPropsData.length}`)
    return allPropsData
    
  } catch (error) {
    console.error('Error in fetchPlayerProps:', error)
    return []
  }
}