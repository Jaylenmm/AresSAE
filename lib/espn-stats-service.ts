/**
 * ESPN Stats Service
 * Uses ESPN's public API - search is direct, stats go through proxy
 */

const ESPN_PROXY_URL = process.env.ESPN_PROXY_URL;
const ESPN_STATS_BASE = ESPN_PROXY_URL 
  ? `${ESPN_PROXY_URL}/espn`
  : 'https://site.api.espn.com/apis/site/v2/sports';

// Search endpoint is always direct (not proxied)
const ESPN_SEARCH_BASE = 'https://site.web.api.espn.com/apis/search/v2';

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
    console.log(`Searching for NFL player: ${playerName}`);
    
    // Use ESPN's search endpoint (direct, not through proxy)
    const searchUrl = `${ESPN_SEARCH_BASE}?query=${encodeURIComponent(playerName)}&limit=10&type=player&sport=football&league=nfl`;
    
    console.log(`Search URL: ${searchUrl}`);
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    console.log('ESPN Search Response:', JSON.stringify(searchData).substring(0, 500));
    
    // Find player in results - structure is results[0].contents[0]
    let playerId = null;
    if (searchData.results && searchData.results.length > 0) {
      const playerResult = searchData.results.find((r: any) => r.type === 'player');
      
      if (playerResult && playerResult.contents && playerResult.contents.length > 0) {
        const player = playerResult.contents[0];
        // Extract numeric ID from uid (format: "s:20~l:28~a:4431452")
        const uidMatch = player.uid?.match(/a:(\d+)/);
        if (uidMatch) {
          playerId = uidMatch[1];
        }
      }
    }
    
    if (!playerId) {
      console.log(`NFL player not found: ${playerName}`);
      return null;
    }
    
    console.log(`Found player ID: ${playerId}`);
    
    // Get player stats - use simpler endpoint
    const statsUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${playerId}`;
    console.log(`Stats URL: ${statsUrl}`);
    
    const statsResponse = await fetch(statsUrl);
    const statsData = await statsResponse.json();
    
    console.log('Stats response:', JSON.stringify(statsData).substring(0, 300));
    
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
      playerName: playerName,
      team: 'NFL',
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
    const searchUrl = `${ESPN_STATS_BASE}/baseball/mlb/athletes?search=${encodeURIComponent(playerName)}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.athletes || searchData.athletes.length === 0) {
      console.log(`MLB player not found: ${playerName}`);
      return null;
    }
    
    const player = searchData.athletes[0];
    const playerId = player.id;
    
    const statsUrl = `${ESPN_STATS_BASE}/baseball/mlb/athletes/${playerId}/gamelog`;
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
    const searchUrl = `${ESPN_STATS_BASE}/hockey/nhl/athletes?search=${encodeURIComponent(playerName)}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.athletes || searchData.athletes.length === 0) {
      console.log(`NHL player not found: ${playerName}`);
      return null;
    }
    
    const player = searchData.athletes[0];
    const playerId = player.id;
    
    const statsUrl = `${ESPN_STATS_BASE}/hockey/nhl/athletes/${playerId}/gamelog`;
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
