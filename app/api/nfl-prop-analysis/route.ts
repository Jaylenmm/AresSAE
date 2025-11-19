import { NextRequest, NextResponse } from 'next/server'
import { searchNflPlayer, getNflPlayerGameLogs } from '@/lib/balldontlie-nfl'
import type { NflPropAnalysis } from '@/lib/nfl-prop-analyzer'

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export const maxDuration = 10

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const player = searchParams.get('player') || ''
  const propType = searchParams.get('propType') || ''
  const lineParam = searchParams.get('line')
  const selectionParam = searchParams.get('selection')

  const line = lineParam ? parseFloat(lineParam) : NaN
  const selection = (selectionParam === 'over' || selectionParam === 'under')
    ? selectionParam
    : null

  if (!player || !propType || !selection || !Number.isFinite(line)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  try {
    const players = await searchNflPlayer(player)
    if (!players.length) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const nflPlayer = players[0]

    const logs = await getNflPlayerGameLogs({ playerId: nflPlayer.id, limit: 25 })
    if (!logs.length) {
      return NextResponse.json({ error: 'No game logs' }, { status: 404 })
    }

    const values = logs.map(l => l.value).filter(v => typeof v === 'number')
    if (!values.length) {
      return NextResponse.json({ error: 'No numeric values' }, { status: 404 })
    }

    const seasonMedian = median(values)
    const last5Median = median(values.slice(0, 5))

    const hits = values.filter(v =>
      selection === 'over' ? v > line : v < line
    ).length
    const hitRate = values.length ? (hits / values.length) * 100 : 0

    const reasoning: string[] = []
    const warnings: string[] = []

    const medDiff = seasonMedian - line
    if (selection === 'over') {
      if (medDiff > 0) {
        reasoning.push(`Season median (${seasonMedian.toFixed(1)}) is ${medDiff.toFixed(1)} above the line`)
      } else {
        warnings.push(`Season median (${seasonMedian.toFixed(1)}) is ${Math.abs(medDiff).toFixed(1)} below the line`)
      }
    } else {
      if (medDiff < 0) {
        reasoning.push(`Season median (${seasonMedian.toFixed(1)}) is ${Math.abs(medDiff).toFixed(1)} below the line`)
      } else {
        warnings.push(`Season median (${seasonMedian.toFixed(1)}) is ${Math.abs(medDiff).toFixed(1)} above the line`)
      }
    }

    reasoning.push(`Recent form: last 5 median is ${last5Median.toFixed(1)}`)
    reasoning.push(`Hit rate at this line: ${hitRate.toFixed(0)}% over the last ${values.length} games`)

    let recommendation: NflPropAnalysis['recommendation'] = 'pass'
    let confidence = 50
    let edge = 0

    if (hitRate >= 60 && Math.abs(medDiff) >= 3) {
      recommendation = 'bet'
      confidence = 70
    } else if (hitRate >= 55) {
      recommendation = 'lean_bet'
      confidence = 60
    } else if (hitRate <= 35) {
      recommendation = 'lean_pass'
      confidence = 60
    } else if (hitRate <= 25) {
      recommendation = 'pass'
      confidence = 70
    }

    const payload: NflPropAnalysis = {
      recommendation,
      confidence,
      edge,
      reasoning,
      warnings,
      stats: {
        seasonMedian,
        last5Median,
        hitRate,
      },
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error('Error in NFL prop analysis API:', error)
    return NextResponse.json({ error: 'NFL_STATS_ERROR', message: error?.message }, { status: 500 })
  }
}
