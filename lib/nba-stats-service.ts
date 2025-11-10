/**
 * NBA Stats Service
 * Uses NBA.com's official stats API (same endpoints as nba_api Python package)
 * FREE - No API key required
 */

const NBA_STATS_BASE = 'https://stats.nba.com/stats';

// Required headers to avoid 403 errors
const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
};

export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  season: string;
  gamesPlayed: number;
  averages: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fieldGoalPct: number;
    threePointPct: number;
    freeThrowPct: number;
    minutesPerGame: number;
  };
}

export interface PlayerGameLog {
  gameId: string;
  gameDate: string;
  opponent: string;
  isHome: boolean;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  minutesPlayed: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointsMade: number;
  threePointsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
}

/**
 * Search for a player by name
 */
export async function searchPlayer(playerName: string): Promise<{ id: string; name: string; team: string } | null> {
  try {
    // Search all players for current season (2025-26)
    const url = `${NBA_STATS_BASE}/commonallplayers?LeagueID=00&Season=2025-26&IsOnlyCurrentSeason=0`;
    
    const response = await fetch(url, { headers: NBA_HEADERS });
    const data = await response.json();
    
    // Response format: { resultSets: [{ headers: [...], rowSet: [[...]] }] }
    const players = data.resultSets[0].rowSet;
    const headers = data.resultSets[0].headers;
    
    // Find indices
    const idIndex = headers.indexOf('PERSON_ID');
    const nameIndex = headers.indexOf('DISPLAY_FIRST_LAST');
    const teamIndex = headers.indexOf('TEAM_NAME');
    
    // Search for player (case-insensitive, flexible matching)
    const searchLower = playerName.toLowerCase().trim();
    const searchParts = searchLower.split(' ');
    
    const found = players.find((row: any[]) => {
      const fullName = row[nameIndex].toLowerCase();
      
      // Try exact match first
      if (fullName === searchLower) return true;
      
      // Try includes
      if (fullName.includes(searchLower)) return true;
      
      // Try matching all parts (handles "Stephen Curry" vs "Steph Curry")
      if (searchParts.every(part => fullName.includes(part))) return true;
      
      return false;
    });
    
    if (!found) {
      console.log(`❌ Player not found. Searched for: "${playerName}"`);
      // Find players with similar names (starting with same letter)
      const firstLetter = searchLower[0];
      const similar = players
        .filter((r: any[]) => r[nameIndex].toLowerCase().startsWith(firstLetter))
        .slice(0, 10)
        .map((r: any[]) => r[nameIndex]);
      console.log(`Players starting with '${firstLetter.toUpperCase()}':`, similar);
      return null;
    }
    
    return {
      id: found[idIndex].toString(),
      name: found[nameIndex],
      team: found[teamIndex] || 'Unknown'
    };
  } catch (error) {
    console.error('Error searching for player:', error);
    return null;
  }
}

/**
 * Get player season averages
 * Default to current season (2025-26)
 */
export async function getPlayerSeasonStats(playerId: string, season: string = '2025-26'): Promise<PlayerSeasonStats | null> {
  try {
    const url = `${NBA_STATS_BASE}/playercareerstats?PlayerID=${playerId}&PerMode=PerGame`;
    
    const response = await fetch(url, { headers: NBA_HEADERS });
    const data = await response.json();
    
    // Get season totals per game
    const seasonStats = data.resultSets[0];
    const headers = seasonStats.headers;
    const rows = seasonStats.rowSet;
    
    // Find the row for the requested season
    const seasonIndex = headers.indexOf('SEASON_ID');
    const seasonRow = rows.find((row: any[]) => row[seasonIndex] === season);
    
    if (!seasonRow) {
      console.log(`No stats found for season ${season}, using most recent`);
      // Use most recent season
      const mostRecent = rows[rows.length - 1];
      if (!mostRecent) return null;
    }
    
    const row = seasonRow || rows[rows.length - 1];
    
    return {
      playerId,
      playerName: '', // Will be filled in by caller
      season: row[headers.indexOf('SEASON_ID')],
      gamesPlayed: row[headers.indexOf('GP')],
      averages: {
        points: row[headers.indexOf('PTS')],
        rebounds: row[headers.indexOf('REB')],
        assists: row[headers.indexOf('AST')],
        steals: row[headers.indexOf('STL')],
        blocks: row[headers.indexOf('BLK')],
        turnovers: row[headers.indexOf('TOV')],
        fieldGoalPct: row[headers.indexOf('FG_PCT')],
        threePointPct: row[headers.indexOf('FG3_PCT')],
        freeThrowPct: row[headers.indexOf('FT_PCT')],
        minutesPerGame: row[headers.indexOf('MIN')]
      }
    };
  } catch (error) {
    console.error('Error fetching player season stats:', error);
    return null;
  }
}

/**
 * Get player's recent game logs (last N games)
 * Default to current season (2025-26)
 */
export async function getPlayerGameLogs(
  playerId: string, 
  season: string = '2025-26',
  lastNGames: number = 10
): Promise<PlayerGameLog[]> {
  try {
    const url = `${NBA_STATS_BASE}/playergamelog?PlayerID=${playerId}&Season=${season}&SeasonType=Regular+Season`;
    
    const response = await fetch(url, { headers: NBA_HEADERS });
    const data = await response.json();
    
    const gameLog = data.resultSets[0];
    const headers = gameLog.headers;
    const rows = gameLog.rowSet;
    
    // Take last N games
    const recentGames = rows.slice(0, lastNGames);
    
    return recentGames.map((row: any[]) => ({
      gameId: row[headers.indexOf('Game_ID')],
      gameDate: row[headers.indexOf('GAME_DATE')],
      opponent: row[headers.indexOf('MATCHUP')].split(' ')[2], // Extract opponent from "LAL vs. BOS"
      isHome: !row[headers.indexOf('MATCHUP')].includes('@'),
      points: row[headers.indexOf('PTS')],
      rebounds: row[headers.indexOf('REB')],
      assists: row[headers.indexOf('AST')],
      steals: row[headers.indexOf('STL')],
      blocks: row[headers.indexOf('BLK')],
      turnovers: row[headers.indexOf('TOV')],
      minutesPlayed: parseFloat(row[headers.indexOf('MIN')] || 0),
      fieldGoalsMade: row[headers.indexOf('FGM')],
      fieldGoalsAttempted: row[headers.indexOf('FGA')],
      threePointsMade: row[headers.indexOf('FG3M')],
      threePointsAttempted: row[headers.indexOf('FG3A')],
      freeThrowsMade: row[headers.indexOf('FTM')],
      freeThrowsAttempted: row[headers.indexOf('FTA')]
    }));
  } catch (error) {
    console.error('Error fetching player game logs:', error);
    return [];
  }
}

/**
 * Get comprehensive player stats (season averages + recent games)
 */
export async function getPlayerStats(playerName: string, lastNGames: number = 10) {
  console.log(`📊 Fetching NBA stats for ${playerName}...`);
  
  // 1. Search for player
  const player = await searchPlayer(playerName);
  if (!player) {
    console.log(`❌ Player not found: ${playerName}`);
    return null;
  }
  
  console.log(`✅ Found player: ${player.name} (${player.team})`);
  
  // 2. Get season averages
  const seasonStats = await getPlayerSeasonStats(player.id);
  if (!seasonStats) {
    console.log(`❌ No season stats found for ${player.name}`);
    return null;
  }
  
  seasonStats.playerName = player.name;
  console.log(`✅ Season averages: ${seasonStats.averages.points} PPG, ${seasonStats.averages.rebounds} RPG, ${seasonStats.averages.assists} APG`);
  
  // 3. Get recent game logs
  const gameLogs = await getPlayerGameLogs(player.id, seasonStats.season, lastNGames);
  console.log(`✅ Retrieved ${gameLogs.length} recent games`);
  
  return {
    player,
    seasonStats,
    recentGames: gameLogs
  };
}
