// lib/team-abbreviations.ts
// Team abbreviation mapping for all major sports

export const NBA_TEAMS: Record<string, string> = {
  // Full names to abbreviations
  'atlanta hawks': 'ATL',
  'boston celtics': 'BOS',
  'brooklyn nets': 'BKN',
  'charlotte hornets': 'CHA',
  'chicago bulls': 'CHI',
  'cleveland cavaliers': 'CLE',
  'dallas mavericks': 'DAL',
  'denver nuggets': 'DEN',
  'detroit pistons': 'DET',
  'golden state warriors': 'GSW',
  'houston rockets': 'HOU',
  'indiana pacers': 'IND',
  'la clippers': 'LAC',
  'los angeles clippers': 'LAC',
  'la lakers': 'LAL',
  'los angeles lakers': 'LAL',
  'memphis grizzlies': 'MEM',
  'miami heat': 'MIA',
  'milwaukee bucks': 'MIL',
  'minnesota timberwolves': 'MIN',
  'new orleans pelicans': 'NOP',
  'new york knicks': 'NYK',
  'oklahoma city thunder': 'OKC',
  'orlando magic': 'ORL',
  'philadelphia 76ers': 'PHI',
  'phoenix suns': 'PHX',
  'portland trail blazers': 'POR',
  'sacramento kings': 'SAC',
  'san antonio spurs': 'SAS',
  'toronto raptors': 'TOR',
  'utah jazz': 'UTA',
  'washington wizards': 'WAS',
  
  // Abbreviations to full names
  'ATL': 'Atlanta Hawks',
  'BOS': 'Boston Celtics',
  'BKN': 'Brooklyn Nets',
  'CHA': 'Charlotte Hornets',
  'CHI': 'Chicago Bulls',
  'CLE': 'Cleveland Cavaliers',
  'DAL': 'Dallas Mavericks',
  'DEN': 'Denver Nuggets',
  'DET': 'Detroit Pistons',
  'GSW': 'Golden State Warriors',
  'HOU': 'Houston Rockets',
  'IND': 'Indiana Pacers',
  'LAC': 'LA Clippers',
  'LAL': 'Los Angeles Lakers',
  'MEM': 'Memphis Grizzlies',
  'MIA': 'Miami Heat',
  'MIL': 'Milwaukee Bucks',
  'MIN': 'Minnesota Timberwolves',
  'NOP': 'New Orleans Pelicans',
  'NYK': 'New York Knicks',
  'OKC': 'Oklahoma City Thunder',
  'ORL': 'Orlando Magic',
  'PHI': 'Philadelphia 76ers',
  'PHX': 'Phoenix Suns',
  'POR': 'Portland Trail Blazers',
  'SAC': 'Sacramento Kings',
  'SAS': 'San Antonio Spurs',
  'TOR': 'Toronto Raptors',
  'UTA': 'Utah Jazz',
  'WAS': 'Washington Wizards'
}

export const NFL_TEAMS: Record<string, string> = {
  'arizona cardinals': 'ARI',
  'atlanta falcons': 'ATL',
  'baltimore ravens': 'BAL',
  'buffalo bills': 'BUF',
  'carolina panthers': 'CAR',
  'chicago bears': 'CHI',
  'cincinnati bengals': 'CIN',
  'cleveland browns': 'CLE',
  'dallas cowboys': 'DAL',
  'denver broncos': 'DEN',
  'detroit lions': 'DET',
  'green bay packers': 'GB',
  'houston texans': 'HOU',
  'indianapolis colts': 'IND',
  'jacksonville jaguars': 'JAX',
  'kansas city chiefs': 'KC',
  'las vegas raiders': 'LV',
  'los angeles chargers': 'LAC',
  'los angeles rams': 'LAR',
  'miami dolphins': 'MIA',
  'minnesota vikings': 'MIN',
  'new england patriots': 'NE',
  'new orleans saints': 'NO',
  'new york giants': 'NYG',
  'new york jets': 'NYJ',
  'philadelphia eagles': 'PHI',
  'pittsburgh steelers': 'PIT',
  'san francisco 49ers': 'SF',
  'seattle seahawks': 'SEA',
  'tampa bay buccaneers': 'TB',
  'tennessee titans': 'TEN',
  'washington commanders': 'WAS',
  
  // Abbreviations
  'ARI': 'Arizona Cardinals',
  'ATL': 'Atlanta Falcons',
  'BAL': 'Baltimore Ravens',
  'BUF': 'Buffalo Bills',
  'CAR': 'Carolina Panthers',
  'CHI': 'Chicago Bears',
  'CIN': 'Cincinnati Bengals',
  'CLE': 'Cleveland Browns',
  'DAL': 'Dallas Cowboys',
  'DEN': 'Denver Broncos',
  'DET': 'Detroit Lions',
  'GB': 'Green Bay Packers',
  'HOU': 'Houston Texans',
  'IND': 'Indianapolis Colts',
  'JAX': 'Jacksonville Jaguars',
  'KC': 'Kansas City Chiefs',
  'LV': 'Las Vegas Raiders',
  'LAC': 'Los Angeles Chargers',
  'LAR': 'Los Angeles Rams',
  'MIA': 'Miami Dolphins',
  'MIN': 'Minnesota Vikings',
  'NE': 'New England Patriots',
  'NO': 'New Orleans Saints',
  'NYG': 'New York Giants',
  'NYJ': 'New York Jets',
  'PHI': 'Philadelphia Eagles',
  'PIT': 'Pittsburgh Steelers',
  'SF': 'San Francisco 49ers',
  'SEA': 'Seattle Seahawks',
  'TB': 'Tampa Bay Buccaneers',
  'TEN': 'Tennessee Titans',
  'WAS': 'Washington Commanders'
}

/**
 * Extract team abbreviation from text
 * Looks for patterns like "SAC • G • #8" or "MIL vs NYK"
 */
export function extractTeamAbbreviation(text: string): string | undefined {
  // Pattern 1: "SAC • G • #8" (PrizePicks format)
  const pattern1 = text.match(/\b([A-Z]{2,3})\s*•/)
  if (pattern1) return pattern1[1]
  
  // Pattern 2: "MIL vs NYK" or "OKC vs SAC"
  const pattern2 = text.match(/\b([A-Z]{2,3})\s+vs\s+([A-Z]{2,3})\b/)
  if (pattern2) return pattern2[1] // Return first team
  
  // Pattern 3: Just the abbreviation alone
  const pattern3 = text.match(/\b([A-Z]{2,3})\b/)
  if (pattern3) {
    const abbr = pattern3[1]
    // Verify it's a known team
    if (NBA_TEAMS[abbr] || NFL_TEAMS[abbr]) {
      return abbr
    }
  }
  
  return undefined
}

/**
 * Get full team name from abbreviation
 */
export function getFullTeamName(abbreviation: string, sport?: string): string | undefined {
  const abbr = abbreviation.toUpperCase()
  
  if (sport === 'NBA' || !sport) {
    if (NBA_TEAMS[abbr]) return NBA_TEAMS[abbr]
  }
  
  if (sport === 'NFL' || !sport) {
    if (NFL_TEAMS[abbr]) return NFL_TEAMS[abbr]
  }
  
  return undefined
}

/**
 * Detect sport from context
 */
export function detectSport(text: string): 'NBA' | 'NFL' | undefined {
  const lower = text.toLowerCase()
  
  if (lower.includes('nba') || lower.includes('basketball')) return 'NBA'
  if (lower.includes('nfl') || lower.includes('football')) return 'NFL'
  
  // Check for NBA-specific terms
  if (lower.match(/\b(assists?|rebounds?|blocks?|steals?)\b/)) return 'NBA'
  
  // Check for NFL-specific terms
  if (lower.match(/\b(touchdowns?|td|yards?|yds|receptions?|rec)\b/)) return 'NFL'
  
  return undefined
}

/**
 * Extract matchup from text (e.g., "OKC vs SAC", "MIL vs NYK", "76ers @ Wizards")
 */
export function extractMatchup(text: string): { team1: string; team2: string } | undefined {
  // Pattern 1: "OKC vs SAC" or "Bucks vs Knicks"
  let pattern = text.match(/\b([A-Z]{2,3})\s+vs\s+([A-Z]{2,3})\b/i)
  if (pattern) {
    return {
      team1: pattern[1],
      team2: pattern[2]
    }
  }
  
  // Pattern 2: "76ers @ Wizards" or "Bucks @ Knicks"
  pattern = text.match(/\b([A-Za-z0-9]+)\s+@\s+([A-Za-z]+)\b/)
  if (pattern) {
    // Try to map team names to abbreviations
    const team1 = pattern[1]
    const team2 = pattern[2]
    
    // Check if they're already abbreviations
    if (team1.length <= 3 && team2.length <= 3) {
      return { team1: team1.toUpperCase(), team2: team2.toUpperCase() }
    }
    
    // Try to find abbreviations from full names
    const team1Abbr = findTeamAbbreviation(team1)
    const team2Abbr = findTeamAbbreviation(team2)
    
    if (team1Abbr && team2Abbr) {
      return { team1: team1Abbr, team2: team2Abbr }
    }
  }
  
  return undefined
}

/**
 * Find team abbreviation from partial name
 */
function findTeamAbbreviation(name: string): string | undefined {
  const lower = name.toLowerCase()
  
  // Check NBA teams
  for (const [key, value] of Object.entries(NBA_TEAMS)) {
    if (key.toLowerCase().includes(lower) || value.toLowerCase().includes(lower)) {
      // Return the abbreviation (uppercase keys that are 2-3 chars)
      if (key.length <= 3) return key
      // Find the abbreviation value
      const abbr = Object.keys(NBA_TEAMS).find(k => k.length <= 3 && NBA_TEAMS[k] === value)
      if (abbr) return abbr
    }
  }
  
  // Check NFL teams
  for (const [key, value] of Object.entries(NFL_TEAMS)) {
    if (key.toLowerCase().includes(lower) || value.toLowerCase().includes(lower)) {
      if (key.length <= 3) return key
      const abbr = Object.keys(NFL_TEAMS).find(k => k.length <= 3 && NFL_TEAMS[k] === value)
      if (abbr) return abbr
    }
  }
  
  return undefined
}
