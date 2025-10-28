// lib/sportsbook-parsers.ts
// Sportsbook-specific parsing logic

import { ParsedBet } from './bet-parser'
import { extractTeamAbbreviation, getFullTeamName, detectSport, extractMatchup } from './team-abbreviations'

/**
 * Parse PrizePicks format
 * Format: Player Name, Stat Type, Line Value, More/Less
 */
export function parsePrizePicks(lines: string[]): ParsedBet[] {
  const bets: ParsedBet[] = []
  
  console.log('Parsing PrizePicks format, total lines:', lines.length)
  console.log('First 20 lines:', lines.slice(0, 20))
  
  // PrizePicks structure: Player Name, Team/Position, Line + Stat, More/Less button
  // We need to look for the pattern across multiple lines
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()
    
    // Look for selection indicators (More/Less, Higher/Lower, Over/Under, O/U)
    const isSelection = 
      lowerLine === 'more' || lowerLine === 'less' ||
      lowerLine === 'higher' || lowerLine === 'lower' ||
      lowerLine === 'over' || lowerLine === 'under' ||
      lowerLine === 'o' || lowerLine === 'u' ||
      lowerLine.includes('↑ more') || lowerLine.includes('↓ less') ||
      lowerLine.includes('↑ higher') || lowerLine.includes('↓ lower') ||
      lowerLine.includes('↑ over') || lowerLine.includes('↓ under')
    
    if (isSelection) {
      // Determine if over or under
      const isUnder = 
        lowerLine.includes('less') || 
        lowerLine.includes('lower') || 
        lowerLine.includes('under') ||
        lowerLine === 'u' ||
        lowerLine.includes('↓')
      
      const selection = isUnder ? 'under' : 'over'
      console.log(`Found ${selection} at line ${i}:`, line)
      
      // Look backwards for line value, stat type, player name, and team
      let lineValue: number | undefined
      let statType: string | undefined
      let playerName: string | undefined
      let teamAbbr: string | undefined
      let sport: string | undefined
      let matchup: { team1: string; team2: string } | undefined
      
      // Check previous 10 lines for all info
      for (let j = Math.max(0, i - 10); j < i; j++) {
        const prevLine = lines[j]
        const prevLower = prevLine.toLowerCase()
        
        // Look for matchup (e.g., "NBA OKC vs SAC")
        if (!matchup) {
          matchup = extractMatchup(prevLine)
          if (matchup) {
            console.log(`Found matchup at line ${j}:`, matchup)
          }
        }
        
        // Look for sport
        if (!sport) {
          sport = detectSport(prevLine)
          if (sport) {
            console.log(`Found sport at line ${j}:`, sport)
          }
        }
        
        // Look for team abbreviation (e.g., "SAC • G • #8")
        if (!teamAbbr) {
          teamAbbr = extractTeamAbbreviation(prevLine)
          if (teamAbbr) {
            console.log(`Found team at line ${j}:`, teamAbbr, '→', getFullTeamName(teamAbbr, sport))
          }
        }
        
        // Look for line value + stat (e.g., "21.5 Points", "6.2 PT Ast")
        const statMatch = prevLine.match(/(\d+\.?\d*)\s*(points?|pts?|pt|assists?|ast|rebounds?|reb|receptions?|rec|yards?|yds)/i)
        if (statMatch && !lineValue) {
          lineValue = parseFloat(statMatch[1])
          statType = statMatch[2].toLowerCase()
          console.log(`Found stat at line ${j}:`, prevLine, '→', lineValue, statType)
        }
        
        // Look for player name (capitalized words, usually 2-3 words)
        const nameMatch = prevLine.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})$/)
        if (nameMatch && !playerName) {
          playerName = nameMatch[1]
          console.log(`Found player at line ${j}:`, playerName)
        }
      }
      
      // Determine prop type
      let propType: string | undefined
      if (statType) {
        const stat = statType.toLowerCase()
        if (stat.includes('pt') || stat.includes('point')) {
          propType = 'player_points'
        } else if (stat.includes('assist') || stat.includes('ast')) {
          propType = 'player_assists'
        } else if (stat.includes('rebound') || stat.includes('reb')) {
          propType = 'player_rebounds'
        } else if (stat.includes('rec')) {
          propType = 'player_reception_yds'
        }
      }
      
      if (playerName && lineValue) {
        const teamName = teamAbbr ? getFullTeamName(teamAbbr, sport) : undefined
        console.log('✅ Creating bet:', { 
          playerName, 
          lineValue, 
          selection, 
          propType, 
          team: teamName || teamAbbr,
          sport,
          matchup 
        })
        
        bets.push({
          type: 'player_prop',
          player: playerName,
          propType,
          line: lineValue,
          selection,
          odds: -110,
          sportsbook: 'prizepicks',
          sport,
          team1: matchup?.team1 ? getFullTeamName(matchup.team1, sport) : teamName,
          team2: matchup?.team2 ? getFullTeamName(matchup.team2, sport) : undefined,
          rawText: lines.slice(Math.max(0, i - 10), i + 1).join(' | '),
          confidence: 0.85
        })
      } else {
        console.log('⚠️ Missing data:', { playerName, lineValue, statType, teamAbbr, sport })
      }
    }
    
    // Also check for combined patterns in single line
    // Pattern 1: "More/Higher/Over 25.5 Pts" or "Less/Lower/Under 8.5 Assists"
    const pattern1 = lowerLine.match(/(more|less|higher|lower|over|under|o|u)\s+(\d+\.?\d*)\s*(pts|points?|yds|yards?|assists?|rebounds?|receptions?|rec)/i)
    
    // Pattern 2: "25.5 Pts More/Higher/Over" or "8.5 Assists Less/Lower/Under"
    const pattern2 = lowerLine.match(/(\d+\.?\d*)\s*(pts|points?|yds|yards?|assists?|rebounds?|receptions?|rec)\s+(more|less|higher|lower|over|under|o|u)/i)
    
    if (pattern1 || pattern2) {
      console.log('Found combined pattern at line', i, ':', line, '→ pattern1:', !!pattern1, 'pattern2:', !!pattern2)
      const match = (pattern1 || pattern2)!
      const selectionWord = (pattern1 ? match[1] : match[3]).toLowerCase()
      const lineValue = pattern1 ? parseFloat(match[2]) : parseFloat(match[1])
      const statType = pattern1 ? match[3] : match[2]
      
      // Normalize selection to over/under
      const isUnder = selectionWord === 'less' || selectionWord === 'lower' || selectionWord === 'under' || selectionWord === 'u'
      const selection = isUnder ? 'under' : 'over'
      
      // Look for player name and team in nearby lines
      let playerName = ''
      let teamAbbr: string | undefined
      let matchup: { team1: string; team2: string } | undefined
      
      // Check previous 5 lines for player name, team, and matchup
      for (let j = Math.max(0, i - 5); j < i; j++) {
        const prevLine = lines[j]
        
        // Look for matchup (e.g., "76ers @ Wizards" or "Bucks vs Knicks")
        if (!matchup) {
          matchup = extractMatchup(prevLine)
          if (matchup) {
            console.log(`Found matchup at line ${j}:`, matchup)
          }
        }
        
        // Look for team abbreviation
        if (!teamAbbr) {
          teamAbbr = extractTeamAbbreviation(prevLine)
          if (teamAbbr) {
            console.log(`Found team at line ${j}:`, teamAbbr)
          }
        }
        
        // Player names are usually capitalized words (2-3 words)
        // But be more flexible with the pattern
        const nameMatch = prevLine.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z']+)+)$/)
        if (nameMatch && !playerName) {
          playerName = nameMatch[1]
          console.log(`Found player at line ${j}:`, playerName)
          break
        }
      }
      
      // If not found, check next line
      if (!playerName && i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const nameMatch = nextLine.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z']+)+)$/)
        if (nameMatch) {
          playerName = nameMatch[1]
          console.log(`Found player at line ${i + 1}:`, playerName)
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
        const sport = detectSport(lines.slice(Math.max(0, i - 5), i + 1).join(' '))
        const teamName = teamAbbr ? getFullTeamName(teamAbbr, sport) : undefined
        
        console.log('✅ Found bet (combined pattern):', { 
          playerName, 
          lineValue, 
          selection, 
          propType,
          team: teamName || teamAbbr,
          matchup
        })
        
        bets.push({
          type: 'player_prop',
          player: playerName,
          propType,
          line: lineValue,
          selection, // Already normalized to 'over' or 'under'
          odds: -110,
          sportsbook: 'prizepicks',
          sport,
          team1: matchup?.team1 ? getFullTeamName(matchup.team1, sport) : teamName,
          team2: matchup?.team2 ? getFullTeamName(matchup.team2, sport) : undefined,
          rawText: lines.slice(Math.max(0, i - 5), i + 1).join(' | '),
          confidence: 0.85
        })
      } else {
        console.log('⚠️ Missing data (combined pattern):', { playerName, lineValue, propType, teamAbbr, matchup })
      }
    }
  }
  
  console.log('PrizePicks bets found:', bets.length)
  return bets
}

/**
 * Parse Underdog Fantasy format
 * Uses "Higher/Lower" but same structure as PrizePicks
 */
export function parseUnderdog(lines: string[]): ParsedBet[] {
  // Underdog has same structure as PrizePicks, just different words
  // Reuse PrizePicks parser since we now handle Higher/Lower
  return parsePrizePicks(lines).map(bet => ({
    ...bet,
    sportsbook: 'underdog'
  }))
}

/**
 * Parse Underdog Fantasy format (OLD - keeping for reference)
 */
export function parseUnderdogOld(lines: string[]): ParsedBet[] {
  const bets: ParsedBet[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()
    
    // Underdog uses "Higher" and "Lower" (now handled by universal parser)
    if (lowerLine.includes('higher') || lowerLine.includes('lower')) {
      const selection = lowerLine.includes('lower') ? 'under' : 'over'
      
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
  
  // PrizePicks detection - be more aggressive
  if (lower.includes('prizepicks') || lower.includes('prize picks') || 
      lower.includes('prizepi') || lower.includes('power play') ||
      (lower.includes('more') && lower.includes('less') && lower.includes('pick'))) {
    return 'prizepicks'
  }
  
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
