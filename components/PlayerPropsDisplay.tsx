// components/PlayerPropsDisplay.tsx
import { supabase } from '@/lib/supabase';
import { analyzeBet } from '@/lib/analysis-engine';
import { PlayerPropCard } from '@/components/ui/OddsComponents';
import { transformGameToAnalysisFormat, transformPlayerPropsToAnalysisFormat } from '@/lib/supabase-adapter';
import type { PlayerProp } from '@/lib/types';

async function loadPlayerProps(gameId: string) {
  // Load props via server API (v2-first, strict to game)
  const params = new URLSearchParams()
  params.set('game_ids', gameId)
  params.set('limit', '200')
  params.set('strict', '1')
  const resp = await fetch(`/api/featured-props?${params.toString()}`)
  const json = await resp.json().catch(() => ({ props: [] }))
  const props: PlayerProp[] = Array.isArray(json?.props) ? (json.props as PlayerProp[]) : []
  if (!props || props.length === 0) return [];

  // Get game data
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) return [];

  // (Optional) Odds not needed here for prop-by-prop analysis

  // Transform player props to bookmaker format
  const bookmakers = transformPlayerPropsToAnalysisFormat(game, props);

  // Analyze each prop
  const analyzed = await Promise.all(
    props.map(async (prop: PlayerProp) => {
      const bet = {
        id: `${prop.id}-over`,
        betType: 'player_prop' as const,
        market: prop.prop_type,
        selection: 'Over',
        line: prop.line,
        odds: (prop.over_odds ?? -110),
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