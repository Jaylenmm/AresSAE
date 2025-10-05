import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchOdds, SPORT_KEYS } from '@/lib/odds-api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') || 'NFL'

  try {
    // Fetch games from database
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', sport)
      .gte('game_date', new Date().toISOString())
      .order('game_date', { ascending: true })
      .limit(20)

    // Fetch odds for these games
    const { data: oddsData } = await supabase
      .from('odds_data')
      .select('*')
      .in('game_id', games?.map((g: any) => g.id) || [])

    // Group odds by game_id
    const oddsMap: Record<string, any[]> = {}
    oddsData?.forEach((odd: any )=> {
      if (!oddsMap[odd.game_id]) oddsMap[odd.game_id] = []
      oddsMap[odd.game_id].push(odd)
    })

    return NextResponse.json({ 
      games: games || [], 
      odds: oddsMap 
    })
  } catch (error) {
    console.error('Error fetching games:', error)
    return NextResponse.json({ games: [], odds: {} })
  }
}