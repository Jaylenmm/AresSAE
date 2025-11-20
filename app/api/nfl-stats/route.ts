import { NextRequest, NextResponse } from 'next/server'
import { searchNflPlayer, getNflPlayerStats, type NflStatRow, type NflPlayer } from '@/lib/balldontlie-nfl'

interface NflRecentGame {
  gameDate: string
  opponent: string
  stats: Record<string, number>
}

export const maxDuration = 10

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player') || ''
  const playerIdParam = searchParams.get('playerId')
  const lastParam = searchParams.get('last')
  const last = lastParam ? parseInt(lastParam, 10) : 5

  if (!playerName && !playerIdParam) {
    return NextResponse.json({ error: 'Player name or playerId required' }, { status: 400 })
  }

  try {
    let playerId: number | null = null
    let displayName = playerName
    let displayTeam = 'NFL'

    if (playerIdParam) {
      const parsed = parseInt(playerIdParam, 10)
      if (!Number.isFinite(parsed)) {
        return NextResponse.json({ error: 'Invalid playerId' }, { status: 400 })
      }
      playerId = parsed
    }

    let statsRows: NflStatRow[] = []
    const currentYear = new Date().getFullYear()

    if (playerId !== null) {
      statsRows = await getNflPlayerStats({ playerId, seasons: [currentYear], limit: 50 })
    } else {
      const players = await searchNflPlayer(playerName)
      if (!players.length) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 })
      }

      const player = pickBestNflPlayerMatch(players)
      playerId = player.id
      displayName = `${player.first_name} ${player.last_name}`
      displayTeam = player.team?.abbreviation || 'NFL'

      statsRows = await getNflPlayerStats({ playerId: player.id, seasons: [currentYear], limit: 50 })
    }

    if (!statsRows.length) {
      return NextResponse.json({ error: 'No stats' }, { status: 404 })
    }

    // Sort by game date (newest first)
    const sorted = [...statsRows].sort((a: NflStatRow, b: NflStatRow) => {
      const da = a.game?.date ? new Date(a.game.date).getTime() : 0
      const db = b.game?.date ? new Date(b.game.date).getTime() : 0
      return db - da
    })

    const recentGames: NflRecentGame[] = sorted.slice(0, last).map((row: NflStatRow) => {
      const game = row.game
      const teamAbbr = row.team?.abbreviation

      let opponent = 'NFL'
      if (game && teamAbbr) {
        const home = game.home_team?.abbreviation
        const visitor = game.visitor_team?.abbreviation
        if (home && visitor) {
          opponent = teamAbbr === home ? visitor : home
        }
      }

      const stats: Record<string, number> = {}
      Object.entries(row).forEach(([key, value]) => {
        if (key === 'player' || key === 'team' || key === 'game') return
        if (typeof value === 'number') {
          stats[key] = value
        }
      })

      const gameDate = game?.date || ''

      return {
        gameDate,
        opponent,
        stats,
      }
    })

    return NextResponse.json({
      playerName: displayName,
      team: displayTeam,
      recentGames,
    })
  } catch (error: any) {
    console.error('Error fetching NFL stats:', error)
    return NextResponse.json({ error: 'NFL_STATS_ERROR', message: error?.message }, { status: 500 })
  }
}

function pickBestNflPlayerMatch(players: NflPlayer[]): NflPlayer {
  if (players.length === 1) return players[0]

  const nonSpecialPositions = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'LB', 'CB', 'S', 'DL', 'DE', 'DT'])
  const specialPositions = new Set(['K', 'P', 'PK'])

  const scored = players.map((p) => {
    const pos = (p.position_abbreviation || p.position || '').toUpperCase()
    let score = 0

    if (!pos) score += 5
    if (nonSpecialPositions.has(pos)) score += 20
    if (specialPositions.has(pos)) score -= 20
    if (p.team?.abbreviation) score += 3

    return { player: p, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0].player
}
