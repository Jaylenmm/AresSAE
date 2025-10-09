// ===== CREATE: lib/odds-apiTEST.ts =====

const API_KEY = process.env.THE_ODDS_API_KEY
const BASE_URL = 'https://api.the-odds-api.com/v4'

export const SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'MLB': 'baseball_mlb',
  'CFB': 'americanfootball_ncaaf'
}

/**
 * Fetch game odds (unchanged from production)
 */
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
    
    // Track usage
    const remaining = response.headers.get('x-requests-remaining')
    const used = response.headers.get('x-requests-used')
    const lastCost = response.headers.get('x-requests-last')
    
    console.log(`📊 Odds API - Remaining: ${remaining}, Last Cost: ${lastCost}`)
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching odds:', error)
    return []
  }
}

/**
 * CORRECT way to fetch player props - TWO STEP PROCESS
 * (From The Odds API documentation - this is the production-tested version)
 */
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
      propMarkets = ['player_pass_yds', 'player_pass_tds', 'player_rush_yds', 'player_receptions', 'player_reception_yds']
    } else if (sportKey === 'basketball_nba') {
      propMarkets = ['player_points', 'player_rebounds', 'player_assists', 'player_threes']
    } else if (sportKey === 'baseball_mlb') {
      propMarkets = ['batter_home_runs', 'pitcher_strikeouts']
    }
    
    if (propMarkets.length === 0) return []
    
    // STEP 2: Query each event individually for player props
    console.log('Step 2: Fetching player props for each event...')
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
            markets: propMarkets.join(','),
            oddsFormat: 'american'
          })
        )
        
        if (!propsResponse.ok) {
          console.error(`Props fetch failed for ${event.id}: ${propsResponse.status}`)
          continue
        }
        
        // Track usage per event
        const remaining = propsResponse.headers.get('x-requests-remaining')
        const lastCost = propsResponse.headers.get('x-requests-last')
        console.log(`💰 Event ${event.id} - Remaining: ${remaining}, Cost: ${lastCost}`)
        
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
        
        // Rate limiting - wait 100ms between requests (stay under 30 req/sec)
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

/**
 * NEW: Fetch historical odds (EXPENSIVE - 10x cost)
 * Use sparingly and always check cache first
 */
export async function fetchHistoricalOddsRaw(params: {
  sport: string
  eventId?: string
  date: string
  regions: string
  markets: string
}): Promise<any> {
  try {
    console.warn('⚠️ EXPENSIVE: Fetching historical odds (10x cost)')
    
    const url = params.eventId
      ? `${BASE_URL}/historical/sports/${params.sport}/events/${params.eventId}/odds`
      : `${BASE_URL}/historical/sports/${params.sport}/odds`
    
    const queryParams = new URLSearchParams({
      apiKey: API_KEY!,
      date: params.date,
      regions: params.regions,
      markets: params.markets,
      oddsFormat: 'american'
    })
    
    const response = await fetch(`${url}?${queryParams}`)
    
    if (!response.ok) {
      console.error(`Historical API error: ${response.status}`)
      return null
    }
    
    // CRITICAL: Track cost carefully
    const remaining = response.headers.get('x-requests-remaining')
    const used = response.headers.get('x-requests-used')
    const lastCost = response.headers.get('x-requests-last')
    
    console.log(`💰 HISTORICAL API - Remaining: ${remaining}, Last Cost: ${lastCost} (10x normal)`)
    
    // Alert if credits are running low
    if (remaining && parseInt(remaining) < 1000) {
      console.error(`🚨 LOW CREDITS WARNING: Only ${remaining} credits remaining!`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Historical odds fetch failed:', error)
    return null
  }
}

/**
 * Helper: Get current API usage stats
 */
export async function getAPIUsageStats(): Promise<{
  remaining: number
  used: number
  resetDate: string
}> {
  try {
    // Make a minimal request just to get headers
    const response = await fetch(
      `${BASE_URL}/sports?apiKey=${API_KEY}`
    )
    
    const remaining = parseInt(response.headers.get('x-requests-remaining') || '0')
    const used = parseInt(response.headers.get('x-requests-used') || '0')
    
    // Calculate reset date (1st of next month)
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

/**
 * Helper: Check if we should use historical data based on remaining credits
 */
export function shouldUseHistoricalData(remainingCredits: number): boolean {
  // Only use historical if we have > 5000 credits remaining
  // (to preserve credits for regular odds collection)
  if (remainingCredits < 5000) {
    console.warn(`⚠️ Credits too low (${remainingCredits}) - skipping historical data`)
    return false
  }
  return true
}

/**
 * TESTING UTILITIES
 */

/**
 * Test function: Verify player props endpoint is working
 */
export async function testPlayerPropsEndpoint(sportKey: string) {
  console.log(`\n🧪 Testing player props for ${sportKey}...`)
  
  try {
    const props = await fetchPlayerProps(sportKey)
    
    if (props.length > 0) {
      console.log(`✅ Success! Found ${props.length} events with props`)
      console.log(`📊 Sample event:`, props[0].home_team, 'vs', props[0].away_team)
      console.log(`📊 Bookmakers:`, props[0].bookmakers?.length || 0)
      return true
    } else {
      console.log(`⚠️ No props found (may be no games scheduled)`)
      return false
    }
  } catch (error) {
    console.error(`❌ Test failed:`, error)
    return false
  }
}

/**
 * Test function: Verify historical endpoint (EXPENSIVE!)
 */
export async function testHistoricalEndpoint() {
  console.log(`\n🧪 Testing historical odds (THIS WILL COST 10X CREDITS)...`)
  console.log(`⚠️ Are you sure? Comment this out if not testing.`)
  
  // Uncomment to actually test (BE CAREFUL!)
  // const result = await fetchHistoricalOddsRaw({
  //   sport: 'basketball_nba',
  //   date: '2024-10-01T00:00:00Z',
  //   regions: 'us',
  //   markets: 'player_points'
  // })
  
  // console.log(result ? '✅ Historical fetch successful' : '❌ Historical fetch failed')
}

/**
 * USAGE EXAMPLES:
 * 
 * // Regular odds (production)
 * const odds = await fetchOdds('basketball_nba')
 * 
 * // Player props (production)
 * const props = await fetchPlayerProps('basketball_nba')
 * 
 * // Check API usage
 * const usage = await getAPIUsageStats()
 * console.log(`${usage.remaining} credits remaining`)
 * 
 * // Historical odds (expensive!)
 * if (shouldUseHistoricalData(usage.remaining)) {
 *   const historical = await fetchHistoricalOddsRaw({
 *     sport: 'basketball_nba',
 *     date: '2024-10-01T00:00:00Z',
 *     regions: 'us',
 *     markets: 'player_points'
 *   })
 * }
 */