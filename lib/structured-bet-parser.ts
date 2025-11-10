// lib/structured-bet-parser.ts
// Structured parser that follows the actual slip format

import { ParsedBet } from './bet-parser'
import { extractTeamAbbreviation, getFullTeamName, detectSport, extractMatchup } from './team-abbreviations'

/**
 * Parse bets by following the slip structure:
 * 1. Find number of picks at top
 * 2. Find game headers (e.g., "NBA MIA vs CHA")
 * 3. For each game, find all players and their props
 */
export function parseStructured(lines: string[]): ParsedBet[] {
  console.log('========================================')
  console.log('📋 STRUCTURED PARSER STARTING')
  console.log('========================================')
  console.log('Total lines:', lines.length)
  
  const bets: ParsedBet[] = []
  
  // Step 1: Find number of picks (e.g., "4-pick Power Play" or "4 Picks")
  let expectedBets = 0
  for (const line of lines) {
    const pickMatch = line.match(/(\d+)[-\s]?picks?/i)
    if (pickMatch) {
      expectedBets = parseInt(pickMatch[1])
      console.log(`\n🎯 Found ${expectedBets} picks expected`)
      break
    }
  }
  
  // Step 2: Find all game headers and parse bets under each
  let currentGame: { team1: string; team2: string; sport: string } | null = null
  let i = 0
  
  while (i < lines.length && bets.length < expectedBets) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()
    
    // Debug: Log lines that might be player names
    if (line.length > 3 && line.length < 30 && line[0] === line[0].toUpperCase()) {
      console.log(`  📝 Line ${i}: "${line}" (length: ${line.length}, chars: ${line.split('').map(c => c.charCodeAt(0)).join(',')})`)
    }
    
    // Check if this is a game header (e.g., "NBA MIA vs CHA", "76ers @ Wizards - 6:00 PM")
    const matchup = extractMatchup(line)
    const sport = detectSport(line)
    
    if (matchup && sport) {
      currentGame = {
        team1: matchup.team1,
        team2: matchup.team2,
        sport: sport
      }
      console.log(`\n🏀 Found game: ${currentGame.team1} vs ${currentGame.team2} (${currentGame.sport})`)
      i++
      continue
    }
    
    // Also check if line contains just matchup without sport keyword
    if (matchup && !sport) {
      // Look backwards for sport
      for (let j = Math.max(0, i - 3); j < i; j++) {
        const prevSport = detectSport(lines[j])
        if (prevSport) {
          currentGame = {
            team1: matchup.team1,
            team2: matchup.team2,
            sport: prevSport
          }
          console.log(`\n🏀 Found game: ${currentGame.team1} vs ${currentGame.team2} (${currentGame.sport})`)
          break
        }
      }
      if (currentGame) {
        i++
        continue
      }
    }
    
    // Check if this is a player name (2-3 capitalized words)
    // Allow for: capital letters mid-word (LaVine), apostrophes (O'Neal), accented characters (Nurkić)
    const playerMatch = line.match(/^([A-Z][a-zA-ZÀ-ÿ']+(?:\s+[A-Z][a-zA-ZÀ-ÿ']+){0,2})$/)
    
    // Debug: Log potential player names
    if (playerMatch) {
      console.log(`  🔍 Potential player at line ${i}: "${playerMatch[1]}" (has game: ${!!currentGame})`)
    }
    
    if (playerMatch && currentGame) {
      const playerName = playerMatch[1]
      
      // Filter out non-player names
      if (playerName.includes('Play') || playerName.includes('Guarantee') || 
          playerName.includes('Minimum') || playerName.includes('Power') ||
          playerName.includes('Flex') || playerName.includes('Clear') ||
          playerName.includes('Remove') || playerName.includes('Entry')) {
        console.log(`  ⏭️ Skipping non-player: ${playerName}`)
        i++
        continue
      }
      
      // Filter out all-caps abbreviations (LVT, NBA, etc.) and short names
      if (playerName === playerName.toUpperCase() || playerName.length < 4) {
        console.log(`  ⏭️ Skipping abbreviation/short name: ${playerName}`)
        i++
        continue
      }
      
      console.log(`\n  👤 Found player: ${playerName}`)
      
      // Look ahead for prop info (next 8 lines to handle extra junk lines)
      let propLine: number | undefined
      let propType: string | undefined
      let selection: 'over' | 'under' | undefined
      
      for (let j = i + 1; j < Math.min(i + 9, lines.length); j++) {
        const nextLine = lines[j]
        const nextLower = nextLine.toLowerCase()
        
        // Stop if we hit another game header
        if (extractMatchup(nextLine)) break
        
        // Don't stop for player names - we might have multiple players in same game
        // Just skip this line and continue looking for prop info
        
        // Look for selection (Higher/Lower, More/Less, Over/Under)
        if (!selection) {
          // PrizePicks shows both buttons: "↓ Less ↑ More"
          // The FIRST button in the OCR text is usually the selected one
          // Check for combined button line first
          if (nextLower.includes('less') && nextLower.includes('more')) {
            // Both buttons on same line - pick the first one (Less)
            selection = 'under'
            console.log(`    ✓ Selection: under (from combined buttons, picking first: "${nextLine}")`)
          } else if (nextLower.includes('lower') && nextLower.includes('higher')) {
            // Both buttons - pick first (Lower)
            selection = 'under'
            console.log(`    ✓ Selection: under (from combined buttons, picking first: "${nextLine}")`)
          }
          // Check for standalone selection words
          else if (nextLower === 'higher' || nextLower === 'more' || nextLower === 'over') {
            selection = 'over'
            console.log(`    ✓ Selection: over (from "${nextLine}")`)
          } else if (nextLower === 'lower' || nextLower === 'less' || nextLower === 'under') {
            selection = 'under'
            console.log(`    ✓ Selection: under (from "${nextLine}")`)
          }
          // Check for combined format "Higher 28.5 Points"
          else if (nextLower.match(/(higher|more|over)\s+\d+/)) {
            selection = 'over'
            console.log(`    ✓ Selection: over (from combined line "${nextLine}")`)
          } else if (nextLower.match(/(lower|less|under)\s+\d+/)) {
            selection = 'under'
            console.log(`    ✓ Selection: under (from combined line "${nextLine}")`)
          }
        }
        
        // Look for prop line and type
        // Format 1: "21.5 Points" or "10 Rebounds" or "8.5 Rebs+Asts"
        // IMPORTANT: Check longer patterns first (Rebs+Asts before Rebs)
        const propMatch1 = nextLine.match(/(\d+\.?\d*)\s+(rebs?\+asts?|points?|pts?|rebounds?|rebs?|assists?|asts?|receptions?|rec|yards?|yds|blocks?|steals?|turnovers?|to|pra)/i)
        if (propMatch1 && !propLine) {
          propLine = parseFloat(propMatch1[1])
          propType = propMatch1[2].toLowerCase()
          console.log(`    ✓ Prop: ${propType} ${propLine} (from "${nextLine}")`)
        } else if (nextLine.match(/\d+\.?\d*/) && !propLine) {
          console.log(`    ⚠️ Line has number but no match: "${nextLine}"`)
        }
        
        // Format 2: "Higher 28.5 Points" (combined)
        const propMatch2 = nextLine.match(/(higher|lower|more|less|over|under)\s+(\d+\.?\d*)\s+(points?|pts?|rebounds?|rebs?|assists?|asts?|pra|rebs?\+asts?)/i)
        if (propMatch2 && !propLine) {
          propLine = parseFloat(propMatch2[2])
          propType = propMatch2[3].toLowerCase()
          const selWord = propMatch2[1].toLowerCase()
          selection = (selWord === 'lower' || selWord === 'less' || selWord === 'under') ? 'under' : 'over'
          console.log(`    ✓ Prop: ${propType} ${propLine} (${selection})`)
        }
        
        // Look for team info to correct game assignment
        const teamAbbr = extractTeamAbbreviation(nextLine)
        if (teamAbbr) {
          // Check if this team matches current game
          const team1Full = getFullTeamName(currentGame.team1, currentGame.sport)
          const team2Full = getFullTeamName(currentGame.team2, currentGame.sport)
          const foundTeamFull = getFullTeamName(teamAbbr, currentGame.sport)
          
          // If team doesn't match current game, this player might be in wrong game
          if (foundTeamFull !== team1Full && foundTeamFull !== team2Full) {
            console.log(`    ⚠️ Team mismatch: ${foundTeamFull} not in ${team1Full} vs ${team2Full}`)
          }
        }
      }
      
      // If we have minimum required data, create bet
      if (propLine && propType) {
        // Normalize prop type
        let normalizedPropType = 'player_points'
        if (propType.includes('point') || propType.includes('pts')) {
          normalizedPropType = 'player_points'
        } else if (propType.includes('rebound') || propType.includes('reb')) {
          normalizedPropType = 'player_rebounds'
        } else if (propType.includes('assist') || propType.includes('ast')) {
          normalizedPropType = 'player_assists'
        } else if (propType.includes('pra')) {
          normalizedPropType = 'player_points_rebounds_assists'
        } else if (propType.includes('rebs+asts') || propType.includes('reb+ast')) {
          normalizedPropType = 'player_rebounds_assists'
        } else if (propType.includes('rec')) {
          normalizedPropType = 'player_receptions'
        } else if (propType.includes('yard') || propType.includes('yds')) {
          normalizedPropType = 'player_pass_yds'
        } else if (propType.includes('block')) {
          normalizedPropType = 'player_blocks'
        } else if (propType.includes('steal')) {
          normalizedPropType = 'player_steals'
        }
        
        const bet: ParsedBet = {
          type: 'player_prop',
          player: playerName,
          propType: normalizedPropType,
          line: propLine,
          selection: selection || 'over', // Default to over if not found
          odds: -110,
          sportsbook: 'unknown',
          sport: currentGame.sport,
          team1: getFullTeamName(currentGame.team1, currentGame.sport),
          team2: getFullTeamName(currentGame.team2, currentGame.sport),
          rawText: line,
          confidence: 0.85
        }
        
        bets.push(bet)
        console.log(`    ✅ Created bet #${bets.length}`)
      } else {
        console.log(`    ⚠️ Missing data - propLine: ${propLine}, propType: ${propType}`)
      }
    }
    
    i++
  }
  
  console.log(`\n📊 Found ${bets.length} bets (expected ${expectedBets})`)
  
  if (bets.length < expectedBets) {
    console.log(`⚠️ Warning: Found fewer bets than expected!`)
  }
  
  return bets
}
