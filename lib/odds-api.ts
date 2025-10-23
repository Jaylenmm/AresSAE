// lib/odds-api.ts

const API_KEY = process.env.THE_ODDS_API_KEY
const BASE_URL = 'https://api.the-odds-api.com/v4'

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries: number = 1,
  baseDelayMs: number = 500,
  timeoutMs: number = 15000
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...(init || {}), signal: controller.signal })
      clearTimeout(id)
      if (res.ok) return res
      // Retry on 429/5xx
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '0')
        const delay = retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * Math.pow(3, attempt)
        if (attempt < retries) await new Promise(r => setTimeout(r, delay))
        else return res
      } else {
        return res
      }
    } catch (err) {
      clearTimeout(id)
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(3, attempt)))
        continue
      }
      throw err
    }
  }
  // Fallback (shouldn't normally reach)
  return await fetch(url, init)
}

export const SPORT_KEYS = {
  'NFL': 'americanfootball_nfl',
  'NBA': 'basketball_nba',
  'MLB': 'baseball_mlb',
  'NCAAF': 'americanfootball_ncaaf'
}

const PLAYER_PROP_MARKETS = {
  football: [
    // Core QB
    'player_pass_yds',
    'player_pass_tds',
    'player_pass_completions',
    'player_pass_attempts',
    'player_pass_interceptions',
    // Core skill
    'player_rush_yds',
    'player_rush_attempts',
    'player_receptions',
    'player_reception_yds',
    'player_rush_tds',
    'player_receiving_tds',
    // Longest props
    'player_longest_reception',
    'player_longest_rush',
    // TDs
    'player_anytime_td',
    // Alternates
    'player_pass_yds_alternate',
    'player_pass_tds_alternate',
    'player_pass_completions_alternate',
    'player_pass_attempts_alternate',
    'player_pass_interceptions_alternate',
    'player_rush_yds_alternate',
    'player_rush_attempts_alternate',
    'player_receptions_alternate',
    'player_reception_yds_alternate'
  ],
  
  basketball: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_blocks',
    'player_steals',
    'player_turnovers',
    'player_points_rebounds_assists',
    'player_points_rebounds',
    'player_points_assists',
    // Alternates/combos
    'player_points_alternate',
    'player_rebounds_alternate',
    'player_assists_alternate',
    'player_threes_alternate',
    'player_blocks_alternate',
    'player_steals_alternate',
    'player_turnovers_alternate',
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
    'pitcher_outs_recorded',
    'pitcher_walks',
    // Alternates
    'batter_home_runs_alternate',
    'batter_hits_alternate',
    'batter_total_bases_alternate',
    'batter_rbis_alternate',
    'batter_runs_scored_alternate',
    'batter_strikeouts_alternate',
    'pitcher_strikeouts_alternate',
    'pitcher_hits_allowed_alternate',
    'pitcher_earned_runs_alternate',
    'pitcher_outs_recorded_alternate',
    'pitcher_walks_alternate'
  ]
}

export function getPropMarketsForSportKey(sportKey: string): string[] {
  if (sportKey === 'americanfootball_nfl' || sportKey === 'americanfootball_ncaaf') {
    return PLAYER_PROP_MARKETS.football
  } else if (sportKey === 'basketball_nba') {
    return PLAYER_PROP_MARKETS.basketball
  } else if (sportKey === 'baseball_mlb') {
    return PLAYER_PROP_MARKETS.baseball
  }
  return []
}

export async function fetchPropsForEvent(
  sportKey: string,
  eventId: string,
  markets: string[]
) {
  return fetchWithRetry(
    `${BASE_URL}/sports/${sportKey}/events/${eventId}/odds?` + new URLSearchParams({
      apiKey: API_KEY!,
      regions: 'us,us2,eu',
      markets: markets.join(','),
      oddsFormat: 'american'
    })
  )
}

// Fetch standard odds (h2h, spreads, totals) - NO alternates
export async function fetchOdds(sportKey: string) {
  const markets = sportKey === 'baseball_mlb' 
    ? 'h2h,spreads,totals'
    : 'h2h,spreads,totals'
  
  const response = await fetchWithRetry(
    `${BASE_URL}/sports/${sportKey}/odds?` + new URLSearchParams({
      apiKey: API_KEY!,
      regions: 'us,us2,eu',
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

  const response = await fetchWithRetry(
    `${BASE_URL}/sports/${sportKey}/events/${eventId}/odds?` + new URLSearchParams({
      apiKey: API_KEY!,
      regions: 'us,us2,eu',
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
  const eventsResponse = await fetchWithRetry(
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
      const propsResponse = await fetchWithRetry(
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