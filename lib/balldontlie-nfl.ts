// lib/balldontlie-nfl.ts
// Lightweight client for BallDontLie NFL NFL v1 endpoints used for player prop analysis

const BASE_URL = 'https://api.balldontlie.io/nfl/v1'

function getApiKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY
  if (!key) {
    throw new Error('BALLDONTLIE_API_KEY is not set. Add it to your .env.local to use NFL analysis.')
  }
  return key
}

async function nflFetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const apiKey = getApiKey()
  const url = new URL(`${BASE_URL}${path}`)

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v))
      }
    })
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': apiKey,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`BALLDONTLIE_NFL_ERROR:${res.status}`)
  }

  return res.json() as Promise<T>
}

// Minimal types for NFL stats. We only grab what we actually need.

export interface NflPlayer {
  id: number
  first_name: string
  last_name: string
  position: string | null
  position_abbreviation?: string | null
  team?: {
    id: number
    conference: string
    division: string
    location: string
    name: string
    full_name: string
    abbreviation: string
  }
}

export interface NflStatRow {
  player: NflPlayer
  team: {
    id: number
    conference: string
    division: string
    location: string
    name: string
    full_name: string
    abbreviation: string
  }
  game: {
    id: number
    week: number
    date: string
    season: number
    postseason: boolean
    home_team: { abbreviation: string }
    visitor_team: { abbreviation: string }
  }
  // Plus many numeric stat fields like passing_yards, rushing_yards, etc.
  [key: string]: any
}

export async function searchNflPlayer(query: string): Promise<NflPlayer[]> {
  const data = await nflFetch<{ data: NflPlayer[] }>('/players', { search: query })
  return data.data || []
}

export async function getNflPlayerStats(options: {
  playerId: number
  seasons?: number[]
  limit?: number
}): Promise<NflStatRow[]> {
  const { playerId, seasons, limit = 25 } = options

  const params: Record<string, string | number> = {
    'player_ids[]': playerId,
    per_page: limit,
  }

  if (seasons && seasons.length > 0) {
    // Use the first season for now; can be extended later if needed.
    params['seasons[]'] = seasons[0]
  }

  const data = await nflFetch<{ data: NflStatRow[] }>('/stats', params)
  return data.data || []
}
