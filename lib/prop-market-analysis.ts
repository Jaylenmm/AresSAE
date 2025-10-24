// lib/prop-market-analysis.ts
// Show users where ANY book stands relative to the entire market

interface PropOdds {
  sportsbook: string
  line: number
  over_odds: number | null
  under_odds: number | null
}

interface MarketPosition {
  percentile: number  // 0-100, where this book ranks (100 = best odds)
  better_than: string[]  // Books offering worse odds
  worse_than: string[]   // Books offering better odds
  market_average_odds: number
  market_best_odds: number
  market_worst_odds: number
}

interface PropAnalysis {
  selected_book: {
    sportsbook: string
    line: number
    over_odds: number
    under_odds: number
  }
  over_position: MarketPosition
  under_position: MarketPosition
  market_efficiency: {
    spread: number  // Difference between best and worst odds
    is_efficient: boolean  // True if spread < 20 (tight market)
    sharpest_books_agree: boolean  // True if top books within 5 points
  }
  all_books: Array<{
    sportsbook: string
    over_odds: number
    under_odds: number
    is_sharp: boolean
  }>
  recommendation: {
    message: string
    confidence: 'high' | 'medium' | 'low'
    alternative_book?: string  // Suggest better book if available
  }
}

const SHARP_BOOKS = ['fanduel', 'betonlineag', 'lowvig', 'draftkings']

function oddsToProb(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100)
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
  }
}

function calculateMarketPosition(
  selectedOdds: number,
  allOdds: Array<{ sportsbook: string, odds: number }>
): MarketPosition {
  // Sort odds from best (highest payout) to worst
  const sorted = [...allOdds].sort((a, b) => {
    // For positive odds, higher is better
    // For negative odds, closer to 0 is better (e.g., -105 > -120)
    const aValue = a.odds > 0 ? a.odds : 100 + a.odds
    const bValue = b.odds > 0 ? b.odds : 100 + b.odds
    return bValue - aValue
  })
  
  const selectedRank = sorted.findIndex(b => b.odds === selectedOdds)
  const percentile = ((sorted.length - selectedRank) / sorted.length) * 100
  
  const betterThan = sorted.slice(selectedRank + 1).map(b => b.sportsbook)
  const worseThan = sorted.slice(0, selectedRank).map(b => b.sportsbook)
  
  const avgOdds = Math.round(
    sorted.reduce((sum, b) => sum + b.odds, 0) / sorted.length
  )
  
  return {
    percentile: Math.round(percentile),
    better_than: betterThan,
    worse_than: worseThan,
    market_average_odds: avgOdds,
    market_best_odds: sorted[0].odds,
    market_worst_odds: sorted[sorted.length - 1].odds
  }
}

/**
 * Analyze ANY book's position in the market
 * Shows user exactly where they stand without restricting choice
 */
export function analyzePropsMarket(
  selectedBook: string,
  props: PropOdds[]
): PropAnalysis | null {
  const selected = props.find(
    p => p.sportsbook.toLowerCase() === selectedBook.toLowerCase() &&
         p.over_odds !== null &&
         p.under_odds !== null
  )
  
  if (!selected || selected.over_odds === null || selected.under_odds === null) {
    return null
  }
  
  // Get all books at the same line
  const sameLine = props.filter(
    p => p.line === selected.line &&
         p.over_odds !== null &&
         p.under_odds !== null
  )
  
  if (sameLine.length < 2) {
    return null  // Need at least 2 books for comparison
  }
  
  // Calculate market position for Over
  const overPosition = calculateMarketPosition(
    selected.over_odds,
    sameLine.map(p => ({ sportsbook: p.sportsbook, odds: p.over_odds! }))
  )
  
  // Calculate market position for Under
  const underPosition = calculateMarketPosition(
    selected.under_odds,
    sameLine.map(p => ({ sportsbook: p.sportsbook, odds: p.under_odds! }))
  )
  
  // Market efficiency analysis
  const overSpread = overPosition.market_best_odds - overPosition.market_worst_odds
  const underSpread = underPosition.market_best_odds - underPosition.market_worst_odds
  const avgSpread = (Math.abs(overSpread) + Math.abs(underSpread)) / 2
  
  const isEfficient = avgSpread < 20
  
  // Check if sharp books agree (within 5 points)
  const sharpBooks = sameLine.filter(p => 
    SHARP_BOOKS.includes(p.sportsbook.toLowerCase())
  )
  const sharpOverOdds = sharpBooks.map(p => p.over_odds!)
  const sharpRange = sharpOverOdds.length > 1
    ? Math.max(...sharpOverOdds) - Math.min(...sharpOverOdds)
    : 0
  const sharpestAgree = sharpRange < 5
  
  // Generate recommendation
  let message = ''
  let confidence: 'high' | 'medium' | 'low' = 'medium'
  let alternativeBook: string | undefined
  
  const avgPercentile = (overPosition.percentile + underPosition.percentile) / 2
  
  if (avgPercentile >= 80) {
    message = `${selected.sportsbook} offers top-tier odds (${Math.round(avgPercentile)}th percentile). Great choice!`
    confidence = 'high'
  } else if (avgPercentile >= 50) {
    message = `${selected.sportsbook} offers middle-of-the-pack odds (${Math.round(avgPercentile)}th percentile). Consider shopping around.`
    confidence = 'medium'
    
    // Suggest best book
    const bestOverBook = sameLine.find(p => p.over_odds === overPosition.market_best_odds)
    if (bestOverBook && bestOverBook.sportsbook !== selected.sportsbook) {
      alternativeBook = bestOverBook.sportsbook
    }
  } else {
    message = `${selected.sportsbook} offers below-average odds (${Math.round(avgPercentile)}th percentile). You can do better.`
    confidence = 'low'
    
    // Suggest best book
    const bestOverBook = sameLine.find(p => p.over_odds === overPosition.market_best_odds)
    if (bestOverBook) {
      alternativeBook = bestOverBook.sportsbook
    }
  }
  
  if (!isEfficient) {
    message += ' ⚠️ Market is inefficient - significant odds variation detected.'
  }
  
  if (sharpestAgree && isEfficient) {
    message += ' ✓ Sharp books agree - this is a well-priced market.'
  }
  
  return {
    selected_book: {
      sportsbook: selected.sportsbook,
      line: selected.line,
      over_odds: selected.over_odds,
      under_odds: selected.under_odds
    },
    over_position: overPosition,
    under_position: underPosition,
    market_efficiency: {
      spread: avgSpread,
      is_efficient: isEfficient,
      sharpest_books_agree: sharpestAgree
    },
    all_books: sameLine.map(p => ({
      sportsbook: p.sportsbook,
      over_odds: p.over_odds!,
      under_odds: p.under_odds!,
      is_sharp: SHARP_BOOKS.includes(p.sportsbook.toLowerCase())
    })).sort((a, b) => {
      // Sort by Over odds (best first)
      const aValue = a.over_odds > 0 ? a.over_odds : 100 + a.over_odds
      const bValue = b.over_odds > 0 ? b.over_odds : 100 + b.over_odds
      return bValue - aValue
    }),
    recommendation: {
      message,
      confidence,
      alternative_book: alternativeBook
    }
  }
}
