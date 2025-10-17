// lib/supabase-transformer.ts

export function transformSupabaseToOddsAPI(supabaseGame: any) {
  return {
    id: supabaseGame.id,
    sport_key: supabaseGame.sport,
    sport_title: supabaseGame.sport,
    commence_time: supabaseGame.commence_time,
    home_team: supabaseGame.home_team,
    away_team: supabaseGame.away_team,
    bookmakers: supabaseGame.odds?.map((odd: any) => ({
      key: odd.sportsbook,
      title: odd.sportsbook,
      last_update: odd.last_update,
      markets: [{
        key: odd.market_type,
        outcomes: JSON.parse(odd.outcomes) // Your odds are stored as JSON
      }]
    })) || []
  };
}