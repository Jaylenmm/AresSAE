/**
 * NBA Prop Analyzer
 * Uses real NBA stats with median-based analysis and Monte Carlo simulation
 */
import type { ParsedBet } from './bet-parser';
import type { PlayerGameLog, PlayerSeasonStats } from './nba-stats-service';
import { calculateStats, calculateHitProbability, calculateWeightedMedian } from './statistical-analysis';
import { runMonteCarloSimulation, calculatePropProbability, type SimulationResult } from './monte-carlo-simulator';

export interface PropAnalysis {
  recommendation: 'bet' | 'pass' | 'lean_bet' | 'lean_pass';
  confidence: number; // 0-100
  edge: number; // Expected value as percentage
  reasoning: string[];
  warnings: string[];
  stats: {
    seasonAverage: number;
    seasonMedian: number;
    last5Average: number;
    last5Median: number;
    hitRate: number; // % of recent games that would hit this prop
    trend: 'up' | 'down' | 'stable';
    skewness: number; // Distribution skew
  };
  simulation?: {
    mean: number;
    median: number;
    stdDev: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
    hitProbability: number;
    fairOdds: { over: number; under: number };
  };
}

/**
 * Analyze an NBA player prop bet using real stats
 */
export async function analyzeNBAProp(bet: ParsedBet): Promise<PropAnalysis | null> {
  // Validate required fields
  if (!bet.player || !bet.propType || !bet.line || !bet.selection) {
    console.log(`❌ Missing required bet fields`);
    return null;
  }
  
  console.log(`\n🔍 Analyzing ${bet.player} - ${bet.propType} ${bet.selection} ${bet.line}`);
  
  // Get player stats via server API to avoid client-side CORS/timeouts
  const statsResponse = await fetch(`/api/nba-stats?player=${encodeURIComponent(bet.player)}`);
  if (!statsResponse.ok) {
    console.log(`❌ Failed to fetch stats for ${bet.player} via /api/nba-stats: ${statsResponse.status}`);
    return null;
  }

  type StatsResponse = { averages: PlayerSeasonStats; recentGames: PlayerGameLog[] };
  const stats = (await statsResponse.json()) as StatsResponse | null;
  
  if (!stats) {
    console.log(`❌ Could not find stats for ${bet.player}`);
    return null;
  }
  
  // Map prop type to stat field
  const statField = mapPropTypeToStat(bet.propType);
  if (!statField) {
    console.log(`❌ Unknown prop type: ${bet.propType}`);
    return null;
  }
  
  // Type-safe access to validated fields
  const line = bet.line as number;
  const selection = bet.selection as 'over' | 'under';
  
  // Get all game values for this stat
  const allGameValues = stats.recentGames.map(game => getGameStatValue(game, statField));
  const last5Values = allGameValues.slice(0, 5);
  const last10Values = allGameValues.slice(0, 10);
  
  // Calculate statistical summaries
  const seasonStats = calculateStats(allGameValues);
  const last5Stats = calculateStats(last5Values);
  
  // MEDIAN-BASED ANALYSIS (Sharp approach)
  const seasonMedian = seasonStats.median;
  const last5Median = last5Stats.median;
  const weightedMedian = calculateWeightedMedian(last10Values, 0.7);
  
  // Legacy averages (for comparison)
  const seasonAvg = seasonStats.mean;
  const last5Avg = last5Stats.mean;
  
  // Calculate hit rate using actual game results
  const hitRate = calculateHitProbability(allGameValues, line, selection) * 100;
  
  // Determine trend (using median, not mean)
  const trend = determineTrend(last5Median, seasonMedian);
  
  // RUN MONTE CARLO SIMULATION
  console.log(`🎲 Running Monte Carlo simulation (10,000 iterations)...`);
  const simulation = runMonteCarloSimulation({
    playerStats: stats.averages,
    recentGames: stats.recentGames,
    propType: bet.propType,
    iterations: 10000
  });
  
  const propProb = calculatePropProbability(simulation, line, bet.odds || -110);
  
  // Calculate edge using SIMULATION-BASED PROBABILITY (not simple average)
  const impliedProbability = Math.abs(bet.odds || -110) / (Math.abs(bet.odds || -110) + 100);
  const trueProbability = selection === 'over' ? propProb.overProbability : propProb.underProbability;
  const edge = (trueProbability - impliedProbability) * 100;
  
  // Generate reasoning based on MEDIAN and SIMULATION
  const reasoning: string[] = [];
  const warnings: string[] = [];
  
  // Simulation-based analysis (PRIMARY)
  reasoning.push(`Simulation median: ${simulation.median.toFixed(1)} (from 10,000 iterations)`);
  reasoning.push(`Hit probability: ${(trueProbability * 100).toFixed(1)}% (simulation-based)`);
  
  if (Math.abs(seasonStats.skewness) > 0.5) {
    const skewDirection = seasonStats.skewness > 0 ? 'right' : 'left';
    warnings.push(`Distribution is ${skewDirection}-skewed (${seasonStats.skewness.toFixed(2)}) - median differs from mean`);
  }
  
  // Median vs Line analysis (SHARP APPROACH)
  if (selection === 'over') {
    if (weightedMedian > line) {
      reasoning.push(`Weighted median (${weightedMedian.toFixed(1)}) is ${(weightedMedian - line).toFixed(1)} above the line`);
    } else {
      warnings.push(`Weighted median (${weightedMedian.toFixed(1)}) is ${(line - weightedMedian).toFixed(1)} below the line`);
    }
  } else {
    if (weightedMedian < line) {
      reasoning.push(`Weighted median (${weightedMedian.toFixed(1)}) is ${(line - weightedMedian).toFixed(1)} below the line`);
    } else {
      warnings.push(`Weighted median (${weightedMedian.toFixed(1)}) is ${(weightedMedian - line).toFixed(1)} above the line`);
    }
  }
  
  // Recent form analysis (using median)
  if (trend === 'up') {
    reasoning.push(`Trending up: Last 5 median (${last5Median.toFixed(1)}) > season median (${seasonMedian.toFixed(1)})`);
  } else if (trend === 'down') {
    warnings.push(`Trending down: Last 5 median (${last5Median.toFixed(1)}) < season median (${seasonMedian.toFixed(1)})`);
  }
  
  // Hit rate analysis
  const hitCount = Math.round(hitRate * allGameValues.length / 100);
  if (hitRate >= 70) {
    reasoning.push(`Strong hit rate: ${hitRate.toFixed(0)}% (${hitCount}/${allGameValues.length} games)`);
  } else if (hitRate <= 30) {
    warnings.push(`Low hit rate: ${hitRate.toFixed(0)}% (${hitCount}/${allGameValues.length} games)`);
  } else {
    reasoning.push(`Moderate hit rate: ${hitRate.toFixed(0)}% (${hitCount}/${allGameValues.length} games)`);
  }
  
  // Sample size check
  if (stats.averages.gamesPlayed < 5) {
    warnings.push(`Limited sample size: Only ${stats.averages.gamesPlayed} games played this season`);
  }
  
  // Variance warning
  if (seasonStats.stdDev > seasonStats.mean * 0.4) {
    warnings.push(`High variance (σ=${seasonStats.stdDev.toFixed(1)}) - inconsistent performance`);
  }
  
  // Determine recommendation
  let recommendation: PropAnalysis['recommendation'];
  let confidence: number;
  
  if (edge > 5 && hitRate >= 60) {
    recommendation = 'bet';
    confidence = Math.min(95, 60 + edge);
  } else if (edge > 2 && hitRate >= 50) {
    recommendation = 'lean_bet';
    confidence = Math.min(75, 50 + edge);
  } else if (edge < -5 || hitRate <= 30) {
    recommendation = 'pass';
    confidence = Math.min(95, 60 + Math.abs(edge));
  } else if (edge < -2 || hitRate <= 40) {
    recommendation = 'lean_pass';
    confidence = Math.min(75, 50 + Math.abs(edge));
  } else {
    recommendation = 'pass';
    confidence = 50;
    warnings.push('Insufficient edge to recommend this bet');
  }
  
  console.log(`✅ Analysis complete: ${recommendation.toUpperCase()} (${confidence}% confidence, ${edge.toFixed(1)}% edge)`);
  console.log(`   Simulation median: ${simulation.median.toFixed(1)}, Hit probability: ${(trueProbability * 100).toFixed(1)}%`);
  
  return {
    recommendation,
    confidence,
    edge,
    reasoning,
    warnings,
    stats: {
      seasonAverage: seasonAvg,
      seasonMedian: seasonMedian,
      last5Average: last5Avg,
      last5Median: last5Median,
      hitRate,
      trend,
      skewness: seasonStats.skewness
    },
    simulation: {
      mean: simulation.mean,
      median: simulation.median,
      stdDev: simulation.stdDev,
      p10: simulation.p10,
      p25: simulation.p25,
      p75: simulation.p75,
      p90: simulation.p90,
      hitProbability: trueProbability,
      fairOdds: propProb.fairOdds
    }
  };
}

/**
 * Map prop type to stat field name
 */
function mapPropTypeToStat(propType: string): string | null {
  const normalized = propType.toLowerCase();
  
  if (normalized.includes('point')) return 'points';
  if (normalized.includes('rebound')) return 'rebounds';
  if (normalized.includes('assist')) return 'assists';
  if (normalized.includes('steal')) return 'steals';
  if (normalized.includes('block')) return 'blocks';
  if (normalized.includes('turnover')) return 'turnovers';
  if (normalized.includes('three') || normalized.includes('3pt')) return 'threePointsMade';
  
  // Combo stats
  if (normalized.includes('pts+reb') || normalized.includes('points+rebounds')) return 'pointsRebounds';
  if (normalized.includes('pts+ast') || normalized.includes('points+assists')) return 'pointsAssists';
  if (normalized.includes('reb+ast') || normalized.includes('rebounds+assists')) return 'reboundsAssists';
  if (normalized.includes('pra') || normalized.includes('pts+reb+ast')) return 'pointsReboundsAssists';
  
  return null;
}

/**
 * Get stat value from season averages
 */
function getStatValue(averages: any, statField: string): number {
  // Combo stats
  if (statField === 'pointsRebounds') return averages.points + averages.rebounds;
  if (statField === 'pointsAssists') return averages.points + averages.assists;
  if (statField === 'reboundsAssists') return averages.rebounds + averages.assists;
  if (statField === 'pointsReboundsAssists') return averages.points + averages.rebounds + averages.assists;
  
  return averages[statField] || 0;
}

/**
 * Get stat value from a single game
 */
function getGameStatValue(game: any, statField: string): number {
  // Combo stats
  if (statField === 'pointsRebounds') return game.points + game.rebounds;
  if (statField === 'pointsAssists') return game.points + game.assists;
  if (statField === 'reboundsAssists') return game.rebounds + game.assists;
  if (statField === 'pointsReboundsAssists') return game.points + game.rebounds + game.assists;
  
  return game[statField] || 0;
}

/**
 * Determine if player is trending up, down, or stable
 */
function determineTrend(last5Avg: number, seasonAvg: number): 'up' | 'down' | 'stable' {
  const diff = last5Avg - seasonAvg;
  const threshold = seasonAvg * 0.1; // 10% threshold
  
  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'stable';
}

/**
 * Calculate expected edge
 */
function calculateEdge(
  line: number,
  seasonAvg: number,
  last5Avg: number,
  selection: 'over' | 'under',
  hitRate: number
): number {
  // Weight recent form more heavily
  const weightedAvg = (seasonAvg * 0.4) + (last5Avg * 0.6);
  
  // Calculate distance from line
  const distance = selection === 'over' 
    ? weightedAvg - line 
    : line - weightedAvg;
  
  // Convert to percentage edge
  const distanceEdge = (distance / line) * 100;
  
  // Factor in hit rate
  const hitRateEdge = (hitRate - 50) / 5; // Each 5% above 50% = 1% edge
  
  // Combined edge
  return distanceEdge + hitRateEdge;
}
