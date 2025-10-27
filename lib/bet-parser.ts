// lib/bet-parser.ts
// Parse OCR text into structured bet data

export interface ParsedBet {
  type: 'spread' | 'moneyline' | 'total' | 'player_prop'
  sport?: string
  team1?: string
  team2?: string
  player?: string
  propType?: string
  line?: number
  selection?: string // 'over', 'under', 'home', 'away'
  odds: number
  sportsbook?: string
  rawText: string
  confidence: number
}

const SPORTS_KEYWORDS = {
  NFL: ['nfl', 'football'],
  NBA: ['nba', 'basketball'],
  MLB: ['mlb', 'baseball'],
  NHL: ['nhl', 'hockey'],
  NCAAF: ['ncaaf', 'college football', 'cfb'],
  NCAAB: ['ncaab', 'college basketball', 'cbb']
}

const BET_TYPE_KEYWORDS = {
  spread: ['spread', 'pts', 'point spread', 'handicap'],
  moneyline: ['moneyline', 'ml', 'money line', 'to win'],
  total: ['total', 'over', 'under', 'o/u', 'over/under'],
  player_prop: ['player', 'prop', 'pts', 'yds', 'yards', 'assists', 'rebounds', 'receptions']
}

const PROP_TYPE_KEYWORDS = {
  'player_pass_yds': ['passing yards', 'pass yds', 'passing'],
  'player_rush_yds': ['rushing yards', 'rush yds', 'rushing'],
  'player_reception_yds': ['receiving yards', 'rec yds', 'receiving'],
  'player_points': ['points', 'pts'],
  'player_rebounds': ['rebounds', 'reb'],
  'player_assists': ['assists', 'ast'],
  'player_threes': ['3-pointers', '3pt', 'threes']
}

const SPORTSBOOK_KEYWORDS = [
  'fanduel', 'draftkings', 'betmgm', 'caesars', 'espnbet',
  'pinnacle', 'betonline', 'bovada', 'mybookie', 'bet365'
]

/**
 * Parse OCR text into structured bets
 */
export function parseBetSlip(ocrText: string): ParsedBet[] {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean)
  const bets: ParsedBet[] = []
  
  let currentBet: Partial<ParsedBet> | null = null
  let sportsbook: string | undefined
  
  // First pass: identify sportsbook
  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    for (const book of SPORTSBOOK_KEYWORDS) {
      if (lowerLine.includes(book)) {
        sportsbook = book
        break
      }
    }
  }

  // Second pass: parse bets
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()

    // Try to extract odds
    const oddsMatch = line.match(/([+-]\d{3,})/g)
    if (oddsMatch) {
      const odds = parseInt(oddsMatch[0])
      
      // Look for team names or player names in surrounding lines
      const contextLines = [
        lines[i - 2],
        lines[i - 1],
        line,
        lines[i + 1],
        lines[i + 2]
      ].filter(Boolean).join(' ')

      const bet = parseBetFromContext(contextLines, odds, sportsbook)
      if (bet) {
        bets.push(bet)
      }
    }
  }

  return bets
}

function parseBetFromContext(
  context: string,
  odds: number,
  sportsbook?: string
): ParsedBet | null {
  const lowerContext = context.toLowerCase()
  
  // Determine bet type
  let betType: ParsedBet['type'] = 'moneyline'
  
  if (lowerContext.match(/\b(over|under|o\/u|total)\b/)) {
    betType = 'total'
  } else if (lowerContext.match(/\b(spread|pts|point)\b/)) {
    betType = 'spread'
  } else if (lowerContext.match(/\b(player|prop|yards|yds|points|pts|assists|rebounds)\b/)) {
    betType = 'player_prop'
  }

  // Extract line value
  const lineMatch = context.match(/([+-]?\d+\.?\d*)\s*(pts|yds|yards)?/i)
  const line = lineMatch ? parseFloat(lineMatch[1]) : undefined

  // Extract selection
  let selection: string | undefined
  if (lowerContext.includes('over')) selection = 'over'
  if (lowerContext.includes('under')) selection = 'under'
  
  // Try to extract team/player names
  const words = context.split(/\s+/)
  let team1: string | undefined
  let team2: string | undefined
  let player: string | undefined

  // Look for capitalized words (likely names)
  const capitalizedWords = words.filter(w => /^[A-Z]/.test(w))
  
  if (betType === 'player_prop' && capitalizedWords.length >= 2) {
    player = capitalizedWords.slice(0, 2).join(' ')
  } else if (capitalizedWords.length >= 2) {
    team1 = capitalizedWords[0]
    team2 = capitalizedWords[1]
  }

  // Determine prop type for player props
  let propType: string | undefined
  if (betType === 'player_prop') {
    for (const [type, keywords] of Object.entries(PROP_TYPE_KEYWORDS)) {
      if (keywords.some(kw => lowerContext.includes(kw))) {
        propType = type
        break
      }
    }
  }

  return {
    type: betType,
    team1,
    team2,
    player,
    propType,
    line,
    selection,
    odds,
    sportsbook,
    rawText: context,
    confidence: 0.7 // Base confidence, will be adjusted by matcher
  }
}

/**
 * Clean and normalize team/player names
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract numeric value from text
 */
export function extractNumber(text: string): number | null {
  const match = text.match(/[+-]?\d+\.?\d*/)
  return match ? parseFloat(match[0]) : null
}
