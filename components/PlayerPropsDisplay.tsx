// components/PlayerPropsDisplay.tsx
import { supabase } from '@/lib/supabase';
import { analyzeBet } from '@/lib/analysis-engine';
import { PlayerPropCard } from '@/components/ui/OddsComponents';
import { transformGameToAnalysisFormat, transformPlayerPropsToAnalysisFormat } from '@/lib/supabase-adapter';

async function loadPlayerProps(gameId: string) {
  // Fetch from your player_props table
  const { data: props } = await supabase
    .from('player_props')
    .select('*')
    .eq('game_id', gameId);
  
  if (!props) return [];
  
  // Get game data
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) return [];

  // Get all odds for this game
  const { data: oddsData } = await supabase
    .from('odds_data')
    .select('*')
    .eq('game_id', gameId);
  
  // Transform player props to bookmaker format
  const bookmakers = transformPlayerPropsToAnalysisFormat(game, props);
  
  // Analyze each prop
  const analyzed = await Promise.all(
    props.map(async prop => {
      const bet = {
        id: `${prop.id}-over`,
        betType: 'player_prop' as const,
        market: prop.prop_type,
        selection: 'Over',
        line: prop.line,
        odds: prop.over_odds,
        sportsbook: prop.sportsbook?.toLowerCase() || 'unknown',
        playerName: prop.player_name,
        eventId: gameId,
        sport: game.sport
      };
      
      const analysis = analyzeBet(bet, bookmakers);
      
      return { prop, analysis };
    })
  );
  
  return analyzed;
}

export default loadPlayerProps;