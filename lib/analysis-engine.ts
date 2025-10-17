// lib/analysis-engine.ts
// Universal Analysis Engine with CORRECT formulas and Sharp/Soft fallback

import {
  americanOddsToImpliedProbability,
  americanToDecimal,
  removeVig,
  calculateEV,
  calculateEdge
} from './odds-calculations'

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
}

const SHARP_BOOKMAKERS = ['pinnacle', 'betonline', 'bookmaker', 'circa'];

function isSharpBook(bookmakerKey: string): boolean {
  const normalized = bookmakerKey.toLowerCase().replace(/\s+/g, '');
  return SHARP_BOOKMAKERS.some(sharp => normalized.includes(sharp));
}

export function analyzeBet(
  betOption: BetOption,
  allBookmakerData: BookmakerOdds[]
): AnalysisResult {
  const relevantOdds = allBookmakerData
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
  
  if (relevantOdds.length === 0) {
    return createEmptyAnalysis();
  }
  
  const sharpOdds = relevantOdds.filter(o => o.isSharp);
  const softOdds = relevantOdds.filter(o => !o.isSharp);
  
  const sortedOdds = [...relevantOdds].sort((a, b) => b.odds - a.odds);
  const best = sortedOdds[0];
  const worst = sortedOdds[sortedOdds.length - 1];
  const oddsRange = best.odds - worst.odds;
  
  // CRITICAL FIX: Fallback to soft books if no sharp books available
  let referenceBook: { sportsbook: string; odds: number; isSharp: boolean };
  let usingSoftFallback = false;
  
  if (sharpOdds.length > 0) {
    referenceBook = sharpOdds.reduce((a, b) => a.odds > b.odds ? a : b);
  } else {
    // FALLBACK TO SOFT BOOKS
    referenceBook = softOdds.reduce((a, b) => a.odds > b.odds ? a : b);
    usingSoftFallback = true;
    console.warn('⚠️ No sharp books available - using soft book consensus for true probability');
  }
  
  const softBest = softOdds.length > 0 ? softOdds.reduce((a, b) => a.odds > b.odds ? a : b) : null;
  
  // Get opposing odds to remove vig
  let opposingOdds: number | null = null;
  
  for (const bookmaker of allBookmakerData) {
    if (bookmaker.key !== referenceBook.sportsbook) continue;
    
    const market = bookmaker.markets.find(m => m.key === betOption.market);
    if (!market) continue;
    
    const opposingOutcome = market.outcomes.find(o => {
      if (betOption.market === 'h2h') {
        return o.name !== betOption.selection;
      } else if (betOption.market === 'spreads' || betOption.market === 'totals') {
        return o.name !== betOption.selection;
      } else {
        return o.name !== betOption.selection && o.description === betOption.playerName;
      }
    });
    
    if (opposingOutcome) {
      opposingOdds = opposingOutcome.price;
      break;
    }
  }
  
  // Calculate TRUE probability
  let trueProbability: number;
  
  if (opposingOdds !== null) {
    const { prob1 } = removeVig(referenceBook.odds, opposingOdds);
    trueProbability = prob1;
  } else {
    trueProbability = americanOddsToImpliedProbability(referenceBook.odds);
  }
  
  // Calculate EV and Edge using YOUR EXACT formulas
  const expectedValue = calculateEV(trueProbability, best.odds);
  const edge = calculateEdge(trueProbability, best.odds);
  
  // Calculate confidence
  let baseConfidence = usingSoftFallback ? 40 : 50;
  const confidence = calculateConfidence(edge, oddsRange, sharpOdds.length, relevantOdds.length, baseConfidence);
  
  // Market efficiency
  let marketEfficiency: 'efficient' | 'inefficient' | 'highly_inefficient';
  if (oddsRange <= 15) marketEfficiency = 'efficient';
  else if (oddsRange <= 30) marketEfficiency = 'inefficient';
  else marketEfficiency = 'highly_inefficient';
  
  // Sharp consensus
  let sharpConsensus: 'agree' | 'disagree' | 'mixed' | 'unavailable';
  if (sharpOdds.length === 0) {
    sharpConsensus = 'unavailable';
  } else {
    const avgSharpOdds = sharpOdds.reduce((sum, o) => sum + o.odds, 0) / sharpOdds.length;
    const oddsGap = Math.abs(best.odds - avgSharpOdds);
    if (oddsGap <= 10) sharpConsensus = 'agree';
    else if (oddsGap <= 25) sharpConsensus = 'mixed';
    else sharpConsensus = 'disagree';
  }
  
  const recommendation = generateRecommendation(edge, confidence, usingSoftFallback);
  
  // Generate reasons and warnings
  const reasons: string[] = [];
  const warnings: string[] = [];
  
  if (edge >= 3) {
    reasons.push(`Strong ${edge.toFixed(1)}% edge vs ${usingSoftFallback ? 'soft' : 'sharp'} market`);
  } else if (edge >= 2) {
    reasons.push(`Good ${edge.toFixed(1)}% edge vs ${usingSoftFallback ? 'soft' : 'sharp'} market`);
  } else if (edge >= 1) {
    reasons.push(`Marginal ${edge.toFixed(1)}% edge vs ${usingSoftFallback ? 'soft' : 'sharp'} market`);
  }
  
  if (softBest && !usingSoftFallback && referenceBook && softBest.odds > referenceBook.odds) {
    const gap = softBest.odds - referenceBook.odds;
    reasons.push(`Soft book offering ${gap > 0 ? '+' : ''}${gap} better than sharp line`);
  }
  
  if (marketEfficiency === 'highly_inefficient') {
    reasons.push(`Wide market (${oddsRange} points) - potential inefficiency`);
  }
  
  if (usingSoftFallback) {
    warnings.push('Using soft book consensus - no sharp books available. Lower confidence.');
  }
  
  if (edge < 0) {
    warnings.push('Negative edge - betting against the market');
  }
  
  if (confidence < 40) {
    warnings.push('Low confidence - limited data or high uncertainty');
  }
  
  if (sharpOdds.length === 1 && !usingSoftFallback) {
    warnings.push('Only one sharp bookmaker available');
  }
  
  if (relevantOdds.length < 3) {
    warnings.push('Limited market coverage');
  }
  
  return {
    bestOdds: best.odds,
    bestSportsbook: best.sportsbook,
    worstOdds: worst.odds,
    worstSportsbook: worst.sportsbook,
    oddsRange,
    expectedValue,
    edge,
    confidence,
    marketEfficiency,
    sharpConsensus,
    lineMovement: 'unknown',
    sharpBookOdds: sharpOdds.length > 0 ? referenceBook.odds : null,
    sharpBookName: sharpOdds.length > 0 ? referenceBook.sportsbook : null,
    softBookBestOdds: softBest?.odds ?? null,
    softBookBestName: softBest?.sportsbook ?? null,
    recommendation,
    reasons,
    warnings,
    allOdds: relevantOdds
  };
}

function calculateConfidence(
  edge: number,
  oddsRange: number,
  sharpBookCount: number,
  totalBookCount: number,
  baseConfidence: number = 50
): number {
  let confidence = baseConfidence;
  
  // Edge contribution
  if (edge >= 5) confidence += 25;
  else if (edge >= 3) confidence += 20;
  else if (edge >= 2) confidence += 15;
  else if (edge >= 1) confidence += 10;
  else if (edge >= 0) confidence += 5;
  else confidence -= 20;
  
  // Market tightness
  if (oddsRange <= 10) confidence += 15;
  else if (oddsRange <= 20) confidence += 10;
  else if (oddsRange <= 30) confidence += 5;
  else confidence -= 10;
  
  // Sharp book coverage
  if (sharpBookCount >= 3) confidence += 10;
  else if (sharpBookCount >= 2) confidence += 5;
  else if (sharpBookCount === 1) confidence -= 5;
  else confidence -= 10; // No sharp books
  
  // Total coverage
  if (totalBookCount >= 5) confidence += 5;
  else if (totalBookCount < 3) confidence -= 10;
  
  return Math.max(1, Math.min(100, Math.round(confidence)));
}

function generateRecommendation(
  edge: number,
  confidence: number,
  usingSoftFallback: boolean
): 'strong_bet' | 'bet' | 'consider' | 'avoid' | 'no_edge' {
  if (edge <= 0) return 'no_edge';
  
  // Lower thresholds when using soft book fallback
  if (usingSoftFallback) {
    if (edge >= 4 && confidence >= 60) return 'bet';
    if (edge >= 2 && confidence >= 50) return 'consider';
    return 'avoid';
  }
  
  // Normal sharp book thresholds
  if (edge >= 3 && confidence >= 70) return 'strong_bet';
  if (edge >= 2 && confidence >= 60) return 'bet';
  if (edge >= 1 && confidence >= 50) return 'consider';
  if (confidence < 40) return 'avoid';
  
  return 'consider';
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

export function compareBets(
  betOptions: BetOption[],
  allBookmakerData: BookmakerOdds[]
): Array<BetOption & { analysis: AnalysisResult }> {
  const analyzed = betOptions.map(bet => ({
    ...bet,
    analysis: analyzeBet(bet, allBookmakerData)
  }));
  
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