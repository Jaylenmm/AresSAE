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

    const baseLimit = Math.max(10, Math.min(200, limitParam))
    const v2Query = supabaseAdmin
      .from('player_props_v2')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(baseLimit)

    let { data, error } = gameIds.length > 0
      ? await v2Query.in('game_id', gameIds)
      : await v2Query

    if (error) {
      return NextResponse.json({ props: [], error: error.message }, { status: 200 })
    }

    // If nothing found for provided gameIds/upcoming games, try by sport (latest), then global latest
    if ((!data || data.length === 0) && sportParam) {
      const { data: bySport } = await supabaseAdmin
        .from('player_props_v2')
        .select('*')
        .in('game_id', (
          (await supabaseAdmin
            .from('games')
            .select('id')
            .eq('sport', sportParam)
          ).data || []
        ).map((g: any) => g.id))
        .order('updated_at', { ascending: false })
        .limit(baseLimit)
      if (bySport && bySport.length > 0) {
        return NextResponse.json({ props: bySport, meta: { fallback: 'by_sport' } })
      }
    }

    if (!data || data.length === 0) {
      const { data: recent } = await supabaseAdmin
        .from('player_props_v2')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(baseLimit)
      if (recent && recent.length > 0) {
        return NextResponse.json({ props: recent, meta: { fallback: 'global_recent_v2' } })
      }
      // Final fallback: legacy table
      const legacyQuery = supabaseAdmin
        .from('player_props')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(baseLimit)
      const legacyByGames = gameIds.length > 0 ? await legacyQuery.in('game_id', gameIds) : await legacyQuery
      if (legacyByGames.data && legacyByGames.data.length > 0) {
        return NextResponse.json({ props: legacyByGames.data, meta: { fallback: 'legacy_by_games' } })
      }
      const { data: legacyRecent } = await supabaseAdmin
        .from('player_props')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(baseLimit)
      return NextResponse.json({ props: legacyRecent || [], meta: { fallback: 'legacy_global_recent' } })
    }

    return NextResponse.json({ props: data })
  } catch (e: any) {
    return NextResponse.json({ props: [], error: e?.message || 'unknown' }, { status: 200 })
  }
}
