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
    
    // Try NFL.com API instead - they have game logs
    // First get player profile to find their NFL.com ID
    const nflSearchUrl = `https://api.nfl.com/v1/players?name=${encodeURIComponent(playerName)}`;
    console.log(`NFL Search URL: ${nflSearchUrl}`);
    
    const nflSearchResponse = await fetch(nflSearchUrl);
    const nflSearchData = await nflSearchResponse.json();
    
    console.log('NFL Search Response:', JSON.stringify(nflSearchData).substring(0, 500));
    
    if (!nflSearchData.players || nflSearchData.players.length === 0) {
      console.log('Player not found on NFL.com');
      return {
        playerName: playerName,
        team: 'NFL',
        recentGames: []
      };
    }
    
    const nflPlayer = nflSearchData.players[0];
    const nflPlayerId = nflPlayer.id;
    
    // Get game logs
    const gameLogUrl = `https://api.nfl.com/v1/players/${nflPlayerId}/stats/2024`;
    const gameLogResponse = await fetch(gameLogUrl);
    const statsData = await gameLogResponse.json();
    
    console.log('NFL Stats response:', JSON.stringify(statsData).substring(0, 1000));
    
    // Parse recent games from athlete.statistics or athlete.eventLog
    const recentGames: ESPNGameLog[] = [];
    
    // Try eventLog first
    if (statsData.athlete?.eventLog?.events) {
      const games = statsData.athlete.eventLog.events.slice(0, 5);
      
      for (const event of games) {
        const stats: Record<string, number> = {};
        
        // Parse stats from event
        if (event.stats) {
          event.stats.forEach((stat: any) => {
            stats[stat.displayName || stat.name] = parseFloat(stat.value) || 0;
          });
        }
        
        recentGames.push({
          gameDate: event.gameDate || event.date,
          opponent: event.opponent?.displayName || event.opponent?.team?.displayName || 'Unknown',
          stats
        });
      }
    }
    
    console.log(`Parsed ${recentGames.length} games`);
    
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
