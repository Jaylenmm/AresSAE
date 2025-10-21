import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabase
    .from('cron_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
  return NextResponse.json({ latest: data })
}
