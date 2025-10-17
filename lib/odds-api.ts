// lib/odds-api.ts

const API_KEY = process.env.THE_ODDS_API_KEY
const BASE_URL = 'https://api.the-odds-api.com/v4'

export const SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'MLB': 'baseball_mlb',
  'NCAAF': 'americanfootball_ncaaf'
}

// Complete market lists from Odds API documentation
// STANDARD + ALTERNATE markets for each sport
const PLAYER_PROP_MARKETS = {
  // NFL/NCAAF - Standard + Alternate markets
  football: [
    // Standard markets
    'player_pass_tds',
    'player_pass_yds',
    'player_pass_completions',
    'player_rush_yds',
    'player_rush_attempts',
    'player_receptions',
    'player_reception_yds',
    'player_anytime_td',
    'player_pass_interceptions',
    // Alternate markets
    'player_pass_tds_alternate',
    'player_pass_yds_alternate',
    'player_pass_completions_alternate',
    'player_rush_yds_alternate',
    'player_rush_attempts_alternate',
    'player_receptions_alternate',
    'player_reception_yds_alternate',
    'player_pass_interceptions_alternate'
  ],
  
  // NBA/NCAAB - Standard + Alternate markets
  basketball: [
    // Standard markets
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_blocks',
    'player_steals',
    'player_points_rebounds_assists',
    'player_points_rebounds',
    'player_points_assists',
    // Alternate markets
    'player_points_alternate',
    'player_rebounds_alternate',
    'player_assists_alternate',
    'player_threes_alternate',
    'player_blocks_alternate',
    'player_steals_alternate',
    'player_points_rebounds_assists_alternate',
    'player_points_rebounds_alternate',
    'player_points_assists_alternate'
  ],
  
  // MLB - Standard + Alternate markets
  baseball: [
    // Standard markets
    'batter_home_runs',
    'batter_hits',
    'batter_total_bases',
    'batter_rbis',
    'batter_runs_scored',
    'batter_strikeouts',
    'pitcher_strikeouts',
    'pitcher_hits_allowed',
    'pitcher_earned_runs',
    // Alternate markets
    'batter_home_runs_alternate',
    'batter_hits_alternate',
    'batter_total_bases_alternate',
    'batter_rbis_alternate',
    'batter_runs_scored_alternate',
    'batter_strikeouts_alternate',
    'pitcher_strikeouts_alternate',
    'pitcher_hits_allowed_alternate',
    'pitcher_earned_runs_alternate'
  ]
}

export async function fetchOdds(sportKey: string) {
  try {
    const response = await fetch(
      `${BASE_URL}/sports/${sportKey}/odds?` + new URLSearchParams({
        apiKey: API_KEY!,
        regions: 'us,us2',
        markets: 'h2h,spreads,totals,alternate_spreads,alternate_totals',
        oddsFormat: 'american'
      })
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const remaining = response.headers.get('x-requests-remaining')
    const lastCost = response.headers.get('x-requests-last')
    
    console.log(`📊 Odds API - Remaining: ${remaining}, Last Cost: ${lastCost}`)
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching odds:', error)
    return []
  }
}

export async function fetchPlayerProps(sportKey: string) {
  try {
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
    
    // Get appropriate markets for this sport (STANDARD + ALTERNATES)
    let propMarkets: string[] = []
    if (sportKey === 'americanfootball_nfl' || sportKey === 'americanfootball_ncaaf') {
      propMarkets = PLAYER_PROP_MARKETS.football
    } else if (sportKey === 'basketball_nba') {
      propMarkets = PLAYER_PROP_MARKETS.basketball
    } else if (sportKey === 'baseball_mlb') {
      propMarkets = PLAYER_PROP_MARKETS.baseball
    }
    
    if (propMarkets.length === 0) {
      console.log('No prop markets defined for this sport')
      return []
    }
    
    console.log(`Step 2: Fetching ${propMarkets.length} prop markets (standard + alternates) for each event...`)
    const allPropsData = []
    
    // Limit to first 10 events to save credits
    const eventsToFetch = events.slice(0, 10)
    
    for (const event of eventsToFetch) {
      try {
        console.log(`Fetching props for event: ${event.id}`)
        
        const propsResponse = await fetch(
          `${BASE_URL}/sports/${sportKey}/events/${event.id}/odds?` + new URLSearchParams({
            apiKey: API_KEY!,
            regions: 'us',
            markets: propMarkets.join(','), // Now includes both standard + alternate markets
            oddsFormat: 'american'
          })
        )
        
        if (!propsResponse.ok) {
          const errorText = await propsResponse.text()
          console.error(`Props fetch failed for ${event.id}: ${propsResponse.status}`)
          console.error(`Error details: ${errorText}`)
          continue
        }
        
        const remaining = propsResponse.headers.get('x-requests-remaining')
        const lastCost = propsResponse.headers.get('x-requests-last')
        console.log(`💰 Event ${event.id} - Remaining: ${remaining}, Cost: ${lastCost}`)
        
        const propsData = await propsResponse.json()
        
        allPropsData.push({
          id: event.id,
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          bookmakers: propsData.bookmakers || []
        })
        
        console.log(`Got ${propsData.bookmakers?.length || 0} bookmakers for event ${event.id}`)
        
        // Rate limiting - 100ms between requests (max 10 req/sec)
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error fetching props for event ${event.id}:`, error)
        continue
      }
    }
    
    console.log(`✅ Total events with props: ${allPropsData.length}`)
    return allPropsData
    
  } catch (error) {
    console.error('Error in fetchPlayerProps:', error)
    return []
  }
}

export async function getAPIUsageStats(): Promise<{
  remaining: number
  used: number
  resetDate: string
}> {
  try {
    const response = await fetch(
      `${BASE_URL}/sports?apiKey=${API_KEY}`
    )
    
    const remaining = parseInt(response.headers.get('x-requests-remaining') || '0')
    const used = parseInt(response.headers.get('x-requests-used') || '0')
    
    const now = new Date()
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    
    return {
      remaining,
      used,
      resetDate: resetDate.toISOString()
    }
  } catch (error) {
    console.error('Error getting API usage:', error)
    return {
      remaining: 0,
      used: 0,
      resetDate: new Date().toISOString()
    }
  }
}