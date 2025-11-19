import { NextRequest, NextResponse } from 'next/server'
import { searchNflPlayer, getNflPlayerGameLogs, type NflGameLog } from '@/lib/balldontlie-nfl'

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

    const logs = await getNflPlayerGameLogs({ playerId: player.id, limit: 50 })
    if (!logs.length) {
      return NextResponse.json({ error: 'No game logs' }, { status: 404 })
    }

    const byWeek = new Map<number, NflRecentGame>()

    for (const log of logs) {
      const week = (log as NflGameLog).week
      if (typeof week !== 'number') continue

      let entry = byWeek.get(week)
      if (!entry) {
        entry = {
          gameDate: `Week ${week}`,
          opponent: 'NFL',
          stats: {},
        }
        byWeek.set(week, entry)
      }

      const statType = (log as NflGameLog).stat_type || 'value'
      const value = (log as NflGameLog).value || 0
      entry.stats[statType] = (entry.stats[statType] || 0) + value
    }

    const weeks = Array.from(byWeek.values()).sort((a, b) => {
      const wa = parseInt(a.gameDate.replace(/\D/g, '') || '0', 10)
      const wb = parseInt(b.gameDate.replace(/\D/g, '') || '0', 10)
      return wb - wa
    })

    const recentGames = weeks.slice(0, last)

    return NextResponse.json({
      playerName: player.full_name,
      team: 'NFL',
      recentGames,
    })
  } catch (error: any) {
    console.error('Error fetching NFL stats:', error)
    return NextResponse.json({ error: 'NFL_STATS_ERROR', message: error?.message }, { status: 500 })
  }
}
