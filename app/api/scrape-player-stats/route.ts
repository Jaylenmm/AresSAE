// app/api/scrape-player-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function GET(request: NextRequest) {
  console.log('=== SCRAPE PLAYER STATS ROUTE HIT ===')
  
  try {
    const searchParams = request.nextUrl.searchParams
    const playerName = searchParams.get('player')
    const sport = searchParams.get('sport') || 'football'

    console.log(`Player: ${playerName}, Sport: ${sport}`)

    if (!playerName) {
      return NextResponse.json({ error: 'Player name required' }, { status: 400 })
    }

    console.log(`Scraping stats for ${playerName}`)

    // Search ESPN for the player
    const searchQuery = encodeURIComponent(playerName)
    const searchUrl = `https://www.espn.com/search/_/q/${searchQuery}`
    
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!searchRes.ok) {
      console.error(`ESPN search failed with status: ${searchRes.status}`)
      return NextResponse.json({ error: 'Search failed', status: searchRes.status }, { status: 404 })
    }

    const searchHtml = await searchRes.text()
    const $ = cheerio.load(searchHtml)

    // Find player profile link
    let playerUrl = ''
    $('a').each((i, el) => {
      const href = $(el).attr('href')
      if (href && href.includes('/player/') && href.includes(sport === 'football' ? 'nfl' : sport === 'basketball' ? 'nba' : 'mlb')) {
        playerUrl = href.startsWith('http') ? href : `https://www.espn.com${href}`
        return false // break
      }
    })

    if (!playerUrl) {
      console.error(`Could not find player profile link for: ${playerName}`)
      console.log(`Searched ${$('a').length} links, none matched player profile pattern`)
      return NextResponse.json({ error: 'Player not found in search results' }, { status: 404 })
    }

    console.log(`Found player URL: ${playerUrl}`)

    // Fetch player page
    const playerRes = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!playerRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch player page' }, { status: 500 })
    }

    const playerHtml = await playerRes.text()
    const $player = cheerio.load(playerHtml)

    // Extract player ID from URL
    const playerId = playerUrl.match(/\/player\/[^\/]+\/(\d+)/)?.[1]

    // Scrape recent game stats from game log table
    const recentGames: any[] = []
    
    // Look for the stats table - ESPN uses specific classes
    const statsTable = $player('table.Table').first()
    const headerRow = statsTable.find('thead tr').first()
    const headers: string[] = []
    
    // Get column headers
    headerRow.find('th').each((i: any, th: any) => {
      const headerText = $player(th).text().trim().toLowerCase()
      if (headerText) {
        headers.push(headerText)
      }
    })
    
    console.log(`Found ${headers.length} stat columns:`, headers)
    
    // Get last 5 game rows
    statsTable.find('tbody tr').slice(0, 5).each((i: any, row: any) => {
      const cells = $player(row).find('td')
      const gameStats: any = {}
      let opponent = ''
      let result = ''
      
      cells.each((j: any, cell: any) => {
        const cellText = $player(cell).text().trim()
        const header = headers[j] || `col_${j}`
        
        // Try to identify opponent
        if (header.includes('opp') || j === 1) {
          opponent = cellText.replace(/[@vs]/g, '').trim()
        }
        
        // Try to identify result (W/L)
        if (header.includes('result') || (cellText === 'W' || cellText === 'L')) {
          result = cellText
        }
        
        // Parse numeric stats
        const numValue = parseFloat(cellText)
        if (!isNaN(numValue)) {
          gameStats[header] = numValue
        }
      })
      
      if (Object.keys(gameStats).length > 0) {
        recentGames.push({
          date: new Date().toISOString(),
          opponent: opponent || 'Unknown',
          stats: gameStats,
          result: result || 'N/A'
        })
      }
    })

    // Scrape season averages from player header
    const seasonAverages: any = {}
    
    // ESPN shows key stats in the player header
    $player('.PlayerHeader__StatValue, .StatBlockInner__Value').each((i: any, el: any) => {
      const value = $player(el).text().trim()
      const label = $player(el).parent().find('.StatBlockInner__Label, .PlayerHeader__StatLabel').text().trim().toLowerCase()
      
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && label) {
        seasonAverages[label] = numValue
      }
    })

    console.log(`Scraped ${recentGames.length} games for ${playerName}`)

    return NextResponse.json({
      playerId: playerId || 'unknown',
      playerName: playerName,
      recentGames: recentGames,
      seasonAverages: seasonAverages
    })

  } catch (error: any) {
    console.error('Scraping error:', error.message)
    return NextResponse.json(
      { error: 'Scraping failed', details: error.message },
      { status: 500 }
    )
  }
}
