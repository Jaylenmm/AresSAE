/**
 * Highlightly API Service
 * Free tier: 100 requests/day
 * Covers: NFL, NBA, MLB, NHL, NCAAF, NCAAB player stats, live scores
 */

const HIGHLIGHTLY_BASE = 'https://sport-highlights-api.p.rapidapi.com';

export interface HighlightlyPlayerStats {
  playerName: string;
  team: string;
  sport: string;
  source: 'highlightly'; // Explicitly mark source
  recentGames: Array<{
    gameDate: string;
    opponent: string;
    stats: Record<string, number>;
  }>;
}

/**
 * Get player stats from Highlightly API
 * Supports: NFL, NBA, MLB, NHL, NCAAF, NCAAB
 */
export async function getPlayerStats(
  playerName: string,
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl' | 'ncaaf' | 'ncaab'
): Promise<HighlightlyPlayerStats | null> {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  if (!apiKey) {
    console.log('⚠️ Highlightly API key not configured - skipping');
    return null;
  }

  try {
    console.log(`🔍 [HIGHLIGHTLY] Fetching ${sport.toUpperCase()} stats for ${playerName}...`);

    // Determine base route per sport
    // NBA + NCAAB share the NBA group; NFL + NCAAF share American Football
    let playersRoute: string | null = null;
    if (sport === 'nba' || sport === 'ncaab') {
      playersRoute = '/nba/players';
    } else if (sport === 'nfl' || sport === 'ncaaf') {
      playersRoute = '/american-football/players';
    } else {
      // Not yet wired for MLB/NHL in Highlightly
      console.log(`⚠️ [HIGHLIGHTLY] Sport ${sport} not wired to players endpoint – skipping`);
      return null;
    }

    const params = new URLSearchParams({
      name: playerName,
      limit: '5',
      offset: '0',
    });

    const searchUrl = `${HIGHLIGHTLY_BASE}${playersRoute}?${params.toString()}`;
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'sport-highlights-api.p.rapidapi.com',
      },
    });

    if (!searchResponse.ok) {
      if (searchResponse.status === 429) {
        console.log('⚠️ [HIGHLIGHTLY] Rate limit exceeded (100/day) - falling back to existing service');
        return null;
      }
      console.log(`❌ [HIGHLIGHTLY] Search failed: ${searchResponse.status}`);
      return null;
    }

    const searchData = await searchResponse.json();
    console.log(`📊 [HIGHLIGHTLY] Search response:`, JSON.stringify(searchData).substring(0, 200));
    
    if (!searchData.data || searchData.data.length === 0) {
      console.log(`❌ [HIGHLIGHTLY] Player not found: ${playerName}`);
      return null;
    }

    const player = searchData.data[0];
    const playerId = player.id;

    console.log(`✅ [HIGHLIGHTLY] Found player: ${player.name} (ID: ${playerId})`);

    // Get player statistics (per Highlightly docs: players/{playerId}/statistics)
    const statsUrl = `${HIGHLIGHTLY_BASE}${playersRoute}/${playerId}/statistics`;
    const statsResponse = await fetch(statsUrl, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'sport-highlights-api.p.rapidapi.com'
      }
    });

    if (!statsResponse.ok) {
      if (statsResponse.status === 429) {
        console.log('⚠️ [HIGHLIGHTLY] Rate limit exceeded - falling back');
        return null;
      }
      console.log(`❌ [HIGHLIGHTLY] Stats fetch failed: ${statsResponse.status}`);
      return null;
    }

    const statsData = await statsResponse.json();
    console.log(`📊 [HIGHLIGHTLY] Stats response:`, JSON.stringify(statsData).substring(0, 300));

    const recentGames = (statsData.data?.games || []).slice(0, 5).map((game: any) => ({
      gameDate: game.date || game.game_date,
      opponent: game.opponent?.name || game.opponent_name || 'Unknown',
      stats: game.statistics || game.stats || {}
    }));

    console.log(`✅ [HIGHLIGHTLY] Successfully fetched ${recentGames.length} games for ${playerName}`);

    return {
      playerName: player.name,
      team: player.team?.name || player.team_name || sport.toUpperCase(),
      sport: sport.toUpperCase(),
      source: 'highlightly',
      recentGames
    };

  } catch (error: any) {
    console.error('❌ [HIGHLIGHTLY] API error:', error.message);
    return null;
  }
}

/**
 * Get live scores for a sport
 */
export async function getLiveScores(sport: 'nfl' | 'nba' | 'mlb' | 'nhl' | 'ncaaf' | 'ncaab') {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  if (!apiKey) {
    console.log('⚠️ Highlightly API key not configured');
    return null;
  }

  try {
    console.log(`🔴 [HIGHLIGHTLY] Fetching live scores for ${sport.toUpperCase()}...`);

    const sportMap: Record<string, number> = {
      'nfl': 1,
      'nba': 2,
      'mlb': 3,
      'nhl': 4,
      'ncaaf': 1,
      'ncaab': 2
    };

    const sportId = sportMap[sport];
    const url = `${HIGHLIGHTLY_BASE}/live-scores?sport_id=${sportId}`;

    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'sport-highlights-api.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log('⚠️ [HIGHLIGHTLY] Rate limit exceeded');
        return null;
      }
      return null;
    }

    const data = await response.json();
    console.log(`✅ [HIGHLIGHTLY] Fetched ${data.data?.length || 0} live games`);
    
    return data.data || [];

  } catch (error: any) {
    console.error('❌ [HIGHLIGHTLY] Live scores error:', error.message);
    return null;
  }
}
