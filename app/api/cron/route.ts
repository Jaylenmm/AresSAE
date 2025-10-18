import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    // Collect data for each sport
    for (const sport of ['NFL', 'NBA', 'MLB', 'NCAAF']) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/collect-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sport })
        })
        
        const data = await response.json()
        results[sport] = data.details || data
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.errors.push(`${sport}: ${errorMsg}`)
        results[sport] = { error: errorMsg }
      }
    }

    // Generate featured picks
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