import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameIdsParam = searchParams.get('game_ids') // comma-separated
  const limitParam = Number(searchParams.get('limit') || 40)

  try {
    let gameIds: string[] = []

    if (gameIdsParam) {
      gameIds = gameIdsParam.split(',').map(s => s.trim()).filter(Boolean)
    } else {
      // Fallback: load upcoming scheduled games to scope props
      const { data: games } = await supabaseAdmin
        .from('games')
        .select('id')
        .eq('status', 'scheduled')
        .gte('game_date', new Date().toISOString())
        .order('game_date', { ascending: true })
        .limit(50)
      gameIds = (games || []).map((g: any) => g.id)
    }

    const query = supabaseAdmin
      .from('player_props')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(Math.max(10, Math.min(200, limitParam)))

    const { data, error } = gameIds.length > 0
      ? await query.in('game_id', gameIds)
      : await query

    if (error) {
      return NextResponse.json({ props: [], error: error.message }, { status: 200 })
    }

    return NextResponse.json({ props: data || [] })
  } catch (e: any) {
    return NextResponse.json({ props: [], error: e?.message || 'unknown' }, { status: 200 })
  }
}
