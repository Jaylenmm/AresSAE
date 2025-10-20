// lib/odds-api.ts

const API_KEY = process.env.THE_ODDS_API_KEY
const BASE_URL = 'https://api.the-odds-api.com/v4'

export const SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'MLB': 'baseball_mlb',
  'NCAAF': 'americanfootball_ncaaf'
}

const PLAYER_PROP_MARKETS = {
  football: [
    'player_pass_tds',
    'player_pass_yds',
    'player_pass_completions',
    'player_rush_yds',
    'player_rush_attempts',
    'player_receptions',
    'player_reception_yds',
    'player_anytime_td',
    'player_pass_interceptions',
    'player_pass_tds_alternate',
    'player_pass_yds_alternate',
    'player_pass_completions_alternate',
    'player_rush_yds_alternate',
    'player_rush_attempts_alternate',
    'player_receptions_alternate',
    'player_reception_yds_alternate',
    'player_pass_interceptions_alternate'
  ],
  
  basketball: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_blocks',
    'player_steals',
    'player_points_rebounds_assists',
    'player_points_rebounds',
    'player_points_assists',
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
  
  baseball: [
    'batter_home_runs',
    'batter_hits',
    'batter_total_bases',
    'batter_rbis',
    'batter_runs_scored',
    'batter_strikeouts',
    'pitcher_strikeouts',
    'pitcher_hits_allowed',
    'pitcher_earned_runs',
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

// Fetch standard odds (h2h, spreads, totals) - NO alternates
export async function fetchOdds(sportKey: string) {
  const markets = sportKey === 'baseball_mlb' 
    ? 'h2h,spreads,totals'
    : 'h2h,spreads,totals'
  
  const response = await fetch(
    `${BASE_URL}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey: API_KEY!,
      regions: 'us,us2',
      markets: markets,
      oddsFormat: 'american'
    })
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Odds API error ${response.status}: ${errorText}`)
  }
  
  return await response.json()
}

// Fetch alternate markets per event (alternate_spreads, alternate_totals)
export async function fetchAlternateOdds(sportKey: string, eventId: string) {
  // MLB doesn't support alternate markets
  if (sportKey === 'baseball_mlb') {
    return { bookmakers: [] }
  }

  const response = await fetch(
    `${BASE_URL}/sports/${sportKey}/events/${eventId}/odds?` + new URLSearchParams({
      apiKey: API_KEY!,
      regions: 'us',
      markets: 'alternate_spreads,alternate_totals',
      oddsFormat: 'american'
    })
  )
  
  if (!response.ok) {
    return { bookmakers: [] }
  }
  
  return await response.json()
}

export async function fetchPlayerProps(sportKey: string) {
  const eventsResponse = await fetch(
    `${BASE_URL}/sports/${sportKey}/events?apiKey=${API_KEY}`
  )
  
  if (!eventsResponse.ok) {
    throw new Error(`Events fetch failed: ${eventsResponse.status}`)
  }
  
  const events = await eventsResponse.json()
  if (events.length === 0) return []
  
  let propMarkets: string[] = []
  if (sportKey === 'americanfootball_nfl' || sportKey === 'americanfootball_ncaaf') {
    propMarkets = PLAYER_PROP_MARKETS.football
  } else if (sportKey === 'basketball_nba') {
    propMarkets = PLAYER_PROP_MARKETS.basketball
  } else if (sportKey === 'baseball_mlb') {
    propMarkets = PLAYER_PROP_MARKETS.baseball
  }
  
  if (propMarkets.length === 0) return []
  
  const allPropsData = []
  const eventsToFetch = events
  
  for (const event of eventsToFetch) {
    try {
      const propsResponse = await fetch(
        `${BASE_URL}/sports/${sportKey}/events/${event.id}/odds?` + new URLSearchParams({
          apiKey: API_KEY!,
          regions: 'us,us2,eu',
          markets: propMarkets.join(','),
          oddsFormat: 'american'
        })
      )
    
      if (!propsResponse.ok) continue
      
      const propsData = await propsResponse.json()
      
      allPropsData.push({
        id: event.id,
        home_team: event.home_team,
        away_team: event.away_team,
        commence_time: event.commence_time,
        bookmakers: propsData.bookmakers || []
      })
      
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      continue
    }
  }
  
  return allPropsData
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
    return {
      remaining: 0,
      used: 0,
      resetDate: new Date().toISOString()
    }
  }
}