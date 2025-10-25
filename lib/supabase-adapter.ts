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
  // Check if this is v2 format (has 'market' field) or legacy format
  const isV2Format = oddsData.some((row: any) => row.market !== undefined)
  
  if (isV2Format) {
    // Group v2 rows by book
    const byBook = new Map<string, any>()
    
    oddsData.forEach((row: any) => {
      const bookKey = row.book_key || row.sportsbook?.toLowerCase() || 'unknown'
      const bookName = row.book_name || row.sportsbook || 'Unknown'
      
      if (!byBook.has(bookKey)) {
        byBook.set(bookKey, {
          key: bookKey,
          title: bookName,
          lastUpdate: row.updated_at || new Date().toISOString(),
          spread: {},
          total: {},
          moneyline: {}
        })
      }
      
      const book = byBook.get(bookKey)!
      
      if (row.market === 'spread') {
        book.spread = {
          home: row.spread_home,
          away: row.spread_away,
          home_odds: row.spread_home_odds,
          away_odds: row.spread_away_odds
        }
      } else if (row.market === 'total') {
        book.total = {
          line: row.line,
          over_odds: row.over_odds,
          under_odds: row.under_odds
        }
      } else if (row.market === 'moneyline') {
        book.moneyline = {
          home: row.moneyline_home,
          away: row.moneyline_away
        }
      }
    })
    
    // Convert to bookmaker format
    const bookmakers: BookmakerOdds[] = Array.from(byBook.values()).map(book => {
      const markets = []
      
      // Only add markets that have data
      if (book.spread.home_odds !== undefined) {
        markets.push({
          key: 'spreads',
          outcomes: [
            {
              name: game.home_team,
              price: Number(book.spread.home_odds),
              point: Number(book.spread.home)
            },
            {
              name: game.away_team,
              price: Number(book.spread.away_odds),
              point: Number(book.spread.away)
            }
          ]
        })
      }
      
      if (book.total.over_odds !== undefined) {
        markets.push({
          key: 'totals',
          outcomes: [
            {
              name: 'Over',
              price: Number(book.total.over_odds),
              point: Number(book.total.line)
            },
            {
              name: 'Under',
              price: Number(book.total.under_odds),
              point: Number(book.total.line)
            }
          ]
        })
      }
      
      if (book.moneyline.home !== undefined) {
        markets.push({
          key: 'h2h',
          outcomes: [
            {
              name: game.home_team,
              price: Number(book.moneyline.home)
            },
            {
              name: game.away_team,
              price: Number(book.moneyline.away)
            }
          ]
        })
      }
      
      return {
        key: book.key,
        title: book.title,
        lastUpdate: book.lastUpdate,
        markets
      }
    })
    
    return {
      eventId: game.id,
      sport: game.sport,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      commenceTime: game.game_date,
      bookmakers
    }
  }
  
  // Legacy format - keep existing logic
  const bookmakers: BookmakerOdds[] = oddsData.map(odd => ({
    key: odd.sportsbook?.toLowerCase() || 'unknown',
    title: odd.sportsbook || 'Unknown',
    lastUpdate: (odd as any).last_update || (odd as any).updated_at || new Date().toISOString(),
    markets: [
      {
        key: 'spreads',
        outcomes: [
          {
            name: game.home_team,
            price: Number(odd.spread_home_odds),
            point: Number(odd.spread_home)
          },
          {
            name: game.away_team,
            price: Number(odd.spread_away_odds),
            point: Number(odd.spread_away)
          }
        ].filter(o => o.price)
      },
      {
        key: 'totals',
        outcomes: [
          {
            name: 'Over',
            price: Number(odd.over_odds),
            point: Number(odd.total)
          },
          {
            name: 'Under',
            price: Number(odd.under_odds),
            point: Number(odd.total)
          }
        ].filter(o => o.price)
      },
      {
        key: 'h2h',
        outcomes: [
          {
            name: game.home_team,
            price: Number(odd.moneyline_home)
          },
          {
            name: game.away_team,
            price: Number(odd.moneyline_away)
          }
        ].filter(o => o.price)
      }
    ].filter(m => m.outcomes.length > 0)
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