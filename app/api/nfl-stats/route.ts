import { NextRequest, NextResponse } from 'next/server'
import { searchNflPlayer, getNflPlayerStats, type NflStatRow } from '@/lib/balldontlie-nfl'

interface NflRecentGame {
  gameDate: string
  opponent: string
  stats: Record<string, number>
}

export const maxDuration = 10

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerName = searchParams.get('player') || ''
  const lastParam = searchParams.get('last')
  const last = lastParam ? parseInt(lastParam, 10) : 5

  if (!playerName) {
    return NextResponse.json({ error: 'Player name required' }, { status: 400 })
  }

  try {
    const players = await searchNflPlayer(playerName)
    if (!players.length) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const player = players[0]

    const statsRows = await getNflPlayerStats({ playerId: player.id, limit: 50 })
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
      playerName: `${player.first_name} ${player.last_name}`,
      team: player.team?.abbreviation || 'NFL',
      recentGames,
    })
  } catch (error: any) {
    console.error('Error fetching NFL stats:', error)
    return NextResponse.json({ error: 'NFL_STATS_ERROR', message: error?.message }, { status: 500 })
  }
}
