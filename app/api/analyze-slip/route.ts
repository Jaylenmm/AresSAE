// app/api/analyze-slip/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromImage } from '@/lib/ocr-service'
import { parseBetSlip, ParsedBet } from '@/lib/bet-parser'
import { matchBetsToDatabase, MatchedBet } from '@/lib/bet-matcher'
import { analyzeBet, BetOption } from '@/lib/analysis-engine'
import { supabase } from '@/lib/supabase'
import { transformGameToAnalysisFormat, transformPlayerPropsToAnalysisFormat, createBetOptionFromSelection } from '@/lib/supabase-adapter'
import { Game, OddsData, PlayerProp } from '@/lib/types'
import { parseWithGPTVision, parseWithGPTFromText } from '@/lib/gpt-vision-service'
import { detectSportsbook, parsePrizePicks, parseUnderdog, parseFanDuel } from '@/lib/sportsbook-parsers'

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

    let parsedBets: ParsedBet[] = []
    let ocrText = ''
    let parsingMethod = 'unknown'

    // Check which parsing method will be used
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    const hasGoogleVision = !!process.env.GOOGLE_VISION_API_KEY
    
    console.log('🔍 Parsing Configuration:')
    console.log('  - OpenAI API Key:', hasOpenAI ? '✅ Available (will use GPT-4 Vision)' : '❌ Not set')
    console.log('  - Google Vision API Key:', hasGoogleVision ? '✅ Available (fallback)' : '❌ Not set')

    // Try GPT-4 Vision first (most accurate)
    if (hasOpenAI) {
      try {
        console.log('🚀 Attempting GPT-4 Vision parsing...')
        const gptResult = await parseWithGPTVision(image)
        
        // Convert GPT result to ParsedBet format
        parsedBets = gptResult.bets.map(bet => ({
          type: bet.betType,
          player: bet.player,
          team1: bet.team1,
          team2: bet.team2,
          propType: bet.propType,
          line: bet.line,
          selection: bet.selection,
          odds: bet.odds || -110,
          sportsbook: bet.sportsbook || gptResult.sportsbook,
          rawText: JSON.stringify(bet),
          confidence: bet.confidence
        }))
        
        ocrText = `GPT-4 Vision parsed ${gptResult.totalBets} bets from ${gptResult.sportsbook || 'unknown sportsbook'}`
        parsingMethod = 'gpt-vision'
        console.log('✅ GPT-4 Vision found', parsedBets.length, 'bets')
      } catch (gptError: any) {
        console.log('❌ GPT-4 Vision failed, falling back to OCR:', gptError.message)
      }
    } else {
      console.log('⚠️ Skipping GPT-4 Vision (no OpenAI API key)')
    }

    // Fallback to Google Vision OCR + custom parsing
    if (parsedBets.length === 0) {
      console.log('📸 Using Google Vision OCR + custom parsers...')
      const ocrResult = await extractTextFromImage(image)
      
      if (!ocrResult.text) {
        return NextResponse.json(
          { error: 'No text found in image' },
          { status: 400 }
        )
      }

      ocrText = ocrResult.text
      console.log('OCR Text:', ocrText)
      console.log('OCR Confidence:', ocrResult.confidence)

      // Detect sportsbook
      const sportsbook = detectSportsbook(ocrText)
      console.log('Detected sportsbook:', sportsbook)

      // Use sportsbook-specific parser
      const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean)
      
      if (sportsbook === 'prizepicks') {
        console.log('Using PrizePicks parser...')
        parsedBets = parsePrizePicks(lines)
        parsingMethod = 'prizepicks-parser'
      } else if (sportsbook === 'underdog') {
        console.log('Using Underdog parser...')
        parsedBets = parseUnderdog(lines)
        parsingMethod = 'underdog-parser'
      } else if (sportsbook === 'fanduel') {
        console.log('Using FanDuel parser...')
        parsedBets = parseFanDuel(lines)
        parsingMethod = 'fanduel-parser'
      } else {
        console.log('Using generic parser...')
        parsedBets = parseBetSlip(ocrText)
        parsingMethod = 'generic-parser'
      }
      
      console.log('Parsed bets count:', parsedBets.length)
    }
    
    if (parsedBets.length === 0) {
      return NextResponse.json(
        { 
          error: 'No bets found in image',
          ocrText,
          parsingMethod,
          debug: 'Try using a clearer image or different angle'
        },
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
      ocrText,
      parsingMethod,
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
