import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 600

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const keyParam = url.searchParams.get('key')
  const authorized = (
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    (keyParam && keyParam === process.env.CRON_SECRET)
  )
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  
  const { data: lastRun } = await supabase
    .from('cron_runs')
    .select('run_date, completed_at')
    .eq('run_date', today)
    .eq('status', 'completed')
    .single()

  if (lastRun) {
    return NextResponse.json({ 
      message: 'Already ran today',
      lastRun: lastRun.completed_at,
      skipped: true
    })
  }

  const { data: runRecord } = await supabase
    .from('cron_runs')
    .insert({
      run_date: today,
      started_at: new Date().toISOString(),
      status: 'running'
    })
    .select()
    .single()

  const results: any = {
    NFL: null,
    NBA: null,
    MLB: null,
    NCAAF: null,
    featuredPicks: null,
    errors: []
  }

  try {
    const jobStart = Date.now()
    // Collect data for each sport in parallel with per-sport timeout
    const origin = url.origin
    const sports = ['NFL', 'NBA', 'MLB', 'NCAAF'] as const
    const perSportTimeoutMs = 150000 // 150s per sport

    const sportPromises = sports.map((sport) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), perSportTimeoutMs)
      const startedAt = Date.now()
      return fetch(`${origin}/api/collect-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport }),
        signal: controller.signal
      })
        .then(async (resp) => {
          clearTimeout(timer)
          const elapsedMs = Date.now() - startedAt
          const data = await resp.json().catch(() => ({}))
          results[sport] = data?.details || data || {}
          ;(results as any)[`${sport}_elapsed_ms`] = elapsedMs
        })
        .catch((err) => {
          clearTimeout(timer)
          const elapsedMs = Date.now() - startedAt
          const errorMsg = err instanceof Error ? err.message : String(err)
          results.errors.push(`${sport}: ${errorMsg}`)
          results[sport] = { error: errorMsg }
          ;(results as any)[`${sport}_elapsed_ms`] = elapsedMs
        })
    })

    await Promise.allSettled(sportPromises)

    // Generate featured picks if within overall time budget (soft cap 540s)
    const elapsedSec = Math.round((Date.now() - jobStart) / 1000)
    if (elapsedSec < 540) {
      try {
        const { generateFeaturedPicks } = await import('@/lib/generateFeaturedPicks')
        const pickResults = await generateFeaturedPicks()
        results.featuredPicks = {
          success: pickResults.success,
          generated: pickResults.picksGenerated,
          error: pickResults.error
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.errors.push(`Featured picks: ${errorMsg}`)
      }
    } else {
      results.errors.push('Featured picks skipped due to time budget')
    }

    await supabase
      .from('cron_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        results: results
      })
      .eq('id', runRecord?.id)

    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      results 
    })
  } catch (error) {
    await supabase
      .from('cron_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: String(error)
      })
      .eq('id', runRecord?.id)

    return NextResponse.json({ 
      success: false, 
      error: String(error)
    }, { status: 500 })
  }
}