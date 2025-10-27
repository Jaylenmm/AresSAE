// app/api/analyze-slip/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromImage } from '@/lib/ocr-service'
import { parseBetSlip } from '@/lib/bet-parser'
import { matchBetsToDatabase, MatchedBet } from '@/lib/bet-matcher'
import { analyzeBet, BetOption } from '@/lib/analysis-engine'
import { supabase } from '@/lib/supabase'
import { transformGameToAnalysisFormat, transformPlayerPropsToAnalysisFormat, createBetOptionFromSelection } from '@/lib/supabase-adapter'
import { Game, OddsData, PlayerProp } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image } = body

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    // Step 1: Extract text from image
    console.log('Extracting text from image...')
    const ocrResult = await extractTextFromImage(image)
    
    if (!ocrResult.text) {
      return NextResponse.json(
        { error: 'No text found in image' },
        { status: 400 }
      )
    }

    console.log('OCR Text:', ocrResult.text)

    // Step 2: Parse bets from text
    console.log('Parsing bets...')
    const parsedBets = parseBetSlip(ocrResult.text)
    
    if (parsedBets.length === 0) {
      return NextResponse.json(
        { error: 'No bets found in image' },
        { status: 400 }
      )
    }

    console.log('Parsed bets:', parsedBets)

    // Step 3: Match bets to database
    console.log('Matching bets to database...')
    const matchedBets = await matchBetsToDatabase(parsedBets)
    
    console.log('Matched bets:', matchedBets)

    // Step 4: Analyze each bet
    console.log('Analyzing bets...')
    const results = await Promise.all(
      matchedBets.map(async (bet) => {
        if (bet.matchConfidence < 0.5) {
          return {
            bet,
            analysis: null,
            error: 'Low confidence match - please verify bet details'
          }
        }

        try {
          const analysis = await analyzeBetFromMatched(bet)
          return { bet, analysis, error: null }
        } catch (error: any) {
          console.error('Analysis error:', error)
          return {
            bet,
            analysis: null,
            error: error.message || 'Failed to analyze bet'
          }
        }
      })
    )

    // Determine if this is a parlay
    const validBets = results.filter(r => r.analysis !== null)
    const isParlay = validBets.length > 1

    return NextResponse.json({
      success: true,
      ocrText: ocrResult.text,
      betsFound: parsedBets.length,
      betsMatched: matchedBets.filter(b => b.matchConfidence >= 0.5).length,
      isParlay,
      results
    })

  } catch (error: any) {
    console.error('Slip analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze slip' },
      { status: 500 }
    )
  }
}

/**
 * Analyze a matched bet
 */
async function analyzeBetFromMatched(bet: MatchedBet) {
  if (bet.type === 'player_prop' && bet.propId && bet.gameId) {
    // Get game
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', bet.gameId)
      .single()

    if (!game) throw new Error('Game not found')

    // Get all props for this player/game
    const { data: allProps } = await supabase
      .from('player_props_v2')
      .select('*')
      .eq('game_id', bet.gameId)
      .eq('player_name', bet.dbPlayer || bet.player)
      .eq('prop_type', bet.propType)

    if (!allProps || allProps.length === 0) throw new Error('No props found')

    // Transform to bookmaker format
    const bookmakers = transformPlayerPropsToAnalysisFormat(game as Game, allProps as PlayerProp[])

    // Create bet option
    const betOption: BetOption = {
      id: bet.propId,
      betType: 'player_prop',
      market: 'player_prop',
      selection: bet.selection || 'over',
      odds: bet.odds,
      line: bet.line,
      sportsbook: bet.sportsbook || 'unknown',
      playerName: bet.dbPlayer || bet.player,
      eventId: bet.gameId
    }

    return analyzeBet(betOption, bookmakers)

  } else if (bet.gameId) {
    // Get game
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', bet.gameId)
      .single()

    if (!game) throw new Error('Game not found')

    // Get game odds
    const { data: oddsData } = await supabase
      .from('odds_data_v2')
      .select('*')
      .eq('game_id', bet.gameId)

    if (!oddsData || oddsData.length === 0) throw new Error('No odds found')

    // Transform to bookmaker format
    const transformed = transformGameToAnalysisFormat(game as Game, oddsData as OddsData[])

    // Determine selection based on bet type
    let selection: string
    if (bet.type === 'spread') {
      selection = bet.selection || (bet.team1 === bet.dbTeam1 ? 'away' : 'home')
    } else if (bet.type === 'total') {
      selection = bet.selection || 'over'
    } else {
      selection = bet.selection || (bet.team1 === bet.dbTeam1 ? 'away' : 'home')
    }

    // Create bet option
    const betOption: BetOption = {
      id: bet.gameId,
      betType: bet.type === 'moneyline' ? 'h2h' : bet.type === 'spread' ? 'spreads' : 'totals',
      market: bet.type,
      selection,
      odds: bet.odds,
      line: bet.line,
      sportsbook: bet.sportsbook || 'unknown',
      eventId: bet.gameId
    }

    return analyzeBet(betOption, transformed.bookmakers)
  }

  throw new Error('Unable to analyze bet - insufficient data')
}
