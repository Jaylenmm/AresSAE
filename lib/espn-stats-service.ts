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
 * Get NFL player stats - scrape from NFL.com
 */
export async function getNFLPlayerStats(playerName: string): Promise<ESPNPlayerStats | null> {
  try {
    console.log(`Scraping NFL.com for: ${playerName}`);
    
    // NFL.com player page URL format
    const playerSlug = playerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const profileUrl = `https://www.nfl.com/players/${playerSlug}/`;
    
    console.log(`Fetching: ${profileUrl}`);
    
    const response = await fetch(profileUrl);
    const html = await response.text();
    
    // Extract game log data from the page
    // NFL.com embeds data in __NEXT_DATA__ script tag
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    
    if (!nextDataMatch) {
      console.log('Could not find __NEXT_DATA__ in page');
      return {
        playerName: playerName,
        team: 'NFL',
        recentGames: []
      };
    }
    
    const pageData = JSON.parse(nextDataMatch[1]);
    console.log('Page data keys:', Object.keys(pageData));
    
    // Navigate to game logs in the data structure
    const playerData = pageData.props?.pageProps?.player;
    const gameLogs = playerData?.stats?.gameLogs || [];
    
    const recentGames: ESPNGameLog[] = [];
    
    // Parse last 5 games
    for (const game of gameLogs.slice(0, 5)) {
      const stats: Record<string, number> = {};
      
      // Extract stats from game object
      if (game.stats) {
        Object.entries(game.stats).forEach(([key, value]) => {
          stats[key] = parseFloat(value as string) || 0;
        });
      }
      
      recentGames.push({
        gameDate: game.gameDate || game.date || '',
        opponent: game.opponent || 'Unknown',
        stats
      });
    }
    
    console.log(`Scraped ${recentGames.length} games for ${playerName}`);
    
    return {
      playerName: playerName,
      team: playerData?.team?.abbreviation || 'NFL',
      recentGames
    };
  } catch (error) {
    console.error('Error scraping NFL stats:', error);
    return {
      playerName: playerName,
      team: 'NFL',
      recentGames: []
    };
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
