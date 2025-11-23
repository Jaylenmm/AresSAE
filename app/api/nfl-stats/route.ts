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
    let displayPosition: string | null = null
    let displayPositionAbbr: string | null = null

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
        return NextResponse.json({ error: 'PLAYER_NOT_FOUND' }, { status: 404 })
      }

      // Resolve to an unambiguous player based on who actually has
      // current-season stats. If multiple players with this name have
      // current-season stats, fail explicitly instead of guessing.
      const resolvedCandidates: { player: NflPlayer; statsRows: NflStatRow[] }[] = []
      for (const p of players) {
        const rows = await getNflPlayerStats({ playerId: p.id, seasons: [currentYear], limit: 50 })
        if (rows && rows.length > 0) {
          resolvedCandidates.push({ player: p, statsRows: rows })
        }
      }

      if (resolvedCandidates.length === 0) {
        return NextResponse.json(
          { error: 'NO_CURRENT_SEASON_STATS', message: 'No current-season stats found for any matching player' },
          { status: 404 }
        )
      }

      if (resolvedCandidates.length > 1) {
        const names = resolvedCandidates
          .map((c) => `${c.player.first_name} ${c.player.last_name}${c.player.team?.abbreviation ? ` (${c.player.team.abbreviation})` : ''}`)
          .join(', ')
        return NextResponse.json(
          {
            error: 'AMBIGUOUS_PLAYER_MATCH',
            message: `Multiple players share this name with current-season stats: ${names}. Please specify team/context.`,
          },
          { status: 400 }
        )
      }

      const resolved = resolvedCandidates[0]
      const player = resolved.player
      statsRows = resolved.statsRows

      playerId = player.id
      displayName = `${player.first_name} ${player.last_name}`
      displayTeam = player.team?.abbreviation || 'NFL'
      displayPosition = player.position || null
      displayPositionAbbr = (player.position_abbreviation as string | undefined) || null
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
      position: displayPosition,
      positionAbbreviation: displayPositionAbbr,
      recentGames,
    })
  } catch (error: any) {
    console.error('Error fetching NFL stats:', error)
    return NextResponse.json({ error: 'NFL_STATS_ERROR', message: error?.message }, { status: 500 })
  }
}
