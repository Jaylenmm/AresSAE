// lib/balldontlie-nfl.ts
// Lightweight client for BallDontLie NFL endpoints used for player prop analysis

const BASE_URL = 'https://api.balldontlie.io/v1'

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

// Minimal types for v1. We only grab what we actually need for prop analysis.

export interface NflPlayer {
  id: number
  full_name: string
  position: string | null
  team_id: number | null
}

export interface NflGameLog {
  game_id: number
  player_id: number
  season: number
  week: number
  stat_type: string
  value: number
}

export async function searchNflPlayer(query: string): Promise<NflPlayer[]> {
  const data = await nflFetch<{ data: NflPlayer[] }>('/nfl/players/search', { query })
  return data.data || []
}

export async function getNflPlayerGameLogs(options: {
  playerId: number
  season?: number
  limit?: number
}): Promise<NflGameLog[]> {
  const { playerId, season, limit = 25 } = options
  const data = await nflFetch<{ data: NflGameLog[] }>('/nfl/stats/game_logs', {
    player_id: playerId,
    season,
    per_page: limit,
  })
  return data.data || []
}
