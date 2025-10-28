// lib/sportsbook-parsers.ts
// Sportsbook-specific parsing logic

import { ParsedBet } from './bet-parser'

/**
 * Parse PrizePicks format
 * Format: Player Name, Stat Type, Line Value, More/Less
 */
export function parsePrizePicks(lines: string[]): ParsedBet[] {
  const bets: ParsedBet[] = []
  
  console.log('Parsing PrizePicks format, lines:', lines.length)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()
    
    // PrizePicks patterns:
    // Pattern 1: "More 25.5 Pts" or "Less 8.5 Assists"
    const pattern1 = lowerLine.match(/(more|less)\s+(\d+\.?\d*)\s*(pts|points|yds|yards|assists?|rebounds?|receptions?|rec)/i)
    
    // Pattern 2: "25.5 Pts More" or "8.5 Assists Less"
    const pattern2 = lowerLine.match(/(\d+\.?\d*)\s*(pts|points|yds|yards|assists?|rebounds?|receptions?|rec)\s+(more|less)/i)
    
    if (pattern1 || pattern2) {
      const match = (pattern1 || pattern2)!
      const selection = pattern1 ? match[1] : match[3]
      const lineValue = pattern1 ? parseFloat(match[2]) : parseFloat(match[1])
      const statType = pattern1 ? match[3] : match[2]
      
      // Look for player name in nearby lines
      let playerName = ''
      
      // Check previous 3 lines for player name
      for (let j = Math.max(0, i - 3); j < i; j++) {
        const prevLine = lines[j]
        // Player names are usually capitalized words
        const nameMatch = prevLine.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/)
        if (nameMatch) {
          playerName = nameMatch[1]
          break
        }
      }
      
      // If not found, check next line
      if (!playerName && i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const nameMatch = nextLine.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/)
        if (nameMatch) {
          playerName = nameMatch[1]
        }
      }
      
      // Determine prop type
      let propType: string | undefined
      const stat = statType.toLowerCase()
      if (stat.includes('pt') || stat.includes('point')) {
        propType = 'player_points'
      } else if (stat.includes('assist')) {
        propType = 'player_assists'
      } else if (stat.includes('rebound')) {
        propType = 'player_rebounds'
      } else if (stat.includes('rec')) {
        propType = 'player_reception_yds'
      } else if (stat.includes('yd') || stat.includes('yard')) {
        // Default to passing yards, would need more context
        propType = 'player_pass_yds'
      }
      
      if (playerName && lineValue && propType) {
        console.log('Found PrizePicks bet:', { playerName, lineValue, selection, propType })
        bets.push({
          type: 'player_prop',
          player: playerName,
          propType,
          line: lineValue,
          selection: selection === 'more' ? 'over' : 'under',
          odds: -110,
          sportsbook: 'prizepicks',
          rawText: `${lines[i - 1] || ''} ${line}`.trim(),
          confidence: 0.85
        })
      }
    }
  }
  
  console.log('PrizePicks bets found:', bets.length)
  return bets
}

/**
 * Parse Underdog Fantasy format
 * Similar to PrizePicks but with "Higher/Lower"
 */
export function parseUnderdog(lines: string[]): ParsedBet[] {
  const bets: ParsedBet[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()
    
    // Underdog uses "Higher" and "Lower"
    if (lowerLine.includes('higher') || lowerLine.includes('lower')) {
      const selection = lowerLine.includes('higher') ? 'over' : 'under'
      
      // Look for line value and stat type
      const statMatch = line.match(/(\d+\.?\d*)\s*(pts|points|yds|yards|assists?|rebounds?)/i)
      
      if (statMatch) {
        const lineValue = parseFloat(statMatch[1])
        const statType = statMatch[2].toLowerCase()
        
        // Find player name
        let playerName = ''
        for (let j = Math.max(0, i - 2); j < i; j++) {
          const nameMatch = lines[j].match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/)
          if (nameMatch) {
            playerName = nameMatch[1]
            break
          }
        }
        
        let propType: string | undefined
        if (statType.includes('pt')) propType = 'player_points'
        else if (statType.includes('assist')) propType = 'player_assists'
        else if (statType.includes('rebound')) propType = 'player_rebounds'
        else if (statType.includes('yd')) propType = 'player_pass_yds'
        
        if (playerName && propType) {
          bets.push({
            type: 'player_prop',
            player: playerName,
            propType,
            line: lineValue,
            selection,
            odds: -110,
            sportsbook: 'underdog',
            rawText: line,
            confidence: 0.85
          })
        }
      }
    }
  }
  
  return bets
}

/**
 * Parse FanDuel format
 */
export function parseFanDuel(lines: string[]): ParsedBet[] {
  const bets: ParsedBet[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // FanDuel shows odds clearly
    const oddsMatch = line.match(/([+-]\d{3,})/)
    if (!oddsMatch) continue
    
    const odds = parseInt(oddsMatch[1])
    
    // Look for context
    const context = [
      lines[i - 2],
      lines[i - 1],
      line,
      lines[i + 1],
      lines[i + 2]
    ].filter(Boolean).join(' ')
    
    const lowerContext = context.toLowerCase()
    
    // Determine bet type
    let betType: ParsedBet['type'] = 'moneyline'
    if (lowerContext.includes('spread') || lowerContext.match(/[+-]\d+\.5/)) {
      betType = 'spread'
    } else if (lowerContext.includes('over') || lowerContext.includes('under') || lowerContext.includes('total')) {
      betType = 'total'
    } else if (lowerContext.match(/\d+\.?\d*\s*(pts|yds|assists|rebounds)/i)) {
      betType = 'player_prop'
    }
    
    // Extract relevant info based on type
    if (betType === 'player_prop') {
      const playerMatch = context.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/)
      const statMatch = context.match(/(\d+\.?\d*)\s*(pts|yds|assists|rebounds)/i)
      const selection = lowerContext.includes('over') ? 'over' : 'under'
      
      if (playerMatch && statMatch) {
        bets.push({
          type: 'player_prop',
          player: playerMatch[1],
          line: parseFloat(statMatch[1]),
          selection,
          odds,
          sportsbook: 'fanduel',
          rawText: context,
          confidence: 0.9
        })
      }
    }
  }
  
  return bets
}

/**
 * Parse DraftKings format
 */
export function parseDraftKings(lines: string[]): ParsedBet[] {
  const bets: ParsedBet[] = []
  
  // DraftKings has similar format to FanDuel
  // Implementation similar to FanDuel parser
  
  return bets
}

/**
 * Detect sportsbook from text
 */
export function detectSportsbook(text: string): string | undefined {
  const lower = text.toLowerCase()
  
  if (lower.includes('prizepicks') || lower.includes('prize picks')) return 'prizepicks'
  if (lower.includes('underdog')) return 'underdog'
  if (lower.includes('fanduel') || lower.includes('fan duel')) return 'fanduel'
  if (lower.includes('draftkings') || lower.includes('draft kings')) return 'draftkings'
  if (lower.includes('betmgm') || lower.includes('bet mgm')) return 'betmgm'
  if (lower.includes('caesars')) return 'caesars'
  if (lower.includes('espnbet') || lower.includes('espn bet')) return 'espnbet'
  if (lower.includes('sleeper')) return 'sleeper'
  if (lower.includes('betr')) return 'betr'
  if (lower.includes('parlayplay') || lower.includes('parlay play')) return 'parlayplay'
  
  return undefined
}
