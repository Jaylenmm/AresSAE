// lib/universal-bet-parser.ts
// Universal bet parser that works across all sportsbooks

import { ParsedBet } from './bet-parser'
import { extractTeamAbbreviation, getFullTeamName, detectSport, extractMatchup } from './team-abbreviations'

interface BetCandidate {
  playerName?: string
  lineValue?: number
  statType?: string
  selection?: 'over' | 'under'
  team?: string
  matchup?: { team1: string; team2: string }
  sport?: string
  lineNumber: number
}

/**
 * Universal parser - works for any sportsbook
 * Looks for patterns: Player Name + Number + Stat Type + Selection
 */
export function parseUniversal(lines: string[]): ParsedBet[] {
  console.log('========================================')
  console.log('🌐 UNIVERSAL PARSER STARTING')
  console.log('========================================')
  console.log('Total lines:', lines.length)
  console.log('All lines:', JSON.stringify(lines, null, 2))
  
  const candidates: BetCandidate[] = []
  
  // First pass: Find all numbers (potential line values)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()
    
    // Skip lines that are obviously not bets
    if (lowerLine.includes('pick') && lowerLine.includes('power')) continue
    if (lowerLine.includes('pick') && lowerLine.includes('flex')) continue
    if (lowerLine.includes('place') && lowerLine.includes('pay')) continue
    if (lowerLine.includes('correct') && lowerLine.includes('pay')) continue
    if (lowerLine.includes('minimum') && lowerLine.includes('guarantee')) continue
    if (lowerLine.includes('learn more')) continue
    if (lowerLine.includes('clear all')) continue
    if (lowerLine.includes(':') && lowerLine.includes('m')) continue // Time stamps
    if (lowerLine.match(/^[a-z]{3}\s+\d+:\d+/)) continue // "Tue 7:00 PM"
    if (lowerLine.match(/#\d+$/)) continue // Jersey numbers like "#8"
    if (lowerLine.match(/\d+x$/)) continue // Multipliers like "6x"
    
    // Look for numbers (line values)
    const numberMatches = line.match(/\d+\.?\d*/g)
    if (!numberMatches) continue
    
    for (const numStr of numberMatches) {
      const num = parseFloat(numStr)
      
      // Skip obvious non-bet numbers
      if (num > 100 || num < 0.5) continue // Bet lines are typically 0.5-100
      if (num < 2 && !numStr.includes('.')) continue // Skip 1, 2, 3, 4 without decimals
      
      console.log(`\n📍 Found number ${num} at line ${i}: "${line}"`)
      
      // Create a candidate bet
      const candidate: BetCandidate = {
        lineValue: num,
        lineNumber: i
      }
      
      // Look for stat type on same line or nearby
      const statMatch = lowerLine.match(/(points?|pts?|rebounds?|reb|assists?|ast|receptions?|rec|yards?|yds|touchdowns?|tds?|blocks?|steals?)/i)
      if (statMatch) {
        candidate.statType = statMatch[1].toLowerCase()
        console.log(`  ✓ Stat type: ${candidate.statType}`)
      }
      
      // Look for selection on same line or nearby
      const selectionMatch = lowerLine.match(/(more|less|higher|lower|over|under|o|u)(?!\w)/i)
      if (selectionMatch) {
        const word = selectionMatch[1].toLowerCase()
        const isUnder = word === 'less' || word === 'lower' || word === 'under' || word === 'u'
        candidate.selection = isUnder ? 'under' : 'over'
        console.log(`  ✓ Selection: ${candidate.selection} (from "${word}")`)
      }
      
      // Search nearby lines for player name, team, matchup
      const searchStart = Math.max(0, i - 5)
      const searchEnd = Math.min(lines.length, i + 5)
      
      for (let j = searchStart; j < searchEnd; j++) {
        if (j === i) continue // Skip current line
        
        const nearbyLine = lines[j]
        const nearbyLower = nearbyLine.toLowerCase()
        
        // Look for player name (2-3 capitalized words)
        if (!candidate.playerName) {
          const nameMatch = nearbyLine.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z']+){1,2})$/)
          if (nameMatch) {
            const name = nameMatch[1]
            // Filter out non-player names
            if (name.includes('Play') || name.includes('Guarantee') || 
                name.includes('Minimum') || name.includes('Power') ||
                name.includes('Flex') || name.includes('Clear')) {
              continue
            }
            candidate.playerName = name
            console.log(`  ✓ Player: ${candidate.playerName} (line ${j})`)
          }
        }
        
        // Look for team
        if (!candidate.team) {
          const teamAbbr = extractTeamAbbreviation(nearbyLine)
          if (teamAbbr) {
            candidate.team = teamAbbr
            console.log(`  ✓ Team: ${teamAbbr} (line ${j})`)
          }
        }
        
        // Look for matchup
        if (!candidate.matchup) {
          const matchup = extractMatchup(nearbyLine)
          if (matchup) {
            candidate.matchup = matchup
            console.log(`  ✓ Matchup: ${matchup.team1} vs ${matchup.team2} (line ${j})`)
          }
        }
        
        // Look for sport
        if (!candidate.sport) {
          const sport = detectSport(nearbyLine)
          if (sport) {
            candidate.sport = sport
            console.log(`  ✓ Sport: ${sport} (line ${j})`)
          }
        }
        
        // Look for stat type if not found yet
        if (!candidate.statType) {
          const statMatch = nearbyLower.match(/(points?|pts?|rebounds?|reb|assists?|ast|receptions?|rec|yards?|yds)/i)
          if (statMatch) {
            candidate.statType = statMatch[1].toLowerCase()
            console.log(`  ✓ Stat type: ${candidate.statType} (line ${j})`)
          }
        }
        
        // Look for selection if not found yet
        if (!candidate.selection) {
          const selectionMatch = nearbyLower.match(/(more|less|higher|lower|over|under)(?!\w)/i)
          if (selectionMatch) {
            const word = selectionMatch[1].toLowerCase()
            const isUnder = word === 'less' || word === 'lower' || word === 'under'
            candidate.selection = isUnder ? 'under' : 'over'
            console.log(`  ✓ Selection: ${candidate.selection} (line ${j})`)
          }
        }
      }
      
      // Check if we have minimum required data
      if (candidate.playerName && candidate.lineValue && candidate.statType) {
        console.log(`  ✅ Valid bet candidate!`)
        candidates.push(candidate)
      } else {
        console.log(`  ⚠️ Incomplete bet - missing:`, {
          player: !candidate.playerName,
          line: !candidate.lineValue,
          stat: !candidate.statType,
          selection: !candidate.selection
        })
      }
    }
  }
  
  console.log(`\n📊 Found ${candidates.length} bet candidates`)
  
  // Convert candidates to ParsedBet format
  const bets: ParsedBet[] = []
  
  for (const candidate of candidates) {
    if (!candidate.playerName || !candidate.lineValue || !candidate.statType) continue
    
    // Determine prop type from stat
    let propType = 'player_points'
    const stat = candidate.statType.toLowerCase()
    
    if (stat.includes('point') || stat.includes('pts')) {
      propType = 'player_points'
    } else if (stat.includes('rebound') || stat.includes('reb')) {
      propType = 'player_rebounds'
    } else if (stat.includes('assist') || stat.includes('ast')) {
      propType = 'player_assists'
    } else if (stat.includes('rec')) {
      propType = 'player_receptions'
    } else if (stat.includes('yard') || stat.includes('yds')) {
      propType = 'player_pass_yds'
    }
    
    const teamName = candidate.team ? getFullTeamName(candidate.team, candidate.sport) : undefined
    
    bets.push({
      type: 'player_prop',
      player: candidate.playerName,
      propType,
      line: candidate.lineValue,
      selection: candidate.selection || 'over', // Default to over if not specified
      odds: -110,
      sportsbook: 'unknown',
      sport: candidate.sport,
      team1: candidate.matchup?.team1 ? getFullTeamName(candidate.matchup.team1, candidate.sport) : teamName,
      team2: candidate.matchup?.team2 ? getFullTeamName(candidate.matchup.team2, candidate.sport) : undefined,
      rawText: lines[candidate.lineNumber],
      confidence: 0.75
    })
  }
  
  console.log(`\n✅ Returning ${bets.length} parsed bets`)
  return bets
}
