import { NextRequest, NextResponse } from 'next/server'
import { searchNflPlayer, getNflPlayerStats, type NflStatRow, type NflPlayer } from '@/lib/balldontlie-nfl'
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
      return NextResponse.json({ error: 'PLAYER_NOT_FOUND' }, { status: 404 })
    }

    const currentYear = new Date().getFullYear()

    const normalizedTarget = player.trim().toLowerCase()
    const exactMatches = players.filter((p) => {
      const full = `${p.first_name} ${p.last_name}`.trim().toLowerCase()
      return full === normalizedTarget
    })

    if (!exactMatches.length) {
      return NextResponse.json(
        { error: 'NO_EXACT_NAME_MATCH', message: 'No exact-name NFL player match found for this query' },
        { status: 404 }
      )
    }

    const resolvedCandidates: { player: NflPlayer; statsRows: NflStatRow[] }[] = []
    for (const p of exactMatches) {
      const rows = await getNflPlayerStats({ playerId: p.id, seasons: [currentYear], limit: 50 })
      if (rows && rows.length > 0) {
        resolvedCandidates.push({ player: p, statsRows: rows })
      }
    }

    if (resolvedCandidates.length === 0) {
      return NextResponse.json(
        { error: 'NO_CURRENT_SEASON_STATS', message: 'No current-season stats found for the exact-name player match' },
        { status: 404 }
      )
    }

    let { statsRows } = resolvedCandidates[0]

    // Extra safety: only accept rows from the current season.
    statsRows = statsRows.filter((row) => row.game?.season === currentYear)

    if (!statsRows.length) {
      return NextResponse.json({ error: 'No stats' }, { status: 404 })
    }

    // Map our internal propType to one or more numeric fields on the stats row
    const propTypeLower = propType.toLowerCase()

    const statSelectors: Array<(row: NflStatRow) => number> = []

    if (propTypeLower.includes('reception') && propTypeLower.includes('yd')) {
      // Receiving yards
      statSelectors.push((row) => Number(row.receiving_yards || 0))
    } else if (propTypeLower.includes('reception')) {
      // Receptions
      statSelectors.push((row) => Number(row.receptions || 0))
    } else if (propTypeLower.includes('rush') && propTypeLower.includes('yd')) {
      statSelectors.push((row) => Number(row.rushing_yards || 0))
    } else if (propTypeLower.includes('rush')) {
      statSelectors.push((row) => Number(row.rushing_attempts || 0))
    } else if (propTypeLower.includes('pass') && propTypeLower.includes('yd')) {
      statSelectors.push((row) => Number(row.passing_yards || 0))
    } else if (propTypeLower.includes('pass') && propTypeLower.includes('comp')) {
      statSelectors.push((row) => Number(row.passing_completions || 0))
    } else if (propTypeLower.includes('pass') && propTypeLower.includes('att')) {
      statSelectors.push((row) => Number(row.passing_attempts || 0))
    } else if (propTypeLower.includes('anytime') && propTypeLower.includes('td')) {
      // Any-time TD: sum rushing + receiving + fumble TDs
      statSelectors.push((row) => Number(row.rushing_touchdowns || 0) + Number(row.receiving_touchdowns || 0) + Number(row.fumbles_touchdowns || 0))
    }

    if (statSelectors.length === 0) {
      return NextResponse.json(
        { error: 'UNSUPPORTED_PROP_TYPE', message: `No stat mapping implemented for propType='${propType}'` },
        { status: 400 }
      )
    }

    const values = statsRows
      .map((row) => {
        const total = statSelectors.reduce((sum, sel) => sum + sel(row), 0)
        return total
      })
      .filter((v): v is number => typeof v === 'number')

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
