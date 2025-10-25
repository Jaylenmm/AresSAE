import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchOdds, SPORT_KEYS } from '@/lib/odds-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') || 'NFL'

  try {
    // Fetch games from database
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', sport)
      .gte('game_date', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // Show games up to 4 hours after start
      .order('game_date', { ascending: true })
      .limit(sport === 'NCAAF' ? 100 : 20) // More games for NCAAF

    // Fetch odds from v2 and transform to legacy OddsData shape per book (spread/total/moneyline only)
    const gameIds = games?.map((g: any) => g.id) || []
    const oddsMap: Record<string, any[]> = {}
    if (gameIds.length > 0) {
      const { data: v2 } = await supabase
        .from('odds_data_v2')
        .select('*')
        .in('game_id', gameIds)

      const byGameBook: Record<string, Record<string, any>> = {}
      ;(v2 || []).forEach((row: any) => {
        if (!row || !row.market) return
        if (!['spread','total','moneyline'].includes(row.market)) return
        const g = row.game_id as string
        const book = (row.book_name || row.book_key) as string
        if (!byGameBook[g]) byGameBook[g] = {}
        if (!byGameBook[g][book]) {
          byGameBook[g][book] = {
            game_id: g,
            sportsbook: book,
          } as any
        }
        const agg = byGameBook[g][book]
        if (row.market === 'spread') {
          agg.spread_home = row.spread_home
          agg.spread_away = row.spread_away
          agg.spread_home_odds = row.spread_home_odds
          agg.spread_away_odds = row.spread_away_odds
        } else if (row.market === 'total') {
          agg.total = row.line
          agg.over_odds = row.over_odds
          agg.under_odds = row.under_odds
        } else if (row.market === 'moneyline') {
          agg.moneyline_home = row.moneyline_home
          agg.moneyline_away = row.moneyline_away
        }
      })
      Object.entries(byGameBook).forEach(([g, books]) => {
        const booksArray = Object.values(books)
        // Sort by best moneyline odds (highest positive or least negative)
        booksArray.sort((a: any, b: any) => {
          // Prioritize books with moneyline data
          const aML = a.moneyline_away || a.moneyline_home || -Infinity
          const bML = b.moneyline_away || b.moneyline_home || -Infinity
          return bML - aML // Descending order (best odds first)
        })
        oddsMap[g] = booksArray
      })
    }

    return NextResponse.json({ 
      games: games || [], 
      odds: oddsMap 
    })
  } catch (error) {
    console.error('Error fetching games:', error)
    return NextResponse.json({ games: [], odds: {} })
  }
}