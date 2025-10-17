// lib/supabase-adapter.ts
// Transforms your Supabase data structure into the format the analysis engine expects

import { Game, OddsData, PlayerProp } from '@/lib/types';
import { BookmakerOdds, BetOption } from '@/lib/analysis-engine';

/**
 * Transform Supabase game + odds into Odds API format for analysis engine
 */
export function transformGameToAnalysisFormat(
  game: Game,
  oddsData: OddsData[]
): { 
  eventId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: BookmakerOdds[];
} {
  // Transform odds from your database into bookmaker format
  const bookmakers: BookmakerOdds[] = oddsData.map(odd => ({
    key: odd.sportsbook?.toLowerCase() || 'unknown',
    title: odd.sportsbook || 'Unknown',
    lastUpdate: (odd as any).last_update || (odd as any).updated_at || new Date().toISOString(),
    markets: [
      // Spreads market
      {
        key: 'spreads',
        outcomes: [
          {
            name: game.home_team,
            price: Number(odd.spread_home_odds) || -110,
            point: Number(odd.spread_home) || 0
          },
          {
            name: game.away_team,
            price: Number(odd.spread_away_odds) || -110,
            point: Number(odd.spread_away) || 0
          }
        ]
      },
      // Totals market
      {
        key: 'totals',
        outcomes: [
          {
            name: 'Over',
            price: Number(odd.over_odds) || -110,
            point: Number(odd.total) || 0
          },
          {
            name: 'Under',
            price: Number(odd.under_odds) || -110,
            point: Number(odd.total) || 0
          }
        ]
      },
      // Moneyline market
      {
        key: 'h2h',
        outcomes: [
          {
            name: game.home_team,
            price: Number(odd.moneyline_home) || -110
          },
          {
            name: game.away_team,
            price: Number(odd.moneyline_away) || -110
          }
        ]
      }
    ]
  }));

  return {
    eventId: game.id,
    sport: game.sport,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    commenceTime: game.game_date,
    bookmakers
  };
}

/**
 * Transform player props from your database into bookmaker format
 */
export function transformPlayerPropsToAnalysisFormat(
  game: Game,
  playerProps: PlayerProp[]
): BookmakerOdds[] {
  // Group props by sportsbook
  const propsBySportsbook = new Map<string, PlayerProp[]>();
  
  playerProps.forEach(prop => {
    const book = prop.sportsbook?.toLowerCase() || 'unknown';
    if (!propsBySportsbook.has(book)) {
      propsBySportsbook.set(book, []);
    }
    propsBySportsbook.get(book)!.push(prop);
  });

  // Transform into bookmaker format
  const bookmakers: BookmakerOdds[] = [];

  propsBySportsbook.forEach((props, bookKey) => {
    // Group props by player and type
    const markets = new Map<string, any>();

    props.forEach(prop => {
      const marketKey = prop.prop_type;
      
      if (!markets.has(marketKey)) {
        markets.set(marketKey, []);
      }

      markets.get(marketKey)!.push({
        name: 'Over',
        price: Number(prop.over_odds) || -110,
        point: Number(prop.line) || 0,
        description: prop.player_name
      }, {
        name: 'Under',
        price: Number(prop.under_odds) || -110,
        point: Number(prop.line) || 0,
        description: prop.player_name
      });
    });

    bookmakers.push({
      key: bookKey,
      title: props[0].sportsbook || 'Unknown',
      lastUpdate: (props[0] as any).updated_at || (props[0] as any).last_update || new Date().toISOString(),
      markets: Array.from(markets.entries()).map(([key, outcomes]) => ({
        key,
        outcomes
      }))
    });
  });

  return bookmakers;
}

/**
 * Create BetOption from your bet selection format
 */
export function createBetOptionFromSelection(bet: any, game: Game): BetOption {
  if (bet.bet_type === 'player_prop' || bet.player) {
    return {
      id: `prop-${Date.now()}`,
      betType: 'player_prop',
      market: bet.prop_type || bet.propType,
      selection: bet.selection === 'over' ? 'Over' : 'Under',
      line: Number(bet.line),
      odds: Number(bet.odds),
      sportsbook: bet.sportsbook?.toLowerCase() || 'unknown',
      playerName: bet.player || bet.player_name,
      eventId: game.id,
      sport: game.sport
    };
  }

  // Game bet (spread, total, moneyline)
  let market = 'h2h';
  let selection = bet.team || bet.selection;
  let line: number | undefined;

  if (bet.type === 'spread' || bet.bet_type === 'spread') {
    market = 'spreads';
    line = Number(bet.line);
  } else if (bet.type === 'total' || bet.bet_type === 'total') {
    market = 'totals';
    selection = bet.selection; // 'Over' or 'Under'
    line = Number(bet.line);
  }

  return {
    id: `game-${Date.now()}`,
    betType: market as any,
    market,
    selection,
    line,
    odds: Number(bet.odds),
    sportsbook: bet.sportsbook?.toLowerCase() || 'unknown',
    eventId: game.id,
    sport: game.sport
  };
}