// ===== CREATE: lib/bookmakers.ts =====

/**
 * Bookmaker Classification System
 * Sharp books: Market-making books with professional bettors, slower to move, tighter limits
 * Soft books: Retail-focused, faster to move on public sentiment, higher limits for squares
 */

export interface BookmakerProfile {
  key: string
  displayName: string
  tier: 'sharp' | 'soft'
  regions: string[]
  reliability: number // 1-10 scale for line quality
  description: string
}

export const BOOKMAKER_PROFILES: Record<string, BookmakerProfile> = {
  // SHARP BOOKS - These set the market
  pinnacle: {
    key: 'pinnacle',
    displayName: 'Pinnacle',
    tier: 'sharp',
    regions: ['us', 'eu'],
    reliability: 10,
    description: 'Industry gold standard. Sharpest lines, lowest margins, welcomes winners.'
  },
  circa: {
    key: 'circasports',
    displayName: 'Circa Sports',
    tier: 'sharp',
    regions: ['us'],
    reliability: 9,
    description: 'Vegas sharp book. High limits, respected by professionals.'
  },
  bookmaker: {
    key: 'bookmaker',
    displayName: 'Bookmaker.eu',
    tier: 'sharp',
    regions: ['us'],
    reliability: 8,
    description: 'Sharp book with tight lines and professional clientele.'
  },
  betonlineag: {
    key: 'betonlineag',
    displayName: 'BetOnline',
    tier: 'sharp',
    regions: ['us'],
    reliability: 8,
    description: 'Sharp-leaning book, competitive lines, accepts sharp action.'
  },
  
  // SOFT BOOKS - These follow the market and cater to public
  draftkings: {
    key: 'draftkings',
    displayName: 'DraftKings',
    tier: 'soft',
    regions: ['us', 'us2'],
    reliability: 7,
    description: 'Largest US sportsbook. Public-facing, often has inflated favorites.'
  },
  fanduel: {
    key: 'fanduel',
    displayName: 'FanDuel',
    tier: 'soft',
    regions: ['us', 'us2'],
    reliability: 7,
    description: 'Major retail book. Heavy public betting influence on lines.'
  },
  betmgm: {
    key: 'betmgm',
    displayName: 'BetMGM',
    tier: 'soft',
    regions: ['us', 'us2'],
    reliability: 6,
    description: 'Retail-focused. Lines often shade toward public favorites.'
  },
  caesars: {
    key: 'williamhill_us',
    displayName: 'Caesars',
    tier: 'soft',
    regions: ['us'],
    reliability: 6,
    description: 'Retail book with public-influenced lines.'
  },
  espnbet: {
    key: 'espnbet',
    displayName: 'ESPN BET',
    tier: 'soft',
    regions: ['us'],
    reliability: 6,
    description: 'New entrant. Tends to follow market rather than set it.'
  },
  fanatics: {
    key: 'fanatics',
    displayName: 'Fanatics',
    tier: 'soft',
    regions: ['us'],
    reliability: 5,
    description: 'Newer book, recreational-focused, often has loose lines.'
  },
  betrivers: {
    key: 'betrivers',
    displayName: 'BetRivers',
    tier: 'soft',
    regions: ['us'],
    reliability: 6,
    description: 'Regional retail book with public-leaning lines.'
  },
}

/**
 * Get all bookmakers by tier
 */
export function getBookmakersByTier(tier: 'sharp' | 'soft'): BookmakerProfile[] {
  return Object.values(BOOKMAKER_PROFILES).filter(book => book.tier === tier)
}

/**
 * Check if a bookmaker is sharp
 */
export function isSharpBook(bookmakerId: string): boolean {
  const book = BOOKMAKER_PROFILES[bookmakerId.toLowerCase()]
  return book?.tier === 'sharp' || false
}

/**
 * Get bookmaker reliability score
 */
export function getBookmakerReliability(bookmakerId: string): number {
  const book = BOOKMAKER_PROFILES[bookmakerId.toLowerCase()]
  return book?.reliability || 5
}

/**
 * Get the sharpest available bookmaker from a list
 */
export function getSharpestBook(bookmakerIds: string[]): string | null {
  const sharpBooks = bookmakerIds
    .map(id => BOOKMAKER_PROFILES[id.toLowerCase()])
    .filter(book => book?.tier === 'sharp')
    .sort((a, b) => (b?.reliability || 0) - (a?.reliability || 0))
  
  return sharpBooks[0]?.key || null
}

/**
 * Compare sharp vs soft consensus for a given market
 */
export interface LineComparison {
  sharpConsensus: number
  softConsensus: number
  divergence: number // Absolute difference
  divergencePercent: number // Percentage difference
  sharpBooks: string[]
  softBooks: string[]
  edge: 'sharp' | 'soft' | 'neutral'
}

export function compareSharpVsSoft(
  odds: Array<{ sportsbook: string; line: number }>
): LineComparison | null {
  if (!odds || odds.length === 0) return null

  const sharpLines: number[] = []
  const softLines: number[] = []
  const sharpBooksList: string[] = []
  const softBooksList: string[] = []

  odds.forEach(({ sportsbook, line }) => {
    const bookKey = sportsbook.toLowerCase()
    if (isSharpBook(bookKey)) {
      sharpLines.push(line)
      sharpBooksList.push(sportsbook)
    } else {
      softLines.push(line)
      softBooksList.push(sportsbook)
    }
  })

  if (sharpLines.length === 0 || softLines.length === 0) return null

  // Use median for more robust comparison
  const sharpConsensus = median(sharpLines)
  const softConsensus = median(softLines)
  const divergence = Math.abs(sharpConsensus - softConsensus)
  const divergencePercent = (divergence / Math.abs(sharpConsensus)) * 100

  // Determine where the edge lies
  let edge: 'sharp' | 'soft' | 'neutral' = 'neutral'
  if (divergencePercent > 2) { // 2%+ divergence is significant
    edge = sharpConsensus < softConsensus ? 'sharp' : 'soft'
  }

  return {
    sharpConsensus,
    softConsensus,
    divergence,
    divergencePercent,
    sharpBooks: sharpBooksList,
    softBooks: softBooksList,
    edge
  }
}

/**
 * Helper: Calculate median
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Get bookmaker display name
 */
export function getBookmakerDisplayName(bookmakerId: string): string {
  const book = BOOKMAKER_PROFILES[bookmakerId.toLowerCase()]
  return book?.displayName || bookmakerId
}