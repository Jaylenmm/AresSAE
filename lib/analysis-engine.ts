// lib/analysis-engine.ts
// Updated with new edge calculation methodology

import {
  americanOddsToImpliedProbability,
  americanToDecimal,
  removeVig,
  calculateEV,
} from './odds-calculations'
import { getBookmakerDisplayName } from './bookmakers'
import { analyzeNBAProp, type PropAnalysis } from './nba-prop-analyzer'
import { analyzeNflProp, type NflPropAnalysis } from './nfl-prop-analyzer'

export type BetType = 'h2h' | 'spreads' | 'totals' | 'player_prop' | 'futures';

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

export interface BookmakerOdds {
  key: string;
  title: string;
  lastUpdate: string;
  markets: Array<{
    key: string;
    outcomes: OddsOutcome[];
  }>;
}

export interface BetOption {
  id: string;
  betType: BetType;
  market: string;
  selection: string;
  line?: number;
  odds: number;
  sportsbook: string;
  playerName?: string;
  eventId?: string;
  sport?: string;
}

export interface AnalysisResult {
  bestOdds: number;
  bestSportsbook: string;
  worstOdds: number;
  worstSportsbook: string;
  oddsRange: number;
  expectedValue: number;
  edge: number;
  confidence: number;
  marketEfficiency: 'efficient' | 'inefficient' | 'highly_inefficient';
  sharpConsensus: 'agree' | 'disagree' | 'mixed' | 'unavailable';
  lineMovement: 'toward' | 'away' | 'stable' | 'unknown';
  sharpBookOdds: number | null;
  sharpBookName: string | null;
  sharpLine: number | null;
  sharpLineDistance: number;
  trueProbability: number | null;
  softBookBestOdds: number | null;
  softBookBestName: string | null;
  recommendation: 'strong_bet' | 'bet' | 'consider' | 'avoid' | 'no_edge';
  reasons: string[];
  warnings: string[];
  allOdds: Array<{
    sportsbook: string;
    odds: number;
    isSharp: boolean;
  }>;
  // NBA Stats Analysis (when available)
  nbaAnalysis?: PropAnalysis;
  // NFL Stats Analysis (when available)
  nflAnalysis?: NflPropAnalysis;
}

const SHARP_BOOKMAKERS = ['pinnacle', 'betonline', 'bookmaker', 'circa', 'circasports'];

// For player props: Sharp-ish books that actually offer props
const SHARP_PROP_BOOKMAKERS = ['fanduel', 'betonlineag', 'lowvig', 'draftkings'];
const SOFT_PROP_BOOKMAKERS = ['betmgm', 'caesars', 'espnbet'];

// Weights for building sharp consensus from multiple sharp-ish books
const PROP_BOOK_WEIGHTS: Record<string, number> = {
  'fanduel': 1.0,
  'betonlineag': 0.9,
  'lowvig': 0.85,
  'draftkings': 0.75
};

function isSharpBook(bookmakerKey: string): boolean {
  const normalized = bookmakerKey.toLowerCase().replace(/\s+/g, '');
  return SHARP_BOOKMAKERS.some(sharp => normalized.includes(sharp));
}

function isSharpPropBook(bookmakerKey: string): boolean {
  const normalized = bookmakerKey.toLowerCase().replace(/\s+/g, '');
  return SHARP_PROP_BOOKMAKERS.some(sharp => normalized.includes(sharp));
}

/**
 * Build sharp consensus for player props from multiple sharp-ish books
 * Returns weighted average of no-vig probabilities
 */
function buildPropSharpConsensus(
  market: string,
  selection: string,
  requestedLine: number | undefined,
  allBookmakerData: BookmakerOdds[]
): {
  odds: number;
  opposingOdds: number;
  trueProbability: number;
  booksUsed: string[];
  confidence: number;
} | null {
  const sharpPropOdds: Array<{
    sportsbook: string;
    odds: number;
    opposingOdds: number;
    line: number;
    weight: number;
  }> = [];

  for (const bookmaker of allBookmakerData) {
    const normalized = bookmaker.key.toLowerCase().replace(/\s+/g, '');
    if (!isSharpPropBook(normalized)) continue;

    const marketData = bookmaker.markets.find(m => m.key === market);
    if (!marketData) continue;

    const outcome = marketData.outcomes.find(o => o.name === selection);
    if (!outcome) continue;

    // For props, find opposing side
    const opposingSelection = selection === 'Over' ? 'Under' : (selection === 'Under' ? 'Over' : null);
    const opposingOutcome = opposingSelection 
      ? marketData.outcomes.find(o => o.name === opposingSelection)
      : null;

    if (!opposingOutcome) continue;

    // Check line match
    const line = outcome.point ?? 0;
    if (requestedLine !== undefined && Math.abs(line - requestedLine) > 0.5) continue;

    const weight = PROP_BOOK_WEIGHTS[normalized] || 0.5;

    sharpPropOdds.push({
      sportsbook: bookmaker.title,
      odds: outcome.price,
      opposingOdds: opposingOutcome.price,
      line,
      weight
    });
  }

  if (sharpPropOdds.length === 0) return null;

  // Calculate weighted average of no-vig probabilities
  let totalProb = 0;
  let totalWeight = 0;

  for (const book of sharpPropOdds) {
    const { prob1 } = removeVig(book.odds, book.opposingOdds);
    totalProb += prob1 * book.weight;
    totalWeight += book.weight;
  }

  const consensusProb = totalProb / totalWeight;
  const consensusOpposingProb = 1 - consensusProb;

  // Convert back to American odds
  const consensusOdds = consensusProb >= 0.5
    ? Math.round(-100 * consensusProb / (1 - consensusProb))
    : Math.round(100 * (1 - consensusProb) / consensusProb);

  const consensusOpposingOdds = consensusOpposingProb >= 0.5
    ? Math.round(-100 * consensusOpposingProb / (1 - consensusOpposingProb))
    : Math.round(100 * (1 - consensusOpposingProb) / consensusOpposingProb);

  // Calculate confidence based on agreement (lower variance = higher confidence)
  const probs = sharpPropOdds.map(b => {
    const { prob1 } = removeVig(b.odds, b.opposingOdds);
    return prob1;
  });
  const avgProb = probs.reduce((a, b) => a + b, 0) / probs.length;
  const variance = probs.reduce((sum, p) => sum + Math.pow(p - avgProb, 2), 0) / probs.length;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.max(0, 1 - (stdDev * 20)); // 0-1 scale

  return {
    odds: consensusOdds,
    opposingOdds: consensusOpposingOdds,
    trueProbability: consensusProb,
    booksUsed: sharpPropOdds.map(b => b.sportsbook),
    confidence
  };
}

function findSharpConsensus(
  market: string,
  selection: string,
  requestedLine: number | undefined,
  playerName: string | undefined,
  allBookmakerData: BookmakerOdds[]
): {
  odds: number;
  opposingOdds: number | null;
  sportsbook: string;
  line: number;
  lineDistance: number;
} | null {
  
  const sharpBookOdds: Array<{
    sportsbook: string;
    odds: number;
    opposingOdds: number | null;
    line: number;
    lineDistance: number;
  }> = [];

  for (const bookmaker of allBookmakerData) {
    if (!isSharpBook(bookmaker.key)) continue;

    const marketData = bookmaker.markets.find(m => m.key === market);
    if (!marketData) continue;

    const outcome = marketData.outcomes.find(o => {
      const matchesName = o.name === selection;
      const matchesPlayer = !playerName || o.description === playerName;
      
      if (requestedLine === undefined) {
        return matchesName && matchesPlayer;
      }
      
      const outcomeLine = o.point ?? 0;
      const lineDistance = Math.abs(outcomeLine - requestedLine);
      
      return matchesName && matchesPlayer && lineDistance <= 2;
    });

    if (!outcome) continue;

    let opposingOdds: number | null = null;
    const opposingOutcome = marketData.outcomes.find(o => {
      const samePlayer = !playerName || o.description === playerName;
      const sameLine = (o.point ?? 0) === (outcome.point ?? 0);
      const opposingSide = o.name !== selection;
      return samePlayer && sameLine && opposingSide;
    });
    
    if (opposingOutcome) {
      opposingOdds = opposingOutcome.price;
    }

    const outcomeLine = outcome.point ?? requestedLine ?? 0;
    const lineDistance = requestedLine !== undefined 
      ? Math.abs(outcomeLine - requestedLine) 
      : 0;

    sharpBookOdds.push({
      sportsbook: bookmaker.key,
      odds: outcome.price,
      opposingOdds,
      line: outcomeLine,
      lineDistance: lineDistance
    });
  }

  if (sharpBookOdds.length === 0) return null;

  sharpBookOdds.sort((a, b) => {
    if (a.lineDistance !== b.lineDistance) return a.lineDistance - b.lineDistance;
    if (a.sportsbook.includes('pinnacle')) return -1;
    if (b.sportsbook.includes('pinnacle')) return 1;
    return 0;
  });

  return sharpBookOdds[0];
}

export async function analyzeBet(
  betOption: BetOption,
  allBookmakerData: BookmakerOdds[]
): Promise<AnalysisResult> {
  const hasUserOdds = betOption.odds !== 0;

  let relevantOdds = allBookmakerData
    .map(bookmaker => {
      const market = bookmaker.markets.find(m => m.key === betOption.market);
      if (!market) return null;
      
      const outcome = market.outcomes.find(o => {
        const matchesName = o.name === betOption.selection;
        const matchesLine = betOption.line === undefined || o.point === betOption.line;
        const matchesPlayer = !betOption.playerName || o.description === betOption.playerName;
        return matchesName && matchesLine && matchesPlayer;
      });
      
      if (!outcome) return null;
      
      return {
        sportsbook: bookmaker.key,
        odds: outcome.price,
        isSharp: isSharpBook(bookmaker.key)
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // For player props (especially user-entered alternate lines that no book
  // is hanging), we still want to run stats-based analysis even if there are
  // no matching market odds at this exact line. In that case, synthesize a
  // minimal odds row so we don't bail out early with `No odds data available`.
  if (relevantOdds.length === 0 && betOption.betType === 'player_prop') {
    const fallbackOdds = hasUserOdds ? betOption.odds : -110;
    relevantOdds = [{
      sportsbook: betOption.sportsbook,
      odds: fallbackOdds,
      isSharp: false,
    }];
  }

  if (relevantOdds.length === 0) {
    return createEmptyAnalysis();
  }
  
  const sharpOdds = relevantOdds.filter(o => o.isSharp);
  const softOdds = relevantOdds.filter(o => !o.isSharp);
  
  const sortedOdds = [...relevantOdds].sort((a, b) => b.odds - a.odds);
  const best = sortedOdds[0];
  const worst = sortedOdds[sortedOdds.length - 1];
  const oddsRange = best.odds - worst.odds;
  
  // For player props, use sharp-ish consensus; for game lines, use traditional sharp books
  const isPlayerProp = betOption.betType === 'player_prop';
  
  let sharpConsensus: any = null;
  let propConsensus: any = null;
  
  if (isPlayerProp) {
    propConsensus = buildPropSharpConsensus(
      betOption.market,
      betOption.selection,
      betOption.line,
      allBookmakerData
    );
  } else {
    sharpConsensus = findSharpConsensus(
      betOption.market,
      betOption.selection,
      betOption.line,
      betOption.playerName,
      allBookmakerData
    );
  }
  
  let trueProbability: number | null = null;
  let edge = 0;
  let expectedValue = 0;
  let usingSoftFallback = false;
  
  if (propConsensus) {
    // Use prop consensus (weighted average of sharp-ish books)
    trueProbability = propConsensus.trueProbability;
    if (hasUserOdds) {
      const impliedProbability = americanOddsToImpliedProbability(betOption.odds);
      edge = (trueProbability! - impliedProbability) * 100;
      expectedValue = calculateEV(trueProbability!, betOption.odds) * 100;
    }
  } else if (sharpConsensus) {
    // Use traditional sharp book consensus
    if (sharpConsensus.opposingOdds !== null) {
      const { prob1 } = removeVig(sharpConsensus.odds, sharpConsensus.opposingOdds);
      trueProbability = prob1;
    } else {
      trueProbability = americanOddsToImpliedProbability(sharpConsensus.odds);
    }
    
    if (hasUserOdds) {
      const impliedProbability = americanOddsToImpliedProbability(betOption.odds);
      edge = (trueProbability - impliedProbability) * 100;
      expectedValue = calculateEV(trueProbability, betOption.odds) * 100;
    }
  } else {
    usingSoftFallback = true;
    const softBest = softOdds.length > 0 ? softOdds.reduce((a, b) => a.odds > b.odds ? a : b) : null;
    
    if (softBest) {
      trueProbability = americanOddsToImpliedProbability(softBest.odds);
      if (hasUserOdds) {
        const impliedProbability = americanOddsToImpliedProbability(betOption.odds);
        edge = (trueProbability - impliedProbability) * 100;
        expectedValue = calculateEV(trueProbability, betOption.odds) * 100;
      }
    }
  }

  // Round edge to nearest whole number for reporting
  edge = Math.round(edge);
  
  const softBest = softOdds.length > 0 ? softOdds.reduce((a, b) => a.odds > b.odds ? a : b) : null;
  
  let baseConfidence = 100;
  if (propConsensus) {
    // Prop consensus confidence based on book agreement
    baseConfidence = 85 + (propConsensus.confidence * 15); // 85-100 range
  } else if (sharpConsensus) {
    baseConfidence = 100;
    if (sharpConsensus.lineDistance === 1) baseConfidence -= 3;
    if (sharpConsensus.lineDistance === 2) baseConfidence -= 5;
  } else {
    baseConfidence = 40;
  }
  
  // For confidence, anchor on a probability that is intuitive to the user.
  // Prefer the model-based trueProbability when available; otherwise fall
  // back to the implied probability from the user's odds.
  const probabilityForConfidence = trueProbability !== null
    ? trueProbability
    : (hasUserOdds ? americanOddsToImpliedProbability(betOption.odds) : null);

  const confidence = hasUserOdds
    ? calculateConfidence(
        probabilityForConfidence,
        edge,
        oddsRange,
        sharpOdds.length,
        relevantOdds.length,
        baseConfidence
      )
    : 0;
  
  let marketEfficiency: 'efficient' | 'inefficient' | 'highly_inefficient';
  if (oddsRange <= 15) marketEfficiency = 'efficient';
  else if (oddsRange <= 30) marketEfficiency = 'inefficient';
  else marketEfficiency = 'highly_inefficient';
  
  let sharpConsensusLabel: 'agree' | 'disagree' | 'mixed' | 'unavailable';
  if (sharpOdds.length === 0) {
    sharpConsensusLabel = 'unavailable';
  } else {
    const avgSharpOdds = sharpOdds.reduce((sum, o) => sum + o.odds, 0) / sharpOdds.length;
    const oddsGap = Math.abs(best.odds - avgSharpOdds);
    if (oddsGap <= 10) sharpConsensusLabel = 'agree';
    else if (oddsGap <= 25) sharpConsensusLabel = 'mixed';
    else sharpConsensusLabel = 'disagree';
  }
  
  const recommendation = generateRecommendation(edge, confidence, sharpConsensus !== null);
  
  const { reasons, warnings } = generateInsights(
    edge,
    expectedValue,
    sharpConsensus,
    relevantOdds,
    betOption.odds,
    best.odds,
    usingSoftFallback
  );

  if (!hasUserOdds) {
    warnings.push('NO_USER_PRICE');
  }
  
  // NBA / NFL Stats Analysis Integration
  let nbaAnalysis: PropAnalysis | undefined;
  let nflAnalysis: NflPropAnalysis | undefined;

  if (betOption.sport === 'NBA' && betOption.betType === 'player_prop' && betOption.playerName) {
    console.log(`\n🏀 Fetching NBA stats for ${betOption.playerName}...`);
    
    // Convert BetOption to ParsedBet format for NBA analyzer
    const parsedBet = {
      type: 'player_prop' as const,
      player: betOption.playerName,
      propType: betOption.market,
      line: betOption.line,
      selection: betOption.selection.toLowerCase() as 'over' | 'under',
      odds: betOption.odds,
      sportsbook: betOption.sportsbook,
      sport: 'NBA',
      rawText: `${betOption.playerName} ${betOption.selection} ${betOption.line}`,
      confidence: 0.9
    };
    
    try {
      const result = await analyzeNBAProp(parsedBet);
      nbaAnalysis = result ?? undefined;
      
      if (nbaAnalysis) {
        console.log(`✅ NBA analysis complete: ${nbaAnalysis.recommendation} (${nbaAnalysis.confidence}% confidence)`);
        
        // Merge NBA analysis into existing analysis
        // NBA stats-based edge takes priority over odds-based edge
        const statsEdge = nbaAnalysis.edge;
        let combinedEdge = (statsEdge * 0.7) + (edge * 0.3); // Weight stats more heavily
        combinedEdge = Math.round(combinedEdge);
        
        // Start from the odds-based confidence and let stats move it by
        // at most ±3 points based on how well the pick aligns with the
        // stats (median + Monte Carlo) recommendation.
        let combinedConfidence = confidence;
        let statsConfidenceAdjustment = 0;
        const nbaRec = nbaAnalysis.recommendation;
        if (nbaRec === 'bet') {
          statsConfidenceAdjustment = 3;
        } else if (nbaRec === 'lean_bet') {
          statsConfidenceAdjustment = 1.5;
        } else if (nbaRec === 'lean_pass') {
          statsConfidenceAdjustment = -1.5;
        } else if (nbaRec === 'pass') {
          statsConfidenceAdjustment = -3;
        }

        combinedConfidence = Math.max(10, Math.min(95, combinedConfidence + statsConfidenceAdjustment));
        
        // Add NBA reasoning to existing reasons
        reasons.unshift(...nbaAnalysis.reasoning.map(r => r.replace(/^📊 /, '')));
        warnings.unshift(...nbaAnalysis.warnings.map(w => w.replace(/^⚠️ /, '')));
        
        // Update recommendation based on NBA analysis
        let finalRecommendation = recommendation;
        
        if (nbaRec === 'bet' && combinedEdge > 2) {
          finalRecommendation = 'strong_bet';
        } else if (nbaRec === 'lean_bet' && combinedEdge > 1) {
          finalRecommendation = 'bet';
        } else if (nbaRec === 'pass' || nbaRec === 'lean_pass') {
          finalRecommendation = 'avoid';
        }
        
        return {
          bestOdds: best.odds,
          bestSportsbook: getBookmakerDisplayName(best.sportsbook),
          worstOdds: worst.odds,
          worstSportsbook: getBookmakerDisplayName(worst.sportsbook),
          oddsRange,
          expectedValue,
          edge: combinedEdge,
          confidence: combinedConfidence,
          marketEfficiency,
          sharpConsensus: sharpConsensusLabel,
          lineMovement: 'unknown',
          sharpBookOdds: sharpConsensus?.odds ?? null,
          sharpBookName: sharpConsensus?.sportsbook ? getBookmakerDisplayName(sharpConsensus.sportsbook) : null,
          sharpLine: sharpConsensus?.line ?? null,
          sharpLineDistance: sharpConsensus?.lineDistance ?? 0,
          trueProbability,
          softBookBestOdds: softBest?.odds ?? null,
          softBookBestName: softBest?.sportsbook ? getBookmakerDisplayName(softBest.sportsbook) : null,
          recommendation: finalRecommendation,
          reasons,
          warnings,
          allOdds: relevantOdds,
          nbaAnalysis,
          nflAnalysis
        };
      }
    } catch (error: any) {
      console.error('Error fetching NBA stats:', error);

      const message = typeof error?.message === 'string' ? error.message : '';
      if (message.includes('NBA_STATS_404')) {
        // Stats service (or proxy) returned a 404 - likely asleep or temporarily unavailable
        warnings.push("Hmm... We weren't able to get stats for some reason.");
      } else {
        warnings.push('NBA stats unavailable - using odds-only analysis');
      }
    }
  }

  // NFL Stats Analysis Integration
  if (betOption.sport === 'NFL' && betOption.betType === 'player_prop' && betOption.playerName) {
    const parsedBet = {
      type: 'player_prop' as const,
      player: betOption.playerName,
      propType: betOption.market,
      line: betOption.line,
      selection: betOption.selection.toLowerCase() as 'over' | 'under',
      odds: betOption.odds,
      sportsbook: betOption.sportsbook,
      sport: 'NFL',
      rawText: `${betOption.playerName} ${betOption.selection} ${betOption.line}`,
      confidence: 0.9,
    };

    try {
      const result = await analyzeNflProp(parsedBet as any);
      nflAnalysis = result ?? undefined;

      if (nflAnalysis) {
        const statsEdge = nflAnalysis.edge;
        let combinedEdge = (statsEdge * 0.7) + (edge * 0.3);
        combinedEdge = Math.round(combinedEdge);

        let combinedConfidence = confidence;
        let statsConfidenceAdjustment = 0;
        const nflRec = nflAnalysis.recommendation;
        if (nflRec === 'bet') {
          statsConfidenceAdjustment = 3;
        } else if (nflRec === 'lean_bet') {
          statsConfidenceAdjustment = 1.5;
        } else if (nflRec === 'lean_pass') {
          statsConfidenceAdjustment = -1.5;
        } else if (nflRec === 'pass') {
          statsConfidenceAdjustment = -3;
        }

        combinedConfidence = Math.max(10, Math.min(95, combinedConfidence + statsConfidenceAdjustment));

        // Prepend NFL reasoning/warnings
        reasons.unshift(...nflAnalysis.reasoning);
        warnings.unshift(...nflAnalysis.warnings);

        let finalRecommendation = recommendation;
        if (nflRec === 'bet' && combinedEdge > 2) {
          finalRecommendation = 'strong_bet';
        } else if (nflRec === 'lean_bet' && combinedEdge > 1) {
          finalRecommendation = 'bet';
        } else if (nflRec === 'pass' || nflRec === 'lean_pass') {
          finalRecommendation = 'avoid';
        }

        return {
          bestOdds: best.odds,
          bestSportsbook: getBookmakerDisplayName(best.sportsbook),
          worstOdds: worst.odds,
          worstSportsbook: getBookmakerDisplayName(worst.sportsbook),
          oddsRange,
          expectedValue,
          edge: combinedEdge,
          confidence: combinedConfidence,
          marketEfficiency,
          sharpConsensus: sharpConsensusLabel,
          lineMovement: 'unknown',
          sharpBookOdds: sharpConsensus?.odds ?? null,
          sharpBookName: sharpConsensus?.sportsbook ? getBookmakerDisplayName(sharpConsensus.sportsbook) : null,
          sharpLine: sharpConsensus?.line ?? null,
          sharpLineDistance: sharpConsensus?.lineDistance ?? 0,
          trueProbability,
          softBookBestOdds: softBest?.odds ?? null,
          softBookBestName: softBest?.sportsbook ? getBookmakerDisplayName(softBest.sportsbook) : null,
          recommendation: finalRecommendation,
          reasons,
          warnings,
          allOdds: relevantOdds,
          nbaAnalysis,
          nflAnalysis,
        };
      }
    } catch (error: any) {
      console.error('Error fetching NFL stats:', error);
      warnings.push('NFL stats unavailable - using odds-only analysis');
    }
  }

  // Return standard analysis (no NBA/NFL stats)
  return {
    bestOdds: best.odds,
    bestSportsbook: getBookmakerDisplayName(best.sportsbook),
    worstOdds: worst.odds,
    worstSportsbook: getBookmakerDisplayName(worst.sportsbook),
    oddsRange,
    expectedValue,
    edge,
    confidence,
    marketEfficiency,
    sharpConsensus: sharpConsensusLabel,
    lineMovement: 'unknown',
    sharpBookOdds: sharpConsensus?.odds ?? null,
    sharpBookName: sharpConsensus?.sportsbook ? getBookmakerDisplayName(sharpConsensus.sportsbook) : null,
    sharpLine: sharpConsensus?.line ?? null,
    sharpLineDistance: sharpConsensus?.lineDistance ?? 0,
    trueProbability,
    softBookBestOdds: softBest?.odds ?? null,
    softBookBestName: softBest?.sportsbook ? getBookmakerDisplayName(softBest.sportsbook) : null,
    recommendation,
    reasons,
    warnings,
    allOdds: relevantOdds,
    nbaAnalysis,
    nflAnalysis,
  };
}

function calculateConfidence(
  trueProbability: number | null,
  edge: number,
  oddsRange: number,
  sharpBookCount: number,
  totalBookCount: number,
  baseConfidence: number
): number {
  // Simple, odds-first approach:
  // - Anchor confidence on trueProbability when we have it
  // - Apply a small adjustment based on edge (up to ±3 percentage points)
  // - When trueProbability is missing, fall back to baseConfidence with the same
  //   small edge-based adjustment.

  let confidence: number;

  // Edge is expressed as a percentage (e.g. +5 means 5% edge).
  // Convert to a small adjustment in confidence, capped at ±3 points.
  const edgeAdjustment = Math.max(-3, Math.min(3, edge * 0.1));

  if (trueProbability !== null) {
    const baseFromProb = trueProbability * 100; // 0-1 -> 0-100
    confidence = baseFromProb + edgeAdjustment;
  } else {
    confidence = baseConfidence + edgeAdjustment;
  }

  // Clamp to a reasonable range and round to integer
  return Math.max(10, Math.min(95, Math.round(confidence)));
}

function generateRecommendation(
  edge: number,
  confidence: number,
  hasSharpData: boolean
): 'strong_bet' | 'bet' | 'consider' | 'avoid' | 'no_edge' {
  if (edge <= 0) return 'no_edge';
  
  if (!hasSharpData) {
    if (edge >= 4 && confidence >= 55) return 'consider';
    return 'avoid';
  }
  
  if (edge >= 3 && confidence >= 65) return 'strong_bet';
  if (edge >= 2 && confidence >= 55) return 'bet';
  if (edge >= 1 && confidence >= 45) return 'consider';
  
  return 'avoid';
}

function generateInsights(
  edge: number,
  ev: number,
  sharpConsensus: any,
  allOdds: Array<{ sportsbook: string; odds: number; isSharp: boolean }>,
  userOdds: number,
  bestOdds: number,
  usingSoftFallback: boolean
): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  
  if (edge >= 3) {
    reasons.push(`Strong ${edge.toFixed(1)}% edge vs ${usingSoftFallback ? 'soft' : 'sharp'} consensus`);
  } else if (edge >= 2) {
    reasons.push(`Good ${edge.toFixed(1)}% edge vs ${usingSoftFallback ? 'soft' : 'sharp'} consensus`);
  } else if (edge >= 1) {
    reasons.push(`Marginal ${edge.toFixed(1)}% edge vs ${usingSoftFallback ? 'soft' : 'sharp'} consensus`);
  }
  
  if (bestOdds > userOdds) {
    const improvement = bestOdds - userOdds;
    reasons.push(`Better odds available: ${bestOdds > 0 ? '+' : ''}${bestOdds} (${improvement > 0 ? '+' : ''}${improvement} better)`);
  }
  
  if (sharpConsensus && sharpConsensus.lineDistance === 0) {
    reasons.push('Sharp consensus at exact line');
  }
  
  const sharpCount = allOdds.filter(o => o.isSharp).length;
  if (sharpCount >= 2) {
    reasons.push(`${sharpCount} sharp books agree on this line`);
  }
  
  if (!sharpConsensus) {
    warnings.push('Limited sharp market data - use additional research');
  }
  
  if (sharpConsensus && sharpConsensus.lineDistance > 0) {
    warnings.push(`Analysis uses sharp line ${sharpConsensus.lineDistance} ${sharpConsensus.lineDistance === 1 ? 'point' : 'points'} away`);
  }
  
  if (allOdds.length < 3) {
    warnings.push('Limited market coverage - fewer books offering this line');
  }
  
  if (sharpConsensus && !sharpConsensus.opposingOdds) {
    warnings.push('Vig removal unavailable - using implied probability');
  }
  
  return { reasons, warnings };
}

function createEmptyAnalysis(): AnalysisResult {
  return {
    bestOdds: 0,
    bestSportsbook: '',
    worstOdds: 0,
    worstSportsbook: '',
    oddsRange: 0,
    expectedValue: 0,
    edge: 0,
    confidence: 0,
    marketEfficiency: 'efficient',
    sharpConsensus: 'unavailable',
    lineMovement: 'unknown',
    sharpBookOdds: null,
    sharpBookName: null,
    sharpLine: null,
    sharpLineDistance: 0,
    trueProbability: null,
    softBookBestOdds: null,
    softBookBestName: null,
    recommendation: 'no_edge',
    reasons: [],
    warnings: ['No odds data available'],
    allOdds: []
  };
}

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'text-green-500';
  if (confidence >= 60) return 'text-blue-500';
  if (confidence >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

export function getRecommendationColor(recommendation: string): string {
  switch (recommendation) {
    case 'strong_bet': return 'bg-green-600';
    case 'bet': return 'bg-green-500';
    case 'consider': return 'bg-yellow-500';
    case 'avoid': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

export async function compareBets(
  betOptions: BetOption[],
  allBookmakerData: BookmakerOdds[]
): Promise<Array<BetOption & { analysis: AnalysisResult }>> {
  const analyzed = await Promise.all(
    betOptions.map(async bet => ({
      ...bet,
      analysis: await analyzeBet(bet, allBookmakerData)
    }))
  );
  
  return analyzed.sort((a, b) => {
    if (a.analysis.confidence !== b.analysis.confidence) {
      return b.analysis.confidence - a.analysis.confidence;
    }
    return b.analysis.edge - a.analysis.edge;
  });
}

export function findBestOdds(
  market: string,
  selection: string,
  line: number | undefined,
  allBookmakerData: BookmakerOdds[]
): { sportsbook: string; odds: number } | null {
  let bestOdds = -Infinity;
  let bestBook = '';
  
  for (const bookmaker of allBookmakerData) {
    const marketData = bookmaker.markets.find(m => m.key === market);
    if (!marketData) continue;
    
    const outcome = marketData.outcomes.find(o => 
      o.name === selection && (line === undefined || o.point === line)
    );
    
    if (outcome && outcome.price > bestOdds) {
      bestOdds = outcome.price;
      bestBook = bookmaker.key;
    }
  }
  
  return bestOdds === -Infinity ? null : { sportsbook: bestBook, odds: bestOdds };
}

export function getAllOddsForSelection(
  market: string,
  selection: string,
  line: number | undefined,
  playerName: string | undefined,
  allBookmakerData: BookmakerOdds[]
): Array<{ sportsbook: string; odds: number; isSharp: boolean }> {
  const allOdds: Array<{ sportsbook: string; odds: number; isSharp: boolean }> = [];
  
  for (const bookmaker of allBookmakerData) {
    const marketData = bookmaker.markets.find(m => m.key === market);
    if (!marketData) continue;
    
    const outcome = marketData.outcomes.find(o => {
      const matchesName = o.name === selection;
      const matchesLine = line === undefined || o.point === line;
      const matchesPlayer = !playerName || o.description === playerName;
      return matchesName && matchesLine && matchesPlayer;
    });
    
    if (outcome) {
      allOdds.push({
        sportsbook: bookmaker.key,
        odds: outcome.price,
        isSharp: isSharpBook(bookmaker.key)
      });
    }
  }
  
  return allOdds.sort((a, b) => b.odds - a.odds);
}