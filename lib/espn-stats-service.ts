/**
 * ESPN Stats Service
 * Uses ESPN's public API via Render proxy
 */

const ESPN_PROXY_URL = process.env.ESPN_PROXY_URL;
const ESPN_BASE = ESPN_PROXY_URL 
  ? `${ESPN_PROXY_URL}/espn`
  : 'https://site.api.espn.com/apis/site/v2/sports';

export interface ESPNPlayerStats {
  playerName: string;
  team: string;
  recentGames: ESPNGameLog[];
}

export interface ESPNGameLog {
  gameDate: string;
  opponent: string;
  stats: Record<string, number>; // Flexible stats object
}

/**
 * Get NFL player stats
 */
export async function getNFLPlayerStats(playerName: string): Promise<ESPNPlayerStats | null> {
  try {
    // ESPN NFL endpoint for player search
    const searchUrl = `${ESPN_BASE}/football/nfl/athletes?search=${encodeURIComponent(playerName)}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.athletes || searchData.athletes.length === 0) {
      console.log(`NFL player not found: ${playerName}`);
      return null;
    }
    
    const player = searchData.athletes[0];
    const playerId = player.id;
    
    // Get player game log
    const statsUrl = `${ESPN_BASE}/football/nfl/athletes/${playerId}/gamelog`;
    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();
    
    // Parse recent games (last 5)
    const recentGames: ESPNGameLog[] = [];
    if (statsData.events) {
      const games = statsData.events.slice(0, 5);
      
      for (const game of games) {
        const stats: Record<string, number> = {};
        
        // Parse stats from game
        if (game.statistics) {
          game.statistics.forEach((stat: any) => {
            stats[stat.name] = parseFloat(stat.value) || 0;
          });
        }
        
        recentGames.push({
          gameDate: game.date,
          opponent: game.opponent?.displayName || 'Unknown',
          stats
        });
      }
    }
    
    return {
      playerName: player.displayName,
      team: player.team?.displayName || 'Unknown',
      recentGames
    };
  } catch (error) {
    console.error('Error fetching NFL stats:', error);
    return null;
  }
}

/**
 * Get MLB player stats
 */
export async function getMLBPlayerStats(playerName: string): Promise<ESPNPlayerStats | null> {
  try {
    const searchUrl = `${ESPN_BASE}/baseball/mlb/athletes?search=${encodeURIComponent(playerName)}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.athletes || searchData.athletes.length === 0) {
      console.log(`MLB player not found: ${playerName}`);
      return null;
    }
    
    const player = searchData.athletes[0];
    const playerId = player.id;
    
    const statsUrl = `${ESPN_BASE}/baseball/mlb/athletes/${playerId}/gamelog`;
    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();
    
    const recentGames: ESPNGameLog[] = [];
    if (statsData.events) {
      const games = statsData.events.slice(0, 5);
      
      for (const game of games) {
        const stats: Record<string, number> = {};
        
        if (game.statistics) {
          game.statistics.forEach((stat: any) => {
            stats[stat.name] = parseFloat(stat.value) || 0;
          });
        }
        
        recentGames.push({
          gameDate: game.date,
          opponent: game.opponent?.displayName || 'Unknown',
          stats
        });
      }
    }
    
    return {
      playerName: player.displayName,
      team: player.team?.displayName || 'Unknown',
      recentGames
    };
  } catch (error) {
    console.error('Error fetching MLB stats:', error);
    return null;
  }
}

/**
 * Get NHL player stats
 */
export async function getNHLPlayerStats(playerName: string): Promise<ESPNPlayerStats | null> {
  try {
    const searchUrl = `${ESPN_BASE}/hockey/nhl/athletes?search=${encodeURIComponent(playerName)}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.athletes || searchData.athletes.length === 0) {
      console.log(`NHL player not found: ${playerName}`);
      return null;
    }
    
    const player = searchData.athletes[0];
    const playerId = player.id;
    
    const statsUrl = `${ESPN_BASE}/hockey/nhl/athletes/${playerId}/gamelog`;
    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();
    
    const recentGames: ESPNGameLog[] = [];
    if (statsData.events) {
      const games = statsData.events.slice(0, 5);
      
      for (const game of games) {
        const stats: Record<string, number> = {};
        
        if (game.statistics) {
          game.statistics.forEach((stat: any) => {
            stats[stat.name] = parseFloat(stat.value) || 0;
          });
        }
        
        recentGames.push({
          gameDate: game.date,
          opponent: game.opponent?.displayName || 'Unknown',
          stats
        });
      }
    }
    
    return {
      playerName: player.displayName,
      team: player.team?.displayName || 'Unknown',
      recentGames
    };
  } catch (error) {
    console.error('Error fetching NHL stats:', error);
    return null;
  }
}
