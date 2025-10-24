import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { analyzePropsMarket } from '@/lib/prop-market-analysis'

export const maxDuration = 60

/**
 * Show user where ANY book stands in the market
 * No restrictions - just transparency
 * 
 * Query params:
 * - game_id: string
 * - player_name: string
 * - prop_type: string
 * - sportsbook: string (the book user wants to bet at)
 * - line: number (optional)
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const gameId = url.searchParams.get('game_id')
  const playerName = url.searchParams.get('player_name')
  const propType = url.searchParams.get('prop_type')
  const sportsbook = url.searchParams.get('sportsbook')
  const lineParam = url.searchParams.get('line')
  
  if (!gameId || !playerName || !propType || !sportsbook) {
    return NextResponse.json({ 
      error: 'Missing required params: game_id, player_name, prop_type, sportsbook' 
    }, { status: 400 })
  }
  
  try {
    // Fetch all props for this player/game/type
    let query = supabase
      .from('player_props_v2')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_name', playerName)
      .eq('prop_type', propType)
      .eq('is_alternate', false)
    
    if (lineParam) {
      query = query.eq('line', parseFloat(lineParam))
    }
    
    const { data: props, error } = await query
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    if (!props || props.length === 0) {
      return NextResponse.json({ 
        error: 'No props found for this player/game/type' 
      }, { status: 404 })
    }
    
    // Analyze market position
    const analysis = analyzePropsMarket(sportsbook, props)
    
    if (!analysis) {
      return NextResponse.json({ 
        error: `Unable to analyze market for ${sportsbook}. Book may not have this prop or insufficient market data.`,
        available_books: props.map(p => p.sportsbook)
      }, { status: 404 })
    }
    
    return NextResponse.json({
      player_name: playerName,
      prop_type: propType,
      analysis
    })
    
  } catch (err: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: err.message 
    }, { status: 500 })
  }
}
