import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { buildSharpConsensus, calculatePropEdge, SHARP_PROP_BOOKS, SOFT_PROP_BOOKS } from '@/lib/sharp-consensus'

export const maxDuration = 60

/**
 * Analyze a specific player prop by comparing soft books against sharp consensus
 * 
 * Query params:
 * - game_id: string
 * - player_name: string
 * - prop_type: string (e.g., "Pass Yds", "Points")
 * - line: number (optional, uses most common line if not specified)
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const gameId = url.searchParams.get('game_id')
  const playerName = url.searchParams.get('player_name')
  const propType = url.searchParams.get('prop_type')
  const lineParam = url.searchParams.get('line')
  
  if (!gameId || !playerName || !propType) {
    return NextResponse.json({ 
      error: 'Missing required params: game_id, player_name, prop_type' 
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
    
    // Build sharp consensus from sharp-ish books
    const sharpConsensus = buildSharpConsensus(props)
    
    if (!sharpConsensus) {
      return NextResponse.json({ 
        error: 'Unable to build sharp consensus - no sharp books available',
        available_books: props.map(p => p.sportsbook)
      }, { status: 404 })
    }
    
    // Calculate edges for each soft book
    const softBookAnalysis = props
      .filter(p => 
        SOFT_PROP_BOOKS.includes(p.sportsbook.toLowerCase()) &&
        p.line === sharpConsensus.line &&
        p.over_odds !== null &&
        p.under_odds !== null
      )
      .map(prop => {
        const edge = calculatePropEdge(
          prop.over_odds!,
          prop.under_odds!,
          sharpConsensus
        )
        
        return {
          sportsbook: prop.sportsbook,
          line: prop.line,
          over_odds: prop.over_odds,
          under_odds: prop.under_odds,
          over_edge: edge.over_edge,
          under_edge: edge.under_edge,
          over_ev: edge.over_ev,
          under_ev: edge.under_ev,
          recommendation: edge.recommendation
        }
      })
    
    // Also include sharp books for reference
    const sharpBookReference = props
      .filter(p => 
        SHARP_PROP_BOOKS.includes(p.sportsbook.toLowerCase()) &&
        p.line === sharpConsensus.line &&
        p.over_odds !== null &&
        p.under_odds !== null
      )
      .map(prop => ({
        sportsbook: prop.sportsbook,
        line: prop.line,
        over_odds: prop.over_odds,
        under_odds: prop.under_odds
      }))
    
    return NextResponse.json({
      player_name: playerName,
      prop_type: propType,
      sharp_consensus: {
        line: sharpConsensus.line,
        over_odds: sharpConsensus.over_odds,
        under_odds: sharpConsensus.under_odds,
        true_over_probability: sharpConsensus.sharp_over_prob,
        true_under_probability: sharpConsensus.sharp_under_prob,
        confidence: sharpConsensus.confidence,
        books_used: sharpConsensus.books_used
      },
      sharp_books_reference: sharpBookReference,
      soft_book_analysis: softBookAnalysis,
      best_bets: softBookAnalysis
        .filter(b => b.recommendation !== 'none')
        .sort((a, b) => {
          const aEV = a.recommendation === 'over' ? a.over_ev : a.under_ev
          const bEV = b.recommendation === 'over' ? b.over_ev : b.under_ev
          return bEV - aEV
        })
    })
    
  } catch (err: any) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: err.message 
    }, { status: 500 })
  }
}
