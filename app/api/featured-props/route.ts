import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameIdsParam = searchParams.get('game_ids') // comma-separated
  const limitParam = Number(searchParams.get('limit') || 40)
  const sportParam = searchParams.get('sport') || ''

  try {
    let gameIds: string[] = []

    if (gameIdsParam) {
      gameIds = gameIdsParam.split(',').map(s => s.trim()).filter(Boolean)
    } else {
      // Fallback: load upcoming scheduled games to scope props
      let gamesQuery = supabaseAdmin
        .from('games')
        .select('id')
        .eq('status', 'scheduled')
        .gte('game_date', new Date().toISOString())
        .order('game_date', { ascending: true })
        .limit(50)
      if (sportParam) {
        gamesQuery = gamesQuery.eq('sport', sportParam)
      }
      const { data: games } = await gamesQuery
      gameIds = (games || []).map((g: any) => g.id)
    }

    const query = supabaseAdmin
      .from('player_props')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(Math.max(10, Math.min(200, limitParam)))

    let { data, error } = gameIds.length > 0
      ? await query.in('game_id', gameIds)
      : await query

    if (error) {
      return NextResponse.json({ props: [], error: error.message }, { status: 200 })
    }

    // If nothing found for provided gameIds/upcoming games, try by sport (latest), then global latest
    if ((!data || data.length === 0) && sportParam) {
      const { data: bySport } = await supabaseAdmin
        .from('player_props')
        .select('*')
        .in('game_id', (
          (await supabaseAdmin
            .from('games')
            .select('id')
            .eq('sport', sportParam)
          ).data || []
        ).map((g: any) => g.id))
        .order('updated_at', { ascending: false })
        .limit(Math.max(10, Math.min(200, limitParam)))
      if (bySport && bySport.length > 0) {
        return NextResponse.json({ props: bySport, meta: { fallback: 'by_sport' } })
      }
    }

    if (!data || data.length === 0) {
      const { data: recent } = await supabaseAdmin
        .from('player_props')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(Math.max(10, Math.min(200, limitParam)))
      return NextResponse.json({ props: recent || [], meta: { fallback: 'global_recent' } })
    }

    return NextResponse.json({ props: data })
  } catch (e: any) {
    return NextResponse.json({ props: [], error: e?.message || 'unknown' }, { status: 200 })
  }
}
