import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { runOrchestrator } from '@/lib/pipeline/orchestrator'

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
  
  // Allow up to two successful runs per calendar day. This lets you
  // schedule, for example, a morning and evening data refresh while
  // still protecting against runaway cron loops.
  const { count: completedCount } = await supabase
    .from('cron_runs')
    .select('id', { count: 'exact', head: true })
    .eq('run_date', today)
    .eq('status', 'completed')

  if ((completedCount ?? 0) >= 2) {
    return NextResponse.json({ 
      message: 'Daily run limit reached',
      completedRunsToday: completedCount,
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
    const origin = url.origin
    const orchestrationResults = await runOrchestrator(origin)
    Object.assign(results, orchestrationResults)
    // Persist results after orchestration
    await supabase
      .from('cron_runs')
      .update({ results })
      .eq('id', runRecord?.id)

    // Generate featured picks (no skip)
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